import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import Tts from 'react-native-tts';
import { useTheme } from '../ThemeContext';
import { rephraseEmotion } from '../api';

const EMOTIONS = [
  { key: 'love',  label: 'Love',  emoji: '❤️', color: '#E91E63', rate: 0.38, pitch: 1.3 },
  { key: 'sad',   label: 'Sad',   emoji: '😢', color: '#5C6BC0', rate: 0.28, pitch: 0.72 },
  { key: 'angry', label: 'Angry', emoji: '😡', color: '#F44336', rate: 0.45, pitch: 0.65 },
  { key: 'happy', label: 'Happy', emoji: '😄', color: '#FFC107', rate: 0.6,  pitch: 1.4 },
];

const EmotionSelector = ({ text, locale, targetLang, disabled }) => {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const [speakingEmotion, setSpeakingEmotion] = useState(null);
  const [loadingEmotion, setLoadingEmotion] = useState(null);

  useEffect(() => {
    const f = Tts.addEventListener('tts-finish', () => setSpeakingEmotion(null));
    const c = Tts.addEventListener('tts-cancel', () => setSpeakingEmotion(null));
    const e = Tts.addEventListener('tts-error', () => setSpeakingEmotion(null));
    return () => { f.remove(); c.remove(); e.remove(); };
  }, []);

  const handlePress = async (emotion) => {
    if (!text?.trim()) {
      Alert.alert('Pehle translate karein');
      return;
    }

    // Stop if already speaking this emotion
    if (speakingEmotion === emotion.key) {
      await Tts.stop();
      setSpeakingEmotion(null);
      return;
    }

    // Stop any current speech
    if (speakingEmotion) {
      await Tts.stop();
      setSpeakingEmotion(null);
    }

    setLoadingEmotion(emotion.key);

    try {
      // Backend se emotion mein rewritten text lo
      const result = await rephraseEmotion({
        text: text.trim(),
        emotion: emotion.key,
        targetLang: targetLang || 'en',
      });

      const voiceText = result.voiceText || text.trim();

      // TTS settings
      if (locale) await Tts.setDefaultLanguage(locale);
      await Tts.setDefaultRate(emotion.rate);
      await Tts.setDefaultPitch(emotion.pitch);

      setSpeakingEmotion(emotion.key);
      Tts.speak(voiceText);
    } catch (err) {
      Alert.alert('Error', err.message || 'Voice nahi aa saki.');
    } finally {
      setLoadingEmotion(null);
    }
  };

  return (
    <View style={styles.row}>
      {EMOTIONS.map((emotion) => {
        const isSpeaking = speakingEmotion === emotion.key;
        const isLoading = loadingEmotion === emotion.key;

        return (
          <TouchableOpacity
            key={emotion.key}
            style={[
              styles.btn,
              { borderColor: emotion.color },
              isSpeaking && { backgroundColor: emotion.color },
              disabled && styles.btnDisabled,
            ]}
            onPress={() => handlePress(emotion)}
            disabled={disabled || isLoading}
            accessibilityRole="button"
            accessibilityLabel={`${emotion.label} tone mein suno`}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={emotion.color} />
            ) : (
              <Text style={styles.emoji}>{isSpeaking ? '⏹' : emotion.emoji}</Text>
            )}
            <Text style={[styles.label, { color: isSpeaking ? '#fff' : emotion.color }]}>
              {isLoading ? '...' : isSpeaking ? 'Stop' : emotion.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const makeStyles = (theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 10,
    },
    btn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1.5,
      backgroundColor: theme.colors.surface,
      gap: 3,
    },
    btnDisabled: { opacity: 0.4 },
    emoji: { fontSize: 20 },
    label: { fontSize: 11, fontWeight: '700' },
  });

export default EmotionSelector;
