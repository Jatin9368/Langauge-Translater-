import React, { useState, useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Text, View, StyleSheet, Image, Animated, StatusBar } from 'react-native';

import { ThemeProvider, useTheme } from './src/ThemeContext';
import HomeScreen from './src/screens/HomeScreen';
import HistoryScreen from './src/screens/HistoryScreen';

const Tab = createBottomTabNavigator();

// ─── Splash Screen ────────────────────────────────────────────────────────────
const SplashScreen = ({ onDone }) => {
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
    ]).start();
    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => onDone());
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={splash.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#EEF2FF" />
      <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: scaleAnim }], alignItems: 'center' }}>
        <Image source={require('./src/assets/logo1.png')} style={splash.logo} resizeMode="contain" />
        <Text style={splash.tagline}>Translate with Emotion</Text>
      </Animated.View>
      <Animated.Text style={[splash.version, { opacity: fadeAnim }]}>BharatTranslate</Animated.Text>
    </View>
  );
};

const splash = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
  logo: { width: 220, height: 100, marginBottom: 16 },
  tagline: { color: '#6366F1', fontSize: 14, letterSpacing: 1.2, fontWeight: '600' },
  version: { position: 'absolute', bottom: 40, color: 'rgba(99,102,241,0.4)', fontSize: 12 },
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
  const [splashDone, setSplashDone] = useState(false);

  if (!splashDone) return <SplashScreen onDone={() => setSplashDone(true)} />;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppNavigator />
      </ThemeProvider>
    </SafeAreaProvider>
  );
};

export default App;
