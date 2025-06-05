import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../config/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const NotificationsScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  // Sample notifications data
  const sampleNotifications = [
    {
      id: '1',
      type: 'like',
      content: 'liked your post',
      sender: {
        username: 'johndoe',
        avatar_url: 'https://via.placeholder.com/50',
      },
      created_at: '2023-05-15T10:30:00Z',
      is_read: false,
    },
    {
      id: '2',
      type: 'comment',
      content: 'commented on your post: "Great content!"',
      sender: {
        username: 'janedoe',
        avatar_url: 'https://via.placeholder.com/50',
      },
      created_at: '2023-05-14T15:45:00Z',
      is_read: true,
    },
    {
      id: '3',
      type: 'follow',
      content: 'started following you',
      sender: {
        username: 'marksmith',
        avatar_url: 'https://via.placeholder.com/50',
      },
      created_at: '2023-05-13T09:20:00Z',
      is_read: false,
    },
    {
      id: '4',
      type: 'mention',
      content: 'mentioned you in a comment: "@username check this out"',
      sender: {
        username: 'sarahconnor',
        avatar_url: 'https://via.placeholder.com/50',
      },
      created_at: '2023-05-12T18:10:00Z',
      is_read: true,
    },
    {
      id: '5',
      type: 'like',
      content: 'liked your comment',
      sender: {
        username: 'alexjones',
        avatar_url: 'https://via.placeholder.com/50',
      },
      created_at: '2023-05-11T14:30:00Z',
      is_read: true,
    },
  ];

  useEffect(() => {
    // In a real app, you would fetch notifications from the database
    // For now, we'll use the sample data
    setNotifications(sampleNotifications);
    setLoading(false);
  }, []);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { data, error } = await supabase
          .from('notifications')
          .select(`
            *,
            sender:sender_id(id, username, avatar_url)
          `)
          .eq('recipient_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setNotifications(data || []);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (error) throw error;
      
      // Update local state
      setNotifications(notifications.map(notification => 
        notification.id === notificationId 
          ? { ...notification, is_read: true } 
          : notification
      ));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) {
      return `${diffInSeconds}s ago`;
    }
    
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    }
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    }
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) {
      return `${diffInDays}d ago`;
    }
    
    return date.toLocaleDateString();
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'like':
        return <Ionicons name="heart" size={20} color="#ff00ff" />;
      case 'comment':
        return <Ionicons name="chatbubble" size={20} color="#0084ff" />;
      case 'follow':
        return <Ionicons name="person-add" size={20} color="#00cc99" />;
      case 'mention':
        return <Ionicons name="at" size={20} color="#ffcc00" />;
      default:
        return <Ionicons name="notifications" size={20} color="#999" />;
    }
  };

  const renderNotificationItem = ({ item }) => (
    <TouchableOpacity 
      style={[styles.notificationItem, !item.is_read && styles.unreadItem]}
      onPress={() => markAsRead(item.id)}
    >
      <View style={styles.avatarContainer}>
        <Image 
          source={{ uri: item.sender.avatar_url }}
          style={styles.avatar}
        />
        <View style={styles.iconOverlay}>
          {getNotificationIcon(item.type)}
        </View>
      </View>
      
      <View style={styles.contentContainer}>
        <Text style={styles.username}>@{item.sender.username}</Text>
        <Text style={styles.content}>{item.content}</Text>
        <Text style={styles.timestamp}>{formatTimeAgo(item.created_at)}</Text>
      </View>
      
      {!item.is_read && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={['#050505', '#050505']}
        style={[styles.header, { paddingTop: insets.top > 0 ? insets.top : 50 }]}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#ff00ff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
      </LinearGradient>

      <FlatList
        data={notifications}
        renderItem={renderNotificationItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom }]}
        refreshing={loading}
        onRefresh={fetchNotifications}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="notifications-off-outline" size={60} color="#666" />
            <Text style={styles.emptyText}>No notifications yet</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000033',
  },
  header: {
    paddingBottom: 15,
    paddingHorizontal: 15,
  },
  backButton: {
    marginBottom: 10,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  listContent: {
    padding: 15,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0a0a2a',
    borderRadius: 12,
    marginBottom: 10,
    padding: 15,
    position: 'relative',
  },
  unreadItem: {
    backgroundColor: 'rgba(255, 0, 255, 0.1)',
    borderLeftWidth: 3,
    borderLeftColor: '#ff00ff',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 15,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#1a1a3a',
  },
  iconOverlay: {
    position: 'absolute',
    bottom: -5,
    right: -5,
    backgroundColor: '#0a0a2a',
    borderRadius: 12,
    padding: 3,
    borderWidth: 2,
    borderColor: '#1a1a3a',
  },
  contentContainer: {
    flex: 1,
  },
  username: {
    color: '#ff00ff',
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 4,
  },
  content: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 4,
  },
  timestamp: {
    color: '#999',
    fontSize: 12,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ff00ff',
    position: 'absolute',
    top: 15,
    right: 15,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    marginTop: 40,
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
    marginTop: 10,
  },
});

export default NotificationsScreen;