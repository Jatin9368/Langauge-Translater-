import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import Tts from 'react-native-tts';
import { useTheme } from '../ThemeContext';

const EMOTIONS = [
  { key: 'love',  label: 'Love',  emoji: '❤️', color: '#E91E63' },
  { key: 'sad',   label: 'Sad',   emoji: '😢', color: '#5C6BC0' },
  { key: 'angry', label: 'Angry', emoji: '😡', color: '#F44336' },
  { key: 'happy', label: 'Happy', emoji: '😄', color: '#FFC107' },
];

// Emotion ke hisaab se TTS settings aur text transform
const EMOTION_CONFIG = {
  love: {
    rate: 0.36,   // slow — pyaar se
    pitch: 1.25,  // thoda high — warm
    // Text mein soft pauses add karo
    transform: (t) => t.split(' ').join('... ').replace(/\.\.\. \.\.\. /g, '... '),
  },
  sad: {
    rate: 0.30,   // bahut slow — dukhi
    pitch: 0.78,  // low — heavy
    // Har word ke baad pause — rona wala feel
    transform: (t) => t.replace(/([,।])/g, '$1...').replace(/([.!?])/g, '$1......'),
  },
  angry: {
    rate: 0.52,   // medium-fast — gusse mein clearly bole
    pitch: 0.62,  // deep — aggressive
    // Short punchy — caps feel
    transform: (t) => t.replace(/([.!?])/g, '$1! ').trim() + '!',
  },
  happy: {
    rate: 0.58,   // fast — excited
    pitch: 1.45,  // high — cheerful
    // Exclamation add karo
    transform: (t) => t.replace(/[.]/g, '! ').trim() + '!',
  },
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

    if (speakingEmotion === emotion.key) {
      await Tts.stop();
      setSpeakingEmotion(null);
      return;
    }

    if (speakingEmotion) {
      await Tts.stop();
      setSpeakingEmotion(null);
    }

    try {
      const config = EMOTION_CONFIG[emotion.key];

      // Text transform — pauses aur punctuation se emotion feel aata hai
      const transformedText = config.transform(text.trim());

      if (locale) await Tts.setDefaultLanguage(locale);
      await Tts.setDefaultRate(config.rate);
      await Tts.setDefaultPitch(config.pitch);

      setSpeakingEmotion(emotion.key);
      Tts.speak(transformedText);
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
    btnDisabled: { opacity: 0.4 },
    emoji: { fontSize: 20 },
    label: { fontSize: 11, fontWeight: '700' },
  });

export default EmotionSelector;
