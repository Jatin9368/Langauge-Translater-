const express = require('express');
const axios = require('axios');
const router = express.Router();

const GROQ_API_KEY = process.env.GROQ_API_KEY;

const callGroq = async (text, langName) => {
  const prompt = `Given sentence ko 3 styles me rewrite karo: Gen-Z, Funny, aur Formal.

Rules:
- Meaning bilkul same rehna chahiye
- Language same rehni chahiye: ${langName}
- Natural, fluent aur human-like hona chahiye
- Koi abusive ya offensive words use na ho
- Literal translation avoid karo
- Har style ke liye exactly 2 variations do

Output format:
Gen-Z 1: <sentence>
Gen-Z 2: <sentence>
Funny 1: <sentence>
Funny 2: <sentence>
Formal 1: <sentence>
Formal 2: <sentence>

Sentence: ${text}`;

  const res = await axios.post(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 400,
      temperature: 0.5,
    },
    {
      headers: { Authorization: `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      timeout: 25000,
    }
  );
  return res.data?.choices?.[0]?.message?.content?.trim() || '';
};

const parseStyles = (raw) => {
  const result = { gen_z: [], funny: [], formal: [] };

  const extract = (label) => {
    const matches = [];
    const r1 = new RegExp(`${label} 1:\\s*(.+)`, 'i');
    const r2 = new RegExp(`${label} 2:\\s*(.+)`, 'i');
    const m1 = raw.match(r1);
    const m2 = raw.match(r2);
    if (m1) matches.push(m1[1].trim());
    if (m2) matches.push(m2[1].trim());
    return matches;
  };

  result.gen_z = extract('Gen-Z');
  result.funny = extract('Funny');
  result.formal = extract('Formal');
  return result;
};

const langNames = {
  hi: 'Hindi', en: 'English', bn: 'Bengali', ta: 'Tamil', te: 'Telugu',
  mr: 'Marathi', gu: 'Gujarati', kn: 'Kannada', ml: 'Malayalam', pa: 'Punjabi',
  ur: 'Urdu', fr: 'French', de: 'German', es: 'Spanish', ja: 'Japanese',
  'zh-CN': 'Chinese', ar: 'Arabic', ru: 'Russian', ko: 'Korean', pt: 'Portuguese',
  it: 'Italian', tr: 'Turkish', nl: 'Dutch', pl: 'Polish', th: 'Thai',
  vi: 'Vietnamese', id: 'Indonesian', ms: 'Malay', fa: 'Persian', sw: 'Swahili',
};

router.post('/rephrase', async (req, res, next) => {
  try {
    const { text, targetLang } = req.body;
    if (!text?.trim()) return res.status(400).json({ success: false, error: 'Text is required' });

    // Convert to English for Groq (more reliable)
    let inputText = text.trim();
    let needsTranslation = targetLang !== 'en';

    if (needsTranslation) {
      try {
        // Use Langbly for Hindi→English conversion
        const LANGBLY_KEY = process.env.LANGBLY_API_KEY;
        const toEnRes = await axios.post(
          'https://api.langbly.com/language/translate/v2',
          null,
          { params: { q: text.trim(), target: 'en', source: targetLang, key: LANGBLY_KEY }, timeout: 8000 }
        );
        const enText = toEnRes.data?.data?.translations?.[0]?.translatedText;
        if (enText) inputText = enText;
        else needsTranslation = false;
      } catch (e) {
        needsTranslation = false;
        inputText = text.trim();
      }
    }

    let rawOutput = '';
    try {
      rawOutput = await callGroq(inputText, 'English');
      console.log('[Style] OK, length:', rawOutput.length);
    } catch (e) {
      console.error('[Style] Groq error:', e.message);
      return res.status(503).json({ success: false, error: 'Style generation failed.' });
    }

    const parsed = parseStyles(rawOutput);

    // Translate back to target language using Langbly
    const LANGBLY_KEY = process.env.LANGBLY_API_KEY;
    const translateToTarget = async (arr) => {
      if (!needsTranslation || !arr.length) return arr;
      const results = [];
      for (const opt of arr) {
        try {
          const r = await axios.post(
            'https://api.langbly.com/language/translate/v2',
            null,
            { params: { q: opt, target: targetLang, source: 'en', key: LANGBLY_KEY }, timeout: 8000 }
          );
          const t = r.data?.data?.translations?.[0]?.translatedText;
          results.push(t || opt);
        } catch (e) {
          results.push(opt);
        }
      }
      return results;
    };

    const [gen_zOpts, funnyOpts, formalOpts] = await Promise.all([
      translateToTarget(parsed.gen_z),
      translateToTarget(parsed.funny),
      translateToTarget(parsed.formal),
    ]);

    const styles = {
      gen_z:  { emoji: '\uD83D\uDE0E', label: 'Gen-Z',  options: gen_zOpts,  text: gen_zOpts[0] || text },
      funny:  { emoji: '\uD83D\uDE02', label: 'Funny',   options: funnyOpts,  text: funnyOpts[0] || text },
      formal: { emoji: '\uD83D\uDC54', label: 'Formal',  options: formalOpts, text: formalOpts[0] || text },
    };

    return res.json({ success: true, styles });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
