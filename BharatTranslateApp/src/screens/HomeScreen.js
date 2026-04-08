import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, Share, Clipboard, ActivityIndicator,
  KeyboardAvoidingView, Platform, StatusBar,
} from 'react-native';
import Voice from '@react-native-voice/voice';
import { useTheme } from '../ThemeContext';
import LanguagePicker from '../components/LanguagePicker';
import EmotionSelector from '../components/EmotionSelector';
import TTSButton from '../components/TTSButton';
import VibeCheckSection from '../components/VibeCheckSection';
import { translateText } from '../api';
import { SOURCE_LANGUAGES, TARGET_LANGUAGES, getLanguageByCode } from '../languages';

const HomeScreen = () => {
  const { theme, isDark, toggleTheme } = useTheme();
  const s = makeStyles(theme);

  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [sourceLang, setSourceLang] = useState('auto');
  const [targetLang, setTargetLang] = useState('en');
  const [translating, setTranslating] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [detectedLang, setDetectedLang] = useState(null);
  const [langMismatch, setLangMismatch] = useState(false);
  const [emotionText, setEmotionText] = useState('');
  const [emotionVoiceText, setEmotionVoiceText] = useState('');
  const [activeEmotion, setActiveEmotion] = useState(null);
  const detectTimer = useRef(null);

  const targetLangObj = getLanguageByCode(targetLang);

  // Real-time language detection as user types
  const handleInputChange = (text) => {
    setInputText(text);
    if (sourceLang !== 'auto') return; // only when auto is selected
    if (!text.trim() || text.trim().length < 3) return;

    if (detectTimer.current) clearTimeout(detectTimer.current);
    detectTimer.current = setTimeout(async () => {
      try {
        const res = await fetch('http://localhost:5000/api/translate/detect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: text.trim().slice(0, 100) }),
        });
        const data = await res.json();
        const detected = data.detectedLang;
        if (detected && detected !== 'auto' && detected !== 'en') {
          setSourceLang(detected);
          setDetectedLang(detected);
        }
      } catch (e) {}
    }, 800);
  };

  useEffect(() => {
    Voice.onSpeechStart = () => setIsListening(true);
    Voice.onSpeechEnd = () => setIsListening(false);
    Voice.onSpeechError = () => setIsListening(false);
    Voice.onSpeechResults = (e) => { const r = e.value?.[0] || ''; if (r) setInputText(r); };
    return () => { Voice.destroy().then(Voice.removeAllListeners); };
  }, []);

  const runTranslation = async () => {
    if (!inputText.trim()) return;
    setTranslating(true);
    setOutputText('');
    setLangMismatch(false);
    setActiveEmotion(null);
    setEmotionText('');
    try {
      const result = await translateText({
        text: inputText.trim(), sourceLang, targetLang,
        sourceLangName: getLanguageByCode(sourceLang)?.name || sourceLang,
        targetLangName: targetLangObj?.name || targetLang,
      });
      setOutputText(result.translatedText || '');
      if (result.detectedLang && sourceLang === 'auto') {
        setDetectedLang(result.detectedLang);
        setSourceLang(result.detectedLang); // Auto select detected language
      }
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('mismatch')) setLangMismatch(true);
      else Alert.alert('Error', msg || 'Translation failed.');
    } finally {
      setTranslating(false);
    }
  };

  const handleSwap = () => {
    if (sourceLang === 'auto') return;
    setSourceLang(targetLang); setTargetLang(sourceLang);
    setInputText(outputText); setOutputText('');
    setDetectedLang(null); setLangMismatch(false);
  };

  const handleVoice = async () => {
    try {
      if (isListening) { await Voice.stop(); return; }
      await Voice.start(getLanguageByCode(sourceLang)?.ttsLocale || 'en-US');
    } catch (e) { Alert.alert('Voice Error', e.message); }
  };

  const handleClear = () => {
    setInputText(''); setOutputText(''); setDetectedLang(null);
    setLangMismatch(false); setActiveEmotion(null); setEmotionText('');
  };

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.colors.background} />
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.appName}>Samvaadini</Text>
            <Text style={s.appTagline}>Bharat · Translate · Voice · Emotion</Text>
          </View>
          <TouchableOpacity onPress={toggleTheme} style={s.themeBtn}>
            <Text style={s.themeBtnText}>{isDark ? '☀️' : '🌙'}</Text>
          </TouchableOpacity>
        </View>

        {/* Language Selector Card */}
        <View style={s.langCard}>
          <View style={s.langRow}>
            <View style={s.langPickerWrap}>
              <LanguagePicker languages={SOURCE_LANGUAGES} selectedCode={sourceLang}
                onSelect={(c) => { setSourceLang(c); setDetectedLang(null); setLangMismatch(false); }} label="From" />
            </View>
            <TouchableOpacity style={[s.swapBtn, sourceLang === 'auto' && s.swapDisabled]} onPress={handleSwap} disabled={sourceLang === 'auto'}>
              <Text style={s.swapIcon}>⇄</Text>
            </TouchableOpacity>
            <View style={s.langPickerWrap}>
              <LanguagePicker languages={TARGET_LANGUAGES} selectedCode={targetLang}
                onSelect={(c) => setTargetLang(c)} label="To" />
            </View>
          </View>
          {detectedLang && sourceLang === 'auto' && (
            <Text style={s.detectedText}>🔍 Detected: {getLanguageByCode(detectedLang)?.name || detectedLang}</Text>
          )}
        </View>

        {/* Input */}
        <View style={s.inputCard}>
          <TextInput
            style={s.inputField}
            placeholder="Type text to translate..."
            placeholderTextColor={theme.colors.textPlaceholder}
            value={inputText} onChangeText={handleInputChange}
            multiline maxLength={2000} textAlignVertical="top"
          />
          <View style={s.inputFooter}>
            <Text style={s.charCount}>{inputText.length}/2000</Text>
            <View style={s.inputActions}>
              {(inputText.length > 0 || outputText.length > 0) && (
                <TouchableOpacity onPress={handleClear} style={s.iconBtn}>
                  <Text style={s.iconBtnText}>✕</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={handleVoice} style={[s.iconBtn, isListening && s.iconBtnActive]}>
                <Text style={s.iconBtnText}>{isListening ? '⏹' : '🎤'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Translate Button */}
        <TouchableOpacity
          style={[s.translateBtn, (!inputText.trim() || translating) && s.translateBtnOff]}
          onPress={runTranslation} disabled={!inputText.trim() || translating}
        >
          {translating
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={s.translateBtnText}>Translate</Text>}
        </TouchableOpacity>

        {/* Mismatch Banner */}
        {langMismatch && (
          <TouchableOpacity style={s.mismatchBanner} onPress={() => { setSourceLang('auto'); setLangMismatch(false); }}>
            <Text style={s.mismatchText}>⚠️ Wrong language. Tap to use Auto Detect.</Text>
          </TouchableOpacity>
        )}

        {/* Output */}
        {(outputText || translating) && (
          <View style={s.outputCard}>
            <View style={s.outputHeader}>
              <Text style={s.outputLang}>{targetLangObj?.flag} {targetLangObj?.name}</Text>
              {outputText && (
                <View style={s.outputActions}>
                  <TTSButton text={outputText} locale={targetLangObj?.ttsLocale} disabled={false} emotion="normal" />
                  <TouchableOpacity onPress={() => { Clipboard.setString(outputText); Alert.alert('Copied!'); }} style={s.actionBtn}>
                    <Text style={s.actionBtnText}>📋</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={async () => { try { await Share.share({ message: outputText }); } catch (e) {} }} style={s.actionBtn}>
                    <Text style={s.actionBtnText}>↗</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
            {translating
              ? <View style={s.loadingRow}><ActivityIndicator color={theme.colors.primary} /><Text style={s.loadingText}>Translating...</Text></View>
              : <Text style={s.outputText} selectable>{outputText}</Text>}
          </View>
        )}

        {/* Emotion Voice */}
        {outputText && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Emotion Voice</Text>
            <EmotionSelector text={outputText} locale={targetLangObj?.ttsLocale} targetLang={targetLang} disabled={translating} />
          </View>
        )}

        {/* Vibe Check */}
        {outputText && <VibeCheckSection outputText={outputText} targetLang={targetLang} />}

      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const makeStyles = (theme) => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 16, paddingBottom: 40 },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingTop: 8 },
  appName: { fontSize: 28, fontWeight: '800', color: theme.colors.primary, letterSpacing: -1 },
  appTagline: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2, letterSpacing: 0.5 },
  themeBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: theme.colors.surfaceVariant, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.border },
  themeBtnText: { fontSize: 20 },

  // Language Card
  langCard: { backgroundColor: theme.colors.surface, borderRadius: 18, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: theme.colors.border, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  langRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  langPickerWrap: { flex: 1 },
  swapBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center', shadowColor: theme.colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 },
  swapDisabled: { backgroundColor: theme.colors.border, shadowOpacity: 0 },
  swapIcon: { fontSize: 16, color: '#fff', fontWeight: '800' },
  detectedText: { fontSize: 12, color: theme.colors.primary, marginTop: 8, marginLeft: 2 },

  // Input
  inputCard: { backgroundColor: theme.colors.surface, borderRadius: 18, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: theme.colors.border, minHeight: 130, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  inputField: { fontSize: 16, color: theme.colors.text, minHeight: 80, lineHeight: 24 },
  inputFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  charCount: { fontSize: 12, color: theme.colors.textPlaceholder },
  inputActions: { flexDirection: 'row', gap: 8 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.colors.surfaceVariant, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.border },
  iconBtnActive: { backgroundColor: '#FEE2E2', borderColor: '#EF4444' },
  iconBtnText: { fontSize: 15 },

  // Translate Button
  translateBtn: { backgroundColor: theme.colors.primary, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginBottom: 12, shadowColor: theme.colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 6 },
  translateBtnOff: { opacity: 0.45, shadowOpacity: 0, elevation: 0 },
  translateBtnText: { color: '#fff', fontSize: 17, fontWeight: '700', letterSpacing: 0.5 },

  // Mismatch
  mismatchBanner: { backgroundColor: theme.dark ? '#2D1A00' : '#FFF3CD', borderRadius: 10, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: '#F59E0B' },
  mismatchText: { fontSize: 13, color: theme.dark ? '#FCD34D' : '#92400E', fontWeight: '500', textAlign: 'center' },

  // Output
  outputCard: { backgroundColor: theme.colors.outputBackground, borderRadius: 18, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: theme.colors.border, minHeight: 100 },
  outputHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  outputLang: { fontSize: 13, fontWeight: '700', color: theme.colors.primary },
  outputActions: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  actionBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: theme.colors.surfaceVariant, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.border },
  actionBtnText: { fontSize: 14 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  loadingText: { color: theme.colors.textSecondary, fontSize: 14 },
  outputText: { fontSize: 17, color: theme.colors.text, lineHeight: 26 },

  // Sections
  section: { marginBottom: 10 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: theme.colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
});

export default HomeScreen;
