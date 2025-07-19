import React, { useState, useRef, useEffect } from 'react';
import { View, FlatList, Dimensions, StyleSheet, TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Video } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVideo } from '../context/VideoContext';
import { supabase } from '../config/supabase';

const { width, height } = Dimensions.get('window');

const ShortsScreen = ({ route }) => {
  const { posts: routePosts, initialIndex = 0, userId } = route.params;
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef(null);
  const videoRefs = useRef({});
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isPlaying, setIsPlaying] = useState(true); // Default to playing
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [showControls, setShowControls] = useState(false);
  const [posts, setPosts] = useState(routePosts || []);
  const [loading, setLoading] = useState(!routePosts);
  const [userProfile, setUserProfile] = useState(null);
  const controlsTimeout = useRef(null);
  const { setFullscreen } = useVideo();
  const isUserSpecificView = !!userId;
  
  // Set fullscreen mode when component mounts
  useEffect(() => {
    setFullscreen(true);
    return () => setFullscreen(false);
  }, []);
  
  // Load user shorts if userId is provided
  useEffect(() => {
    if (userId && !routePosts) {
      loadUserProfile();
      loadUserShorts();
    }
  }, [userId]);

  // Load user profile
  const loadUserProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
        
      if (error) throw error;
      setUserProfile(data);
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

  // Load user shorts
  const loadUserShorts = async () => {
    try {
      setLoading(true);
      // Get video posts for specific user
      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          profiles:user_id(*),
          likes:post_likes(user_id),
          comments:post_comments(count)
        `)
        .eq('user_id', userId)
        .eq('type', 'video')
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      
      // Check if current user has liked each post
      const { data: { user } } = await supabase.auth.getUser();
      const shortsWithLikeStatus = data.map(post => ({
        ...post,
        is_liked: post.likes.some(like => like.user_id === user.id)
      }));
      
      setPosts(shortsWithLikeStatus);
    } catch (error) {
      console.error('Error loading user shorts:', error);
    } finally {
      setLoading(false);
    }
  };

  // Scroll to initial index when component mounts
  useEffect(() => {
    if (flatListRef.current && initialIndex > 0) {
      flatListRef.current.scrollToIndex({
        index: initialIndex,
        animated: false,
      });
    }
  }, [initialIndex]);

  // Format time in mm:ss format
  const formatTime = (timeMillis) => {
    const totalSeconds = Math.floor(timeMillis / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  // Handle video press (play/pause)
  const handleVideoPress = () => {
    setIsPlaying(!isPlaying);
    showVideoControls();
  };

  // Show controls when video is tapped
  const showVideoControls = () => {
    setShowControls(true);
    
    // Clear existing timeout
    if (controlsTimeout.current) {
      clearTimeout(controlsTimeout.current);
    }
    
    // Hide controls after 3 seconds
    controlsTimeout.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  };

  // Handle seeking
  const handleSeek = (value) => {
    const currentVideoRef = videoRefs.current[currentIndex];
    if (currentVideoRef && duration > 0) {
      const newPosition = value * duration;
      currentVideoRef.setPositionAsync(newPosition);
      setCurrentTime(newPosition);
      setProgress(value);
    }
  };

  // Handle playback status update
  const onPlaybackStatusUpdate = (status) => {
    if (status.isLoaded) {
      setProgress(status.positionMillis / status.durationMillis);
      setCurrentTime(status.positionMillis);
      setDuration(status.durationMillis);
      
      // Auto-play next video when current one ends
      if (status.didJustFinish && !status.isLooping) {
        const nextIndex = currentIndex + 1;
        if (nextIndex < posts.length) {
          flatListRef.current.scrollToIndex({
            index: nextIndex,
            animated: true,
          });
        }
      }
    }
  };

  // Handle viewable items changed
  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      const newIndex = viewableItems[0].index;
      
      // Pause previous video
      if (videoRefs.current[currentIndex] && currentIndex !== newIndex) {
        videoRefs.current[currentIndex].pauseAsync();
      }
      
      // Play new video - always auto-play when a new video becomes visible
      if (videoRefs.current[newIndex]) {
        videoRefs.current[newIndex].playAsync();
        setIsPlaying(true);
      }
      
      setCurrentIndex(newIndex);
    }
  }).current;

  // Handle scroll to index failed
  const onScrollToIndexFailed = (info) => {
    const wait = new Promise(resolve => setTimeout(resolve, 500));
    wait.then(() => {
      flatListRef.current?.scrollToIndex({
        index: info.index,
        animated: false,
      });
    });
  };

  // Render each short video item
  const renderItem = ({ item, index }) => {
    // Only render video posts
    if (item.type !== 'video') return null;
    
    return (
      <View style={styles.videoContainer}>
        <TouchableOpacity 
          activeOpacity={1} 
          style={styles.videoWrapper} 
          onPress={handleVideoPress}
        >
          <Video
            ref={ref => { videoRefs.current[index] = ref }}
            source={{ uri: item.media_url }}
            style={styles.video}
            resizeMode="contain"
            shouldPlay={isPlaying && index === currentIndex}
            isLooping
            onPlaybackStatusUpdate={onPlaybackStatusUpdate}
          />
          
          {/* User info overlay */}
          <LinearGradient 
            colors={['transparent', 'rgba(0,0,0,0.7)']} 
            style={[styles.userInfoOverlay, { paddingBottom: insets.bottom + 20 }]}
          >
            <View style={styles.userInfo}>
              <Text style={styles.username}>{item.profiles?.username || 'User'}</Text>
              <Text style={styles.caption}>{item.caption}</Text>
            </View>
          </LinearGradient>

          {/* Video controls */}
          {showControls && (
            <LinearGradient 
              colors={['rgba(0,0,0,0.7)', 'transparent', 'rgba(0,0,0,0.7)']} 
              style={styles.controlsOverlay}
            >
              {/* Top controls */}
              <View style={[styles.topControls, { paddingTop: insets.top }]}>
                <TouchableOpacity 
                  style={styles.backButton} 
                  onPress={() => navigation.goBack()}
                >
                  <Ionicons name="arrow-back" size={28} color="#fff" />
                </TouchableOpacity>
              </View>
              
              {/* Center play/pause button */}
              <TouchableOpacity 
                style={styles.playPauseButton} 
                onPress={() => setIsPlaying(!isPlaying)}
              >
                <LinearGradient
                  colors={['#ff00ff', '#9900ff']}
                  style={styles.playButtonGradient}
                >
                  <Ionicons name={isPlaying ? "pause" : "play"} size={40} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>
              
              {/* Bottom controls */}
              <View style={styles.bottomControls}>
                <View style={styles.timeContainer}>
                  <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
                  <Text style={styles.timeText}>{formatTime(duration)}</Text>
                </View>
                
                <View style={styles.seekbarContainer}>
                  <View style={styles.progressBackground} />
                  <View style={[styles.progressBar, { width: `${progress * 100}%` }]} />
                  <View style={styles.seekbarTouchable}>
                    <TouchableOpacity 
                      style={[styles.seekKnob, { left: `${progress * 100}%` }]}
                    />
                    <View 
                      style={styles.seekbarTouchArea}
                      onTouchStart={(event) => {
                        const { locationX } = event.nativeEvent;
                        const seekPosition = locationX / width;
                        handleSeek(Math.max(0, Math.min(1, seekPosition)));
                      }}
                    />
                  </View>
                </View>
              </View>
            </LinearGradient>
          )}
          
          {/* Loading indicator */}
          {index === currentIndex && !isPlaying && (
            <View style={styles.playIconOverlay}>
              <LinearGradient
                colors={['#ff00ff', '#9900ff']}
                style={styles.playButtonGradient}
              >
                <Ionicons name="play" size={40} color="#fff" />
              </LinearGradient>
            </View>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#ff00ff" />
      </View>
    );
  }

  if (posts.length === 0) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.emptyText}>No shorts available</Text>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={posts.filter(post => post.type === 'video')}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        windowSize={3}
        maxToRenderPerBatch={3}
        initialNumToRender={3}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{
          itemVisiblePercentThreshold: 50
        }}
        onScrollToIndexFailed={onScrollToIndexFailed}
        vertical
      />
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
  emptyText: {
    color: '#fff',
    fontSize: 18,
    marginBottom: 20,
  },
  backButtonText: {
    color: '#ff00ff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  videoContainer: {
    width,
    height,
    backgroundColor: '#000',
  },
  videoWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    width,
    height,
  },
  userInfoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
  },
  userInfo: {
    marginBottom: 20,
  },
  username: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  caption: {
    color: '#fff',
    fontSize: 14,
  },
  controlsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
  },
  topControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playPauseButton: {
    alignSelf: 'center',
  },
  playButtonGradient: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomControls: {
    padding: 20,
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  timeText: {
    color: '#fff',
    fontSize: 12,
  },
  seekbarContainer: {
    height: 20,
    justifyContent: 'center',
    position: 'relative',
  },
  progressBackground: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 1.5,
  },
  progressBar: {
    position: 'absolute',
    left: 0,
    height: 3,
    backgroundColor: '#ff00ff',
    borderRadius: 1.5,
  },
  seekbarTouchable: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 20,
  },
  seekKnob: {
    position: 'absolute',
    width: 15,
    height: 15,
    borderRadius: 7.5,
    backgroundColor: '#ff00ff',
    transform: [{ translateX: -7.5 }],
    top: -6,
  },
  seekbarTouchArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 20,
  },
  playIconOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
});

export default ShortsScreen;