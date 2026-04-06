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
import { translateText, rephraseEmotion } from '../api';
import { SOURCE_LANGUAGES, TARGET_LANGUAGES, getLanguageByCode } from '../languages';

const DEBOUNCE_MS = 900;

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
  const [isListening, setIsListening] = useState(false);
  const [detectedLang, setDetectedLang] = useState(null);

  const debounceTimer = useRef(null);
  const lastTranslated = useRef('');

  // ─── Voice setup ────────────────────────────────────────────────────────────
  useEffect(() => {
    Voice.onSpeechStart = () => setIsListening(true);
    Voice.onSpeechEnd = () => setIsListening(false);
    Voice.onSpeechError = (e) => {
      setIsListening(false);
      Alert.alert('Voice Error', e.error?.message || 'Speech recognition failed.');
    };
    Voice.onSpeechResults = (e) => {
      const result = e.value?.[0] || '';
      if (result) {
        setInputText(result);
        triggerTranslate(result);
      }
    };

    return () => {
      Voice.destroy().then(Voice.removeAllListeners);
    };
  }, [targetLang, sourceLang]);

  // ─── Debounced translation ───────────────────────────────────────────────────
  const triggerTranslate = useCallback(
    (text) => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      if (!text || !text.trim()) {
        setOutputText('');
        setActiveEmotion(null);
        setEmotionText('');
        return;
      }
      debounceTimer.current = setTimeout(() => {
        runTranslation(text);
      }, DEBOUNCE_MS);
    },
    [sourceLang, targetLang]
  );

  const runTranslation = async (text) => {
    if (!text.trim() || text.trim() === lastTranslated.current) return;
    lastTranslated.current = text.trim();
    setTranslating(true);
    setActiveEmotion(null);
    setEmotionText('');
    try {
      const sourceLangObj = getLanguageByCode(sourceLang);
      const targetLangObj = getLanguageByCode(targetLang);
      const result = await translateText({
        text: text.trim(),
        sourceLang,
        targetLang,
        sourceLangName: sourceLangObj?.name || sourceLang,
        targetLangName: targetLangObj?.name || targetLang,
      });
      setOutputText(result.translatedText || '');
      if (result.detectedLang && sourceLang === 'auto') {
        setDetectedLang(result.detectedLang);
      }
    } catch (err) {
      Alert.alert('Translation Error', err.message || 'Could not translate. Check your connection.');
    } finally {
      setTranslating(false);
    }
  };

  const handleInputChange = (text) => {
    setInputText(text);
    triggerTranslate(text);
  };

  // ─── Swap languages ──────────────────────────────────────────────────────────
  const handleSwap = () => {
    if (sourceLang === 'auto') return;
    const prevSource = sourceLang;
    const prevTarget = targetLang;
    const prevOutput = outputText;
    setSourceLang(prevTarget);
    setTargetLang(prevSource);
    setInputText(prevOutput);
    setOutputText('');
    setActiveEmotion(null);
    setEmotionText('');
    lastTranslated.current = '';
    if (prevOutput.trim()) {
      setTimeout(() => runTranslation(prevOutput), 100);
    }
  };

  // ─── Voice input ─────────────────────────────────────────────────────────────
  const handleVoice = async () => {
    try {
      if (isListening) {
        await Voice.stop();
        return;
      }
      const locale = getLanguageByCode(sourceLang)?.ttsLocale || 'en-US';
      await Voice.start(locale);
    } catch (err) {
      Alert.alert('Voice Error', err.message || 'Could not start voice input.');
    }
  };

  // ─── Emotion rephrasing ──────────────────────────────────────────────────────
  const handleEmotion = async (emotion) => {
    if (!outputText.trim()) {
      Alert.alert('No translation', 'Translate some text first.');
      return;
    }
    if (activeEmotion === emotion) {
      setActiveEmotion(null);
      setEmotionText('');
      return;
    }
    setEmotionLoading(true);
    setActiveEmotion(emotion);
    try {
      const result = await rephraseEmotion({ text: outputText, emotion });
      setEmotionText(result.rephrasedText || '');
    } catch (err) {
      setActiveEmotion(null);
      Alert.alert('Emotion Error', err.message || 'Could not rephrase. Check OpenAI key.');
    } finally {
      setEmotionLoading(false);
    }
  };

  // ─── Copy & Share ────────────────────────────────────────────────────────────
  const handleCopy = () => {
    const text = emotionText || outputText;
    if (!text) return;
    Clipboard.setString(text);
    Alert.alert('Copied', 'Translation copied to clipboard.');
  };

  const handleShare = async () => {
    const text = emotionText || outputText;
    if (!text) return;
    try {
      await Share.share({ message: text });
    } catch (err) {
      Alert.alert('Share Error', err.message);
    }
  };

  const handleClearInput = () => {
    setInputText('');
    setOutputText('');
    setActiveEmotion(null);
    setEmotionText('');
    setDetectedLang(null);
    lastTranslated.current = '';
  };

  const displayOutput = emotionText || outputText;
  const targetLangObj = getLanguageByCode(targetLang);

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>BharatTranslate</Text>
          <TouchableOpacity
            onPress={toggleTheme}
            style={styles.themeBtn}
            accessibilityRole="button"
            accessibilityLabel="Toggle theme"
          >
            <Text style={styles.themeBtnText}>{isDark ? '☀️' : '🌙'}</Text>
          </TouchableOpacity>
        </View>

        {/* Language Picker Row */}
        <View style={styles.langRow}>
          <LanguagePicker
            languages={SOURCE_LANGUAGES}
            selectedCode={sourceLang}
            onSelect={(code) => {
              setSourceLang(code);
              setDetectedLang(null);
              lastTranslated.current = '';
              if (inputText.trim()) setTimeout(() => runTranslation(inputText), 100);
            }}
            label="From"
          />
          <TouchableOpacity
            style={[styles.swapBtn, sourceLang === 'auto' && styles.swapBtnDisabled]}
            onPress={handleSwap}
            disabled={sourceLang === 'auto'}
            accessibilityRole="button"
            accessibilityLabel="Swap languages"
          >
            <Text style={styles.swapBtnText}>⇄</Text>
          </TouchableOpacity>
          <LanguagePicker
            languages={TARGET_LANGUAGES}
            selectedCode={targetLang}
            onSelect={(code) => {
              setTargetLang(code);
              lastTranslated.current = '';
              if (inputText.trim()) setTimeout(() => runTranslation(inputText), 100);
            }}
            label="To"
          />
        </View>

        {/* Detected language badge */}
        {detectedLang && sourceLang === 'auto' && (
          <Text style={styles.detectedBadge}>
            Detected: {getLanguageByCode(detectedLang)?.name || detectedLang}
          </Text>
        )}

        {/* Input Box */}
        <View style={styles.inputCard}>
          <TextInput
            style={styles.inputText}
            placeholder="Enter text to translate..."
            placeholderTextColor={theme.colors.textPlaceholder}
            value={inputText}
            onChangeText={handleInputChange}
            multiline
            maxLength={2000}
            textAlignVertical="top"
            accessibilityLabel="Input text"
          />
          <View style={styles.inputActions}>
            <Text style={styles.charCount}>{inputText.length}/2000</Text>
            <View style={styles.inputBtns}>
              {inputText.length > 0 && (
                <TouchableOpacity
                  onPress={handleClearInput}
                  style={styles.iconBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Clear input"
                >
                  <Text style={styles.iconBtnText}>✕</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={handleVoice}
                style={[styles.iconBtn, isListening && styles.iconBtnActive]}
                accessibilityRole="button"
                accessibilityLabel={isListening ? 'Stop listening' : 'Start voice input'}
              >
                <Text style={styles.iconBtnText}>{isListening ? '⏹' : '🎤'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Output Box */}
        <View style={styles.outputCard}>
          {translating ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={theme.colors.primary} />
              <Text style={styles.loadingText}>Translating...</Text>
            </View>
          ) : (
            <Text
              style={[styles.outputText, !displayOutput && styles.outputPlaceholder]}
              selectable
            >
              {displayOutput || 'Translation will appear here'}
            </Text>
          )}

          {emotionText ? (
            <View style={styles.emotionBadge}>
              <Text style={styles.emotionBadgeText}>
                {activeEmotion === 'love' ? '❤️' : activeEmotion === 'sad' ? '😢' : activeEmotion === 'angry' ? '😡' : '😄'}{' '}
                {activeEmotion} tone
              </Text>
            </View>
          ) : null}

          {displayOutput ? (
            <View style={styles.outputActions}>
              <TTSButton
                text={displayOutput}
                locale={targetLangObj?.ttsLocale}
                disabled={!displayOutput}
              />
              <TouchableOpacity
                onPress={handleCopy}
                style={styles.actionBtn}
                accessibilityRole="button"
                accessibilityLabel="Copy translation"
              >
                <Text style={styles.actionBtnText}>📋 Copy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleShare}
                style={styles.actionBtn}
                accessibilityRole="button"
                accessibilityLabel="Share translation"
              >
                <Text style={styles.actionBtnText}>↗ Share</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        {/* Emotion Selector */}
        <EmotionSelector
          onSelect={handleEmotion}
          activeEmotion={activeEmotion}
          loading={emotionLoading}
          disabled={!outputText.trim() || translating}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const makeStyles = (theme) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      padding: 16,
      paddingBottom: 32,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    headerTitle: {
      fontSize: 22,
      fontWeight: '700',
      color: theme.colors.primary,
      letterSpacing: -0.5,
    },
    themeBtn: {
      padding: 8,
      borderRadius: 20,
      backgroundColor: theme.colors.surfaceVariant,
    },
    themeBtnText: {
      fontSize: 18,
    },
    langRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8,
    },
    swapBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    swapBtnDisabled: {
      backgroundColor: theme.colors.border,
    },
    swapBtnText: {
      fontSize: 18,
      color: '#FFFFFF',
      fontWeight: '700',
    },
    detectedBadge: {
      fontSize: 12,
      color: theme.colors.primary,
      marginBottom: 8,
      marginLeft: 4,
    },
    inputCard: {
      backgroundColor: theme.colors.inputBackground,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 14,
      marginBottom: 10,
      minHeight: 130,
      shadowColor: theme.colors.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
    },
    inputText: {
      fontSize: 16,
      color: theme.colors.text,
      minHeight: 80,
      lineHeight: 24,
    },
    inputActions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 8,
    },
    charCount: {
      fontSize: 12,
      color: theme.colors.textPlaceholder,
    },
    inputBtns: {
      flexDirection: 'row',
      gap: 8,
    },
    iconBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.colors.surfaceVariant,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconBtnActive: {
      backgroundColor: '#FFEBEE',
    },
    iconBtnText: {
      fontSize: 16,
    },
    outputCard: {
      backgroundColor: theme.colors.outputBackground,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 14,
      marginBottom: 10,
      minHeight: 130,
    },
    loadingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      minHeight: 80,
    },
    loadingText: {
      color: theme.colors.textSecondary,
      fontSize: 15,
    },
    outputText: {
      fontSize: 16,
      color: theme.colors.text,
      lineHeight: 24,
      minHeight: 80,
    },
    outputPlaceholder: {
      color: theme.colors.textPlaceholder,
    },
    emotionBadge: {
      alignSelf: 'flex-start',
      backgroundColor: theme.colors.primaryLight,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 4,
      marginTop: 8,
    },
    emotionBadgeText: {
      fontSize: 12,
      color: theme.colors.primary,
      fontWeight: '600',
      textTransform: 'capitalize',
    },
    outputActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 12,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: theme.colors.divider,
    },
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 8,
      backgroundColor: theme.colors.surfaceVariant,
      gap: 4,
    },
    actionBtnText: {
      fontSize: 13,
      color: theme.colors.text,
      fontWeight: '500',
    },
  });

export default HomeScreen;
