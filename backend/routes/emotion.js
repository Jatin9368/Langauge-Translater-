const express = require('express');
const { translate } = require('@vitalets/google-translate-api');
const router = express.Router();

// Emotion ke hisaab se English mein rewrite templates
const rewriteInEnglish = (text, emotion) => {
  switch (emotion) {
    case 'love':
      return `My dearest, I want you to know with all my heart... ${text} You mean absolutely everything to me, and I cherish every moment with you. I love you so deeply.`;

    case 'sad':
      return `I am so heartbroken right now... ${text} I feel so lost, so empty inside. My tears just won't stop. I don't know how to go on like this.`;

    case 'angry':
      return `I am absolutely furious and I cannot stay quiet anymore! ${text} This is completely unacceptable! How dare you! I am so done with this nonsense!`;

    case 'happy':
      return `Oh wow, I am so incredibly happy right now! ${text} This is absolutely amazing! I feel like I am on top of the world! Yay!`;

    default:
      return text;
  }
};

// TTS ke liye voice style instructions (text mein embed)
const addVoiceStyle = (text, emotion) => {
  switch (emotion) {
    case 'angry':
      // Short punchy sentences, caps for emphasis
      return text
        .replace(/([.!?])\s+/g, '$1\n')
        .toUpperCase();

    case 'sad':
      // Add pauses with ellipsis
      return text
        .replace(/,/g, '...')
        .replace(/\./g, '...\n')
        .replace(/!/g, '...');

    case 'love':
      // Soft pauses
      return text
        .replace(/,/g, '...')
        .replace(/\./g, '.\n');

    case 'happy':
      return text;

    default:
      return text;
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

    // Step 1: English mein emotional rewrite
    const englishRewrite = rewriteInEnglish(text, emotionKey);

    // Step 2: Target language mein translate karo
    let rephrasedText = englishRewrite;
    if (targetLang && targetLang !== 'en') {
      try {
        const result = await translate(englishRewrite, { to: targetLang });
        rephrasedText = result.text;
      } catch (e) {
        console.error('Emotion translate error:', e.message);
        rephrasedText = englishRewrite;
      }
    }

    // Step 3: Voice ke liye style add karo
    const voiceText = addVoiceStyle(rephrasedText, emotionKey);

    const emojis = { love: '❤️', sad: '😢', angry: '😡', happy: '😄' };

    return res.json({
      success: true,
      rephrasedText,      // display ke liye clean text
      voiceText,          // TTS ke liye styled text
      emotion: emotionKey,
      emoji: emojis[emotionKey],
    });
  } catch (err) {
    console.error('Emotion error:', err.message);
    next(err);
  }
});

module.exports = router;
