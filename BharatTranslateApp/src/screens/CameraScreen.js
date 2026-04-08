import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, ScrollView, ActivityIndicator, Share, Clipboard, Image,
  PermissionsAndroid, Platform,
} from 'react-native';
import ImageCropPicker from 'react-native-image-crop-picker';
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
  const [step, setStep] = useState('');

  const targetLangObj = getLanguageByCode(targetLang);

  const CROP_OPTIONS = {
    cropping: true,
    cropperToolbarTitle: 'Crop text area',
    cropperActiveWidgetColor: '#4F46E5',
    cropperStatusBarColor: '#4F46E5',
    cropperToolbarColor: '#4F46E5',
    cropperToolbarWidgetColor: '#FFFFFF',
    includeBase64: false,
    compressImageQuality: 0.9,
    freeStyleCropEnabled: true,
    cropperChooseText: 'Translate',
    cropperCancelText: 'Cancel',
  };

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
        Alert.alert(
          'No Text Found',
          'No text detected in this area.\n\nTips:\n- Text should be clearly visible\n- Take photo in good lighting\n- Text should be large enough'
        );
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
      Alert.alert('Error', err.message || 'Could not process image.');
      setCapturedUri(null);
    } finally {
      setProcessing(false);
      setStep('');
    }
  };

  const requestCameraPermission = async () => {
    if (Platform.OS !== 'android') return true;
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
        {
          title: 'Camera Permission',
          message: 'BharatTranslate needs camera access to scan text.',
          buttonPositive: 'Allow',
          buttonNegative: 'Deny',
        }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (e) {
      return false;
    }
  };

  const handleCamera = async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) {
      Alert.alert('Permission Denied', 'Camera permission is required. Please allow it in Settings.');
      return;
    }
    try {
      const image = await ImageCropPicker.openCamera({
        ...CROP_OPTIONS,
        useFrontCamera: false,
      });
      if (image?.path) processImage(`file://${image.path}`);
    } catch (err) {
      if (err.code !== 'E_PICKER_CANCELLED') {
        Alert.alert('Camera Error', err.message || 'Could not open camera.');
      }
    }
  };

  const handleGallery = async () => {
    try {
      const image = await ImageCropPicker.openPicker({ ...CROP_OPTIONS });
      if (image?.path) processImage(`file://${image.path}`);
    } catch (err) {
      if (err.code !== 'E_PICKER_CANCELLED') {
        Alert.alert('Gallery Error', err.message || 'Could not open gallery.');
      }
    }
  };

  const handleReset = () => {
    setCapturedUri(null);
    setDetectedText('');
    setTranslatedText('');
    ImageCropPicker.clean().catch(() => {});
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Bharat Lens</Text>
        <Text style={styles.headerSub}>Take a photo, crop the text, get translation</Text>
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
          <Text style={styles.actionSub}>Photo + Crop</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, styles.galleryBtn]}
          onPress={handleGallery}
          disabled={processing}
        >
          <Text style={styles.actionIcon}>🖼️</Text>
          <Text style={styles.actionLabel}>Gallery</Text>
          <Text style={styles.actionSub}>Image + Crop</Text>
        </TouchableOpacity>
      </View>

      {/* Info */}
      <View style={styles.infoCard}>
        <Text style={styles.infoText}>
          ✂️ After taking a photo, crop only the area with text — it will be translated automatically
        </Text>
      </View>

      {/* Processing */}
      {processing && (
        <View style={styles.processingCard}>
          <ActivityIndicator color={theme.colors.primary} size="large" />
          <Text style={styles.processingText}>
            {step === 'scanning' ? 'Scanning text...' : 'Translating...'}
          </Text>
        </View>
      )}

      {/* Image Preview + Translation + Cross */}
      {capturedUri && !processing && (
        <View style={styles.resultWrapper}>
          {/* Cross button */}
          <TouchableOpacity style={styles.crossBtn} onPress={handleReset}>
            <Text style={styles.crossBtnText}>✕</Text>
          </TouchableOpacity>

          {/* Image */}
          <View style={styles.imageCard}>
            <Image source={{ uri: capturedUri }} style={styles.previewImage} resizeMode="contain" />
          </View>

          {/* Translation only */}
          {translatedText ? (
            <View style={styles.translatedCard}>
              <Text style={styles.translatedLang}>
                {targetLangObj?.flag} {targetLangObj?.name}
              </Text>
              <Text style={styles.translatedText} selectable>{translatedText}</Text>
              <View style={styles.outputActions}>
                <TTSButton text={translatedText} locale={targetLangObj?.ttsLocale} disabled={false} emotion="normal" />
                <TouchableOpacity
                  onPress={() => { Clipboard.setString(translatedText); Alert.alert('Copied!'); }}
                  style={styles.outBtn}
                >
                  <Text style={styles.outBtnText}>Copy</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={async () => { try { await Share.share({ message: translatedText }); } catch (e) {} }}
                  style={styles.outBtn}
                >
                  <Text style={styles.outBtnText}>Share</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
        </View>
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

    actionRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
    actionBtn: {
      flex: 1, borderRadius: 16, paddingVertical: 22,
      alignItems: 'center', justifyContent: 'center', borderWidth: 1,
    },
    cameraBtn: {
      backgroundColor: theme.colors.primary, borderColor: theme.colors.primary,
      shadowColor: theme.colors.primary, shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
    },
    galleryBtn: { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
    actionIcon: { fontSize: 34, marginBottom: 6 },
    actionLabel: { fontSize: 15, fontWeight: '700', color: theme.colors.text },
    actionSub: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },

    infoCard: {
      backgroundColor: theme.colors.primaryLight, borderRadius: 12,
      padding: 12, marginBottom: 16, borderWidth: 1, borderColor: theme.colors.border,
    },
    infoText: { fontSize: 13, color: theme.colors.textSecondary, lineHeight: 20 },

    processingCard: {
      backgroundColor: theme.colors.surface, borderRadius: 14,
      padding: 24, alignItems: 'center', gap: 12, marginBottom: 12,
      borderWidth: 1, borderColor: theme.colors.border,
    },
    processingText: { fontSize: 15, color: theme.colors.textSecondary },

    imageCard: {
      borderRadius: 14, overflow: 'hidden', marginBottom: 12,
      borderWidth: 1, borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    previewImage: { width: '100%', height: 220 },

    resultWrapper: {
      position: 'relative',
      marginBottom: 12,
    },
    crossBtn: {
      position: 'absolute',
      top: 8, right: 8,
      zIndex: 10,
      width: 32, height: 32, borderRadius: 16,
      backgroundColor: 'rgba(0,0,0,0.6)',
      alignItems: 'center', justifyContent: 'center',
    },
    crossBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

    translatedCard: {
      backgroundColor: theme.colors.surface, borderRadius: 14,
      borderWidth: 1.5, borderColor: theme.colors.primary,
      padding: 14,
    },
    translatedLang: {
      fontSize: 12, fontWeight: '700', color: theme.colors.primary,
      textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8,
    },
    translatedText: { fontSize: 16, color: theme.colors.text, lineHeight: 24 },

    outputActions: {
      flexDirection: 'row', gap: 8, marginTop: 12,
      paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.colors.divider,
    },
    outBtn: {
      paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
      backgroundColor: theme.colors.surfaceVariant,
      borderWidth: 1, borderColor: theme.colors.border,
    },
    outBtnText: { fontSize: 13, color: theme.colors.text, fontWeight: '500' },

    resetBtn: {
      alignItems: 'center', paddingVertical: 14,
      borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border,
    },
    resetBtnText: { fontSize: 15, color: theme.colors.primary, fontWeight: '600' },  });

export default CameraScreen;
