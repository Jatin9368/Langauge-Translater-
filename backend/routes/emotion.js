const express = require('express');
const { translate } = require('@vitalets/google-translate-api');
const router = express.Router();

// Emotion ke hisaab se GPT-4o-mini se text rewrite karo
// Phir target language mein translate karo
// Result sirf TTS ke liye hai — display nahi hoga

const EMOTION_SYSTEM_PROMPTS = {
  love: `You are a romantic, loving person deeply in love. Rewrite the given text in a warm, affectionate, romantic tone — as if speaking to someone you deeply love. Use tender words, gentle expressions. Keep it to 1-2 sentences. Output only the rewritten text, nothing else.`,

  sad: `You are feeling deeply sad and heartbroken. Rewrite the given text in a sorrowful, melancholic, emotional tone — as if you are about to cry. Use heavy, slow, emotional words. Keep it to 1-2 sentences. Output only the rewritten text, nothing else.`,

  angry: `You are furious and extremely angry. Rewrite the given text in an intense, aggressive, confrontational tone — as if you are shouting in rage. Use strong, forceful words. Keep it to 1-2 sentences. Output only the rewritten text, nothing else.`,

  happy: `You are extremely happy, excited and joyful. Rewrite the given text in an enthusiastic, cheerful, energetic tone — as if you just received the best news ever. Use upbeat, lively words. Keep it to 1-2 sentences. Output only the rewritten text, nothing else.`,
};

const callGPT = async (text, emotion) => {
  const OpenAI = require('openai');
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: EMOTION_SYSTEM_PROMPTS[emotion] },
      { role: 'user', content: text },
    ],
    max_tokens: 200,
    temperature: 0.9,
  });

  return completion.choices[0]?.message?.content?.trim() || text;
};

// Fallback — GPT nahi hai toh simple transform
const fallbackTransform = (text, emotion) => {
  const t = text.trim();
  switch (emotion) {
    case 'love':    return `My dearest... ${t}... I say this with all my heart and love for you.`;
    case 'sad':     return `With a heavy heart... ${t}... I can barely hold back my tears saying this.`;
    case 'angry':   return `I am absolutely furious! ${t.toUpperCase()}! This is completely unacceptable!`;
    case 'happy':   return `Oh my goodness, I am SO excited! ${t}! This is absolutely amazing, yay!`;
    default:        return t;
  }
};

// POST /api/emotion/rephrase
router.post('/rephrase', async (req, res, next) => {
  try {
    const { text, emotion, targetLang } = req.body;

    if (!text?.trim()) {
      return res.status(400).json({ success: false, error: 'Text is required' });
    }

    const emotionKey = emotion?.toLowerCase();
    const validEmotions = ['love', 'sad', 'angry', 'happy'];
    if (!validEmotions.includes(emotionKey)) {
      return res.status(400).json({ success: false, error: 'Invalid emotion' });
    }

    // Step 1: Pehle text ko English mein convert karo
    let englishText = text.trim();
    try {
      const detected = await translate(text.trim(), { to: 'en' });
      if (detected.text) englishText = detected.text;
    } catch (e) {}

    // Step 2: GPT se emotion mein rewrite karo (English mein)
    let rephrasedEnglish = '';
    try {
      if (process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.includes('your-openai')) {
        rephrasedEnglish = await callGPT(englishText, emotionKey);
      } else {
        rephrasedEnglish = fallbackTransform(englishText, emotionKey);
      }
    } catch (e) {
      console.error('GPT error:', e.message);
      rephrasedEnglish = fallbackTransform(englishText, emotionKey);
    }

    // Step 3: Target language mein translate karo
    let voiceText = rephrasedEnglish;
    if (targetLang && targetLang !== 'en') {
      try {
        const translated = await translate(rephrasedEnglish, { to: targetLang });
        voiceText = translated.text || rephrasedEnglish;
      } catch (e) {
        voiceText = rephrasedEnglish;
      }
    }

    const emojis = { love: '❤️', sad: '😢', angry: '😡', happy: '😄' };

    return res.json({
      success: true,
      voiceText,        // TTS ke liye — emotion mein rewritten + translated
      emotion: emotionKey,
      emoji: emojis[emotionKey],
    });
  } catch (err) {
    console.error('Emotion error:', err.message);
    next(err);
  }
});

module.exports = router;
