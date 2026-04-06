const express = require('express');
const axios = require('axios');
const { translate } = require('@vitalets/google-translate-api');
const router = express.Router();

const PRAVAHAI_URL = 'https://pravahai.aicte-india.org/api/translatebulk';

const isValidText = (text) => {
  if (!text) return false;
  const badChars = (text.match(/[^\x09\x0A\x0D\x20-\uD7FF\uE000-\uFFFD]/g) || []).length;
  return badChars / text.length < 0.1;
};

const translateTo = async (text, targetLang) => {
  if (!targetLang || targetLang === 'en') return text;
  try {
    const res = await axios.post(
      PRAVAHAI_URL,
      [{ text, from: 'en', to: targetLang }],
      { headers: { 'Content-Type': 'application/json' }, timeout: 8000 }
    );
    const t = res.data?.value?.[0]?.translations?.[0]?.text;
    if (t && isValidText(t)) return t;
  } catch (e) {}
  try {
    const res = await translate(text, { to: targetLang });
    return res.text;
  } catch (e) {}
  return text;
};

// Language ke hisaab se style templates
const getStyleTemplates = (text, targetLang) => {
  const t = text.replace(/[.!?]+$/, '').trim();

  // Hindi templates
  if (targetLang === 'hi' || targetLang === 'ur') {
    return {
      genz: `Yo yaar! "${t}" 😎 No cap, yeh toh ekdum different level ka hai fr fr! Bestie, periodt! Slay kar diya!`,
      formal: `आदरणीय महोदय/महोदया, मैं आपको सूचित करना चाहता/चाहती हूँ कि "${t}"। आशा है यह संदेश आपको स्वस्थ पाए। कृपया शीघ्र उत्तर दें।`,
      funny: `Bhai sun, kisi ne nahi pucha tha lekin plot twist — "${t}"?! Aaj uthke chaos choose kiya maine! Tumhe aisa bolne ki permission kisne di?! 10/10, welcome hai yeh life update 😂`,
    };
  }

  // Tamil templates
  if (targetLang === 'ta') {
    return {
      genz: `Yo da! "${t}" - No cap fr fr, idu different level da! Bestie, periodt! Slay!`,
      formal: `மதிப்பிற்குரிய ஐயா/அம்மா, "${t}" என்பதை உங்களுக்கு தெரிவிக்க விரும்புகிறேன். நீங்கள் நலமாக இருப்பீர்கள் என நம்புகிறேன்.`,
      funny: `Yaaru kekala, plot twist — "${t}"?! Bro chaos choose panniten today! 10/10 welcome da 😂`,
    };
  }

  // Telugu templates
  if (targetLang === 'te') {
    return {
      genz: `Yo bro! "${t}" - No cap fr fr, idi different level! Bestie, periodt! Slay!`,
      formal: `గౌరవనీయులైన మహాశయా, "${t}" అని మీకు తెలియజేయాలనుకుంటున్నాను. మీరు ఆరోగ్యంగా ఉంటారని ఆశిస్తున్నాను.`,
      funny: `Emi adgaledu kani plot twist — "${t}"?! Bro chaos choose chesanu today! 10/10 welcome 😂`,
    };
  }

  // Bengali templates
  if (targetLang === 'bn') {
    return {
      genz: `Yo bhai! "${t}" - No cap fr fr, eta different level! Bestie, periodt! Slay!`,
      formal: `শ্রদ্ধেয় মহাশয়/মহাশয়া, "${t}" বিষয়টি আপনাকে জানাতে চাই। আশা করি আপনি সুস্থ আছেন।`,
      funny: `Keu jiggesh kore ni kintu plot twist — "${t}"?! Bro aaj chaos choose korlam! 10/10 welcome 😂`,
    };
  }

  // Gujarati
  if (targetLang === 'gu') {
    return {
      genz: `Yo yaar! "${t}" - No cap fr fr, aa toh different level chhe! Bestie, periodt! Slay!`,
      formal: `આદરણીય મહોદય/મહોદયા, "${t}" વિષે આપને જણાવવા ઇચ્છું છું. આશા છે આ સંદેશ આપને સ્વસ્થ પામે.`,
      funny: `Koi e puchyu nahi pan plot twist — "${t}"?! Bro aaj chaos choose karyo! 10/10 welcome 😂`,
    };
  }

  // English / default — translate karenge
  return {
    genz: `Yo bro! "${t}" - No cap fr fr, this hits different! Like bestie, periodt! Slay!`,
    formal: `Dear Sir/Ma'am, I would like to formally convey: "${t}". I hope this finds you well. Kindly acknowledge at your earliest convenience.`,
    funny: `Plot twist nobody asked for: "${t}"?! Bro who gave you permission to say this?! 10/10 chaos, you're welcome lol!`,
  };
};

const STYLE_META = {
  genz:   { emoji: '🔥', label: 'Gen-Z' },
  formal: { emoji: '👔', label: 'Formal' },
  funny:  { emoji: '😂', label: 'Funny' },
};

// POST /api/style/rephrase
router.post('/rephrase', async (req, res, next) => {
  try {
    const { text, targetLang } = req.body;

    if (!text?.trim()) {
      return res.status(400).json({ success: false, error: 'Text is required' });
    }

    const templates = getStyleTemplates(text.trim(), targetLang);
    const results = {};

    for (const key of Object.keys(templates)) {
      let finalText = templates[key];

      // Agar language ke liye direct template nahi hai toh translate karo
      const hasDirectTemplate = ['hi', 'ur', 'ta', 'te', 'bn', 'gu'].includes(targetLang);
      if (!hasDirectTemplate && targetLang && targetLang !== 'en') {
        try {
          await new Promise((r) => setTimeout(r, 350));
          const translated = await translateTo(templates[key], targetLang);
          if (translated) finalText = translated;
        } catch (e) {}
      }

      results[key] = { text: finalText, ...STYLE_META[key] };
    }

    return res.json({ success: true, styles: results });
  } catch (err) {
    console.error('Style error:', err.message);
    next(err);
  }
});

module.exports = router;
