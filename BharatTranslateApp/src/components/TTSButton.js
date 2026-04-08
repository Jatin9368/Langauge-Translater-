import React, { useState, useEffect } from 'react';
import { TouchableOpacity, Text, StyleSheet, Alert } from 'react-native';
import Tts from 'react-native-tts';
import { useTheme } from '../ThemeContext';

const transformTextForEmotion = (text, emotion) => {
  if (!text) return text;
  switch (emotion) {
    case 'angry':
      return text.toUpperCase().replace(/[.!?]/g, '! ').replace(/,/g, '...').trim() + '!!!';
    case 'sad':
      return text.replace(/([.!?])/g, '$1...').trim();
    case 'love':
      return text.replace(/[.!?]/g, '... ').replace(/,/g, ', ').trim();
    case 'happy':
      return text.replace(/[.]/g, '! ').replace(/[?]/g, '?! ').trim() + '!';
    default:
      return text;
  }
};

const EMOTION_SETTINGS = {
  love:   { rate: 0.35, pitch: 1.2,  emoji: '\uD83D\uDD0A', label: '',      color: null, borderColor: null },
  sad:    { rate: 0.28, pitch: 0.75, emoji: '\uD83D\uDD0A', label: '',      color: null, borderColor: null },
  angry:  { rate: 0.45, pitch: 0.65, emoji: '\uD83D\uDD0A', label: '',      color: null, borderColor: null },
  happy:  { rate: 0.55, pitch: 1.4,  emoji: '\uD83D\uDD0A', label: '',      color: null, borderColor: null },
  normal: { rate: 0.5,  pitch: 1.0,  emoji: '\uD83D\uDD0A', label: '',      color: null, borderColor: null },
};

const TTSButton = ({ text, locale, disabled, emotion = 'normal' }) => {
  const { theme } = useTheme();
  const [speaking, setSpeaking] = useState(false);
  const styles = makeStyles(theme);
  const settings = EMOTION_SETTINGS[emotion] || EMOTION_SETTINGS.normal;

  useEffect(() => {
    Tts.getInitStatus().catch((err) => {
      if (err.code === 'no_engine') Tts.requestInstallEngine();
    });
    const s = Tts.addEventListener('tts-start', () => setSpeaking(true));
    const f = Tts.addEventListener('tts-finish', () => setSpeaking(false));
    const c = Tts.addEventListener('tts-cancel', () => setSpeaking(false));
    const e = Tts.addEventListener('tts-error', () => setSpeaking(false));
    return () => { s.remove(); f.remove(); c.remove(); e.remove(); };
  }, []);

  useEffect(() => {
    if (speaking) { Tts.stop(); setSpeaking(false); }
  }, [emotion, text]);

  const handlePress = async () => {
    try {
      if (speaking) { await Tts.stop(); setSpeaking(false); return; }
      if (!text?.trim()) { Alert.alert('Nothing here', 'Please translate first.'); return; }
      const transformedText = transformTextForEmotion(text.trim(), emotion);
      if (locale) await Tts.setDefaultLanguage(locale);
      await Tts.setDefaultRate(settings.rate);
      await Tts.setDefaultPitch(settings.pitch);
      Tts.speak(transformedText);
    } catch (err) {
      setSpeaking(false);
      Alert.alert('TTS Error', err.message || 'Could not play audio.');
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.btn,
        { backgroundColor: speaking ? theme.colors.primaryLight : theme.colors.surfaceVariant },
        { borderColor: speaking ? theme.colors.primary : theme.colors.border },
        disabled && styles.btnDisabled,
      ]}
      onPress={handlePress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel="Listen to translation"
    >
      <Text style={styles.emoji}>
        {speaking ? '\u23F9\uFE0F' : '\uD83D\uDD0A'}
      </Text>
    </TouchableOpacity>
  );
};

const makeStyles = (theme) =>
  StyleSheet.create({
    btn: {
      width: 36, height: 36, borderRadius: 18,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 1.5,
    },
    btnDisabled: { opacity: 0.35 },
    emoji: { fontSize: 17 },
  });

export default TTSButton;
