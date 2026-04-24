import React, { useState, useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Text, View, StyleSheet, Image, Animated, StatusBar } from 'react-native';
import RNSplashScreen from 'react-native-splash-screen';

import { ThemeProvider, useTheme } from './src/ThemeContext';
import HomeScreen from './src/screens/HomeScreen';
import HistoryScreen from './src/screens/HistoryScreen';

const Tab = createBottomTabNavigator();

// ─── Splash Screen ────────────────────────────────────────────────────────────
const SplashScreen = ({ onDone }) => {
  const fadeAnim   = useRef(new Animated.Value(0)).current;
  const scaleAnim  = useRef(new Animated.Value(0.75)).current;
  const slideAnim  = useRef(new Animated.Value(30)).current;
  const tagAnim    = useRef(new Animated.Value(0)).current;
  const dot1Anim   = useRef(new Animated.Value(0)).current;
  const dot2Anim   = useRef(new Animated.Value(0)).current;
  const dot3Anim   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Step 1: Logo fade + scale in
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 350, useNativeDriver: true }),
    ]).start();

    // Step 2: Tagline appears after logo
    setTimeout(() => {
      Animated.timing(tagAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    }, 300);

    // Step 3: Dots animate one by one
    setTimeout(() => Animated.timing(dot1Anim, { toValue: 1, duration: 150, useNativeDriver: true }).start(), 450);
    setTimeout(() => Animated.timing(dot2Anim, { toValue: 1, duration: 150, useNativeDriver: true }).start(), 580);
    setTimeout(() => Animated.timing(dot3Anim, { toValue: 1, duration: 150, useNativeDriver: true }).start(), 710);

    // Step 4: Go to app after 1.4s
    const timer = setTimeout(() => { onDone(); }, 1400);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={splash.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F0FF" />

      {/* Colorful background circles */}
      <View style={[splash.circle, { top: -80, right: -60, backgroundColor: 'rgba(139,92,246,0.15)', width: 220, height: 220 }]} />
      <View style={[splash.circle, { bottom: -60, left: -80, backgroundColor: 'rgba(236,72,153,0.12)', width: 260, height: 260 }]} />
      <View style={[splash.circle, { top: '40%', left: -40, backgroundColor: 'rgba(59,130,246,0.1)', width: 160, height: 160 }]} />

      {/* Logo */}
      <Animated.View style={{
        opacity: fadeAnim,
        transform: [{ scale: scaleAnim }, { translateY: slideAnim }],
        alignItems: 'center',
      }}>
        <Image source={require('./src/assets/logo1.png')} style={splash.logo} resizeMode="contain" />
      </Animated.View>

      {/* Tagline */}
      <Animated.Text style={[splash.tagline, { opacity: tagAnim }]}>
        Translate with Emotion ✨
      </Animated.Text>

      {/* Animated dots */}
      <View style={splash.dotsRow}>
        <Animated.View style={[splash.dot, { opacity: dot1Anim, backgroundColor: '#A78BFA' }]} />
        <Animated.View style={[splash.dot, { opacity: dot2Anim, backgroundColor: '#EC4899' }]} />
        <Animated.View style={[splash.dot, { opacity: dot3Anim, backgroundColor: '#60A5FA' }]} />
      </View>

      {/* App name at bottom */}
      <Animated.Text style={[splash.version, { opacity: tagAnim }]}>
        Anuvadani Translate
      </Animated.Text>
    </View>
  );
};

const splash = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F0FF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  circle: { position: 'absolute', borderRadius: 999 },
  logo: { width: 240, height: 110, marginBottom: 24 },
  tagline: {
    color: '#7C3AED',
    fontSize: 15,
    letterSpacing: 1.4,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  dotsRow: { flexDirection: 'row', gap: 10, marginTop: 32 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  version: {
    position: 'absolute',
    bottom: 44,
    color: 'rgba(124,58,237,0.4)',
    fontSize: 12,
    letterSpacing: 1,
    fontWeight: '500',
  },
});

const TAB_CONFIG = {
  Home:    { icon: '⚡', label: 'Translate' },
  History: { icon: '📜', label: 'History'   },
};

const AppNavigator = () => {
  const { theme, isDark } = useTheme();

  return (
    <NavigationContainer
      theme={{
        dark: theme.dark,
        colors: {
          primary: theme.colors.primary,
          background: theme.colors.background,
          card: theme.colors.tabBar,
          text: theme.colors.text,
          border: 'transparent',
          notification: theme.colors.primary,
        },
      }}
    >
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarStyle: {
            backgroundColor: isDark ? 'rgba(19,19,31,0.97)' : 'rgba(255,255,255,0.97)',
            borderTopWidth: 0,
            height: 68,
            paddingBottom: 10,
            paddingTop: 6,
            shadowColor: '#6366F1',
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: isDark ? 0.2 : 0.08,
            shadowRadius: 16,
            elevation: 20,
          },
          tabBarActiveTintColor: theme.colors.primary,
          tabBarInactiveTintColor: theme.colors.tabBarInactive,
          tabBarIcon: ({ focused }) => {
            const cfg = TAB_CONFIG[route.name];
            return (
              <View style={[
                styles.tabIconWrap,
                focused && { backgroundColor: isDark ? 'rgba(99,102,241,0.18)' : 'rgba(99,102,241,0.1)', borderRadius: 12 },
              ]}>
                <Text style={[styles.tabIcon, { opacity: focused ? 1 : 0.5 }]}>{cfg.icon}</Text>
              </View>
            );
          },
          tabBarLabelStyle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
        })}
      >
        <Tab.Screen name="Home"    component={HomeScreen}    options={{ tabBarLabel: 'Translate' }} />
        <Tab.Screen name="History" component={HistoryScreen} options={{ tabBarLabel: 'History'   }} />
      </Tab.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  tabIconWrap: { width: 36, height: 28, alignItems: 'center', justifyContent: 'center' },
  tabIcon: { fontSize: 20 },
});

const App = () => {
  useEffect(() => {
    RNSplashScreen.hide();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <SafeAreaProvider style={{ backgroundColor: '#F8FAFC' }}>
        <ThemeProvider>
          <AppNavigator />
        </ThemeProvider>
      </SafeAreaProvider>
    </View>
  );
};

export default App;
