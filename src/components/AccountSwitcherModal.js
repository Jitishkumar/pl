import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Image, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../config/supabase';
import { useNavigation } from '@react-navigation/native';

const AccountSwitcherModal = ({ visible, onClose, loadUserProfile }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [refreshedAccounts, setRefreshedAccounts] = useState([]);
  const navigation = useNavigation();

  useEffect(() => {
    if (visible) {
      getCurrentUser();
      refreshAccountData();
    }
  }, [visible]);

  const getCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUser(user.id);
      }
    } catch (error) {
      console.error("Error getting current user:", error);
    }
  };

  const refreshAccountData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      if (data) {
        setRefreshedAccounts([data]);
      }
    } catch (error) {
      console.error("Error refreshing account data:", error);
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
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Switch Account</Text>
          
          {refreshedAccounts.map((account, index) => (
            <TouchableOpacity 
              key={index}
              style={[styles.accountItem, currentUser === account.id && styles.currentAccountItem]}
              onPress={async () => {
                try {
                  if (currentUser !== account.id) {
                    onClose();
                    
                    const { error } = await supabase.auth.signInWithPassword({
                      email: account.email,
                      password: account.password || ''
                    });
                    
                    if (error) {
                      Alert.alert(
                        "Login Required", 
                        "Please log in to access this account.",
                        [{ 
                          text: "OK", 
                          onPress: () => navigation.navigate('Login', { email: account.email })
                        }]
                      );
                      return;
                    }
                    
                    await loadUserProfile();
                    navigation.reset({
                      index: 0,
                      routes: [{ name: 'MainApp' }],
                    });
                  } else {
                    onClose();
                  }
                } catch (error) {
                  console.error("Error switching account:", error);
                  Alert.alert("Error", "Failed to switch account. Please try logging in manually.");
                  onClose();
                }
              }}
            >
              <Image 
                source={{ uri: account.avatar_url || 'https://via.placeholder.com/150' }}
                style={styles.accountAvatar}
              />
              <Text style={styles.accountUsername}>{account.username}</Text>
              {currentUser === account.id && (
                <View style={styles.currentAccountBadge}>
                  <Ionicons name="checkmark-circle" size={20} color="#ff00ff" />
                </View>
              )}
            </TouchableOpacity>
          ))}

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

          <TouchableOpacity 
            style={styles.closeButton}
            onPress={onClose}
          >
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingTop: 30,
    minHeight: '40%',
  },
  modalTitle: {
    color: '#ff00ff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 25,
    textAlign: 'center',
  },
  accountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  currentAccountItem: {
    backgroundColor: 'rgba(255, 0, 255, 0.1)',
    borderWidth: 1,
    borderColor: '#ff00ff',
  },
  accountAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
  },
  accountUsername: {
    color: 'white',
    fontSize: 16,
    flex: 1,
  },
  currentAccountBadge: {
    marginLeft: 10,
  },
  addAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 0, 255, 0.1)',
    marginTop: 10,
  },
  addAccountText: {
    color: '#ff00ff',
    fontSize: 16,
    marginLeft: 10,
  },
  closeButton: {
    alignItems: 'center',
    padding: 15,
    marginTop: 10,
  },
  closeText: {
    color: '#666',
    fontSize: 16,
  },
});

export default AccountSwitcherModal;