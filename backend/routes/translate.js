const express = require('express');
const axios = require('axios');
const router = express.Router();
const History = require('../models/History');

const LANGBLY_KEY = process.env.LANGBLY_API_KEY;
const LANGBLY_URL = 'https://api.langbly.com/language/translate/v2';
const PRAVAHAI_URL = process.env.PRAVAHAI_URL || 'https://pravahai.aicte-india.org/api/translatebulk';

// ─── Pravahai Language Code Mapping ─────────────────────────────────────────
// App uses short codes (hi, ta, en...) → Pravahai needs (hi-IN, ta-IN, en-IN, fr-FO...)
const PRAVAHAI_CODE_MAP = {
  // Indian languages only → xx-IN
  hi: 'hi-IN', bn: 'bn-IN', ta: 'ta-IN', te: 'te-IN', mr: 'mr-IN',
  gu: 'gu-IN', kn: 'kn-IN', ml: 'ml-IN', pa: 'pa-IN', or: 'or-IN',
  as: 'as-IN', ur: 'ur-IN', ne: 'ne-IN', sa: 'sa-IN',
  mai: 'mai-IN', sat: 'sat-IN', ks: 'ks-ar-IN', kok: 'gom-IN',
  sd: 'sd-dn-IN', doi: 'doi-IN', 'mni-Mtei': 'mni-IN', brx: 'brx-IN',
  en: 'en-IN',
};

const toPravahaiCode = (code) => {
  if (!code || code === 'auto') return null;
  return PRAVAHAI_CODE_MAP[code] || null;
};

// ─── Langbly Language Code Normalization ────────────────────────────────────
// Some app codes differ from what Langbly expects
const LANGBLY_CODE_MAP = {
  'zh-CN': 'zh',
  'mni-Mtei': 'mni',
};
const toLangblyCode = (code) => LANGBLY_CODE_MAP[code] || code;

// ─── Langbly Translation ─────────────────────────────────────────────────────
const translateWithLangbly = async (text, sourceLang, targetLang) => {
  const target = toLangblyCode(targetLang);
  const source = (!sourceLang || sourceLang === 'auto') ? 'en' : toLangblyCode(sourceLang);
  const params = { q: text, target, source, key: LANGBLY_KEY };
  const res = await axios.post(LANGBLY_URL, null, { params, timeout: 15000 });
  const translation = res.data?.data?.translations?.[0];
  if (!translation?.translatedText) throw new Error('Empty Langbly response');
  return { text: translation.translatedText, detectedLang: translation.detectedSourceLanguage || sourceLang || 'auto' };
};

// ─── Pravahai Translation ────────────────────────────────────────────────────
const translateWithPravahai = async (text, targetLang) => {
  const toCode = toPravahaiCode(targetLang);
  if (!toCode) throw new Error(`Pravahai: unsupported lang ${targetLang}`);

  const res = await axios.post(
    PRAVAHAI_URL,
    [{ text, to: toCode }],
    { headers: { 'Content-Type': 'application/json' }, timeout: 20000 }
  );

  const translated = res.data?.[0]?.translations?.[0]?.text;
  if (!translated) throw new Error('Pravahai: empty response');
  return { text: translated };
};

// ─── MyMemory Translation (fallback) ────────────────────────────────────────
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

// ─── Script-based language detection ────────────────────────────────────────
const LANG_SCRIPT_MAP = {
  hi: 'devanagari', mr: 'devanagari', ne: 'devanagari',
  bn: 'bengali', as: 'bengali',
  ta: 'tamil', te: 'telugu', kn: 'kannada', ml: 'malayalam',
  gu: 'gujarati', pa: 'gurmukhi',
  ur: 'arabic', ar: 'arabic', fa: 'arabic',
  en: 'latin', fr: 'latin', de: 'latin', es: 'latin',
  it: 'latin', pt: 'latin', nl: 'latin', pl: 'latin',
  tr: 'latin', id: 'latin', ms: 'latin', vi: 'latin', sw: 'latin',
  'zh-CN': 'chinese', ja: 'japanese', ko: 'korean',
  ru: 'cyrillic', uk: 'cyrillic', th: 'thai',
};

const SCRIPT_REGEX = {
  devanagari: /[\u0900-\u097F]/,
  bengali: /[\u0980-\u09FF]/,
  tamil: /[\u0B80-\u0BFF]/,
  telugu: /[\u0C00-\u0C7F]/,
  kannada: /[\u0C80-\u0CFF]/,
  malayalam: /[\u0D00-\u0D7F]/,
  gujarati: /[\u0A80-\u0AFF]/,
  gurmukhi: /[\u0A00-\u0A7F]/,
  arabic: /[\u0600-\u06FF]/,
  latin: /[a-zA-Z]/,
  chinese: /[\u4E00-\u9FFF]/,
  japanese: /[\u3040-\u30FF\u4E00-\u9FFF]/,
  korean: /[\uAC00-\uD7AF]/,
  cyrillic: /[\u0400-\u04FF]/,
  thai: /[\u0E00-\u0E7F]/,
};

const detectScriptMismatch = (text, selectedLang) => {
  if (!text || !selectedLang || selectedLang === 'auto') return null;
  const expectedScript = LANG_SCRIPT_MAP[selectedLang];
  if (!expectedScript) return null;
  const textScripts = Object.entries(SCRIPT_REGEX).filter(([, r]) => r.test(text));
  if (!textScripts.length) return null;
  const dominantScript = textScripts[0][0];
  if (dominantScript !== expectedScript) {
    return { mismatch: true, textScript: dominantScript, expectedScript };
  }
  return null;
};

// ─── POST /api/translate ─────────────────────────────────────────────────────
router.post('/', async (req, res, next) => {
  try {
    const { text, sourceLang, targetLang, sourceLangName, targetLangName, saveHistory } = req.body;

    if (!text?.trim()) return res.status(400).json({ success: false, error: 'Text is required' });
    if (!targetLang) return res.status(400).json({ success: false, error: 'Target language is required' });

    // Script mismatch check (fast, no API)
    if (sourceLang && sourceLang !== 'auto') {
      const mismatch = detectScriptMismatch(text.trim(), sourceLang);
      if (mismatch) {
        return res.status(400).json({
          success: false,
          error: `Please select the correct language. Text script doesn't match selected source language.`,
          mismatch: true,
        });
      }
    }

    let translatedText = '';
    let detectedLang = sourceLang || 'auto';
    let usedEngine = '';

    // Indian languages supported by Pravahai (AICTE) — used as fallback for these
    const PRAVAHAI_SUPPORTED = new Set([
      'hi','bn','ta','te','mr','gu','kn','ml','pa','or',
      'as','ur','ne','sa','mai','sat','ks','kok','sd','doi','mni-Mtei','brx',
    ]);

    // ── Indian languages → Pravahai ──
    if (PRAVAHAI_SUPPORTED.has(targetLang)) {
      try {
        const result = await translateWithPravahai(text.trim(), targetLang);
        translatedText = result.text;
        usedEngine = 'pravahai';
        console.log(`[Pravahai] →${targetLang}: OK`);
      } catch (e) {
        console.log(`[Pravahai] Failed: ${e.message} — MyMemory fallback`);
        try {
          const result = await translateWithMyMemory(text.trim(), sourceLang, targetLang);
          translatedText = result.text;
          detectedLang = result.detectedLang;
          usedEngine = 'mymemory';
        } catch (mmErr) {
          return res.status(503).json({ success: false, error: 'Translation unavailable. Try again.' });
        }
      }
    } else {
      // ── Foreign languages → Langbly → MyMemory fallback ──
      if (LANGBLY_KEY) {
        try {
          const result = await translateWithLangbly(text.trim(), sourceLang, targetLang);
          translatedText = result.text;
          detectedLang = result.detectedLang;
          usedEngine = 'langbly';
          console.log(`[Langbly] →${targetLang}: OK`);
        } catch (langblyErr) {
          console.log(`[Langbly] Failed: ${langblyErr.message} — MyMemory fallback`);
          try {
            const result = await translateWithMyMemory(text.trim(), sourceLang, targetLang);
            translatedText = result.text;
            detectedLang = result.detectedLang;
            usedEngine = 'mymemory';
          } catch (mmErr) {
            return res.status(503).json({ success: false, error: 'Translation unavailable. Try again.' });
          }
        }
      } else {
        try {
          const result = await translateWithMyMemory(text.trim(), sourceLang, targetLang);
          translatedText = result.text;
          detectedLang = result.detectedLang;
          usedEngine = 'mymemory';
        } catch (mmErr) {
          return res.status(503).json({ success: false, error: 'Translation unavailable. Try again.' });
        }
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

// ─── POST /api/translate/detect ──────────────────────────────────────────────
router.post('/detect', async (req, res, next) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ success: false, error: 'Text is required' });
    
    // Auto-detect always returns 'auto' without Langbly
    return res.json({ success: true, detectedLang: 'auto', confidence: 0 });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
