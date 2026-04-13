const express = require('express');
const axios = require('axios');
const router = express.Router();

const AICTE_TTS_URL = 'https://pravahai.aicte-india.org/audiobook/api/tts/synthesize';

// ─── AICTE TTS Config ────────────────────────────────────────────────────────
// model: 'fast' = 4-5s response
const AICTE_CONFIG = {
  love:  { emotion: 'loving',      gender: 'female', speed: 0.88, pitch: 2  },
  sad:   { emotion: 'melancholic', gender: 'female', speed: 0.82, pitch: -2 },
  happy: { emotion: 'joyful',      gender: 'male',   speed: 1.08, pitch: 3  },
  angry: { emotion: 'furious',     gender: 'male',   speed: 1.12, pitch: -4 },
};

// TTS device fallback rates
const TTS_RATES = {
  love:  { ttsRate: 0.44, ttsPitch: 1.15 },
  sad:   { ttsRate: 0.38, ttsPitch: 0.88 },
  happy: { ttsRate: 0.52, ttsPitch: 1.18 },
  angry: { ttsRate: 0.48, ttsPitch: 0.72 },
};

// Language code → AICTE short code
const AICTE_LANG_MAP = {
  hi: 'hi', en: 'en', bn: 'bn', ta: 'ta', te: 'te', mr: 'mr',
  gu: 'gu', kn: 'kn', ml: 'ml', pa: 'pa', as: 'as', or: 'or', ur: 'ur',
  'hi-IN': 'hi', 'en-IN': 'en', 'en-US': 'en', 'bn-IN': 'bn',
  'ta-IN': 'ta', 'te-IN': 'te', 'mr-IN': 'mr', 'gu-IN': 'gu',
  'kn-IN': 'kn', 'ml-IN': 'ml', 'pa-IN': 'pa',
};

const getAicteLang = (lang) => {
  if (!lang) return 'hi';
  return AICTE_LANG_MAP[lang] || AICTE_LANG_MAP[lang.split('-')[0]] || 'hi';
};

// ─── ElevenLabs — COMMENTED OUT ──────────────────────────────────────────────
// const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
// const EL_CONFIG = { love: { voice_id: 'EXAVITQu4vr4xnSDxMaL', ... }, ... };
// const generateWithElevenLabs = async (text, emotion) => { ... };

// ─── POST /api/emotion/rephrase ───────────────────────────────────────────────
router.post('/rephrase', async (req, res, next) => {
  try {
    const { text, emotion, targetLang } = req.body;
    if (!text?.trim()) return res.status(400).json({ success: false, error: 'Text is required' });

    const emotionKey = emotion?.toLowerCase();
    if (!['love', 'sad', 'angry', 'happy'].includes(emotionKey)) {
      return res.status(400).json({ success: false, error: 'Invalid emotion' });
    }

    const cfg = AICTE_CONFIG[emotionKey];
    const rates = TTS_RATES[emotionKey];
    const emojis = { love: '❤️', sad: '😢', angry: '😡', happy: '😄' };

    let audioBase64 = null;
    let usedEngine = null;

    // ── AICTE TTS — returns WAV as base64 directly (no file system) ──
    try {
      const response = await axios.post(
        AICTE_TTS_URL,
        {
          text: text.trim(),
          language: getAicteLang(targetLang),
          gender: cfg.gender,
          emotion: cfg.emotion,
          speed: cfg.speed,
          pitch: cfg.pitch,
          model: 'fast',
        },
        {
          headers: { 'Content-Type': 'application/json' },
          responseType: 'arraybuffer',
          timeout: 15000,
        }
      );

      audioBase64 = Buffer.from(response.data).toString('base64');
      usedEngine = 'aicte';
      console.log(`[AICTE TTS] ${emotionKey} OK (${response.data.byteLength} bytes)`);
    } catch (e) {
      console.log(`[AICTE TTS] Failed: ${e.message}`);
    }

    return res.json({
      success: true,
      voiceText: text.trim(),
      audioBase64,        // WAV audio as base64 string
      audioMime: 'audio/wav',
      engine: usedEngine,
      ttsRate: rates.ttsRate,
      ttsPitch: rates.ttsPitch,
      emotion: emotionKey,
      emoji: emojis[emotionKey],
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
