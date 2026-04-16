const express = require('express');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const router = express.Router();

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const CARTESIA_API_KEY = process.env.CARTESIA_API_KEY;

const AUDIO_DIR = path.join(__dirname, '../audio_cache');
if (!fs.existsSync(AUDIO_DIR)) fs.mkdirSync(AUDIO_DIR, { recursive: true });

// ─── Cartesia — COMMENTED OUT ─────────────────────────────────────────────────
// const CARTESIA_API_KEY = process.env.CARTESIA_API_KEY;
// const VOICES = { ... };
// const generateWithCartesia = async (text, emotion, lang) => { ... };

// ─── TTS defaults (device TTS fallback) ──────────────────────────────────────
const TTS_DEFAULTS = {
  love:  { ttsRate: 0.40, ttsPitch: 1.15 },
  sad:   { ttsRate: 0.36, ttsPitch: 0.85 },
  happy: { ttsRate: 0.54, ttsPitch: 1.20 },
  angry: { ttsRate: 0.50, ttsPitch: 0.70 },
};

// ─── Cartesia Voice IDs ───────────────────────────────────────────────────────
const INDIAN_LANGS = new Set(['hi','bn','ta','te','mr','gu','kn','ml','pa','or','as','ur','ne','sa','mai','sat','ks','kok','sd','doi','mni','brx']);
const VOICES = {
  indian: {
    love:  { id: 'faf0731e-dfb9-4cfc-8119-259a79b27e12', speed: 'slow'   },
    sad:   { id: 'faf0731e-dfb9-4cfc-8119-259a79b27e12', speed: 'slow'   },
    angry: { id: '5ee9feff-1265-424a-9d7f-8e4d431a12c7', speed: 'normal' },
    happy: [
      { id: 'faf0731e-dfb9-4cfc-8119-259a79b27e12', speed: 'fast' },
      { id: '64a1b2c3d4e5f6g7h8i9j0k', speed: 'fast' },
    ],
  },
  intl: {
    love:  { id: 'e07c00bc-4134-4eae-9ea4-1a55fb45746b', speed: 'slow'   },
    sad:   { id: '9626c31c-bec5-4cca-baa8-f8ba9e84c8bc', speed: 'slow'   },
    angry: { id: '5ee9feff-1265-424a-9d7f-8e4d431a12c7', speed: 'normal' },
    happy: [
      { id: 'a167e0f3-df7e-4d52-a9c3-f949145efdab', speed: 'fast' },
      { id: 'e07c00bc-4134-4eae-9ea4-1a55fb45746b', speed: 'fast' },
    ],
  },
};
const getVoiceCfg = (lang, emotion) => {
  const pool = INDIAN_LANGS.has(lang) ? VOICES.indian[emotion] : VOICES.intl[emotion];
  if (Array.isArray(pool)) return pool[Math.floor(Math.random() * pool.length)];
  return pool;
};

const generateWithCartesia = async (text, emotion, lang) => {
  const cfg = getVoiceCfg(lang, emotion);
  if (!cfg || !CARTESIA_API_KEY) throw new Error('Cartesia not configured');
  console.log(`[Cartesia] ${emotion}|${lang}|voice=${cfg.id}`);
  const res = await axios.post(
    'https://api.cartesia.ai/tts/bytes',
    { model_id: 'sonic-3', transcript: text, voice: { mode: 'id', id: cfg.id, __experimental_controls: { speed: cfg.speed } }, output_format: { container: 'mp3', encoding: 'mp3', sample_rate: 44100 } },
    { headers: { 'x-api-key': CARTESIA_API_KEY, 'Cartesia-Version': '2026-03-01', 'Content-Type': 'application/json' }, responseType: 'arraybuffer', timeout: 25000 }
  );
  if (!res.data || res.data.byteLength < 100) throw new Error('Cartesia: empty response');
  const filename = `cartesia_${emotion}_${Date.now()}.mp3`;
  fs.writeFileSync(path.join(AUDIO_DIR, filename), Buffer.from(res.data));
  console.log(`[Cartesia] OK → ${filename} (${res.data.byteLength} bytes)`);
  return filename;
};

// ─── AICTE — COMMENTED OUT (DNS not resolving) ───────────────────────────────
// const AICTE_URL = 'https://pravahai.aicte-india.org/audiobook/api/tts/synthesize';
// const generateWithAICTE = async (...) => { ... };

const AICTE_SUPPORTED = new Set([
  'hi','bn','ta','te','mr','gu','kn','ml','pa','or','as','ur','ne','sa',
  'mai','sat','ks','kok','sd','doi','mni','brx','en',
]);

// Emotion mapping → AICTE emotion IDs
const AICTE_EMOTION = {
  love:  { emotion: 'romantic',  gender: 'female', speed: 0.90, pitch: 2  },
  sad:   { emotion: 'sad',       gender: 'female', speed: 0.85, pitch: -2 },
  happy: { emotion: 'joyful',    gender: 'female', speed: 1.10, pitch: 3  },
  angry: { emotion: 'angry',     gender: 'male',   speed: 1.05, pitch: -3 },
};

const generateWithAICTE = async (text, emotion, lang) => {
  const cfg = AICTE_EMOTION[emotion];
  const language = AICTE_SUPPORTED.has(lang) ? lang : 'hi';

  console.log(`[AICTE TTS] ${emotion} | ${language}`);
  const res = await axios.post(
    AICTE_URL,
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
      timeout: 90000,
    }
  );

  if (!res.data || res.data.byteLength < 100) throw new Error('AICTE: empty response');

  const filename = `aicte_${emotion}_${Date.now()}.wav`;
  fs.writeFileSync(path.join(AUDIO_DIR, filename), Buffer.from(res.data));
  console.log(`[AICTE TTS] OK → ${filename} (${res.data.byteLength} bytes)`);
  return filename;
};

// ─── Language names ───────────────────────────────────────────────────────────
const LANG_NAMES = {
  hi:'Hindi', bn:'Bengali', ta:'Tamil', te:'Telugu', mr:'Marathi',
  gu:'Gujarati', kn:'Kannada', ml:'Malayalam', pa:'Punjabi', ur:'Urdu',
  or:'Odia', as:'Assamese', ne:'Nepali', en:'English', fr:'French',
  de:'German', es:'Spanish', ja:'Japanese', ko:'Korean', ar:'Arabic',
  ru:'Russian', 'zh-CN':'Chinese', pt:'Portuguese', it:'Italian',
  tr:'Turkish', nl:'Dutch',
};

// ─── Groq Emotion Rewrite ─────────────────────────────────────────────────────
const GROQ_PROMPTS = {
  love:  (lang, text) => `You are a voice script writer. Add soft, warm, romantic emotional expression around this sentence for TTS.\nStyle: gentle pauses (...), tender fillers, warm flow.\nSTRICT: Output must be 100% ${lang} only. Original sentence unchanged. Max 2 sentences. No labels.\nInput (${lang}): ${text}`,
  sad:   (lang, text) => `You are a voice script writer. Add broken, heavy, emotional expression around this sentence for TTS.\nStyle: slow pauses (...), cracking voice feel, heavy words.\nSTRICT: Output must be 100% ${lang} only. Original sentence unchanged. Max 2 sentences. No labels.\nInput (${lang}): ${text}`,
  angry: (lang, text) => `You are a voice script writer. Add sharp, aggressive, intense expression around this sentence for TTS.\nStyle: short punchy sentences, strong words, no softness.\nSTRICT: Output must be 100% ${lang} only. Original sentence unchanged. Max 2 sentences. No labels.\nInput (${lang}): ${text}`,
  happy: (lang, text) => `You are a voice script writer. Add energetic, excited, joyful expression around this sentence for TTS.\nStyle: exclamations, fast rhythm, celebratory words.\nSTRICT: Output must be 100% ${lang} only. Original sentence unchanged. Max 2 sentences. No labels.\nInput (${lang}): ${text}`,
};

const rewriteWithGroq = async (text, emotion, lang) => {
  if (!GROQ_API_KEY) return text;
  const langName = LANG_NAMES[lang] || lang;
  try {
    const res = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: GROQ_PROMPTS[emotion](langName, text) }],
        max_tokens: 160,
        temperature: 0.80,
      },
      { headers: { Authorization: `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' }, timeout: 12000 }
    );
    const out = res.data?.choices?.[0]?.message?.content?.trim();
    if (out) { console.log(`[Groq] ${emotion}(${lang}): "${out.slice(0, 80)}"`); return out; }
  } catch (e) { console.log(`[Groq] Failed: ${e.message}`); }
  return text;
};

// ─── Cleanup ──────────────────────────────────────────────────────────────────
const cleanupCache = (exclude = null) => {
  try {
    const files = fs.readdirSync(AUDIO_DIR)
      .filter(f => (f.endsWith('.mp3') || f.endsWith('.wav')) && f !== exclude).sort();
    if (files.length > 10)
      files.slice(0, files.length - 10).forEach(f => { try { fs.unlinkSync(path.join(AUDIO_DIR, f)); } catch (_) {} });
  } catch (_) {}
};

// ─── Serve audio ──────────────────────────────────────────────────────────────
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
    const { ttsRate, ttsPitch } = TTS_DEFAULTS[emotionKey];

    // Direct Cartesia — no Groq rewrite for faster response
    const voiceText = text.trim();

    // Hindi/English/Hinglish → Cartesia, other languages → device TTS
    const CARTESIA_LANGS = new Set(['hi', 'en', 'hinglish']);
    let filename = null;
    let usedEngine = 'device-tts';

    if (CARTESIA_LANGS.has(lang)) {
      try {
        filename = await generateWithCartesia(voiceText, emotionKey, lang);
        usedEngine = 'cartesia';
      } catch (err) {
        console.log(`[Cartesia] Failed: ${err.message} — device TTS fallback`);
      }
    } else {
      console.log(`[Emotion] lang=${lang} → device TTS (no Cartesia voice available)`);
    }

    cleanupCache(filename);

    return res.json({
      success: true,
      voiceText,
      audioUrl: filename ? `/api/emotion/audio/${filename}` : null,
      engine: usedEngine,
      ttsRate,
      ttsPitch,
      emotion: emotionKey,
      emoji: emojis[emotionKey],
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
