import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../config/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const PrivateProfileScreen = () => {
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [followRequestSent, setFollowRequestSent] = useState(false);
  const [followRequestStatus, setFollowRequestStatus] = useState(null); // 'pending', 'accepted', 'declined'
  const navigation = useNavigation();
  const route = useRoute();
  const { userId } = route.params;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    loadUserProfile();
    checkFollowRequestStatus();
    
    // Set up realtime subscription for follow requests
    const followRequestsSubscription = supabase
      .channel('public:follow_requests')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'follow_requests', filter: `recipient_id=eq.${userId}` }, 
        (payload) => {
          // When a follow request status changes, refresh the status
          checkFollowRequestStatus();
      })
      .subscribe();
      
    // Clean up subscription when component unmounts
    return () => {
      supabase.removeChannel(followRequestsSubscription);
    };
  }, [userId]);
  
  // Effect to navigate to UserProfile when follow request is accepted
  useEffect(() => {
    if (followRequestStatus === 'accepted') {
      // Navigate to UserProfileScreen since the request has been accepted
      navigation.replace('UserProfileScreen', { userId });
    }
  }, [followRequestStatus, userId, navigation]);

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
        
      // Check if user has private account using the RLS-bypassing function
      const { data: settingsData, error: settingsError } = await supabase
        .rpc('get_user_privacy', { target_user_id: userId })
        .maybeSingle();
      
      // If no settings data found or account is not private, redirect to UserProfileScreen
      if (!settingsData || settingsData.private_account !== true) {
        console.log('Privacy check: Account is not private or no settings found, redirecting to UserProfileScreen');
        // We can't create settings for other users due to RLS policies
        navigation.replace('UserProfileScreen', { userId });
        return;
      }
  
      if (error) {
        console.error('Error loading user profile:', error);
        setUserProfile(null);
      } else {
        // Fix for nested URLs in avatar_url and cover_url
        let avatarUrl = null;
        let coverUrl = null;
        
        if (data.avatar_url) {
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
        }
        
        if (data.cover_url) {
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
        }

        const profile = {
          ...data,
          avatar_url: avatarUrl,
          cover_url: coverUrl
        };
        
        setUserProfile(profile);
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
      setUserProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const checkFollowRequestStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      // Don't check follow request status if viewing own profile
      if (user.id === userId) return;
      
      // First check if the user is already following this account
      const { data: followData, error: followError } = await supabase
        .from('follows')
        .select('*')
        .eq('follower_id', user.id)
        .eq('following_id', userId)
        .maybeSingle();
        
      if (followError) {
        console.error('Error checking follow status:', followError);
      }
      
      // If already following, navigate to UserProfileScreen
      if (followData) {
        // Navigate to UserProfileScreen since the user is already following
        navigation.replace('UserProfileScreen', { userId });
        return;
      }
      
      // Check for follow requests
      const { data, error } = await supabase
        .from('follow_requests')
        .select('*')
        .eq('sender_id', user.id)
        .eq('recipient_id', userId)
        .single();
        
      if (error && error.code !== 'PGRST116') {
        console.error('Error checking follow request status:', error);
      }
      
      if (data) {
        setFollowRequestSent(true);
        setFollowRequestStatus(data.status);
        
        // If request is accepted, navigate to UserProfileScreen
        if (data.status === 'accepted') {
          navigation.replace('UserProfileScreen', { userId });
        }
      } else {
        setFollowRequestSent(false);
        setFollowRequestStatus(null);
      }
    } catch (error) {
      console.error('Error checking follow request status:', error);
    }
  };

  const handleSendFollowRequest = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        // Redirect to login if not logged in
        navigation.navigate('Login');
        return;
      }
      
      // Don't allow following yourself
      if (user.id === userId) return;
      
      // Create follow request
      const { error } = await supabase
        .from('follow_requests')
        .insert({
          sender_id: user.id,
          recipient_id: userId,
          status: 'pending'
        });
        
      if (error) {
        console.error('Error sending follow request:', error);
        Alert.alert('Error', 'Could not send follow request. Please try again.');
      } else {
        setFollowRequestSent(true);
        setFollowRequestStatus('pending');
        
        // Create notification for the recipient
        const { data: senderProfile } = await supabase
          .from('profiles')
          .select('username, avatar_url')
          .eq('id', user.id)
          .single();
          
        if (senderProfile) {
          const { error: notificationError } = await supabase
            .rpc('create_notification', {
              p_recipient_id: userId,
              p_sender_id: user.id,
              p_type: 'follow_request',
              p_content: 'wants to follow you',
              p_reference_id: null
            });
            
          if (notificationError) {
            console.error('Error creating follow request notification:', notificationError);
          }
        }
        
        Alert.alert('Follow Request Sent', 'Your follow request has been sent. You will be notified when it is accepted.');
      }
    } catch (error) {
      console.error('Error sending follow request:', error);
      Alert.alert('Error', 'Could not send follow request. Please try again.');
    }
  };

  const handleMessage = () => {
    navigation.navigate('MessageScreen', { 
      recipientId: userId,
      recipientName: userProfile?.full_name || userProfile?.username || 'User',
      recipientAvatar: userProfile?.avatar_url
    });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
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
        <View style={styles.profileContainer}>
          {/* Cover Photo */}
          <View style={styles.coverPhotoContainer}>
            <Image
              style={styles.coverPhoto}
              source={userProfile?.cover_url 
                ? { uri: userProfile.cover_url, cache: 'reload' } 
                : require('../../assets/defaultcover.png')
              }
            />
          </View>
          
          <Image
            style={styles.profileImage}
            source={userProfile?.avatar_url 
              ? { uri: userProfile.avatar_url, cache: 'reload' } 
              : require('../../assets/defaultavatar.png')
            }
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
          
          <View style={styles.privateAccountMessage}>
            <Ionicons name="lock-closed" size={40} color="#ff00ff" />
            <Text style={styles.privateAccountTitle}>This Account is Private</Text>
            <Text style={styles.privateAccountText}>Send a follow request to see their posts and shorts.</Text>
          </View>
          
          <View style={styles.buttonContainer}>
            {followRequestSent ? (
              <View style={styles.requestSentButton}>
                <Text style={styles.requestSentText}>
                  {followRequestStatus === 'pending' ? 'REQUEST SENT' : 
                   followRequestStatus === 'accepted' ? 'FOLLOWING' : 'REQUEST DECLINED'}
                </Text>
              </View>
            ) : (
              <TouchableOpacity 
                style={styles.followButton}
                onPress={handleSendFollowRequest}
              >
                <Text style={styles.followButtonText}>SEND FOLLOW REQUEST</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity 
              style={styles.messageButton}
              onPress={handleMessage}
            >
              <Ionicons name="chatbubble-outline" size={24} color="#ff00ff" />
            </TouchableOpacity>
          </View>
        </View>
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
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
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
  profileContainer: {
    flex: 1,
    alignItems: 'center',
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
    width: '90%',
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
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 15,
    width: '100%',
  },
  followButton: {
    backgroundColor: '#ff00ff',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 10,
  },
  followButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  requestSentButton: {
    backgroundColor: 'transparent',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#ff00ff',
  },
  requestSentText: {
    color: '#ff00ff',
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
});

export default PrivateProfileScreen;