const express = require('express');
const axios = require('axios');
const { translate } = require('@vitalets/google-translate-api');
const router = express.Router();
const History = require('../models/History');

const PRAVAHAI_URL = 'https://pravahai.aicte-india.org/api/translatebulk';

// Check if text is valid UTF-8 (not garbled)
const isValidText = (text) => {
  if (!text) return false;
  // Garbled text has lots of non-printable or replacement chars
  const garbledPattern = /[^\x09\x0A\x0D\x20-\uD7FF\uE000-\uFFFD]/g;
  const badChars = (text.match(garbledPattern) || []).length;
  return badChars / text.length < 0.1;
};

// Pravahai AICTE API
const translateWithPravahai = async (text, sourceLang, targetLang) => {
  const payload = [{ text, from: sourceLang === 'auto' ? 'en' : sourceLang, to: targetLang }];
  const response = await axios.post(PRAVAHAI_URL, payload, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 6000, // 6 sec max — agar slow hai toh Google pe jaao
    responseEncoding: 'utf8',
  });
  const data = response.data;
  const valueArr = Array.isArray(data) ? data : data?.value;
  const translated = valueArr?.[0]?.translations?.[0]?.text;
  if (!translated || !isValidText(translated)) {
    throw new Error('Invalid or garbled response from Pravahai');
  }
  return translated;
};

// Google Translate fallback
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

    let translatedText = '';
    let usedEngine = '';

    // Try Pravahai first, fallback to Google
    try {
      translatedText = await translateWithPravahai(text.trim(), sourceLang || 'auto', targetLang);
      usedEngine = 'pravahai';
      console.log(`[Pravahai] ${sourceLang} → ${targetLang}: OK`);
    } catch (pravahaiErr) {
      console.log(`[Pravahai] Failed: ${pravahaiErr.message} — using Google`);
      translatedText = await translateWithGoogle(text.trim(), sourceLang || 'auto', targetLang);
      usedEngine = 'google';
    }

    const detectedLang = sourceLang || 'auto';

    // History background mein save karo — response wait nahi
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

    return res.json({ success: true, translatedText, detectedLang, engine: usedEngine });
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
