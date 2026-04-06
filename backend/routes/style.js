const express = require('express');
const { translate } = require('@vitalets/google-translate-api');
const axios = require('axios');
const router = express.Router();

const PRAVAHAI_URL = 'https://pravahai.aicte-india.org/api/translatebulk';

const isValidText = (text) => {
  if (!text) return false;
  const badChars = (text.match(/[^\x09\x0A\x0D\x20-\uD7FF\uE000-\uFFFD]/g) || []).length;
  return badChars / text.length < 0.1;
};

const translateText = async (text, targetLang) => {
  if (!targetLang || targetLang === 'en') return text;

  // Try Pravahai first
  try {
    const res = await axios.post(PRAVAHAI_URL, [{ text, from: 'en', to: targetLang }], {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000,
    });
    const translated = res.data?.value?.[0]?.translations?.[0]?.text;
    if (translated && isValidText(translated)) return translated;
  } catch (e) {}

  // Fallback to Google
  try {
    const res = await translate(text, { to: targetLang });
    return res.text;
  } catch (e) {}

  return text;
};

const STYLE_TEMPLATES = {
  genz: (text) =>
    `Okay bestie, no cap fr fr — ${text} Like periodt, this is giving everything, it's literally so real rn. Slay!`,

  formal: (text) =>
    `I would like to formally convey that ${text} I trust this communication finds you well and I appreciate your kind attention to this matter.`,

  funny: (text) =>
    `Okay so plot twist nobody asked for — ${text} I know right?! Who even comes up with this stuff? Anyway, you're welcome for this life update lol.`,
};

const STYLE_LABELS = {
  genz: { emoji: '🔥', label: 'Gen-Z', color: '#F3E5F5' },
  formal: { emoji: '👔', label: 'Formal', color: '#E8F5E9' },
  funny: { emoji: '😂', label: 'Funny', color: '#FFF8E1' },
};

// POST /api/style/rephrase
// Returns all 4 styles at once
router.post('/rephrase', async (req, res, next) => {
  try {
    const { text, targetLang } = req.body;

    if (!text?.trim()) {
      return res.status(400).json({ success: false, error: 'Text is required' });
    }

    const results = {};
    const styleKeys = Object.keys(STYLE_TEMPLATES);

    // Sequential calls to avoid Google rate limit
    for (const styleKey of styleKeys) {
      try {
        const englishVersion = STYLE_TEMPLATES[styleKey](text.trim());
        let finalText = englishVersion;

        if (targetLang && targetLang !== 'en') {
          await new Promise((r) => setTimeout(r, 300));
          finalText = await translateText(englishVersion, targetLang);
        }

        results[styleKey] = { text: finalText, ...STYLE_LABELS[styleKey] };
      } catch (e) {
        console.error(`Style ${styleKey} error:`, e.message);
        results[styleKey] = {
          text: STYLE_TEMPLATES[styleKey](text.trim()),
          ...STYLE_LABELS[styleKey],
        };
      }
    }

    return res.json({ success: true, styles: results });
  } catch (err) {
    console.error('Style error:', err.message);
    next(err);
  }
});

module.exports = router;
