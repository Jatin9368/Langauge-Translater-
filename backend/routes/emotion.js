const express = require('express');
const { translate } = require('@vitalets/google-translate-api');
const router = express.Router();

// Emotion ke hisaab se text ko rewrite karne ke liye prefix/suffix add karte hain
// Phir translate karke wapas original language mein laate hain
const EMOTION_PROMPTS = {
  love: {
    prefix: 'With deep love and affection, say this romantically: ',
    emoji: '❤️',
    style: 'romantic and loving',
  },
  sad: {
    prefix: 'Say this in a very sad, emotional and heartbroken way: ',
    emoji: '😢',
    style: 'sad and emotional',
  },
  angry: {
    prefix: 'Say this in a very angry, frustrated and intense way: ',
    emoji: '😡',
    style: 'angry and intense',
  },
  happy: {
    prefix: 'Say this in a very happy, joyful and excited way: ',
    emoji: '😄',
    style: 'happy and joyful',
  },
};

const EMOTION_REWRITES = {
  love: [
    (t) => `💕 ${t} 💕`,
    (t) => `Dil se keh raha hoon... ${t} ❤️`,
    (t) => `Pyaar se: ${t} 🌹`,
  ],
  sad: [
    (t) => `😢 ${t}... (dil toot gaya)`,
    (t) => `Aankhon mein aansu hain... ${t} 💔`,
    (t) => `Udaas mann se: ${t} 😔`,
  ],
  angry: [
    (t) => `😡 ${t}!! (gussa aa raha hai)`,
    (t) => `Krodh mein: ${t} 🔥`,
    (t) => `Bilkul bhi theek nahi! ${t} 😤`,
  ],
  happy: [
    (t) => `🎉 ${t} 🎊`,
    (t) => `Khushi se: ${t} ✨😄`,
    (t) => `Waah! ${t} 🥳`,
  ],
};

// POST /api/emotion/rephrase
router.post('/rephrase', async (req, res, next) => {
  try {
    const { text, emotion, targetLang } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, error: 'Text is required' });
    }

    const emotionKey = emotion?.toLowerCase();
    if (!EMOTION_PROMPTS[emotionKey]) {
      return res.status(400).json({ success: false, error: 'Invalid emotion. Use: love, sad, angry, happy' });
    }

    const emotionData = EMOTION_PROMPTS[emotionKey];
    const rewrites = EMOTION_REWRITES[emotionKey];

    // Step 1: Pehle text ko English mein translate karo (processing ke liye)
    let englishText = text;
    try {
      const toEn = await translate(text.trim(), { to: 'en' });
      englishText = toEn.text;
    } catch (e) {
      englishText = text;
    }

    // Step 2: Emotion ke hisaab se English mein rewrite karo
    const emotionEnglishMap = {
      love: `I love you so much! ${englishText} You mean everything to me, my heart beats for you! 💕`,
      sad: `I'm heartbroken... ${englishText} My tears won't stop, I feel so lost and empty. 💔`,
      angry: `I'm absolutely furious! ${englishText} This is completely unacceptable and I'm so done! 😡🔥`,
      happy: `Oh my goodness, I'm so thrilled! ${englishText} This is the best thing ever, I'm over the moon! 🎉✨`,
    };

    const rephrasedEnglish = emotionEnglishMap[emotionKey];

    // Step 3: Wapas original target language mein translate karo
    let rephrasedText = rephrasedEnglish;
    if (targetLang && targetLang !== 'en') {
      try {
        const backTranslate = await translate(rephrasedEnglish, { to: targetLang });
        rephrasedText = backTranslate.text;
      } catch (e) {
        // Fallback: simple emoji wrap
        const randomRewrite = rewrites[Math.floor(Math.random() * rewrites.length)];
        rephrasedText = randomRewrite(text);
      }
    }

    return res.json({
      success: true,
      rephrasedText,
      emotion: emotionKey,
      emoji: emotionData.emoji,
    });
  } catch (err) {
    console.error('Emotion error:', err.message);
    next(err);
  }
});

module.exports = router;
