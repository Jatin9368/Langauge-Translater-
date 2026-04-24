const express = require('express');
const axios = require('axios');``
const path = require('path');
const fs = require('fs');
const router = express.Router();

// ─── AICTE TTS (Primary for love/happy) ──────────────────────────────────────
const AICTE_TTS_URL = 'https://pravahai.aicte-india.org/audiobook/api/tts/synthesize';

// ─── Cartesia (Primary for sad/angry) ────────────────────────────────────────
const CARTESIA_API_KEY = process.env.CARTESIA_API_KEY;
const CARTESIA_URL = 'https://api.cartesia.ai/tts/bytes';

const AUDIO_DIR = path.join(__dirname, '../audio_cache');
if (!fs.existsSync(AUDIO_DIR)) fs.mkdirSync(AUDIO_DIR, { recursive: true });

const TTS_DEFAULTS = {
  love:  { ttsRate: 0.44, ttsPitch: 1.05, volume: 0.62, pauseMs: 290 }, // soft, slow, gentle — daba hua pyar
  sad:   { ttsRate: 0.32, ttsPitch: 0.72, volume: 0.48, pauseMs: 580 }, // range: 500–700 — dukhi, dabi awaaz
  happy: { ttsRate: 0.52, ttsPitch: 1.12, volume: 0.95, pauseMs: 140 }, // range: 100–150
  angry: { ttsRate: 0.62, ttsPitch: 0.72, volume: 1.15, pauseMs:  60 }, // range:  50–80
};

// ─── AICTE Emotion Mapping ────────────────────────────────────────────────────
// AICTE supports 120+ emotions — mapping our 4 to best matches
const AICTE_EMOTION_MAP = {
  love:  { speed: 0.95, pitch: -1.5 }, // natural speed, soft men voice = pyar se bolna
  happy: { speed: 1.05, pitch: -1.0 }, // men voice, slightly fast = khushi
  sad:   { speed: 0.92, pitch: 0.8  }, // fallback only
  angry: { speed: 1.08, pitch: 0.9  }, // fallback only
};

// ─── AICTE Language Code Mapping ─────────────────────────────────────────────
const AICTE_LANG_MAP = {
  hi: 'hi', bn: 'bn', ta: 'ta', te: 'te', mr: 'mr',
  gu: 'gu', kn: 'kn', ml: 'ml', pa: 'pa', or: 'or',
  as: 'as', ur: 'ur', ne: 'ne', sa: 'sa', en: 'en',
  mai: 'hi', sat: 'hi', ks: 'hi', kok: 'mr', sd: 'ur',
  doi: 'hi', 'mni-Mtei': 'bn', brx: 'hi',
  // Foreign languages fallback to English
  es: 'en', fr: 'en', de: 'en', ja: 'en', ko: 'en',
  ar: 'en', ru: 'en', pt: 'en', it: 'en', tr: 'en',
  zh: 'en', 'zh-CN': 'en',
};

const toAicteLang = (lang) => AICTE_LANG_MAP[lang] || 'hi';

// ─── Add natural pauses to sad text ──────────────────────────────────────────
const addSadPauses = (text) => text.trim(); // no chunks — pure AICTE sad emotion

// ─── Add soft pauses to love text ────────────────────────────────────────────
const addLovePauses = (text) => {
  const words = text.trim().split(/\s+/);
  if (words.length <= 4) return text;
  const chunks = [];
  for (let i = 0; i < words.length; i += 5) {
    chunks.push(words.slice(i, i + 5).join(' '));
  }
  return chunks.join(', '); // gentle flow with soft pauses
};

// ─── AICTE TTS Generation ─────────────────────────────────────────────────────
const generateWithAICTE = async (text, emotion, lang) => {
  const emotionCfg = AICTE_EMOTION_MAP[emotion];
  const language = toAicteLang(lang);
  const transcript = emotion === 'sad' ? addSadPauses(text) : emotion === 'love' ? addLovePauses(text) : text;

  console.log(`[AICTE TTS] ${emotion}|${lang}→${language}`);

  const res = await axios.post(
    AICTE_TTS_URL,
    {
      text: transcript,
      language,
      speed: emotionCfg.speed,
      pitch: emotionCfg.pitch,
      model: 'fast',
      // emotion field intentionally omitted — AICTE announces it in audio
    },
    {
      headers: { 'Content-Type': 'application/json' },
      responseType: 'arraybuffer',
      timeout: 20000, // reduced from 60s — fail fast, fallback to device TTS
    }
  );

  if (!res.data || res.data.byteLength < 100) throw new Error('AICTE TTS: empty response');
  const filename = `aicte_${emotion}_${Date.now()}.wav`;
  fs.writeFileSync(path.join(AUDIO_DIR, filename), Buffer.from(res.data));
  console.log(`[AICTE TTS] OK → ${filename} (${res.data.byteLength} bytes)`);
  return filename;
};

// ─── Cartesia TTS (sad/angry — human voice IDs) ──────────────────────────────
const CARTESIA_VOICES = {
  sad:   { id: '209d9a43-03eb-40d8-a7b7-51a6d54c052f', speed: 'slowest' }, // Anita — Indian women, dukhi
  angry: { id: 'fd2ada67-c2d9-4afe-b474-6386b87d8fc3', speed: 'fast'    }, // Inder — Indian men, gussa
};

const CARTESIA_EMOTION_CONTROLS = {
  sad:   { emotion: ['sadness:high',  'positivity:low']  },
  angry: { emotion: ['anger:high',    'positivity:low']  },
};

const generateWithCartesia = async (text, emotion) => {
  if (!CARTESIA_API_KEY) throw new Error('Cartesia API key not set');
  const cfg = CARTESIA_VOICES[emotion];
  if (!cfg) throw new Error(`Cartesia: no voice for ${emotion}`);

  const res = await axios.post(
    CARTESIA_URL,
    {
      model_id: 'sonic-3',
      transcript: text,
      voice: {
        mode: 'id',
        id: cfg.id,
        __experimental_controls: { speed: cfg.speed, ...CARTESIA_EMOTION_CONTROLS[emotion] },
      },
      output_format: { container: 'mp3', encoding: 'mp3', sample_rate: 44100 },
    },
    {
      headers: {
        'x-api-key': CARTESIA_API_KEY,
        'Cartesia-Version': '2026-03-01',
        'Content-Type': 'application/json',
      },
      responseType: 'arraybuffer',
      timeout: 25000,
    }
  );

  if (!res.data || res.data.byteLength < 100) throw new Error('Cartesia: empty response');
  const filename = `cartesia_${emotion}_${Date.now()}.mp3`;
  fs.writeFileSync(path.join(AUDIO_DIR, filename), Buffer.from(res.data));
  console.log(`[Cartesia] OK → ${filename} (${res.data.byteLength} bytes)`);
  return filename;
};

// ─── Cache Cleanup ────────────────────────────────────────────────────────────
const cleanupCache = (exclude = null) => {
  try {
    const files = fs.readdirSync(AUDIO_DIR)
      .filter(f => (f.endsWith('.mp3') || f.endsWith('.wav')) && f !== exclude).sort();
    if (files.length > 10)
      files.slice(0, files.length - 10).forEach(f => { try { fs.unlinkSync(path.join(AUDIO_DIR, f)); } catch (_) {} });
  } catch (_) {}
};

// ─── GET /api/emotion/audio/:filename ────────────────────────────────────────
router.get('/audio/:filename', (req, res) => {
  const filename = path.basename(req.params.filename);
  const filepath = path.join(AUDIO_DIR, filename);
  if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'Not found' });
  const mime = filename.endsWith('.wav') ? 'audio/wav' : 'audio/mpeg';
  res.setHeader('Content-Type', mime);
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Accept-Ranges', 'bytes');
  console.log(`[Audio] Serving: ${filename}`);
  res.sendFile(filepath);
});

// ─── POST /api/emotion/rephrase ───────────────────────────────────────────────
router.post('/rephrase', async (req, res, next) => {
  try {
    const { text, emotion, targetLang } = req.body;
    if (!text?.trim()) return res.status(400).json({ success: false, error: 'Text is required' });

    const emotionKey = emotion?.toLowerCase();
    if (!['love', 'sad', 'angry', 'happy'].includes(emotionKey))
      return res.status(400).json({ success: false, error: 'Invalid emotion' });

    const lang = targetLang || 'hi';
    console.log(`\n[Emotion] "${text.trim().slice(0, 40)}" | ${emotionKey} | ${lang}`);

    const emojis = { love: '❤️', sad: '😢', angry: '😡', happy: '😄' };
    const { ttsRate, ttsPitch, volume, pauseMs } = TTS_DEFAULTS[emotionKey];

    let filename = null;
    let usedEngine = 'device-tts';

    if (['sad', 'angry'].includes(emotionKey)) {
      // sad/angry: Cartesia first (human voice IDs), fallback to AICTE, then device TTS
      try {
        filename = await generateWithCartesia(text.trim(), emotionKey);
        usedEngine = 'cartesia-tts';
      } catch (err) {
        console.log(`[Cartesia] Failed: ${err.message} — trying AICTE`);
        try {
          filename = await generateWithAICTE(text.trim(), emotionKey, lang);
          usedEngine = 'aicte-tts';
        } catch (err2) {
          console.log(`[AICTE TTS] Failed: ${err2.message} — device TTS fallback`);
        }
      }
    } else {
      // love/happy: AICTE only, fallback to device TTS
      try {
        filename = await generateWithAICTE(text.trim(), emotionKey, lang);
        usedEngine = 'aicte-tts';
      } catch (err) {
        console.log(`[AICTE TTS] Failed: ${err.message} — device TTS fallback`);
      }
    }

    cleanupCache(filename);

    return res.json({
      success: true,
      voiceText: text.trim(),
      audioUrl: filename ? `/api/emotion/audio/${filename}` : null,
      engine: usedEngine,
      ttsRate,
      ttsPitch,
      volume,
      pauseMs,
      emotion: emotionKey,
      emoji: emojis[emotionKey],
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
