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
    const res = await axios.post(PRAVAHAI_URL,
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

const toEnglish = async (text) => {
  try {
    const res = await translate(text, { to: 'en' });
    return res.text;
  } catch (e) { return text; }
};

// 6 styles — Hindi direct templates
const buildHindi = (t) => ({
  gen_z:      `Bhai chal, ${t}! Ekdum lit hai yaar, no cap! 🔥`,
  formal:     `Aapko vinamrata se suchit kiya jaata hai ki ${t}. Kripya uchit dhyan dein.`,
  funny:      `Arre bhai, ${t}?! Matlab seriously?! Kya scene hai yaar, hasi aa gayi! 😂`,
  emotional:  `Yaar... ${t}... dil bhar aaya, sach mein bahut kuch feel ho raha hai abhi... 🥺`,
  robot:      `STATEMENT: ${t}. YEH INFORMATION PROCESS HO GAYI HAI. AAGE BADHEIN.`,
  dadi:       `Arrey beta, ${t}! Hamare zamane mein aisa nahi hota tha, par theek hai, bhagwan bhala kare! 🙏`,
});

const buildTamil = (t) => ({
  gen_z:      `Da, ${t}! Romba lit da, no cap! 🔥`,
  formal:     `Ungalukku vinamragaa theriyapaduthuven — ${t}. Kavanam seluththavum.`,
  funny:      `Aiyo, ${t}?! Seriously solra? Enna scene da idhu! 😂`,
  emotional:  `Yaar... ${t}... manasu niraindhudhu, romba feel aagudhu... 🥺`,
  robot:      `STATEMENT: ${t}. THAKAVAL PROCESS AAGIVIDHU. THODARVUM.`,
  dadi:       `Amma, ${t}! Namma kaalaththil ipdi illai, sari, kadavul arul puriyattum! 🙏`,
});

const buildEnglish = (t) => ({
  gen_z:      `Bro, ${t}! That's literally so lit, no cap fr fr! 🔥`,
  formal:     `I would like to formally bring to your attention that ${t}. Kindly take note.`,
  funny:      `Wait wait wait — ${t}?! Seriously though?! What a scene, I can't even! 😂`,
  emotional:  `Oh my heart... ${t}... I'm genuinely feeling so much right now... 🥺`,
  robot:      `STATEMENT: ${t}. THIS INFORMATION HAS BEEN PROCESSED. PROCEED.`,
  dadi:       `Beta, ${t}! In our days this never happened, but okay, God bless you! 🙏`,
});

const buildTelugu = (t) => ({
  gen_z:      `Bro, ${t}! Chala lit undi, no cap! 🔥`,
  formal:     `Meeru gamaninchavalani vinaypoorvakamga teliyajestunna — ${t}.`,
  funny:      `Arre, ${t}?! Seriously aa? Enti scene idi, navvostundi! 😂`,
  emotional:  `Yaar... ${t}... manasu nindipoyindi, chala feel avutundi... 🥺`,
  robot:      `STATEMENT: ${t}. EE SAMACHARAM PROCESS AYYINDI. MUNDUKU VELLU.`,
  dadi:       `Amma, ${t}! Mana kaalam lo ila undedi kaadu, sare, devudu dayacheyali! 🙏`,
});

const buildBengali = (t) => ({
  gen_z:      `Bhai, ${t}! Ekdom lit re, no cap! 🔥`,
  formal:     `Apnaake binamra bhaabe janano hochhe — ${t}. Onugroho kore dhyan deben.`,
  funny:      `Arre bhai, ${t}?! Seriously bolcho? Ki scene re, hashte hashte pore gelam! 😂`,
  emotional:  `Yaar... ${t}... mon bhorhe gelo, sত্যিই onek kichu feel hochhe... 🥺`,
  robot:      `STATEMENT: ${t}. EI TATHYA PROCESS HOYECHE. EGIYE JAAN.`,
  dadi:       `Beta, ${t}! Amader samaye ei rokom hoto na, thik ache, bhagwan bhalo koruk! 🙏`,
});

const LANG_BUILDERS = {
  hi: buildHindi, ur: buildHindi,
  ta: buildTamil,
  te: buildTelugu,
  bn: buildBengali,
};

const STYLE_META = {
  gen_z:     { emoji: '😎', label: 'Gen-Z' },
  formal:    { emoji: '👔', label: 'Formal' },
  funny:     { emoji: '😂', label: 'Funny' },
  emotional: { emoji: '🥺', label: 'Emotional' },
  robot:     { emoji: '🤖', label: 'Robot' },
  dadi:      { emoji: '🧓', label: 'Dadi Style' },
};

// POST /api/style/rephrase
router.post('/rephrase', async (req, res, next) => {
  try {
    const { text, targetLang } = req.body;
    if (!text?.trim()) {
      return res.status(400).json({ success: false, error: 'Text is required' });
    }

    const t = text.trim().replace(/[.!?]+$/, '').trim();
    const results = {};
    const builder = LANG_BUILDERS[targetLang];

    if (builder) {
      // Direct template — instant, no API call
      const styles = builder(t);
      for (const key of Object.keys(styles)) {
        results[key] = { text: styles[key], ...STYLE_META[key] };
      }
    } else {
      // Other languages — English template phir translate
      const englishText = await toEnglish(text.trim());
      const et = englishText.replace(/[.!?]+$/, '').trim();
      const englishStyles = buildEnglish(et);
      for (const key of Object.keys(englishStyles)) {
        try {
          await new Promise((r) => setTimeout(r, 300));
          const translated = await translateTo(englishStyles[key], targetLang);
          results[key] = { text: translated, ...STYLE_META[key] };
        } catch (e) {
          results[key] = { text: englishStyles[key], ...STYLE_META[key] };
        }
      }
    }

    return res.json({ success: true, styles: results });
  } catch (err) {
    console.error('Style error:', err.message);
    next(err);
  }
});

module.exports = router;
