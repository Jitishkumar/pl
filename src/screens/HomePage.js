import { Text, View, StyleSheet, Alert, TouchableOpacity, SafeAreaView } from 'react-native';
import React, { useState } from 'react';
import { TextInput } from 'react-native-paper';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function HomePage({navigation}) {
  const [name, setName] = useState('');
  const [callId, setCallId] = useState('');
  const insets = useSafeAreaInsets();

  const handleGoBack = () => {
    // Navigate to MainApp instead of trying to go back
    // since HomePage is often reached through navigation.reset()
    navigation.navigate('MainApp');
  };

  const headerStyle = {
    ...styles.header,
    paddingTop: insets.top > 0 ? insets.top : 16,
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={headerStyle}>
        <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Join Video Call</Text>
        <View style={styles.headerRight} />
      </View>
      <View style={styles.container}>
        <TextInput 
          style={styles.input}
          placeholder="Enter Your name" 
          onChangeText={e => setName(e)}
          placeholderTextColor="rgba(255, 255, 255, 0.6)"
          value={name}
          mode="outlined"
          outlineColor="rgba(255, 255, 255, 0.5)"
          activeOutlineColor="#ffffff"
          elevation={2}
          theme={{ colors: { text: '#ffffff', primary: '#ffffff', placeholder: 'rgba(255, 255, 255, 0.6)' } }}
          textColor="#ffffff"
          contentStyle={styles.inputText}
        />
        <TextInput 
          style={styles.input}
          placeholder="Enter Your number" 
          onChangeText={e => setCallId(e)}
          placeholderTextColor="rgba(255, 255, 255, 0.6)"
          value={callId}
          mode="outlined"
          outlineColor="rgba(255, 255, 255, 0.5)"
          activeOutlineColor="#ffffff"
          elevation={2}
          theme={{ colors: { text: '#ffffff', primary: '#ffffff', placeholder: 'rgba(255, 255, 255, 0.6)' } }}
          textColor="#ffffff"
          contentStyle={styles.inputText}
        />
        <TouchableOpacity
          style={styles.joinButton}
          onPress={() => {
            if (!name.trim() || !callId.trim()) {
              Alert.alert('Error', 'Please enter both your name and call ID');
              return;
            }
            navigation.navigate('CallPage', {data: name, id: callId});
          }}
        >
          <Text style={styles.joinButtonText}>JOIN CALL</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({

  safeArea: {
    flex: 1,
    backgroundColor: '#0a0a2a',
    paddingTop: 0,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a2a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#0a0a2a',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 0, 255, 0.2)',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerRight: {
    width: 40, // To balance the header layout
  },
  input: {
    marginVertical: 12,
    marginHorizontal: 20,
    width: '85%',
    backgroundColor: 'transparent',
    shadowColor: '#ffffff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  inputText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  joinButton: {
    backgroundColor: '#00aaff',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    marginTop: 20,
    elevation: 3,
    shadowColor: '#00aaff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  joinButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default HomePage;
