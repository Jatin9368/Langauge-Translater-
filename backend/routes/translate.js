const express = require('express');
const axios = require('axios');
const { translate } = require('@vitalets/google-translate-api');
const router = express.Router();
const History = require('../models/History');

const LANGBLY_KEY = process.env.LANGBLY_API_KEY;
const LANGBLY_URL = 'https://api.langbly.com/language/translate/v2';

// Detect language using Google
const detectLanguage = async (text) => {
  try {
    const res = await translate(text.slice(0, 100), { to: 'en' });
    return res.raw?.src || null;
  } catch (e) {
    return null;
  }
};

// Langbly Translation API
const translateWithLangbly = async (text, sourceLang, targetLang) => {
  const params = { q: text, target: targetLang, key: LANGBLY_KEY };
  if (sourceLang && sourceLang !== 'auto') params.source = sourceLang;
  const res = await axios.post(LANGBLY_URL, null, { params, timeout: 15000 });
  const translation = res.data?.data?.translations?.[0];
  if (!translation?.translatedText) throw new Error('Empty Langbly response');
  const t = translation.translatedText;
  const badChars = (t.match(/[^\x09\x0A\x0D\x20-\uD7FF\uE000-\uFFFD]/g) || []).length;
  if (t.length > 0 && badChars / t.length > 0.3) throw new Error('Garbled response');
  return { text: t, detectedLang: translation.detectedSourceLanguage || sourceLang || 'auto' };
};

// Languages that need English as pivot for best quality
const PIVOT_LANGS = new Set([
  'te', 'ta', 'ml', 'kn', 'or', 'as', 'mai', 'sat', 'ks',
  'kok', 'sd', 'doi', 'mni-Mtei', 'brx', 'pa', 'gu', 'mr',
  'bn', 'ur', 'ne', 'sw', 'ms', 'fa',
]);

const translateWithPivot = async (text, sourceLang, targetLang) => {
  const step1 = await translateWithLangbly(text, sourceLang, 'en');
  const step2 = await translateWithLangbly(step1.text, 'en', targetLang);
  return { text: step2.text, detectedLang: sourceLang };
};

// MyMemory fallback
const translateWithMyMemory = async (text, sourceLang, targetLang) => {
  const src = (!sourceLang || sourceLang === 'auto') ? 'en' : sourceLang;
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${src}|${targetLang}`;
  const res = await axios.get(url, { timeout: 15000 });
  const data = res.data;
  if (data.responseStatus === 200 && data.responseData?.translatedText) {
    return { text: data.responseData.translatedText, detectedLang: src };
  }
  throw new Error('MyMemory failed');
};

// POST /api/translate
router.post('/', async (req, res, next) => {
  try {
    const { text, sourceLang, targetLang, sourceLangName, targetLangName, saveHistory } = req.body;

    if (!text?.trim()) return res.status(400).json({ success: false, error: 'Text is required' });
    if (!targetLang) return res.status(400).json({ success: false, error: 'Target language is required' });

    // Agar source language manually select ki hai (auto nahi) toh validate karo
    if (sourceLang && sourceLang !== 'auto') {
      const detectedLangCode = await detectLanguage(text.trim());
      if (detectedLangCode && detectedLangCode !== sourceLang) {
        return res.status(400).json({
          success: false,
          error: `Language mismatch! You selected "${sourceLang}" but the text appears to be in "${detectedLangCode}". Please select the correct source language or use "Auto Detect".`,
          detectedLang: detectedLangCode,
          selectedLang: sourceLang,
        });
      }
    }

    let translatedText = '';
    let detectedLang = sourceLang || 'auto';
    let usedEngine = '';

    try {
      const usePivot = PIVOT_LANGS.has(sourceLang) || PIVOT_LANGS.has(targetLang);
      let result;

      if (usePivot && sourceLang !== 'en' && targetLang !== 'en') {
        result = await translateWithPivot(text.trim(), sourceLang || 'auto', targetLang);
        console.log(`[Langbly Pivot] ${sourceLang}→en→${targetLang}: OK`);
      } else {
        result = await translateWithLangbly(text.trim(), sourceLang, targetLang);
        console.log(`[Langbly] ${sourceLang}→${targetLang}: OK`);
      }

      translatedText = result.text;
      detectedLang = result.detectedLang;
      usedEngine = 'langbly';
    } catch (err) {
      console.log(`[Langbly] Failed: ${err.message} — MyMemory fallback`);
      try {
        const result = await translateWithMyMemory(text.trim(), sourceLang, targetLang);
        translatedText = result.text;
        detectedLang = result.detectedLang;
        usedEngine = 'mymemory';
      } catch (mmErr) {
        return res.status(503).json({ success: false, error: 'Translation unavailable. Try again.' });
      }
    }

    if (saveHistory !== false) {
      History.create({
        sourceText: text.trim(), translatedText,
        sourceLang: detectedLang, targetLang,
        sourceLangName: sourceLangName || detectedLang,
        targetLangName: targetLangName || targetLang,
      }).catch((e) => console.error('History save error:', e.message));
    }

    return res.json({ success: true, translatedText, detectedLang, engine: usedEngine });
  } catch (err) {
    next(err);
  }
});

// POST /api/translate/detect
router.post('/detect', async (req, res, next) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ success: false, error: 'Text is required' });
    return res.json({ success: true, detectedLang: 'auto', confidence: 0 });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
