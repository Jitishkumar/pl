import React, { useRef, useEffect, useCallback, useState } from 'react';
import { View, FlatList, Dimensions, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import PostItem from '../components/PostItem';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVideo } from '../context/VideoContext';

const { width: windowWidth } = Dimensions.get('window');

const viewabilityConfig = {
  itemVisiblePercentThreshold: 50,
  minimumViewTime: 300,
};

const PostViewerScreen = ({ route }) => {
  const { posts, initialIndex } = route.params;
  const navigation = useNavigation();
  const flatListRef = useRef(null);
  const hasScrolledToIndex = useRef(false);
  const [viewableItems, setViewableItems] = useState([]);
  const insets = useSafeAreaInsets();
  const { setActiveVideo, clearActiveVideo } = useVideo();

  // Scroll to the initial index when the screen loads
  useEffect(() => {
    if (flatListRef.current && initialIndex >= 0 && !hasScrolledToIndex.current) {
      hasScrolledToIndex.current = true;
      const timer = setTimeout(() => {
        flatListRef.current.scrollToIndex({
          index: initialIndex,
          animated: false,
          viewPosition: 0, // Ensure the post is at the top of the screen
        });
      }, 1000); // Increased delay to ensure rendering

      return () => clearTimeout(timer);
    }
  }, [initialIndex]);

  const renderItem = useCallback(({ item }) => {
    return (
      <View style={styles.postContainer}>
        <PostItem post={item} />
      </View>
    );
  }, []);
  
  // Handle viewable items changed to manage video playback
  const onViewableItemsChanged = useCallback(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      // The first viewable item is the one we want to play
      const viewablePost = viewableItems[0].item;
      
      // If it's a video post, set it as the active video in the context
      if (viewablePost.type === 'video' || viewablePost.mediaType === 'video') {
        setActiveVideo(viewablePost.id);
      } else {
        clearActiveVideo();
      }
    }
  }, [setActiveVideo, clearActiveVideo]);

  const onScrollToIndexFailed = (info) => {
    console.log('Scroll to index failed:', info);
    const wait = new Promise(resolve => setTimeout(resolve, 1000));
    wait.then(() => {
      flatListRef.current?.scrollToIndex({
        index: info.index,
        animated: false,
        viewPosition: 0,
      });
    });
  };

  return (
    <View style={styles.container}>
      {/* Back Button */}
      <Ionicons
        name="arrow-back"
        size={30}
        color="#fff"
        style={[styles.backButton, { top: insets.top > 0 ? insets.top + 10 : Platform.OS === 'ios' ? 40 : 20 }]}
        onPress={() => navigation.goBack()}
      />
      {/* FlatList for Posts */}
      <FlatList
        ref={flatListRef}
        data={posts}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        windowSize={5}
        maxToRenderPerBatch={3}
        initialNumToRender={Math.max(initialIndex + 1, 3)} // Ensure enough items are rendered to reach initialIndex
        onScrollToIndexFailed={onScrollToIndexFailed}
        contentContainerStyle={[styles.listContent, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  backButton: {
    position: 'absolute',
    left: 20,
    zIndex: 10,
  },
  postContainer: {
    width: windowWidth,
    backgroundColor: '#000',
  },
  listContent: {
    paddingBottom: 20,
  },
});

export default PostViewerScreen;