import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, Text, useWindowDimensions, useColorScheme, Easing } from 'react-native';
import { Image } from 'expo-image';

interface AnimatedSplashScreenProps {
  onAnimationComplete: () => void;
}

export function AnimatedSplashScreen({ onAnimationComplete }: AnimatedSplashScreenProps) {
  const { width } = useWindowDimensions();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  // Animation value refs
  // Start logoScale at 1.0 and logoOpacity at 1.0 to perfectly continue from the native splash screen layout
  const logoScale = useRef(new Animated.Value(1.0)).current;
  const logoOpacity = useRef(new Animated.Value(1.0)).current; 
  
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslateY = useRef(new Animated.Value(25)).current;
  
  const tagOpacity = useRef(new Animated.Value(0)).current;
  const tagTranslateY = useRef(new Animated.Value(15)).current;
  
  const lineWidth = useRef(new Animated.Value(0)).current;
  const containerOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // 1. Kick off the logo premium scale-up (zoom in)
    Animated.timing(logoScale, {
      toValue: 1.18, // Continuous zoom in effect
      duration: 950,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();

    // 2. Staggered sequence for text components and dividers
    Animated.sequence([
      // Delay before the titles begin to slide up
      Animated.delay(150),
      
      // Title texts slide up & fade in
      Animated.parallel([
        Animated.timing(textTranslateY, {
          toValue: 0,
          duration: 550,
          easing: Easing.out(Easing.back(1.1)), // subtle spring-back animation
          useNativeDriver: true,
        }),
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 480,
          useNativeDriver: true,
        }),
      ]),

      // Tagline and Decorative line draw/slide in together
      Animated.parallel([
        Animated.timing(tagTranslateY, {
          toValue: 0,
          duration: 450,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(tagOpacity, {
          toValue: 1,
          duration: 450,
          useNativeDriver: true,
        }),
        Animated.timing(lineWidth, {
          toValue: 1,
          duration: 600,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),

      // Keep screen fully visible for the user to enjoy the complete premium view
      Animated.delay(1050),

      // Smooth fade out of the entire splash screen
      Animated.timing(containerOpacity, {
        toValue: 0,
        duration: 350,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onAnimationComplete();
    });
  }, [
    logoScale,
    textTranslateY,
    textOpacity,
    tagTranslateY,
    tagOpacity,
    lineWidth,
    containerOpacity,
    onAnimationComplete,
  ]);

  return (
    <Animated.View style={[styles.container, { opacity: containerOpacity, backgroundColor: isDark ? '#151718' : '#ffffff' }]}>
      <View style={styles.content}>
        {/* Animated Wrapper for Logo */}
        <Animated.View
          style={[
            styles.logoContainer,
            {
              opacity: logoOpacity,
              transform: [
                { scale: logoScale }
              ],
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
          <Text style={[styles.title, { fontSize: width * 0.078, color: isDark ? '#ffffff' : '#0f172a' }]}>
            GLOBAL MINDS
          </Text>
          <Text style={[styles.subtitle, { fontSize: width * 0.046, color: isDark ? '#fbbf24' : '#b45309' }]}>
            SCHOOL
          </Text>
        </Animated.View>

        {/* Animated Tagline */}
        <Animated.View style={{ opacity: tagOpacity, transform: [{ translateY: tagTranslateY }], marginTop: 28 }}>
          <Text style={[styles.tagline, { color: isDark ? '#94a3b8' : '#64748b' }]}>Empowering Future Leaders</Text>
        </Animated.View>
      </View>
      
      {/* Decorative Bottom Bar */}
      <View style={styles.footer}>
        <Animated.View style={[styles.line, { backgroundColor: isDark ? '#334155' : '#e2e8f0', transform: [{ scaleX: lineWidth }] }]} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
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
    width: 320,
    height: 320,
    marginBottom: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  title: {
    fontWeight: '800',
    letterSpacing: 3,
    textAlign: 'center',
  },
  subtitle: {
    fontWeight: '500',
    letterSpacing: 8,
    textAlign: 'center',
    marginTop: 4,
  },
  tagline: {
    fontSize: 14,
    fontWeight: '400',
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
    borderRadius: 2,
  },
});
