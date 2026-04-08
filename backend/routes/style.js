const express = require('express');
const axios = require('axios');
const router = express.Router();

const GROQ_API_KEY = process.env.GROQ_API_KEY;

const SYSTEM_PROMPT = `You are a native multilingual communication style expert. Convert the given sentence into 3 styles with exactly 2 variations each.

ABSOLUTE RULES:
1. Convert ONLY the given sentence — do not add new topics or answer it
2. Keep the EXACT same meaning in all variations
3. ALL 6 outputs must be written ONLY in the target language specified — zero mixing
4. Sound like a native speaker of that language, not a translation
5. Exactly 2 variations per style — no more, no less

STYLE GUIDELINES (adapt to the target language's culture):

[Gen-Z Style]
- Use that language's actual youth slang and casual expressions
- Hindi: yaar, bhai, vibe, scene, no cap, fr fr, lowkey, slay
- Tamil: da, di, machan, scene, vibe
- Telugu: bro, yaar, scene, vibe
- Bengali: bhai, yaar, vibe
- English: bestie, no cap, fr fr, lowkey, slay, it's giving
- Arabic/Urdu/Persian: use local youth expressions
- Sound like a real 18-year-old texting in that language

[Funny Style]
- Use that language's humor style and cultural references
- Hindi: chai, mummy, sasural, WiFi references, dramatic exaggeration 😂🤣
- Other languages: use their own cultural humor references
- Genuinely funny, not forced

[Formal Style]
- Polite, professional tone natural to that language
- Use appropriate honorifics for that language

Output format EXACTLY (no extra text before or after):
[Gen-Z Style]
👉 Variation 1
👉 Variation 2
[Funny Style]
👉 Variation 1
👉 Variation 2
[Formal Style]
👉 Variation 1
👉 Variation 2`;

const callGroq = async (text) => {
  const res = await axios.post(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: text },
      ],
      max_tokens: 600,
      temperature: 0.85,
    },
    {
      headers: { Authorization: `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      timeout: 20000,
    }
  );
  return res.data?.choices?.[0]?.message?.content?.trim() || '';
};

const parseStyles = (raw) => {
  const result = { gen_z: [], formal: [], funny: [] };

  // Split by style headers
  const sections = raw.split(/\[(?:Gen-Z|Funny|Formal)[^\]]*\]/i);
  const headers = raw.match(/\[(?:Gen-Z|Funny|Formal)[^\]]*\]/gi) || [];

  headers.forEach((header, idx) => {
    const content = sections[idx + 1] || '';
    const options = content.match(/👉\s*(.+)/g)?.map(o => o.replace(/^👉\s*/, '').trim()) || [];
    const h = header.toLowerCase();
    if (h.includes('gen-z') || h.includes('genz')) result.gen_z = options;
    else if (h.includes('funny')) result.funny = options;
    else if (h.includes('formal')) result.formal = options;
  });

  return result;
};

// POST /api/style/rephrase
router.post('/rephrase', async (req, res, next) => {
  try {
    const { text, targetLang } = req.body;
    if (!text?.trim()) return res.status(400).json({ success: false, error: 'Text is required' });

    // Language name for explicit instruction
    const langNames = {
      hi: 'Hindi (Devanagari script)', en: 'English', bn: 'Bengali (Bengali script)',
      ta: 'Tamil (Tamil script)', te: 'Telugu (Telugu script)', mr: 'Marathi (Devanagari script)',
      gu: 'Gujarati (Gujarati script)', kn: 'Kannada (Kannada script)', ml: 'Malayalam (Malayalam script)',
      pa: 'Punjabi (Gurmukhi script)', ur: 'Urdu (Nastaliq script)', fr: 'French', de: 'German',
      es: 'Spanish', ja: 'Japanese', 'zh-CN': 'Chinese (Simplified)', ar: 'Arabic', ru: 'Russian',
      ko: 'Korean', pt: 'Portuguese', it: 'Italian', tr: 'Turkish', nl: 'Dutch',
      pl: 'Polish', th: 'Thai', vi: 'Vietnamese', id: 'Indonesian', ms: 'Malay',
      fa: 'Persian (Farsi)', sw: 'Swahili', ne: 'Nepali', si: 'Sinhala',
    };
    const langName = langNames[targetLang] || 'the same language as the input';

    const userPrompt = `Target Language: ${langName}
Sentence to convert: "${text.trim()}"

Write ALL 6 outputs ONLY in ${langName}. Use native expressions, slang and cultural references of ${langName} speakers. Do NOT translate to any other language.`;

    let rawOutput = '';
    try {
      const res2 = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          model: 'llama-3.1-8b-instant',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: 600,
          temperature: 0.85,
        },
        {
          headers: { Authorization: `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
          timeout: 20000,
        }
      );
      rawOutput = res2.data?.choices?.[0]?.message?.content?.trim() || '';
    } catch (e) {
      console.log('Groq style failed:', e.message);
      return res.status(503).json({ success: false, error: 'Style generation failed.' });
    }

    const parsed = parseStyles(rawOutput);

    // Build styles object for frontend
    const styles = {
      gen_z: {
        emoji: '\uD83D\uDE0E',
        label: 'Gen-Z',
        options: parsed.gen_z.slice(0, 2),
        text: parsed.gen_z[0] || text,
      },
      funny: {
        emoji: '\uD83D\uDE02',
        label: 'Funny',
        options: parsed.funny.slice(0, 2),
        text: parsed.funny[0] || text,
      },
      formal: {
        emoji: '\uD83D\uDC54',
        label: 'Formal',
        options: parsed.formal.slice(0, 2),
        text: parsed.formal[0] || text,
      },
    };

    return res.json({ success: true, styles, rawOutput });
  } catch (err) {
    console.error('Style error:', err.message);
    next(err);
  }
});

module.exports = router;
