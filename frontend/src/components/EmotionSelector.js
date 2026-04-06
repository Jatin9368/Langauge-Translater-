import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme } from '../ThemeContext';

const EMOTIONS = [
  { key: 'love', label: 'Love', emoji: '❤️', color: '#E91E63' },
  { key: 'sad', label: 'Sad', emoji: '😢', color: '#5C6BC0' },
  { key: 'angry', label: 'Angry', emoji: '😡', color: '#F44336' },
  { key: 'happy', label: 'Happy', emoji: '😄', color: '#FFC107' },
];

const EmotionSelector = ({ onSelect, activeEmotion, loading, disabled }) => {
  const { theme } = useTheme();
  const styles = makeStyles(theme);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Rephrase with emotion</Text>
      <View style={styles.row}>
        {EMOTIONS.map((emotion) => {
          const isActive = activeEmotion === emotion.key;
          return (
            <TouchableOpacity
              key={emotion.key}
              style={[
                styles.btn,
                isActive && { borderColor: emotion.color, backgroundColor: theme.colors.emotionActiveBg },
                disabled && styles.btnDisabled,
              ]}
              onPress={() => !disabled && onSelect(emotion.key)}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={`Rephrase in ${emotion.label} tone`}
              accessibilityState={{ selected: isActive }}
            >
              {loading && isActive ? (
                <ActivityIndicator size="small" color={emotion.color} />
              ) : (
                <Text style={styles.emoji}>{emotion.emoji}</Text>
              )}
              <Text style={[styles.btnLabel, isActive && { color: emotion.color }]}>
                {emotion.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const makeStyles = (theme) =>
  StyleSheet.create({
    container: {
      marginTop: 12,
    },
    label: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginBottom: 8,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    row: {
      flexDirection: 'row',
      gap: 8,
    },
    btn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      gap: 4,
    },
    btnDisabled: {
      opacity: 0.4,
    },
    emoji: {
      fontSize: 20,
    },
    btnLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },
  });

export default EmotionSelector;
