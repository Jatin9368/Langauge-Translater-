import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, ScrollView, ActivityIndicator, Share, Clipboard, Image,
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
  const [step, setStep] = useState(''); // 'scanning' | 'translating'

  const targetLangObj = getLanguageByCode(targetLang);

  const processImage = async (uri) => {
    setProcessing(true);
    setStep('scanning');
    setDetectedText('');
    setTranslatedText('');
    setCapturedUri(uri);

    try {
      const result = await TextRecognition.recognize(uri);
      const extracted = result.text?.trim() || '';

      if (!extracted) {
        Alert.alert('Text Nahi Mila', 'Image mein koi text detect nahi hua. Doosri image try karo.');
        setProcessing(false);
        setCapturedUri(null);
        return;
      }

      setDetectedText(extracted);
      setStep('translating');

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
      setStep('');
    }
  };

  const handleCamera = () => {
    launchCamera(
      {
        mediaType: 'photo',
        quality: 0.9,
        saveToPhotos: false,
        cameraType: 'back',
        includeBase64: false,
      },
      (response) => {
        if (response.didCancel) return;
        if (response.errorCode) {
          if (response.errorCode === 'camera_unavailable') {
            Alert.alert('Camera Unavailable', 'Camera is not available on this device.');
          } else if (response.errorCode === 'permission') {
            Alert.alert(
              'Permission Required',
              'Camera permission chahiye. Settings mein jaake Camera allow karo.',
              [{ text: 'OK' }]
            );
          } else {
            Alert.alert('Error', response.errorMessage || 'Camera error.');
          }
          return;
        }
        const uri = response.assets?.[0]?.uri;
        if (uri) processImage(uri);
      }
    );
  };

  const handleGallery = () => {
    launchImageLibrary({ mediaType: 'photo', quality: 0.9 }, (response) => {
      if (response.didCancel || response.errorCode) return;
      const uri = response.assets?.[0]?.uri;
      if (uri) processImage(uri);
    });
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
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📷 Bharat Lens</Text>
        <Text style={styles.headerSub}>Photo se text scan karo aur translate karo</Text>
      </View>

      {/* Language Selector */}
      <View style={styles.langCard}>
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

      {/* Action Buttons */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.cameraBtn]}
          onPress={handleCamera}
          disabled={processing}
        >
          <Text style={styles.actionIcon}>📷</Text>
          <Text style={styles.actionLabel}>Camera</Text>
          <Text style={styles.actionSub}>Photo lo</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, styles.galleryBtn]}
          onPress={handleGallery}
          disabled={processing}
        >
          <Text style={styles.actionIcon}>🖼️</Text>
          <Text style={styles.actionLabel}>Gallery</Text>
          <Text style={styles.actionSub}>Image chuno</Text>
        </TouchableOpacity>
      </View>

      {/* Processing */}
      {processing && (
        <View style={styles.processingCard}>
          <ActivityIndicator color={theme.colors.primary} size="large" />
          <Text style={styles.processingText}>
            {step === 'scanning' ? '🔍 Text scan ho raha hai...' : '⚡ Translate ho raha hai...'}
          </Text>
        </View>
      )}

      {/* Image Preview */}
      {capturedUri && !processing && (
        <View style={styles.imageCard}>
          <Image source={{ uri: capturedUri }} style={styles.previewImage} resizeMode="cover" />
        </View>
      )}

      {/* Detected Text */}
      {detectedText && !processing && (
        <View style={styles.resultCard}>
          <Text style={styles.resultLabel}>📝 Detected Text</Text>
          <Text style={styles.detectedText} selectable>{detectedText}</Text>
        </View>
      )}

      {/* Translated Text */}
      {translatedText && !processing && (
        <View style={[styles.resultCard, styles.translatedCard]}>
          <View style={styles.translatedHeader}>
            <Text style={styles.resultLabel}>
              {targetLangObj?.flag} Translation — {targetLangObj?.name}
            </Text>
            <TTSButton
              text={translatedText}
              locale={targetLangObj?.ttsLocale}
              disabled={false}
              emotion="normal"
            />
          </View>
          <Text style={styles.translatedText} selectable>{translatedText}</Text>
          <View style={styles.outputActions}>
            <TouchableOpacity
              onPress={() => { Clipboard.setString(translatedText); Alert.alert('Copied!'); }}
              style={styles.outBtn}
            >
              <Text style={styles.outBtnText}>📋 Copy</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={async () => { try { await Share.share({ message: translatedText }); } catch (e) {} }}
              style={styles.outBtn}
            >
              <Text style={styles.outBtnText}>↗ Share</Text>
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

    header: { marginBottom: 20, paddingTop: 4 },
    headerTitle: { fontSize: 24, fontWeight: '800', color: theme.colors.primary },
    headerSub: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 2 },

    langCard: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: theme.colors.surface, borderRadius: 14,
      padding: 12, marginBottom: 16,
      borderWidth: 1, borderColor: theme.colors.border,
    },
    langLabel: { fontSize: 14, color: theme.colors.textSecondary, fontWeight: '500' },
    langPickerWrap: { flex: 1 },

    actionRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
    actionBtn: {
      flex: 1, borderRadius: 16, paddingVertical: 22,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 1,
    },
    cameraBtn: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
      shadowColor: theme.colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
    },
    galleryBtn: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
    },
    actionIcon: { fontSize: 34, marginBottom: 6 },
    actionLabel: {
      fontSize: 15, fontWeight: '700',
      color: theme.colors.text,
    },
    actionSub: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },

    processingCard: {
      backgroundColor: theme.colors.surface, borderRadius: 14,
      padding: 24, alignItems: 'center', gap: 12, marginBottom: 12,
      borderWidth: 1, borderColor: theme.colors.border,
    },
    processingText: { fontSize: 15, color: theme.colors.textSecondary },

    imageCard: {
      borderRadius: 14, overflow: 'hidden', marginBottom: 12,
      borderWidth: 1, borderColor: theme.colors.border,
    },
    previewImage: { width: '100%', height: 200 },

    resultCard: {
      backgroundColor: theme.colors.surface, borderRadius: 14,
      borderWidth: 1, borderColor: theme.colors.border,
      padding: 14, marginBottom: 12,
    },
    translatedCard: {
      borderColor: theme.colors.primary, borderWidth: 1.5,
    },
    resultLabel: {
      fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary,
      textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8,
    },
    translatedHeader: {
      flexDirection: 'row', justifyContent: 'space-between',
      alignItems: 'center', marginBottom: 8,
    },
    detectedText: { fontSize: 14, color: theme.colors.textSecondary, lineHeight: 20 },
    translatedText: { fontSize: 16, color: theme.colors.text, lineHeight: 24 },

    outputActions: {
      flexDirection: 'row', gap: 8, marginTop: 12,
      paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.colors.divider,
    },
    outBtn: {
      paddingHorizontal: 14, paddingVertical: 8,
      borderRadius: 10, backgroundColor: theme.colors.surfaceVariant,
      borderWidth: 1, borderColor: theme.colors.border,
    },
    outBtnText: { fontSize: 13, color: theme.colors.text, fontWeight: '500' },

    resetBtn: {
      alignItems: 'center', paddingVertical: 14,
      borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border,
    },
    resetBtnText: { fontSize: 15, color: theme.colors.primary, fontWeight: '600' },
  });

export default CameraScreen;
