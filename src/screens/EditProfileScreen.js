import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, Image, Animated, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../config/supabase';
import * as ImagePicker from 'expo-image-picker';
import { Video } from 'expo-av';
import { decode } from 'base64-arraybuffer';

const EditProfileScreen = ({ navigation }) => {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [coverUrl, setCoverUrl] = useState(null);
  const [gender, setGender] = useState('');
  const [showGenderModal, setShowGenderModal] = useState(false);
  const blinkAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (data) {
          setName(data.full_name || '');
          setUsername(data.username || '');
          setBio(data.bio || '');
          setAvatarUrl(data.avatar_url);
          setCoverUrl(data.cover_url);
          setGender(data.gender || '');
          
          // If the cover URL is a video (either by extension or by the cover_is_video flag)
          if ((data.cover_url && data.cover_url.endsWith('.mp4')) || data.cover_is_video) {
            // Ensure the profile has the cover_is_video flag set
            if (!data.cover_is_video) {
              await supabase
                .from('profiles')
                .update({ cover_is_video: true })
                .eq('id', user.id);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const pickImage = async (type) => {
    try {
      // Allow videos only for cover photos, not for avatar
      const mediaTypes = type === 'cover' ? ['images', 'videos'] : ['images'];
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes,
        allowsEditing: true,
        aspect: type === 'avatar' ? [1, 1] : [16, 9],
        quality: 0.5,
        base64: true,
        videoMaxDuration: 30, // Limit video duration to 30 seconds
      });

      if (!result.canceled && result.assets[0]) {
        const file = result.assets[0];
        const isVideo = file.type?.startsWith('video');
        
        if (type === 'avatar' && isVideo) {
          Alert.alert('Error', 'Videos can only be used as cover photos, not as profile pictures');
          return;
        }
        
        // Check if base64 data is available
        if (!file.base64) {
          Alert.alert('Error', 'Could not process the selected file. Please try another one.');
          return;
        }
        
        await uploadImage(file.base64, type, isVideo);
      }
    } catch (error) {
      console.error('Error picking media:', error);
      Alert.alert('Error', 'Failed to pick media');
    }
  };

  const uploadImage = async (base64Image, type, isVideo = false) => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user');

      // Check if base64Image is null or undefined
      if (!base64Image) {
        throw new Error('Invalid image data. Please try again.');
      }

      // Check file size (base64 string length is approximately 4/3 of the file size)
      const fileSizeInMB = (base64Image.length * 0.75) / (1024 * 1024);
      const maxSizeMB = isVideo ? 20 : 5; // 20MB for videos, 5MB for images
      
      if (fileSizeInMB > maxSizeMB) {
        throw new Error(`File size too large. Please select a ${isVideo ? 'video' : 'photo'} under ${maxSizeMB}MB.`);
      }

      // Set appropriate file extension and content type based on media type
      const fileExtension = isVideo ? 'mp4' : 'jpg';
      const contentType = isVideo ? 'video/mp4' : 'image/jpeg';
      const filePath = `${user.id}/${type}_${Date.now()}.${fileExtension}`;
      const body = decode(base64Image);

      // Delete old file if exists
      if (type === 'avatar' && avatarUrl) {
        const oldPath = avatarUrl.split('/').pop();
        await supabase.storage.from('media').remove([`${user.id}/${oldPath}`]);
      } else if (type === 'cover' && coverUrl) {
        const oldPath = coverUrl.split('/').pop();
        await supabase.storage.from('media').remove([`${user.id}/${oldPath}`]);
      }

      // Upload new file
      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(filePath, body, { contentType, upsert: true });

      if (uploadError) throw uploadError;

      // Get the public URL using the correct format
      const { data } = supabase.storage
        .from('media')
        .getPublicUrl(filePath);

      const publicUrl = data.publicUrl;

      if (type === 'avatar') {
        setAvatarUrl(publicUrl);
      } else {
        // For cover, also store whether it's a video
        setCoverUrl(publicUrl);
        // Update the profile with the cover_is_video field
        if (isVideo) {
          const { data: { user: currentUser } } = await supabase.auth.getUser();
          if (currentUser) {
            await supabase
              .from('profiles')
              .update({ cover_is_video: isVideo })
              .eq('id', currentUser.id);
          }
        }
      }

      console.log(`${type} URL:`, publicUrl); // Debug log
    } catch (error) {
      console.error('Upload error:', error); // Debug log
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!name || !username) {
      Alert.alert('Error', 'Name and username are required');
      return;
    }

    // Add username format validation
    if (username.length < 3) {
      Alert.alert('Error', 'Username must be at least 3 characters long');
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      Alert.alert('Error', 'Username can only contain letters, numbers, and underscores');
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Check if username is already taken by another user
      const { data: existingUser, error: checkError } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username.toLowerCase()) // Convert to lowercase for consistency
        .neq('id', user.id)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Error checking username:', checkError);
        Alert.alert('Error', 'Failed to check username availability');
        return;
      }

      if (existingUser) {
        Alert.alert('Error', 'Username is already taken');
        setLoading(false);
        return;
      }

      // Get the current profile to check if cover is video
      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('cover_is_video')
        .eq('id', user.id)
        .single();

      // Update profile with lowercase username
      const { error: updateError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          full_name: name,
          username: username.toLowerCase(), // Store username in lowercase
          bio,
          avatar_url: avatarUrl,
          cover_url: coverUrl,
          gender,
          // Preserve the cover_is_video field if it exists
          cover_is_video: currentProfile?.cover_is_video || false,
        }, { onConflict: 'id' });

      if (updateError) {
        console.error('Error updating profile:', updateError);
        Alert.alert('Error', updateError.message || 'Failed to update profile');
        return;
      }
      
      Alert.alert('Success', 'Profile updated successfully');
      navigation.goBack();
    } catch (error) {
      console.error('Unexpected error:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* Cover Photo */}
      <TouchableOpacity onPress={() => pickImage('cover')} style={styles.coverContainer}>
        {coverUrl ? (
          <View style={styles.coverPhotoContainer}>
            {coverUrl.endsWith('.mp4') ? (
              <Video
                source={{ uri: coverUrl }}
                style={styles.coverPhoto}
                resizeMode="cover"
                shouldPlay
                isLooping
                isMuted={true}
              />
            ) : (
              <Image source={{ uri: coverUrl }} style={styles.coverPhoto} />
            )}
            <View style={styles.coverTypeIndicator}>
              <Ionicons name={coverUrl.endsWith('.mp4') ? "videocam" : "image"} size={20} color="#fff" />
              <Text style={styles.coverTypeText}>{coverUrl.endsWith('.mp4') ? "Video" : "Photo"}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.coverPlaceholder}>
            <Ionicons name="image-outline" size={40} color="#666" />
            <Ionicons name="videocam-outline" size={40} color="#666" style={{ marginLeft: 10 }} />
            <Text style={styles.placeholderText}>Add Cover Photo or Video</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Profile Photo */}
      <TouchableOpacity onPress={() => pickImage('avatar')} style={styles.avatarContainer}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Ionicons name="person-outline" size={40} color="#666" />
          </View>
        )}
        <View style={styles.editIconContainer}>
          <Ionicons name="camera" size={20} color="#fff" />
        </View>
      </TouchableOpacity>

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#ff00ff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <TouchableOpacity onPress={handleSave} disabled={loading}>
          <Text style={[styles.saveButton, loading && styles.saveButtonDisabled]}>
            {loading ? 'Saving...' : 'Save'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.form}>
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Enter your name"
            placeholderTextColor="#666"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Username</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            placeholder="Enter username"
            placeholderTextColor="#666"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Gender (Optional)</Text>
          <TouchableOpacity
            style={styles.input}
            onPress={() => setShowGenderModal(true)}
          >
            <Text style={[styles.genderText, !gender && styles.placeholderText]}>
              {gender ? (
                gender === 'male' ? 'Male' :
                gender === 'female' ? 'Female' :
                gender === 'third' ? 'Third gender{LGBTQ+}' : ''
              ) : 'Select your gender'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Bio</Text>
          <TextInput
            style={[styles.input, styles.bioInput]}
            value={bio}
            onChangeText={setBio}
            placeholder="Write something about yourself"
            placeholderTextColor="#666"
            multiline
            numberOfLines={4}
          />
        </View>

        {/* Gender Selection Modal */}
        <Modal
          visible={showGenderModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowGenderModal(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Select Gender</Text>
              
              <TouchableOpacity 
                style={styles.genderOption}
                onPress={() => {
                  setGender('male');
                  setShowGenderModal(false);
                }}
              >
                <Text style={styles.genderOptionText}>Male</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.genderOption}
                onPress={() => {
                  setGender('female');
                  setShowGenderModal(false);
                }}
              >
                <Text style={styles.genderOptionText}>Female</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.genderOption}
                onPress={() => {
                  setGender('third');
                  setShowGenderModal(false);
                }}
              >
                <Text style={styles.genderOptionText}>Third gender</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.genderOption, styles.clearOption]}
                onPress={() => {
                  setGender('');
                  setShowGenderModal(false);
                }}
              >
                <Text style={[styles.genderOptionText, styles.clearOptionText]}>Clear Selection</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setShowGenderModal(false)}
              >
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  coverPhotoContainer: {
    position: 'relative',
    width: '100%',
    height: '100%',
  },
  coverTypeIndicator: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 15,
    padding: 5,
    flexDirection: 'row',
    alignItems: 'center',
  },
  coverTypeText: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 5,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 15,
    padding: 20,
    width: '80%',
    alignItems: 'center',
  },
  modalTitle: {
    color: '#ff00ff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  genderOption: {
    width: '100%',
    padding: 15,
    borderRadius: 10,
    backgroundColor: '#001453',
    marginBottom: 10,
  },
  genderOptionText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
  },
  clearOption: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#ff00ff',
  },
  clearOptionText: {
    color: '#ff00ff',
  },
  closeButton: {
    marginTop: 10,
    padding: 15,
    width: '100%',
  },
  closeButtonText: {
    color: '#ff00ff',
    textAlign: 'center',
    fontSize: 16,
  },
  genderText: {
    color: 'white',
    fontSize: 16,
  },
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 50,
  },
  headerTitle: {
    color: '#ff00ff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  saveButton: {
    color: '#ff00ff',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  form: {
    padding: 20,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    color: '#ff00ff',
    fontSize: 14,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    padding: 12,
    color: 'white',
    fontSize: 16,
  },
  bioInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  coverContainer: {
    height: 200,
    width: '100%',
    backgroundColor: '#001453',
    marginBottom: -50,
  },
  coverPhoto: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  coverPlaceholder: {
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginLeft: 20,
    elevation: 4,
    position: 'relative',
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#000B2E',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 50,
    backgroundColor: '#001453',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#000B2E',
  },
  editIconContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#0066FF',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000B2E',
  },
  placeholderText: {
    color: '#666',
    marginTop: 8,
  },
});

export default EditProfileScreen;