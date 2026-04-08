import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import Tts from 'react-native-tts';
import { useTheme } from '../ThemeContext';
import { rephraseEmotion } from '../api';

const EMOTIONS = [
  { key: 'love',  label: 'Love',  emoji: '\u2764\uFE0F', color: '#E91E63' },
  { key: 'sad',   label: 'Sad',   emoji: '\uD83D\uDE22', color: '#5C6BC0' },
  { key: 'angry', label: 'Angry', emoji: '\uD83D\uDE21', color: '#F44336' },
  { key: 'happy', label: 'Happy', emoji: '\uD83D\uDE04', color: '#FFC107' },
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
      Alert.alert('Translate first', 'Please translate some text first.');
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

    setLoadingEmotion(emotion.key);

    try {
      const result = await rephraseEmotion({
        text: text.trim(),
        emotion: emotion.key,
        targetLang: targetLang || 'en',
      });

      const voiceText = result.voiceText || text.trim();
      const rate = result.ttsRate || 0.5;
      const pitch = result.ttsPitch || 1.0;

      if (locale) await Tts.setDefaultLanguage(locale);
      await Tts.setDefaultRate(rate);
      await Tts.setDefaultPitch(pitch);

      setSpeakingEmotion(emotion.key);
      Tts.speak(voiceText);
    } catch (err) {
      setSpeakingEmotion(null);
      Alert.alert('Error', err.message || 'Could not play voice.');
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
            disabled={disabled || !!loadingEmotion}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={emotion.color} />
            ) : (
              <Text style={styles.emoji}>{isSpeaking ? '\u23F9\uFE0F' : emotion.emoji}</Text>
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
    row: { flexDirection: 'row', gap: 8, marginTop: 10 },
    btn: {
      flex: 1, alignItems: 'center', justifyContent: 'center',
      paddingVertical: 10, borderRadius: 10, borderWidth: 1.5,
      backgroundColor: theme.colors.surface, gap: 3,
    },
    btnDisabled: { opacity: 0.4 },
    emoji: { fontSize: 20 },
    label: { fontSize: 11, fontWeight: '700' },
  });

export default EmotionSelector;
