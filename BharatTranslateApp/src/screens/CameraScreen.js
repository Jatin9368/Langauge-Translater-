import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
  Share,
  Clipboard,
  Image,
} from 'react-native';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import { useTheme } from '../ThemeContext';
import LanguagePicker from '../components/LanguagePicker';
import TTSButton from '../components/TTSButton';
import { translateText } from '../api';
import { TARGET_LANGUAGES, getLanguageByCode } from '../languages';

const CameraScreen = () => {
  const { theme } = useTheme();
  const styles = makeStyles(theme);

  const [targetLang, setTargetLang] = useState('hi');
  const [capturedUri, setCapturedUri] = useState(null);
  const [detectedText, setDetectedText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [processing, setProcessing] = useState(false);

  const targetLangObj = getLanguageByCode(targetLang);

  const processImage = async (uri) => {
    setProcessing(true);
    setDetectedText('');
    setTranslatedText('');
    setCapturedUri(uri);

    try {
      // Step 1: ML Kit se text extract karo
      const result = await TextRecognition.recognize(uri);
      const extracted = result.text?.trim() || '';

      if (!extracted) {
        Alert.alert('Text Nahi Mila', 'Is image mein koi text detect nahi hua. Doosri image try karo.');
        setProcessing(false);
        return;
      }

      setDetectedText(extracted);

      // Step 2: Translate karo
      const res = await translateText({
        text: extracted,
        sourceLang: 'auto',
        targetLang,
        targetLangName: targetLangObj?.name || targetLang,
        saveHistory: true,
      });

      setTranslatedText(res.translatedText || '');
    } catch (err) {
      Alert.alert('Error', err.message || 'Image process nahi ho saki.');
    } finally {
      setProcessing(false);
    }
  };

  const handleCamera = () => {
    launchCamera(
      {
        mediaType: 'photo',
        quality: 0.8,
        saveToPhotos: false,
      },
      (response) => {
        if (response.didCancel || response.errorCode) return;
        const uri = response.assets?.[0]?.uri;
        if (uri) processImage(uri);
      }
    );
  };

  const handleGallery = () => {
    launchImageLibrary(
      { mediaType: 'photo', quality: 0.8 },
      (response) => {
        if (response.didCancel || response.errorCode) return;
        const uri = response.assets?.[0]?.uri;
        if (uri) processImage(uri);
      }
    );
  };

  const handleCopy = () => {
    if (!translatedText) return;
    Clipboard.setString(translatedText);
    Alert.alert('Copied!', 'Translation copy ho gayi.');
  };

  const handleShare = async () => {
    if (!translatedText) return;
    try { await Share.share({ message: translatedText }); } catch (e) {}
  };

  const handleReset = () => {
    setCapturedUri(null);
    setDetectedText('');
    setTranslatedText('');
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Brand header */}
      <View style={styles.brandHeader}>
        <Text style={styles.brandIcon}>🔍</Text>
        <View>
          <Text style={styles.brandTitle}>Bharat Lens</Text>
          <Text style={styles.brandSubtitle}>Photo lo ya gallery se chunno — text translate ho jaayega</Text>
        </View>
      </View>

      {/* Language selector */}
      <View style={styles.langRow}>
        <Text style={styles.langLabel}>Translate to:</Text>
        <View style={styles.langPickerWrap}>
          <LanguagePicker
            languages={TARGET_LANGUAGES}
            selectedCode={targetLang}
            onSelect={(code) => { setTargetLang(code); setTranslatedText(''); }}
            label="Target Language"
          />
        </View>
      </View>

      {/* Action buttons */}
      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.cameraBtn} onPress={handleCamera} disabled={processing}>
          <Text style={styles.actionIcon}>📷</Text>
          <Text style={styles.actionLabel}>Camera</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.galleryBtn} onPress={handleGallery} disabled={processing}>
          <Text style={styles.actionIcon}>🖼️</Text>
          <Text style={styles.actionLabel}>Gallery</Text>
        </TouchableOpacity>
      </View>

      {/* Processing indicator */}
      {processing && (
        <View style={styles.processingCard}>
          <ActivityIndicator color={theme.colors.primary} size="large" />
          <Text style={styles.processingText}>
            {detectedText ? '⚡ Translating...' : '🔍 Text scan ho raha hai...'}
          </Text>
        </View>
      )}

      {/* Captured image preview */}
      {capturedUri && !processing && (
        <View style={styles.imageCard}>
          <Image source={{ uri: capturedUri }} style={styles.previewImage} resizeMode="cover" />
        </View>
      )}

      {/* Detected text */}
      {detectedText && !processing && (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>📝 Detected Text</Text>
          <Text style={styles.detectedText} selectable>{detectedText}</Text>
        </View>
      )}

      {/* Translated text */}
      {translatedText && !processing && (
        <View style={[styles.card, styles.translatedCard]}>
          <Text style={styles.cardLabel}>
            {targetLangObj?.flag} Translation — {targetLangObj?.name}
          </Text>
          <Text style={styles.translatedText} selectable>{translatedText}</Text>
          <View style={styles.outputActions}>
            <TTSButton
              text={translatedText}
              locale={targetLangObj?.ttsLocale}
              disabled={false}
              emotion="normal"
            />
            <TouchableOpacity onPress={handleCopy} style={styles.actionBtn}>
              <Text style={styles.actionBtnText}>📋 Copy</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleShare} style={styles.actionBtn}>
              <Text style={styles.actionBtnText}>↗ Share</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Reset */}
      {(detectedText || capturedUri) && !processing && (
        <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
          <Text style={styles.resetBtnText}>🔄 Naya Scan</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
};

const makeStyles = (theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.colors.background },
    content: { padding: 16, paddingBottom: 40 },

    brandHeader: {
      flexDirection: 'row', alignItems: 'center',
      gap: 12, marginBottom: 20,
    },
    brandIcon: { fontSize: 40 },
    brandTitle: {
      fontSize: 22, fontWeight: '800', color: theme.colors.primary,
    },
    brandSubtitle: {
      fontSize: 12, color: theme.colors.textSecondary, marginTop: 2,
    },

    langRow: {
      flexDirection: 'row', alignItems: 'center',
      marginBottom: 20, gap: 12,
    },
    langLabel: {
      fontSize: 14, color: theme.colors.textSecondary, fontWeight: '500',
    },
    langPickerWrap: { flex: 1 },

    actionRow: {
      flexDirection: 'row', gap: 12, marginBottom: 16,
    },
    cameraBtn: {
      flex: 1, backgroundColor: theme.colors.primary,
      borderRadius: 14, paddingVertical: 20,
      alignItems: 'center', justifyContent: 'center',
      elevation: 3,
    },
    galleryBtn: {
      flex: 1, backgroundColor: theme.colors.surfaceVariant,
      borderRadius: 14, paddingVertical: 20,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: theme.colors.border,
    },
    actionIcon: { fontSize: 32, marginBottom: 6 },
    actionLabel: {
      fontSize: 15, fontWeight: '700',
      color: theme.colors.text,
    },

    processingCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 14, padding: 24,
      alignItems: 'center', gap: 12,
      marginBottom: 12,
      borderWidth: 1, borderColor: theme.colors.border,
    },
    processingText: {
      fontSize: 15, color: theme.colors.textSecondary,
    },

    imageCard: {
      borderRadius: 14, overflow: 'hidden',
      marginBottom: 12, borderWidth: 1,
      borderColor: theme.colors.border,
    },
    previewImage: {
      width: '100%', height: 200,
    },

    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: 14, borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 14, marginBottom: 12,
    },
    translatedCard: {
      borderColor: theme.colors.primary,
      borderWidth: 1.5,
    },
    cardLabel: {
      fontSize: 12, fontWeight: '700',
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5, marginBottom: 8,
    },
    detectedText: {
      fontSize: 14, color: theme.colors.textSecondary, lineHeight: 20,
    },
    translatedText: {
      fontSize: 16, color: theme.colors.text, lineHeight: 24,
    },
    outputActions: {
      flexDirection: 'row', alignItems: 'center',
      gap: 8, marginTop: 12, paddingTop: 10,
      borderTopWidth: 1, borderTopColor: theme.colors.divider,
    },
    actionBtn: {
      paddingHorizontal: 12, paddingVertical: 7,
      borderRadius: 8, backgroundColor: theme.colors.surfaceVariant,
    },
    actionBtnText: {
      fontSize: 13, color: theme.colors.text, fontWeight: '500',
    },
    resetBtn: {
      alignItems: 'center', paddingVertical: 14,
      borderRadius: 12, borderWidth: 1,
      borderColor: theme.colors.border, marginTop: 4,
    },
    resetBtnText: {
      fontSize: 15, color: theme.colors.primary, fontWeight: '600',
    },
  });

export default CameraScreen;
