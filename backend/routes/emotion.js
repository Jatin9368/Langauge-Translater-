const express = require('express');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const router = express.Router();

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const UNREAL_SPEECH_API_KEY = process.env.UNREAL_SPEECH_API_KEY;

const AUDIO_DIR = path.join(__dirname, '../audio_cache');
if (!fs.existsSync(AUDIO_DIR)) fs.mkdirSync(AUDIO_DIR, { recursive: true });

// ─── ElevenLabs Config (PRIMARY) ─────────────────────────────────────────────
// Love & Sad → Sarah (female) | Happy & Angry → Adam (male)
const EL_CONFIG = {
  love: {
    voice_id: 'EXAVITQu4vr4xnSDxMaL', // Sarah — soft, warm, caring
    voice_settings: { stability: 0.20, similarity_boost: 0.90, style: 0.80, use_speaker_boost: true },
    ttsRate: 0.44, ttsPitch: 1.15,
  },
  sad: {
    voice_id: 'EXAVITQu4vr4xnSDxMaL', // Sarah — slow, heavy, emotional
    voice_settings: { stability: 0.15, similarity_boost: 0.88, style: 0.85, use_speaker_boost: true },
    ttsRate: 0.38, ttsPitch: 0.88,
  },
  happy: {
    voice_id: 'pNInz6obpgDQGcFmaJgB', // Adam — energetic, cheerful
    voice_settings: { stability: 0.22, similarity_boost: 0.85, style: 0.82, use_speaker_boost: true },
    ttsRate: 0.52, ttsPitch: 1.18,
  },
  angry: {
    voice_id: 'pNInz6obpgDQGcFmaJgB', // Adam — strong, sharp, aggressive
    voice_settings: { stability: 0.10, similarity_boost: 0.92, style: 0.90, use_speaker_boost: true },
    ttsRate: 0.48, ttsPitch: 0.72,
  },
};

// ─── Unreal Speech Config (FALLBACK) ─────────────────────────────────────────
// Voice IDs: Scarlett (female) | Dan (male)
const US_CONFIG = {
  love:  { voiceId: 'Scarlett', speed: -0.3, pitch: 1.1 },
  sad:   { voiceId: 'Scarlett', speed: -0.5, pitch: 0.9 },
  happy: { voiceId: 'Dan',      speed:  0.3, pitch: 1.1 },
  angry: { voiceId: 'Dan',      speed:  0.1, pitch: 0.8 },
};

const generateWithUnrealSpeech = async (text, emotion) => {
  const cfg = US_CONFIG[emotion];
  if (!cfg || !UNREAL_SPEECH_API_KEY) throw new Error('UnrealSpeech not configured');

  console.log(`[UnrealSpeech] Generating ${emotion}...`);
  const res = await axios.post(
    'https://api.v7.unrealspeech.com/speech',
    {
      Text: text,
      VoiceId: cfg.voiceId,
      Bitrate: '192k',
      Speed: cfg.speed,
      Pitch: cfg.pitch,
      OutputFormat: 'mp3',
    },
    {
      headers: {
        Authorization: `Bearer ${UNREAL_SPEECH_API_KEY}`,
        'Content-Type': 'application/json',
      },
      responseType: 'arraybuffer',
      timeout: 30000,
    }
  );

  if (!res.data || res.data.byteLength < 100) throw new Error('UnrealSpeech: empty audio response');

  const filename = `us_${emotion}_${Date.now()}.mp3`;
  const filepath = path.join(AUDIO_DIR, filename);
  fs.writeFileSync(filepath, Buffer.from(res.data));
  console.log(`[UnrealSpeech] ${emotion} OK → ${filename} (${res.data.byteLength} bytes)`);
  return filename;
};

// ─── Groq Emotion Rewrite ─────────────────────────────────────────────────────
const GROQ_API_KEY = process.env.GROQ_API_KEY;

const EMOTION_STYLE_GUIDE = {
  love:  `Warm, tender, breathless, longing. Use soft pauses (...), gentle emphasis. Feel: whispering sweetly, heart full.`,
  sad:   `Broken, slow, heavy, grieving. Use long pauses, trailing sentences, low energy words. Feel: voice cracking, holding back tears.`,
  angry: `Sharp, explosive, intense, confrontational. Use short punchy sentences! Exclamations! Strong verbs! NO soft words. Feel: raised voice, jaw tight.`,
  happy: `Bright, energetic, fast-paced, celebratory. Use exclamations, enthusiasm, light bouncy rhythm. Feel: laughing while talking, jumping with joy.`,
};

const rewriteWithGroq = async (text, emotion) => {
  if (!GROQ_API_KEY) throw new Error('Groq not configured');

  const prompt = `Convert the given sentence into a highly emotional, human-like spoken script.

Rules:
- Add natural pauses using "..."
- Add expressive words (really, so much, etc.)
- Make it sound like a real person speaking
- Keep it short and natural
- Do NOT change meaning
- Rewrite ONLY the sentence. No explanations, no labels, no extra text.
- Use punctuation, repetition, ellipsis (...), emphasis to guide TTS rhythm

Emotion style: ${EMOTION_STYLE_GUIDE[emotion]}

Emotion: ${emotion}
Text: ${text}`;

  const res = await axios.post(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 200,
      temperature: 0.7,
    },
    {
      headers: { Authorization: `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      timeout: 15000,
    }
  );

  const rewritten = res.data?.choices?.[0]?.message?.content?.trim();
  if (!rewritten) throw new Error('Groq: empty response');
  console.log(`[Groq] Rewritten (${emotion}): "${rewritten.slice(0, 60)}..."`);
  return rewritten;
};

// ─── Generate with ElevenLabs ─────────────────────────────────────────────────
const generateWithElevenLabs = async (text, emotion) => {
  const cfg = EL_CONFIG[emotion];
  if (!cfg || !ELEVENLABS_API_KEY) throw new Error('ElevenLabs not configured');

  console.log(`[ElevenLabs] Generating ${emotion}...`);
  const res = await axios.post(
    `https://api.elevenlabs.io/v1/text-to-speech/${cfg.voice_id}`,
    { text, model_id: 'eleven_multilingual_v2', voice_settings: cfg.voice_settings },
    {
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      responseType: 'arraybuffer',
      timeout: 30000,
    }
  );

  if (!res.data || res.data.byteLength < 100) throw new Error('ElevenLabs: empty audio response');

  const filename = `el_${emotion}_${Date.now()}.mp3`;
  const filepath = path.join(AUDIO_DIR, filename);
  fs.writeFileSync(filepath, Buffer.from(res.data));
  console.log(`[ElevenLabs] ${emotion} OK → ${filename} (${res.data.byteLength} bytes)`);
  return filename;
};



// ─── Cleanup: keep last 10 files ─────────────────────────────────────────────
const cleanupCache = (excludeFilename = null) => {
  try {
    const files = fs.readdirSync(AUDIO_DIR)
      .filter(f => (f.endsWith('.mp3') || f.endsWith('.wav')) && f !== excludeFilename)
      .sort();
    if (files.length > 10) {
      files.slice(0, files.length - 10).forEach(f => {
        try { fs.unlinkSync(path.join(AUDIO_DIR, f)); } catch (_) {}
      });
    }
  } catch (_) {}
};

// ─── Serve audio ──────────────────────────────────────────────────────────────
router.get('/audio/:filename', (req, res) => {
  const filename = path.basename(req.params.filename);
  const filepath = path.join(AUDIO_DIR, filename);
  if (!fs.existsSync(filepath)) {
    console.warn(`[Audio] 404: ${filename}`);
    return res.status(404).json({ error: 'Not found' });
  }
  const mime = filename.endsWith('.wav') ? 'audio/wav' : 'audio/mpeg';
  res.setHeader('Content-Type', mime);
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Accept-Ranges', 'bytes');
  console.log(`[Audio] Serving: ${filename}`);
  res.sendFile(filepath);
});

// ─── POST /api/emotion/rephrase ───────────────────────────────────────────────
router.post('/rephrase', async (req, res, next) => {
  try {
    const { text, emotion, targetLang } = req.body;
    if (!text?.trim()) return res.status(400).json({ success: false, error: 'Text is required' });

    const emotionKey = emotion?.toLowerCase();
    if (!['love', 'sad', 'angry', 'happy'].includes(emotionKey)) {
      return res.status(400).json({ success: false, error: 'Invalid emotion' });
    }

    console.log(`\n[Emotion] Request: "${text.trim().slice(0, 40)}" | emotion=${emotionKey} | lang=${targetLang}`);

    const elCfg = EL_CONFIG[emotionKey];
    const emojis = { love: '❤️', sad: '😢', angry: '😡', happy: '😄' };

    // ── Step 1: Groq — emotionally rewrite text for TTS ──
    let voiceText = text.trim();
    try {
      voiceText = await rewriteWithGroq(text.trim(), emotionKey);
    } catch (groqErr) {
      console.log(`[Groq] Rewrite failed: ${groqErr.message} — using original text`);
    }

    let filename = null;
    let usedEngine = null;

    // ── Step 2: ElevenLabs (primary) ──
    try {
      filename = await generateWithElevenLabs(voiceText, emotionKey);
      usedEngine = 'elevenlabs';
    } catch (elErr) {
      console.log(`[ElevenLabs] Failed: ${elErr.message} — trying UnrealSpeech`);

      // ── Unreal Speech (fallback) ──
      try {
        filename = await generateWithUnrealSpeech(voiceText, emotionKey);
        usedEngine = 'unrealspeech';
      } catch (usErr) {
        console.log(`[UnrealSpeech] Failed: ${usErr.message}`);
      }
    }

    // Cleanup AFTER generating — never delete the new file
    cleanupCache(filename);

    const audioUrl = filename ? `/api/emotion/audio/${filename}` : null;
    console.log(`[Emotion] Done: engine=${usedEngine} url=${audioUrl}`);

    return res.json({
      success: true,
      voiceText,
      audioUrl,
      engine: usedEngine,
      ttsRate: elCfg.ttsRate,
      ttsPitch: elCfg.ttsPitch,
      emotion: emotionKey,
      emoji: emojis[emotionKey],
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
