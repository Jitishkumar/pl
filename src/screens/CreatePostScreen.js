import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Video } from 'expo-av';
import { useNavigation } from '@react-navigation/native';
import { PostsService } from '../services/PostsService';
import { supabase } from '../config/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const CreatePostScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [uploading, setUploading] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [postText, setPostText] = useState('');

  const handleMediaPicker = async () => {
    try {
      // Check user authentication first
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'Please login to create a post');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: true,
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const uri = result.assets[0].uri;
        if (!uri) {
          Alert.alert('Error', 'Failed to get image/video');
          return;
        }
        const type = uri.endsWith('.mp4') ? 'video' : 'image';
        setSelectedMedia({ uri, type });
      }
    } catch (error) {
      console.error('Error selecting media:', error);
      Alert.alert('Error', error.message || 'Failed to select media');
    }
  };

  const handleCreatePost = async () => {
    if (!selectedMedia && !postText.trim()) {
      Alert.alert('Error', 'Please add some text or media to your post');
      return;
    }

    try {
      setUploading(true);
      let updatedPosts;
      if (selectedMedia) {
        await PostsService.createPost(selectedMedia.uri, postText.trim(), selectedMedia.type);
      } else {
        await PostsService.createPost('', postText.trim(), 'text');
      }
      // Refresh posts in HomeScreen
      updatedPosts = await PostsService.getAllPosts();
      navigation.navigate('MainApp', {
        screen: 'Home',
        params: { refresh: true, updatedPosts: updatedPosts }
      });
      Alert.alert('Success', 'Post created successfully');
    } catch (error) {
      console.error('Error creating post:', error);
      Alert.alert('Error', 'Failed to create post');
    } finally {
      setUploading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={[styles.header, { paddingTop: insets.top > 0 ? insets.top : 15 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.postButton, (!selectedMedia && !postText.trim()) && styles.disabledButton]}
          onPress={handleCreatePost}
          disabled={!selectedMedia && !postText.trim() || uploading}
        >
          {uploading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.postButtonText}>Post</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="What's happening?"
            placeholderTextColor="#666"
            multiline
            value={postText}
            onChangeText={setPostText}
            color="#ffffff"
          />
        </View>

        {selectedMedia && (
          <View style={styles.mediaPreview}>
            {selectedMedia.type === 'video' ? (
              <Video
                source={{ uri: selectedMedia.uri }}
                style={styles.previewMedia}
                resizeMode="cover"
                shouldPlay={false}
                useNativeControls
              />
            ) : (
              <Image
                source={{ uri: selectedMedia.uri }}
                style={styles.previewMedia}
                resizeMode="cover"
              />
            )}
            <TouchableOpacity 
              style={styles.removeMediaButton}
              onPress={() => setSelectedMedia(null)}
            >
              <Ionicons name="close-circle" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom > 0 ? insets.bottom : 15 }]}>
        <TouchableOpacity 
          style={styles.mediaButton}
          onPress={handleMediaPicker}
        >
          <Ionicons name="images" size={24} color="#ff00ff" />
          <Text style={styles.mediaButtonText}>Gallery</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  postButton: {
    backgroundColor: '#ff00ff',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  disabledButton: {
    backgroundColor: '#666',
  },
  postButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  inputContainer: {
    padding: 15,
  },
  input: {
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
    color: '#fff',
  },
  mediaPreview: {
    margin: 15,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1a1a3a',
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255, 0, 255, 0.2)',
    shadowColor: '#6600cc',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  previewMedia: {
    width: '100%',
    height: 300,
  },
  removeMediaButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 15,
  },
  footer: {
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  mediaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  mediaButtonText: {
    color: '#ff00ff',
    fontSize: 16,
  },
});

export default CreatePostScreen;