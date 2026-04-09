import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, Share, Clipboard, ActivityIndicator,
  KeyboardAvoidingView, Platform, StatusBar, Animated,
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
  const s = makeStyles(theme, isDark);

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
  const outputAnim = useRef(new Animated.Value(0)).current;

  const targetLangObj = getLanguageByCode(targetLang);

  useEffect(() => {
    Voice.onSpeechStart = () => setIsListening(true);
    Voice.onSpeechEnd = () => setIsListening(false);
    Voice.onSpeechError = () => setIsListening(false);
    Voice.onSpeechResults = (e) => { const r = e.value?.[0] || ''; if (r) setInputText(r); };
    return () => { Voice.destroy().then(Voice.removeAllListeners); };
  }, []);

  const handleInputChange = (text) => {
    setInputText(text);
    if (sourceLang !== 'auto') return;
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

  const runTranslation = async () => {
    if (!inputText.trim()) return;
    setTranslating(true);
    setOutputText('');
    setLangMismatch(false);
    setActiveEmotion(null);
    setEmotionText('');
    outputAnim.setValue(0);
    try {
      const result = await translateText({
        text: inputText.trim(), sourceLang, targetLang,
        sourceLangName: getLanguageByCode(sourceLang)?.name || sourceLang,
        targetLangName: targetLangObj?.name || targetLang,
      });
      setOutputText(result.translatedText || '');
      if (result.detectedLang && sourceLang === 'auto') {
        setDetectedLang(result.detectedLang);
        setSourceLang(result.detectedLang);
      }
      Animated.spring(outputAnim, { toValue: 1, useNativeDriver: true, tension: 100, friction: 8 }).start();
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('mismatch') || msg.includes('correct language') || msg.includes('Please select')) {
        setLangMismatch(true);
      } else {
        Alert.alert('Error', msg || 'Translation failed.');
      }
    } finally {
      setTranslating(false);
    }
  };

  const handleSwap = () => {
    if (sourceLang === 'auto') return;
    setSourceLang(targetLang); setTargetLang(sourceLang);
    setInputText(outputText); setOutputText('');
    setDetectedLang(null); setLangMismatch(false);
    outputAnim.setValue(0);
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
    outputAnim.setValue(0);
  };

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.colors.background} />
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* â”€â”€ Header â”€â”€ */}
        <View style={s.header}>
          <View style={s.logoRow}>
            <View style={s.logoBox}>
              <Text style={s.logoLetter}>A</Text>
              <View style={s.logoBadge}>
                <Text style={s.logoBadgeA}>A</Text>
                <Text style={s.logoBadgeArrow}>â‡„</Text>
                <Text style={s.logoBadgeAh}>à¤…</Text>
              </View>
            </View>
            <View>
              <Text style={s.appName}>Anuvadani</Text>
              <Text style={s.appSub}>Vaani</Text>
            </View>
          </View>
          <TouchableOpacity onPress={toggleTheme} style={s.themeBtn}>
            <Text style={s.themeBtnText}>{isDark ? '\u2600\uFE0F' : '\uD83C\uDF19'}</Text>
          </TouchableOpacity>
        </View>

        {/* â”€â”€ Language Selector â”€â”€ */}
        <View style={s.langCard}>
          <View style={s.langRow}>
            <View style={s.langPickerWrap}>
              <LanguagePicker languages={SOURCE_LANGUAGES} selectedCode={sourceLang}
                onSelect={(c) => { setSourceLang(c); setDetectedLang(null); setLangMismatch(false); }} label="From" />
            </View>
            <TouchableOpacity style={[s.swapBtn, sourceLang === 'auto' && s.swapOff]} onPress={handleSwap} disabled={sourceLang === 'auto'}>
              <Text style={s.swapIcon}>{"\u21C4"}</Text>
            </TouchableOpacity>
            <View style={s.langPickerWrap}>
              <LanguagePicker languages={TARGET_LANGUAGES} selectedCode={targetLang}
                onSelect={(c) => setTargetLang(c)} label="To" />
            </View>
          </View>
          {detectedLang && sourceLang !== 'auto' && (
            <View style={s.detectedRow}>
              <Text style={s.detectedDot}>{'●'}</Text>
              <Text style={s.detectedText}>Detected: {getLanguageByCode(detectedLang)?.name || detectedLang}</Text>
            </View>
          )}
        </View>

        {/* â”€â”€ Input â”€â”€ */}
        <View style={s.inputCard}>
          <TextInput
            style={s.inputField}
            placeholder="Type text to translate..."
            placeholderTextColor={theme.colors.textPlaceholder}
            value={inputText}
            onChangeText={handleInputChange}
            multiline maxLength={2000} textAlignVertical="top"
          />
          <View style={s.inputFooter}>
            <Text style={s.charCount}>{inputText.length}/2000</Text>
            <View style={s.inputBtns}>
              {(inputText.length > 0 || outputText.length > 0) && (
                <TouchableOpacity onPress={handleClear} style={s.iconBtn}>
                  <Text style={s.iconBtnTxt}>{'\u2715'}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={handleVoice} style={[s.iconBtn, isListening && s.iconBtnRed]}>
                <Text style={s.iconBtnTxt}>{isListening ? '\u23F9' : '\uD83C\uDF99'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* â”€â”€ Translate Button â”€â”€ */}
        <TouchableOpacity
          style={[s.translateBtn, (!inputText.trim() || translating) && s.translateBtnOff]}
          onPress={runTranslation} disabled={!inputText.trim() || translating}
          activeOpacity={0.85}
        >
          {translating
            ? <View style={s.translateBtnInner}><ActivityIndicator color="#fff" size="small" /><Text style={s.translateBtnTxt}>Translating...</Text></View>
            : <Text style={s.translateBtnTxt}>Translate</Text>}
        </TouchableOpacity>

        {/* â”€â”€ Mismatch Banner â”€â”€ */}
        {langMismatch && (
          <TouchableOpacity style={s.mismatchBanner} onPress={() => { setSourceLang('auto'); setLangMismatch(false); }}>
            <Text style={s.mismatchTxt}>Please select the correct language — tap to use Auto Detect</Text>
          </TouchableOpacity>
        )}

        {/* â”€â”€ Output â”€â”€ */}
        {(outputText || translating) && (
          <Animated.View style={[s.outputCard, { opacity: outputAnim, transform: [{ translateY: outputAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }]}>
            <View style={s.outputHeader}>
              <View style={s.outputLangRow}>
                <Text style={s.outputFlag}>{targetLangObj?.flag}</Text>
                <Text style={s.outputLang}>{targetLangObj?.name}</Text>
              </View>
              {outputText && (
                <View style={s.outputActions}>
                  <TTSButton text={outputText} locale={targetLangObj?.ttsLocale} disabled={false} emotion="normal" />
                  <TouchableOpacity onPress={() => { Clipboard.setString(outputText); Alert.alert('Copied!'); }} style={s.actionBtn}>
                    <Text style={s.actionBtnTxt}>{'\uD83D\uDCCB'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={async () => { try { await Share.share({ message: outputText }); } catch (e) {} }} style={s.actionBtn}>
                    <Text style={s.actionBtnTxt}>{'\uD83D\uDCE4'}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
            {translating
              ? <View style={s.loadingRow}><ActivityIndicator color="#4F46E5" /><Text style={s.loadingTxt}>Translating...</Text></View>
              : <Text style={s.outputTxt} selectable>{outputText}</Text>}
          </Animated.View>
        )}

        {/* â”€â”€ Emotion Voice â”€â”€ */}
        {outputText && (
          <View style={s.section}>
            <Text style={s.sectionLabel}>EMOTION VOICE</Text>
            <EmotionSelector text={outputText} locale={targetLangObj?.ttsLocale} targetLang={targetLang} disabled={translating} />
          </View>
        )}

        {/* â”€â”€ Vibe Check â”€â”€ */}
        {outputText && <VibeCheckSection outputText={outputText} targetLang={targetLang} />}

      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const makeStyles = (theme, isDark) => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 16, paddingBottom: 48 },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22, paddingTop: 6 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logoBox: {
    width: 52, height: 52, borderRadius: 16,
    backgroundColor: '#4F46E5',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 8, elevation: 6,
  },
  logoLetter: { fontSize: 28, fontWeight: '900', color: '#fff' },
  logoBadge: {
    position: 'absolute', bottom: 3, right: -5,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 7,
    paddingHorizontal: 3, paddingVertical: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 2, elevation: 2,
  },
  logoBadgeA: { fontSize: 8, fontWeight: '900', color: '#4F46E5' },
  logoBadgeArrow: { fontSize: 8, color: '#06B6D4', fontWeight: '900' },
  logoBadgeAh: { fontSize: 8, fontWeight: '900', color: '#0EA5E9' },
  appName: { fontSize: 22, fontWeight: '900', color: '#4F46E5', letterSpacing: -0.5 },
  appSub: { fontSize: 18, fontWeight: '800', color: '#0EA5E9', letterSpacing: -0.3, marginTop: -3 },
  themeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.surfaceVariant, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.border },
  themeBtnText: { fontSize: 18 },

  // Language Card
  langCard: { backgroundColor: theme.colors.surface, borderRadius: 18, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: theme.colors.border, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  langRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  langPickerWrap: { flex: 1 },
  swapBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#4F46E5', alignItems: 'center', justifyContent: 'center', shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 },
  swapOff: { backgroundColor: theme.colors.border, shadowOpacity: 0 },
  swapIcon: { fontSize: 16, color: '#fff', fontWeight: '800' },
  detectedRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  detectedDot: { fontSize: 8, color: '#10B981' },
  detectedText: { fontSize: 12, color: '#10B981', fontWeight: '600' },

  // Input
  inputCard: { backgroundColor: theme.colors.surface, borderRadius: 18, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: theme.colors.border, minHeight: 130, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  inputField: { fontSize: 16, color: theme.colors.text, minHeight: 80, lineHeight: 24 },
  inputFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  charCount: { fontSize: 12, color: theme.colors.textPlaceholder },
  inputBtns: { flexDirection: 'row', gap: 8 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.colors.surfaceVariant, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.border },
  iconBtnRed: { backgroundColor: '#FEE2E2', borderColor: '#EF4444' },
  iconBtnTxt: { fontSize: 15 },

  // Translate Button
  translateBtn: { backgroundColor: '#4F46E5', borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginBottom: 12, shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 6 },
  translateBtnOff: { opacity: 0.45, shadowOpacity: 0, elevation: 0 },
  translateBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  translateBtnTxt: { color: '#fff', fontSize: 17, fontWeight: '800', letterSpacing: 0.3 },

  // Mismatch
  mismatchBanner: { backgroundColor: isDark ? '#2D1A00' : '#FFF7ED', borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#EF4444' },
  mismatchTxt: { fontSize: 13, color: isDark ? '#FCA5A5' : '#DC2626', fontWeight: '500', textAlign: 'center' },

  // Output
  outputCard: { backgroundColor: theme.colors.surface, borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: theme.colors.border, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  outputHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  outputLangRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  outputFlag: { fontSize: 18 },
  outputLang: { fontSize: 14, fontWeight: '700', color: '#4F46E5' },
  outputActions: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  actionBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: theme.colors.surfaceVariant, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.border },
  actionBtnTxt: { fontSize: 14 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  loadingTxt: { color: theme.colors.textSecondary, fontSize: 14 },
  outputTxt: { fontSize: 17, color: theme.colors.text, lineHeight: 26 },

  // Sections
  section: { marginBottom: 10 },
  sectionLabel: { fontSize: 10, fontWeight: '800', color: theme.colors.textSecondary, letterSpacing: 1.5, marginBottom: 8 },
});

export default HomeScreen;







