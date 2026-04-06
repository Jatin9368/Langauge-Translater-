import React, { useState, useRef, useCallback, useEffect } from 'react';
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
  Dimensions,
} from 'react-native';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import { useTheme } from '../ThemeContext';
import LanguagePicker from '../components/LanguagePicker';
import TTSButton from '../components/TTSButton';
import { translateText } from '../api';
import { TARGET_LANGUAGES, getLanguageByCode } from '../languages';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SCAN_INTERVAL = 2500; // har 2.5 sec mein auto scan

const CameraScreen = () => {
  const { theme } = useTheme();
  const styles = makeStyles(theme);

  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const cameraRef = useRef(null);

  const [targetLang, setTargetLang] = useState('hi');
  const [lensActive, setLensActive] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [translating, setTranslating] = useState(false);

  const [detectedText, setDetectedText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [lastScannedText, setLastScannedText] = useState('');

  const scanTimerRef = useRef(null);
  const isProcessingRef = useRef(false);

  // Auto scan loop
  useEffect(() => {
    if (lensActive) {
      startScanLoop();
    } else {
      stopScanLoop();
    }
    return () => stopScanLoop();
  }, [lensActive, targetLang]);

  const startScanLoop = () => {
    stopScanLoop();
    scanTimerRef.current = setInterval(() => {
      if (!isProcessingRef.current) {
        captureAndTranslate();
      }
    }, SCAN_INTERVAL);
  };

  const stopScanLoop = () => {
    if (scanTimerRef.current) {
      clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
    }
  };

  const captureAndTranslate = useCallback(async () => {
    if (!cameraRef.current || isProcessingRef.current) return;
    isProcessingRef.current = true;
    setScanning(true);

    try {
      const photo = await cameraRef.current.takePhoto({
        qualityPrioritization: 'speed',
        flash: 'off',
      });

      const filePath = `file://${photo.path}`;
      const result = await TextRecognition.recognize(filePath);
      const extracted = result.text?.trim() || '';

      if (!extracted) {
        setScanning(false);
        isProcessingRef.current = false;
        return;
      }

      // Same text dobara translate mat karo
      if (extracted === lastScannedText) {
        setScanning(false);
        isProcessingRef.current = false;
        return;
      }

      setLastScannedText(extracted);
      setDetectedText(extracted);
      setTranslating(true);

      const targetLangObj = getLanguageByCode(targetLang);
      const res = await translateText({
        text: extracted,
        sourceLang: 'auto',
        targetLang,
        targetLangName: targetLangObj?.name || targetLang,
        saveHistory: false,
      });

      setTranslatedText(res.translatedText || '');
    } catch (err) {
      console.log('Scan error:', err.message);
    } finally {
      setScanning(false);
      setTranslating(false);
      isProcessingRef.current = false;
    }
  }, [targetLang, lastScannedText]);

  const handleManualCapture = async () => {
    setLastScannedText(''); // force re-translate
    await captureAndTranslate();
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
    setDetectedText('');
    setTranslatedText('');
    setLastScannedText('');
    setLensActive(false);
  };

  const targetLangObj = getLanguageByCode(targetLang);

  // ─── Permission screen ────────────────────────────────────────────────────────
  if (!hasPermission) {
    return (
      <View style={styles.centered}>
        <Text style={styles.lensLogo}>🔍</Text>
        <Text style={styles.lensTitle}>Bharat Lens</Text>
        <Text style={styles.permDesc}>
          Camera access chahiye taaki text scan aur translate ho sake.
        </Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Camera Allow Karo</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─── Live Lens View ───────────────────────────────────────────────────────────
  if (lensActive && device) {
    return (
      <View style={styles.lensContainer}>
        <Camera
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          device={device}
          isActive
          photo
        />

        {/* Top bar */}
        <View style={styles.lensTopBar}>
          <Text style={styles.lensBrandText}>🔍 Bharat Lens</Text>
          <View style={styles.lensLangBadge}>
            <Text style={styles.lensLangText}>
              → {targetLangObj?.flag} {targetLangObj?.name}
            </Text>
          </View>
        </View>

        {/* Scan frame */}
        <View style={styles.scanFrameContainer}>
          <View style={styles.scanFrame}>
            {/* Corner decorations */}
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </View>
          <Text style={styles.scanHint}>
            {scanning ? '🔍 Scanning...' : translating ? '⚡ Translating...' : 'Text ke upar camera rakho'}
          </Text>
        </View>

        {/* Translation overlay — neeche */}
        {(detectedText || translatedText) && (
          <View style={styles.overlayCard}>
            {detectedText ? (
              <Text style={styles.overlayOriginal} numberOfLines={2}>
                📝 {detectedText}
              </Text>
            ) : null}
            {translating ? (
              <View style={styles.overlayLoading}>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.overlayLoadingText}>Translating...</Text>
              </View>
            ) : translatedText ? (
              <Text style={styles.overlayTranslated} numberOfLines={3}>
                {targetLangObj?.flag} {translatedText}
              </Text>
            ) : null}
          </View>
        )}

        {/* Bottom controls */}
        <View style={styles.lensControls}>
          <TouchableOpacity
            style={styles.lensCloseBtn}
            onPress={() => { setLensActive(false); stopScanLoop(); }}
          >
            <Text style={styles.lensCloseBtnText}>✕</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.lensCaptureBtn, (scanning || translating) && styles.lensCaptureBtnBusy]}
            onPress={handleManualCapture}
            disabled={scanning || translating}
          >
            {scanning || translating ? (
              <ActivityIndicator color="#1A73E8" />
            ) : (
              <View style={styles.lensCaptureInner} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.lensResetBtn}
            onPress={() => { setDetectedText(''); setTranslatedText(''); setLastScannedText(''); }}
          >
            <Text style={styles.lensResetBtnText}>↺</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ─── Home / Result screen ─────────────────────────────────────────────────────
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
          <Text style={styles.brandSubtitle}>Camera se text scan karo, turant translate ho</Text>
        </View>
      </View>

      {/* Language selector */}
      <View style={styles.langRow}>
        <Text style={styles.langLabel}>Translate to:</Text>
        <View style={styles.langPickerWrap}>
          <LanguagePicker
            languages={TARGET_LANGUAGES}
            selectedCode={targetLang}
            onSelect={(code) => { setTargetLang(code); setLastScannedText(''); }}
            label="Target Language"
          />
        </View>
      </View>

      {/* Start Lens button */}
      <TouchableOpacity
        style={styles.startLensBtn}
        onPress={() => { setDetectedText(''); setTranslatedText(''); setLastScannedText(''); setLensActive(true); }}
      >
        <Text style={styles.startLensIcon}>🔍</Text>
        <Text style={styles.startLensBtnText}>Bharat Lens Kholo</Text>
        <Text style={styles.startLensDesc}>Auto scan + translate</Text>
      </TouchableOpacity>

      {/* Results */}
      {detectedText ? (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>📝 Detected Text</Text>
          <Text style={styles.detectedText} selectable>{detectedText}</Text>
        </View>
      ) : null}

      {translatedText ? (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>
            {targetLangObj?.flag} Translation — {targetLangObj?.name}
          </Text>
          <Text style={styles.translatedText} selectable>{translatedText}</Text>
          <View style={styles.outputActions}>
            <TTSButton text={translatedText} locale={targetLangObj?.ttsLocale} disabled={false} emotion="normal" />
            <TouchableOpacity onPress={handleCopy} style={styles.actionBtn}>
              <Text style={styles.actionBtnText}>📋 Copy</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleShare} style={styles.actionBtn}>
              <Text style={styles.actionBtnText}>↗ Share</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {detectedText ? (
        <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
          <Text style={styles.resetBtnText}>Start Over</Text>
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );
};

const makeStyles = (theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.colors.background },
    content: { padding: 16, paddingBottom: 40 },
    centered: {
      flex: 1, alignItems: 'center', justifyContent: 'center',
      padding: 32, backgroundColor: theme.colors.background,
    },
    lensLogo: { fontSize: 56, marginBottom: 12 },
    lensTitle: { fontSize: 24, fontWeight: '800', color: theme.colors.primary, marginBottom: 10 },
    permDesc: { fontSize: 15, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
    permBtn: { backgroundColor: theme.colors.primary, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 12 },
    permBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },

    // Live lens
    lensContainer: { flex: 1, backgroundColor: '#000' },
    lensTopBar: {
      position: 'absolute', top: 0, left: 0, right: 0,
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingHorizontal: 16, paddingTop: 48, paddingBottom: 12,
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    lensBrandText: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
    lensLangBadge: {
      backgroundColor: 'rgba(255,255,255,0.2)',
      paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    },
    lensLangText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },

    scanFrameContainer: {
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      alignItems: 'center', justifyContent: 'center',
    },
    scanFrame: {
      width: SCREEN_WIDTH - 60, height: 200,
      borderRadius: 12, position: 'relative',
    },
    corner: {
      position: 'absolute', width: 24, height: 24,
      borderColor: '#FFFFFF', borderWidth: 3,
    },
    cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 8 },
    cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 8 },
    cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 8 },
    cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 8 },
    scanHint: {
      color: '#FFFFFF', fontSize: 14, marginTop: 16,
      backgroundColor: 'rgba(0,0,0,0.6)',
      paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    },

    overlayCard: {
      position: 'absolute', bottom: 110, left: 16, right: 16,
      backgroundColor: 'rgba(0,0,0,0.82)',
      borderRadius: 14, padding: 14,
    },
    overlayOriginal: { color: '#AAAAAA', fontSize: 12, marginBottom: 6 },
    overlayLoading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    overlayLoadingText: { color: '#FFFFFF', fontSize: 14 },
    overlayTranslated: { color: '#FFFFFF', fontSize: 17, fontWeight: '600', lineHeight: 24 },

    lensControls: {
      position: 'absolute', bottom: 40, left: 0, right: 0,
      flexDirection: 'row', alignItems: 'center',
      justifyContent: 'space-around', paddingHorizontal: 40,
    },
    lensCloseBtn: {
      width: 48, height: 48, borderRadius: 24,
      backgroundColor: 'rgba(255,255,255,0.2)',
      alignItems: 'center', justifyContent: 'center',
    },
    lensCloseBtnText: { color: '#FFFFFF', fontSize: 20 },
    lensCaptureBtn: {
      width: 72, height: 72, borderRadius: 36,
      backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center',
      borderWidth: 4, borderColor: 'rgba(255,255,255,0.4)',
    },
    lensCaptureBtnBusy: { opacity: 0.6 },
    lensCaptureInner: {
      width: 52, height: 52, borderRadius: 26,
      backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#CCCCCC',
    },
    lensResetBtn: {
      width: 48, height: 48, borderRadius: 24,
      backgroundColor: 'rgba(255,255,255,0.2)',
      alignItems: 'center', justifyContent: 'center',
    },
    lensResetBtnText: { color: '#FFFFFF', fontSize: 22 },

    // Home screen
    brandHeader: {
      flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20,
    },
    brandIcon: { fontSize: 40 },
    brandTitle: { fontSize: 22, fontWeight: '800', color: theme.colors.primary },
    brandSubtitle: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 2 },

    langRow: {
      flexDirection: 'row', alignItems: 'center',
      marginBottom: 20, gap: 12,
    },
    langLabel: { fontSize: 14, color: theme.colors.textSecondary, fontWeight: '500' },
    langPickerWrap: { flex: 1 },

    startLensBtn: {
      backgroundColor: theme.colors.primary,
      borderRadius: 16, paddingVertical: 24,
      alignItems: 'center', marginBottom: 20,
      elevation: 4,
      shadowColor: theme.colors.primary,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.3, shadowRadius: 6,
    },
    startLensIcon: { fontSize: 40, marginBottom: 6 },
    startLensBtnText: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
    startLensDesc: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 4 },

    card: {
      backgroundColor: theme.colors.surface, borderRadius: 14,
      borderWidth: 1, borderColor: theme.colors.border,
      padding: 14, marginBottom: 12,
    },
    cardLabel: {
      fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary,
      textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8,
    },
    detectedText: { fontSize: 14, color: theme.colors.textSecondary, lineHeight: 20 },
    translatedText: { fontSize: 16, color: theme.colors.text, lineHeight: 24 },
    outputActions: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      marginTop: 12, paddingTop: 10,
      borderTopWidth: 1, borderTopColor: theme.colors.divider,
    },
    actionBtn: {
      paddingHorizontal: 12, paddingVertical: 7,
      borderRadius: 8, backgroundColor: theme.colors.surfaceVariant,
    },
    actionBtnText: { fontSize: 13, color: theme.colors.text, fontWeight: '500' },
    resetBtn: {
      alignItems: 'center', paddingVertical: 14,
      borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border,
    },
    resetBtnText: { fontSize: 15, color: theme.colors.textSecondary, fontWeight: '500' },
  });

export default CameraScreen;
