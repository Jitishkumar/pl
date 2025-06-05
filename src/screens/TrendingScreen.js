import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TrendingScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  // Mock data for trending topics
  const trendingTopics = [
    { id: '1', name: 'NFL Draft' },
    { id: '2', name: 'Celtics' },
    { id: '3', name: 'Horror Novels' },
    { id: '4', name: 'Luka and LeBron' },
    { id: '5', name: 'Capitol Protest' },
  ];

  // Mock data for trending videos
  const trendingVideos = [
    { id: '1', thumbnail: 'https://via.placeholder.com/300x200', likes: '27.4K' },
    { id: '2', thumbnail: 'https://via.placeholder.com/300x200', likes: '9.4K' },
    { id: '3', thumbnail: 'https://via.placeholder.com/300x200', likes: '25.2K' },
    { id: '4', thumbnail: 'https://via.placeholder.com/300x200', likes: '18.7K' },
  ];

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
        <Text style={styles.headerTitle}>Search</Text>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
          <Text style={styles.searchPlaceholder}>Search for posts, users or feeds</Text>
        </View>
      </LinearGradient>

      <ScrollView 
        style={styles.content}
        contentContainerStyle={{ paddingBottom: insets.bottom }}
      >
        {/* Trending Section */}
        <View style={styles.trendingSection}>
          <View style={styles.trendingHeader}>
            <Ionicons name="trending-up" size={24} color="#0084ff" style={styles.trendingIcon} />
            <Text style={styles.trendingTitle}>Trending</Text>
            <View style={styles.betaTag}>
              <Text style={styles.betaText}>BETA</Text>
            </View>
            <TouchableOpacity style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          <Text style={styles.trendingSubtitle}>What people are posting about.</Text>

          {/* Trending Topics */}
          <View style={styles.topicsContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {trendingTopics.map((topic) => (
                <TouchableOpacity key={topic.id} style={styles.topicPill}>
                  <Text style={styles.topicText}>{topic.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>

        {/* Trending Videos Section */}
        <View style={styles.trendingVideosSection}>
          <View style={styles.trendingHeader}>
            <Ionicons name="trending-up" size={24} color="#0084ff" style={styles.trendingIcon} />
            <Text style={styles.trendingTitle}>Trending Videos</Text>
            <View style={styles.betaTag}>
              <Text style={styles.betaText}>BETA</Text>
            </View>
          </View>
          <Text style={styles.trendingSubtitle}>Popular videos in your network.</Text>

          {/* Video Grid */}
          <FlatList
            data={trendingVideos}
            numColumns={2}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <View style={styles.videoCard}>
                <Image source={{ uri: item.thumbnail }} style={styles.videoThumbnail} />
                <View style={styles.likesContainer}>
                  <Ionicons name="heart" size={16} color="#fff" />
                  <Text style={styles.likesCount}>{item.likes}</Text>
                </View>
              </View>
            )}
          />
        </View>

        {/* Recommended Section */}
        <View style={styles.recommendedSection}>
          <View style={styles.recommendedHeader}>
            <Ionicons name="hash" size={24} color="#0084ff" />
            <Text style={styles.recommendedTitle}>Recommended</Text>
          </View>
        </View>
      </ScrollView>
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchPlaceholder: {
    color: '#666',
    fontSize: 16,
  },
  content: {
    flex: 1,
  },
  trendingSection: {
    padding: 15,
  },
  trendingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  trendingIcon: {
    marginRight: 10,
  },
  trendingTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
  },
  betaTag: {
    backgroundColor: '#0084ff',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 10,
  },
  betaText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  closeButton: {
    marginLeft: 'auto',
  },
  trendingSubtitle: {
    color: '#aaa',
    fontSize: 16,
    marginBottom: 15,
  },
  topicsContainer: {
    marginBottom: 20,
  },
  topicPill: {
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginRight: 10,
  },
  topicText: {
    color: '#fff',
    fontSize: 14,
  },
  trendingVideosSection: {
    padding: 15,
  },
  videoCard: {
    flex: 1,
    margin: 5,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  videoThumbnail: {
    width: '100%',
    height: 150,
  },
  likesContainer: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 15,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  likesCount: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 5,
  },
  recommendedSection: {
    padding: 15,
  },
  recommendedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recommendedTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    marginLeft: 10,
  },
});

export default TrendingScreen;