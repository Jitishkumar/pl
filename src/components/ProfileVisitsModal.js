import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../config/supabase';
import { LinearGradient } from 'expo-linear-gradient';

const ProfileVisitsModal = ({ visible, onClose }) => {
  const [visitors, setVisitors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (visible) {
      fetchVisitors();
    }
  }, [visible]);

  const fetchVisitors = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get current date for the query
      const now = new Date();
      
      // Fetch visitors and their visit counts for the current month
      const { data, error } = await supabase
        .rpc('get_monthly_visit_counts', {
          target_profile_id: user.id,
          current_month: now.toISOString().split('T')[0]
        });

      if (error) throw error;

      // Fetch visitor profiles
      const visitorIds = data.map(v => v.visitor_id);
      const { data: visitorProfiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url')
        .in('id', visitorIds);

      if (profileError) throw profileError;

      if (error) throw error;

      // Process visitor profiles to fix avatar URLs
      const processedProfiles = visitorProfiles.map(profile => {
        let avatarUrl = null;
        if (profile.avatar_url) {
          let avatarPath = profile.avatar_url;
          if (avatarPath.includes('media/media/')) {
            const parts = avatarPath.split('media/');
            avatarPath = parts[parts.length - 1];
          } else if (avatarPath.includes('media/')) {
            avatarPath = avatarPath.split('media/').pop();
          }
          avatarUrl = `https://lckhaysswueoyinhfzyz.supabase.co/storage/v1/object/public/media/${avatarPath}`;
        }
        return { ...profile, avatar_url: avatarUrl };
      });

      // Combine visit counts with visitor profiles
      const processedVisitors = data
        .map(visit => ({
          visitor: processedProfiles.find(profile => profile.id === visit.visitor_id),
          visit_count: Number(visit.visit_count)
        }))
        .filter(visit => visit.visitor) // Remove any visits where profile couldn't be found
        .slice(0, 5); // Get top 5 visitors

      setVisitors(processedVisitors);
    } catch (error) {
      console.error('Error fetching visitors:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <LinearGradient
          colors={['#330033', '#660066']}
          style={styles.modalContent}
        >
          <View style={styles.header}>
            <Text style={styles.modalTitle}>Profile Visits</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#ff00ff" />
            </TouchableOpacity>
          </View>

          {loading ? (
            <Text style={styles.loadingText}>Loading visitors...</Text>
          ) : visitors.length > 0 ? (
            visitors.map((visit, index) => (
              <View key={visit.visitor.id} style={styles.visitorItem}>
                <Image
                  source={{ uri: visit.visitor.avatar_url || 'https://via.placeholder.com/150' }}
                  style={styles.visitorAvatar}
                />
                <View style={styles.visitorInfo}>
                  <Text style={styles.visitorName}>{visit.visitor.full_name}</Text>
                  <Text style={styles.visitorUsername}>@{visit.visitor.username}</Text>
                </View>
                <View style={styles.visitCount}>
                  <Text style={styles.visitCountText}>{visit.visit_count}</Text>
                  <Text style={styles.visitCountLabel}>visits</Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.noVisitorsText}>No profile visits this month</Text>
          )}
        </LinearGradient>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingTop: 30,
    minHeight: '50%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
    textShadowColor: 'rgba(255, 0, 255, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  closeButton: {
    padding: 5,
  },
  loadingText: {
    color: '#ffffff',
    textAlign: 'center',
    marginTop: 20,
  },
  visitorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    backgroundColor: 'rgba(255, 0, 255, 0.1)',
  },
  visitorAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#ff00ff',
  },
  visitorInfo: {
    flex: 1,
    marginLeft: 15,
  },
  visitorName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  visitorUsername: {
    color: '#ff00ff',
    fontSize: 14,
  },
  visitCount: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 0, 255, 0.2)',
    padding: 8,
    borderRadius: 15,
  },
  visitCountText: {
    color: '#ff00ff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  visitCountLabel: {
    color: '#ffffff',
    fontSize: 12,
  },
  noVisitorsText: {
    color: '#ffffff',
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
  },
});

export default ProfileVisitsModal;