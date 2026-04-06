import React, { useState, useRef, useCallback } from 'react';
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
} from 'react-native';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import { useTheme } from '../ThemeContext';
import LanguagePicker from '../components/LanguagePicker';
import TTSButton from '../components/TTSButton';
import { translateText } from '../api';
import { TARGET_LANGUAGES, getLanguageByCode } from '../languages';

const CameraScreen = () => {
  const { theme } = useTheme();
  const styles = makeStyles(theme);

  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const cameraRef = useRef(null);

  const [targetLang, setTargetLang] = useState('en');
  const [capturedText, setCapturedText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [capturing, setCapturing] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [showCamera, setShowCamera] = useState(false);

  const handleRequestPermission = async () => {
    const granted = await requestPermission();
    if (granted) {
      setShowCamera(true);
    } else {
      Alert.alert(
        'Camera Permission',
        'Camera access is required for OCR. Please enable it in Settings.'
      );
    }
  };

  const handleCapture = useCallback(async () => {
    if (!cameraRef.current) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePhoto({ qualityPrioritization: 'quality' });
      const filePath = `file://${photo.path}`;

      const result = await TextRecognition.recognize(filePath);
      const extractedText = result.text?.trim() || '';

      if (!extractedText) {
        Alert.alert('No Text Found', 'Could not detect any text in the image. Try again with better lighting.');
        setCapturing(false);
        return;
      }

      setCapturedText(extractedText);
      setShowCamera(false);
      await runTranslation(extractedText);
    } catch (err) {
      Alert.alert('Capture Error', err.message || 'Failed to capture or process image.');
    } finally {
      setCapturing(false);
    }
  }, [targetLang]);

  const runTranslation = async (text) => {
    setTranslating(true);
    setTranslatedText('');
    try {
      const targetLangObj = getLanguageByCode(targetLang);
      const result = await translateText({
        text,
        sourceLang: 'auto',
        targetLang,
        targetLangName: targetLangObj?.name || targetLang,
      });
      setTranslatedText(result.translatedText || '');
    } catch (err) {
      Alert.alert('Translation Error', err.message || 'Could not translate extracted text.');
    } finally {
      setTranslating(false);
    }
  };

  const handleRetranslate = () => {
    if (capturedText.trim()) runTranslation(capturedText);
  };

  const handleCopy = () => {
    if (!translatedText) return;
    Clipboard.setString(translatedText);
    Alert.alert('Copied', 'Translation copied to clipboard.');
  };

  const handleShare = async () => {
    if (!translatedText) return;
    try {
      await Share.share({ message: translatedText });
    } catch (err) {
      Alert.alert('Share Error', err.message);
    }
  };

  const handleReset = () => {
    setCapturedText('');
    setTranslatedText('');
    setShowCamera(false);
  };

  const targetLangObj = getLanguageByCode(targetLang);

  // ─── Permission not granted ──────────────────────────────────────────────────
  if (!hasPermission) {
    return (
      <View style={styles.centered}>
        <Text style={styles.permIcon}>📷</Text>
        <Text style={styles.permTitle}>Camera Access Needed</Text>
        <Text style={styles.permDesc}>
          BharatTranslate needs camera access to scan and translate text from images.
        </Text>
        <TouchableOpacity style={styles.permBtn} onPress={handleRequestPermission}>
          <Text style={styles.permBtnText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─── Camera view ─────────────────────────────────────────────────────────────
  if (showCamera && device) {
    return (
      <View style={styles.cameraContainer}>
        <Camera
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          device={device}
          isActive
          photo
        />
        {/* Overlay frame */}
        <View style={styles.cameraOverlay}>
          <View style={styles.cameraFrame} />
          <Text style={styles.cameraHint}>Position text within the frame</Text>
        </View>
        {/* Controls */}
        <View style={styles.cameraControls}>
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={() => setShowCamera(false)}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Text style={styles.cancelBtnText}>✕</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.captureBtn, capturing && styles.captureBtnDisabled]}
            onPress={handleCapture}
            disabled={capturing}
            accessibilityRole="button"
            accessibilityLabel="Capture photo"
          >
            {capturing ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <View style={styles.captureInner} />
            )}
          </TouchableOpacity>
          <View style={{ width: 48 }} />
        </View>
      </View>
    );
  }

  // ─── Results / Home view ─────────────────────────────────────────────────────
  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.screenTitle}>Camera OCR</Text>
      <Text style={styles.screenSubtitle}>Scan text from any image and translate instantly</Text>

      {/* Language selector */}
      <View style={styles.langRow}>
        <Text style={styles.langLabel}>Translate to:</Text>
        <View style={styles.langPickerWrap}>
          <LanguagePicker
            languages={TARGET_LANGUAGES}
            selectedCode={targetLang}
            onSelect={setTargetLang}
            label="Target Language"
          />
        </View>
      </View>

      {/* Scan button */}
      {!capturedText && (
        <TouchableOpacity
          style={styles.scanBtn}
          onPress={() => setShowCamera(true)}
          accessibilityRole="button"
          accessibilityLabel="Open camera to scan text"
        >
          <Text style={styles.scanBtnIcon}>📷</Text>
          <Text style={styles.scanBtnText}>Scan Text</Text>
        </TouchableOpacity>
      )}

      {/* Extracted text */}
      {capturedText ? (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardLabel}>Extracted Text</Text>
            <TouchableOpacity
              onPress={() => setShowCamera(true)}
              accessibilityRole="button"
              accessibilityLabel="Rescan"
            >
              <Text style={styles.rescanText}>📷 Rescan</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.extractedText} selectable>{capturedText}</Text>
        </View>
      ) : null}

      {/* Translation output */}
      {capturedText ? (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardLabel}>
              Translation → {targetLangObj?.flag} {targetLangObj?.name}
            </Text>
            <TouchableOpacity
              onPress={handleRetranslate}
              disabled={translating}
              accessibilityRole="button"
              accessibilityLabel="Retranslate"
            >
              <Text style={styles.rescanText}>↺ Redo</Text>
            </TouchableOpacity>
          </View>

          {translating ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={theme.colors.primary} />
              <Text style={styles.loadingText}>Translating...</Text>
            </View>
          ) : (
            <Text style={styles.translatedText} selectable>
              {translatedText || '—'}
            </Text>
          )}

          {translatedText ? (
            <View style={styles.outputActions}>
              <TTSButton
                text={translatedText}
                locale={targetLangObj?.ttsLocale}
                disabled={!translatedText}
              />
              <TouchableOpacity
                onPress={handleCopy}
                style={styles.actionBtn}
                accessibilityRole="button"
                accessibilityLabel="Copy"
              >
                <Text style={styles.actionBtnText}>📋 Copy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleShare}
                style={styles.actionBtn}
                accessibilityRole="button"
                accessibilityLabel="Share"
              >
                <Text style={styles.actionBtnText}>↗ Share</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      ) : null}

      {capturedText ? (
        <TouchableOpacity
          style={styles.resetBtn}
          onPress={handleReset}
          accessibilityRole="button"
          accessibilityLabel="Start over"
        >
          <Text style={styles.resetBtnText}>Start Over</Text>
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );
};

const makeStyles = (theme) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      padding: 16,
      paddingBottom: 40,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
      backgroundColor: theme.colors.background,
    },
    permIcon: {
      fontSize: 56,
      marginBottom: 16,
    },
    permTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 10,
      textAlign: 'center',
    },
    permDesc: {
      fontSize: 15,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: 24,
    },
    permBtn: {
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 28,
      paddingVertical: 14,
      borderRadius: 12,
    },
    permBtnText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
    cameraContainer: {
      flex: 1,
      backgroundColor: '#000',
    },
    cameraOverlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cameraFrame: {
      width: 280,
      height: 180,
      borderWidth: 2,
      borderColor: '#FFFFFF',
      borderRadius: 12,
      backgroundColor: 'transparent',
    },
    cameraHint: {
      color: '#FFFFFF',
      fontSize: 14,
      marginTop: 16,
      backgroundColor: 'rgba(0,0,0,0.5)',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
    },
    cameraControls: {
      position: 'absolute',
      bottom: 48,
      left: 0,
      right: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
      paddingHorizontal: 32,
    },
    cancelBtn: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: 'rgba(255,255,255,0.2)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelBtnText: {
      color: '#FFFFFF',
      fontSize: 20,
    },
    captureBtn: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: '#FFFFFF',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 4,
      borderColor: 'rgba(255,255,255,0.5)',
    },
    captureBtnDisabled: {
      opacity: 0.6,
    },
    captureInner: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: '#FFFFFF',
      borderWidth: 2,
      borderColor: '#CCCCCC',
    },
    screenTitle: {
      fontSize: 22,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 4,
    },
    screenSubtitle: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginBottom: 20,
    },
    langRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 20,
      gap: 12,
    },
    langLabel: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      fontWeight: '500',
    },
    langPickerWrap: {
      flex: 1,
    },
    scanBtn: {
      backgroundColor: theme.colors.primary,
      borderRadius: 14,
      paddingVertical: 20,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginBottom: 20,
    },
    scanBtnIcon: {
      fontSize: 36,
    },
    scanBtnText: {
      color: '#FFFFFF',
      fontSize: 18,
      fontWeight: '700',
    },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 14,
      marginBottom: 12,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    cardLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    rescanText: {
      fontSize: 13,
      color: theme.colors.primary,
      fontWeight: '600',
    },
    extractedText: {
      fontSize: 15,
      color: theme.colors.text,
      lineHeight: 22,
    },
    loadingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 8,
    },
    loadingText: {
      color: theme.colors.textSecondary,
      fontSize: 15,
    },
    translatedText: {
      fontSize: 16,
      color: theme.colors.text,
      lineHeight: 24,
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
    },
    actionBtnText: {
      fontSize: 13,
      color: theme.colors.text,
      fontWeight: '500',
    },
    resetBtn: {
      marginTop: 8,
      alignItems: 'center',
      paddingVertical: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    resetBtnText: {
      fontSize: 15,
      color: theme.colors.textSecondary,
      fontWeight: '500',
    },
  });

export default CameraScreen;
