import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, Animated,
} from 'react-native';
import Video from 'react-native-video';
import Tts from 'react-native-tts';
import { useTheme } from '../ThemeContext';
import { rephraseEmotion, BASE_URL } from '../api';

const EMOTIONS = [
  { key: 'love',  label: 'Love',  emoji: '❤️',  color: '#E91E63', glow: 'rgba(233,30,99,0.25)'  },
  { key: 'sad',   label: 'Sad',   emoji: '😢',  color: '#5C6BC0', glow: 'rgba(92,107,192,0.25)' },
  { key: 'angry', label: 'Angry', emoji: '😡',  color: '#F44336', glow: 'rgba(244,67,54,0.25)'  },
  { key: 'happy', label: 'Happy', emoji: '😄',  color: '#FF9800', glow: 'rgba(255,152,0,0.25)'  },
];

const EmotionSelector = ({ text, locale, targetLang, disabled }) => {
  const { theme, isDark } = useTheme();
  const s = makeStyles(theme, isDark);

  const [speakingEmotion, setSpeakingEmotion] = useState(null);
  const [loadingEmotion, setLoadingEmotion]   = useState(null);
  const [audioUrl, setAudioUrl]               = useState(null);
  const videoRef = useRef(null);
  const scaleAnims = useRef(EMOTIONS.map(() => new Animated.Value(1))).current;
  const glowAnims  = useRef(EMOTIONS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const f = Tts.addEventListener('tts-finish', () => setSpeakingEmotion(null));
    const c = Tts.addEventListener('tts-cancel', () => setSpeakingEmotion(null));
    const e = Tts.addEventListener('tts-error',  () => setSpeakingEmotion(null));
    return () => { f.remove(); c.remove(); e.remove(); };
  }, []);

  const animatePress = (idx) => {
    Animated.sequence([
      Animated.timing(scaleAnims[idx], { toValue: 0.92, duration: 80, useNativeDriver: true }),
      Animated.spring(scaleAnims[idx],  { toValue: 1, friction: 4, tension: 200, useNativeDriver: true }),
    ]).start();
  };

  const startGlow = (idx) => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnims[idx], { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(glowAnims[idx], { toValue: 0.4, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  };

  const stopGlow = (idx) => {
    glowAnims[idx].stopAnimation();
    glowAnims[idx].setValue(0);
  };

  const stopAll = () => {
    setAudioUrl(null);
    try { Tts.stop(); } catch (_) {}
    const idx = EMOTIONS.findIndex(e => e.key === speakingEmotion);
    if (idx >= 0) stopGlow(idx);
    setSpeakingEmotion(null);
  };

  const playDeviceTTS = async (ttsText, ttsRate, ttsPitch) => {
    try {
      if (locale) await Tts.setDefaultLanguage(locale);
      await Tts.setDefaultRate(ttsRate || 0.5);
      await Tts.setDefaultPitch(ttsPitch || 1.0);
      Tts.speak(ttsText);
    } catch (e) {
      console.warn('[TTS] Error:', e.message);
      setSpeakingEmotion(null);
    }
  };

  const handlePress = async (emotion, idx) => {
    if (!text?.trim()) {
      Alert.alert('Translate first', 'Please translate some text first.');
      return;
    }
    animatePress(idx);

    if (speakingEmotion === emotion.key) { stopAll(); return; }
    if (speakingEmotion) stopAll();

    setLoadingEmotion(emotion.key);

    try {
      const result = await rephraseEmotion({
        text: text.trim(),
        emotion: emotion.key,
        targetLang: targetLang || 'hi',
      });

      setSpeakingEmotion(emotion.key);
      startGlow(idx);

      if (result.audioUrl) {
        const fullUrl = `${BASE_URL}${result.audioUrl}?t=${Date.now()}`;
        setAudioUrl(fullUrl);
      } else {
        await playDeviceTTS(result.voiceText || text.trim(), result.ttsRate, result.ttsPitch);
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
      {audioUrl && (
        <Video
          ref={videoRef}
          source={{ uri: audioUrl }}
          audioOnly={true}
          paused={false}
          volume={1.0}
          playInBackground={true}
          playWhenInactive={true}
          ignoreSilentSwitch="ignore"
          style={{ width: 1, height: 1, position: 'absolute', opacity: 0 }}
          onEnd={() => {
            const idx = EMOTIONS.findIndex(e => e.key === speakingEmotion);
            if (idx >= 0) stopGlow(idx);
            setSpeakingEmotion(null);
            setAudioUrl(null);
          }}
          onError={() => { setSpeakingEmotion(null); setAudioUrl(null); }}
        />
      )}

      <View style={s.row}>
        {EMOTIONS.map((emotion, idx) => {
          const isSpeaking = speakingEmotion === emotion.key;
          const isLoading  = loadingEmotion  === emotion.key;
          const isActive   = isSpeaking || isLoading;

          return (
            <Animated.View
              key={emotion.key}
              style={[
                s.btnWrap,
                { transform: [{ scale: scaleAnims[idx] }] },
                isActive && {
                  shadowColor: emotion.glow,
                  shadowOpacity: glowAnims[idx],
                  shadowRadius: 12,
                  elevation: 8,
                },
              ]}
            >
              <TouchableOpacity
                style={[
                  s.btn,
                  { borderColor: isActive ? emotion.color : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' },
                  isActive
                    ? { backgroundColor: emotion.color }
                    : { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#fff' },
                  disabled && s.btnDisabled,
                ]}
                onPress={() => handlePress(emotion, idx)}
                disabled={disabled || !!loadingEmotion}
                activeOpacity={0.85}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color={isActive ? '#fff' : emotion.color} />
                ) : (
                  <Text style={s.emoji}>{isSpeaking ? '⏹' : emotion.emoji}</Text>
                )}
                <Text style={[s.label, { color: isActive ? '#fff' : emotion.color }]}>
                  {isLoading ? '...' : isSpeaking ? 'Stop' : emotion.label}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
};

const makeStyles = (theme, isDark) => StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, marginTop: 10 },
  btnWrap: {
    flex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  btn: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 13, borderRadius: 16, borderWidth: 1.5,
    gap: 5,
  },
  btnDisabled: { opacity: 0.35 },
  emoji: { fontSize: 22 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
});

export default EmotionSelector;
