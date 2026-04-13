const express = require('express');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const router = express.Router();

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const AICTE_TTS_URL = 'https://pravahai.aicte-india.org/audiobook/api/tts/synthesize';

const AUDIO_DIR = path.join(__dirname, '../audio_cache');
if (!fs.existsSync(AUDIO_DIR)) fs.mkdirSync(AUDIO_DIR, { recursive: true });

// ─── AICTE TTS Emotion Mapping ───────────────────────────────────────────────
// Emotion families from AICTE docs: joy, sadness, anger, love, etc.
const AICTE_EMOTION_CONFIG = {
  love:  { emotion: 'romantic',  gender: 'female', speed: 0.95, pitch: 1  },
  sad:   { emotion: 'sad',       gender: 'female', speed: 0.90, pitch: -1 },
  happy: { emotion: 'happy',     gender: 'male',   speed: 1.05, pitch: 1  },
  angry: { emotion: 'angry',     gender: 'male',   speed: 1.0,  pitch: -2 },
};

// ─── ElevenLabs Config (fallback) ────────────────────────────────────────────
// Female voice for Love & Sad — Male voice for Happy & Angry
const ELEVENLABS_CONFIG = {
  love: {
    voice_id: 'EXAVITQu4vr4xnSDxMaL', // Sarah — soft, warm female
    voice_settings: { stability: 0.3, similarity_boost: 0.85, style: 0.75, use_speaker_boost: true },
    ttsRate: 0.45, ttsPitch: 1.1,
  },
  sad: {
    voice_id: 'EXAVITQu4vr4xnSDxMaL', // Sarah — soft female, emotional
    voice_settings: { stability: 0.3, similarity_boost: 0.85, style: 0.75, use_speaker_boost: true },
    ttsRate: 0.42, ttsPitch: 0.92,
  },
  happy: {
    voice_id: 'pNInz6obpgDQGcFmaJgB', // Adam — energetic male
    voice_settings: { stability: 0.3, similarity_boost: 0.85, style: 0.75, use_speaker_boost: true },
    ttsRate: 0.50, ttsPitch: 1.1,
  },
  angry: {
    voice_id: 'pNInz6obpgDQGcFmaJgB', // Adam — deep dominant male
    voice_settings: { stability: 0.3, similarity_boost: 0.85, style: 0.75, use_speaker_boost: true },
    ttsRate: 0.44, ttsPitch: 0.78,
  },
};

// Language code → AICTE TTS language code (short 2-letter)
const AICTE_LANG_MAP = {
  'hi-IN': 'hi', 'en-IN': 'en', 'en-US': 'en', 'en-GB': 'en',
  'bn-IN': 'bn', 'ta-IN': 'ta', 'te-IN': 'te', 'mr-IN': 'mr',
  'gu-IN': 'gu', 'kn-IN': 'kn', 'ml-IN': 'ml', 'pa-IN': 'pa',
  'as-IN': 'as', 'or-IN': 'or', 'ur-IN': 'ur',
  hi: 'hi', en: 'en', bn: 'bn', ta: 'ta', te: 'te', mr: 'mr',
  gu: 'gu', kn: 'kn', ml: 'ml', pa: 'pa', as: 'as', or: 'or', ur: 'ur',
};

const getAicteLang = (targetLang) => {
  if (!targetLang) return 'hi';
  return AICTE_LANG_MAP[targetLang] || AICTE_LANG_MAP[targetLang?.split('-')[0]] || 'hi';
};

// ─── AICTE TTS ───────────────────────────────────────────────────────────────
const generateWithAicteTTS = async (text, emotion, targetLang) => {
  const cfg = AICTE_EMOTION_CONFIG[emotion];
  if (!cfg) throw new Error('AICTE TTS: unsupported emotion');

  const language = getAicteLang(targetLang);

  const response = await axios.post(
    AICTE_TTS_URL,
    {
      text,
      language,
      gender: cfg.gender,
      emotion: cfg.emotion,
      speed: cfg.speed,
      pitch: cfg.pitch,
      model: 'full',
    },
    {
      headers: { 'Content-Type': 'application/json' },
      responseType: 'arraybuffer',
      timeout: 30000,
    }
  );

  const filename = `emotion_${emotion}_${Date.now()}.wav`;
  const filepath = path.join(AUDIO_DIR, filename);
  fs.writeFileSync(filepath, Buffer.from(response.data));
  return filename;
};

// ─── ElevenLabs TTS (fallback) ───────────────────────────────────────────────
const generateWithElevenLabs = async (text, emotion) => {
  const config = ELEVENLABS_CONFIG[emotion];
  if (!config || !ELEVENLABS_API_KEY) throw new Error('ElevenLabs not configured');

  const response = await axios.post(
    `https://api.elevenlabs.io/v1/text-to-speech/${config.voice_id}`,
    {
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: config.voice_settings,
    },
    {
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      responseType: 'arraybuffer',
      timeout: 30000,
    }
  );

  const filename = `emotion_${emotion}_${Date.now()}.mp3`;
  const filepath = path.join(AUDIO_DIR, filename);
  fs.writeFileSync(filepath, Buffer.from(response.data));
  return filename;
};

// ─── Cleanup old audio files ─────────────────────────────────────────────────
const cleanupAudioCache = () => {
  try {
    const files = fs.readdirSync(AUDIO_DIR)
      .filter(f => f.endsWith('.mp3') || f.endsWith('.wav'))
      .sort();
    if (files.length > 20) {
      files.slice(0, files.length - 20).forEach(f => {
        try { fs.unlinkSync(path.join(AUDIO_DIR, f)); } catch (e) {}
      });
    }
  } catch (e) {}
};

// ─── Serve audio ─────────────────────────────────────────────────────────────
router.get('/audio/:filename', (req, res) => {
  const filepath = path.join(AUDIO_DIR, req.params.filename);
  if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'Not found' });
  const isWav = req.params.filename.endsWith('.wav');
  res.setHeader('Content-Type', isWav ? 'audio/wav' : 'audio/mpeg');
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(filepath);
});

// ─── POST /api/emotion/rephrase ───────────────────────────────────────────────
router.post('/rephrase', async (req, res, next) => {
  try {
    const { text, emotion, targetLang } = req.body;
    if (!text?.trim()) return res.status(400).json({ success: false, error: 'Text is required' });

    const emotionKey = emotion?.toLowerCase();
    if (!['love', 'sad', 'angry', 'happy'].includes(emotionKey)) {
      return res.status(400).json({ success: false, error: 'Invalid emotion' });
    }

    const elConfig = ELEVENLABS_CONFIG[emotionKey];
    const emojis = { love: '❤️', sad: '😢', angry: '😡', happy: '😄' };

    let audioUrl = null;
    let usedEngine = null;

    // ── Primary: AICTE TTS ──
    try {
      const filename = await generateWithAicteTTS(text.trim(), emotionKey, targetLang);
      audioUrl = `/api/emotion/audio/${filename}`;
      usedEngine = 'aicte';
      cleanupAudioCache();
      console.log(`[AICTE TTS] ${emotionKey} OK: ${filename}`);
    } catch (aicteErr) {
      console.log(`[AICTE TTS] Failed: ${aicteErr.message} — ElevenLabs fallback`);

      // ── Fallback: ElevenLabs ──
      try {
        const filename = await generateWithElevenLabs(text.trim(), emotionKey);
        audioUrl = `/api/emotion/audio/${filename}`;
        usedEngine = 'elevenlabs';
        cleanupAudioCache();
        console.log(`[ElevenLabs] ${emotionKey} OK: ${filename}`);
      } catch (elErr) {
        console.log(`[ElevenLabs] Failed: ${elErr.message}`);
      }
    }

    return res.json({
      success: true,
      voiceText: text.trim(),
      audioUrl,
      engine: usedEngine,
      ttsRate: elConfig.ttsRate,
      ttsPitch: elConfig.ttsPitch,
      emotion: emotionKey,
      emoji: emojis[emotionKey],
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
