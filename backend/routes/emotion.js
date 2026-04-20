const express = require('express');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const router = express.Router();

const CARTESIA_API_KEY = process.env.CARTESIA_API_KEY;

const AUDIO_DIR = path.join(__dirname, '../audio_cache');
if (!fs.existsSync(AUDIO_DIR)) fs.mkdirSync(AUDIO_DIR, { recursive: true });

const TTS_DEFAULTS = {
  love:  { ttsRate: 0.42, ttsPitch: 1.08 },
  sad:   { ttsRate: 0.34, ttsPitch: 0.85 },
  happy: { ttsRate: 0.52, ttsPitch: 1.15 },
  angry: { ttsRate: 0.48, ttsPitch: 0.75 },
};

const INDIAN_LANGS = new Set([
  'hi','bn','ta','te','mr','gu','kn','ml','pa','or',
  'as','ur','ne','sa','mai','sat','ks','kok','sd','doi','mni','brx',
]);

const TELUGU_VOICE = '38bded0a-3ab4-42d1-8e47-2e0b6b10ced9';

const VOICES = {
  telugu: {
    love:  { id: TELUGU_VOICE, speed: 'slow'    },
    sad:   { id: TELUGU_VOICE, speed: 'slowest' },
    angry: { id: TELUGU_VOICE, speed: 'fast'    },
    happy: { id: TELUGU_VOICE, speed: 'fast'    },
  },
  indian: {
    love:  { id: 'faf0731e-dfb9-4cfc-8119-259a79b27e12', speed: 'slow'    }, // Riya
    sad:   { id: '9626c31c-bec5-4cca-baa8-f8ba9e84c8bc', speed: 'slowest' }, // Jacqueline
    angry: { id: '5ee9feff-1265-424a-9d7f-8e4d431a12c7', speed: 'fast'    }, // Ronald
    happy: { id: 'faf0731e-dfb9-4cfc-8119-259a79b27e12', speed: 'fast'    }, // Riya
  },
  intl: {
    love:  { id: 'e07c00bc-4134-4eae-9ea4-1a55fb45746b', speed: 'slow'    }, // Brooke
    sad:   { id: '9626c31c-bec5-4cca-baa8-f8ba9e84c8bc', speed: 'slowest' }, // Jacqueline
    angry: { id: '5ee9feff-1265-424a-9d7f-8e4d431a12c7', speed: 'fast'    }, // Ronald
    happy: { id: 'a167e0f3-df7e-4d52-a9c3-f949145efdab', speed: 'fast'    }, // Blake
  },
};

const getVoiceCfg = (lang, emotion) => {
  if (lang === 'te') return VOICES.telugu[emotion];
  return INDIAN_LANGS.has(lang) ? VOICES.indian[emotion] : VOICES.intl[emotion];
};

const generateWithCartesia = async (text, emotion, lang) => {
  const cfg = getVoiceCfg(lang, emotion);
  if (!cfg || !CARTESIA_API_KEY) throw new Error('Cartesia not configured');

  // Emotion controls for natural feel
  const emotionControls = {
    love:  { speed: cfg.speed, emotion: ['positivity:high', 'curiosity:low'] },
    sad:   { speed: cfg.speed, emotion: ['sadness:high', 'positivity:low']   },
    angry: { speed: cfg.speed, emotion: ['anger:high', 'positivity:low']     },
    happy: { speed: cfg.speed, emotion: ['positivity:high', 'surprise:low']  },
  };

  console.log(`[Cartesia] ${emotion}|${lang}|voice=${cfg.id}|speed=${cfg.speed}`);
  const res = await axios.post(
    'https://api.cartesia.ai/tts/bytes',
    {
      model_id: 'sonic-3',
      transcript: text,
      voice: {
        mode: 'id',
        id: cfg.id,
        __experimental_controls: emotionControls[emotion],
      },
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
  console.log(`[Cartesia] OK → ${filename} (${res.data.byteLength} bytes)`);
  return filename;
};

const cleanupCache = (exclude = null) => {
  try {
    const files = fs.readdirSync(AUDIO_DIR)
      .filter(f => (f.endsWith('.mp3') || f.endsWith('.wav')) && f !== exclude).sort();
    if (files.length > 10)
      files.slice(0, files.length - 10).forEach(f => { try { fs.unlinkSync(path.join(AUDIO_DIR, f)); } catch (_) {} });
  } catch (_) {}
};

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

    let filename = null;
    let usedEngine = 'device-tts';
    try {
      filename = await generateWithCartesia(text.trim(), emotionKey, lang);
      usedEngine = 'cartesia';
    } catch (err) {
      console.log(`[Cartesia] Failed: ${err.message} — device TTS fallback`);
    }

    cleanupCache(filename);

    return res.json({
      success: true,
      voiceText: text.trim(),
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
