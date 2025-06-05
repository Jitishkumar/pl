import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { AppNavigator } from './src/navigation/AppNavigator';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { VideoProvider } from './src/context/VideoContext';
import { AccountProvider } from './src/context/AccountContext';

export default function App() {
  return (
    <SafeAreaProvider>
      <AccountProvider>
        <VideoProvider>
          <NavigationContainer>
            <AppNavigator />
            <StatusBar style="light" />
          </NavigationContainer>
        </VideoProvider>
      </AccountProvider>
    </SafeAreaProvider>
  );
}