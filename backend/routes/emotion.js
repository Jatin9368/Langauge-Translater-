const express = require('express');
const axios = require('axios');
const router = express.Router();

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

// ElevenLabs voice IDs with emotion settings
// Using "voice_settings" to control emotion intensity
const EMOTION_VOICE_CONFIG = {
  love: {
    voice_id: 'EXAVITQu4vr4xnSDxMaL', // Sarah — warm, soft
    voice_settings: { stability: 0.3, similarity_boost: 0.8, style: 0.9, use_speaker_boost: true },
    groq_prompt: `Rewrite this sentence with deep warmth and love. Same meaning, same language. Return ONLY the sentence.`,
    ttsRate: 0.36, ttsPitch: 1.25,
  },
  sad: {
    voice_id: 'onwK4e9ZLuTAKqWW03F9', // Daniel — deep, emotional
    voice_settings: { stability: 0.8, similarity_boost: 0.7, style: 0.6, use_speaker_boost: false },
    groq_prompt: `Rewrite this sentence with deep sadness and sorrow. Same meaning, same language. Return ONLY the sentence.`,
    ttsRate: 0.30, ttsPitch: 0.78,
  },
  angry: {
    voice_id: 'pNInz6obpgDQGcFmaJgB', // Adam — strong, intense
    voice_settings: { stability: 0.2, similarity_boost: 0.9, style: 1.0, use_speaker_boost: true },
    groq_prompt: `Rewrite this sentence with intense anger and frustration. Same meaning, same language. Return ONLY the sentence.`,
    ttsRate: 0.52, ttsPitch: 0.62,
  },
  happy: {
    voice_id: 'jBpfuIE2acCO8z3wKNLl', // Gigi — cheerful, energetic
    voice_settings: { stability: 0.3, similarity_boost: 0.8, style: 0.9, use_speaker_boost: true },
    groq_prompt: `Rewrite this sentence with joy and excitement. Same meaning, same language. Return ONLY the sentence.`,
    ttsRate: 0.46, ttsPitch: 1.35,
  },
};

// Groq — rewrite text with emotion
const rewriteWithGroq = async (text, prompt) => {
  if (!GROQ_API_KEY) return text;
  try {
    const res = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: text },
        ],
        max_tokens: 200,
        temperature: 0.85,
      },
      {
        headers: { Authorization: `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
        timeout: 15000,
      }
    );
    return res.data?.choices?.[0]?.message?.content?.trim() || text;
  } catch (e) {
    console.log('Groq failed:', e.message);
    return text;
  }
};

// ElevenLabs — generate emotional audio (base64)
const generateElevenLabsAudio = async (text, voiceId, voiceSettings) => {
  const res = await axios.post(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      text,
      model_id: 'eleven_multilingual_v2', // supports Hindi, Tamil, etc.
      voice_settings: voiceSettings,
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
  // Convert to base64
  const base64Audio = Buffer.from(res.data).toString('base64');
  return base64Audio;
};

// POST /api/emotion/rephrase
router.post('/rephrase', async (req, res, next) => {
  try {
    const { text, emotion } = req.body;

    if (!text?.trim()) return res.status(400).json({ success: false, error: 'Text is required' });

    const emotionKey = emotion?.toLowerCase();
    if (!['love', 'sad', 'angry', 'happy'].includes(emotionKey)) {
      return res.status(400).json({ success: false, error: 'Invalid emotion' });
    }

    const config = EMOTION_VOICE_CONFIG[emotionKey];

    // Step 1: Groq se emotionally rewrite karo
    const rephrasedText = await rewriteWithGroq(text.trim(), config.groq_prompt);

    // Step 2: ElevenLabs se emotional audio generate karo
    let audioBase64 = null;
    let useElevenLabs = false;

    if (ELEVENLABS_API_KEY) {
      try {
        audioBase64 = await generateElevenLabsAudio(rephrasedText, config.voice_id, config.voice_settings);
        useElevenLabs = true;
        console.log(`[ElevenLabs] ${emotionKey} audio generated OK`);
      } catch (e) {
        console.log(`[ElevenLabs] Failed: ${e.message} — falling back to TTS`);
      }
    }

    const emojis = { love: '\u2764\uFE0F', sad: '\uD83D\uDE22', angry: '\uD83D\uDE21', happy: '\uD83D\uDE04' };

    return res.json({
      success: true,
      voiceText: rephrasedText,
      audioBase64,           // ElevenLabs audio (base64 mp3)
      useElevenLabs,
      ttsRate: config.ttsRate,
      ttsPitch: config.ttsPitch,
      emotion: emotionKey,
      emoji: emojis[emotionKey],
    });
  } catch (err) {
    console.error('Emotion error:', err.message);
    next(err);
  }
});

module.exports = router;
