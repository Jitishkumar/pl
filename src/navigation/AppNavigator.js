import React from 'react';
import { View, Platform } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import HomeScreen from '../screens/HomeScreen';
import LoginScreen from '../screens/LoginScreen';
import SignupScreen from '../screens/SignupScreen';
import ProfileScreen from '../screens/ProfileScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import MessagesScreen from '../screens/MessagesScreen';
import MessageScreen from '../screens/MessageScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import SearchScreen from '../screens/SearchScreen';
import UserProfileScreen from '../screens/UserProfileScreen';
import PrivateProfileScreen from '../screens/PrivateProfileScreen';
import StoriesScreen from '../screens/StoriesScreen';
import AddAccountScreen from '../screens/AddAccountScreen';
import ConfessionScreen from '../screens/ConfessionScreen';
import CreatePostScreen from '../screens/CreatePostScreen';
import TrendingScreen from '../screens/TrendingScreen';
import CommentScreen from '../screens/CommentScreen';
import PostViewerScreen from '../screens/PostViewerScreen';
import SettingsScreen from '../screens/SettingsScreen';
import PostsScreen from '../screens/PostsScreen';
import ShortsScreen from '../screens/ShortsScreen';
import HomePage from '../screens/HomePage';
import CallPage from '../screens/CallPage';
const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const TabNavigator = () => {
  const insets = useSafeAreaInsets();
  
  return (
  <Tab.Navigator
    screenOptions={{
      headerShown: false,
      tabBarStyle: {
        backgroundColor: '#000033',
        borderTopWidth: 0,
        height: 60 + (insets.bottom > 0 ? insets.bottom : 10),
        paddingBottom: insets.bottom > 0 ? insets.bottom : 5,
        position: 'absolute',
        elevation: 0,
        borderTopLeftRadius: 15,
        borderTopRightRadius: 15,
      },
      tabBarActiveTintColor: '#3399ff',
      tabBarInactiveTintColor: '#666666',
      tabBarHideOnKeyboard: true,
      tabBarLabelStyle: {
        paddingBottom: Platform.OS === 'ios' ? 0 : 5,
      },
    }}
  >
    <Tab.Screen 
      name="Home" 
      component={HomeScreen}
      options={{
        tabBarIcon: ({ color }) => (
          <Ionicons name="home-outline" size={24} color={color} />
        ),
      }}
    />
    <Tab.Screen 
      name="Messages" 
      component={MessagesScreen}
      options={{
        tabBarIcon: ({ color }) => (
          <Ionicons name="chatbubble-outline" size={24} color={color} />
        ),
      }}
    />
    <Tab.Screen 
      name="Notifications" 
      component={NotificationsScreen}
      options={{
        tabBarIcon: ({ color }) => (
          <Ionicons name="notifications-outline" size={24} color={color} />
        ),
      }}
    />
    <Tab.Screen 
      name="Profile" 
      component={ProfileScreen}
      options={{
        tabBarIcon: ({ color }) => (
          <Ionicons name="person-outline" size={24} color={color} />
        ),
      }}
    />
  </Tab.Navigator>
  );
};

export const AppNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
      <Stack.Screen name="PostViewer" component={PostViewerScreen} options={{ headerShown: false }} />
      <Stack.Screen name="MainApp" component={TabNavigator} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="Search" component={SearchScreen} />
      <Stack.Screen name="Confession" component={ConfessionScreen} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} />
      <Stack.Screen name="PrivateProfile" component={PrivateProfileScreen} />
      <Stack.Screen name="MessageScreen" component={MessageScreen} />
      <Stack.Screen name="Stories" component={StoriesScreen} options={{ headerShown: false }} />
      <Stack.Screen name="AddAccount" component={AddAccountScreen} options={{ headerShown: false }} />
      <Stack.Screen name="CreatePost" component={CreatePostScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Trending" component={TrendingScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Comment" component={CommentScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Posts" component={PostsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Shorts" component={ShortsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="HomePage" component={HomePage} />
      <Stack.Screen name="CallPage" component={CallPage} />
    </Stack.Navigator>
  );
};