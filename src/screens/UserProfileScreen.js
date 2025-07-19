import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, ActivityIndicator, Animated, Alert, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../config/supabase';
import ProfileViewBlinker from '../components/ProfileViewBlinker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Video } from 'expo-av';

const UserProfileScreen = () => {
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showFullBio, setShowFullBio] = useState(false);
  const [viewerGender, setViewerGender] = useState(null);
  const [posts, setPosts] = useState([]);
  const [shorts, setShorts] = useState([]);
  const [postsCount, setPostsCount] = useState(0);
  const [shortsCount, setShortsCount] = useState(0);
  const [activeTab, setActiveTab] = useState('Details');
  const [loadingContent, setLoadingContent] = useState(false);
  const blinkAnimation = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();
  
  const memoizedPosts = useMemo(() => posts, [posts]);
  const memoizedShorts = useMemo(() => shorts, [shorts]);

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
    fetchPostsCount();
    fetchShortsCount();
    
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
  
  useEffect(() => {
    if (canViewPrivateContent || !hasPrivateAccount) {
      fetchUserContent();
    }
  }, [userId, activeTab, canViewPrivateContent, hasPrivateAccount]);

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

  const [hasPrivateAccount, setHasPrivateAccount] = useState(false);
  const [canViewPrivateContent, setCanViewPrivateContent] = useState(false);

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
        
      // Check if user has private account
      const { data: settingsData, error: settingsError } = await supabase
        .from('user_settings')
        .select('private_account')
        .eq('user_id', userId)
        .single();
        
      if (settingsData) {
        setHasPrivateAccount(settingsData.private_account);
        
        // User can view private content if they are the profile owner or if they follow the user
        if (currentUser) {
          if (currentUser.id === userId) {
            setCanViewPrivateContent(true);
          } else if (settingsData.private_account) {
            // Check if current user follows this profile
            const { data: followData } = await supabase
              .from('follows')
              .select('*')
              .eq('follower_id', currentUser.id)
              .eq('following_id', userId)
              .single();
              
            setCanViewPrivateContent(!!followData);
          } else {
            // If account is not private, anyone can view content
            setCanViewPrivateContent(true);
          }
        }
      }
  
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
  
    const fetchPostsCount = async () => {
      try {
        if (!userId) return;

        const { count, error } = await supabase
          .from('posts')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId);

        if (error) {
          console.error('Error fetching posts count:', error);
        } else {
          setPostsCount(count || 0);
        }
      } catch (error) {
        console.error('Error fetching posts count:', error);
      }
    };

    const fetchShortsCount = async () => {
      try {
        if (!userId) return;

        const { count, error } = await supabase
          .from('posts')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('type', 'video');

        if (error) {
          console.error('Error fetching shorts count:', error);
        } else {
          setShortsCount(count || 0);
        }
      } catch (error) {
        console.error('Error fetching shorts count:', error);
      }
    };
  
    const fetchUserContent = async () => {
      try {
        setLoadingContent(true);
        if (!userId) return;

        if (activeTab === 'Post') {
          const { data, error } = await supabase
            .from('posts')
            .select(`
              *,
              profiles:user_id (*),
              likes:post_likes (count),
              comments:post_comments (count),
              user_likes:post_likes (user_id)
            `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

          if (error) throw error;
          const { data: { user } } = await supabase.auth.getUser();
          const postsWithLikeStatus = data.map(post => ({
            ...post,
            is_liked: post.user_likes?.some(like => like.user_id === user?.id) || false
          }));
          setPosts(postsWithLikeStatus || []);
        } else if (activeTab === 'Short') {
          const { data, error } = await supabase
            .from('posts')
            .select(`
              *,
              profiles:user_id (*),
              likes:post_likes (count),
              comments:post_comments (count),
              user_likes:post_likes (user_id)
            `)
            .eq('user_id', userId)
            .eq('type', 'video')
            .order('created_at', { ascending: false });

          if (error) throw error;
          const { data: { user } } = await supabase.auth.getUser();
          const shortsWithLikeStatus = data.map(post => ({
            ...post,
            is_liked: post.user_likes?.some(like => like.user_id === user?.id) || false
          }));
          setShorts(shortsWithLikeStatus || []);
        }
      } catch (error) {
        console.error('Error fetching user content:', error);
      } finally {
        setLoadingContent(false);
      }
    };
  
    // Add state for follow request status
    const [followRequestStatus, setFollowRequestStatus] = useState(null); // 'pending', 'accepted', 'declined', or null
    
    // Fix the handleFollow function to handle private accounts
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
          // Check if the user has a private account
          if (hasPrivateAccount) {
            // Send a follow request instead of directly following
            const { error } = await supabase
              .from('follow_requests')
              .insert({
                sender_id: currentUserId,
                recipient_id: userId,
                status: 'pending'
              });
              
            if (error) {
              console.error('Error sending follow request:', error);
            } else {
              setFollowRequestStatus('pending');
              
              // Create a notification for the follow request
              try {
                const { data: notificationData, error: notificationError } = await supabase
                  .rpc('create_notification', {
                    p_recipient_id: userId,
                    p_sender_id: currentUserId,
                    p_type: 'follow_request',
                    p_content: 'wants to follow you',
                    p_reference_id: null
                  });
                  
                if (notificationError) {
                  console.error('Error creating follow request notification:', notificationError.message, notificationError.details);
                } else {
                  console.log('Follow request notification created successfully');
                }
              } catch (notifError) {
                console.error('Exception creating follow request notification:', notifError);
              }
            }
          } else {
            // Follow - for public accounts
            const { error } = await supabase
              .from('follows')
              .insert({
                follower_id: currentUserId,
                following_id: userId
              });
              
            // Create a notification for the followed user
            if (!error) {
              // Get current user's profile info for the notification
              const { data: followerProfile } = await supabase
                .from('profiles')
                .select('username, avatar_url')
                .eq('id', currentUserId)
                .single();
                
              if (followerProfile) {
                // Create notification using the create_notification function
                try {
                  const { data: notificationData, error: notificationError } = await supabase
                    .rpc('create_notification', {
                      p_recipient_id: userId,
                      p_sender_id: currentUserId,
                      p_type: 'follow',
                      p_content: 'started following you',
                      p_reference_id: null
                    });
                    
                  if (notificationError) {
                    console.error('Error creating follow notification:', notificationError.message, notificationError.details);
                  } else {
                    console.log('Follow notification created successfully');
                  }
                } catch (notifError) {
                  console.error('Exception creating follow notification:', notifError);
                }
              }
            }
              
            if (error) {
              console.error('Error following user:', error);
            } else {
              setIsFollowing(true);
              setFollowersCount(prev => prev + 1);
            }
          }
        }
      } catch (error) {
        console.error('Error handling follow:', error);
      }
    };
    
    // Add function to check follow request status
    const checkFollowRequestStatus = async () => {
      try {
        const { data: session } = await supabase.auth.getSession();
        if (!session?.session?.user) return;
        
        const currentUserId = session.session.user.id;
        
        const { data, error } = await supabase
          .from('follow_requests')
          .select('status')
          .eq('sender_id', currentUserId)
          .eq('recipient_id', userId)
          .order('created_at', { ascending: false })
          .limit(1);
          
        if (error) {
          console.error('Error checking follow request status:', error);
          return;
        }
        
        if (data && data.length > 0) {
          setFollowRequestStatus(data[0].status);
        } else {
          setFollowRequestStatus(null);
        }
      } catch (error) {
        console.error('Error checking follow request status:', error);
      }
    };
    
    // Add effect to check follow request status and subscribe to changes
    useEffect(() => {
      checkFollowRequestStatus();
      
      // Set up subscription for follow requests
      const followRequestsSubscription = supabase
        .channel('follow_requests_changes')
        .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'follow_requests', filter: `sender_id=eq.${userId} OR recipient_id=eq.${userId}` }, 
          () => {
            checkFollowRequestStatus();
          })
        .subscribe();
        
      return () => {
        supabase.removeChannel(followRequestsSubscription);
      };
    }, [userId]);
  
    // Fix the handleMessage function to navigate to MessageScreen
    const handleMessage = () => {
    // Navigate to MessageScreen instead of showing an alert
    navigation.navigate('MessageScreen', { 
      recipientId: userId,
      recipientName: userProfile?.full_name || userProfile?.username || 'User',
      recipientAvatar: userProfile?.avatar_url
    });
    };

  const handleFollowersPress = () => {
    // Check if user can view followers list
    if (hasPrivateAccount && !canViewPrivateContent) {
      Alert.alert(
        'Private Account',
        'You need to follow this account to see their followers.',
        [{ text: 'OK' }]
      );
      return;
    }
    navigation.navigate('FollowersList', { userId: userId });
  };

  const handleFollowingPress = () => {
    // Check if user can view following list
    if (hasPrivateAccount && !canViewPrivateContent) {
      Alert.alert(
        'Private Account',
        'You need to follow this account to see who they follow.',
        [{ text: 'OK' }]
      );
      return;
    }
    navigation.navigate('FollowingList', { userId: userId });
  };
  
  const handlePostPress = (index) => {
    console.log('Post pressed at index:', index);
    navigation.navigate('PostViewer', {
      posts: activeTab === 'Post' ? memoizedPosts : memoizedShorts,
      initialIndex: index,
    });
  };

  const renderGridItem = ({ item, index }) => {
    if (item.type === 'text' || !item.media_url) {
      return (
        <TouchableOpacity 
          style={[styles.gridItem, styles.textGridItem]} 
          onPress={() => handlePostPress(index)}
        >
          <View style={styles.textPostContent}>
            <Text style={styles.gridTextContent} numberOfLines={4}>
              {item.caption || item.content}
            </Text>
            <View style={styles.gridItemFooter}>
              <View style={styles.gridItemStats}>
                <Ionicons name="heart" size={14} color="#ff00ff" />
                <Text style={styles.gridItemStatsText}>{item.likes?.[0]?.count || 0}</Text>
                <Ionicons name="chatbubble" size={14} color="#ff00ff" style={{ marginLeft: 8 }} />
                <Text style={styles.gridItemStatsText}>{item.comments?.[0]?.count || 0}</Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity 
        style={styles.gridItem} 
        onPress={() => handlePostPress(index)}
      >
        {item.type === 'video' ? (
          <View style={styles.gridVideoContainer}>
            <Image
              source={{ uri: item.media_url || 'https://via.placeholder.com/300' }}
              style={styles.gridImage}
              resizeMode="cover"
            />
            <View style={styles.videoIndicator}>
              <Ionicons name="play-circle" size={24} color="#fff" />
            </View>
          </View>
        ) : (
          <Image
            source={{ uri: item.media_url || 'https://via.placeholder.com/300' }}
            style={styles.gridImage}
            resizeMode="cover"
          />
        )}
        <View style={styles.gridItemOverlay}>
          <View style={styles.gridItemStats}>
            <Ionicons name="heart" size={14} color="#fff" />
            <Text style={styles.gridItemStatsText}>{item.likes?.[0]?.count || 0}</Text>
            <Ionicons name="chatbubble" size={14} color="#fff" style={{ marginLeft: 8 }} />
            <Text style={styles.gridItemStatsText}>{item.comments?.[0]?.count || 0}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };
  
  const renderContent = () => {
    if (loadingContent) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ff00ff" />
        </View>
      );
    }

    if (activeTab === 'Details') {
      return (
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
      );
    }

    const data = activeTab === 'Post' ? memoizedPosts : memoizedShorts;
    return data.length > 0 ? (
      <FlatList
        data={data}
        renderItem={renderGridItem}
        numColumns={3}
        keyExtractor={item => item.id.toString()}
        columnWrapperStyle={styles.gridRow}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.gridContainer}
        scrollEnabled={true}
      />
    ) : (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>
          {activeTab === 'Post' ? 'No posts yet' : 'No shorts yet'}
        </Text>
      </View>
    );
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
              {followRequestStatus === 'pending' ? (
                <TouchableOpacity 
                  style={[styles.followButton, styles.pendingButton]}
                  disabled={true}
                >
                  <Text style={styles.followButtonText}>
                    REQUEST SENT
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity 
                  style={[
                    styles.followButton,
                    isFollowing ? styles.followingButton : {}
                  ]}
                  onPress={handleFollow}
                >
                  <Text style={styles.followButtonText}>
                    {isFollowing ? 'FOLLOWING' : hasPrivateAccount ? 'REQUEST' : 'FOLLOW'}
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity 
                style={styles.messageButton}
                onPress={handleMessage}
              >
                <Ionicons name="chatbubble-outline" size={24} color="#ff00ff" />
              </TouchableOpacity>
            </View>
  
            <View style={styles.statsContainer}>
            <View style={styles.stat}>
              <Text style={styles.statNumber}>{canViewPrivateContent ? postsCount : hasPrivateAccount ? '•••' : postsCount}</Text>
              <Text style={styles.statLabel}>Post</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statNumber}>{canViewPrivateContent ? shortsCount : hasPrivateAccount ? '•••' : shortsCount}</Text>
              <Text style={styles.statLabel}>Shorts</Text>
            </View>
            <TouchableOpacity style={styles.stat} onPress={handleFollowersPress}>
              <Text style={styles.statNumber}>{canViewPrivateContent ? followersCount : hasPrivateAccount ? '•••' : followersCount}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.stat} onPress={handleFollowingPress}>
              <Text style={styles.statNumber}>{canViewPrivateContent ? followingCount : hasPrivateAccount ? '•••' : followingCount}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </TouchableOpacity>
          </View>
          </View>
  
          <View style={styles.tabsContainer}>
            <TouchableOpacity 
              style={[styles.tabButton, activeTab === 'Post' && styles.activeTab]}
              onPress={() => {
                if (hasPrivateAccount && !canViewPrivateContent) {
                  Alert.alert(
                    'Private Account',
                    'You need to follow this account to see their posts.',
                    [{ text: 'OK' }]
                  );
                  return;
                }
                setActiveTab('Post');
              }}
            >
              <Text style={[styles.tabButtonText, activeTab === 'Post' && styles.activeTabText]}>Post</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.tabButton, activeTab === 'Short' && styles.activeTab]}
              onPress={() => {
                if (hasPrivateAccount && !canViewPrivateContent) {
                  Alert.alert(
                    'Private Account',
                    'You need to follow this account to see their shorts.',
                    [{ text: 'OK' }]
                  );
                  return;
                }
                setActiveTab('Short');
              }}
            >
              <Text style={[styles.tabButtonText, activeTab === 'Short' && styles.activeTabText]}>Shorts</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.tabButton, activeTab === 'Details' && styles.activeTab]}
              onPress={() => setActiveTab('Details')}
            >
              <Text style={[styles.tabButtonText, activeTab === 'Details' && styles.activeTabText]}>Details</Text>
            </TouchableOpacity>
          </View>
          
          {hasPrivateAccount && !canViewPrivateContent && (
            <View style={styles.privateAccountMessage}>
              <Ionicons name="lock-closed" size={40} color="#ff00ff" />
              <Text style={styles.privateAccountTitle}>This Account is Private</Text>
              <Text style={styles.privateAccountText}>Follow this account to see their posts and shorts.</Text>
            </View>
          )}
          
          {(!hasPrivateAccount || canViewPrivateContent) && renderContent()}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    minHeight: 200,
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 10,
  },
  gridContainer: {
    padding: 4,
    paddingBottom: 20,
  },
  gridRow: {
    justifyContent: 'flex-start',
    padding: 2,
  },
  gridItem: {
    flex: 1,
    margin: 2,
    aspectRatio: 1,
    maxWidth: '33.33%',
    borderRadius: 8,
    overflow: 'hidden',
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  gridVideoContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoIndicator: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -12 }, { translateY: -12 }],
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 12,
    padding: 4,
    zIndex: 2,
  },
  gridItemOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 4,
  },
  gridItemStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gridItemStatsText: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 4,
  },
  textGridItem: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
  },
  textPostContent: {
    flex: 1,
    padding: 8,
    justifyContent: 'space-between',
  },
  gridTextContent: {
    color: '#fff',
    fontSize: 12,
    lineHeight: 16,
  },
  gridItemFooter: {
    marginTop: 'auto',
  },
  privateAccountMessage: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    marginHorizontal: 20,
    marginVertical: 20,
    backgroundColor: '#111',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#222',
  },
  privateAccountTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 15,
    marginBottom: 8,
  },
  privateAccountText: {
    color: '#999',
    fontSize: 14,
    textAlign: 'center',
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
  pendingButton: {
    backgroundColor: '#888',
    borderWidth: 1,
    borderColor: '#666',
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
    borderBottomColor: '#ff00ff',
  },
  activeTabText: {
    color: '#ff00ff',
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