const express = require('express');
const axios = require('axios');
const { translate } = require('@vitalets/google-translate-api');
const router = express.Router();
const History = require('../models/History');

const LANGBLY_KEY = process.env.LANGBLY_API_KEY;
const LANGBLY_URL = 'https://api.langbly.com/language/translate/v2';

// Script-based language detection — fast, no API needed
const detectScriptMismatch = (text, selectedLang) => {
  if (!text || !selectedLang || selectedLang === 'auto') return null;

  const scripts = {
    // Devanagari — Hindi, Marathi, Nepali, Sanskrit (same script, allow all)
    devanagari: /[\u0900-\u097F]/,
    // Bengali
    bengali: /[\u0980-\u09FF]/,
    // Tamil
    tamil: /[\u0B80-\u0BFF]/,
    // Telugu
    telugu: /[\u0C00-\u0C7F]/,
    // Kannada
    kannada: /[\u0C80-\u0CFF]/,
    // Malayalam
    malayalam: /[\u0D00-\u0D7F]/,
    // Gujarati
    gujarati: /[\u0A80-\u0AFF]/,
    // Punjabi/Gurmukhi
    gurmukhi: /[\u0A00-\u0A7F]/,
    // Arabic/Urdu/Persian
    arabic: /[\u0600-\u06FF]/,
    // Latin (English, French, German, Spanish, etc.)
    latin: /[a-zA-Z]/,
    // Chinese
    chinese: /[\u4E00-\u9FFF]/,
    // Japanese
    japanese: /[\u3040-\u30FF\u4E00-\u9FFF]/,
    // Korean
    korean: /[\uAC00-\uD7AF]/,
    // Cyrillic (Russian, Ukrainian)
    cyrillic: /[\u0400-\u04FF]/,
    // Thai
    thai: /[\u0E00-\u0E7F]/,
  };

  // Map language to expected script
  const langScript = {
    hi: 'devanagari', mr: 'devanagari', ne: 'devanagari',
    bn: 'bengali', as: 'bengali',
    ta: 'tamil',
    te: 'telugu',
    kn: 'kannada',
    ml: 'malayalam',
    gu: 'gujarati',
    pa: 'gurmukhi',
    ur: 'arabic', ar: 'arabic', fa: 'arabic',
    en: 'latin', fr: 'latin', de: 'latin', es: 'latin',
    it: 'latin', pt: 'latin', nl: 'latin', pl: 'latin',
    tr: 'latin', id: 'latin', ms: 'latin', vi: 'latin', sw: 'latin',
    'zh-CN': 'chinese',
    ja: 'japanese',
    ko: 'korean',
    ru: 'cyrillic', uk: 'cyrillic',
    th: 'thai',
  };

  const expectedScript = langScript[selectedLang];
  if (!expectedScript) return null;

  // Check what script the text actually uses
  const textScripts = Object.entries(scripts).filter(([, regex]) => regex.test(text));
  if (!textScripts.length) return null;

  const dominantScript = textScripts[0][0];

  // If text script doesn't match expected script — mismatch!
  if (dominantScript !== expectedScript) {
    return {
      mismatch: true,
      textScript: dominantScript,
      expectedScript,
    };
  }
  return null;
};

// Language name map for user-friendly messages
const LANG_NAMES = {
  hi: 'Hindi', en: 'English', bn: 'Bengali', ta: 'Tamil', te: 'Telugu',
  mr: 'Marathi', gu: 'Gujarati', kn: 'Kannada', ml: 'Malayalam', pa: 'Punjabi',
  ur: 'Urdu', fr: 'French', de: 'German', es: 'Spanish', ja: 'Japanese',
  'zh-CN': 'Chinese', ar: 'Arabic', ru: 'Russian', ko: 'Korean', pt: 'Portuguese',
  it: 'Italian', tr: 'Turkish', nl: 'Dutch', pl: 'Polish', th: 'Thai',
  vi: 'Vietnamese', id: 'Indonesian', ms: 'Malay', fa: 'Persian', sw: 'Swahili',
  ne: 'Nepali', si: 'Sinhala', sd: 'Sindhi', as: 'Assamese',
};

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

    // Use Langbly to detect language
    try {
      const r = await axios.post(LANGBLY_URL, null, {
        params: { q: text.trim().slice(0, 100), target: 'en', key: LANGBLY_KEY },
        timeout: 8000,
      });
      const detected = r.data?.data?.translations?.[0]?.detectedSourceLanguage;
      if (detected) {
        return res.json({ success: true, detectedLang: detected, confidence: 1 });
      }
    } catch (e) {}

    return res.json({ success: true, detectedLang: 'auto', confidence: 0 });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
