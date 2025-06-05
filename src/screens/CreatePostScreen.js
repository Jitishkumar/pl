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
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [postText, setPostText] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleMediaPicker = async () => {
    try {
      // Reset any previous error messages
      setErrorMessage('');
      
      // Check user authentication first
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'Please login to create a post');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: false, // Allow selecting whole photo
        quality: 0.8, // Slightly reduced quality for better upload performance
        presentationStyle: 'pageSheet',
        exif: false // Don't need EXIF data, reduces file size
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const uri = result.assets[0].uri;
        if (!uri) {
          Alert.alert('Error', 'Failed to get image/video');
          return;
        }
        const type = uri.endsWith('.mp4') ? 'video' : 'image';
        setSelectedMedia({ uri, type });
        console.log(`Selected ${type} with URI: ${uri}`);
      }
    } catch (error) {
      console.error('Error selecting media:', error);
      setErrorMessage('Failed to select media: ' + (error.message || 'Unknown error'));
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
      setUploadProgress(0);
      setErrorMessage('');
      
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          const newProgress = prev + (Math.random() * 0.1);
          return newProgress > 0.9 ? 0.9 : newProgress; // Cap at 90% until complete
        });
      }, 500);
      
      let updatedPosts;
      if (selectedMedia) {
        console.log(`Starting upload of ${selectedMedia.type}...`);
        await PostsService.createPost(selectedMedia.uri, postText.trim(), selectedMedia.type);
      } else {
        console.log('Creating text-only post...');
        await PostsService.createPost('', postText.trim(), 'text');
      }
      
      clearInterval(progressInterval);
      setUploadProgress(1); // Complete the progress
      
      // Refresh posts in HomeScreen
      console.log('Post created, refreshing feed...');
      updatedPosts = await PostsService.getAllPosts();
      
      navigation.navigate('MainApp', {
        screen: 'Home',
        params: { refresh: true, updatedPosts: updatedPosts }
      });
      
      Alert.alert('Success', 'Post created successfully');
    } catch (error) {
      console.error('Error creating post:', error);
      setErrorMessage(error.message || 'Failed to create post');
      
      // Show a more detailed error message with retry option
      Alert.alert(
        'Upload Failed', 
        `${error.message || 'Failed to create post'}\n\nWould you like to try again?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Retry', 
            onPress: () => {
              // Small delay before retrying
              setTimeout(() => handleCreatePost(), 500);
            }
          }
        ]
      );
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const renderUploadProgress = () => {
    if (!uploading) return null;
    
    return (
      <View style={styles.progressContainer}>
        <View style={styles.progressBarContainer}>
          <View style={[styles.progressBar, { width: `${uploadProgress * 100}%` }]} />
        </View>
        <Text style={styles.progressText}>
          {uploadProgress < 1 ? 'Uploading...' : 'Processing...'}
        </Text>
      </View>
    );
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

      {renderUploadProgress()}
      
      {errorMessage ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : null}

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
            editable={!uploading}
          />
        </View>

        {selectedMedia && (
          <View style={styles.mediaPreview}>
            {selectedMedia.type === 'video' ? (
              <Video
                source={{ uri: selectedMedia.uri }}
                style={styles.previewMedia}
                resizeMode="contain"
                shouldPlay={false}
                useNativeControls
              />
            ) : (
              <Image
                source={{ uri: selectedMedia.uri }}
                style={styles.previewMedia}
                resizeMode="contain"
              />
            )}
            <TouchableOpacity 
              style={styles.removeMediaButton}
              onPress={() => setSelectedMedia(null)}
              disabled={uploading}
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
          disabled={uploading}
        >
          <Ionicons name="images" size={24} color={uploading ? "#666" : "#ff00ff"} />
          <Text style={[styles.mediaButtonText, uploading && styles.disabledText]}>Gallery</Text>
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
    minHeight: 200,
    maxHeight: 400,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewMedia: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
  removeMediaButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 15,
    padding: 5,
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
  disabledText: {
    color: '#666',
  },
  progressContainer: {
    padding: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: '#333',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#ff00ff',
  },
  progressText: {
    color: '#fff',
    fontSize: 12,
    marginTop: 5,
    textAlign: 'center',
  },
  errorContainer: {
    backgroundColor: 'rgba(255, 0, 0, 0.1)',
    padding: 10,
    borderRadius: 5,
    margin: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#ff0000',
  },
  errorText: {
    color: '#ff6666',
    fontSize: 14,
  },
});

export default CreatePostScreen;