import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../config/supabase';
import { useNavigation } from '@react-navigation/native';
import { Alert } from 'react-native';

const AccountSwitcher = ({ isVisible, onClose }) => {
  const [accounts, setAccounts] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const navigation = useNavigation();

  useEffect(() => {
    if (isVisible) {
      loadAccounts();
    }
  }, [isVisible]);

  // Function to clear current user's account data
  const clearCurrentUserData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const savedAccounts = await AsyncStorage.getItem('savedAccounts');
        if (savedAccounts) {
          const parsedAccounts = JSON.parse(savedAccounts);
          const updatedAccounts = parsedAccounts.filter(
            account => account.email !== user.email
          );
          await AsyncStorage.setItem('savedAccounts', JSON.stringify(updatedAccounts));
          setAccounts(updatedAccounts);
        }
      }
    } catch (error) {
      console.error('Error clearing user data:', error);
    }
  };

  const loadAccounts = async () => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);

      // Get saved accounts
      const savedAccounts = await AsyncStorage.getItem('savedAccounts');
      if (savedAccounts) {
        const parsedAccounts = JSON.parse(savedAccounts);
        // Filter out duplicates and current account
        const uniqueAccounts = parsedAccounts.filter(
          (account, index, self) =>
            account.email !== user?.email && // Remove current user
            index === self.findIndex((a) => a.email === account.email) // Remove duplicates
        );
        setAccounts(uniqueAccounts);
      }
    } catch (error) {
      console.error('Error loading accounts:', error);
    }
  };

  const switchAccount = async (account) => {
    try {
      // Get current user before signing out
      const { data: { user } } = await supabase.auth.getUser();
      
      // Sign out current user
      await supabase.auth.signOut();
      
      // Remove current account from saved accounts
      const savedAccounts = await AsyncStorage.getItem('savedAccounts');
      if (savedAccounts) {
        const parsedAccounts = JSON.parse(savedAccounts);
        const updatedAccounts = parsedAccounts.filter(
          acc => acc.email !== user.email
        );
        await AsyncStorage.setItem('savedAccounts', JSON.stringify(updatedAccounts));
      }
      
      onClose();
      // Navigate to login with the selected account's email
      navigation.replace('Login', { 
        prefilledEmail: account.email,
        isAccountSwitch: true 
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to switch account');
    }
  };

  const removeAccount = async (accountToRemove) => {
    try {
      // Get saved accounts
      const savedAccounts = await AsyncStorage.getItem('savedAccounts');
      if (savedAccounts) {
        const parsedAccounts = JSON.parse(savedAccounts);
        // Filter out the account to remove
        const updatedAccounts = parsedAccounts.filter(
          account => account.email !== accountToRemove.email
        );
        // Save updated accounts list
        await AsyncStorage.setItem('savedAccounts', JSON.stringify(updatedAccounts));
        // Refresh the accounts list
        loadAccounts();
      }
    } catch (error) {
      console.error('Error removing account:', error);
      Alert.alert('Error', 'Failed to remove account');
    }
  };

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Switch Account</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#ff00ff" />
            </TouchableOpacity>
          </View>

          <FlatList
            data={accounts}
            keyExtractor={(item) => item.userId}
            renderItem={({ item }) => (
              <View style={styles.accountItemContainer}>
                <TouchableOpacity 
                  style={styles.accountItem}
                  onPress={() => switchAccount(item)}
                >
                  <Ionicons name="person-circle-outline" size={40} color="#ff00ff" />
                  <Text style={styles.accountEmail}>{item.email}</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.removeButton}
                  onPress={() => {
                    Alert.alert(
                      'Remove Account',
                      'Are you sure you want to remove this account? You will need to log in again to use it.',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { 
                          text: 'Remove', 
                          style: 'destructive',
                          onPress: () => removeAccount(item)
                        }
                      ]
                    );
                  }}
                >
                  <Ionicons name="close-circle" size={24} color="#ff3b30" />
                </TouchableOpacity>
              </View>
            )}
          />

          <TouchableOpacity 
            style={styles.addAccountButton}
            onPress={() => {
              onClose();
              navigation.navigate('Login');
            }}
          >
            <Ionicons name="add-circle-outline" size={24} color="#ff00ff" />
            <Text style={styles.addAccountText}>Add Account</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
  },
  content: {
    backgroundColor: '#000033',
    margin: 20,
    borderRadius: 15,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    color: '#ff00ff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  accountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  accountEmail: {
    color: 'white',
    marginLeft: 15,
    fontSize: 16,
  },
  addAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
  },
  addAccountText: {
    color: '#ff00ff',
    marginLeft: 10,
    fontSize: 16,
  },
});

export default AccountSwitcher;