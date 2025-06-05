import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  Image, 
  TouchableOpacity, 
  Dimensions, 
  StatusBar,
  Alert,
  ActivityIndicator,
  Modal,
  Platform
} from 'react-native';
import { Video } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { StoriesService } from '../services/StoriesService';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../config/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');

const StoriesScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { storyGroupId, userId, initialStoryIndex = 0 } = route.params || {};
  const insets = useSafeAreaInsets();
  
  const [stories, setStories] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(initialStoryIndex);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  
  const videoRef = useRef(null);
  const progressInterval = useRef(null);
  const storyTimeout = useRef(null);
  
  // Load stories when component mounts
  useEffect(() => {
    loadStories();
    
    // Cleanup on unmount
    return () => {
      clearInterval(progressInterval.current);
      clearTimeout(storyTimeout.current);
    };
  }, []);
  
  // Handle story progress and auto-advance
  useEffect(() => {
    if (stories.length > 0 && !loading) {
      // Mark story as viewed
      markStoryAsViewed();
      
      // Reset progress
      setProgress(0);
      
      // Clear previous intervals/timeouts
      clearInterval(progressInterval.current);
      clearTimeout(storyTimeout.current);
      
      // Start progress for current story
      startProgress();
    }
  }, [currentIndex, stories, loading]);
  
  const loadStories = async () => {
    try {
      setLoading(true);
      
      // Get stories for the specific user/group
      const data = await StoriesService.getUserStories(userId);
      
      if (data && data.length > 0) {
        setStories(data);
        setUserInfo(data[0].user);
      } else {
        // No stories found, go back
        navigation.goBack();
      }
    } catch (error) {
      console.error('Error loading stories:', error);
      Alert.alert('Error', 'Failed to load stories');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };
  
  const markStoryAsViewed = async () => {
    if (stories.length > 0 && currentIndex < stories.length) {
      try {
        await StoriesService.markStoryAsViewed(stories[currentIndex].id);
      } catch (error) {
        console.error('Error marking story as viewed:', error);
      }
    }
  };
  
  const startProgress = () => {
    // Duration for each story (5 seconds)
    const storyDuration = 5000;
    const updateInterval = 50; // Update progress every 50ms
    const incrementValue = updateInterval / storyDuration;
    
    // Start progress interval
    progressInterval.current = setInterval(() => {
      if (!paused) {
        setProgress(prev => {
          const newProgress = prev + incrementValue;
          return newProgress >= 1 ? 1 : newProgress;
        });
      }
    }, updateInterval);
    
    // Set timeout to move to next story
    storyTimeout.current = setTimeout(() => {
      if (!paused) {
        goToNextStory();
      }
    }, storyDuration);
  };
  
  const goToPreviousStory = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    } else {
      // If at first story, go back to previous user's stories or exit
      navigation.goBack();
    }
  };
  
  const goToNextStory = () => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      // If at last story, go back to home
      navigation.goBack();
    }
  };
  
  const handlePress = (event) => {
    const { locationX } = event.nativeEvent;
    
    // Determine if press is on left or right side of screen
    if (locationX < width / 3) {
      // Left side - go to previous story
      goToPreviousStory();
    } else if (locationX > (width * 2) / 3) {
      // Right side - go to next story
      goToNextStory();
    } else {
      // Middle - pause/play
      setPaused(!paused);
      
      if (videoRef.current) {
        if (paused) {
          videoRef.current.playAsync();
        } else {
          videoRef.current.pauseAsync();
        }
      }
    }
  };
  
  const handleDeleteStory = async () => {
    try {
      setMenuVisible(false);
      setPaused(true);
      
      // Show confirmation dialog
      Alert.alert(
        'Delete Story',
        'Are you sure you want to delete this story?',
        [
          {
            text: 'Cancel',
            onPress: () => setPaused(false),
            style: 'cancel',
          },
          {
            text: 'Delete',
            onPress: async () => {
              try {
                await StoriesService.deleteStory(stories[currentIndex].id);
                
                // If this was the only story, go back
                if (stories.length === 1) {
                  navigation.goBack();
                } else {
                  // Remove the deleted story from the array
                  const updatedStories = [...stories];
                  updatedStories.splice(currentIndex, 1);
                  
                  // Update stories array
                  setStories(updatedStories);
                  
                  // Adjust current index if needed
                  if (currentIndex >= updatedStories.length) {
                    setCurrentIndex(updatedStories.length - 1);
                  }
                }
              } catch (error) {
                console.error('Error deleting story:', error);
                Alert.alert('Error', 'Failed to delete story');
                setPaused(false);
              }
            },
            style: 'destructive',
          },
        ],
        { cancelable: false }
      );
    } catch (error) {
      console.error('Error handling delete:', error);
      setPaused(false);
    }
  };
  
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff00ff" />
      </View>
    );
  }
  
  if (stories.length === 0) {
    return null; // This should not happen as we navigate back if no stories
  }
  
  const currentStory = stories[currentIndex];
  
  return (
    <View style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      
      {/* Story Content */}
      <TouchableOpacity 
        activeOpacity={1} 
        style={styles.storyContainer}
        onPress={handlePress}
      >
        {/* Progress Bar */}
        <View style={[styles.progressContainer, { paddingTop: insets.top }]}>
          {stories.map((_, index) => (
            <View key={index} style={styles.progressBarBackground}>
              <View 
                style={[styles.progressBar, { 
                  width: index === currentIndex ? `${progress * 100}%` : index < currentIndex ? '100%' : '0%' 
                }]}
              />
            </View>
          ))}
        </View>
        
        {/* User Info */}
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <View style={styles.userInfo}>
            <Image 
              source={{ uri: userInfo?.avatar_url || 'https://via.placeholder.com/40' }} 
              style={styles.avatar} 
            />
            <Text style={styles.username}>{userInfo?.username}</Text>
            <Text style={styles.timestamp}>
              {new Date(currentStory?.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
          
          {/* Menu Button (only show for user's own stories) */}
          {currentStory.user_id === userId && (
            <TouchableOpacity 
              style={styles.menuButton}
              onPress={() => {
                setPaused(true);
                setMenuVisible(true);
              }}
            >
              <Ionicons name="ellipsis-vertical" size={24} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
        
        {/* Story Media */}
        <View style={styles.mediaContainer}>
          {currentStory.type === 'video' ? (
            <Video
              ref={videoRef}
              source={{ uri: currentStory.media_url }}
              style={styles.media}
              resizeMode="contain"
              shouldPlay={!paused}
              isLooping={false}
              onPlaybackStatusUpdate={(status) => {
                if (status.didJustFinish) {
                  goToNextStory();
                }
              }}
            />
          ) : (
            <Image
              source={{ uri: currentStory.media_url }}
              style={styles.media}
              resizeMode="contain"
            />
          )}
        </View>
      </TouchableOpacity>
      
      {/* Menu Modal */}
      <Modal
        visible={menuVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setMenuVisible(false);
          setPaused(false);
        }}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => {
            setMenuVisible(false);
            setPaused(false);
          }}
        >
          <View style={[styles.menuContainer, { paddingBottom: insets.bottom > 0 ? insets.bottom : 20 }]}>
            <TouchableOpacity style={styles.menuItem} onPress={handleDeleteStory}>
              <Ionicons name="trash-outline" size={24} color="#ff3b30" />
              <Text style={[styles.menuItemText, { color: '#ff3b30' }]}>Delete Story</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingTop: Platform.OS === 'ios' ? 50 : 40, // Extra padding for iOS notch
    paddingBottom: 10,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 10,
  },
  username: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  menuButton: {
    padding: 5,
  },
  progressContainer: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingTop: 10,
    gap: 5,
  },
  progressBar: {
    flex: 1,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 1,
    overflow: 'hidden',
  },
  progress: {
    height: '100%',
    borderRadius: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  media: {
    width: '100%',
    height: '100%',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  menuContainer: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    padding: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
  },
  menuText: {
    fontSize: 16,
    marginLeft: 15,
    color: '#fff',
  },
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  storyContainer: {
    flex: 1,
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingTop: 50, // Extra padding to avoid notch
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  progressBarBackground: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginHorizontal: 2,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60, // Extra padding to avoid notch
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 5,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  username: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
    marginRight: 8,
  },
  timestamp: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
  },
  menuButton: {
    padding: 8,
  },
  mediaContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  media: {
    width: '100%',
    height: '100%',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  menuContainer: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    paddingVertical: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  menuItemText: {
    fontSize: 16,
    marginLeft: 12,
    color: '#fff',
  },
});

export default StoriesScreen;