import { Text, StyleSheet, View, TouchableOpacity, SafeAreaView } from 'react-native';
import React, { useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    ZegoUIKitPrebuiltCall,
    ONE_ON_ONE_VIDEO_CALL_CONFIG,
    GROUP_VIDEO_CALL_CONFIG,
} from '@zegocloud/zego-uikit-prebuilt-call-rn';
import Ionicons from 'react-native-vector-icons/Ionicons';

function CallPage(props) {
    console.log(props.route.params);
    const name = props.route.params.data;
    const id = props.route.params.id;
    const insets = useSafeAreaInsets();

    const handleGoBack = () => {
        // Navigate to HomePage instead of trying to go back
        // This ensures consistent navigation behavior
        props.navigation.navigate('HomePage');
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
                <Text style={styles.headerTitle}>Video Call</Text>
                <View style={styles.headerRight} />
            </View>
            <View style={styles.container}>
                <ZegoUIKitPrebuiltCall
                    appID={91100572}
                    appSign={'700161538563620670267242f2c4c72f623bb13a09f02a36828f9545678d2340'}
                    userID={name} // userID can be something like a phone number or the user id on your own user system.
                    userName={name}
                    callID={id} // callID can be any unique string.
                    config={{
                        // You can also use ONE_ON_ONE_VOICE_CALL_CONFIG/GROUP_VIDEO_CALL_CONFIG/GROUP_VOICE_CALL_CONFIG to make more types of calls.
                        ...GROUP_VIDEO_CALL_CONFIG,
                        onCallEnd: (callID, reason, duration) => { 
                            // Reset navigation state to ensure clean navigation
                            props.navigation.reset({
                                index: 0,
                                routes: [{ name: 'HomePage' }],
                            });
                        },
                    }}
                />
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
});

export default CallPage;
