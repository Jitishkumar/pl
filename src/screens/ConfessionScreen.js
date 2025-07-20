import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  TextInput, 
  FlatList, 
  Image, 
  Modal,
  ScrollView,
  Switch,
  ActivityIndicator,
  Platform,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { WebView } from 'react-native-webview';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../config/supabase';
import * as Location from 'expo-location';
import * as FileSystem from 'expo-file-system';

const ConfessionScreen = () => {
  const navigation = useNavigation();
  const [mode, setMode] = useState('view'); // Changed default to 'view' to skip selection screen
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [showMap, setShowMap] = useState(false);
  const [confessions, setConfessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showNewConfessionModal, setShowNewConfessionModal] = useState(false);
  const [newConfession, setNewConfession] = useState('');
  const [media, setMedia] = useState([]);
  const [remainAnonymous, setRemainAnonymous] = useState(true);
  const [mapRegion, setMapRegion] = useState({
    latitude: 37.78825,
    longitude: -122.4324,
  });
  const [userLocation, setUserLocation] = useState(null);
  const [locationPermission, setLocationPermission] = useState(null);
  const [searchError, setSearchError] = useState(null);

  // Request location permission and get current location
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status);
      
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        setUserLocation(location);
        setMapRegion({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      }
    })();
    
    // Cleanup function to clear any pending search timeout when component unmounts
    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
    };
  }, [searchTimeout]);

  const getMapUrl = () => {
    const lat = mapRegion.latitude;
    const lon = mapRegion.longitude;
    let url = `https://www.openstreetmap.org/export/embed.html?bbox=${lon-0.05},${lat-0.05},${lon+0.05},${lat+0.05}&layer=mapnik`;
    
    if (selectedLocation) {
      url += `&marker=${selectedLocation.lat},${selectedLocation.lon}`;
    }
    if (userLocation) {
      url += `&marker=${userLocation.coords.latitude},${userLocation.coords.longitude}`;
    }
    return url;
  };

  const [showAddPlaceModal, setShowAddPlaceModal] = useState(false);
  const [newPlace, setNewPlace] = useState({
    type: 'institute', // Default type
    name: '',
    city: '',
    district: '',
    state: '',
    country: ''
  });

  // Add a reference to store the search timeout
  const [searchTimeout, setSearchTimeout] = useState(null);

  const searchLocations = async (query) => {
    if (query.length < 3) {
      setSearchResults([]);
      return;
    }
    
    setLoading(true);
    setSearchError(null);
    try {
      // Create an array to hold all search results
      let combinedResults = [];
      
      // 1. Search OpenStreetMap API
      let searchUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=10`;
      
      if (userLocation) {
        searchUrl += `&viewbox=${userLocation.coords.longitude-0.1},${userLocation.coords.latitude-0.1},${userLocation.coords.longitude+0.1},${userLocation.coords.latitude+0.1}`;
      }
      
      const response = await fetch(searchUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'FlexxApp/1.0'
        }
      });
      
      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
      
      const osmData = await response.json();
      combinedResults = [...osmData];
      
      // 2. Search custom places from Supabase with improved search logic
      console.log('Searching for custom places with query:', query);
      
      // Split the query into words for more flexible matching
      const queryWords = query.toLowerCase().split(/\s+/).filter(word => word.length >= 2);
      
      // Build a more flexible search filter
      let filterConditions = [];
      
      // First try exact match with the full query
      filterConditions.push(`name.ilike.%${query}%`);
      filterConditions.push(`city.ilike.%${query}%`);
      
      // Then try matching individual words across different fields
      queryWords.forEach(word => {
        filterConditions.push(`name.ilike.%${word}%`);
        filterConditions.push(`city.ilike.%${word}%`);
        filterConditions.push(`district.ilike.%${word}%`);
        filterConditions.push(`state.ilike.%${word}%`);
        filterConditions.push(`country.ilike.%${word}%`);
      });
      
      const { data: placesData, error: placesError } = await supabase
        .from('places')
        .select('*')
        .or(filterConditions.join(','))
        .limit(20);
      
      if (placesError) {
        console.error('Error searching custom places:', placesError);
      } else {
        console.log('Custom places search results:', placesData ? placesData.length : 0);
        
        if (placesData && placesData.length > 0) {
          // Format custom places to match OpenStreetMap result structure
          const formattedPlaces = placesData.map(place => {
            // Create a display name that highlights which part matched the search
            const displayName = `${place.name}, ${place.city}${place.district ? ', ' + place.district : ''}, ${place.state}, ${place.country} (Custom)`;
            
            return {
              place_id: `custom_${place.id}`, // Add prefix to distinguish from OSM IDs
              display_name: displayName,
              lat: place.latitude ? place.latitude.toString() : '0',
              lon: place.longitude ? place.longitude.toString() : '0',
              // Add a flag to identify custom places
              is_custom: true
            };
          });
          
          // Add custom places to the combined results
          combinedResults = [...combinedResults, ...formattedPlaces];
        }
      }
      
      // Set the combined results
      setSearchResults(combinedResults);
    } catch (error) {
      console.error('Error searching locations:', error);
      setSearchError(error.message);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPlace = async () => {
    if (!newPlace.name || !newPlace.city || !newPlace.state || !newPlace.country) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      // Get the current authenticated user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        Alert.alert('Error', 'You must be logged in to add a place');
        return;
      }
      
      // Use user's current location as fallback for latitude/longitude
      let latitude = null;
      let longitude = null;
      
      if (userLocation) {
        latitude = userLocation.coords.latitude;
        longitude = userLocation.coords.longitude;
      }
      
      const placeData = {
        type: newPlace.type,
        name: newPlace.name,
        city: newPlace.city,
        district: newPlace.district || null,
        state: newPlace.state,
        country: newPlace.country,
        latitude: latitude,
        longitude: longitude,
        created_at: new Date().toISOString(),
        created_by: user.id // Add the authenticated user's ID to satisfy RLS policy
      };
      
      console.log('Adding new place:', placeData);
      
      const { data, error } = await supabase
        .from('places')
        .insert([placeData])
        .select()
        .single();

      if (error) throw error;

      // Close modal and reset form
      setShowAddPlaceModal(false);
      setNewPlace({
        type: 'institute',
        name: '',
        city: '',
        state: '',
        country: ''
      });

      // Add the new place to search results with proper coordinates
      const newPlaceResult = {
        place_id: `custom_${data.id}`,
        display_name: `${data.name}, ${data.city}${data.district ? ', ' + data.district : ''}, ${data.state}, ${data.country} (Custom)`,
        lat: data.latitude ? data.latitude.toString() : (latitude ? latitude.toString() : '0'),
        lon: data.longitude ? data.longitude.toString() : (longitude ? longitude.toString() : '0'),
        is_custom: true
      };
      
      console.log('Added new place to search results:', newPlaceResult);
      
      setSearchResults(prevResults => [
        ...prevResults,
        newPlaceResult
      ]);
      
      // Immediately select the newly added place
      selectLocation(newPlaceResult);
      
      Alert.alert('Success', 'Place added successfully');
    } catch (error) {
      console.error('Error adding place:', error);
      Alert.alert('Error', 'Failed to add place. Please try again.');
    }
  };

  const selectLocation = (location) => {
    if (!location) {
      console.error('Error: Attempted to select undefined location');
      return;
    }
    
    setSelectedLocation(location);
    setSearchResults([]);
    
    if (location.lat && location.lon) {
      setMapRegion({
        latitude: parseFloat(location.lat),
        longitude: parseFloat(location.lon),
      });
    }
    
    // Check if place_id exists before proceeding
    if (!location.place_id) {
      console.error('Error: Selected location has no place_id');
      Alert.alert('Error', 'Invalid location data. Please try selecting a different location.');
      return;
    }
    
    // Handle custom place IDs (they have 'custom_' prefix)
    let locationId = location.place_id;
    if (location.is_custom && typeof locationId === 'string' && locationId.startsWith('custom_')) {
      // Extract the numeric ID part for custom places
      locationId = locationId.replace('custom_', '');
    }
    
    loadConfessions(locationId);
  };

  
  // Add a refresh function to reload confessions
  const refreshConfessions = () => {
    if (selectedLocation && selectedLocation.place_id) {
      // Handle custom place IDs consistently
      let locationId = selectedLocation.place_id;
      if (selectedLocation.is_custom && typeof locationId === 'string' && locationId.startsWith('custom_')) {
        locationId = locationId.replace('custom_', '');
      }
      loadConfessions(locationId);
    } else {
      console.warn('Cannot refresh: No location selected or invalid location');
    }
  };

  // Mode state is already declared at the top of the component
  
  const loadConfessions = async (locationId) => {
    setLoading(true);
    try {
      // Check if locationId is undefined or null
      if (!locationId) {
        console.error('Error: locationId is undefined or null');
        Alert.alert('Error', 'Invalid location. Please select a location and try again.');
        setLoading(false);
        return;
      }
      
      // Handle custom place IDs (they have 'custom_' prefix)
      const cleanLocationId = typeof locationId === 'string' && locationId.startsWith('custom_') ? 
        locationId.replace('custom_', '') : locationId;
  
      console.log('Loading confessions for location:', { originalId: locationId, cleanId: cleanLocationId });
  
      // First get confessions - disable caching to ensure we get the latest data
      let query = supabase
        .from('confessions')
        .select(`
          id,
          user_id,
          creator_id,
          location_id,
          location_name,
          content,
          media,
          is_anonymous,
          likes_count,
          comments_count,
          created_at,
          username
        `)
        .order('created_at', { ascending: false })
        .limit(50); // Limit to latest 50 confessions

      // Handle both original and clean location IDs
      query = query.or(`location_id.eq.${locationId},location_id.eq.${cleanLocationId}`);
      
      const { data: confessionsData, error: confessionsError } = await query;
  
      if (confessionsError) {
        console.error('Error fetching confessions:', confessionsError);
        throw confessionsError;
      }
  
      console.log('Raw confessions data:', confessionsData); // Debug log for raw data
  
      if (!confessionsData || confessionsData.length === 0) {
        console.log('No confessions found for location:', cleanLocationId);
        setConfessions([]);
        return;
      }
  
      // Process confessions data to ensure media is properly parsed
      const processedConfessions = await Promise.all(confessionsData.map(async confession => {
        // Ensure media is properly parsed if it's a string
        let processedMedia = confession.media;
  
        // If media is a string, try to parse it as JSON
        if (typeof confession.media === 'string') {
          try {
            processedMedia = JSON.parse(confession.media);
          } catch (e) {
            console.error('Error parsing media JSON:', e);
            processedMedia = []; // Default to empty array if parsing fails
          }
        }
  
        // If media is null or undefined, set it to an empty array
        if (!processedMedia) {
          processedMedia = [];
        }
  
        // Ensure each media item has the expected structure
        const validatedMedia = Array.isArray(processedMedia) ?
          processedMedia.map(item => {
            // If the item is already in the correct format, return it
            if (item && typeof item === 'object' && item.url) {
              return item;
            }
            // If it's just a string URL, convert it to the expected format
            if (typeof item === 'string') {
              return { url: item, type: 'image' };
            }
            // Skip invalid items
            return null;
          }).filter(Boolean) : [];
  
        // For non-anonymous confessions, fetch user profile
        let userProfile = null;
        if (!confession.is_anonymous && confession.user_id) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('username, full_name, avatar_url')
            .eq('id', confession.user_id)
            .single();
  
          if (profileData) {
            userProfile = {
              username: profileData.username || profileData.full_name,
              avatar_url: profileData.avatar_url
            };
          }
        }
  
        return {
          ...confession,
          media: validatedMedia,
          ...(userProfile && { username: userProfile.username, avatar_url: userProfile.avatar_url })
        };
      }));
  
      console.log('Processed confessions:', processedConfessions.length);
      setConfessions(processedConfessions);
    } catch (error) {
      console.error('Error loading confessions:', error);
      Alert.alert('Error', 'Failed to load confessions. Please try again.');
      setConfessions([]); // Reset confessions on error
    } finally {
      setLoading(false);
    }
  };
  
  // Update pickImage function to use Images only (not video)  
  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 1,
      });

    if (!result.canceled) {
      const asset = result.assets[0];
      
      setMedia([...media, { 
        uri: asset.uri,
        type: 'image/jpeg',
        name: `${Math.random().toString(36).substring(2)}.jpg`
      }]);
    }
  } catch (error) {
    console.error('Error picking image:', error);
    alert('Failed to select image. Please try again.');
  }
};
  
  // Updated postConfession function with improved media upload handling
  const postConfession = async () => {
  if (!newConfession.trim() && media.length === 0) return;
  
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert('You must be logged in to post a confession');
      return;
    }
    
    const mediaUrls = [];
    for (const item of media) {
      if (item.uri) {
        try {
          const filePath = `confessions/${item.name}`;
          
          // Handle file reading based on platform
          if (Platform.OS === 'web') {
            // For web platform
            const response = await fetch(item.uri);
            const blob = await response.blob();
            
            const { error: uploadError } = await supabase.storage
              .from('media')
              .upload(filePath, blob, {
                contentType: item.type,
                cacheControl: '3600',
                upsert: true
              });
              
            if (uploadError) throw uploadError;
          } else {
            // For native platforms (iOS/Android)
            // First check if the file exists
            const fileInfo = await FileSystem.getInfoAsync(item.uri);
            if (!fileInfo.exists) {
              throw new Error('File does not exist');
            }
            
            // For iOS/Android, we need to read the file and convert it to a blob
            const base64 = await FileSystem.readAsStringAsync(item.uri, {
              encoding: FileSystem.EncodingType.Base64,
            });
            
            // Upload using the base64 data
            const { error: uploadError } = await supabase.storage
              .from('media')
              .upload(filePath, decode(base64), {
                contentType: item.type,
                cacheControl: '3600',
                upsert: true
              });
              
            if (uploadError) throw uploadError;
          }
          
          // Get the public URL
          const { data } = supabase.storage
            .from('media')
            .getPublicUrl(filePath);
            
          mediaUrls.push({
            url: data.publicUrl,
            type: 'image'
          });
        } catch (mediaError) {
          console.error('Media upload error:', mediaError);
          throw new Error('Failed to upload media: ' + (mediaError.message || 'Unknown error'));
        }
      }
    }
    
    // Ensure media is properly formatted as a JSON string to avoid parsing issues
    const confessionData = {
      user_id: remainAnonymous ? null : user.id,
      // Store the creator's ID in a separate field for anonymous posts
      creator_id: user.id, // Always store the actual creator ID regardless of anonymity
      location_id: selectedLocation.place_id,
      location_name: selectedLocation.display_name,
      content: newConfession.trim(),
      media: mediaUrls, // This is already an array of objects with url and type
      is_anonymous: remainAnonymous,
      created_at: new Date().toISOString()
    };
    
    console.log('Saving confession with media:', mediaUrls);

    const { error: confessionError } = await supabase
      .from('confessions')
      .insert([confessionData]);
      
    if (confessionError) throw confessionError;
    
    setNewConfession('');
    setMedia([]);
    setShowNewConfessionModal(false);
    loadConfessions(selectedLocation.place_id);
    
  } catch (error) {
    console.error('Error posting confession:', error);
    alert(error.message || 'Failed to post confession. Please try again.');
  }
};

  const goToUserLocation = () => {
    if (userLocation) {
      setMapRegion({
        latitude: userLocation.coords.latitude,
        longitude: userLocation.coords.longitude,
      });
    }
  };

  const deleteConfession = async (confessionId) => {
    try {
      const { error } = await supabase
        .from('confessions')
        .delete()
        .eq('id', confessionId);

      if (error) throw error;
      refreshConfessions();
    } catch (error) {
      console.error('Error deleting confession:', error);
      alert('Failed to delete confession. Please try again.');
    }
  };

  // Move currentUser state to component level
  const [currentUser, setCurrentUser] = useState(null);
    
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
    };
    getCurrentUser();
  }, []);

  const renderConfessionItem = ({ item }) => {
    // Check if current user is the creator of the confession, even if it's anonymous
    const isCurrentUserConfession = currentUser && (
      (item.user_id === currentUser.id) || // For non-anonymous posts
      (item.is_anonymous && item.creator_id === currentUser.id) // For anonymous posts
    );
    const formattedDate = item.created_at 
      ? new Date(item.created_at).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        }) + ' at ' + new Date(item.created_at).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit'
        })
      : '';
    
    return (
      <View style={styles.confessionCard}>
        <View style={styles.confessionHeader}>
          <Image 
            source={{ uri: item.is_anonymous 
              ? 'https://via.placeholder.com/40' 
              : (item.avatar_url || 'https://via.placeholder.com/40') 
            }}
            style={styles.avatar}
          />
          <View style={styles.userInfoContainer}>
            <TouchableOpacity 
              onPress={() => {
                if (!item.is_anonymous && item.user_id) {
                  navigation.navigate('UserProfileScreen', { userId: item.user_id });
                }
              }}
            >
              <Text style={[styles.username, { color: '#ff00ff' }]}>
                {item.is_anonymous ? 'Anonymous' : (item.username || 'User')}
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.dateText}>{formattedDate}</Text>
          {isCurrentUserConfession && (
            <TouchableOpacity
              style={styles.menuButton}
              onPress={() => {
                Alert.alert(
                  'Confession Options',
                  'What would you like to do?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { 
                      text: 'Delete', 
                      onPress: () => {
                        Alert.alert(
                          'Delete Confession',
                          'Are you sure you want to delete this confession?',
                          [
                            { text: 'Cancel', style: 'cancel' },
                            { 
                              text: 'Delete', 
                              onPress: () => deleteConfession(item.id),
                              style: 'destructive' 
                            }
                          ]
                        );
                      },
                      style: 'destructive'
                    }
                  ]
                );
              }}
            >
              <Ionicons name="ellipsis-vertical" size={20} color="#ff00ff" />
            </TouchableOpacity>
          )}
        </View>
        
        <Text style={styles.confessionContent}>{item.content}</Text>
        
        {item.media && item.media.length > 0 && (
          <ScrollView horizontal style={styles.mediaContainer}>
            {item.media.map((mediaItem, index) => (
              <Image 
                key={index}
                source={{ uri: mediaItem.url }}
                style={styles.mediaItem}
              />
            ))}          
          </ScrollView>
        )}
        
        <View style={styles.actionBar}>
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="heart-outline" size={24} color="#ff00ff" />
            <Text style={styles.actionText}>{item.likes_count || 0}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="chatbubble-outline" size={22} color="#ff00ff" />
            <Text style={styles.actionText}>{item.comments_count || 0}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="share-social-outline" size={24} color="#ff00ff" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Add mode selection component
  const renderModeSelection = () => (
    <View style={styles.modeContainer}>
      <TouchableOpacity 
        style={[styles.modeButton, mode === 'write' && styles.modeButtonActive]}
        onPress={() => setMode('write')}
      >
        <Ionicons name="create" size={24} color={mode === 'write' ? '#fff' : '#ff00ff'} />
        <Text style={[styles.modeButtonText, mode === 'write' && styles.modeButtonTextActive]}>Write Confession</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={[styles.modeButton, mode === 'view' && styles.modeButtonActive]}
        onPress={() => setMode('view')}
      >
        <Ionicons name="eye" size={24} color={mode === 'view' ? '#fff' : '#ff00ff'} />
        <Text style={[styles.modeButtonText, mode === 'view' && styles.modeButtonTextActive]}>View Confessions</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#ff00ff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Confessions</Text>
      </View>

      {(
        <>
         

         <View style={styles.searchContainer}>
         

         
            <TextInput
              style={styles.searchInput}
              placeholder="Search for a place, institution, company..."
              placeholderTextColor="#999"
              value={searchQuery}
              onChangeText={(text) => {
                setSearchQuery(text);
                
                // Clear any existing timeout
                if (searchTimeout) {
                  clearTimeout(searchTimeout);
                }
                
                // Clear results if text is too short
                if (text.length < 3) {
                  setSearchResults([]);
                  return;
                }
                
                // Set a new timeout to delay the search
                const timeout = setTimeout(() => {
                  searchLocations(text);
                }, 500); // 500ms debounce delay
                
                setSearchTimeout(timeout);
              }}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color="#999" />
              </TouchableOpacity>
            )}
          </View>



          
          {searchResults.length > 0 ? (
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.place_id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={styles.searchResultItem}
                  onPress={() => selectLocation(item)}
                >
                  <Ionicons name="location" size={20} color="#ff00ff" />
                  <Text style={styles.searchResultText}>{item.display_name}</Text>
                </TouchableOpacity>
              )}
              style={styles.searchResultsList}
            />
          ) : (
            searchQuery.length >= 3 && !loading && (
              <View style={styles.noResultsContainer}>
                <Text style={styles.noResultsText}>No locations found</Text>
                <TouchableOpacity 
                  style={styles.addPlaceButton}
                  onPress={() => {
                    // Only show add place modal when user explicitly clicks this button
                    setShowAddPlaceModal(true);
                  }}
                >
                  <Text style={styles.addPlaceButtonText}>Add New Place</Text>
                </TouchableOpacity>
              </View>
            )
          )}
          {searchError && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>
                {searchError.includes('Network request failed') 
                  ? 'Network error. Check your connection.' 
                  : 'Error searching locations. Try again.'}
              </Text>
            </View>
          )}
          
          {showMap && (
            <View style={styles.mapContainer}>
              <WebView
                style={styles.map}
                source={{ uri: getMapUrl() }}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                onError={(e) => console.error('WebView error:', e.nativeEvent)}
                renderLoading={() => (
                  <View style={[styles.loadingContainer, StyleSheet.absoluteFill]}>
                    <ActivityIndicator size="large" color="#ff00ff" />
                  </View>
                )}
                startInLoadingState={true}
              />
              <View style={styles.mapControls}>
                <TouchableOpacity 
                  style={styles.closeMapButton}
                  onPress={() => setShowMap(false)}
                >
                  <Ionicons name="close-circle" size={30} color="#ff00ff" />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.locationButton}
                  onPress={goToUserLocation}
                >
                  <Ionicons name="locate" size={24} color="#ff00ff" />
                </TouchableOpacity>
              </View>
            </View>
          )}
          
          {selectedLocation && (
            <View style={styles.locationHeader}>
              <Text style={styles.locationName}>{selectedLocation.display_name}</Text>
            </View>
          )}
          
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#ff00ff" />
            </View>
          ) : selectedLocation ? (
            confessions.length > 0 ? (
              <FlatList
                data={confessions}
                keyExtractor={(item) => item.id.toString()}
                renderItem={renderConfessionItem}
                contentContainerStyle={styles.confessionsList}
                refreshing={loading}
                onRefresh={refreshConfessions}
              />
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="chatbubbles-outline" size={60} color="#ff00ff" />
                <Text style={styles.emptyText}>No confessions yet. Be the first to share!</Text>
              </View>
            )
          ) : (
            <View style={styles.instructionContainer}>
              <Ionicons name="search" size={60} color="#ff00ff" />
              <Text style={styles.instructionText}>
                Search for a place or select a location on the map to see confessions
              </Text>
            </View>
          )}
          
          {selectedLocation && (
            <>
              <TouchableOpacity 
                style={styles.addButton}
                onPress={() => setShowNewConfessionModal(true)}
              >
                <Ionicons name="add" size={30} color="#fff" />
              </TouchableOpacity>
              
              

              
            </>
          )}
          
          <Modal
            visible={showAddPlaceModal}
            animationType="slide"
            transparent={true}
            onRequestClose={() => setShowAddPlaceModal(false)}
          >
            <View style={styles.modalContainer}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Add Place</Text>
                
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Type</Text>
                  <View style={styles.typeSelector}>
                    {['institute', 'office', 'place', 'building'].map((type) => (
                      <TouchableOpacity
                        key={type}
                        style={[styles.typeButton, newPlace.type === type && styles.selectedType]}
                        onPress={() => setNewPlace(prev => ({ ...prev, type }))}
                      >
                        <Text style={[styles.typeText, newPlace.type === type && styles.selectedTypeText]}>
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Name</Text>
                  <TextInput
                    style={styles.input}
                    value={newPlace.name}
                    onChangeText={(text) => setNewPlace(prev => ({ ...prev, name: text }))}
                    placeholder="Enter place name"
                    placeholderTextColor="#666"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>City</Text>
                  <TextInput
                    style={styles.input}
                    value={newPlace.city}
                    onChangeText={(text) => setNewPlace(prev => ({ ...prev, city: text }))}
                    placeholder="Enter city"
                    placeholderTextColor="#666"
                  />
                </View>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>District</Text>
                  <TextInput
                    style={styles.input}
                    value={newPlace.district}
                    onChangeText={(text) => setNewPlace(prev => ({ ...prev, district: text }))}
                    placeholder="Enter district"
                    placeholderTextColor="#666"
                  />
                </View>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>State</Text>
                  <TextInput
                    style={styles.input}
                    value={newPlace.state}
                    onChangeText={(text) => setNewPlace(prev => ({ ...prev, state: text }))}
                    placeholder="Enter state"
                    placeholderTextColor="#666"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Country</Text>
                  <TextInput
                    style={styles.input}
                    value={newPlace.country}
                    onChangeText={(text) => setNewPlace(prev => ({ ...prev, country: text }))}
                    placeholder="Enter country"
                    placeholderTextColor="#666"
                  />
                </View>

                <View style={styles.modalButtons}>
                  <TouchableOpacity 
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={() => setShowAddPlaceModal(false)}
                  >
                    <Text style={styles.buttonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.modalButton, styles.addButton]}
                    onPress={handleAddPlace}
                  >
                    <Text style={styles.buttonText}>Add Place</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          <Modal
            visible={showNewConfessionModal}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setShowNewConfessionModal(false)}
          >
            <View style={styles.modalContainer}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>New Confession</Text>
                  <TouchableOpacity onPress={() => setShowNewConfessionModal(false)}>
                    <Ionicons name="close" size={24} color="#ff00ff" />
                  </TouchableOpacity>
                </View>
                
                <TextInput
                  style={styles.confessionInput}
                  placeholder="What's your confession about this place?"
                  placeholderTextColor="#999"
                  multiline
                  value={newConfession}
                  onChangeText={setNewConfession}
                />
                
                {media.length > 0 && (
                  <ScrollView horizontal style={styles.selectedMediaContainer}>
                    {media.map((item, index) => (
                      <View key={index} style={styles.selectedMediaItem}>
                        <Image source={{ uri: item.uri }} style={styles.selectedMediaPreview} />
                        <TouchableOpacity 
                          style={styles.removeMediaButton}
                          onPress={() => setMedia(media.filter((_, i) => i !== index))}
                        >
                          <Ionicons name="close-circle" size={20} color="#ff00ff" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </ScrollView>
                )}
                
                <View style={styles.mediaButtons}>
                  <TouchableOpacity style={styles.mediaButton} onPress={pickImage}>
                    <Ionicons name="image" size={24} color="#ff00ff" />
                    <Text style={styles.mediaButtonText}>Add Image</Text>
                  </TouchableOpacity>
                </View>
                
                <View style={styles.anonymousOption}>
                  <Text style={styles.anonymousText}>Remain anonymous</Text>
                  <Switch
                    value={remainAnonymous}
                    onValueChange={setRemainAnonymous}
                    trackColor={{ false: "#767577", true: "#ff00ff" }}
                    thumbColor={remainAnonymous ? "#f4f3f4" : "#f4f3f4"}
                  />
                </View>
                
                <TouchableOpacity 
                  style={styles.postButton}
                  onPress={postConfession}
                >
                  <Text style={styles.postButtonText}>Post Confession</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 15,
    padding: 20,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  formGroup: {
    marginBottom: 15,
  },
  label: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 5,
  },
  input: {
    backgroundColor: '#333',
    borderRadius: 8,
    color: '#fff',
    fontSize: 16,
    padding: 12,
  },
  typeSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 10,
  },
  typeButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#333',
    borderWidth: 1,
    borderColor: '#666',
  },
  selectedType: {
    backgroundColor: '#ff00ff',
    borderColor: '#ff00ff',
  },
  typeText: {
    color: '#fff',
    fontSize: 14,
  },
  selectedTypeText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#333',
  },
  addButton: {
    backgroundColor: '#ff00ff',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  menuButton: {
    padding: 8,
    borderRadius: 15,
  },
  modeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 20,
    backgroundColor: '#550033',
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#330022',
    padding: 15,
    borderRadius: 10,
    marginHorizontal: 10,
  },
  modeButtonActive: {
    backgroundColor: '#ff00ff',
  },
  modeButtonText: {
    color: '#ff00ff',
    marginLeft: 10,
    fontSize: 16,
    fontWeight: 'bold',
  },
  modeButtonTextActive: {
    color: '#fff',
  },
  addPlaceButton: {
    backgroundColor: '#ff00ff',
    padding: 10,
    borderRadius: 5,
    marginBottom: 10,
    alignItems: 'center',
  },
  addPlaceButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  container: {
    flex: 1,
    backgroundColor: '#000033',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 15,
    paddingBottom: 15,
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    color: '#ff00ff',
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 15,
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: '#550033',
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#330022',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    color: '#fff',
    marginRight: 10,
  },
  mapButton: {
    backgroundColor: '#330022',
    borderRadius: 20,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addPlaceButton: {
    backgroundColor: '#330022',
    borderRadius: 20,
    width: 44,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchResultsList: {
    backgroundColor: '#330022',
    maxHeight: 200,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#550033',
  },
  searchResultText: {
    color: '#fff',
    marginLeft: 10,
    flex: 1,
  },
  mapContainer: {
    height: 300,
    position: 'relative',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  mapControls: {
    position: 'absolute',
    top: 10,
    right: 10,
    gap: 10,
  },
  closeMapButton: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 5,
  },
  locationButton: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 8,
  },
  locationHeader: {
    padding: 15,
    backgroundColor: '#550033',
  },
  locationName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confessionsList: {
    padding: 10,
  },
  confessionCard: {
    backgroundColor: '#330022',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
  },
  confessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  deleteButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#FFF0F0',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  username: {
    color: '#fff',
    fontWeight: 'bold',
  },
  dateText: {
    color: '#FFFF00',
    fontSize: 12,
    marginLeft: 'auto',
  },
  confessionContent: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 10,
  },
  mediaContainer: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  mediaItem: {
    width: 150,
    height: 150,
    borderRadius: 10,
    marginRight: 10,
  },
  videoContainer: {
    width: 150,
    height: 150,
    borderRadius: 10,
    marginRight: 10,
    backgroundColor: '#220011',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#550033',
    paddingTop: 10,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
  },
  actionText: {
    color: '#ff00ff',
    marginLeft: 5,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    color: '#ff00ff',
    textAlign: 'center',
    marginTop: 10,
    fontSize: 16,
  },
  instructionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  instructionText: {
    color: '#ff00ff',
    textAlign: 'center',
    marginTop: 10,
    fontSize: 16,
  },
  addButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#ff00ff',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  refreshButton: {
    bottom: 90, // Position above the add button
    backgroundColor: '#3399ff',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#330022',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    minHeight: '50%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    color: '#ff00ff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  confessionInput: {
    backgroundColor: '#220011',
    borderRadius: 10,
    padding: 15,
    color: '#fff',
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 15,
  },
  selectedMediaContainer: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  selectedMediaItem: {
    position: 'relative',
    marginRight: 10,
  },
  selectedMediaPreview: {
    width: 80,
    height: 80,
    borderRadius: 5,
  },
  removeMediaButton: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#330022',
    borderRadius: 10,
  },
  mediaButtons: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  mediaButton: {
    backgroundColor: '#220011',
    borderRadius: 10,
    padding: 10,
    marginRight: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  mediaButtonText: {
    color: '#ff00ff',
    marginLeft: 8,
    fontSize: 14,
  },
  anonymousOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  anonymousText: {
    color: '#fff',
    fontSize: 16,
  },
  postButton: {
    backgroundColor: '#ff00ff',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
  },
  postButtonText: {
    color: '#550033',
    fontWeight: 'bold',
    fontSize: 16,
  },
  errorContainer: {
    padding: 15,
    backgroundColor: '#550033',
  },
  errorText: {
    color: '#ff0000',
    textAlign: 'center',
  },
});

export default ConfessionScreen;