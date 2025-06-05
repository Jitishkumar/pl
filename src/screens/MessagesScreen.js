import React from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const MessagesScreen = () => {
  const insets = useSafeAreaInsets();
  
  const messages = [
    {
      id: 1,
      name: 'Joanna Evans',
      message: 'See you on the next meeting! 😂',
      time: '34 min',
      unread: 3,
      avatar: 'https://via.placeholder.com/50',
      online: true
    },
    {
      id: 2,
      name: 'Lana Smith',
      message: "I'm doing my homework, but need to take ...",
      time: '1h',
      unread: 1,
      avatar: 'https://via.placeholder.com/50',
      online: false
    },
    {
      id: 3,
      name: 'Marina Martinez',
      message: "I'm watching Friends, what are u doin? 🤔",
      time: '1 hour',
      unread: 1,
      avatar: 'https://via.placeholder.com/50',
      online: true
    },
    // Add more message items as needed
  ];

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top > 0 ? insets.top : 50 }]}>
        <TouchableOpacity>
          <Ionicons name="chevron-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Messages</Text>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search"
          placeholderTextColor="#666"
        />
        <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
      </View>

      <ScrollView 
        style={styles.messagesList}
        contentContainerStyle={{ paddingBottom: insets.bottom }}
      >
        {messages.map((message) => (
          <TouchableOpacity key={message.id} style={styles.messageItem}>
            <View style={styles.avatarContainer}>
              <Image source={{ uri: message.avatar }} style={styles.avatar} />
              {message.online && <View style={styles.onlineIndicator} />}
            </View>
            <View style={styles.messageContent}>
              <View style={styles.messageHeader}>
                <Text style={styles.name}>{message.name}</Text>
                <Text style={styles.time}>{message.time}</Text>
              </View>
              <View style={styles.messageFooter}>
                <Text style={styles.messageText} numberOfLines={1}>
                  {message.message}
                </Text>
                {message.unread > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadText}>{message.unread}</Text>
                  </View>
                )}
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginLeft: 15,
  },
  searchContainer: {
    margin: 15,
    position: 'relative',
  },
  searchInput: {
    backgroundColor: '#1a1a1a',
    borderRadius: 25,
    padding: 12,
    paddingLeft: 40,
    color: 'white',
  },
  searchIcon: {
    position: 'absolute',
    left: 15,
    top: 12,
  },
  messagesList: {
    flex: 1,
  },
  messageItem: {
    flexDirection: 'row',
    padding: 15,
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  onlineIndicator: {
    width: 12,
    height: 12,
    backgroundColor: '#4CAF50',
    borderRadius: 6,
    position: 'absolute',
    bottom: 0,
    right: 0,
    borderWidth: 2,
    borderColor: '#000033',
  },
  messageContent: {
    flex: 1,
    marginLeft: 15,
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  time: {
    color: '#666',
    fontSize: 12,
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 5,
  },
  messageText: {
    color: '#999',
    flex: 1,
  },
  unreadBadge: {
    backgroundColor: '#1DA1F2',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  unreadText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
});

export default MessagesScreen;