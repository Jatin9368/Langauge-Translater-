const express = require('express');
const axios = require('axios');
const router = express.Router();

const GROQ_API_KEY = process.env;

const EMOTION_CONFIG = {
  love:  { ttsRate: 0.36, ttsPitch: 1.25 },
  sad:   { ttsRate: 0.30, ttsPitch: 0.78 },
  angry: { ttsRate: 0.52, ttsPitch: 0.62 },
  happy: { ttsRate: 0.46, ttsPitch: 1.35 },
};

// Groq — return EXACT same text, just change delivery/tone
const rewriteWithGroq = async (text, emotion) => {
  const prompts = {
    love:  `Return the EXACT same text below, word for word. Do not add, remove, or change any words. Just return it as-is:\n\n${text}`,
    sad:   `Return the EXACT same text below, word for word. Do not add, remove, or change any words. Just return it as-is:\n\n${text}`,
    angry: `Return the EXACT same text below, word for word. Do not add, remove, or change any words. Just return it as-is:\n\n${text}`,
    happy: `Return the EXACT same text below, word for word. Do not add, remove, or change any words. Just return it as-is:\n\n${text}`,
  };

  // Since we just want same text — skip Groq, return directly
  return text;
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

    const config = EMOTION_CONFIG[emotionKey];
    const emojis = { love: '\u2764\uFE0F', sad: '\uD83D\uDE22', angry: '\uD83D\uDE21', happy: '\uD83D\uDE04' };

    // Return exact same translated text — TTS will speak it with emotion rate/pitch
    return res.json({
      success: true,
      voiceText: text.trim(),
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
