const express = require('express');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const router = express.Router();

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const AICTE_TTS_URL = 'https://pravahai.aicte-india.org/audiobook/api/tts/synthesize';

const AUDIO_DIR = path.join(__dirname, '../audio_cache');
if (!fs.existsSync(AUDIO_DIR)) fs.mkdirSync(AUDIO_DIR, { recursive: true });

// ─── AICTE TTS Config ────────────────────────────────────────────────────────
const AICTE_CONFIG = {
  love:  { emotion: 'loving',     gender: 'female', speed: 0.88, pitch: 2  },
  sad:   { emotion: 'melancholic', gender: 'female', speed: 0.82, pitch: -2 },
  happy: { emotion: 'joyful',     gender: 'male',   speed: 1.08, pitch: 3  },
  angry: { emotion: 'furious',    gender: 'male',   speed: 1.12, pitch: -4 },
};

// ─── ElevenLabs Config (fallback) ────────────────────────────────────────────
// Sarah (female) = Love & Sad | Adam (male) = Happy & Angry
const EL_CONFIG = {
  love: {
    voice_id: 'EXAVITQu4vr4xnSDxMaL', // Sarah
    // Soft, warm, caring — low stability = more expressive, high style = emotional
    voice_settings: { stability: 0.20, similarity_boost: 0.90, style: 0.80, use_speaker_boost: true },
    ttsRate: 0.44, ttsPitch: 1.15,
  },
  sad: {
    voice_id: 'EXAVITQu4vr4xnSDxMaL', // Sarah
    // Slow, heavy, emotional — very low stability = maximum emotion
    voice_settings: { stability: 0.15, similarity_boost: 0.88, style: 0.85, use_speaker_boost: true },
    ttsRate: 0.38, ttsPitch: 0.88,
  },
  happy: {
    voice_id: 'pNInz6obpgDQGcFmaJgB', // Adam
    // Energetic, cheerful, lively — low stability = upbeat variation
    voice_settings: { stability: 0.22, similarity_boost: 0.85, style: 0.82, use_speaker_boost: true },
    ttsRate: 0.52, ttsPitch: 1.18,
  },
  angry: {
    voice_id: 'pNInz6obpgDQGcFmaJgB', // Adam
    // Strong, sharp, aggressive — very low stability = intense delivery
    voice_settings: { stability: 0.10, similarity_boost: 0.92, style: 0.90, use_speaker_boost: true },
    ttsRate: 0.48, ttsPitch: 0.72,
  },
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

// ─── AICTE TTS ───────────────────────────────────────────────────────────────
const generateWithAicte = async (text, emotion, targetLang) => {
  const cfg = AICTE_CONFIG[emotion];
  if (!cfg) throw new Error('Unsupported emotion');

  const res = await axios.post(
    AICTE_TTS_URL,
    { text, language: getAicteLang(targetLang), gender: cfg.gender, emotion: cfg.emotion, speed: cfg.speed, pitch: cfg.pitch, model: 'full' },
    { headers: { 'Content-Type': 'application/json' }, responseType: 'arraybuffer', timeout: 12000 }
  );

  const filename = `emotion_${emotion}_${Date.now()}.wav`;
  fs.writeFileSync(path.join(AUDIO_DIR, filename), Buffer.from(res.data));
  return filename;
};

// ─── ElevenLabs TTS ──────────────────────────────────────────────────────────
const generateWithElevenLabs = async (text, emotion) => {
  const cfg = EL_CONFIG[emotion];
  if (!cfg || !ELEVENLABS_API_KEY) throw new Error('ElevenLabs not configured');

  const res = await axios.post(
    `https://api.elevenlabs.io/v1/text-to-speech/${cfg.voice_id}`,
    { text, model_id: 'eleven_multilingual_v2', voice_settings: cfg.voice_settings },
    {
      headers: { 'xi-api-key': ELEVENLABS_API_KEY, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      responseType: 'arraybuffer',
      timeout: 30000,
    }
  );

  const filename = `emotion_${emotion}_${Date.now()}.mp3`;
  fs.writeFileSync(path.join(AUDIO_DIR, filename), Buffer.from(res.data));
  return filename;
};

// ─── Cleanup: keep last 6 files ──────────────────────────────────────────────
const cleanupCache = () => {
  try {
    const files = fs.readdirSync(AUDIO_DIR)
      .filter(f => f.endsWith('.mp3') || f.endsWith('.wav'))
      .sort();
    if (files.length > 6) {
      files.slice(0, files.length - 6).forEach(f => {
        try { fs.unlinkSync(path.join(AUDIO_DIR, f)); } catch (_) {}
      });
    }
  } catch (_) {}
};

// ─── Serve audio ─────────────────────────────────────────────────────────────
router.get('/audio/:filename', (req, res) => {
  const filename = path.basename(req.params.filename);
  const filepath = path.resolve(AUDIO_DIR, filename);
  if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'Not found' });
  res.setHeader('Content-Type', filename.endsWith('.wav') ? 'audio/wav' : 'audio/mpeg');
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

    const elCfg = EL_CONFIG[emotionKey];
    const emojis = { love: '❤️', sad: '😢', angry: '😡', happy: '😄' };

    let audioUrl = null;
    let usedEngine = null;

    // ── Primary: AICTE TTS ──
    try {
      const filename = await generateWithAicte(text.trim(), emotionKey, targetLang);
      audioUrl = `/api/emotion/audio/${filename}`;
      usedEngine = 'aicte';
      console.log(`[AICTE TTS] ${emotionKey} OK: ${filename}`);
    } catch (e) {
      console.log(`[AICTE TTS] Failed: ${e.message} — ElevenLabs fallback`);

      // ── Fallback: ElevenLabs ──
      try {
        const filename = await generateWithElevenLabs(text.trim(), emotionKey);
        audioUrl = `/api/emotion/audio/${filename}`;
        usedEngine = 'elevenlabs';
        console.log(`[ElevenLabs] ${emotionKey} OK: ${filename}`);
      } catch (e2) {
        console.log(`[ElevenLabs] Failed: ${e2.message}`);
      }
    }

    // Cleanup AFTER generating — so new file is never deleted before serving
    cleanupCache();

    return res.json({
      success: true,
      voiceText: text.trim(),
      audioUrl,
      engine: usedEngine,
      ttsRate: elCfg.ttsRate,
      ttsPitch: elCfg.ttsPitch,
      emotion: emotionKey,
      emoji: emojis[emotionKey],
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
