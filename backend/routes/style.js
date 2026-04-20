const express = require('express');
const router = express.Router();

// ─── Simple Pattern-based Rephrasing (No API needed) ─────────────────────────
const rephraseToStyle = (text, style) => {
  const t = text.trim();
  
  if (style === 'gen_z') {
    // Gen-Z slang aur casual tone
    const prefixes = ['Yo,', 'Yo fr,', 'Ngl,', 'Lowkey,', 'Deadass,', 'No cap,'];
    const suffixes = ['fr fr', 'no cap', 'fr', 'tho', 'deadass', '💀'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
    return `${prefix} ${t} ${suffix}`;
  }
  
  if (style === 'formal') {
    // Formal aur professional tone
    const prefixes = ['I would like to state that', 'It is important to note that', 'Consequently,', 'In a formal manner,', 'To elaborate,'];
    const suffixes = ['as per the statement above.', 'in the aforementioned context.', 'as previously mentioned.', 'accordingly.', 'in conclusion.'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
    return `${prefix} ${t} ${suffix}`;
  }
  
  if (style === 'funny') {
    const prefixes = ['LMAO,', 'Bruh,', 'Yo,', 'OMG,', 'Hold up—'];
    const jokes = [
      ` (and I oop-)`,
      ` (periodt)`,
      ` (as one does)`,
      ` (no questions asked)`,
      ` (and that's on that)`,
    ];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const joke = jokes[Math.floor(Math.random() * jokes.length)];
    return `${prefix} ${t}${joke}`;
  }
  
  return t;
};

// ─── POST /api/style/rephrase ───────────────────────────────────────────────────
router.post('/rephrase', async (req, res, next) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) {
      return res.status(400).json({ success: false, error: 'Text is required' });
    }

    const styles = {
      gen_z: {
        emoji: '🎓',
        label: 'Gen-Z',
        text: rephraseToStyle(text.trim(), 'gen_z'),
      },
      formal: {
        emoji: '🎩',
        label: 'Formal',
        text: rephraseToStyle(text.trim(), 'formal'),
      },
      funny: {
        emoji: '😂',
        label: 'Funny',
        text: rephraseToStyle(text.trim(), 'funny'),
      },
    };

    console.log(`[Style] Rephrase request: "${text.slice(0, 50)}..."`);

    return res.json({
      success: true,
      originalText: text.trim(),
      styles,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
