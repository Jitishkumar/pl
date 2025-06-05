import React, { useEffect, useState } from 'react';
import { View, Animated, Easing } from 'react-native';

const ProfileViewBlinker = ({ gender, viewerGender }) => {
  const [blinkColor] = useState(new Animated.Value(0));
  
  useEffect(() => {
    if (!gender || !viewerGender) return;
    
    const blinkSequence = () => {
      Animated.sequence([
        Animated.timing(blinkColor, {
          toValue: 1,
          duration: 300,
          easing: Easing.linear,
          useNativeDriver: false
        }),
        Animated.timing(blinkColor, {
          toValue: 0,
          duration: 300,
          easing: Easing.linear,
          useNativeDriver: false
        })
      ]).start();
    };
    
    // Blink 3 times
    blinkSequence();
    setTimeout(() => blinkSequence(), 1000);
    setTimeout(() => blinkSequence(), 2000);
  }, [gender, viewerGender]);

  if (!gender || !viewerGender) return null;
  
  let color;
  if (gender === 'third' && viewerGender === 'third') {
    color = '#90EE90'; // Light green only when both are third gender
  } else if (gender === 'male') {
    color = '#ADD8E6'; // Light blue
  } else if (gender === 'female') {
    color = '#FFC0CB'; // Pink
  } else {
    return null; // Don't show blinker for other cases
  }
  
  const backgroundColor = blinkColor.interpolate({
    inputRange: [0, 1],
    outputRange: ['transparent', `${color}40`] // 40 = 25% opacity
  });

  return (
    <Animated.View 
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor,
        zIndex: 1000,
        pointerEvents: 'none'
      }}
    />
  );
};

export default ProfileViewBlinker;