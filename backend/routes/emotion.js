const express = require('express');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const router = express.Router();

// ─── AICTE TTS (Primary) ─────────────────────────────────────────────────────
const AICTE_TTS_URL = 'https://pravahai.aicte-india.org/audiobook/api/tts/synthesize';

// ─── Cartesia (Commented — kept for reference) ───────────────────────────────
// const CARTESIA_API_KEY = process.env.CARTESIA_API_KEY;
// const CARTESIA_URL = 'https://api.cartesia.ai/tts/bytes';

const AUDIO_DIR = path.join(__dirname, '../audio_cache');
if (!fs.existsSync(AUDIO_DIR)) fs.mkdirSync(AUDIO_DIR, { recursive: true });

const TTS_DEFAULTS = {
  love:  { ttsRate: 0.46, ttsPitch: 1.05, volume: 0.85, pauseMs: 350 },
  sad:   { ttsRate: 0.38, ttsPitch: 0.82, volume: 0.70, pauseMs: 400 },
  happy: { ttsRate: 0.55, ttsPitch: 1.18, volume: 1.00, pauseMs: 100 },
  angry: { ttsRate: 0.60, ttsPitch: 0.78, volume: 1.00, pauseMs: 80  },
};

// ─── AICTE Emotion Mapping ────────────────────────────────────────────────────
// AICTE supports 120+ emotions — mapping our 4 to best matches
const AICTE_EMOTION_MAP = {
  love:  { emotion: 'romantic',  speed: 0.85, pitch: 2  },
  sad:   { emotion: 'sad',       speed: 0.75, pitch: -3 },
  happy: { emotion: 'happy',     speed: 1.15, pitch: 2  },
  angry: { emotion: 'angry',     speed: 1.25, pitch: -2 },
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
const addSadPauses = (text) => {
  const words = text.trim().split(/\s+/);
  if (words.length <= 4) return text + '..';
  const chunks = [];
  for (let i = 0; i < words.length; i += 5) {
    chunks.push(words.slice(i, i + 5).join(' '));
  }
  return chunks.join('.. ') + '..';
};

// ─── AICTE TTS Generation ─────────────────────────────────────────────────────
const generateWithAICTE = async (text, emotion, lang) => {
  const emotionCfg = AICTE_EMOTION_MAP[emotion];
  const language = toAicteLang(lang);
  const transcript = emotion === 'sad' ? addSadPauses(text) : text;

  console.log(`[AICTE TTS] ${emotion}|${lang}→${language}|emotion=${emotionCfg.emotion}`);

  const res = await axios.post(
    AICTE_TTS_URL,
    {
      text: transcript,
      language,
      emotion: emotionCfg.emotion,
      speed: emotionCfg.speed,
      pitch: emotionCfg.pitch,
      model: 'fast',
    },
    {
      headers: { 'Content-Type': 'application/json' },
      responseType: 'arraybuffer',
      timeout: 60000,
    }
  );

  if (!res.data || res.data.byteLength < 100) throw new Error('AICTE TTS: empty response');
  const filename = `aicte_${emotion}_${Date.now()}.wav`;
  fs.writeFileSync(path.join(AUDIO_DIR, filename), Buffer.from(res.data));
  console.log(`[AICTE TTS] OK → ${filename} (${res.data.byteLength} bytes)`);
  return filename;
};

// ─── Cartesia TTS Generation (commented — kept for reference) ────────────────
/*
const VOICES = {
  telugu: {
    love:  { id: '38bded0a-3ab4-42d1-8e47-2e0b6b10ced9', speed: 'slow'    },
    sad:   { id: '38bded0a-3ab4-42d1-8e47-2e0b6b10ced9', speed: 'slowest' },
    angry: { id: '38bded0a-3ab4-42d1-8e47-2e0b6b10ced9', speed: 'fast'    },
    happy: { id: '38bded0a-3ab4-42d1-8e47-2e0b6b10ced9', speed: 'fast'    },
  },
  indian: {
    love:  { id: 'faf0731e-dfb9-4cfc-8119-259a79b27e12', speed: 'slow'    }, // Riya
    sad:   { id: '209d9a43-03eb-40d8-a7b7-51a6d54c052f', speed: 'slowest' }, // Anita
    angry: { id: 'fd2ada67-c2d9-4afe-b474-6386b87d8fc3', speed: 'fast'    }, // Inder
    happy: { id: 'faf0731e-dfb9-4cfc-8119-259a79b27e12', speed: 'fast'    }, // Riya
  },
  intl: {
    love:  { id: 'e07c00bc-4134-4eae-9ea4-1a55fb45746b', speed: 'slow'    }, // Brooke
    sad:   { id: '9626c31c-bec5-4cca-baa8-f8ba9e84c8bc', speed: 'slowest' }, // Jacqueline
    angry: { id: '5ee9feff-1265-424a-9d7f-8e4d431a12c7', speed: 'fast'    }, // Ronald
    happy: { id: 'a167e0f3-df7e-4d52-a9c3-f949145efdab', speed: 'fast'    }, // Blake
  },
};

const INDIAN_LANGS = new Set([
  'hi','bn','ta','te','mr','gu','kn','ml','pa','or',
  'as','ur','ne','sa','mai','sat','ks','kok','sd','doi','mni','brx',
]);

const getVoiceCfg = (lang, emotion) => {
  if (lang === 'te') return VOICES.telugu[emotion];
  return INDIAN_LANGS.has(lang) ? VOICES.indian[emotion] : VOICES.intl[emotion];
};

const generateWithCartesia = async (text, emotion, lang) => {
  const cfg = getVoiceCfg(lang, emotion);
  if (!cfg || !CARTESIA_API_KEY) throw new Error('Cartesia not configured');
  const transcript = emotion === 'sad' ? addSadPauses(text) : text;
  const emotionControls = {
    love:  { speed: cfg.speed, emotion: ['positivity:high', 'curiosity:low'] },
    sad:   { speed: cfg.speed, emotion: ['sadness:high', 'positivity:low']   },
    angry: { speed: cfg.speed, emotion: ['anger:high', 'positivity:low']     },
    happy: { speed: cfg.speed, emotion: ['positivity:high', 'surprise:low']  },
  };
  const res = await axios.post(
    CARTESIA_URL,
    {
      model_id: 'sonic-3',
      transcript,
      voice: { mode: 'id', id: cfg.id, __experimental_controls: emotionControls[emotion] },
      output_format: { container: 'mp3', encoding: 'mp3', sample_rate: 44100 },
    },
    {
      headers: { 'x-api-key': CARTESIA_API_KEY, 'Cartesia-Version': '2026-03-01', 'Content-Type': 'application/json' },
      responseType: 'arraybuffer',
      timeout: 25000,
    }
  );
  if (!res.data || res.data.byteLength < 100) throw new Error('Cartesia: empty response');
  const filename = `cartesia_${emotion}_${Date.now()}.mp3`;
  fs.writeFileSync(path.join(AUDIO_DIR, filename), Buffer.from(res.data));
  return filename;
};
*/

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

    try {
      filename = await generateWithAICTE(text.trim(), emotionKey, lang);
      usedEngine = 'aicte-tts';
    } catch (err) {
      console.log(`[AICTE TTS] Failed: ${err.message} — device TTS fallback`);
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
