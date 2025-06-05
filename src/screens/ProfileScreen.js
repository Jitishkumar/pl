import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Alert, Modal, ActivityIndicator, FlatList, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Video } from 'expo-av';
import Sidebar from '../components/Sidebar';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { supabase } from '../config/supabase';
import { useAccounts } from '../context/AccountContext';
import PostItem from '../components/PostItem';

// AccountSwitcherModal component
const AccountSwitcherModal = ({ visible, onClose, loadUserProfile }) => {
  const { accounts, addAccount } = useAccounts();
  const navigation = useNavigation();
  const [currentUser, setCurrentUser] = useState(null);
  const [refreshedAccounts, setRefreshedAccounts] = useState([]);

  useEffect(() => {
    if (visible) {
      getCurrentUser();
      refreshAccountData();
    }
  }, [visible]);

  const getCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUser(user.id);
      }
    } catch (error) {
      console.error("Error getting current user:", error);
    }
  };

  const refreshAccountData = async () => {
    try {
      const uniqueIds = {};
      accounts.forEach(account => {
        uniqueIds[account.id] = account;
      });
      const uniqueAccounts = Object.values(uniqueIds);
      const refreshed = await Promise.all(
        uniqueAccounts.map(async (account) => {
          try {
            const { data, error } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', account.id)
              .single();
            if (error) throw error;
            if (data) {
              const updatedAccount = {
                ...account,
                username: data.username,
                avatar_url: data.avatar_url
              };
              addAccount(updatedAccount);
              return updatedAccount;
            }
            return account;
          } catch (e) {
            console.error("Error refreshing account:", e);
            return account;
          }
        })
      );
      setRefreshedAccounts(refreshed);
    } catch (error) {
      console.error("Error refreshing accounts:", error);
    }
  };

  const displayAccounts = refreshedAccounts.length > 0 ? refreshedAccounts : 
    Object.values(accounts.reduce((acc, account) => {
      acc[account.id] = account;
      return acc;
    }, {}));

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Switch Account</Text>
          {displayAccounts.map((account, index) => (
            <TouchableOpacity 
              key={index}
              style={[
                styles.accountItem, 
                currentUser === account.id && styles.currentAccountItem
              ]}
              onPress={async () => {
                try {
                  if (currentUser !== account.id) {
                    onClose();
                    const { data, error } = await supabase.auth.signInWithPassword({
                      email: account.email,
                      password: account.stored_password || ''
                    });
                    if (error) {
                      if (account.session_token) {
                        const { data: sessionData, error: sessionError } = await supabase.auth.refreshSession({
                          refresh_token: account.session_token
                        });
                        if (sessionError) {
                          Alert.alert(
                            "Session Expired", 
                            "Please log in again to access this account.",
                            [{ text: "OK", onPress: () => navigation.navigate('Login', { email: account.email }) }]
                          );
                          return;
                        }
                        await loadUserProfile();
                        navigation.reset({
                          index: 0,
                          routes: [{ name: 'MainApp' }],
                        });
                        return;
                      } else {
                        Alert.alert(
                          "Login Required", 
                          "Please log in to access this account.",
                          [{ text: "OK", onPress: () => navigation.navigate('Login', { email: account.email }) }]
                        );
                        return;
                      }
                    }
                    await loadUserProfile();
                    navigation.reset({
                      index: 0,
                      routes: [{ name: 'MainApp' }],
                    });
                  } else {
                    onClose();
                  }
                } catch (error) {
                  console.error("Error switching account:", error);
                  Alert.alert("Error", "Failed to switch account. Please try logging in manually.");
                  onClose();
                }
              }}
            >
              <Image 
                source={{ uri: account.avatar_url || 'https://via.placeholder.com/150' }}
                style={styles.accountAvatar}
              />
              <Text style={styles.accountUsername}>{account.username}</Text>
              {currentUser === account.id && (
                <View style={styles.currentAccountBadge}>
                  <Ionicons name="checkmark-circle" size={20} color="#ff00ff" />
                </View>
              )}
            </TouchableOpacity>
          ))}
          <TouchableOpacity 
            style={styles.addAccountButton}
            onPress={() => {
              onClose();
              navigation.navigate('Login');
            }}
          >
            <Ionicons name="add-circle-outline" size={24} color="#ff00ff" />
            <Text style={styles.addAccountText}>Add Account</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={onClose}
          >
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// Main ProfileScreen component
const ProfileScreen = () => {
  const { accounts, addAccount } = useAccounts();
  const [isSidebarVisible, setSidebarVisible] = useState(false);
  const [isAccountSwitcherVisible, setAccountSwitcherVisible] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [showFullBio, setShowFullBio] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [postsCount, setPostsCount] = useState(0);
  const [shortsCount, setShortsCount] = useState(0);
  const [activeTab, setActiveTab] = useState('Post');
  const [shorts, setShorts] = useState([]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const [showFollowingModal, setShowFollowingModal] = useState(false);
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [loadingConnections, setLoadingConnections] = useState(false);
  const navigation = useNavigation();

  const memoizedPosts = useMemo(() => posts, [posts]);
  const memoizedShorts = useMemo(() => shorts, [shorts]);

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

  const renderHeader = () => (
    <>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setSidebarVisible(true)}>
          <Ionicons name="menu" size={24} color="#ff00ff" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setAccountSwitcherVisible(true)}>
          <Ionicons name="add-circle-outline" size={24} color="#ff00ff" />
        </TouchableOpacity>
      </View>

      <View style={styles.profileSection}>
        <View style={styles.coverPhotoContainer}>
          {userProfile?.cover_is_video ? (
            <View style={styles.videoCoverContainer}>
              <Video
                source={{ uri: userProfile.cover_url }}
                style={styles.coverPhoto}
                resizeMode="cover"
                shouldPlay
                isLooping
                isMuted={true}
              />
              <View style={styles.videoIndicatorOverlay}>
                <Ionicons name="videocam" size={20} color="#fff" />
              </View>
            </View>
          ) : (
            <Image
              style={styles.coverPhoto}
              source={
                userProfile?.cover_url
                  ? { uri: userProfile.cover_url, cache: 'reload' }
                  : require('../../assets/defaultcover.png')
              }
              onLoadStart={() => console.log('Cover photo loading started')}
              onLoadEnd={() => console.log('Cover photo loading ended')}
              onError={(e) => console.log('Cover photo error:', e.nativeEvent.error)}
            />
          )}
        </View>
        
        <Image
          style={styles.profileImage}
          source={
            userProfile?.avatar_url
              ? { uri: userProfile.avatar_url, cache: 'reload' }
              : require('../../assets/defaultavatar.png')
          }
          onLoadStart={() => console.log('Avatar loading started')}
          onLoadEnd={() => console.log('Avatar loading ended')}
          onError={(e) => console.log('Avatar error:', e.nativeEvent.error)}
        />
        
        <Text style={styles.name}>{userProfile?.full_name || 'No name set'}</Text>
        <Text style={styles.username}>@{userProfile?.username || 'username'}</Text>
        <LinearGradient
          colors={['#ff00ff', '#00ff00']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.rankBadge}
        >
          <Ionicons name="trophy-outline" size={16} color="#FFD700" />
          <Text style={styles.rankNumber}>
            {userProfile?.rank 
              ? `Rank #${userProfile.rank} ${userProfile.rank === 1 ? '(First Member!)' : ''}`
              : 'Rank not assigned'}
          </Text>
        </LinearGradient>
        {userProfile?.bio && (
          <View style={styles.bioContainer}>
            <Text style={styles.bioText}>
              {userProfile.bio.length > 50 && !showFullBio
                ? userProfile.bio.substring(0, 50) + '...'
                : userProfile.bio}
              {userProfile.bio.length > 50 && !showFullBio && (
                <Text 
                  style={styles.moreText}
                  onPress={() => setShowFullBio(true)}
                > more</Text>
              )}
            </Text>
          </View>
        )}
        
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => navigation.navigate('EditProfile')}
        >
          <LinearGradient
            colors={['#ff00ff', '#9400d3']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ borderRadius: 25 }}
          >
            <Text style={styles.editButtonText}>EDIT PROFILE</Text>
          </LinearGradient>
        </TouchableOpacity>

        <View style={styles.statsContainer}>
          <TouchableOpacity style={styles.stat}>
            <Text style={styles.statNumber}>{postsCount}</Text>
            <Text style={styles.statLabel}>Posts</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.stat}>
            <Text style={styles.statNumber}>{shortsCount}</Text>
            <Text style={styles.statLabel}>Shorts</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.stat}
            onPress={fetchFollowers}
          >
            <Text style={styles.statNumber}>{followersCount}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.stat}
            onPress={fetchFollowing}
          >
            <Text style={styles.statNumber}>{followingCount}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.tabsContainer}>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'Post' && styles.activeTab]}
          onPress={() => {
            setActiveTab('Post');
            fetchUserContent();
          }}
        >
          <Text style={[styles.tabButtonText, activeTab === 'Post' && styles.activeTabText]}>Posts</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'Short' && styles.activeTab]}
          onPress={() => {
            setActiveTab('Short');
            fetchUserContent();
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
    </>
  );

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ff00ff" />
        </View>
      );
    }

    if (activeTab === 'Details') {
      return (
        <View style={styles.detailsContainer}>
          <Text style={styles.detailsText}>Details tab content coming soon!</Text>
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
        scrollEnabled={false}
      />
    ) : (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>
          {activeTab === 'Post' ? 'No posts yet' : 'No shorts yet'}
        </Text>
      </View>
    );
  };

  useFocusEffect(
    React.useCallback(() => {
      loadUserProfile();
      fetchFollowersCount();
      fetchFollowingCount();
      fetchPostsCount();
      fetchShortsCount();
      fetchUserContent();
    }, [activeTab])
  );

  const fetchShortsCount = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { count, error } = await supabase
        .from('posts')
        .select('*', { count: 'exact' })
        .eq('user_id', user.id)
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

  const fetchPostsCount = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { count, error } = await supabase
        .from('posts')
        .select('*', { count: 'exact' })
        .eq('user_id', user.id);

      if (error) {
        console.error('Error fetching posts count:', error);
      } else {
        setPostsCount(count);
      }
    } catch (error) {
      console.error('Error fetching posts count:', error);
    }
  };

  const fetchUserContent = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

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
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        const postsWithLikeStatus = data.map(post => ({
          ...post,
          is_liked: post.user_likes?.some(like => like.user_id === user.id) || false
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
          .eq('user_id', user.id)
          .eq('type', 'video')
          .order('created_at', { ascending: false });

        if (error) throw error;
        const shortsWithLikeStatus = data.map(post => ({
          ...post,
          is_liked: post.user_likes?.some(like => like.user_id === user.id) || false
        }));
        setShorts(shortsWithLikeStatus || []);
      }
    } catch (error) {
      console.error('Error fetching user content:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUserProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('No user found');
        return;
      }

      const { data: oldData, error: oldError } = await supabase
        .from('profiles')
        .select('avatar_url, cover_url')
        .eq('id', user.id)
        .single();

      if (oldError) {
        console.error('Error fetching old profile data:', oldError);
      }

      const { data: newData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error loading user profile:', error);
        setUserProfile(null);
        return;
      }
      
      // Check if cover URL is a video by extension if cover_is_video flag is not set
      if (newData.cover_url && newData.cover_url.endsWith('.mp4') && !newData.cover_is_video) {
        // Update the profile with cover_is_video flag
        await supabase
          .from('profiles')
          .update({ cover_is_video: true })
          .eq('id', user.id);
          
        // Update the local data
        newData.cover_is_video = true;
      }

      if (oldData?.avatar_url && oldData.avatar_url !== newData.avatar_url) {
        let oldAvatarPath = oldData.avatar_url;
        if (oldAvatarPath.includes('media/')) {
          oldAvatarPath = oldAvatarPath.split('media/')[1];
        }
        const { error: removeError } = await supabase.storage
          .from('media')
          .remove([oldAvatarPath]);
        if (removeError) {
          console.log('Error removing old avatar:', removeError.message);
        }
      }

      if (oldData?.cover_url && oldData.cover_url !== newData.cover_url) {
        let oldCoverPath = oldData.cover_url;
        if (oldCoverPath.includes('media/')) {
          oldCoverPath = oldCoverPath.split('media/')[1];
        }
        const { error: removeError } = await supabase.storage
          .from('media')
          .remove([oldCoverPath]);
        if (removeError) {
          console.log('Error removing old cover:', removeError.message);
        }
      }

      let avatarUrl = null;
      let coverUrl = null;

      if (newData.avatar_url) {
        let avatarPath = newData.avatar_url;
        if (avatarPath.includes('media/media/') || avatarPath.includes('storage/v1/object/public/media/')) {
          const match = avatarPath.match(/([a-f0-9-]+\/avatar_[0-9]+\.jpg)/);
          if (match && match[1]) {
            avatarPath = match[1];
          } else {
            avatarPath = avatarPath.split('media/').pop();
          }
        }
        avatarUrl = `https://lckhaysswueoyinhfzyz.supabase.co/storage/v1/object/public/media/${avatarPath}`;
        console.log('Constructed Avatar URL:', avatarUrl);
      }

      if (newData.cover_url) {
        let coverPath = newData.cover_url;
        if (coverPath.includes('media/media/') || coverPath.includes('storage/v1/object/public/media/')) {
          const match = coverPath.match(/([a-f0-9-]+\/cover_[0-9]+\.jpg)/);
          if (match && match[1]) {
            coverPath = match[1];
          } else {
            coverPath = coverPath.split('media/').pop();
          }
        }
        coverUrl = `https://lckhaysswueoyinhfzyz.supabase.co/storage/v1/object/public/media/${coverPath}`;
        console.log('Constructed Cover URL:', coverUrl);
      }

      setUserProfile({
        ...newData,
        avatar_url: avatarUrl,
        cover_url: coverUrl
      });
    } catch (error) {
      console.error('Error loading user profile:', error);
      setUserProfile(null);
    }
  };

  const fetchFollowersCount = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { count, error } = await supabase
        .from('follows')
        .select('*', { count: 'exact' })
        .eq('following_id', user.id);

      if (error) {
        console.error('Error fetching followers count:', error);
      } else {
        setFollowersCount(count);
      }
    } catch (error) {
      console.error('Error fetching followers count:', error);
    }
  };

  const fetchFollowingCount = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { count, error } = await supabase
        .from('follows')
        .select('*', { count: 'exact' })
        .eq('follower_id', user.id);

      if (error) {
        console.error('Error fetching following count:', error);
      } else {
        setFollowingCount(count);
      }
    } catch (error) {
      console.error('Error fetching following count:', error);
    }
  };

  const fetchFollowers = async () => {
    try {
      setLoadingConnections(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('follows')
        .select(`
          follower_id,
          profiles!follows_follower_id_fkey (
            id,
            username,
            full_name,
            avatar_url
          )
        `)
        .eq('following_id', user.id);

      if (error) {
        console.error('Error fetching followers:', error);
        return;
      }

      const followersList = data.map(item => {
        const profile = item.profiles;
        let avatarUrl = null;
        if (profile.avatar_url) {
          let avatarPath = profile.avatar_url;
          if (avatarPath.includes('media/media/') || avatarPath.includes('storage/v1/object/public/media/')) {
            const match = avatarPath.match(/([a-f0-9-]+\/avatar_[0-9]+\.jpg)/);
            if (match && match[1]) {
              avatarPath = match[1];
            } else {
              avatarPath = avatarPath.split('media/').pop();
            }
          }
          avatarUrl = `https://lckhaysswueoyinhfzyz.supabase.co/storage/v1/object/public/media/${avatarPath}`;
        }
        return {
          ...profile,
          avatar_url: avatarUrl
        };
      });

      setFollowers(followersList);
      setShowFollowersModal(true);
    } catch (error) {
      console.error('Error fetching followers:', error);
    } finally {
      setLoadingConnections(false);
    }
  };

  const fetchFollowing = async () => {
    try {
      setLoadingConnections(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('follows')
        .select(`
          following_id,
          profiles!follows_following_id_fkey (
            id,
            username,
            full_name,
            avatar_url
          )
        `)
        .eq('follower_id', user.id);

      if (error) {
        console.error('Error fetching following:', error);
        return;
      }

      const followingList = data.map(item => {
        const profile = item.profiles;
        let avatarUrl = null;
        if (profile.avatar_url) {
          let avatarPath = profile.avatar_url;
          if (avatarPath.includes('media/media/') || avatarPath.includes('storage/v1/object/public/media/')) {
            const match = avatarPath.match(/([a-f0-9-]+\/avatar_[0-9]+\.jpg)/);
            if (match && match[1]) {
              avatarPath = match[1];
            } else {
              avatarPath = avatarPath.split('media/').pop();
            }
          }
          avatarUrl = `https://lckhaysswueoyinhfzyz.supabase.co/storage/v1/object/public/media/${avatarPath}`;
        }
        return {
          ...profile,
          avatar_url: avatarUrl
        };
      });

      setFollowing(followingList);
      setShowFollowingModal(true);
    } catch (error) {
      console.error('Error fetching following:', error);
    } finally {
      setLoadingConnections(false);
    }
  };

  const ConnectionsModal = ({ visible, onClose, title, connections, isLoading }) => {
    return (
      <Modal
        visible={visible}
        transparent={true}
        animationType="slide"
        onRequestClose={onClose}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{title}</Text>
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#ff00ff" />
              </View>
            ) : connections.length > 0 ? (
              <FlatList
                data={connections}
                keyExtractor={(item, index) => item.id ? item.id.toString() : index.toString()}
                renderItem={({ item }) => (
                  <TouchableOpacity 
                    style={styles.connectionItem}
                    onPress={() => {
                      onClose();
                      navigation.navigate('UserProfile', { userId: item.id });
                    }}
                  >
                    <Image 
                      source={{ uri: item.avatar_url || 'https://via.placeholder.com/150' }}
                      style={styles.connectionAvatar}
                    />
                    <View style={styles.connectionInfo}>
                      <Text style={styles.connectionName}>{item.full_name || 'No name'}</Text>
                      <Text style={styles.connectionUsername}>@{item.username || 'username'}</Text>
                    </View>
                  </TouchableOpacity>
                )}
                style={styles.connectionsList}
              />
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="people-outline" size={50} color="#666" />
                <Text style={styles.emptyText}>No {title.toLowerCase()} yet</Text>
              </View>
            )}
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={onClose}
            >
              <Text style={styles.closeText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <View style={styles.container}>
      <Sidebar 
        isVisible={isSidebarVisible} 
        onClose={() => setSidebarVisible(false)}
      />
      <AccountSwitcherModal 
        visible={isAccountSwitcherVisible}
        onClose={() => setAccountSwitcherVisible(false)}
        loadUserProfile={loadUserProfile}
      />
      <ConnectionsModal
        visible={showFollowersModal}
        onClose={() => setShowFollowersModal(false)}
        title="Followers"
        connections={followers}
        isLoading={loadingConnections}
      />
      <ConnectionsModal
        visible={showFollowingModal}
        onClose={() => setShowFollowingModal(false)}
        title="Following"
        connections={following}
        isLoading={loadingConnections}
      />
      <FlatList
        data={[{ key: 'header' }, { key: 'content' }]}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) => {
          if (item.key === 'header') {
            return renderHeader();
          } else {
            return renderContent();
          }
        }}
        showsVerticalScrollIndicator={false}
        onRefresh={() => {
          loadUserProfile();
          fetchFollowersCount();
          fetchFollowingCount();
          fetchPostsCount();
          fetchShortsCount();
          fetchUserContent();
        }}
        refreshing={loading}
        contentContainerStyle={{ paddingBottom: 80 }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  videoCoverContainer: {
    position: 'relative',
    width: '100%',
    height: '100%',
  },
  videoIndicatorOverlay: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 15,
    padding: 5,
    flexDirection: 'row',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 18,
    paddingTop: 50,
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
    backgroundColor: '#1a1a1a',
  },
  coverPhoto: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
    backgroundColor: '#1a1a1a',
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#e3a6be',
    backgroundColor: '#1a1a1a',
    marginTop: 10,
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
  rankBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  rankNumber: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 5,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  editButton: {
    marginTop: 15,
    width: '60%',
    alignSelf: 'center',
    elevation: 3,
    shadowColor: '#ff00ff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  editButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
    textAlign: 'center',
    paddingVertical: 12,
    paddingHorizontal: 30,
    textTransform: 'uppercase',
    letterSpacing: 1,
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
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingTop: 30,
    minHeight: '40%',
  },
  modalTitle: {
    color: '#ff00ff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 25,
    textAlign: 'center',
  },
  accountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    marginVertical: 5,
  },
  accountAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
    borderWidth: 2,
    borderColor: '#ff00ff',
  },
  accountUsername: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '500',
  },
  currentAccountItem: {
    backgroundColor: 'rgba(255, 0, 255, 0.1)',
    borderWidth: 1,
    borderColor: '#ff00ff',
    borderRadius: 10,
  },
  currentAccountBadge: {
    marginLeft: 'auto',
  },
  addAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    marginTop: 20,
    backgroundColor: '#330033',
    borderRadius: 10,
  },
  addAccountText: {
    color: '#ff00ff',
    fontSize: 18,
    marginLeft: 15,
    fontWeight: '500',
  },
  closeButton: {
    alignItems: 'center',
    padding: 15,
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  closeText: {
    color: '#999',
    fontSize: 16,
    fontWeight: '500',
  },
  connectionsList: {
    maxHeight: 400,
  },
  connectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  connectionAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
    borderWidth: 1,
    borderColor: '#ff00ff',
  },
  connectionInfo: {
    flex: 1,
  },
  connectionName: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  connectionUsername: {
    color: '#999',
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    flex: 1,
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
    marginTop: 10,
    textAlign: 'center',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  detailsContainer: {
    padding: 20,
    alignItems: 'center',
  },
  detailsText: {
    color: '#fff',
    fontSize: 16,
  },
});

export default ProfileScreen;