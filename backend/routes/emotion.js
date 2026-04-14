const express = require('express');
const axios = require('axios');
const router = express.Router();

const GROQ_API_KEY = process.env.GROQ_API_KEY;

// ─── TTS rate/pitch defaults (frontend device TTS ke liye) ───────────────────
const TTS_DEFAULTS = {
  love:  { ttsRate: 0.40, ttsPitch: 1.20 },
  sad:   { ttsRate: 0.34, ttsPitch: 0.85 },
  happy: { ttsRate: 0.58, ttsPitch: 1.22 },
  angry: { ttsRate: 0.50, ttsPitch: 0.70 },
};

// ─── Groq Emotion Rewrite ─────────────────────────────────────────────────────
const EMOTION_PROMPTS = {
  love:  `Rewrite this sentence in a warm, tender, loving way. Add soft pauses (...), breathless feeling, gentle emphasis. Like whispering to someone you love deeply. Example: "Aww… tum kahan ho na? ❤️"`,
  sad:   `Rewrite this sentence in a broken, slow, grieving way. Add long pauses (...), trailing words, heavy feeling. Like voice cracking while holding back tears. Example: "tum… kahan ho?"`,
  angry: `Rewrite this sentence in a sharp, explosive, intense way. Use CAPS for emphasis, exclamations, short punchy words. Like shouting in anger. Example: "TUM KAHAN HO?!"`,
  happy: `Rewrite this sentence in a bright, energetic, excited way. Add exclamations, enthusiasm, bouncy rhythm. Like jumping with joy. Example: "OMG tum kahan ho?! 😄"`,
};

const rewriteWithGroq = async (text, emotion) => {
  if (!GROQ_API_KEY) return text;

  const prompt = `${EMOTION_PROMPTS[emotion]}

Rules:
- Keep the core meaning same
- Rewrite ONLY the sentence — no labels, no explanations
- Keep it short and natural for speaking aloud
- Same language as input

Sentence: ${text}`;

  try {
    const res = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 150,
        temperature: 0.8,
      },
      {
        headers: { Authorization: `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
        timeout: 15000,
      }
    );
    const rewritten = res.data?.choices?.[0]?.message?.content?.trim();
    if (rewritten) {
      console.log(`[Groq] ${emotion}: "${rewritten.slice(0, 60)}"`);
      return rewritten;
    }
  } catch (err) {
    console.log(`[Groq] Failed: ${err.message} — using original`);
  }
  return text;
};

// ─── POST /api/emotion/rephrase ───────────────────────────────────────────────
router.post('/rephrase', async (req, res, next) => {
  try {
    const { text, emotion, targetLang } = req.body;
    if (!text?.trim()) return res.status(400).json({ success: false, error: 'Text is required' });

    const emotionKey = emotion?.toLowerCase();
    if (!['love', 'sad', 'angry', 'happy'].includes(emotionKey)) {
      return res.status(400).json({ success: false, error: 'Invalid emotion' });
    }

    console.log(`\n[Emotion] "${text.trim().slice(0, 40)}" | ${emotionKey} | ${targetLang}`);

    const emojis = { love: '❤️', sad: '😢', angry: '😡', happy: '😄' };
    const { ttsRate, ttsPitch } = TTS_DEFAULTS[emotionKey];

    // Groq se emotionally rewrite karo
    const voiceText = await rewriteWithGroq(text.trim(), emotionKey);

    return res.json({
      success: true,
      voiceText,
      audioUrl: null,
      engine: 'device-tts',
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
