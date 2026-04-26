const express = require('express');
const axios = require('axios');
const router = express.Router();

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const LANGBLY_KEY = process.env.LANGBLY_API_KEY;

// ─── Step 1: Translate input to English ──────────────────────────────────────
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

// ─── Step 2: Translate English output back to target language ─────────────────
const translateBatch = async (sentences, targetLang) => {
  if (!targetLang || targetLang === 'en') return sentences;
  const translateOne = async (s, retries = 2) => {
    for (let i = 0; i <= retries; i++) {
      try {
        const res = await axios.post(
          'https://api.langbly.com/language/translate/v2',
          null,
          { params: { q: s, target: targetLang, source: 'en', key: LANGBLY_KEY }, timeout: 10000 }
        );
        const translated = res.data?.data?.translations?.[0]?.translatedText;
        if (translated) return translated;
      } catch (_) {}
    }
    return s; // fallback to original
  };
  return Promise.all(sentences.map(s => translateOne(s)));
};

// ─── Gemma2 via Groq generates 4 styles ──────────────────────────────────────
const generateStylesWithAI = async (text) => {
  const prompt = `You are a text style rewriter. Rewrite the sentence below in 4 communication styles.

RULES:
1. Keep the EXACT SAME meaning — do NOT change what the sentence is about
2. ALWAYS write in ENGLISH ONLY
3. Each line must start with the exact label shown
4. No extra text, no explanations

OUTPUT FORMAT:
GEN_Z_1: <rewrite>
GEN_Z_2: <rewrite>
GEN_Z_3: <rewrite>
CASUAL_1: <rewrite>
CASUAL_2: <rewrite>
CASUAL_3: <rewrite>
PROFESSIONAL_1: <rewrite>
PROFESSIONAL_2: <rewrite>
PROFESSIONAL_3: <rewrite>
CONFIDENT_1: <rewrite>
CONFIDENT_2: <rewrite>
CONFIDENT_3: <rewrite>

STYLES:
- GEN_Z: Gen-Z slang, internet culture, casual texting (no cap, lowkey, fr fr, it's giving, slay)
- CASUAL: Friendly, relaxed, everyday tone
- PROFESSIONAL: Formal, polished, work/official tone
- CONFIDENT: Direct, assertive, bold tone

Sentence: ${text}`;

  const res = await axios.post(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 600,
      temperature: 0.5,
    },
    { headers: { Authorization: `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' }, timeout: 20000 }
  );
  return res.data?.choices?.[0]?.message?.content?.trim() || '';
};

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
    gen_z:        extract('GEN_Z'),
    casual:       extract('CASUAL'),
    professional: extract('PROFESSIONAL'),
    confident:    extract('CONFIDENT'),
  };
};

// ─── Rule-based fallback ──────────────────────────────────────────────────────
const generateStylesInEnglish = (text) => {
  const t = text.trim();
  const lower = t.toLowerCase();
  return {
    gen_z:        [`no cap, ${lower} fr fr`, `lowkey ${lower}`, `it's giving "${lower}" vibes`],
    casual:       [`so basically, ${lower}`, `just so you know, ${lower}`, `hey, ${lower}`],
    professional: [`I would like to convey that ${lower}.`, `Please be informed that ${lower}.`, `It is worth noting that ${lower}.`],
    confident:    [`${t}. Period.`, `Let me be clear — ${lower}.`, `Without a doubt, ${lower}.`],
  };
};

// ─── POST /api/vibe/rephrase ──────────────────────────────────────────────────
router.post('/rephrase', async (req, res, next) => {
  try {
    const { text, sourceLang, targetLang } = req.body;
    if (!text?.trim()) return res.status(400).json({ success: false, error: 'Text is required' });

    const lang = targetLang || 'en';
    console.log(`[Vibe] "${text.slice(0, 50)}" | sourceLang=${sourceLang} lang=${lang}`);

    // Step 1: Convert to English using sourceLang for accuracy
    const enText = await toEnglish(text.trim(), sourceLang || lang);
    console.log(`[Vibe] English: "${enText.slice(0, 50)}"`);

    // Step 2: Generate 12 variations using Gemma2 AI
    let parsed;
    try {
      const raw = await generateStylesWithAI(enText);
      parsed = parseOutput(raw);
      if (!parsed.gen_z.length && !parsed.casual.length) {
        parsed = generateStylesInEnglish(enText);
      }
    } catch (err) {
      console.log(`[Vibe] Gemma2 failed: ${err.message} — using fallback`);
      console.log(`[Vibe] Error details:`, err.response?.data);
      parsed = generateStylesInEnglish(enText);
    }
    console.log(`[Vibe] Parsed: gen_z=${parsed.gen_z.length} casual=${parsed.casual.length} professional=${parsed.professional.length} confident=${parsed.confident.length}`);

    // Step 3: Translate all back to target language
    const allEnglish = [...parsed.gen_z, ...parsed.casual, ...parsed.professional, ...parsed.confident];
    const allTranslated = await translateBatch(allEnglish, lang);

    const gen_zOpts        = allTranslated.slice(0, 3);
    const casualOpts       = allTranslated.slice(3, 6);
    const professionalOpts = allTranslated.slice(6, 9);
    const confidentOpts    = allTranslated.slice(9, 12);

    const styles = {
      gen_z:        { emoji: '😎', label: 'Gen-Z',        desc: 'Youthful & Energetic',  accent: '#7C3AED', options: gen_zOpts,        text: gen_zOpts[0]        || text },
      casual:       { emoji: '�', label: 'Casual',       desc: 'Relaxed & Friendly',    accent: '#DB2777', options: casualOpts,       text: casualOpts[0]       || text },
      professional: { emoji: '👔', label: 'Professional', desc: 'Polished & Formal',     accent: '#059669', options: professionalOpts, text: professionalOpts[0] || text },
      confident:    { emoji: '💪', label: 'Confident',    desc: 'Bold & Assertive',      accent: '#EA580C', options: confidentOpts,    text: confidentOpts[0]    || text },
    };

    return res.json({ success: true, originalText: text.trim(), styles });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
