import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Share,
  Clipboard,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Voice from '@react-native-voice/voice';
import { useTheme } from '../ThemeContext';
import LanguagePicker from '../components/LanguagePicker';
import EmotionSelector from '../components/EmotionSelector';
import TTSButton from '../components/TTSButton';
import StyleSelector from '../components/StyleSelector';
import VibeCheckSection from '../components/VibeCheckSection';
import { translateText, rephraseEmotion } from '../api';
import { SOURCE_LANGUAGES, TARGET_LANGUAGES, getLanguageByCode } from '../languages';

const HomeScreen = () => {
  const { theme, isDark, toggleTheme } = useTheme();
  const styles = makeStyles(theme);

  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [sourceLang, setSourceLang] = useState('auto');
  const [targetLang, setTargetLang] = useState('en');
  const [translating, setTranslating] = useState(false);
  const [emotionLoading, setEmotionLoading] = useState(false);
  const [activeEmotion, setActiveEmotion] = useState(null);
  const [emotionText, setEmotionText] = useState('');
  const [emotionVoiceText, setEmotionVoiceText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [detectedLang, setDetectedLang] = useState(null);

  const targetLangObj = getLanguageByCode(targetLang);
  const displayOutput = emotionText || outputText;

  useEffect(() => {
    Voice.onSpeechStart = () => setIsListening(true);
    Voice.onSpeechEnd = () => setIsListening(false);
    Voice.onSpeechError = (e) => {
      setIsListening(false);
      Alert.alert('Voice Error', e.error?.message || 'Speech recognition failed.');
    };
    Voice.onSpeechResults = (e) => {
      const result = e.value?.[0] || '';
      if (result) setInputText(result);
    };
    return () => { Voice.destroy().then(Voice.removeAllListeners); };
  }, []);

  const runTranslation = async () => {
    if (!inputText.trim()) {
      Alert.alert('Enter text', 'Please type something to translate.');
      return;
    }
    setTranslating(true);
    setOutputText('');
    setActiveEmotion(null);
    setEmotionText('');
    setEmotionVoiceText('');
    try {
      const sourceLangObj = getLanguageByCode(sourceLang);
      const result = await translateText({
        text: inputText.trim(),
        sourceLang,
        targetLang,
        sourceLangName: sourceLangObj?.name || sourceLang,
        targetLangName: targetLangObj?.name || targetLang,
      });
      setOutputText(result.translatedText || '');
      if (result.detectedLang && sourceLang === 'auto') setDetectedLang(result.detectedLang);
    } catch (err) {
      Alert.alert('Translation Error', err.message || 'Could not translate.');
    } finally {
      setTranslating(false);
    }
  };

  const handleSwap = () => {
    if (sourceLang === 'auto') return;
    const prev = { source: sourceLang, target: targetLang, output: outputText };
    setSourceLang(prev.target);
    setTargetLang(prev.source);
    setInputText(prev.output);
    setOutputText('');
    setActiveEmotion(null);
    setEmotionText('');
    setDetectedLang(null);
  };

  const handleVoice = async () => {
    try {
      if (isListening) { await Voice.stop(); return; }
      const locale = getLanguageByCode(sourceLang)?.ttsLocale || 'en-US';
      await Voice.start(locale);
    } catch (err) {
      Alert.alert('Voice Error', err.message || 'Could not start voice input.');
    }
  };

  const handleEmotion = (emotion) => {
    setActiveEmotion(emotion === activeEmotion ? null : emotion);
  };

  const handleCopy = () => {
    const text = displayOutput;
    if (!text) return;
    Clipboard.setString(text);
    Alert.alert('Copied!', 'Translation copied.');
  };

  const handleShare = async () => {
    const text = displayOutput;
    if (!text) return;
    try { await Share.share({ message: text }); } catch (err) {}
  };

  const handleClear = () => {
    setInputText('');
    setOutputText('');
    setActiveEmotion(null);
    setEmotionText('');
    setEmotionVoiceText('');
    setDetectedLang(null);
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>BharatTranslate</Text>
            <Text style={styles.headerSub}>50+ Languages</Text>
          </View>
          <TouchableOpacity onPress={toggleTheme} style={styles.themeBtn}>
            <Text style={styles.themeBtnText}>{isDark ? '☀️' : '🌙'}</Text>
          </TouchableOpacity>
        </View>

        {/* Language Row */}
        <View style={styles.langCard}>
          <View style={styles.langRow}>
            <View style={styles.langPickerWrap}>
              <LanguagePicker
                languages={SOURCE_LANGUAGES}
                selectedCode={sourceLang}
                onSelect={(code) => { setSourceLang(code); setDetectedLang(null); }}
                label="From"
              />
            </View>
            <TouchableOpacity
              style={[styles.swapBtn, sourceLang === 'auto' && styles.swapBtnDisabled]}
              onPress={handleSwap}
              disabled={sourceLang === 'auto'}
            >
              <Text style={styles.swapIcon}>⇄</Text>
            </TouchableOpacity>
            <View style={styles.langPickerWrap}>
              <LanguagePicker
                languages={TARGET_LANGUAGES}
                selectedCode={targetLang}
                onSelect={(code) => setTargetLang(code)}
                label="To"
              />
            </View>
          </View>
          {detectedLang && sourceLang === 'auto' && (
            <Text style={styles.detectedBadge}>
              🔍 Detected: {getLanguageByCode(detectedLang)?.name || detectedLang}
            </Text>
          )}
        </View>

        {/* Input Box */}
        <View style={styles.inputCard}>
          <TextInput
            style={styles.inputText}
            placeholder="Enter text to translate..."
            placeholderTextColor={theme.colors.textPlaceholder}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={2000}
            textAlignVertical="top"
          />
          <View style={styles.inputFooter}>
            <Text style={styles.charCount}>{inputText.length}/2000</Text>
            <View style={styles.inputBtns}>
              {(inputText.length > 0 || outputText.length > 0) && (
                <TouchableOpacity onPress={handleClear} style={styles.iconBtn}>
                  <Text style={styles.iconBtnText}>✕</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={handleVoice}
                style={[styles.iconBtn, isListening && styles.iconBtnListening]}
              >
                <Text style={styles.iconBtnText}>{isListening ? '⏹' : '🎤'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Translate Button */}
        <TouchableOpacity
          style={[styles.translateBtn, (!inputText.trim() || translating) && styles.translateBtnDisabled]}
          onPress={runTranslation}
          disabled={!inputText.trim() || translating}
        >
          {translating ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.translateBtnText}>🌐  Translate</Text>
          )}
        </TouchableOpacity>

        {/* Output Box */}
        {(outputText || translating) ? (
          <View style={styles.outputCard}>
            <View style={styles.outputHeader}>
              <Text style={styles.outputLangBadge}>
                {targetLangObj?.flag} {targetLangObj?.name}
              </Text>
              {outputText ? (
                <View style={styles.outputActions}>
                  <TTSButton text={outputText} locale={targetLangObj?.ttsLocale} disabled={false} emotion="normal" />
                  <TouchableOpacity onPress={handleCopy} style={styles.actionBtn}>
                    <Text style={styles.actionBtnText}>📋</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleShare} style={styles.actionBtn}>
                    <Text style={styles.actionBtnText}>↗</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>

            {translating ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={theme.colors.primary} />
                <Text style={styles.loadingText}>Translating...</Text>
              </View>
            ) : (
              <Text style={styles.outputText} selectable>{outputText}</Text>
            )}
          </View>
        ) : null}

        {/* Emotion Buttons */}
        {outputText ? (
          <View style={styles.emotionSection}>
            <Text style={styles.sectionLabel}>🎭 Emotion Voice</Text>
            <EmotionSelector
              text={outputText}
              locale={targetLangObj?.ttsLocale}
              targetLang={targetLang}
              disabled={translating}
            />
          </View>
        ) : null}

        {/* Vibe Check */}
        {outputText ? (
          <VibeCheckSection outputText={outputText} />
        ) : null}

      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const makeStyles = (theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.colors.background },
    scroll: { flex: 1 },
    content: { padding: 16, paddingBottom: 40 },

    // Header
    header: {
      flexDirection: 'row', justifyContent: 'space-between',
      alignItems: 'center', marginBottom: 20, paddingTop: 4,
    },
    headerLeft: {},
    headerTitle: {
      fontSize: 24, fontWeight: '800', color: theme.colors.primary, letterSpacing: -0.5,
    },
    headerSub: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 1 },
    themeBtn: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: theme.colors.surfaceVariant,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: theme.colors.border,
    },
    themeBtnText: { fontSize: 18 },

    // Language Card
    langCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 16, padding: 12, marginBottom: 12,
      borderWidth: 1, borderColor: theme.colors.border,
      shadowColor: theme.colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
    },
    langRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    langPickerWrap: { flex: 1 },
    swapBtn: {
      width: 38, height: 38, borderRadius: 19,
      backgroundColor: theme.colors.primary,
      alignItems: 'center', justifyContent: 'center',
      shadowColor: theme.colors.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3, shadowRadius: 4, elevation: 4,
    },
    swapBtnDisabled: { backgroundColor: theme.colors.border, shadowOpacity: 0 },
    swapIcon: { fontSize: 16, color: '#fff', fontWeight: '700' },
    detectedBadge: {
      fontSize: 12, color: theme.colors.primary,
      marginTop: 8, marginLeft: 2,
    },

    // Input Card
    inputCard: {
      backgroundColor: theme.colors.inputBackground,
      borderRadius: 16, padding: 14, marginBottom: 10,
      borderWidth: 1, borderColor: theme.colors.border,
      minHeight: 130,
      shadowColor: theme.colors.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
    },
    inputText: {
      fontSize: 16, color: theme.colors.text,
      minHeight: 80, lineHeight: 24,
    },
    inputFooter: {
      flexDirection: 'row', justifyContent: 'space-between',
      alignItems: 'center', marginTop: 8,
    },
    charCount: { fontSize: 12, color: theme.colors.textPlaceholder },
    inputBtns: { flexDirection: 'row', gap: 8 },
    iconBtn: {
      width: 34, height: 34, borderRadius: 17,
      backgroundColor: theme.colors.surfaceVariant,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: theme.colors.border,
    },
    iconBtnListening: { backgroundColor: '#FEE2E2', borderColor: '#EF4444' },
    iconBtnText: { fontSize: 15 },

    // Translate Button
    translateBtn: {
      backgroundColor: theme.colors.primary,
      borderRadius: 14, paddingVertical: 15,
      alignItems: 'center', marginBottom: 12,
      shadowColor: theme.colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35, shadowRadius: 8, elevation: 6,
    },
    translateBtnDisabled: { opacity: 0.5, shadowOpacity: 0, elevation: 0 },
    translateBtnText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },

    // Output Card
    outputCard: {
      backgroundColor: theme.colors.outputBackground,
      borderRadius: 16, padding: 14, marginBottom: 10,
      borderWidth: 1, borderColor: theme.colors.border,
      minHeight: 100,
    },
    outputHeader: {
      flexDirection: 'row', justifyContent: 'space-between',
      alignItems: 'center', marginBottom: 10,
    },
    outputLangBadge: {
      fontSize: 13, fontWeight: '700', color: theme.colors.primary,
    },
    outputActions: { flexDirection: 'row', gap: 6, alignItems: 'center' },
    actionBtn: {
      width: 32, height: 32, borderRadius: 16,
      backgroundColor: theme.colors.surfaceVariant,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: theme.colors.border,
    },
    actionBtnText: { fontSize: 14 },
    loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
    loadingText: { color: theme.colors.textSecondary, fontSize: 14 },
    outputText: { fontSize: 17, color: theme.colors.text, lineHeight: 26 },

    // Emotion Section
    emotionSection: { marginBottom: 10 },
    sectionLabel: {
      fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary,
      textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8,
    },
  });

export default HomeScreen;
