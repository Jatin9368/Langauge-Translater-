const express = require('express');
const axios = require('axios');
const router = express.Router();

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const PRAVAHAI_URL = process.env.PRAVAHAI_URL || 'https://pravahai.aicte-india.org/api/translatebulk';

const PRAVAHAI_CODE_MAP = {
  hi:'hi-IN',bn:'bn-IN',ta:'ta-IN',te:'te-IN',mr:'mr-IN',gu:'gu-IN',
  kn:'kn-IN',ml:'ml-IN',pa:'pa-IN',or:'or-IN',as:'as-IN',ur:'ur-IN',
  ne:'ne-IN',sa:'sa-IN',en:'en-IN',
  es:'es-FO',fr:'fr-FO',de:'de-FO',ja:'ja-FO',ko:'ko-FO',ar:'ar-FO',
  ru:'ru-FO',pt:'pt-FO',it:'it-FO',tr:'tr-FO',nl:'nl-FO',zh:'zh-FO',
  'zh-CN':'zh-FO',
};
const PRAVAHAI_SUPPORTED = new Set(['hi','bn','ta','te','mr','gu','kn','ml','pa','or','as','ur','ne','sa']);

// ─── Translate using Pravahai or MyMemory ─────────────────────────────────────
const translateText = async (text, sourceLang, targetLang) => {
  if (!targetLang || targetLang === 'en') return text;
  // Pravahai for Indian languages
  if (PRAVAHAI_SUPPORTED.has(targetLang)) {
    try {
      const srcCode = PRAVAHAI_CODE_MAP[sourceLang] || 'en-IN';
      const tgtCode = PRAVAHAI_CODE_MAP[targetLang];
      const res = await axios.post(PRAVAHAI_URL,
        { input: [{ source: text }], config: { language: { sourceLanguage: srcCode, targetLanguage: tgtCode } } },
        { headers: { 'Content-Type': 'application/json' }, timeout: 10000 }
      );
      return res.data?.output?.[0]?.target || text;
    } catch (_) {}
  }
  // MyMemory for others
  try {
    const langPair = `${sourceLang || 'en'}|${targetLang}`;
    const res = await axios.get('https://api.mymemory.translated.net/get',
      { params: { q: text, langpair: langPair }, timeout: 10000 }
    );
    return res.data?.responseData?.translatedText || text;
  } catch (_) { return text; }
};

// ─── Step 1: Translate input to English ──────────────────────────────────────
const toEnglish = async (text, sourceLang) => {
  if (!sourceLang || sourceLang === 'en') return text;
  return translateText(text, sourceLang, 'en');
};

// ─── Step 2: Translate batch back to target language ─────────────────────────
const translateBatch = async (sentences, targetLang) => {
  if (!targetLang || targetLang === 'en') return sentences;
  return Promise.all(sentences.map(s => translateText(s, 'en', targetLang)));
};

// ─── Groq AI generates 4 styles ──────────────────────────────────────────────
const generateStylesWithAI = async (text) => {
  const prompt = `Rewrite this sentence in 4 styles. ENGLISH ONLY. Strict rules:
1. Keep EXACT same meaning - do NOT change subject, gender, or topic
2. Do NOT change male to female or female to male
3. Only change the tone/style, nothing else

Exact format:
GEN_Z_1: ...
GEN_Z_2: ...
GEN_Z_3: ...
CASUAL_1: ...
CASUAL_2: ...
CASUAL_3: ...
PROFESSIONAL_1: ...
PROFESSIONAL_2: ...
PROFESSIONAL_3: ...
CONFIDENT_1: ...
CONFIDENT_2: ...
CONFIDENT_3: ...

GEN_Z=Gen-Z slang (no cap, lowkey, fr fr, bussin), CASUAL=friendly everyday, PROFESSIONAL=formal polished, CONFIDENT=bold direct.
Sentence: ${text}`;

  const res = await axios.post(
    'https://api.groq.com/openai/v1/chat/completions',
    { model: 'llama-3.1-8b-instant', messages: [{ role: 'user', content: prompt }], max_tokens: 400, temperature: 0.5 },
    { headers: { Authorization: `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' }, timeout: 35000 }
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
  return { gen_z: extract('GEN_Z'), casual: extract('CASUAL'), professional: extract('PROFESSIONAL'), confident: extract('CONFIDENT') };
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

    // Step 2: Generate 12 variations using Groq AI, fallback to rule-based
    let parsed;
    try {
      const raw = await generateStylesWithAI(enText);
      parsed = parseOutput(raw);
      if (!parsed.gen_z.length && !parsed.casual.length) {
        parsed = generateStylesInEnglish(enText);
      }
    } catch (err) {
      console.log(`[Vibe] Groq failed: ${err.message} — using fallback`);
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
