import React, { useState, useRef, useEffect } from 'react';

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Image,
  Dimensions,
  ActivityIndicator,
  Modal,
  PanResponder,
  ScrollView,
  Linking,
  TextInput
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Video } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useVideo } from '../context/VideoContext';
import { PostsService } from '../services/PostsService';
import { supabase } from '../config/supabase';
import { Alert } from 'react-native';
import CommentScreen from '../screens/CommentScreen';

const { width } = Dimensions.get('window');

const PostItem = ({ post, onOptionsPress }) => {
  const [isLiked, setIsLiked] = useState(post.is_liked || false);
  const [likesCount, setLikesCount] = useState(post.likes?.[0]?.count || 0);
  const [commentsCount, setCommentsCount] = useState(post.comments?.[0]?.count || 0);
  const navigation = useNavigation();
  const touchTimer = useRef(null);
  const isTouchHolding = useRef(false);

  // Add this function to safely get the avatar URL
  const getAvatarUrl = () => {
    if (!post?.profiles?.avatar_url) return 'https://via.placeholder.com/150';
    
    let avatarPath = post.profiles.avatar_url;
    if (avatarPath.includes('media/media/') || avatarPath.includes('storage/v1/object/public/media/')) {
      const match = avatarPath.match(/([a-f0-9-]+\/avatar_[0-9]+\.jpg)/);
      if (match && match[1]) {
        avatarPath = match[1];
      } else {
        avatarPath = avatarPath.split('media/').pop();
      }
    }
    return `https://lckhaysswueoyinhfzyz.supabase.co/storage/v1/object/public/media/${avatarPath}`;
  };
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [lastTap, setLastTap] = useState(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [seeking, setSeeking] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const videoRef = useRef(null);
  const controlsTimeout = useRef(null);
  
  // Get video context
  const { activeVideoId, setActiveVideo, clearActiveVideo, isFullscreenMode, setFullscreen: setContextFullscreen } = useVideo();

  const handleProfilePress = () => {
    navigation.navigate('UserProfileScreen', { userId: post?.user_id || post?.user?.id });
  };

  const handleVideoPress = () => {
    const now = Date.now();
    if (lastTap && (now - lastTap) < 300) {
      // Double tap - go to shorts screen for vertical scrolling
      // Pause the feed video first to prevent double audio
      if (videoRef.current) {
        videoRef.current.pauseAsync();
      }
      setPlaying(false);
      clearActiveVideo();
      
      // Get all video posts from the HomeScreen navigation params
      const homeRoute = navigation.getState().routes.find(route => route.name === 'Home');
      const videoPosts = homeRoute?.params?.videoPosts || [post]; // If no video posts available, just use current post
      
      // Find the index of the current post
      const currentIndex = videoPosts.findIndex(p => p.id === post.id);
      
      // Navigate to ShortsScreen with all video posts and current index
      navigation.navigate('Shorts', {
        posts: videoPosts,
        initialIndex: currentIndex >= 0 ? currentIndex : 0
      });
    } else {
      // Single tap - toggle play/pause and show controls
      const newPlayingState = !playing;
      setPlaying(newPlayingState);
      showVideoControls();
      
      if (newPlayingState) {
        // If we're starting to play this video, set it as the active video
        setActiveVideo(post.id);
      } else if (activeVideoId === post.id) {
        // If we're pausing the active video, clear the active video
        clearActiveVideo();
      }
    }
    setLastTap(now);
  };
  
  // Add touch handlers for press-to-pause functionality
  const handleTouchStart = () => {
    if (post.type === 'video') {
      // Clear any existing touch timer
      if (touchTimer.current) {
        clearTimeout(touchTimer.current);
      }
      
      // Set a timer to detect long press (300ms)
      touchTimer.current = setTimeout(() => {
        if (playing) {
          isTouchHolding.current = true;
          setPlaying(false);
          if (videoRef.current) {
            videoRef.current.pauseAsync();
          }
        }
      }, 300);
    }
  };

  const handleTouchEnd = () => {
    // Clear the touch timer
    if (touchTimer.current) {
      clearTimeout(touchTimer.current);
      touchTimer.current = null;
    }
    
    // If we were holding and paused the video, resume playback
    if (isTouchHolding.current) {
      isTouchHolding.current = false;
      setPlaying(true);
      if (videoRef.current) {
        videoRef.current.playAsync();
      }
      setActiveVideo(post.id);
    }
  };

  const handleFullscreenClose = () => {
    // First stop playback in fullscreen
    setPlaying(false);
    
    // Wait a moment to ensure video playback is stopped before closing modal
    setTimeout(() => {
      setFullscreen(false);
      setContextFullscreen(false);
      clearActiveVideo();
    }, 100);
  };

  const onPlaybackStatusUpdate = (status) => {
    if (status.isLoaded) {
      setProgress(status.positionMillis / status.durationMillis);
      setCurrentTime(status.positionMillis);
      setDuration(status.durationMillis);
    }
  };
  
  // Format time in mm:ss format
  const formatTime = (timeMillis) => {
    const totalSeconds = Math.floor(timeMillis / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };
  
  // Create a PanResponder for the seekbar
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        setSeeking(true);
        // Pause video while seeking
        if (videoRef.current && playing) {
          videoRef.current.pauseAsync();
        }
      },
      onPanResponderMove: (evt, gestureState) => {
        // Calculate new progress based on touch position
        const seekbarWidth = width - 40; // Adjust for padding
        const newProgress = Math.max(0, Math.min(1, gestureState.moveX / seekbarWidth));
        setProgress(newProgress);
        // Update video position while dragging
        if (videoRef.current && duration > 0) {
          const newPosition = newProgress * duration;
          videoRef.current.setPositionAsync(newPosition);
          setCurrentTime(newPosition);
        }
      },
      onPanResponderRelease: async (evt, gestureState) => {
        // Calculate final progress and seek to that position
        const seekbarWidth = width - 40; // Adjust for padding
        const newProgress = Math.max(0, Math.min(1, gestureState.moveX / seekbarWidth));
        
        // Keep seeking true until the operation completes
        await handleSeek(newProgress);
        
        // Resume playback from the new position
        if (videoRef.current) {
          setPlaying(true);
          await videoRef.current.playAsync();
        }
        
        // Only set seeking to false after all operations complete
        setSeeking(false);
      },
    })
  ).current;
  
  // Handle seeking
  const handleSeek = async (value) => {
    if (videoRef.current && duration > 0) {
      const newPosition = value * duration;
      await videoRef.current.setPositionAsync(newPosition);
      setCurrentTime(newPosition);
      setProgress(value);
    }
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
  
  // Effect to handle when another video becomes active
  useEffect(() => {
    if (activeVideoId && activeVideoId !== post.id && playing) {
      // If another video is now active and this one is playing, pause this one
      setPlaying(false);
      if (videoRef.current) {
        videoRef.current.pauseAsync();
      }
    }
  }, [activeVideoId, post.id, playing]);
  
  // Auto-play video when it becomes visible in the viewport
  useEffect(() => {
    if (post.type === 'video' && videoRef.current) {
      // Only auto-play if this post is the active video and not in fullscreen mode
      if (activeVideoId === post.id && !isFullscreenMode && !isTouchHolding.current) {
        setPlaying(true);
        videoRef.current.playAsync();
      } else if (activeVideoId !== post.id && playing) {
        // If another video is active but this one is playing, pause it
        setPlaying(false);
        videoRef.current.pauseAsync();
      }
    }
    
    // Cleanup function to handle unmounting
    return () => {
      if (videoRef.current) {
        videoRef.current.pauseAsync();
      }
    };
  }, [post.id, activeVideoId, isFullscreenMode]);
  
  // Effect to handle fullscreen mode changes
  useEffect(() => {
    if (isFullscreenMode && !fullscreen && playing) {
      // If we're in fullscreen mode but this video isn't the fullscreen one and it's playing, pause it
      setPlaying(false);
      if (videoRef.current) {
        videoRef.current.pauseAsync();
      }
    }
  }, [isFullscreenMode, fullscreen, playing]);
  
  // Effect to pass posts data to navigation state for ShortsScreen
  useEffect(() => {
    if (navigation) {
      const currentRoute = navigation.getState().routes.find(route => route.name === 'Home');
      if (currentRoute) {
        navigation.setParams({
          ...currentRoute.params,
          data: currentRoute.params?.data || [post]
        });
      }
    }
  }, [navigation, post]);
  
  // Effect to ensure only one video instance is playing at a time
  useEffect(() => {
    // When component unmounts or when fullscreen state changes, ensure video is paused
    return () => {
      if (videoRef.current) {
        videoRef.current.pauseAsync();
      }
    };
  }, [fullscreen]);

  const [showLikesModal, setShowLikesModal] = useState(false);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editCaption, setEditCaption] = useState(post.caption || '');
  const [likesList, setLikesList] = useState([]);
  const [loadingLikes, setLoadingLikes] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
    };
    getCurrentUser();
  }, []);

  const handleLike = async () => {
    try {
      const { isLiked: liked, likesCount: newCount } = await PostsService.toggleLike(post.id);
      setIsLiked(liked);
      setLikesCount(newCount);
    } catch (error) {
      console.error('Error toggling like:', error);
      Alert.alert('Error', 'Failed to update like');
    }
  };

  const handleShowLikes = async () => {
    try {
      setLoadingLikes(true);
      const { data, error } = await supabase
        .from('post_likes')
        .select(`
          user_id,
          profiles:user_id (username, avatar_url)
        `)
        .eq('post_id', post.id);

      if (error) throw error;
      setLikesList(data);
      setShowLikesModal(true);
    } catch (error) {
      console.error('Error fetching likes:', error);
      Alert.alert('Error', 'Failed to load likes');
    } finally {
      setLoadingLikes(false);
    }
  };

  const handleComment = () => {
    setShowCommentModal(true);
  };

  const handleEdit = async () => {
    try {
      await PostsService.editPost(post.id, editCaption);
      post.caption = editCaption;
      setShowEditModal(false);
      Alert.alert('Success', 'Post updated successfully');
    } catch (error) {
      console.error('Error updating post:', error);
      Alert.alert('Error', 'Failed to update post');
    }
  };

  const handleDelete = async () => {
    Alert.alert(
      'Delete Post',
      'Are you sure you want to delete this post?',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await PostsService.deletePost(post.id);
              // Trigger parent component update
              if (onOptionsPress) {
                onOptionsPress({ type: 'delete', postId: post.id });
              }
              // Close any open modals
              setShowLikesModal(false);
              setShowCommentModal(false);
              setShowEditModal(false);
            } catch (error) {
              console.error('Error deleting post:', error);
              Alert.alert('Error', 'Failed to delete post');
            }
          }
        }
      ]
    );
  };
  
  const handleCloseCommentModal = () => {
    setShowCommentModal(false);
  };

  return (
    <>
      <LinearGradient
        colors={['#1a1a3a', '#0d0d2a']}
        style={styles.container}
      >
        {/* Post Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerLeft} onPress={handleProfilePress}>
            <LinearGradient colors={['#ff00ff', '#00ffff']} style={styles.avatarBorder}>
              <Image
                source={{ uri: getAvatarUrl() }}
                style={styles.avatar}
                defaultSource={require('../../assets/defaultavatar.png')}
              />
            </LinearGradient>
            <View style={styles.headerInfo}>
              <Text style={styles.username}>{post?.profiles?.username || 'Anonymous User'}</Text>
              <Text style={styles.timestamp}>
                {new Date(post?.created_at || Date.now()).toLocaleDateString()}
              </Text>
            </View>
          </TouchableOpacity>
          {currentUser && currentUser.id === post?.user_id && (
            <TouchableOpacity 
              style={styles.optionsButton} 
              onPress={() => {
                Alert.alert(
                  'Post Options',
                  'What would you like to do?',
                  [
                    { text: 'Edit Caption', onPress: () => setShowEditModal(true) },
                    { text: 'Delete Post', onPress: handleDelete, style: 'destructive' },
                    { text: 'Cancel', style: 'cancel' }
                  ]
                );
              }}
            >
              <Ionicons name="ellipsis-vertical" size={20} color="#fff" />
            </TouchableOpacity>
          )}
        </View>

        {/* Post Caption */}
        {post.caption && (
          <View style={styles.captionContainer}>
            <Text style={styles.caption}>
              {post.caption.split(/(https?:\/\/[^\s]+)/g).map((part, index) => {
                if (part.match(/^https?:\/\//)) {
                  return (
                    <TouchableOpacity key={index} onPress={() => Linking.openURL(part)}>
                      <Text style={styles.link}>{part}</Text>
                    </TouchableOpacity>
                  );
                }
                return part;
              })}
            </Text>
          </View>
        )}



        {/* Post Media */}
        {post.media_url && (
          <View style={styles.mediaContainer}>
            {post.type === 'video' ? (
              <TouchableWithoutFeedback 
                onPress={handleVideoPress}
                onPressIn={handleTouchStart}
                onPressOut={handleTouchEnd}
              >
                <View style={styles.videoContainer}>
                  {loading && (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator size="large" color="#ff00ff" />
                      <Text style={styles.loadingText}>Loading video...</Text>
                    </View>
                  )}

                  <Video
                    ref={videoRef}
                    source={{ uri: post.media_url }}
                    style={styles.media}
                    resizeMode="cover"
                    shouldPlay={playing && activeVideoId === post.id && !isTouchHolding.current}
                    isLooping
                    onLoadStart={() => setLoading(true)}
                    onLoad={() => {
                      setLoading(false);
                      // Only auto-play if this is the active video and not being held
                      if (activeVideoId === post.id && !isTouchHolding.current) {
                        setPlaying(true);
                        if (videoRef.current) {
                          videoRef.current.playAsync();
                        }
                      }
                    }}
                    onPlaybackStatusUpdate={(status) => {
                      if (status.isLoaded) {
                        // Only update progress if not currently seeking
                        if (!seeking) {
                          setProgress(status.positionMillis / status.durationMillis);
                          setCurrentTime(status.positionMillis);
                        }
                        setDuration(status.durationMillis);
                      }
                    }}
                    onError={() => {
                      setLoading(false);
                      setVideoError(true);
                    }}
                  />

                  {showControls && (
                    <LinearGradient
                      colors={['transparent', 'rgba(0,0,0,0.7)']}
                      style={styles.videoControls}
                    >
                      {/* Video seekbar with PanResponder */}
                      <View style={styles.seekbarContainer}>
                        <View style={styles.progressBackground} />
                        <View style={[styles.progressBar, { width: `${progress * 100}%` }]} />
                        <View {...panResponder.panHandlers} style={styles.seekbarTouchable}>
                          <View style={[styles.seekKnob, { left: `${progress * 100}%` }]} />
                        </View>
                      </View>
                    </LinearGradient>
                  )}

                  {videoError && (
                    <View style={styles.errorContainer}>
                      <Ionicons name="alert-circle" size={30} color="#ff00ff" />
                      <Text style={styles.errorText}>Video unavailable</Text>
                      <Text style={styles.errorSubText}>Tap to retry</Text>
                    </View>
                  )}
                </View>
              </TouchableWithoutFeedback>
            ) : (
              <View style={styles.imageContainer}>
                <Image
                  source={{ uri: post.media_url }}
                  style={styles.media}
                  resizeMode="cover"
                  onLoadStart={() => setImageLoaded(false)}
                  onLoad={() => setImageLoaded(true)}
                />
                {!imageLoaded && (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#ff00ff" />
                    <Text style={styles.loadingText}>Loading image...</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* Post Actions */}
        <LinearGradient colors={['rgba(26, 26, 58, 0.8)', 'rgba(13, 13, 42, 0.9)']} style={styles.actions}>
          <TouchableOpacity style={styles.actionButton} onPress={handleLike}>
            <LinearGradient colors={isLiked ? ['#ff00ff', '#9900ff'] : ['transparent', 'transparent']} style={isLiked ? styles.likedIconBackground : {}}>
              <Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={26} color={isLiked ? '#fff' : '#e0e0ff'} />
            </LinearGradient>
            <Text style={[styles.actionText, isLiked && styles.likedText]}>
              {likesCount}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={handleComment}>
            <Ionicons name="chatbubble-outline" size={24} color="#e0e0ff" />
            <Text style={styles.actionText}>
              {commentsCount}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="share-social-outline" size={24} color="#e0e0ff" />
          </TouchableOpacity>
        </LinearGradient>


        {/* Likes Modal */}
        <Modal
          visible={showLikesModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowLikesModal(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Likes</Text>
                <TouchableOpacity onPress={() => setShowLikesModal(false)}>
                  <Ionicons name="close" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
              
              {loadingLikes ? (
                <ActivityIndicator size="large" color="#ff00ff" style={styles.loadingIndicator} />
              ) : (
                <ScrollView style={styles.likesList}>
                  {likesList.map((like, index) => (
                    <TouchableOpacity 
                      key={index}
                      style={styles.likeItem}
                      onPress={() => {
                        setShowLikesModal(false);
                        navigation.navigate('UserProfileScreen', { userId: like.user_id });
                      }}
                    >
                      <Image 
                        source={{ uri: like.profiles.avatar_url || 'https://via.placeholder.com/150' }}
                        style={styles.likeAvatar}
                      />
                      <Text style={styles.likeUsername}>{like.profiles.username}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>
      </LinearGradient>

      {/* Comment Modal */}
      <CommentScreen 
        visible={showCommentModal} 
        onClose={handleCloseCommentModal} 
        postId={post.id} 
      />

      {/* Edit Caption Modal */}
      <Modal
        visible={showEditModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Caption</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            
            <TextInput
              style={styles.editInput}
              value={editCaption}
              onChangeText={setEditCaption}
              multiline
              placeholder="Write a caption..."
              placeholderTextColor="#666"
            />
            
            <TouchableOpacity 
              style={styles.editButton}
              onPress={handleEdit}
            >
              <Text style={styles.editButtonText}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Fullscreen Video */}
      {fullscreen && (
        <Modal
          visible={fullscreen}
          transparent={false}
          animationType="fade"
          onRequestClose={handleFullscreenClose}
        >
          <LinearGradient
            colors={['#1a1a3a', '#0d0d2a']}
            style={styles.fullscreenContainer}
          >
            <Video
            ref={videoRef}
            source={{ uri: post.media_url }}
            style={styles.fullscreenVideo}
            resizeMode="contain"
            shouldPlay={playing && fullscreen} // Only play if in fullscreen mode
            isLooping
            onPlaybackStatusUpdate={onPlaybackStatusUpdate}
            onLoad={(status) => {
              setLoading(false);
              // Ensure video starts playing on load if it's not already playing
              if (!playing) {
                setPlaying(true);
                setActiveVideo(post.id);
              }
            }}
            onError={() => {
              setVideoError(true);
              setLoading(false);
            }}
          />

            {/* Fullscreen video controls */}
            {fullscreen && showControls && (
              <LinearGradient
                colors={['rgba(0,0,0,0.9)', 'rgba(0,0,0,0.9)']}
                style={styles.fullscreenOverlay}
              >
                {/* Video controls */}
                {fullscreen && showControls && (
                  <View>
                    {/* Top controls */}
                    <LinearGradient
                      colors={['rgba(0,0,0,0.7)', 'transparent']}
                      style={styles.fullscreenTopControls}
                    >
                      <TouchableOpacity onPress={handleFullscreenClose}>
                        <Ionicons name="arrow-back" size={28} color="#fff" />
                      </TouchableOpacity>
                    </LinearGradient>
                    
                    {/* Bottom controls */}
                    <LinearGradient
                      colors={['transparent', 'rgba(0,0,0,0.7)']}
                      style={styles.fullscreenBottomControls}
                    >
                      {/* Time display */}
                      <View style={styles.fullscreenTimeContainer}>
                        <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
                        <Text style={styles.timeText}>{formatTime(duration)}</Text>
                      </View>
                      
                      {/* Seekbar with PanResponder */}
                      <View style={styles.fullscreenSeekbarContainer}>
                        <View style={styles.fullscreenProgressBackground} />
                        <View style={[styles.fullscreenProgressBar, { width: `${progress * 100}%` }]} />
                        <View {...panResponder.panHandlers} style={styles.seekbarTouchable}>
                          <View style={[styles.fullscreenSeekKnob, { left: `${progress * 100}%` }]} />
                        </View>
                      </View>
                      
                      {/* Playback controls */}
                      <View style={styles.fullscreenControlsRow}>
                        <TouchableOpacity 
                          style={styles.fullscreenControlButton} 
                          onPress={() => {
                            setSeeking(true);
                            handleSeek(Math.max(0, progress - 0.1)).then(() => setSeeking(false));
                          }}>
                          <Ionicons name="play-back" size={24} color="#fff" />
                        </TouchableOpacity>
                        
                        <TouchableOpacity style={styles.fullscreenPlayPauseButton} onPress={() => setPlaying(!playing)}>
                          <LinearGradient
                            colors={['#ff00ff', '#9900ff']}
                            style={styles.fullscreenPlayButtonGradient}
                          >
                            <Ionicons name={playing ? 'pause' : 'play'} size={28} color="#fff" />
                          </LinearGradient>
                        </TouchableOpacity>
                        
                        <TouchableOpacity 
                          style={styles.fullscreenControlButton} 
                          onPress={() => {
                            setSeeking(true);
                            handleSeek(Math.min(1, progress + 0.1)).then(() => setSeeking(false));
                          }}>
                          <Ionicons name="play-forward" size={24} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    </LinearGradient>
                  </View>
                )}
              </LinearGradient>
            )}
          </LinearGradient>
        </Modal>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  fullscreenOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  editInput: {
    backgroundColor: '#1a1a3a',
    borderRadius: 10,
    padding: 15,
    color: '#fff',
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
    marginVertical: 15,
  },
  editButton: {
    backgroundColor: '#ff00ff',
    borderRadius: 25,
    padding: 15,
    alignItems: 'center',
    marginTop: 10,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a3a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    minHeight: '50%',
    maxHeight: '80%',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  link: {
    color: '#00ffff',
    textDecorationLine: 'underline',
  },
  loadingIndicator: {
    marginTop: 20,
  },
  likesList: {
    flex: 1,
  },
  likeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  likeAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  likeUsername: {
    fontSize: 16,
    color: '#fff',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  likedIconBackground: {
    padding: 8,
    borderRadius: 20,
  },
  likedText: {
    color: '#ff00ff',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    gap: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  iconBackground: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  container: { marginBottom: 20, borderRadius: 10, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 10, justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  headerInfo: { marginLeft: 10 },
  username: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
  timestamp: { fontSize: 12, color: '#aaa' },
  optionsButton: { padding: 5 },
  avatarBorder: { width: 50, height: 50, borderRadius: 25, padding: 2 },
  avatar: { width: 46, height: 46, borderRadius: 23 },
  captionContainer: { padding: 10 },
  caption: { color: '#ddd' },
  mediaContainer: { width: '100%', aspectRatio: 1 },
  media: { width: '100%', height: '100%' },
  videoContainer: { width: '100%', height: '100%' },
  loadingContainer: { ...StyleSheet.absoluteFill, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 5, color: '#ff00ff' },
  actions: { flexDirection: 'row', padding: 10, justifyContent: 'space-around' },
  actionButton: { alignItems: 'center' },
  actionText: { marginTop: 2, color: '#e0e0ff', fontSize: 12 },
  likedIconBackground: { borderRadius: 20, padding: 5 },
  likedText: { color: '#ff00ff' },
  videoControls: { position: 'absolute', bottom: 0, width: '100%', padding: 10, paddingBottom: 30 },  timeContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  timeText: { color: '#fff', fontSize: 12, fontWeight: '500' },
  seekbarContainer: { height: 20, justifyContent: 'center', width: '100%', marginBottom: 20 },
  progressBackground: { position: 'absolute', height: 4, width: '100%', backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2 },
  progressBar: { position: 'absolute', height: 4, backgroundColor: '#ff00ff', borderRadius: 2, shadowColor: '#ff00ff', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 4 },
  seekKnob: { position: 'absolute', width: 16, height: 16, borderRadius: 8, backgroundColor: '#ff00ff', marginLeft: -8, borderWidth: 2, borderColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 2, zIndex: 2 },
  seekbarTouchable: { position: 'absolute', width: '100%', height: 20, marginBottom: 16 },
  seekbarTouchArea: { position: 'absolute', width: '100%', height: 20, backgroundColor: 'transparent', zIndex: 1 },
  controlsRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', marginTop: 10 },
  controlButton: { padding: 8 },
  playPauseButton: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  videoOverlay: { ...StyleSheet.absoluteFill, justifyContent: 'center', alignItems: 'center' },
  playButton: { width: 60, height: 60, borderRadius: 30, overflow: 'hidden' },
  playButtonGradient: { flex: 1, justifyContent: 'center', alignItems: 'center', borderRadius: 30 },
  errorContainer: { ...StyleSheet.absoluteFill, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)' },
  errorText: { color: '#fff', marginTop: 10 },
  errorSubText: { color: '#ccc', fontSize: 12 },
  
  // Fullscreen styles
  fullscreenContainer: { 
    flex: 1, 
    backgroundColor: '#0d0d2a',
    justifyContent: 'center'
  },
  fullscreenVideo: { 
    width: '100%',
    height: '100%',
    position: 'absolute'
  },
  fullscreenTopControls: { 
    position: 'absolute', 
    top: 0, 
    left: 0,
    right: 0,
    height: 100, 
    paddingTop: 40,
    paddingHorizontal: 20
  },
  fullscreenBottomControls: { 
    position: 'absolute', 
    bottom: 0, 
    left: 0,
    right: 0,
    paddingBottom: 30,
    paddingHorizontal: 20,
    paddingTop: 50
  },
  fullscreenTimeContainer: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginBottom: 10,
    paddingHorizontal: 5
  },
  fullscreenSeekbarContainer: { 
    height: 30, 
    justifyContent: 'center', 
    width: '100%',
    marginBottom: 20
  },
  fullscreenProgressBackground: { 
    position: 'absolute', 
    height: 6, 
    width: '100%', 
    backgroundColor: 'rgba(255,255,255,0.3)', 
    borderRadius: 3 
  },
  fullscreenProgressBar: {
    position: 'absolute',
    height: 6,
    backgroundColor: '#ff00ff',
    borderRadius: 3,
    shadowColor: '#ff00ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 5
  },
  fullscreenSeekKnob: { 
    position: 'absolute', 
    width: 20, 
    height: 20, 
    borderRadius: 10, 
    backgroundColor: '#ff00ff', 
    marginLeft: -10, 
    borderWidth: 3, 
    borderColor: '#fff', 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.5, 
    shadowRadius: 4,
    zIndex: 2
  },
  fullscreenSeekbarTouchable: {
    position: 'absolute',
    width: '100%',
    height: 30,
    marginBottom: 20 // Increased bottom margin to prevent collision with buttons
  },
  fullscreenSeekbarTouchArea: {
    position: 'absolute',
    width: '100%',
    height: 30,
    backgroundColor: 'transparent',
    zIndex: 1
  },
  fullscreenControlsRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-around', 
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 20 // Add vertical spacing between seekbar and control buttons
  },
  fullscreenControlButton: { 
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 30
  },
  fullscreenPlayPauseButton: { 
    width: 60, 
    height: 60, 
    borderRadius: 30, 
    overflow: 'hidden', 
    justifyContent: 'center', 
    alignItems: 'center',
    marginHorizontal: 20
  },
  fullscreenPlayButtonGradient: { 
    width: '100%',
    height: '100%',
    justifyContent: 'center', 
    alignItems: 'center', 
    borderRadius: 30 
  },
  closeButton: { 
    position: 'absolute', 
    top: 0, 
    right: 0, 
    padding: 15,
    zIndex: 10 
  },
});

export default PostItem;