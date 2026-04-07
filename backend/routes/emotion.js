const express = require('express');
const axios = require('axios');
const router = express.Router();

const EMOTION_PROMPTS = {
  love:  `Say the given sentence with a warm loving emotional touch. Do NOT change the meaning or add new information. Just say the same thing with more affection. Same language as input. Return ONLY the sentence.`,
  sad:   `Say the given sentence with a sad emotional touch. Do NOT change the meaning or add new information. Just say the same thing with more sadness. Same language as input. Return ONLY the sentence.`,
  angry: `Say the given sentence with an angry emotional touch. Do NOT change the meaning or add new information. Just say the same thing more intensely. Same language as input. Return ONLY the sentence.`,
  happy: `Say the given sentence with a happy excited emotional touch. Do NOT change the meaning or add new information. Just say the same thing more joyfully. Same language as input. Return ONLY the sentence.`,
};

const EMOTION_CONFIG = {
  love:  { rate: 0.36, pitch: 1.25 },
  sad:   { rate: 0.30, pitch: 0.78 },
  angry: { rate: 0.52, pitch: 0.62 },
  happy: { rate: 0.46, pitch: 1.35 },
};

const callGroq = async (text, emotion) => {
  const res = await axios.post(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: EMOTION_PROMPTS[emotion] },
        { role: 'user', content: text },
      ],
      max_tokens: 200,
      temperature: 0.85,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    }
  );
  const result = res.data?.choices?.[0]?.message?.content?.trim();
  if (!result) throw new Error('Empty Groq response');
  return result;
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

    // Seedha translated text ko emotion mein rewrite karo — same language mein
    let voiceText = text.trim();
    try {
      voiceText = await callGroq(text.trim(), emotionKey);
      console.log(`[Groq] ${emotionKey} rewrite OK`);
    } catch (e) {
      console.log(`[Groq] Failed: ${e.message} — using original text`);
      voiceText = text.trim();
    }

    const config = EMOTION_CONFIG[emotionKey];
    const emojis = { love: '❤️', sad: '😢', angry: '😡', happy: '😄' };

    return res.json({
      success: true,
      voiceText,
      ttsRate: config.rate,
      ttsPitch: config.pitch,
      emotion: emotionKey,
      emoji: emojis[emotionKey],
    });
  } catch (err) {
    console.error('Emotion error:', err.message);
    next(err);
  }
});

module.exports = router;
