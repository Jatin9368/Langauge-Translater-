import axios from 'axios';

// API Base URL - from environment or default
// For development: Update your machine IP (replace with your actual IP)
// Android Emulator: 'http://10.0.2.2:5000'
// Physical Device: 'http://YOUR_MACHINE_IP:5000'
// USB Debug: 'http://localhost:5000' (after: adb reverse tcp:5000 tcp:5000)

export const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 90000,
  headers: { 'Content-Type': 'application/json' },
});

// Response interceptor for unified error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.error ||
      error.message ||
      'Network error. Check your connection.';
    return Promise.reject(new Error(message));
  }
);

// ─── Translation ────────────────────────────────────────────────────────────

export const translateText = async ({ text, sourceLang, targetLang, sourceLangName, targetLangName, saveHistory = true }) => {
  try {
    const res = await api.post('/api/translate', {
      text,
      sourceLang,
      targetLang,
      sourceLangName,
      targetLangName,
      saveHistory,
    });
    return res.data;
  } catch (err) {
    throw err;
  }
};

export const detectLanguage = async (text) => {
  try {
    const res = await api.post('/api/translate/detect', { text });
    return res.data;
  } catch (err) {
    throw err;
  }
};

// ─── Emotion Rephrasing ──────────────────────────────────────────────────────

export const rephraseEmotion = async ({ text, emotion, targetLang }) => {
  try {
    const res = await api.post('/api/emotion/rephrase', { text, emotion, targetLang });
    return res.data;
  } catch (err) {
    throw err;
  }
};

// ─── Vibe Check (Style Rephrase) ──────────────────────────────────────────────

export const rephraseStyle = async ({ text, targetLang }) => {
  try {
    const res = await api.post('/api/vibe/rephrase', { text, targetLang });
    return res.data;
  } catch (err) {
    throw err;
  }
};

// ─── History ─────────────────────────────────────────────────────────────────

export const fetchHistory = async (page = 1, limit = 20) => {
  try {
    const res = await api.get('/api/history', { params: { page, limit } });
    return res.data;
  } catch (err) {
    throw err;
  }
};

export const deleteHistoryItem = async (id) => {
  try {
    const res = await api.delete(`/api/history/${id}`);
    return res.data;
  } catch (err) {
    throw err;
  }
};

export const clearAllHistory = async () => {
  try {
    const res = await api.delete('/api/history');
    return res.data;
  } catch (err) {
    throw err;
  }
};

export default api;
