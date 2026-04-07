import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  Alert,
} from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
} from 'react-native-vision-camera';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import { useTheme } from '../ThemeContext';
import LanguagePicker from '../components/LanguagePicker';
import { translateText } from '../api';
import { TARGET_LANGUAGES, getLanguageByCode } from '../languages';

const { width: W, height: H } = Dimensions.get('window');
const SCAN_INTERVAL = 2000;

const CameraScreen = () => {
  const { theme } = useTheme();
  const styles = makeStyles(theme);

  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const cameraRef = useRef(null);

  const [targetLang, setTargetLang] = useState('hi');
  const [isScanning, setIsScanning] = useState(false);
  const [detectedText, setDetectedText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [lensOn, setLensOn] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  const scanTimer = useRef(null);
  const isBusy = useRef(false);
  const lastText = useRef('');

  const targetLangObj = getLanguageByCode(targetLang);

  // Auto request permission
  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, []);

  // Start/stop scan loop
  useEffect(() => {
    if (lensOn && hasPermission && device) {
      startLoop();
    } else {
      stopLoop();
    }
    return () => stopLoop();
  }, [lensOn, hasPermission, device, targetLang]);

  const startLoop = () => {
    stopLoop();
    scanTimer.current = setInterval(doScan, SCAN_INTERVAL);
  };

  const stopLoop = () => {
    if (scanTimer.current) {
      clearInterval(scanTimer.current);
      scanTimer.current = null;
    }
  };

  const doScan = useCallback(async () => {
    if (isBusy.current || !cameraRef.current) return;
    isBusy.current = true;
    setIsScanning(true);

    try {
      const photo = await cameraRef.current.takePhoto({
        qualityPrioritization: 'speed',
        flash: 'off',
      });

      const result = await TextRecognition.recognize(`file://${photo.path}`);
      const text = result.text?.trim() || '';

      if (!text || text === lastText.current) {
        setIsScanning(false);
        isBusy.current = false;
        return;
      }

      lastText.current = text;
      setDetectedText(text);
      setIsTranslating(true);

      const res = await translateText({
        text,
        sourceLang: 'auto',
        targetLang,
        saveHistory: false,
      });

      setTranslatedText(res.translatedText || '');
    } catch (e) {
      // Silent fail — keep scanning
    } finally {
      setIsScanning(false);
      setIsTranslating(false);
      isBusy.current = false;
    }
  }, [targetLang]);

  // ─── Permission screen ────────────────────────────────────────────────────────
  if (!hasPermission) {
    return (
      <View style={styles.centered}>
        <Text style={styles.bigIcon}>📷</Text>
        <Text style={styles.permTitle}>Camera Permission Chahiye</Text>
        <Text style={styles.permDesc}>
          Real-time text translation ke liye camera access do.
        </Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Allow Camera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─── No device ────────────────────────────────────────────────────────────────
  if (!device) {
    return (
      <View style={styles.centered}>
        <Text style={styles.bigIcon}>📷</Text>
        <Text style={styles.permTitle}>Camera nahi mila</Text>
        <Text style={styles.permDesc}>Phone restart karke try karo.</Text>
      </View>
    );
  }

  // ─── Live Camera View ─────────────────────────────────────────────────────────
  if (lensOn) {
    return (
      <View style={styles.lensRoot}>
        <Camera
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          device={device}
          isActive
          photo
        />

        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={() => {
              setLensOn(false);
              stopLoop();
              setDetectedText('');
              setTranslatedText('');
              lastText.current = '';
            }}
          >
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.langBadge}
            onPress={() => setShowPicker(true)}
          >
            <Text style={styles.langBadgeText}>
              {targetLangObj?.flag} {targetLangObj?.name} ▾
            </Text>
          </TouchableOpacity>

          <View style={styles.statusDot}>
            {isScanning || isTranslating ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <View style={styles.activeDot} />
            )}
          </View>
        </View>

        {/* Scan frame corners */}
        <View style={styles.frameContainer} pointerEvents="none">
          <View style={styles.frame}>
            <View style={[styles.corner, styles.cTL]} />
            <View style={[styles.corner, styles.cTR]} />
            <View style={[styles.corner, styles.cBL]} />
            <View style={[styles.corner, styles.cBR]} />
          </View>
          <Text style={styles.frameHint}>
            {isScanning ? '🔍 Scanning...' : isTranslating ? '⚡ Translating...' : 'Text ke upar camera rakho'}
          </Text>
        </View>

        {/* Translation overlay */}
        {(detectedText || translatedText) && (
          <View style={styles.overlay}>
            {detectedText ? (
              <Text style={styles.overlayOriginal} numberOfLines={2}>
                📝 {detectedText}
              </Text>
            ) : null}
            {isTranslating ? (
              <View style={styles.overlayLoading}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.overlayLoadingText}>Translating...</Text>
              </View>
            ) : translatedText ? (
              <Text style={styles.overlayTranslated} numberOfLines={4}>
                {targetLangObj?.flag} {translatedText}
              </Text>
            ) : null}
          </View>
        )}

        {/* Language picker modal */}
        {showPicker && (
          <View style={styles.pickerOverlay}>
            <View style={styles.pickerSheet}>
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerTitle}>Language Select Karo</Text>
                <TouchableOpacity onPress={() => setShowPicker(false)}>
                  <Text style={styles.pickerClose}>✕</Text>
                </TouchableOpacity>
              </View>
              <LanguagePicker
                languages={TARGET_LANGUAGES}
                selectedCode={targetLang}
                onSelect={(code) => {
                  setTargetLang(code);
                  lastText.current = '';
                  setTranslatedText('');
                  setShowPicker(false);
                }}
                label="Translate To"
              />
            </View>
          </View>
        )}
      </View>
    );
  }

  // ─── Home screen ──────────────────────────────────────────────────────────────
  return (
    <View style={styles.homeRoot}>
      <View style={styles.brandRow}>
        <Text style={styles.brandIcon}>🔍</Text>
        <View>
          <Text style={styles.brandTitle}>Bharat Lens</Text>
          <Text style={styles.brandSub}>Real-time camera translation</Text>
        </View>
      </View>

      <View style={styles.langRow}>
        <Text style={styles.langLabel}>Translate to:</Text>
        <View style={styles.langPickerWrap}>
          <LanguagePicker
            languages={TARGET_LANGUAGES}
            selectedCode={targetLang}
            onSelect={(code) => { setTargetLang(code); lastText.current = ''; }}
            label="Target Language"
          />
        </View>
      </View>

      <TouchableOpacity
        style={styles.startBtn}
        onPress={() => setLensOn(true)}
      >
        <Text style={styles.startBtnIcon}>🔍</Text>
        <Text style={styles.startBtnText}>Bharat Lens Start Karo</Text>
        <Text style={styles.startBtnSub}>Camera se text auto translate hoga</Text>
      </TouchableOpacity>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Kaise kaam karta hai?</Text>
        <Text style={styles.infoItem}>📷  Camera kisi bhi text pe point karo</Text>
        <Text style={styles.infoItem}>🔍  Har 2 second mein auto scan hoga</Text>
        <Text style={styles.infoItem}>⚡  Turant translation screen pe dikhega</Text>
        <Text style={styles.infoItem}>🌐  50+ languages support</Text>
      </View>
    </View>
  );
};

const makeStyles = (theme) =>
  StyleSheet.create({
    // Permission / no device
    centered: {
      flex: 1, alignItems: 'center', justifyContent: 'center',
      padding: 32, backgroundColor: theme.colors.background,
    },
    bigIcon: { fontSize: 56, marginBottom: 16 },
    permTitle: { fontSize: 20, fontWeight: '700', color: theme.colors.text, marginBottom: 10, textAlign: 'center' },
    permDesc: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
    permBtn: { backgroundColor: theme.colors.primary, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 12 },
    permBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

    // Live lens
    lensRoot: { flex: 1, backgroundColor: '#000' },
    topBar: {
      position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingTop: 48, paddingBottom: 14,
      backgroundColor: 'rgba(0,0,0,0.55)',
    },
    closeBtn: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: 'rgba(255,255,255,0.2)',
      alignItems: 'center', justifyContent: 'center',
    },
    closeBtnText: { color: '#fff', fontSize: 18 },
    langBadge: {
      backgroundColor: 'rgba(255,255,255,0.2)',
      paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    },
    langBadgeText: { color: '#fff', fontSize: 14, fontWeight: '700' },
    statusDot: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    activeDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#4CAF50' },

    // Scan frame
    frameContainer: {
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      alignItems: 'center', justifyContent: 'center',
    },
    frame: {
      width: W - 60, height: 180, position: 'relative',
    },
    corner: {
      position: 'absolute', width: 28, height: 28,
      borderColor: '#FFFFFF', borderWidth: 3,
    },
    cTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 8 },
    cTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 8 },
    cBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 8 },
    cBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 8 },
    frameHint: {
      color: '#fff', fontSize: 13, marginTop: 14,
      backgroundColor: 'rgba(0,0,0,0.6)',
      paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20,
    },

    // Translation overlay
    overlay: {
      position: 'absolute', bottom: 40, left: 16, right: 16,
      backgroundColor: 'rgba(0,0,0,0.82)',
      borderRadius: 16, padding: 16,
    },
    overlayOriginal: { color: '#AAA', fontSize: 12, marginBottom: 8 },
    overlayLoading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    overlayLoadingText: { color: '#fff', fontSize: 14 },
    overlayTranslated: { color: '#fff', fontSize: 18, fontWeight: '700', lineHeight: 26 },

    // Language picker overlay
    pickerOverlay: {
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end',
    },
    pickerSheet: {
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: 20, borderTopRightRadius: 20,
      maxHeight: H * 0.7, paddingBottom: 20,
    },
    pickerHeader: {
      flexDirection: 'row', justifyContent: 'space-between',
      alignItems: 'center', padding: 16,
      borderBottomWidth: 1, borderBottomColor: theme.colors.divider,
    },
    pickerTitle: { fontSize: 17, fontWeight: '700', color: theme.colors.text },
    pickerClose: { fontSize: 18, color: theme.colors.textSecondary, padding: 4 },

    // Home screen
    homeRoot: { flex: 1, backgroundColor: theme.colors.background, padding: 16 },
    brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24, marginTop: 8 },
    brandIcon: { fontSize: 44 },
    brandTitle: { fontSize: 24, fontWeight: '800', color: theme.colors.primary },
    brandSub: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 2 },
    langRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
    langLabel: { fontSize: 14, color: theme.colors.textSecondary, fontWeight: '500' },
    langPickerWrap: { flex: 1 },
    startBtn: {
      backgroundColor: theme.colors.primary, borderRadius: 16,
      paddingVertical: 24, alignItems: 'center', marginBottom: 20,
      elevation: 4, shadowColor: theme.colors.primary,
      shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6,
    },
    startBtnIcon: { fontSize: 40, marginBottom: 6 },
    startBtnText: { color: '#fff', fontSize: 20, fontWeight: '800' },
    startBtnSub: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 4 },
    infoCard: {
      backgroundColor: theme.colors.surface, borderRadius: 14,
      borderWidth: 1, borderColor: theme.colors.border, padding: 16, gap: 10,
    },
    infoTitle: { fontSize: 15, fontWeight: '700', color: theme.colors.text, marginBottom: 4 },
    infoItem: { fontSize: 14, color: theme.colors.textSecondary, lineHeight: 22 },
  });

export default CameraScreen;
