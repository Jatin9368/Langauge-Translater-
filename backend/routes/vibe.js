const express = require('express');
const axios = require('axios');
const router = express.Router();

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const LANGBLY_KEY = process.env.LANGBLY_API_KEY;

// ─── Ollama (Local) — uncomment to use instead of Groq ───────────────────────
// const OLLAMA_URL = 'http://localhost:11434/api/generate';
// const OLLAMA_MODEL = 'llama3.2:3b';

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

// ─── Fallback: Simple style variations when Groq fails ───────────────────────
const generateStylesFallback = (text) => {
  // Simple rule-based style variations — no AI needed
  const t = text.trim();
  return {
    gen_z:        [t, t, t],
    casual:       [t, t, t],
    professional: [t, t, t],
    confident:    [t, t, t],
  };
};

// ─── Step 3: Groq generates 4 styles ─────────────────────────────────────────
const generateStylesInEnglish = async (text) => {
  const prompt = `You are a text style rewriter. Rewrite the sentence below in 4 communication styles.

CRITICAL RULES:
1. Keep the EXACT SAME meaning and topic — do NOT change what the sentence is about
2. Do NOT add emotions, feelings, or sentiment that are not in the original
3. ALWAYS write in ENGLISH ONLY — never use any other language
4. Output ONLY in English
5. Each line must start with the exact label shown below
6. No extra text, no explanations, no numbering

OUTPUT FORMAT (use exactly):
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

STYLE DEFINITIONS:
- GEN_Z: Use Gen-Z slang and internet culture. Examples: "no cap", "lowkey", "it's giving", "slay", "bussin", "fr fr", "hits different", "vibe check", "understood the assignment", "main character energy". Make it sound like a Gen-Z person texting their friends. Keep the core meaning but make it sound very casual and trendy.
- CASUAL: Friendly, relaxed, conversational — same meaning, everyday tone
- PROFESSIONAL: Formal, polished, respectful — same meaning, work/official tone
- CONFIDENT: Direct, assertive, strong — same meaning, bold tone

Sentence (in English): ${text}`;

  // ── Groq (Active) ──────────────────────────────────────────────────────────
  const res = await axios.post(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 800,
      temperature: 0.4,
    },
    { headers: { Authorization: `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' }, timeout: 25000 }
  );
  return res.data?.choices?.[0]?.message?.content?.trim() || '';

  // ── Ollama/llama3.2:3b (commented — uncomment to use locally) ──────────────
  // const res = await axios.post(
  //   OLLAMA_URL,
  //   { model: OLLAMA_MODEL, prompt, stream: false, options: { temperature: 0.4 } },
  //   { headers: { 'Content-Type': 'application/json' }, timeout: 60000 }
  // );
  // return res.data?.response?.trim() || '';
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
    let parsed;
    try {
      const raw = await generateStylesInEnglish(enText);
      parsed = parseOutput(raw);
      // If Groq returned empty results, use fallback
      if (!parsed.gen_z.length && !parsed.casual.length) {
        console.log('[Vibe] Groq returned empty — using fallback');
        parsed = generateStylesFallback(enText);
      }
    } catch (groqErr) {
      console.log(`[Vibe] Groq failed: ${groqErr.message} — using fallback`);
      parsed = generateStylesFallback(enText);
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
