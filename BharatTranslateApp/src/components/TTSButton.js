import React, { useState, useEffect } from 'react';
import { TouchableOpacity, Text, StyleSheet, Alert } from 'react-native';
import Tts from 'react-native-tts';
import { useTheme } from '../ThemeContext';

// Text ko emotion ke hisaab se modify karo taaki TTS alag lage
const transformTextForEmotion = (text, emotion) => {
  if (!text) return text;

  switch (emotion) {
    case 'angry':
      // CAPS mein convert karo, har word ke baad pause, aggressive feel
      return text
        .toUpperCase()
        .replace(/[.!?]/g, '! ')
        .replace(/,/g, '...')
        .trim() + '!!!';

    case 'sad':
      // Har sentence ke baad lamba pause, slow feel ke liye commas add karo
      return text
        .replace(/([.!?])/g, '$1...')
        .replace(/(\w{4,})/g, (w) => w.split('').join(''))  // spacing feel
        .trim();

    case 'love':
      // Soft pauses, har sentence ke baad warmth
      return text
        .replace(/[.!?]/g, '... ')
        .replace(/,/g, ', ')
        .trim();

    case 'happy':
      // Exclamation marks, energetic
      return text
        .replace(/[.]/g, '! ')
        .replace(/[?]/g, '?! ')
        .trim() + '!';

    default:
      return text;
  }
};

const EMOTION_SETTINGS = {
  love: {
    rate: 0.35,   // slow aur soft
    pitch: 1.2,   // thoda high â€” warm
    emoji: 'â¤ï¸',
    label: 'Love',
    color: '#FCE4EC',
    borderColor: '#E91E63',
  },
  sad: {
    rate: 0.28,   // bahut slow â€” rona wala
    pitch: 0.75,  // low â€” dukhi
    emoji: 'ðŸ˜¢',
    label: 'Sad',
    color: '#E8EAF6',
    borderColor: '#5C6BC0',
  },
  angry: {
    rate: 0.45,   // medium â€” clearly gusse se bole, fast nahi
    pitch: 0.65,  // deep/low â€” aggressive
    emoji: 'ðŸ˜¡',
    label: 'Angry',
    color: '#FFEBEE',
    borderColor: '#F44336',
  },
  happy: {
    rate: 0.55,   // thoda fast â€” excited
    pitch: 1.4,   // high â€” khushi
    emoji: 'ðŸ˜„',
    label: 'Happy',
    color: '#FFFDE7',
    borderColor: '#FFC107',
  },
  normal: {
    rate: 0.5,
    pitch: 1.0,
    emoji: 'ðŸ”Š',
    label: '',
    color: null,
    borderColor: null,
  },
};

const TTSButton = ({ text, locale, disabled, emotion = 'normal' }) => {
  const { theme } = useTheme();
  const [speaking, setSpeaking] = useState(false);
  const styles = makeStyles(theme);
  const settings = EMOTION_SETTINGS[emotion] || EMOTION_SETTINGS.normal;

  useEffect(() => {
    // TTS initialize karo
    Tts.getInitStatus().then(() => {
      console.log('TTS initialized');
    }).catch((err) => {
      if (err.code === 'no_engine') {
        Tts.requestInstallEngine();
      }
    });

    const s = Tts.addEventListener('tts-start', () => setSpeaking(true));
    const f = Tts.addEventListener('tts-finish', () => setSpeaking(false));
    const c = Tts.addEventListener('tts-cancel', () => setSpeaking(false));
    const e = Tts.addEventListener('tts-error', (err) => {
      console.log('TTS error:', err);
      setSpeaking(false);
    });
    return () => { s.remove(); f.remove(); c.remove(); e.remove(); };
  }, []);

  useEffect(() => {
    if (speaking) { Tts.stop(); setSpeaking(false); }
  }, [emotion, text]);

  const handlePress = async () => {
    try {
      if (speaking) {
        await Tts.stop();
        setSpeaking(false);
        return;
      }
      if (!text?.trim()) {
        Alert.alert('Nothing here', 'Please translate first.');
        return;
      }

      // Sirf voice ke liye transform â€” screen pe kuch nahi dikhata
      const transformedText = transformTextForEmotion(text.trim(), emotion);

      if (locale) await Tts.setDefaultLanguage(locale);
      await Tts.setDefaultRate(settings.rate);
      await Tts.setDefaultPitch(settings.pitch);

      // transformedText sirf bolta hai, koi state update nahi
      Tts.speak(transformedText);
    } catch (err) {
      setSpeaking(false);
      Alert.alert('TTS Error', err.message || 'Could not play audio.');
    }
  };

  const bgColor = speaking
    ? theme.colors.primaryLight
    : settings.color || theme.colors.surfaceVariant;

  const borderColor = speaking
    ? theme.colors.primary
    : settings.borderColor || theme.colors.border;

  return (
    <TouchableOpacity
      style={[
        styles.btn,
        { backgroundColor: bgColor, borderColor },
        disabled && styles.btnDisabled,
      ]}
      onPress={handlePress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${settings.label || 'Normal'} tone mein suno`}
    >
      <Text style={styles.emoji}>
        {speaking ? 'â¹' : settings.emoji}
      </Text>
      {settings.label ? (
        <Text style={[styles.label, { color: borderColor }]}>
          {speaking ? 'Stop' : settings.label}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
};

const makeStyles = (theme) =>
  StyleSheet.create({
    btn: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: 1.5,
      gap: 4,
    },
    btnDisabled: {
      opacity: 0.35,
    },
    emoji: {
      fontSize: 17,
    },
    label: {
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'capitalize',
    },
  });

export default TTSButton;

