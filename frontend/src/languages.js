// All supported languages with LibreTranslate codes and BCP-47 TTS locales

export const LANGUAGES = [
  // Auto-detect (source only)
  { code: 'auto', name: 'Auto Detect', flag: '🌐', ttsLocale: null, region: 'auto' },

  // Indian Languages
  { code: 'hi', name: 'Hindi', flag: '🇮🇳', ttsLocale: 'hi-IN', region: 'indian' },
  { code: 'bn', name: 'Bengali', flag: '🇮🇳', ttsLocale: 'bn-IN', region: 'indian' },
  { code: 'ta', name: 'Tamil', flag: '🇮🇳', ttsLocale: 'ta-IN', region: 'indian' },
  { code: 'te', name: 'Telugu', flag: '🇮🇳', ttsLocale: 'te-IN', region: 'indian' },
  { code: 'mr', name: 'Marathi', flag: '🇮🇳', ttsLocale: 'mr-IN', region: 'indian' },
  { code: 'gu', name: 'Gujarati', flag: '🇮🇳', ttsLocale: 'gu-IN', region: 'indian' },
  { code: 'kn', name: 'Kannada', flag: '🇮🇳', ttsLocale: 'kn-IN', region: 'indian' },
  { code: 'ml', name: 'Malayalam', flag: '🇮🇳', ttsLocale: 'ml-IN', region: 'indian' },
  { code: 'pa', name: 'Punjabi', flag: '🇮🇳', ttsLocale: 'pa-IN', region: 'indian' },
  { code: 'or', name: 'Odia', flag: '🇮🇳', ttsLocale: 'or-IN', region: 'indian' },
  { code: 'ur', name: 'Urdu', flag: '🇵🇰', ttsLocale: 'ur-PK', region: 'indian' },
  { code: 'as', name: 'Assamese', flag: '🇮🇳', ttsLocale: 'as-IN', region: 'indian' },
  { code: 'mai', name: 'Maithili', flag: '🇮🇳', ttsLocale: 'hi-IN', region: 'indian' },
  { code: 'sat', name: 'Santali', flag: '🇮🇳', ttsLocale: 'hi-IN', region: 'indian' },
  { code: 'ks', name: 'Kashmiri', flag: '🇮🇳', ttsLocale: 'hi-IN', region: 'indian' },
  { code: 'ne', name: 'Nepali', flag: '🇳🇵', ttsLocale: 'ne-NP', region: 'indian' },
  { code: 'si', name: 'Sinhala', flag: '🇱🇰', ttsLocale: 'si-LK', region: 'indian' },
  { code: 'sd', name: 'Sindhi', flag: '🇮🇳', ttsLocale: 'ur-PK', region: 'indian' },
  { code: 'doi', name: 'Dogri', flag: '🇮🇳', ttsLocale: 'hi-IN', region: 'indian' },
  { code: 'mni', name: 'Manipuri', flag: '🇮🇳', ttsLocale: 'hi-IN', region: 'indian' },
  { code: 'bho', name: 'Bhojpuri', flag: '🇮🇳', ttsLocale: 'hi-IN', region: 'indian' },
  { code: 'raj', name: 'Rajasthani', flag: '🇮🇳', ttsLocale: 'hi-IN', region: 'indian' },
  { code: 'awa', name: 'Awadhi', flag: '🇮🇳', ttsLocale: 'hi-IN', region: 'indian' },
  { code: 'mag', name: 'Magahi', flag: '🇮🇳', ttsLocale: 'hi-IN', region: 'indian' },
  { code: 'hne', name: 'Chhattisgarhi', flag: '🇮🇳', ttsLocale: 'hi-IN', region: 'indian' },
  { code: 'gom', name: 'Konkani', flag: '🇮🇳', ttsLocale: 'hi-IN', region: 'indian' },
  { code: 'brx', name: 'Bodo', flag: '🇮🇳', ttsLocale: 'hi-IN', region: 'indian' },
  { code: 'tcy', name: 'Tulu', flag: '🇮🇳', ttsLocale: 'kn-IN', region: 'indian' },
  { code: 'lus', name: 'Mizo', flag: '🇮🇳', ttsLocale: 'hi-IN', region: 'indian' },
  { code: 'kha', name: 'Khasi', flag: '🇮🇳', ttsLocale: 'hi-IN', region: 'indian' },

  // International Languages
  { code: 'en', name: 'English', flag: '🇬🇧', ttsLocale: 'en-US', region: 'international' },
  { code: 'es', name: 'Spanish', flag: '🇪🇸', ttsLocale: 'es-ES', region: 'international' },
  { code: 'fr', name: 'French', flag: '🇫🇷', ttsLocale: 'fr-FR', region: 'international' },
  { code: 'de', name: 'German', flag: '🇩🇪', ttsLocale: 'de-DE', region: 'international' },
  { code: 'ja', name: 'Japanese', flag: '🇯🇵', ttsLocale: 'ja-JP', region: 'international' },
  { code: 'zh', name: 'Chinese', flag: '🇨🇳', ttsLocale: 'zh-CN', region: 'international' },
  { code: 'ar', name: 'Arabic', flag: '🇸🇦', ttsLocale: 'ar-SA', region: 'international' },
  { code: 'ru', name: 'Russian', flag: '🇷🇺', ttsLocale: 'ru-RU', region: 'international' },
  { code: 'pt', name: 'Portuguese', flag: '🇧🇷', ttsLocale: 'pt-BR', region: 'international' },
  { code: 'it', name: 'Italian', flag: '🇮🇹', ttsLocale: 'it-IT', region: 'international' },
  { code: 'ko', name: 'Korean', flag: '🇰🇷', ttsLocale: 'ko-KR', region: 'international' },
  { code: 'tr', name: 'Turkish', flag: '🇹🇷', ttsLocale: 'tr-TR', region: 'international' },
  { code: 'nl', name: 'Dutch', flag: '🇳🇱', ttsLocale: 'nl-NL', region: 'international' },
  { code: 'pl', name: 'Polish', flag: '🇵🇱', ttsLocale: 'pl-PL', region: 'international' },
  { code: 'sv', name: 'Swedish', flag: '🇸🇪', ttsLocale: 'sv-SE', region: 'international' },
  { code: 'id', name: 'Indonesian', flag: '🇮🇩', ttsLocale: 'id-ID', region: 'international' },
  { code: 'vi', name: 'Vietnamese', flag: '🇻🇳', ttsLocale: 'vi-VN', region: 'international' },
  { code: 'th', name: 'Thai', flag: '🇹🇭', ttsLocale: 'th-TH', region: 'international' },
  { code: 'uk', name: 'Ukrainian', flag: '🇺🇦', ttsLocale: 'uk-UA', region: 'international' },
  { code: 'fa', name: 'Persian', flag: '🇮🇷', ttsLocale: 'fa-IR', region: 'international' },
];

export const SOURCE_LANGUAGES = LANGUAGES;
export const TARGET_LANGUAGES = LANGUAGES.filter((l) => l.code !== 'auto');

export const getLanguageByCode = (code) =>
  LANGUAGES.find((l) => l.code === code) || null;

export const getLanguageName = (code) =>
  getLanguageByCode(code)?.name || code;

export const getTtsLocale = (code) =>
  getLanguageByCode(code)?.ttsLocale || null;
