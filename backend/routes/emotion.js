const express = require('express');
const axios = require('axios');
const { translate } = require('@vitalets/google-translate-api');
const router = express.Router();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const FREE_MODELS = [
  'meta-llama/llama-3-8b-instruct',
  'mistralai/mistral-7b-instruct',
  'google/gemma-7b-it',
];

// Exact same meaning — sirf emotional tone badlo
const EMOTION_PROMPTS = {
  love: `You are a lover describing something to your beloved in a deeply romantic and poetic way.
Your task: Rewrite the given sentence with the EXACT SAME meaning and content, but in a warm, romantic, poetic emotional tone.
- Keep all facts and information exactly the same
- Add romantic, loving expressions naturally
- Hindi/Urdu mix is allowed for natural feel
- Maximum 2 sentences
- Return ONLY the rewritten sentence, nothing else`,

  sad: `You are remembering something with a heavy heart, feeling deeply emotional and melancholic.
Your task: Rewrite the given sentence with the EXACT SAME meaning and content, but in a sad, emotional, heartfelt tone.
- Keep all facts and information exactly the same
- Add feelings of longing, sadness, nostalgia naturally
- Hindi/Urdu mix is allowed for natural feel
- Maximum 2 sentences
- Return ONLY the rewritten sentence, nothing else`,

  angry: `You are extremely frustrated and angry about something.
Your task: Rewrite the given sentence with the EXACT SAME meaning and content, but in an intense, angry, confrontational tone.
- Keep all facts and information exactly the same
- Express frustration and anger naturally
- Maximum 2 sentences
- Return ONLY the rewritten sentence, nothing else`,

  happy: `You are extremely happy, excited and joyful about something.
Your task: Rewrite the given sentence with the EXACT SAME meaning and content, but in an enthusiastic, cheerful, excited tone.
- Keep all facts and information exactly the same
- Express joy and excitement naturally
- Maximum 2 sentences
- Return ONLY the rewritten sentence, nothing else`,
};

const EMOTION_CONFIG = {
  love:  { rate: 0.36, pitch: 1.25 },
  sad:   { rate: 0.30, pitch: 0.78 },
  angry: { rate: 0.52, pitch: 0.62 },
  happy: { rate: 0.58, pitch: 1.45 },
};

const callOpenRouter = async (text, emotion) => {
  for (const model of FREE_MODELS) {
    try {
      const response = await axios.post(
        OPENROUTER_URL,
        {
          model,
          messages: [
            { role: 'system', content: EMOTION_PROMPTS[emotion] },
            { role: 'user', content: text },
          ],
          max_tokens: 200,
          temperature: 0.85,
        },
        {
          headers: {
            Authorization: `Bearer ${OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://bharattranslate.app',
            'X-Title': 'BharatTranslate',
          },
          timeout: 20000,
        }
      );

      const result = response.data?.choices?.[0]?.message?.content?.trim();
      if (result) {
        console.log(`[OpenRouter] ${model} OK for ${emotion}`);
        return result;
      }
    } catch (e) {
      console.log(`[OpenRouter] ${model} failed: ${e.message}`);
    }
  }
  throw new Error('All models failed');
};

// Fallback — no API
const fallbackTransform = (text, emotion) => {
  const t = text.trim();
  switch (emotion) {
    case 'love':  return `${t}... yeh baat mere dil ki gehraaiyon se nikalti hai, mere pyaar.`;
    case 'sad':   return `${t}... yeh yaad karke dil bhar aata hai, aankhein nam ho jaati hain.`;
    case 'angry': return `${t.toUpperCase()}! Yeh bilkul bhi theek nahi hai, main bahut gusse mein hoon!`;
    case 'happy': return `${t}! Yeh sunke dil khush ho gaya, kitni achhi baat hai!`;
    default:      return t;
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
    if (!['love', 'sad', 'angry', 'happy'].includes(emotionKey)) {
      return res.status(400).json({ success: false, error: 'Invalid emotion' });
    }

    // Step 1: English mein convert karo processing ke liye
    let englishText = text.trim();
    try {
      const detected = await translate(text.trim(), { to: 'en' });
      if (detected.text) englishText = detected.text;
    } catch (e) {}

    // Step 2: OpenRouter se emotional rewrite karo
    let rephrasedText = '';
    try {
      rephrasedText = await callOpenRouter(englishText, emotionKey);
    } catch (e) {
      console.log('OpenRouter failed, using fallback');
      rephrasedText = fallbackTransform(text.trim(), emotionKey);
    }

    // Step 3: Target language mein translate karo
    let voiceText = rephrasedText;
    if (targetLang && targetLang !== 'en') {
      try {
        const translated = await translate(rephrasedText, { to: targetLang });
        voiceText = translated.text || rephrasedText;
      } catch (e) {}
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
