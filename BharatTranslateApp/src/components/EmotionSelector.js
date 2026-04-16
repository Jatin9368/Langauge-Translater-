import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator,
} from 'react-native';
import Tts from 'react-native-tts';
import Video from 'react-native-video';
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
  const [audioUrl, setAudioUrl] = useState(null);
  const videoRef = useRef(null);

  useEffect(() => {
    const ttsFinish = Tts.addEventListener('tts-finish', () => setSpeakingEmotion(null));
    const ttsCancel = Tts.addEventListener('tts-cancel', () => setSpeakingEmotion(null));
    const ttsError  = Tts.addEventListener('tts-error',  () => setSpeakingEmotion(null));
    return () => { ttsFinish.remove(); ttsCancel.remove(); ttsError.remove(); };
  }, []);

  const stopAll = () => {
    setAudioUrl(null);
    try { Tts.stop(); } catch (_) {}
    setSpeakingEmotion(null);
  };

  const playTTS = async (ttsText, ttsRate, ttsPitch) => {
    try {
      if (locale) await Tts.setDefaultLanguage(locale);
      await Tts.setDefaultRate(ttsRate || 0.5);
      await Tts.setDefaultPitch(ttsPitch || 1.0);
      console.log(`[TTS] Speaking: "${ttsText.slice(0, 30)}"`);
      Tts.speak(ttsText);
    } catch (e) {
      console.warn('[TTS] Error:', e.message);
      setSpeakingEmotion(null);
    }
  };

  const handlePress = async (emotion) => {
    if (!text?.trim()) {
      Alert.alert('Translate first', 'Please translate some text first.');
      return;
    }

    // Same emotion → stop
    if (speakingEmotion === emotion.key) {
      stopAll();
      return;
    }

    // Different emotion playing → stop first
    if (speakingEmotion) stopAll();

    setLoadingEmotion(emotion.key);
    console.log(`[EmotionSelector] Button pressed: ${emotion.key}`);

    try {
      const result = await rephraseEmotion({
        text: text.trim(),
        emotion: emotion.key,
        targetLang: targetLang || 'hi',
      });

      console.log(`[EmotionSelector] API result: engine=${result.engine} audioUrl=${result.audioUrl}`);

      setSpeakingEmotion(emotion.key);

      if (result.audioUrl) {
        // Play from backend URL
        const fullUrl = `${BASE_URL}${result.audioUrl}?t=${Date.now()}`;
        console.log(`[EmotionSelector] Playing URL: ${fullUrl}`);
        setAudioUrl(fullUrl);
      } else {
        // No audio → device TTS with correct locale
        console.log(`[EmotionSelector] No audioUrl, using device TTS (${locale})`);
        await playTTS(result.voiceText || text.trim(), result.ttsRate, result.ttsPitch);
      }
    } catch (err) {
      console.warn('[EmotionSelector] Error:', err.message);
      setSpeakingEmotion(null);
      Alert.alert('Error', err.message || 'Could not play voice.');
    } finally {
      setLoadingEmotion(null);
    }
  };

  return (
    <View>
      {/* Hidden Video player for audio playback */}
      {audioUrl ? (
        <Video
          ref={videoRef}
          source={{ uri: audioUrl }}
          audioOnly={true}
          playInBackground={false}
          playWhenInactive={false}
          style={{ width: 0, height: 0, position: 'absolute' }}
          onLoad={() => console.log('[Video] Audio loaded, playing...')}
          onEnd={() => {
            console.log('[Video] Audio ended');
            setSpeakingEmotion(null);
            setAudioUrl(null);
          }}
          onError={(e) => {
            console.warn('[Video] Error:', JSON.stringify(e));
            setSpeakingEmotion(null);
            setAudioUrl(null);
            // Fallback to TTS on video error
            playTTS(text?.trim() || '', 0.5, 1.0);
          }}
        />
      ) : null}

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
              {isLoading
                ? <ActivityIndicator size="small" color={emotion.color} />
                : <Text style={styles.emoji}>{isSpeaking ? '⏹️' : emotion.emoji}</Text>
              }
              <Text style={[styles.label, { color: isSpeaking ? '#fff' : emotion.color }]}>
                {isLoading ? '...' : isSpeaking ? 'Stop' : emotion.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
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
