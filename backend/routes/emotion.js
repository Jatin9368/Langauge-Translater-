const express = require('express');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const router = express.Router();

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const CARTESIA_API_KEY = process.env.CARTESIA_API_KEY;

const AUDIO_DIR = path.join(__dirname, '../audio_cache');
if (!fs.existsSync(AUDIO_DIR)) fs.mkdirSync(AUDIO_DIR, { recursive: true });

// ─── TTS fallback defaults ────────────────────────────────────────────────────
const TTS_DEFAULTS = {
  love:  { ttsRate: 0.42, ttsPitch: 1.18 },
  sad:   { ttsRate: 0.46, ttsPitch: 0.90 },
  happy: { ttsRate: 0.56, ttsPitch: 1.20 },
  angry: { ttsRate: 0.48, ttsPitch: 0.72 },
};

// ─── Cartesia speed per emotion ───────────────────────────────────────────────
const CARTESIA_SPEED = {
  love:  'slow',
  sad:   'normal',   // balanced — na zyada slow na fast
  happy: 'fast',
  angry: 'normal',   // sharp aur clear, not rushed
};

// ─── Indian language codes ────────────────────────────────────────────────────
const INDIAN_LANGS = new Set([
  'hi','bn','ta','te','mr','gu','kn','ml','pa','or',
  'as','ur','ne','sa','mai','sat','ks','kok','sd','doi','mni','brx',
]);

// ─── Cartesia voice IDs ───────────────────────────────────────────────────────
// Indian voices
const VOICE_INDIAN = {
  love:  'faf0731e-dfb9-4cfc-8119-259a79b27e12', // Riya — warm Hindi female
  sad:   '9626c31c-bec5-4cca-baa8-f8ba9e84c8bc', // Jacqueline — empathic female
  happy: 'faf0731e-dfb9-4cfc-8119-259a79b27e12', // Riya — friendly, playful
  angry: '5ee9feff-1265-424a-9d7f-8e4d431a12c7', // Ronald — intense, deep male
};
// English / Foreign voices
const VOICE_INTL = {
  love:  'e07c00bc-4134-4eae-9ea4-1a55fb45746b', // Brooke — warm female
  sad:   '9626c31c-bec5-4cca-baa8-f8ba9e84c8bc', // Jacqueline — empathic
  happy: 'a167e0f3-df7e-4d52-a9c3-f949145efdab', // Blake — energetic male
  angry: '5ee9feff-1265-424a-9d7f-8e4d431a12c7', // Ronald — intense male
};

const getVoiceId = (lang, emotion) =>
  INDIAN_LANGS.has(lang) ? VOICE_INDIAN[emotion] : VOICE_INTL[emotion];

// ─── Full language name map ───────────────────────────────────────────────────
const LANG_NAMES = {
  hi: 'Hindi', bn: 'Bengali', ta: 'Tamil', te: 'Telugu', mr: 'Marathi',
  gu: 'Gujarati', kn: 'Kannada', ml: 'Malayalam', pa: 'Punjabi', ur: 'Urdu',
  or: 'Odia', as: 'Assamese', ne: 'Nepali', sa: 'Sanskrit',
  en: 'English', fr: 'French', de: 'German', es: 'Spanish', ja: 'Japanese',
  ko: 'Korean', ar: 'Arabic', ru: 'Russian', 'zh-CN': 'Chinese',
  pt: 'Portuguese', it: 'Italian', tr: 'Turkish', nl: 'Dutch',
  th: 'Thai', vi: 'Vietnamese', id: 'Indonesian', ms: 'Malay',
};

// ─── Emotion style instructions ───────────────────────────────────────────────
const EMOTION_STYLES = {
  love: {
    tone: 'soft, warm, affectionate, smooth',
    instruction: 'Add gentle affectionate fillers and soft pauses (...) before and after. Voice should feel like a warm whisper — tender and heartfelt.',
    example_hi: 'Input: "tum mere liye bahut khaas ho" → Output: "Sach mein... tum mere liye bahut khaas ho... yeh dil se keh raha hoon."',
  },
  happy: {
    tone: 'energetic, bright, expressive, celebratory',
    instruction: 'Add excited exclamations and joyful phrases before and after. Voice should feel like someone jumping with happiness.',
    example_hi: 'Input: "hum jeet gaye" → Output: "Arre waah! Sach mein?! hum jeet gaye! Yeh toh kamaal ho gaya!"',
  },
  angry: {
    tone: 'strong, sharp, impactful — clearly furious but controlled',
    instruction: 'Add intense, forceful phrases before and after. Use deliberate pauses (...) to show controlled rage — like gritting teeth. NOT rushed or shouting randomly.',
    example_hi: 'Input: "yeh bilkul galat hai" → Output: "Suno... dhyan se suno... yeh bilkul galat hai... aur main yeh KABHI nahi maanunga."',
  },
  sad: {
    tone: 'slightly low, natural sadness — balanced speed, not too slow',
    instruction: 'Add sorrowful but natural phrases before and after. Use gentle pauses. Voice should feel heavy but not dragging — like someone quietly grieving.',
    example_hi: 'Input: "tum chale gaye" → Output: "Kash aisa na hota... tum chale gaye... ab sab kuch alag sa lagta hai."',
  },
};

// ─── Groq Rewrite ─────────────────────────────────────────────────────────────
const rewriteWithGroq = async (text, emotion, lang) => {
  if (!GROQ_API_KEY) return text;

  const langName = LANG_NAMES[lang] || lang;
  const style = EMOTION_STYLES[emotion];

  const prompt = `You are an expert voice script writer for text-to-speech systems.

Task: Wrap the given sentence with emotional expressions to make it sound human and natural when spoken aloud.

Emotion: ${emotion.toUpperCase()}
Tone: ${style.tone}
Instruction: ${style.instruction}
Example (Hindi): ${style.example_hi}

ABSOLUTE RULES — follow strictly:
1. Output language must be 100% ${langName} — every single word including fillers, sighs, exclamations
2. Do NOT mix any other language whatsoever
3. The original sentence must appear WORD FOR WORD unchanged in the output
4. Only add words/phrases before and/or after the original sentence
5. No repetition of words or sentences
6. Output ONLY the final spoken text — no labels, no explanations, no quotes
7. Maximum 2-3 sentences total
8. Sound completely human — no robotic or awkward phrasing

Input sentence (in ${langName}): ${text}`;

  try {
    const res = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200,
        temperature: 0.82,
      },
      { headers: { Authorization: `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' }, timeout: 15000 }
    );
    const rewritten = res.data?.choices?.[0]?.message?.content?.trim();
    if (rewritten) {
      console.log(`[Groq] ${emotion}(${lang}): "${rewritten.slice(0, 80)}"`);
      return rewritten;
    }
  } catch (err) {
    console.log(`[Groq] Failed: ${err.message}`);
  }
  return text;
};

// ─── Cartesia TTS ─────────────────────────────────────────────────────────────
const generateWithCartesia = async (text, emotion, lang) => {
  const voiceId = getVoiceId(lang, emotion);
  if (!voiceId || !CARTESIA_API_KEY) throw new Error('Cartesia not configured');

  console.log(`[Cartesia] ${emotion} | ${lang} | voice=${voiceId}`);
  const res = await axios.post(
    'https://api.cartesia.ai/tts/bytes',
    {
      model_id: 'sonic-3',
      transcript: text,
      voice: {
        mode: 'id',
        id: voiceId,
        __experimental_controls: { speed: CARTESIA_SPEED[emotion] },
      },
      output_format: { container: 'mp3', encoding: 'mp3', sample_rate: 44100 },
    },
    {
      headers: {
        'x-api-key': CARTESIA_API_KEY,
        'Cartesia-Version': '2026-03-01',
        'Content-Type': 'application/json',
      },
      responseType: 'arraybuffer',
      timeout: 30000,
    }
  );

  if (!res.data || res.data.byteLength < 100) throw new Error('Cartesia: empty response');

  const filename = `cartesia_${emotion}_${Date.now()}.mp3`;
  fs.writeFileSync(path.join(AUDIO_DIR, filename), Buffer.from(res.data));
  console.log(`[Cartesia] OK → ${filename} (${res.data.byteLength} bytes)`);
  return filename;
};

// ─── Cleanup ──────────────────────────────────────────────────────────────────
const cleanupCache = (exclude = null) => {
  try {
    const files = fs.readdirSync(AUDIO_DIR)
      .filter(f => (f.endsWith('.mp3') || f.endsWith('.wav')) && f !== exclude)
      .sort();
    if (files.length > 10)
      files.slice(0, files.length - 10).forEach(f => {
        try { fs.unlinkSync(path.join(AUDIO_DIR, f)); } catch (_) {}
      });
  } catch (_) {}
};

// ─── Serve audio ──────────────────────────────────────────────────────────────
router.get('/audio/:filename', (req, res) => {
  const filename = path.basename(req.params.filename);
  const filepath = path.join(AUDIO_DIR, filename);
  if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'Not found' });
  res.setHeader('Content-Type', 'audio/mpeg');
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(filepath);
});

// ─── POST /api/emotion/rephrase ───────────────────────────────────────────────
router.post('/rephrase', async (req, res, next) => {
  try {
    const { text, emotion, targetLang } = req.body;
    if (!text?.trim()) return res.status(400).json({ success: false, error: 'Text is required' });

    const emotionKey = emotion?.toLowerCase();
    if (!['love', 'sad', 'angry', 'happy'].includes(emotionKey))
      return res.status(400).json({ success: false, error: 'Invalid emotion' });

    const lang = targetLang || 'hi';
    console.log(`\n[Emotion] "${text.trim().slice(0, 40)}" | ${emotionKey} | ${lang}`);

    const emojis = { love: '❤️', sad: '😢', angry: '😡', happy: '😄' };
    const { ttsRate, ttsPitch } = TTS_DEFAULTS[emotionKey];

    // Step 1: Groq — language-strict emotional rewrite
    const voiceText = await rewriteWithGroq(text.trim(), emotionKey, lang);

    // Step 2: Cartesia — region-aware voice
    let filename = null;
    let usedEngine = 'device-tts';
    try {
      filename = await generateWithCartesia(voiceText, emotionKey, lang);
      usedEngine = 'cartesia';
    } catch (err) {
      console.log(`[Cartesia] Failed: ${err.message} — device TTS fallback`);
    }

    cleanupCache(filename);

    return res.json({
      success: true,
      voiceText,
      audioUrl: filename ? `/api/emotion/audio/${filename}` : null,
      engine: usedEngine,
      ttsRate,
      ttsPitch,
      emotion: emotionKey,
      emoji: emojis[emotionKey],
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
