import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, Share, Clipboard, ActivityIndicator, Image,
  KeyboardAvoidingView, Platform, StatusBar, Animated,
} from 'react-native';
import Voice from '@react-native-voice/voice';
import { useTheme } from '../ThemeContext';
import LanguagePicker from '../components/LanguagePicker';
import EmotionSelector from '../components/EmotionSelector';
import VibeCheckSection from '../components/VibeCheckSection';
import { translateText } from '../api';
import { SOURCE_LANGUAGES, TARGET_LANGUAGES, getLanguageByCode } from '../languages';

const HomeScreen = ({ route }) => {
  const { theme, isDark, toggleTheme } = useTheme();
  const s = makeStyles(theme, isDark);

  const [inputText, setInputText]     = useState('');
  const [outputText, setOutputText]   = useState('');
  const [sourceLang, setSourceLang]   = useState('auto');
  const [targetLang, setTargetLang]   = useState('hi');
  const [translating, setTranslating] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [detectedLang, setDetectedLang] = useState(null);
  const [translateError, setTranslateError] = useState(null);
  const outputAnim = useRef(new Animated.Value(1)).current;
  const btnScale   = useRef(new Animated.Value(1)).current;

  // Undo/Redo history for output text
  const undoStack = useRef([]);
  const redoStack = useRef([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const handleReplace = (newText) => {
    undoStack.current.push(outputText);
    redoStack.current = [];
    setCanUndo(true);
    setCanRedo(false);
    setOutputText(newText);
  };

  const handleUndo = () => {
    if (!undoStack.current.length) return;
    const prev = undoStack.current.pop();
    redoStack.current.push(outputText);
    setCanUndo(undoStack.current.length > 0);
    setCanRedo(true);
    setOutputText(prev);
  };

  const handleRedo = () => {
    if (!redoStack.current.length) return;
    const next = redoStack.current.pop();
    undoStack.current.push(outputText);
    setCanUndo(true);
    setCanRedo(redoStack.current.length > 0);
    setOutputText(next);
  };

  const setOutputWithHistory = (newText) => {
    undoStack.current = [];
    redoStack.current = [];
    setCanUndo(false);
    setCanRedo(false);
    setOutputText(newText);
  };

  const targetLangObj = getLanguageByCode(targetLang);

  useEffect(() => {
    Voice.onSpeechStart   = () => setIsListening(true);
    Voice.onSpeechEnd     = () => setIsListening(false);
    Voice.onSpeechError   = () => setIsListening(false);
    Voice.onSpeechResults = (e) => { const r = e.value?.[0] || ''; if (r) setInputText(r); };
    return () => { Voice.destroy().then(Voice.removeAllListeners); };
  }, []);

  // Handle retranslate from History
  useEffect(() => {
    const params = route?.params?.retranslate;
    if (!params) return;
    setInputText(params.text || '');
    setSourceLang(params.sourceLang || 'auto');
    setTargetLang(params.targetLang || 'hi');
    setDetectedLang(null);
    if (params.translatedText) {
      setOutputWithHistory(params.translatedText);
      Animated.spring(outputAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 8 }).start();
    } else {
      setOutputWithHistory('');
    }
  }, [route?.params?.retranslate]);

  const handleInputChange = (text) => {
    setInputText(text);
    if (sourceLang !== 'auto' || !text.trim() || text.trim().length < 2) return;
    const t = text.trim();
    let detected = null;
    if (/[\u0900-\u097F]/.test(t)) detected = 'hi';
    else if (/[\u0980-\u09FF]/.test(t)) detected = 'bn';
    else if (/[\u0B80-\u0BFF]/.test(t)) detected = 'ta';
    else if (/[\u0C00-\u0C7F]/.test(t)) detected = 'te';
    else if (/[\u0C80-\u0CFF]/.test(t)) detected = 'kn';
    else if (/[\u0D00-\u0D7F]/.test(t)) detected = 'ml';
    else if (/[\u0A80-\u0AFF]/.test(t)) detected = 'gu';
    else if (/[\u0A00-\u0A7F]/.test(t)) detected = 'pa';
    else if (/[\u0600-\u06FF]/.test(t)) detected = 'ar';
    else if (/[\u4E00-\u9FFF]/.test(t)) detected = 'zh-CN';
    else if (/[\u3040-\u30FF]/.test(t)) detected = 'ja';
    else if (/[\uAC00-\uD7AF]/.test(t)) detected = 'ko';
    else if (/[\u0400-\u04FF]/.test(t)) detected = 'ru';
    else if (/[\u0E00-\u0E7F]/.test(t)) detected = 'th';
    else if (/[a-zA-Z]/.test(t)) detected = 'en';
    if (detected && detected !== sourceLang) { setSourceLang(detected); setDetectedLang(detected); }
  };

  const animateBtn = () => {
    Animated.sequence([
      Animated.timing(btnScale, { toValue: 0.96, duration: 80, useNativeDriver: true }),
      Animated.spring(btnScale, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start();
  };

  const runTranslation = async () => {
    if (!inputText.trim()) return;
    animateBtn();
    setTranslating(true);
    setOutputWithHistory('');
    outputAnim.setValue(0);
    setTranslateError(null);
    try {
      const result = await translateText({
        text: inputText.trim(), sourceLang, targetLang,
        sourceLangName: getLanguageByCode(sourceLang)?.name || sourceLang,
        targetLangName: targetLangObj?.name || targetLang,
      });
      setOutputWithHistory(result.translatedText || '');
      if (result.detectedLang && sourceLang === 'auto') {
        setDetectedLang(result.detectedLang);
        setSourceLang(result.detectedLang);
      }
      Animated.spring(outputAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 8 }).start();
    } catch (err) {
      const msg = err.message || 'Translation failed.';
      const isNetwork = msg.toLowerCase().includes('network') || msg.toLowerCase().includes('connect');
      setTranslateError(isNetwork ? '📡 No internet connection. Please check your network and try again.' : `⚠️ ${msg}`);
    } finally {
      setTranslating(false);
    }
  };

  const handleSwap = () => {
    if (sourceLang === 'auto') return;
    setSourceLang(targetLang); setTargetLang(sourceLang);
    setInputText(outputText); setOutputText('');
    setDetectedLang(null); outputAnim.setValue(0);
  };

  const handleVoice = async () => {
    try {
      if (isListening) { await Voice.stop(); return; }
      await Voice.start(getLanguageByCode(sourceLang)?.ttsLocale || 'en-US');
    } catch (e) { Alert.alert('Voice Error', e.message); }
  };

  const handleClear = () => {
    setInputText(''); setDetectedLang(null);
    setOutputWithHistory('');
    outputAnim.setValue(0);
  };

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />

      <ScrollView
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={s.header}>
          <View style={s.logoRow}>
            <Image source={require('../assets/logo1.png')} style={s.logoImage} />
          </View>
          <TouchableOpacity onPress={toggleTheme} style={s.themeBtn} activeOpacity={0.7}>
            <Text style={s.themeBtnTxt}>{isDark ? '☀️' : '🌙'}</Text>
          </TouchableOpacity>
        </View>

        {/* ── Language Selector ── */}
        <View style={s.langCard}>
          <View style={s.langRow}>
            <View style={s.langPickerWrap}>
              <LanguagePicker
                languages={SOURCE_LANGUAGES}
                selectedCode={sourceLang}
                onSelect={(c) => { setSourceLang(c); setDetectedLang(null); }}
                label="From"
              />
            </View>
            <TouchableOpacity
              style={[s.swapBtn, sourceLang === 'auto' && s.swapOff]}
              onPress={handleSwap}
              disabled={sourceLang === 'auto'}
              activeOpacity={0.8}
            >
              <View style={[s.swapGrad, sourceLang === 'auto' && { backgroundColor: theme.colors.border }]}>
                <Text style={s.swapIcon}>⇄</Text>
              </View>
            </TouchableOpacity>
            <View style={s.langPickerWrap}>
              <LanguagePicker
                languages={TARGET_LANGUAGES}
                selectedCode={targetLang}
                onSelect={(c) => setTargetLang(c)}
                label="To"
              />
            </View>
          </View>
          {detectedLang && (
            <View style={s.detectedRow}>
              <View style={s.detectedDot} />
              <Text style={s.detectedTxt}>Detected: {getLanguageByCode(detectedLang)?.name || detectedLang}</Text>
            </View>
          )}
        </View>

        {/* ── Input ── */}
        <View style={s.inputCard}>
          <TextInput
            style={s.inputField}
            placeholder="Type or speak to translate..."
            placeholderTextColor={theme.colors.textPlaceholder}
            value={inputText}
            onChangeText={handleInputChange}
            multiline
            maxLength={2000}
            textAlignVertical="top"
          />
          <View style={s.inputFooter}>
            <Text style={s.charCount}>{inputText.length}/2000</Text>
            <View style={s.inputBtns}>
              {(inputText || outputText) ? (
                <TouchableOpacity onPress={handleClear} style={s.iconBtn}>
                  <Text style={s.iconBtnTxt}>✕</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity onPress={handleVoice} style={[s.iconBtn, isListening && s.iconBtnActive]} activeOpacity={0.7}>
                <Text style={s.iconBtnTxt}>{isListening ? '⏹' : '🎙'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ── Translate Button ── */}
        <Animated.View style={{ transform: [{ scale: btnScale }] }}>
          <TouchableOpacity
            onPress={runTranslation}
            disabled={!inputText.trim() || translating}
            activeOpacity={0.88}
          >
            <View style={[s.translateBtn, (!inputText.trim() || translating) && s.translateBtnOff]}>
              {translating ? (
                <View style={s.translateBtnInner}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={s.translateBtnTxt}>Translating...</Text>
                </View>
              ) : (
                <Text style={s.translateBtnTxt}>Translate</Text>
              )}
            </View>
          </TouchableOpacity>
        </Animated.View>

        {/* ── Error Card ── */}
        {translateError && (
          <View style={s.errorCard}>
            <Text style={s.errorText}>{translateError}</Text>
            <TouchableOpacity onPress={runTranslation} style={s.retryBtn} activeOpacity={0.8}>
              <Text style={s.retryTxt}>Try Again</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Output ── */}
        {(outputText || translating) && (
          <Animated.View style={[s.outputCard, {
            opacity: outputAnim,
            transform: [{ translateY: outputAnim.interpolate({ inputRange: [0,1], outputRange: [16,0] }) }],
          }]}>
            <View style={s.outputHeader}>
              <View style={s.outputLangRow}>
                <Text style={s.outputFlag}>{targetLangObj?.flag}</Text>
                <Text style={s.outputLangName}>{targetLangObj?.name}</Text>
              </View>
              {outputText && (
                <View style={s.outputActions}>
                  <TouchableOpacity
                    onPress={handleUndo}
                    disabled={!canUndo}
                    style={[s.actionBtn, !canUndo && { opacity: 0.3 }]}
                  >
                    <Text style={s.actionBtnTxt}>↩️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleRedo}
                    disabled={!canRedo}
                    style={[s.actionBtn, !canRedo && { opacity: 0.3 }]}
                  >
                    <Text style={s.actionBtnTxt}>↪️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { Clipboard.setString(outputText); Alert.alert('Copied!'); }} style={s.actionBtn}>
                    <Text style={s.actionBtnTxt}>📋</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={async () => { try { await Share.share({ message: outputText }); } catch (_) {} }} style={s.actionBtn}>
                    <Text style={s.actionBtnTxt}>📤</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
            {translating
              ? <View style={s.loadingRow}><ActivityIndicator color={theme.colors.primary} /><Text style={s.loadingTxt}>Translating...</Text></View>
              : <Text style={s.outputTxt} selectable>{outputText}</Text>
            }
          </Animated.View>
        )}

        {/* ── Emotion Voice ── */}
        {outputText && (
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionEmoji}>🎭</Text>
              <Text style={s.sectionTitle}>Emotion Voice</Text>
            </View>
            <EmotionSelector text={outputText} locale={targetLangObj?.ttsLocale} targetLang={targetLang} disabled={translating} />
          </View>
        )}

        {/* ── Vibe Check ── */}
        {outputText && <VibeCheckSection outputText={outputText} targetLang={targetLang} onReplace={handleReplace} />}

      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const makeStyles = (theme, isDark) => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  content: { paddingHorizontal: 16, paddingBottom: 48, paddingTop: Platform.OS === 'android' ? 32 : 8 },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoImage: { width: 200, height: 70, resizeMode: 'contain' },
  themeBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
    alignItems: 'center', justifyContent: 'center',
  },
  themeBtnTxt: { fontSize: 18 },

  // Lang card
  langCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 20, padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: theme.colors.border,
    shadowColor: '#6366F1', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: isDark ? 0.15 : 0.06, shadowRadius: 12, elevation: 3,
  },
  langRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  langPickerWrap: { flex: 1 },
  swapBtn: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden' },
  swapOff: { opacity: 0.4 },
  swapGrad: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: '#6366F1', borderRadius: 22 },
  swapIcon: { fontSize: 18, color: '#fff', fontWeight: '800' },
  detectedRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  detectedDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981' },
  detectedTxt: { fontSize: 12, color: '#10B981', fontWeight: '600' },

  // Input
  inputCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 20, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: theme.colors.border,
    minHeight: 140,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isDark ? 0.2 : 0.05, shadowRadius: 8, elevation: 2,
  },
  inputField: { fontSize: 16, color: theme.colors.text, minHeight: 90, lineHeight: 24 },
  inputFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  charCount: { fontSize: 12, color: theme.colors.textPlaceholder },
  inputBtns: { flexDirection: 'row', gap: 8 },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(99,102,241,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  iconBtnActive: { backgroundColor: 'rgba(239,68,68,0.12)' },
  iconBtnTxt: { fontSize: 15 },

  // Translate button
  translateBtn: {
    borderRadius: 18, paddingVertical: 17,
    alignItems: 'center', marginBottom: 14,
    backgroundColor: '#6366F1',
    shadowColor: '#6366F1', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  translateBtnOff: { backgroundColor: isDark ? '#2D2D4A' : '#E2E8F0', shadowOpacity: 0, elevation: 0 },
  translateBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  translateBtnTxt: { color: '#fff', fontSize: 17, fontWeight: '800', letterSpacing: 0.3 },

  // Output
  outputCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 20, padding: 16, marginBottom: 14,
    borderWidth: 1, borderColor: theme.colors.border,
    shadowColor: '#6366F1', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: isDark ? 0.15 : 0.07, shadowRadius: 12, elevation: 3,
  },
  outputHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  outputLangRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  outputFlag: { fontSize: 20 },
  outputLangName: { fontSize: 14, fontWeight: '700', color: theme.colors.primary },
  outputActions: { flexDirection: 'row', gap: 6 },
  actionBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(99,102,241,0.07)',
    alignItems: 'center', justifyContent: 'center',
  },
  actionBtnTxt: { fontSize: 14 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  loadingTxt: { color: theme.colors.textSecondary, fontSize: 14 },
  outputTxt: { fontSize: 17, color: theme.colors.text, lineHeight: 26 },

  // Error card
  errorCard: {
    backgroundColor: isDark ? 'rgba(239,68,68,0.12)' : '#FEF2F2',
    borderRadius: 16, padding: 16, marginBottom: 14,
    borderWidth: 1, borderColor: isDark ? 'rgba(239,68,68,0.3)' : '#FECACA',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
  },
  errorText: { flex: 1, fontSize: 13, color: isDark ? '#FCA5A5' : '#DC2626', lineHeight: 20 },
  retryBtn: {
    backgroundColor: '#EF4444', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  retryTxt: { color: '#fff', fontSize: 12, fontWeight: '700' },

  // Sections
  section: { marginBottom: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  sectionEmoji: { fontSize: 16 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: theme.colors.textSecondary, letterSpacing: 0.5 },
});

export default HomeScreen;
