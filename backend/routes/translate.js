const express = require('express');
const axios = require('axios');
const router = express.Router();
const History = require('../models/History');

// MyMemory Free API — no key needed, no rate limit for normal use
const translateWithMyMemory = async (text, sourceLang, targetLang) => {
  const src = (!sourceLang || sourceLang === 'auto') ? 'en' : sourceLang;
  const langPair = `${src}|${targetLang}`;

  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${langPair}&de=bharattranslate@app.com`;

  const response = await axios.get(url, { timeout: 15000 });

  const data = response.data;
  if (data.responseStatus === 200 && data.responseData?.translatedText) {
    return {
      text: data.responseData.translatedText,
      detectedLang: src,
    };
  }
  throw new Error(data.responseDetails || 'MyMemory failed');
};

// HuggingFace as secondary option
const translateWithHF = async (text, sourceLang, targetLang) => {
  const HF_API_KEY = process.env.HUGGINGFACE_API_KEY;
  const MODEL_MAP = {
    'en-hi': 'opus-mt-en-hi', 'hi-en': 'opus-mt-hi-en',
    'en-fr': 'opus-mt-en-fr', 'fr-en': 'opus-mt-fr-en',
    'en-de': 'opus-mt-en-de', 'de-en': 'opus-mt-de-en',
    'en-es': 'opus-mt-en-es', 'es-en': 'opus-mt-es-en',
    'en-ar': 'opus-mt-en-ar', 'ar-en': 'opus-mt-ar-en',
    'en-ru': 'opus-mt-en-ru', 'ru-en': 'opus-mt-ru-en',
    'en-zh': 'opus-mt-en-zh', 'en-ja': 'opus-mt-en-jap',
    'en-bn': 'opus-mt-en-bn', 'en-ur': 'opus-mt-en-ur',
    'en-ta': 'opus-mt-en-dra', 'en-te': 'opus-mt-en-dra',
    'en-ml': 'opus-mt-en-dra', 'en-kn': 'opus-mt-en-dra',
  };

  const src = sourceLang === 'auto' ? 'en' : sourceLang;
  const model = MODEL_MAP[`${src}-${targetLang}`];
  if (!model) throw new Error(`No HF model for ${src}-${targetLang}`);

  const res = await axios.post(
    `https://router.huggingface.co/hf-inference/models/Helsinki-NLP/${model}`,
    { inputs: text },
    {
      headers: { Authorization: `Bearer ${HF_API_KEY}`, 'Content-Type': 'application/json' },
      timeout: 20000,
    }
  );

  const translated = res.data?.[0]?.translation_text;
  if (!translated) throw new Error('Empty HF response');
  return { text: translated, detectedLang: src };
};

// POST /api/translate
router.post('/', async (req, res, next) => {
  try {
    const { text, sourceLang, targetLang, sourceLangName, targetLangName, saveHistory } = req.body;

    if (!text?.trim()) return res.status(400).json({ success: false, error: 'Text is required' });
    if (!targetLang) return res.status(400).json({ success: false, error: 'Target language is required' });

    let translatedText = '';
    let detectedLang = sourceLang || 'auto';
    let usedEngine = '';

    // Try MyMemory first — most reliable
    try {
      const result = await translateWithMyMemory(text.trim(), sourceLang || 'auto', targetLang);
      translatedText = result.text;
      detectedLang = result.detectedLang || sourceLang || 'auto';
      usedEngine = 'mymemory';
      console.log(`[MyMemory] ${sourceLang}→${targetLang}: OK`);
    } catch (mmErr) {
      console.log(`[MyMemory] Failed: ${mmErr.message} — trying HuggingFace`);
      // HuggingFace fallback
      try {
        const result = await translateWithHF(text.trim(), sourceLang || 'auto', targetLang);
        translatedText = result.text;
        detectedLang = result.detectedLang;
        usedEngine = 'huggingface';
        console.log(`[HF] ${sourceLang}→${targetLang}: OK`);
      } catch (hfErr) {
        console.log(`[HF] Failed: ${hfErr.message}`);
        return res.status(503).json({
          success: false,
          error: 'Translation unavailable. Please try again.',
        });
      }
    }

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
    if (!text?.trim()) return res.status(400).json({ success: false, error: 'Text is required' });
    try {
      const result = await translateWithMyMemory(text.trim(), 'auto', 'en');
      return res.json({ success: true, detectedLang: result.detectedLang || 'auto', confidence: 1 });
    } catch {
      return res.json({ success: true, detectedLang: 'auto', confidence: 0 });
    }
  } catch (err) {
    next(err);
  }
});

module.exports = router;
