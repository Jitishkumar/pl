/**
 * OneSignal Helper Utility
 * 
 * This utility provides a consistent interface for OneSignal functionality
 * that gracefully handles environments where the native module isn't available
 * (like Expo Go) while still working in development and production builds.
 */

import { Platform, Alert } from 'react-native';

// Import OneSignal conditionally to handle potential missing native module
let OneSignal;
let LogLevel;

try {
  const OneSignalModule = require('react-native-onesignal');
  OneSignal = OneSignalModule.OneSignal;
  LogLevel = OneSignalModule.LogLevel;
} catch (error) {
  console.log('OneSignal module could not be loaded:', error);
}

// Get this from OneSignal Dashboard → Settings → Keys & IDs
const ONESIGNAL_APP_ID = 'bd411f7d-9897-401c-9e0e-8f979b77fa93';

/**
 * Check if the OneSignal native module is available
 */
export const isOneSignalAvailable = () => {
  return !!OneSignal;
};

/**
 * Initialize OneSignal with proper error handling
 * @returns {Promise<boolean>} Whether initialization was successful
 */
export const initializeOneSignal = async () => {
  // Check if running in Expo Go
  const isExpoGo = process.env.EXPO_RUNTIME_VERSION === undefined;

  if (isExpoGo) {
    console.log('Running in Expo Go - OneSignal initialization skipped');
    if (__DEV__) {
      Alert.alert(
        'Push Notifications Unavailable',
        'Push notifications are not supported in Expo Go. Please use a development build or production build to test push notifications.'
      );
    }
    return false;
  }

  if (!isOneSignalAvailable()) {
    console.log('OneSignal native module not available - skipping initialization');
    return false;
  }

  try {
    // Enable verbose logging for debugging (remove in production)
    if (__DEV__) {
      OneSignal.Debug.setLogLevel(LogLevel.Verbose);
    }
    
    // Initialize OneSignal with your App ID
    await OneSignal.initialize(ONESIGNAL_APP_ID);
    
    // Request permission for push notifications
    await OneSignal.Notifications.requestPermission(false);
    
    console.log('OneSignal initialized successfully');
    return true;
  } catch (error) {
    console.error('Failed to initialize OneSignal:', error);
    
    // Show a user-friendly error message in development
    if (__DEV__) {
      Alert.alert(
        'OneSignal Initialization Failed',
        'Push notifications will not work in Expo Go. Please use a development build or production build to test push notifications.'
      );
    }
    return false;
  }
};

/**
 * Set up notification handlers
 * @param {Object} options Configuration options
 * @param {Function} options.onNotificationReceived Called when notification is received
 * @param {Function} options.onNotificationOpened Called when notification is opened
 * @returns {Function} Cleanup function to remove event listeners
 */
export const setupNotificationHandlers = ({ onNotificationReceived, onNotificationOpened } = {}) => {
  if (!isOneSignalAvailable()) {
    return () => {}; // Return empty cleanup function
  }

  try {
    // Handle notification opened app
    OneSignal.Notifications.addEventListener('click', (event) => {
      console.log('OneSignal: notification opened:', event);
      if (onNotificationOpened) {
        onNotificationOpened(event);
      }
    });

    // Handle notification received while app is running
    OneSignal.Notifications.addEventListener('foregroundWillDisplay', (event) => {
      console.log('OneSignal: notification received:', event);
      if (onNotificationReceived) {
        onNotificationReceived(event);
      }
      // Complete the notification to show it
      event.preventDefault();
      event.notification.display();
    });

    // Return cleanup function
    return () => {
      try {
        OneSignal.Notifications.removeEventListener('click');
        OneSignal.Notifications.removeEventListener('foregroundWillDisplay');
      } catch (error) {
        console.error('Error cleaning up OneSignal:', error);
      }
    };
  } catch (error) {
    console.error('Error setting up OneSignal event listeners:', error);
    return () => {};
  }
};

/**
 * Set the external user ID for OneSignal
 * @param {string} userId The user ID to set
 */
export const setExternalUserId = async (userId) => {
  if (!isOneSignalAvailable() || !userId) {
    return;
  }

  try {
    await OneSignal.login(userId);
    console.log('OneSignal external user ID set:', userId);
  } catch (error) {
    console.error('Error setting OneSignal external user ID:', error);
  }
};

/**
 * Remove the external user ID from OneSignal (logout)
 */
export const removeExternalUserId = async () => {
  if (!isOneSignalAvailable()) {
    return;
  }

  try {
    await OneSignal.logout();
    console.log('OneSignal external user ID removed');
  } catch (error) {
    console.error('Error removing OneSignal external user ID:', error);
  }
};

// Export OneSignal and LogLevel for direct access if needed
export { OneSignal, LogLevel };