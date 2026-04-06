import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import Tts from 'react-native-tts';
import { useTheme } from '../ThemeContext';

const EMOTIONS = [
  { key: 'love',  label: 'Love',  emoji: '❤️', color: '#E91E63', rate: 0.38, pitch: 1.3 },
  { key: 'sad',   label: 'Sad',   emoji: '😢', color: '#5C6BC0', rate: 0.28, pitch: 0.72 },
  { key: 'angry', label: 'Angry', emoji: '😡', color: '#F44336', rate: 0.45, pitch: 0.65 },
  { key: 'happy', label: 'Happy', emoji: '😄', color: '#FFC107', rate: 0.6,  pitch: 1.4 },
];

// Emotion ke hisaab se text transform — sirf voice ke liye
const transformForVoice = (text, emotion) => {
  const t = text.trim();
  switch (emotion) {
    case 'angry':
      return t.toUpperCase().replace(/[.!?]/g, '! ').trim() + '!!!';
    case 'sad':
      return t.replace(/([.!?])/g, '$1...').trim();
    case 'love':
      return t.replace(/[.!?]/g, '... ').trim();
    case 'happy':
      return t.replace(/[.]/g, '! ').trim() + '!';
    default:
      return t;
  }
};

const EmotionSelector = ({ text, locale, disabled }) => {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const [speakingEmotion, setSpeakingEmotion] = useState(null);

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

    // Agar same emotion chal raha hai toh stop karo
    if (speakingEmotion === emotion.key) {
      await Tts.stop();
      setSpeakingEmotion(null);
      return;
    }

    // Pehle se kuch chal raha hai toh stop karo
    if (speakingEmotion) {
      await Tts.stop();
    }

    try {
      const voiceText = transformForVoice(text, emotion.key);
      if (locale) await Tts.setDefaultLanguage(locale);
      await Tts.setDefaultRate(emotion.rate);
      await Tts.setDefaultPitch(emotion.pitch);
      setSpeakingEmotion(emotion.key);
      Tts.speak(voiceText);
    } catch (err) {
      setSpeakingEmotion(null);
      Alert.alert('Voice Error', err.message || 'Awaaz nahi aa saki.');
    }
  };

  return (
    <View style={styles.row}>
      {EMOTIONS.map((emotion) => {
        const isSpeaking = speakingEmotion === emotion.key;
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
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={`${emotion.label} tone mein suno`}
          >
            <Text style={styles.emoji}>{isSpeaking ? '⏹' : emotion.emoji}</Text>
            <Text style={[styles.label, { color: isSpeaking ? '#fff' : emotion.color }]}>
              {isSpeaking ? 'Stop' : emotion.label}
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
    btnDisabled: {
      opacity: 0.4,
    },
    emoji: {
      fontSize: 20,
    },
    label: {
      fontSize: 11,
      fontWeight: '700',
    },
  });

export default EmotionSelector;
