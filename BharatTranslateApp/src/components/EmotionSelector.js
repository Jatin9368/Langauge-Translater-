import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import Tts from 'react-native-tts';
import TrackPlayer, { Event, State } from 'react-native-track-player';
import { useTheme } from '../ThemeContext';
import { rephraseEmotion, BASE_URL } from '../api';

const EMOTIONS = [
  { key: 'love',  label: 'Love',  emoji: '❤️',  color: '#E91E63' },
  { key: 'sad',   label: 'Sad',   emoji: '😢', color: '#5C6BC0' },
  { key: 'angry', label: 'Angry', emoji: '😡', color: '#F44336' },
  { key: 'happy', label: 'Happy', emoji: '😄', color: '#FFC107' },
];

let playerSetup = false;

const ensurePlayer = async () => {
  if (playerSetup) return true;
  try {
    await TrackPlayer.setupPlayer({ autoHandleInterruptions: true });
    playerSetup = true;
    return true;
  } catch (e) {
    // Already setup — treat as success
    playerSetup = true;
    return true;
  }
};

const EmotionSelector = ({ text, locale, targetLang, disabled }) => {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const [speakingEmotion, setSpeakingEmotion] = useState(null);
  const [loadingEmotion, setLoadingEmotion] = useState(null);
  const speakingRef = useRef(null);

  useEffect(() => {
    ensurePlayer();

    // TrackPlayer: when track ends → reset state
    const sub = TrackPlayer.addEventListener(Event.PlaybackState, (data) => {
      if (data.state === State.Ended || data.state === State.Stopped) {
        if (speakingRef.current) {
          setSpeakingEmotion(null);
          speakingRef.current = null;
        }
      }
    });

    // TTS fallback listeners
    const ttsFinish = Tts.addEventListener('tts-finish', () => {
      setSpeakingEmotion(null);
      speakingRef.current = null;
    });
    const ttsCancel = Tts.addEventListener('tts-cancel', () => {
      setSpeakingEmotion(null);
      speakingRef.current = null;
    });
    const ttsError = Tts.addEventListener('tts-error', () => {
      setSpeakingEmotion(null);
      speakingRef.current = null;
    });

    return () => {
      sub.remove();
      ttsFinish.remove();
      ttsCancel.remove();
      ttsError.remove();
    };
  }, []);

  const stopAll = async () => {
    try { await TrackPlayer.stop(); await TrackPlayer.reset(); } catch (_) {}
    try { await Tts.stop(); } catch (_) {}
    setSpeakingEmotion(null);
    speakingRef.current = null;
  };

  const playWithTTS = async (voiceText, ttsRate, ttsPitch) => {
    if (locale) {
      try { await Tts.setDefaultLanguage(locale); } catch (_) {}
    }
    await Tts.setDefaultRate(ttsRate || 0.5);
    await Tts.setDefaultPitch(ttsPitch || 1.0);
    Tts.speak(voiceText);
  };

  const handlePress = async (emotion) => {
    if (!text?.trim()) {
      Alert.alert('Translate first', 'Please translate some text first.');
      return;
    }

    // Same emotion tapping again → stop
    if (speakingEmotion === emotion.key) {
      await stopAll();
      return;
    }

    // Different emotion playing → stop first
    if (speakingEmotion) await stopAll();

    setLoadingEmotion(emotion.key);

    try {
      const result = await rephraseEmotion({
        text: text.trim(),
        emotion: emotion.key,
        targetLang: targetLang || 'hi',
      });

      setSpeakingEmotion(emotion.key);
      speakingRef.current = emotion.key;

      if (result.audioUrl) {
        const fullUrl = `${BASE_URL}${result.audioUrl}`;
        try {
          await ensurePlayer();
          await TrackPlayer.reset();
          await TrackPlayer.add({
            id: `emotion_${emotion.key}_${Date.now()}`,
            url: fullUrl,
            title: emotion.label,
            artist: 'Anuvadini',
          });
          await TrackPlayer.play();
        } catch (playerErr) {
          console.warn('[TrackPlayer] fallback to TTS:', playerErr.message);
          await playWithTTS(text.trim(), result.ttsRate, result.ttsPitch);
        }
      } else {
        // No audio URL — device TTS
        await playWithTTS(text.trim(), result.ttsRate, result.ttsPitch);
      }
    } catch (err) {
      setSpeakingEmotion(null);
      speakingRef.current = null;
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
              <Text style={styles.emoji}>{isSpeaking ? '⏹️' : emotion.emoji}</Text>
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
