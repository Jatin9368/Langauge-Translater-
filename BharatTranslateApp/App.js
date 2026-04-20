import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Text, View, StyleSheet } from 'react-native';

import { ThemeProvider, useTheme } from './src/ThemeContext';
import HomeScreen from './src/screens/HomeScreen';
import HistoryScreen from './src/screens/HistoryScreen';

const Tab = createBottomTabNavigator();

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

const App = () => (
  <SafeAreaProvider>
    <ThemeProvider>
      <AppNavigator />
    </ThemeProvider>
  </SafeAreaProvider>
);

export default App;
