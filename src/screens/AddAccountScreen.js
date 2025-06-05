import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const AddAccountScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
//ee
  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top > 0 ? insets.top : 50 }]}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#ff00ff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Account</Text>
      </View>
      
      <View style={styles.content}>
        <TextInput 
          style={styles.input}
          placeholder="Username"
          placeholderTextColor="#e3a6d0"
        />
        <TextInput 
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#e3a6d0"
        />
        <TextInput 
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#e3a6d0"
          secureTextEntry
        />
        <TouchableOpacity style={styles.addButton}>
          <Text style={styles.addButtonText}>Add Account</Text>
        </TouchableOpacity>
      </View>
      <View style={{ paddingBottom: insets.bottom }} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#660033',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingBottom: 15,
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    color: '#ff00ff',
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 15,
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  input: {
    backgroundColor: '#4d0026',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    color: '#ff00ff',
    borderWidth: 1,
    borderColor: '#ff00ff',
  },
  addButton: {
    backgroundColor: '#ff00ff',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  addButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default AddAccountScreen;