const express = require('express');
const axios = require('axios');
const router = express.Router();

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const LANGBLY_KEY = process.env.LANGBLY_API_KEY;

// ─── Translate to English for Groq ───────────────────────────────────────────
const toEnglish = async (text, sourceLang) => {
  if (!sourceLang || sourceLang === 'en') return text;
  try {
    const res = await axios.post(
      'https://api.langbly.com/language/translate/v2',
      null,
      { params: { q: text, target: 'en', source: sourceLang, key: LANGBLY_KEY }, timeout: 8000 }
    );
    return res.data?.data?.translations?.[0]?.translatedText || text;
  } catch (_) { return text; }
};

// ─── Translate back to target language ───────────────────────────────────────
const toTargetLang = async (text, targetLang) => {
  if (!targetLang || targetLang === 'en') return text;
  try {
    const res = await axios.post(
      'https://api.langbly.com/language/translate/v2',
      null,
      { params: { q: text, target: targetLang, source: 'en', key: LANGBLY_KEY }, timeout: 8000 }
    );
    return res.data?.data?.translations?.[0]?.translatedText || text;
  } catch (_) { return text; }
};

// ─── Groq: Generate 3 options per style ──────────────────────────────────────
const generateStyles = async (text) => {
  const prompt = `Rewrite the following sentence in 3 different styles. Give exactly 3 variations for each style.

Rules:
- Keep the core meaning same
- Each variation must be different from others
- Sound natural when spoken
- No labels, no numbering, no explanations — just the sentences
- Output format must be exactly as shown below

Output format:
GEN_Z_1: <sentence>
GEN_Z_2: <sentence>
GEN_Z_3: <sentence>
FUNNY_1: <sentence>
FUNNY_2: <sentence>
FUNNY_3: <sentence>
FORMAL_1: <sentence>
FORMAL_2: <sentence>
FORMAL_3: <sentence>

Style guides:
- Gen-Z: Use casual slang, abbreviations, internet language (no cap, fr, lowkey, vibe, slay, bussin, etc.)
- Funny: Witty, humorous, playful, add jokes or funny observations
- Formal: Professional, polished, sophisticated language

Sentence: ${text}`;

  const res = await axios.post(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 600,
      temperature: 0.8,
    },
    {
      headers: { Authorization: `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      timeout: 20000,
    }
  );
  return res.data?.choices?.[0]?.message?.content?.trim() || '';
};

// ─── Parse Groq output ────────────────────────────────────────────────────────
const parseOutput = (raw) => {
  const extract = (prefix) => {
    const results = [];
    for (let i = 1; i <= 3; i++) {
      const match = raw.match(new RegExp(`${prefix}_${i}:\\s*(.+)`, 'i'));
      if (match) results.push(match[1].trim());
    }
    return results;
  };
  return {
    gen_z:  extract('GEN_Z'),
    funny:  extract('FUNNY'),
    formal: extract('FORMAL'),
  };
};

// ─── POST /api/vibe/rephrase ──────────────────────────────────────────────────
router.post('/rephrase', async (req, res, next) => {
  try {
    const { text, targetLang } = req.body;
    if (!text?.trim()) return res.status(400).json({ success: false, error: 'Text is required' });

    console.log(`[Vibe] Request: "${text.slice(0, 50)}" | lang=${targetLang}`);

    // Step 1: Convert to English for Groq
    const enText = await toEnglish(text.trim(), targetLang);

    // Step 2: Generate 3 styles × 3 options in English
    const raw = await generateStyles(enText);
    const parsed = parseOutput(raw);

    // Step 3: Translate all options back to target language
    const translateArr = async (arr) => {
      if (!targetLang || targetLang === 'en') return arr;
      const out = [];
      for (const t of arr) {
        out.push(await toTargetLang(t, targetLang));
      }
      return out;
    };

    const [gen_zOpts, funnyOpts, formalOpts] = await Promise.all([
      translateArr(parsed.gen_z),
      translateArr(parsed.funny),
      translateArr(parsed.formal),
    ]);

    const styles = {
      gen_z:  { emoji: '😎', label: 'Gen-Z',  desc: 'Casual & Slangy',    accent: '#7C3AED', options: gen_zOpts,  text: gen_zOpts[0]  || text },
      funny:  { emoji: '😂', label: 'Funny',   desc: 'Witty & Playful',    accent: '#DB2777', options: funnyOpts,  text: funnyOpts[0]  || text },
      formal: { emoji: '👔', label: 'Formal',  desc: 'Professional',       accent: '#059669', options: formalOpts, text: formalOpts[0] || text },
    };

    console.log(`[Vibe] Done: gen_z=${gen_zOpts.length} funny=${funnyOpts.length} formal=${formalOpts.length}`);

    return res.json({ success: true, originalText: text.trim(), styles });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
