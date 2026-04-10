const express = require('express');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const router = express.Router();

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

// Female voice for Love & Happy — Male voice for Sad & Angry
const EMOTION_CONFIG = {
  love: {
    voice_id: 'EXAVITQu4vr4xnSDxMaL', // Sarah — soft female
    voice_settings: { stability: 0.35, similarity_boost: 0.90, style: 1.0, use_speaker_boost: true },
    ttsRate: 0.30, ttsPitch: 1.3,
  },
  happy: {
    voice_id: 'jBpfuIE2acCO8z3wKNLl', // Gigi — cheerful female
    voice_settings: { stability: 0.20, similarity_boost: 0.90, style: 1.0, use_speaker_boost: true },
    ttsRate: 0.55, ttsPitch: 1.5,
  },
  sad: {
    voice_id: 'onwK4e9ZLuTAKqWW03F9', // Daniel — deep male
    voice_settings: { stability: 0.90, similarity_boost: 0.80, style: 0.85, use_speaker_boost: false },
    ttsRate: 0.25, ttsPitch: 0.68,
  },
  angry: {
    voice_id: 'pNInz6obpgDQGcFmaJgB', // Adam — strong male
    voice_settings: { stability: 0.10, similarity_boost: 1.0, style: 1.0, use_speaker_boost: true },
    ttsRate: 0.62, ttsPitch: 0.58,
  },
};

const AUDIO_DIR = path.join(__dirname, '../audio_cache');
if (!fs.existsSync(AUDIO_DIR)) fs.mkdirSync(AUDIO_DIR, { recursive: true });

const generateAudio = async (text, emotion) => {
  const config = EMOTION_CONFIG[emotion];
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

  // Keep last 20 files
  const files = fs.readdirSync(AUDIO_DIR).filter(f => f.endsWith('.mp3')).sort();
  if (files.length > 20) {
    files.slice(0, files.length - 20).forEach(f => {
      try { fs.unlinkSync(path.join(AUDIO_DIR, f)); } catch (e) {}
    });
  }

  return filename;
};

// Serve audio
router.get('/audio/:filename', (req, res) => {
  const filepath = path.join(AUDIO_DIR, req.params.filename);
  if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'Not found' });
  res.setHeader('Content-Type', 'audio/mpeg');
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(filepath);
});

// POST /api/emotion/rephrase
router.post('/rephrase', async (req, res, next) => {
  try {
    const { text, emotion } = req.body;
    if (!text?.trim()) return res.status(400).json({ success: false, error: 'Text is required' });

    const emotionKey = emotion?.toLowerCase();
    if (!['love', 'sad', 'angry', 'happy'].includes(emotionKey)) {
      return res.status(400).json({ success: false, error: 'Invalid emotion' });
    }

    const config = EMOTION_CONFIG[emotionKey];
    const emojis = { love: '\u2764\uFE0F', sad: '\uD83D\uDE22', angry: '\uD83D\uDE21', happy: '\uD83D\uDE04' };

    let audioUrl = null;
    let useElevenLabs = false;

    try {
      const filename = await generateAudio(text.trim(), emotionKey);
      audioUrl = `/api/emotion/audio/${filename}`;
      useElevenLabs = true;
      console.log(`[ElevenLabs] ${emotionKey} OK: ${filename}`);
    } catch (e) {
      console.log(`[ElevenLabs] Failed: ${e.message} — TTS fallback`);
    }

    return res.json({
      success: true,
      voiceText: text.trim(),
      audioUrl,
      useElevenLabs,
      ttsRate: config.ttsRate,
      ttsPitch: config.ttsPitch,
      emotion: emotionKey,
      emoji: emojis[emotionKey],
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
