const express = require('express');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const router = express.Router();

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const CARTESIA_API_KEY = process.env.CARTESIA_API_KEY;

const AUDIO_DIR = path.join(__dirname, '../audio_cache');
if (!fs.existsSync(AUDIO_DIR)) fs.mkdirSync(AUDIO_DIR, { recursive: true });

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
    love:  { id: '47f3bbb1-e98f-4e0c-92c5-5f0325e1e206', speed: 'slow'   }, // Neha
    sad:   { id: 'a81fccdc-5595-4dfc-ae76-4de6a515b8a2', speed: 'slow'   },// prabhavati
    angry: { id: '4877b818-c7fe-4c89-b1cf-eadf8e23da72', speed: 'normal' }, // Rohan
    happy: [
      { id: '910fb75e-1d20-4840-ac63-ac6b26a71bdc', speed: 'fast' },// boy
      { id: '47f3bbb1-e98f-4e0c-92c5-5f0325e1e206', speed: 'fast' }, // girl
    ],
  },
  intl: {
    love:  { id: '7ea5e9c2-b719-4dc3-b870-5ba5f14d31d8', speed: 'slow'   }, // arti
    sad:   { id: 'f8f5f1b2-f02d-4d8e-a40d-fd850a487b3d', speed: 'slow'   }, // ananyia
    angry: { id: '1259b7e3-cb8a-43df-9446-30971a46b8b0', speed: 'normal' }, // jr
    happy: [
      { id: '39d518b7-fd0b-4676-9b8b-29d64ff31e12', speed: 'fast' }, // Arnav
      { id: '7ea5e9c2-b719-4dc3-b870-5ba5f14d31d8', speed: 'fast' }, // arti
    ],
  },
};

const getVoiceCfg = (lang, emotion) => {
  const pool = INDIAN_LANGS.has(lang) ? VOICES.indian[emotion] : VOICES.intl[emotion];
  if (Array.isArray(pool)) return pool[Math.floor(Math.random() * pool.length)];
  return pool;
};

// ─── Cartesia TTS ─────────────────────────────────────────────────────────────
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

// ─── Language names ───────────────────────────────────────────────────────────
const LANG_NAMES = {
  hi:'Hindi', bn:'Bengali', ta:'Tamil', te:'Telugu', mr:'Marathi',
  gu:'Gujarati', kn:'Kannada', ml:'Malayalam', pa:'Punjabi', ur:'Urdu',
  or:'Odia', as:'Assamese', ne:'Nepali', en:'English', fr:'French',
  de:'German', es:'Spanish', ja:'Japanese', ko:'Korean', ar:'Arabic',
  ru:'Russian', 'zh-CN':'Chinese', pt:'Portuguese', it:'Italian', tr:'Turkish', nl:'Dutch',
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
      { model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: GROQ_PROMPTS[emotion](langName, text) }], max_tokens: 160, temperature: 0.80 },
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

    const voiceText = await rewriteWithGroq(text.trim(), emotionKey, lang);

    let filename = null;
    let usedEngine = 'device-tts';
    try {
      filename = await generateWithCartesia(voiceText, emotionKey, lang);
      usedEngine = 'cartesia';
    } catch (err) {
      console.log(`[Cartesia] Failed: ${err.message} — device TTS fallback`);
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
