import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, ActivityIndicator, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../config/supabase';
import ProfileViewBlinker from '../components/ProfileViewBlinker';

const UserProfileScreen = () => {
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showFullBio, setShowFullBio] = useState(false);
  const [viewerGender, setViewerGender] = useState(null);
  const blinkAnimation = useRef(new Animated.Value(0)).current;

  // Function to create blinking animation
  const createBlinkAnimation = (color) => {
    Animated.sequence([
      Animated.timing(blinkAnimation, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: false,
      }),
      Animated.timing(blinkAnimation, {
        toValue: 0,
        duration: 1000,
        useNativeDriver: false,
      }),
    ]).start(() => {
      // Repeat two more times for a total of 3 blinks
      Animated.sequence([
        Animated.timing(blinkAnimation, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: false,
        }),
        Animated.timing(blinkAnimation, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: false,
        }),
        Animated.timing(blinkAnimation, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: false,
        }),
        Animated.timing(blinkAnimation, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: false,
        }),
      ]).start();
    });
  };
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const navigation = useNavigation();
  const route = useRoute();
  const { userId } = route.params;

  useEffect(() => {
    loadUserProfile();
    loadViewerGender();
    checkFollowStatus();
    fetchFollowersCount();
    fetchFollowingCount();
    
    // Set up realtime subscription for follows
    const followsSubscription = supabase
      .channel('public:follows')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'follows', filter: `following_id=eq.${userId}` }, 
        (payload) => {
          // When a follow/unfollow happens, refresh the follow status
          checkFollowStatus();
          fetchFollowersCount();
          fetchFollowingCount();
      })
      .subscribe();
      
    // Clean up subscription when component unmounts
    return () => {
      supabase.removeChannel(followsSubscription);
    };
  }, [userId]);

  const loadViewerGender = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await supabase
          .from('profiles')
          .select('gender')
          .eq('id', user.id)
          .single();

        if (data) {
          setViewerGender(data.gender);
        }
      }
    } catch (error) {
      console.error('Error loading viewer gender:', error);
    }
  };

  const loadUserProfile = async () => {
    try {
      setLoading(true);
      
      // Get current user for recording visit
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      // Record profile visit if viewing someone else's profile
      if (currentUser && currentUser.id !== userId) {
        const { error: visitError } = await supabase
          .from('profile_visits')
          .insert({
            profile_id: userId,
            visitor_id: currentUser.id
          });
        
        if (visitError) {
          console.error('Error recording profile visit:', visitError);
        }
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
  
      if (error) {
        console.error('Error loading user profile:', error);
        setUserProfile(null);
      } else {
        console.log('Raw profile data:', data); // Debug log for raw data
        
        // Fix for nested URLs in avatar_url and cover_url
        let avatarUrl = null;
        let coverUrl = null;
        
        if (data.avatar_url) {
          console.log('Avatar loading started');
          // Handle double-nested URLs by extracting just the file path
          let avatarPath = data.avatar_url;
          
          // Check if URL is nested (contains the URL twice)
          if (avatarPath.includes('media/media/')) {
            // Extract just the file path after the last 'media/'
            const parts = avatarPath.split('media/');
            avatarPath = parts[parts.length - 1];
          } else if (avatarPath.includes('media/')) {
            // For single nested URLs
            avatarPath = avatarPath.split('media/').pop();
          }
          
          // Get the public URL directly
          avatarUrl = `https://lckhaysswueoyinhfzyz.supabase.co/storage/v1/object/public/media/${avatarPath}`;
          console.log('Fixed Avatar URL:', avatarUrl);
        }
        
        if (data.cover_url) {
          console.log('Cover photo loading started');
          // Handle double-nested URLs by extracting just the file path
          let coverPath = data.cover_url;
          
          // Check if URL is nested (contains the URL twice)
          if (coverPath.includes('media/media/')) {
            // Extract just the file path after the last 'media/'
            const parts = coverPath.split('media/');
            coverPath = parts[parts.length - 1];
          } else if (coverPath.includes('media/')) {
            // For single nested URLs
            coverPath = coverPath.split('media/').pop();
          }
          
          // Get the public URL directly
          coverUrl = `https://lckhaysswueoyinhfzyz.supabase.co/storage/v1/object/public/media/${coverPath}`;
          console.log('Fixed Cover URL:', coverUrl);
        }

        const profile = {
          ...data,
          avatar_url: avatarUrl,
          cover_url: coverUrl
        };
        
        setUserProfile(profile);

        // Trigger blinking animation based on gender
        if (viewerGender && profile.gender) {
          let blinkColor;
          if (profile.gender === 'third') {
            blinkColor = '#00FF00'; // Green for third gender
          } else if (viewerGender === 'male' && profile.gender === 'female') {
            blinkColor = '#FF69B4'; // Pink when male views female
          } else if (viewerGender === 'female' && profile.gender === 'male') {
            blinkColor = '#ADD8E6'; // Light blue when female views male
          }
          
          if (blinkColor) {
            createBlinkAnimation(blinkColor);
          }
        }
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
      setUserProfile(null);
    } finally {
      setLoading(false);
    }
  };

  // Add the missing functions
  const renderBio = () => {
    if (!userProfile?.bio) return null;
    
    const shouldTruncate = userProfile.bio.length > 50 && !showFullBio;
    const displayBio = shouldTruncate 
      ? userProfile.bio.substring(0, 50) + '...' 
      : userProfile.bio;

    return (
      <View style={styles.container}>
        <View style={styles.bioContainer}>
          <Text style={styles.bioText}>
            {displayBio}
            {shouldTruncate && (
              <Text 
                style={styles.moreText}
                onPress={() => setShowFullBio(true)}
              > more</Text>
            )}
          </Text>
        </View>
      </View>
    );
  };

  // Implement these functions properly
    const checkFollowStatus = async () => {
      try {
        const { data: session } = await supabase.auth.getSession();
        if (!session?.session?.user) return;
        
        const currentUserId = session.session.user.id;
        
        // Don't check follow status if viewing own profile
        if (currentUserId === userId) {
          setIsFollowing(false);
          return;
        }
        
        const { data, error } = await supabase
          .from('follows')
          .select('*')
          .eq('follower_id', currentUserId)
          .eq('following_id', userId)
          .single();
          
        if (error && error.code !== 'PGRST116') {
          console.error('Error checking follow status:', error);
        }
        
        setIsFollowing(!!data);
      } catch (error) {
        console.error('Error checking follow status:', error);
      }
    };
  
    const fetchFollowersCount = async () => {
      try {
        const { count, error } = await supabase
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('following_id', userId);
          
        if (error) {
          console.error('Error fetching followers count:', error);
        } else {
          setFollowersCount(count || 0);
        }
      } catch (error) {
        console.error('Error fetching followers count:', error);
      }
    };
  
    const fetchFollowingCount = async () => {
      try {
        const { count, error } = await supabase
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('follower_id', userId);
          
        if (error) {
          console.error('Error fetching following count:', error);
        } else {
          setFollowingCount(count || 0);
        }
      } catch (error) {
        console.error('Error fetching following count:', error);
      }
    };
  
    // Fix the handleFollow function to remove the created_at field
    const handleFollow = async () => {
      try {
        const { data: session } = await supabase.auth.getSession();
        if (!session?.session?.user) {
          // Redirect to login if not logged in
          navigation.navigate('Login');
          return;
        }
        
        const currentUserId = session.session.user.id;
        
        // Don't allow following yourself
        if (currentUserId === userId) return;
        
        if (isFollowing) {
          // Unfollow
          const { error } = await supabase
            .from('follows')
            .delete()
            .eq('follower_id', currentUserId)
            .eq('following_id', userId);
            
          if (error) {
            console.error('Error unfollowing user:', error);
          } else {
            setIsFollowing(false);
            setFollowersCount(prev => Math.max(0, prev - 1));
          }
        } else {
          // Follow - remove created_at field since it doesn't exist in the table
          const { error } = await supabase
            .from('follows')
            .insert({
              follower_id: currentUserId,
              following_id: userId
            });
            
          if (error) {
            console.error('Error following user:', error);
          } else {
            setIsFollowing(true);
            setFollowersCount(prev => prev + 1);
          }
        }
      } catch (error) {
        console.error('Error handling follow:', error);
      }
    };
  
    // Fix the handleMessage function to navigate to MessageScreen
    const handleMessage = () => {
    // Navigate to MessageScreen instead of showing an alert
    navigation.navigate('MessageScreen', { 
      recipientId: userId,
      recipientName: userProfile?.full_name || userProfile?.username || 'User',
      recipientAvatar: userProfile?.avatar_url
    });
    };

  return (
    <View style={styles.container}>
      <ProfileViewBlinker 
        gender={userProfile?.gender} 
        viewerGender={viewerGender} 
      />
      {/* Add back button at the top */}
      <View style={[styles.header, { paddingTop: insets.top > 0 ? insets.top : 50 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>
      
      {loading ? (
        <View style={[styles.container, styles.centered]}>
          <ActivityIndicator size="large" color="#ff00ff" />
        </View>
      ) : userProfile ? (
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom }}>
          <View style={styles.profileSection}>
            {/* Cover Photo */}
            <View style={styles.coverPhotoContainer}>
              {console.log('Rendering cover with URL:', userProfile?.cover_url)}
              <Image
                style={styles.coverPhoto}
                source={userProfile?.cover_url 
                  ? { uri: userProfile.cover_url, cache: 'reload' } 
                  : require('../../assets/defaultcover.png')
                }
                onError={(e) => {
                  console.log('Cover photo error:', e.nativeEvent.error);
                }}
              />
            </View>
            
            {console.log('Rendering avatar with URL:', userProfile?.avatar_url)}
            <Image
              style={styles.profileImage}
              source={userProfile?.avatar_url 
                ? { uri: userProfile.avatar_url, cache: 'reload' } 
                : require('../../assets/defaultavatar.png')
              }
              onError={(e) => {
                console.log('Avatar photo error:', e.nativeEvent.error);
              }}
            />
            <Text style={styles.name}>{userProfile?.full_name || 'No name set'}</Text>
            <Text style={styles.username}>@{userProfile?.username || 'username'}</Text>
            <View style={styles.rankBadge}>
              <Ionicons name="trophy-outline" size={16} color="#FFD700" />
              <Text style={styles.rankNumber}>
                {userProfile?.rank 
                  ? `Rank #${userProfile.rank} ${userProfile.rank === 1 ? '(First Member!)' : ''}`
                  : 'Rank not assigned'}
              </Text>
            </View>
            {renderBio()}
            
            <View style={styles.buttonContainer}>
              <TouchableOpacity 
                style={[
                  styles.followButton,
                  isFollowing ? styles.followingButton : {}
                ]}
                onPress={handleFollow}
              >
                <Text style={styles.followButtonText}>
                  {isFollowing ? 'FOLLOWING' : 'FOLLOW'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.messageButton}
                onPress={handleMessage}
              >
                <Ionicons name="chatbubble-outline" size={24} color="#ff00ff" />
              </TouchableOpacity>
            </View>
  
            <View style={styles.statsContainer}>
              <View style={styles.stat}>
                <Text style={styles.statNumber}>100</Text>
                <Text style={styles.statLabel}>Post</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statNumber}>20</Text>
                <Text style={styles.statLabel}>Shorts</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statNumber}>{followersCount}</Text>
                <Text style={styles.statLabel}>Followers</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statNumber}>{followingCount}</Text>
                <Text style={styles.statLabel}>Following</Text>
              </View>
            </View>
          </View>
  
          <View style={styles.tabsContainer}>
            <TouchableOpacity style={styles.tabButton}>
              <Text style={styles.tabButtonText}>Post</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.tabButton}>
              <Text style={styles.tabButtonText}>Shorts</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tabButton, styles.activeTab]}>
              <Text style={[styles.tabButtonText, styles.activeTabText]}>Details</Text>
            </TouchableOpacity>
          </View>
  
          <View style={styles.detailsSection}>
            <View style={styles.detailItem}>
              <Ionicons name="person-outline" size={24} color="#666" />
              <View style={styles.detailContent}>
                <Text style={styles.detailTitle}>About me</Text>
                <Text style={styles.detailText}>
                  {userProfile?.bio || 'No bio added yet'}
                </Text>
              </View>
            </View>
  
            <View style={styles.detailItem}>
              <Ionicons name="trophy-outline" size={24} color="#FFD700" />
              <View style={styles.detailContent}>
                <Text style={styles.detailTitle}>Member Rank</Text>
                <Text style={styles.detailText}>
                  {userProfile?.rank 
                    ? `Member #${userProfile.rank} on Flexx`
                    : 'Rank not assigned yet'}
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      ) : (
        <View style={[styles.container, styles.centered]}>
          <Text style={styles.errorText}>Could not load profile</Text>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  blinkIndicator: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 20,
    height: 20,
    borderRadius: 10,
    zIndex: 999,
  },
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: 'white',
    fontSize: 18,
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: '#ff00ff',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  backButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    marginLeft: 20,
  },
  profileSection: {
    alignItems: 'center',
    padding: 20,
    paddingTop: 0,
  },
  coverPhotoContainer: {
    width: '100%',
    height: 200,
    marginBottom: -50,
    borderRadius: 15,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#1DA1F2',
  },
  coverPhoto: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#e3a6be',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginTop: 10,
  },
  username: {
    fontSize: 16,
    color: '#faf7f8',
    marginTop: 5,
  },
  rankBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 15,
    marginTop: 5,
  },
  rankNumber: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 5,
  },
  bioContainer: {
    marginTop: 10,
    paddingHorizontal: 20,
    width: '100%',
  },
  bioText: {
    color: '#faf7f8',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  moreText: {
    color: '#ff00ff',
    fontWeight: '600',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 15,
  },
  followButton: {
    backgroundColor: '#ff00ff',
    paddingHorizontal: 30,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10, // Add margin to separate buttons
  },
  followingButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#ff00ff',
  },
  followButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  messageButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ff00ff',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 20,
    paddingVertical: 15,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#1a1a1a',
  },
  stat: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
  },
  tabsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 40,
    marginTop: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  tabButton: {
    marginRight: 30,
    paddingBottom: 10,
    flex: 1,
    alignItems: 'center',
  },
  tabButtonText: {
    color: '#faf7f8',
    fontSize: 16,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#faf7f8',
  },
  activeTabText: {
    color: '#1DA1F2',
  },
  detailsSection: {
    padding: 20,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  detailContent: {
    marginLeft: 15,
    flex: 1,
  },
  detailTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 5,
  },
  detailText: {
    color: '#faf7f8',
    fontSize: 14,
  },
});

export default UserProfileScreen;