import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import Tts from 'react-native-tts';
import TrackPlayer, { State, usePlaybackState, Event } from 'react-native-track-player';
import { useTheme } from '../ThemeContext';
import { rephraseEmotion } from '../api';

const BASE_URL = 'http://localhost:5000';

const EMOTIONS = [
  { key: 'love',  label: 'Love',  emoji: '❤️',  color: '#E91E63' },
  { key: 'sad',   label: 'Sad',   emoji: '😢', color: '#5C6BC0' },
  { key: 'angry', label: 'Angry', emoji: '😡', color: '#F44336' },
  { key: 'happy', label: 'Happy', emoji: '😄', color: '#FFC107' },
];

let playerReady = false;

const setupPlayer = async () => {
  if (playerReady) return;
  try {
    await TrackPlayer.setupPlayer({ autoHandleInterruptions: true });
    playerReady = true;
  } catch (e) {
    // Already setup
    playerReady = true;
  }
};

const EmotionSelector = ({ text, locale, targetLang, disabled }) => {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const playbackState = usePlaybackState();
  const [speakingEmotion, setSpeakingEmotion] = useState(null);
  const [loadingEmotion, setLoadingEmotion] = useState(null);
  const currentEmotionRef = useRef(null);

  useEffect(() => {
    setupPlayer();

    // TTS fallback listeners
    const f = Tts.addEventListener('tts-finish', () => {
      setSpeakingEmotion(null);
      currentEmotionRef.current = null;
    });
    const c = Tts.addEventListener('tts-cancel', () => {
      setSpeakingEmotion(null);
      currentEmotionRef.current = null;
    });
    const e = Tts.addEventListener('tts-error', () => {
      setSpeakingEmotion(null);
      currentEmotionRef.current = null;
    });

    return () => { f.remove(); c.remove(); e.remove(); };
  }, []);

  // Watch TrackPlayer state — when ended, reset speaking
  useEffect(() => {
    if (
      playbackState?.state === State.Ended ||
      playbackState?.state === State.Stopped ||
      playbackState?.state === State.None
    ) {
      if (currentEmotionRef.current) {
        setSpeakingEmotion(null);
        currentEmotionRef.current = null;
      }
    }
  }, [playbackState]);

  const stopAll = async () => {
    try { await TrackPlayer.stop(); } catch (e) {}
    try { await Tts.stop(); } catch (e) {}
    setSpeakingEmotion(null);
    currentEmotionRef.current = null;
  };

  const handlePress = async (emotion) => {
    if (!text?.trim()) {
      Alert.alert('Translate first', 'Please translate some text first.');
      return;
    }

    // If same emotion is playing — stop it
    if (speakingEmotion === emotion.key) {
      await stopAll();
      return;
    }

    // Stop any currently playing
    if (speakingEmotion) await stopAll();

    setLoadingEmotion(emotion.key);

    try {
      const result = await rephraseEmotion({
        text: text.trim(),
        emotion: emotion.key,
        targetLang: targetLang || 'hi',
      });

      setSpeakingEmotion(emotion.key);
      currentEmotionRef.current = emotion.key;

      if (result.audioUrl) {
        // Play audio from backend (AICTE TTS or ElevenLabs)
        const fullUrl = `${BASE_URL}${result.audioUrl}`;
        try {
          await TrackPlayer.reset();
          await TrackPlayer.add({
            id: `emotion_${emotion.key}_${Date.now()}`,
            url: fullUrl,
            title: emotion.label,
            artist: 'Anuvadini',
          });
          await TrackPlayer.play();
        } catch (playerErr) {
          console.log('TrackPlayer error, TTS fallback:', playerErr.message);
          // Fallback to device TTS
          if (locale) await Tts.setDefaultLanguage(locale);
          await Tts.setDefaultRate(result.ttsRate || 0.5);
          await Tts.setDefaultPitch(result.ttsPitch || 1.0);
          Tts.speak(text.trim());
        }
      } else {
        // No audio URL — use device TTS
        if (locale) await Tts.setDefaultLanguage(locale);
        await Tts.setDefaultRate(result.ttsRate || 0.5);
        await Tts.setDefaultPitch(result.ttsPitch || 1.0);
        Tts.speak(text.trim());
      }
    } catch (err) {
      setSpeakingEmotion(null);
      currentEmotionRef.current = null;
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
