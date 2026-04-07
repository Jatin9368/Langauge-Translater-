const express = require('express');
const { translate } = require('@vitalets/google-translate-api');
const router = express.Router();
const History = require('../models/History');

// Google Translate
const translateWithGoogle = async (text, sourceLang, targetLang) => {
  const options = { to: targetLang, fetchOptions: { signal: AbortSignal.timeout(8000) } };
  if (sourceLang && sourceLang !== 'auto') options.from = sourceLang;
  const result = await translate(text, options);
  return result.text;
};

// POST /api/translate
router.post('/', async (req, res, next) => {
  try {
    const { text, sourceLang, targetLang, sourceLangName, targetLangName, saveHistory } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, error: 'Text is required' });
    }
    if (!targetLang) {
      return res.status(400).json({ success: false, error: 'Target language is required' });
    }

    const translatedText = await translateWithGoogle(text.trim(), sourceLang || 'auto', targetLang);
    const detectedLang = sourceLang || 'auto';

    if (saveHistory !== false) {
      History.create({
        sourceText: text.trim(),
        translatedText,
        sourceLang: detectedLang,
        targetLang,
        sourceLangName: sourceLangName || detectedLang,
        targetLangName: targetLangName || targetLang,
      }).catch((e) => console.error('History save error:', e.message));
    }

    return res.json({ success: true, translatedText, detectedLang, engine: 'google' });
  } catch (err) {
    console.error('Translation error:', err.message);
    next(err);
  }
});

// POST /api/translate/detect
router.post('/detect', async (req, res, next) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, error: 'Text is required' });
    }
    try {
      const result = await translate(text.trim(), { to: 'en' });
      return res.json({ success: true, detectedLang: result.raw?.src || 'auto', confidence: 1 });
    } catch {
      return res.json({ success: true, detectedLang: 'auto', confidence: 0 });
    }
  } catch (err) {
    next(err);
  }
});

module.exports = router;
