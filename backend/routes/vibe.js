const express = require('express');
const axios = require('axios');
const router = express.Router();

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const LANGBLY_KEY = process.env.LANGBLY_API_KEY;

// ─── Step 1: Translate input to English for Groq ─────────────────────────────
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
  const results = [];
  for (const s of sentences) {
    try {
      const res = await axios.post(
        'https://api.langbly.com/language/translate/v2',
        null,
        { params: { q: s, target: targetLang, source: 'en', key: LANGBLY_KEY }, timeout: 8000 }
      );
      results.push(res.data?.data?.translations?.[0]?.translatedText || s);
    } catch (_) { results.push(s); }
  }
  return results;
};

// ─── Step 3: Groq generates 4 styles in English ──────────────────────────────
const generateStylesInEnglish = async (text) => {
  const prompt = `Rewrite the following sentence in 4 different styles. Give exactly 3 variations per style.

STRICT RULES:
- Output ONLY in the same language as the input sentence
- Do NOT add any English words if the input is in a non-English language
- Do NOT use English slang, filler phrases, or English words mixed in
- Only rephrase the core meaning — keep it natural in the input language
- Each variation must be a complete, clean sentence
- You may add a few extra words to make it sound more natural in that style

Output format (use exactly these labels):
GEN_Z_1: <sentence>
GEN_Z_2: <sentence>
GEN_Z_3: <sentence>
CASUAL_1: <sentence>
CASUAL_2: <sentence>
CASUAL_3: <sentence>
PROFESSIONAL_1: <sentence>
PROFESSIONAL_2: <sentence>
PROFESSIONAL_3: <sentence>
CONFIDENT_1: <sentence>
CONFIDENT_2: <sentence>
CONFIDENT_3: <sentence>

Style guides (apply in the input language, NOT in English):
- Gen-Z: Youthful, informal, energetic tone — like how young people talk today
- Casual: Relaxed, friendly, everyday conversational tone
- Professional: Polished, formal, respectful — suitable for work or official use
- Confident: Bold, assertive, with attitude — sounds self-assured and strong

Sentence: ${text}`;

  const res = await axios.post(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 800,
      temperature: 0.7,
    },
    { headers: { Authorization: `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' }, timeout: 25000 }
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
    gen_z:        extract('GEN_Z'),
    casual:       extract('CASUAL'),
    professional: extract('PROFESSIONAL'),
    confident:    extract('CONFIDENT'),
  };
};

// ─── POST /api/vibe/rephrase ──────────────────────────────────────────────────
router.post('/rephrase', async (req, res, next) => {
  try {
    const { text, targetLang } = req.body;
    if (!text?.trim()) return res.status(400).json({ success: false, error: 'Text is required' });

    const lang = targetLang || 'en';
    console.log(`[Vibe] "${text.slice(0, 50)}" | lang=${lang}`);

    // Step 1: Convert to English for Groq context
    const enText = await toEnglish(text.trim(), lang);
    console.log(`[Vibe] English: "${enText.slice(0, 50)}"`);

    // Step 2: Generate 12 variations (3 per style × 4 styles)
    const raw = await generateStylesInEnglish(enText);
    const parsed = parseOutput(raw);
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
