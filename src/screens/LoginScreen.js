import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../config/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const LoginScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [identifier, setIdentifier] = useState(''); // This can be email or username
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    try {
      setLoading(true);
      
      const { data: email, error: userError } = await supabase
        .rpc('get_user_by_email_or_username', { 
          identifier: identifier.toLowerCase()
        });

      if (userError) throw userError;
  
      if (!email) {
        throw new Error('User not found');
      }
  
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email,
        password: password
      });
  
      if (signInError) throw signInError;
  
      // Navigate to MainApp instead of ProfileScreen
      navigation.replace('MainApp');
    } catch (error) {
      Alert.alert(
        'Login Error',
        error.message || 'Failed to login. Please check your credentials.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={['#0a0a2a', '#1a1a3a']}
      start={{x: 0, y: 0}}
      end={{x: 1, y: 1}}
      style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
    >
      <Text style={styles.logo}>Flexx</Text>
      <TextInput
        style={styles.input}
        placeholder="Email or Username"
        placeholderTextColor="#666"
        value={identifier}
        onChangeText={setIdentifier}
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#666"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <TouchableOpacity 
        style={styles.button} 
        onPress={handleLogin}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Logging in...' : 'Login'}
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.signupButton}
        onPress={() => navigation.navigate('Signup')}
      >
        <Text style={styles.signupText}>
          Don't have an account? Sign up
        </Text>
      </TouchableOpacity>
    </LinearGradient>
  );
};

// Add these new styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  logo: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#ff00ff',
    textAlign: 'center',
    marginBottom: 40,
    textShadowColor: 'rgba(255, 0, 255, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 20,
    padding: 15,
    marginBottom: 15,
    color: 'white',
    borderWidth: 1,
    borderColor: 'rgba(255, 0, 255, 0.3)',
  },
  button: {
    backgroundColor: '#ff00ff',
    padding: 15,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: '#ff00ff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  signupButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  signupText: {
    color: '#ff00ff',
    fontSize: 16,
  },
});

export default LoginScreen;