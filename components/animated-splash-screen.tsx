import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, Text, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';

interface AnimatedSplashScreenProps {
  onAnimationComplete: () => void;
}

export function AnimatedSplashScreen({ onAnimationComplete }: AnimatedSplashScreenProps) {
  const { width } = useWindowDimensions();
  
  // Animation value refs
  const logoScale = useRef(new Animated.Value(0.7)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslateY = useRef(new Animated.Value(20)).current;
  const tagOpacity = useRef(new Animated.Value(0)).current;
  const containerOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Run the intro animations in sequence / parallel
    Animated.sequence([
      // Step 1: Scale and fade in the logo
      Animated.parallel([
        Animated.timing(logoScale, {
          toValue: 1.0,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
      // Step 2: Slide up and fade in the main title
      Animated.parallel([
        Animated.timing(textTranslateY, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
      // Step 3: Fade in the tagline
      Animated.timing(tagOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      // Step 4: Keep visible for a brief moment
      Animated.delay(1000),
      // Step 5: Fade out the entire container
      Animated.timing(containerOpacity, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Notify parent component that the splash screen animations are fully done
      onAnimationComplete();
    });
  }, [logoScale, logoOpacity, textTranslateY, textOpacity, tagOpacity, containerOpacity, onAnimationComplete]);

  return (
    <Animated.View style={[styles.container, { opacity: containerOpacity }]}>
      <View style={styles.content}>
        {/* Animated Wrapper for Logo */}
        <Animated.View
          style={[
            styles.logoContainer,
            {
              opacity: logoOpacity,
              transform: [{ scale: logoScale }],
            },
          ]}
        >
          <Image
            source={require('@/assets/images/global-minds-logo.png')}
            style={styles.logo}
            contentFit="contain"
          />
        </Animated.View>

        {/* Animated Wrapper for Titles */}
        <Animated.View
          style={{
            opacity: textOpacity,
            transform: [{ translateY: textTranslateY }],
            alignItems: 'center',
          }}
        >
          <Text style={[styles.title, { fontSize: width * 0.075 }]}>
            GLOBAL MINDS
          </Text>
          <Text style={[styles.subtitle, { fontSize: width * 0.045 }]}>
            SCHOOL
          </Text>
        </Animated.View>

        {/* Animated Tagline */}
        <Animated.View style={{ opacity: tagOpacity, marginTop: 24 }}>
          <Text style={styles.tagline}>Empowering Future Leaders</Text>
        </Animated.View>
      </View>
      
      {/* Decorative Bottom Bar */}
      <View style={styles.footer}>
        <View style={styles.line} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  logoContainer: {
    width: 200,
    height: 200,
    marginBottom: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  title: {
    fontWeight: '800',
    color: '#0f172a', // slate-900
    letterSpacing: 3,
    textAlign: 'center',
  },
  subtitle: {
    fontWeight: '500',
    color: '#b45309', // amber-700 / gold accent
    letterSpacing: 8,
    textAlign: 'center',
    marginTop: 4,
  },
  tagline: {
    fontSize: 14,
    fontWeight: '400',
    color: '#64748b', // slate-500
    letterSpacing: 1.5,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    width: '40%',
    alignItems: 'center',
  },
  line: {
    height: 3,
    width: '100%',
    backgroundColor: '#e2e8f0', // slate-200
    borderRadius: 2,
  },
});
