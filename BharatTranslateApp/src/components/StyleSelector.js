import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert,
} from 'react-native';
import { useTheme } from '../ThemeContext';

const StyleSelector = ({ outputText }) => {
  const { theme } = useTheme();
  const s = makeStyles(theme);

  const handlePress = () => {
    Alert.alert('Feature Disabled', 'Style rephrase feature is currently disabled. Use emotion selector instead.');
  };

  return (
    <View style={s.container}>
      <View style={s.headerRow}>
        <Text style={s.title}>Vibe Check — Disabled</Text>
        <TouchableOpacity
          style={[s.generateBtn, s.generateBtnDisabled]}
          onPress={handlePress}
        >
          <Text style={s.generateBtnText}>Disabled</Text>
        </TouchableOpacity>
      </View>

      <Text style={s.subtitle}>This feature is currently disabled. Please use the Emotion selector instead.</Text>
    </View>
  );
};

const makeStyles = (theme) =>
  StyleSheet.create({
    container: {
      marginTop: 14, backgroundColor: theme.colors.surface,
      borderRadius: 14, borderWidth: 1, borderColor: theme.colors.border, padding: 14,
    },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    title: { fontSize: 15, fontWeight: '700', color: theme.colors.text },
    subtitle: { fontSize: 12, color: theme.colors.textSecondary, marginBottom: 12 },
    generateBtn: { backgroundColor: theme.colors.primary, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8 },
    generateBtnDisabled: { opacity: 0.4 },
    generateBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  });

export default StyleSelector;
