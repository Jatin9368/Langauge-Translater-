import React, { useState, useEffect } from 'react';
import { TouchableOpacity, Text, StyleSheet, Alert } from 'react-native';
import Tts from 'react-native-tts';
import { useTheme } from '../ThemeContext';

const TTSButton = ({ text, locale, disabled }) => {
  const { theme } = useTheme();
  const [speaking, setSpeaking] = useState(false);
  const styles = makeStyles(theme);

  useEffect(() => {
    // Set up TTS event listeners
    const startListener = Tts.addEventListener('tts-start', () => setSpeaking(true));
    const finishListener = Tts.addEventListener('tts-finish', () => setSpeaking(false));
    const cancelListener = Tts.addEventListener('tts-cancel', () => setSpeaking(false));
    const errorListener = Tts.addEventListener('tts-error', (err) => {
      setSpeaking(false);
      console.error('TTS error:', err);
    });

    return () => {
      startListener.remove();
      finishListener.remove();
      cancelListener.remove();
      errorListener.remove();
    };
  }, []);

  const handlePress = async () => {
    try {
      if (speaking) {
        await Tts.stop();
        setSpeaking(false);
        return;
      }

      if (!text || !text.trim()) {
        Alert.alert('Nothing to speak', 'Translate some text first.');
        return;
      }

      if (locale) {
        await Tts.setDefaultLanguage(locale);
      }

      await Tts.setDefaultRate(0.5);
      await Tts.setDefaultPitch(1.0);
      Tts.speak(text.trim());
    } catch (err) {
      setSpeaking(false);
      Alert.alert('TTS Error', err.message || 'Could not play audio.');
    }
  };

  return (
    <TouchableOpacity
      style={[styles.btn, disabled && styles.btnDisabled, speaking && styles.btnActive]}
      onPress={handlePress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={speaking ? 'Stop speaking' : 'Listen to translation'}
    >
      <Text style={[styles.icon, speaking && styles.iconActive]}>
        {speaking ? '⏹' : '🔊'}
      </Text>
    </TouchableOpacity>
  );
};

const makeStyles = (theme) =>
  StyleSheet.create({
    btn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.colors.surfaceVariant,
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnActive: {
      backgroundColor: theme.colors.primaryLight,
    },
    btnDisabled: {
      opacity: 0.4,
    },
    icon: {
      fontSize: 18,
    },
    iconActive: {
      fontSize: 18,
    },
  });

export default TTSButton;
