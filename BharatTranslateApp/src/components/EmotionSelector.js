import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import Tts from 'react-native-tts';
import { Player } from '@react-native-community/audio-toolkit';
import { useTheme } from '../ThemeContext';
import { rephraseEmotion, BASE_URL } from '../api';

const EMOTIONS = [
  { key: 'love',  label: 'Love',  emoji: '❤️',  color: '#E91E63' },
  { key: 'sad',   label: 'Sad',   emoji: '😢', color: '#5C6BC0' },
  { key: 'angry', label: 'Angry', emoji: '😡', color: '#F44336' },
  { key: 'happy', label: 'Happy', emoji: '😄', color: '#FFC107' },
];

const EmotionSelector = ({ text, locale, targetLang, disabled }) => {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const [speakingEmotion, setSpeakingEmotion] = useState(null);
  const [loadingEmotion, setLoadingEmotion] = useState(null);
  const playerRef = useRef(null);

  // Cleanup on unmount
  useEffect(() => {
    const ttsFinish = Tts.addEventListener('tts-finish', () => setSpeakingEmotion(null));
    const ttsCancel = Tts.addEventListener('tts-cancel', () => setSpeakingEmotion(null));
    const ttsError  = Tts.addEventListener('tts-error',  () => setSpeakingEmotion(null));
    return () => {
      ttsFinish.remove(); ttsCancel.remove(); ttsError.remove();
      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch (_) {}
        playerRef.current = null;
      }
    };
  }, []);

  const stopAll = () => {
    if (playerRef.current) {
      try { playerRef.current.destroy(); } catch (_) {}
      playerRef.current = null;
    }
    try { Tts.stop(); } catch (_) {}
    setSpeakingEmotion(null);
  };

  const playAudioUrl = (url, emotionKey, ttsText, ttsRate, ttsPitch) => {
    // Destroy previous player
    if (playerRef.current) {
      try { playerRef.current.destroy(); } catch (_) {}
      playerRef.current = null;
    }

    const player = new Player(url, { autoDestroy: true, continuesToPlayInBackground: false });
    playerRef.current = player;

    player.play((err) => {
      if (err) {
        console.warn('[Player] error, TTS fallback:', err);
        playerRef.current = null;
        // Fallback to device TTS
        playTTS(ttsText, locale, ttsRate, ttsPitch, emotionKey);
        return;
      }
      // On finish
      player.on('ended', () => {
        setSpeakingEmotion(null);
        playerRef.current = null;
      });
      player.on('error', () => {
        setSpeakingEmotion(null);
        playerRef.current = null;
      });
    });
  };

  const playTTS = async (ttsText, ttsLocale, ttsRate, ttsPitch, emotionKey) => {
    try {
      if (ttsLocale) await Tts.setDefaultLanguage(ttsLocale);
      await Tts.setDefaultRate(ttsRate || 0.5);
      await Tts.setDefaultPitch(ttsPitch || 1.0);
      Tts.speak(ttsText);
    } catch (e) {
      setSpeakingEmotion(null);
    }
  };

  const handlePress = async (emotion) => {
    if (!text?.trim()) {
      Alert.alert('Translate first', 'Please translate some text first.');
      return;
    }

    // Same emotion tapping again → stop
    if (speakingEmotion === emotion.key) {
      stopAll();
      return;
    }

    // Stop any currently playing
    stopAll();

    setLoadingEmotion(emotion.key);

    try {
      const result = await rephraseEmotion({
        text: text.trim(),
        emotion: emotion.key,
        targetLang: targetLang || 'hi',
      });

      setSpeakingEmotion(emotion.key);

      if (result.audioUrl) {
        const fullUrl = `${BASE_URL}${result.audioUrl}`;
        console.log('[EmotionSelector] Playing:', fullUrl);
        playAudioUrl(fullUrl, emotion.key, text.trim(), result.ttsRate, result.ttsPitch);
      } else {
        // No audio URL — device TTS fallback
        await playTTS(text.trim(), locale, result.ttsRate, result.ttsPitch, emotion.key);
      }
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
        const isLoading  = loadingEmotion === emotion.key;
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
