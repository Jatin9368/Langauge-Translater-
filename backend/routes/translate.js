const express = require('express');
const axios = require('axios');
const router = express.Router();
const History = require('../models/History');

const LANGBLY_KEY = process.env.LANGBLY_API_KEY;
const LANGBLY_URL = 'https://api.langbly.com/language/translate/v2';
const PRAVAHAI_URL = 'https://pravahai.aicte-india.org/api/translatebulk';

// ─── Pravahai Language Code Mapping ─────────────────────────────────────────
// App uses short codes (hi, ta, en...) → Pravahai needs (hi-IN, ta-IN, en-IN, fr-FO...)
const PRAVAHAI_CODE_MAP = {
  // Indian languages → xx-IN
  hi: 'hi-IN', bn: 'bn-IN', ta: 'ta-IN', te: 'te-IN', mr: 'mr-IN',
  gu: 'gu-IN', kn: 'kn-IN', ml: 'ml-IN', pa: 'pa-IN', or: 'or-IN',
  as: 'as-IN', ur: 'ur-IN', ne: 'ne-IN', sa: 'sa-IN',
  mai: 'mai-IN', sat: 'sat-IN', ks: 'ks-ar-IN', kok: 'gom-IN',
  sd: 'sd-dn-IN', doi: 'doi-IN', 'mni-Mtei': 'mni-IN', brx: 'brx-IN',
  en: 'en-IN',
  // Foreign languages → xx-FO
  es: 'es-FO', fr: 'fr-FO', de: 'de-FO', ja: 'ja-FO', ko: 'ko-FO',
  ar: 'ar-FO', ru: 'ru-FO', pt: 'pt-FO', it: 'it-FO', tr: 'tr-FO',
  nl: 'nl-FO', pl: 'pl-FO', th: 'th-FO', vi: 'vi-FO', id: 'id-FO',
  ms: 'ms-FO', fa: 'fa-FO', sw: 'sw-FO', 'zh-CN': 'zh-FO', uk: 'uk-FO',
  bg: 'bg-FO', cs: 'cs-FO', da: 'da-FO', fi: 'fi-FO', el: 'el-FO',
  hr: 'hr-FO', hu: 'hu-FO', ro: 'ro-FO', sk: 'sk-FO', sv: 'sv-FO',
  he: 'he-FO', si: 'si-FO', ka: 'ka-FO', az: 'az-FO', kk: 'kk-FO',
  uz: 'uz-FO', mn: 'mn-FO', km: 'km-FO', lo: 'lo-FO', my: 'my-FO',
  am: 'am-FO', yo: 'yo-FO', ig: 'ig-FO', ha: 'ha-FO', zu: 'zu-FO',
};

const toPravahaiCode = (code) => {
  if (!code || code === 'auto') return null;
  return PRAVAHAI_CODE_MAP[code] || null;
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

// ─── Langbly Translation (fallback) ─────────────────────────────────────────
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

// ─── MyMemory Translation (last fallback) ───────────────────────────────────
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

    // ── Primary: Pravahai (AICTE) ──
    try {
      const result = await translateWithPravahai(text.trim(), targetLang);
      translatedText = result.text;
      usedEngine = 'pravahai';
      console.log(`[Pravahai] →${targetLang}: OK`);
    } catch (pravahaiErr) {
      console.log(`[Pravahai] Failed: ${pravahaiErr.message} — Langbly fallback`);

      // ── Fallback 1: Langbly ──
      try {
        const result = await translateWithLangbly(text.trim(), sourceLang, targetLang);
        translatedText = result.text;
        detectedLang = result.detectedLang;
        usedEngine = 'langbly';
        console.log(`[Langbly] ${sourceLang}→${targetLang}: OK`);
      } catch (langblyErr) {
        console.log(`[Langbly] Failed: ${langblyErr.message} — MyMemory fallback`);

        // ── Fallback 2: MyMemory ──
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

    try {
      const r = await axios.post(LANGBLY_URL, null, {
        params: { q: text.trim().slice(0, 100), target: 'en', key: LANGBLY_KEY },
        timeout: 8000,
      });
      const detected = r.data?.data?.translations?.[0]?.detectedSourceLanguage;
      if (detected) return res.json({ success: true, detectedLang: detected, confidence: 1 });
    } catch (e) {}

    return res.json({ success: true, detectedLang: 'auto', confidence: 0 });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
