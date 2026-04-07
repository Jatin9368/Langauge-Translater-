const express = require('express');
const axios = require('axios');
const router = express.Router();

const STYLE_PROMPTS = {
  gen_z: `Rewrite the given sentence in Gen-Z casual slang style. IMPORTANT: You MUST write in the EXACT SAME language as the input. If input is Hindi, write in Hindi. If input is English, write in English. Use casual slangy words. Keep the same meaning. Return ONLY the rewritten sentence.`,

  formal: `Rewrite the given sentence in a formal professional tone. IMPORTANT: You MUST write in the EXACT SAME language as the input. If input is Hindi, write in Hindi. If input is English, write in English. Keep the same meaning. Return ONLY the rewritten sentence.`,

  funny: `Rewrite the given sentence in a funny humorous way. IMPORTANT: You MUST write in the EXACT SAME language as the input. If input is Hindi, write in Hindi. If input is English, write in English. Keep the core meaning but add humor. Return ONLY the rewritten sentence.`,
};

const STYLE_META = {
  gen_z:  { emoji: '😎', label: 'Gen-Z' },
  formal: { emoji: '👔', label: 'Formal' },
  funny:  { emoji: '😂', label: 'Funny' },
};

const callGroq = async (text, styleKey) => {
  const res = await axios.post(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: STYLE_PROMPTS[styleKey] },
        { role: 'user', content: text },
      ],
      max_tokens: 200,
      temperature: 0.85,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    }
  );
  const result = res.data?.choices?.[0]?.message?.content?.trim();
  if (!result) throw new Error('Empty Groq response');
  return result;
};

// POST /api/style/rephrase
router.post('/rephrase', async (req, res, next) => {
  try {
    const { text } = req.body;

    if (!text?.trim()) {
      return res.status(400).json({ success: false, error: 'Text is required' });
    }

    const results = {};

    // Teeno styles parallel mein generate karo
    await Promise.all(
      Object.keys(STYLE_PROMPTS).map(async (key) => {
        try {
          const rewritten = await callGroq(text.trim(), key);
          results[key] = { text: rewritten, ...STYLE_META[key] };
          console.log(`[Groq Style] ${key} OK`);
        } catch (e) {
          console.log(`[Groq Style] ${key} failed: ${e.message}`);
          // Fallback — original text
          results[key] = { text: text.trim(), ...STYLE_META[key] };
        }
      })
    );

    return res.json({ success: true, styles: results });
  } catch (err) {
    console.error('Style error:', err.message);
    next(err);
  }
});

module.exports = router;
