import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Clipboard, Share, Alert, Animated,
} from 'react-native';
import { useTheme } from '../ThemeContext';
import { rephraseStyle } from '../api';

const STYLES_CONFIG = [
  {
    key: 'gen_z',
    emoji: '😎',
    label: 'Gen-Z',
    desc: 'Youthful & Energetic',
    accent: '#7C3AED',
    light: 'rgba(124,58,237,0.07)',
  },
  {
    key: 'casual',
    emoji: '😊',
    label: 'Casual',
    desc: 'Relaxed & Friendly',
    accent: '#DB2777',
    light: 'rgba(219,39,119,0.07)',
  },
  {
    key: 'professional',
    emoji: '👔',
    label: 'Professional',
    desc: 'Polished & Formal',
    accent: '#059669',
    light: 'rgba(5,150,105,0.07)',
  },
  {
    key: 'confident',
    emoji: '💪',
    label: 'Confident',
    desc: 'Bold & Assertive',
    accent: '#EA580C',
    light: 'rgba(234,88,12,0.07)',
  },
];

const VibeCheckSection = ({ outputText, targetLang, onReplace }) => {
  const { theme, isDark } = useTheme();
  const s = makeStyles(theme, isDark);

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const handleToggle = async () => {
    if (open) {
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setOpen(false));
      return;
    }
    if (results) {
      setOpen(true);
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      return;
    }
    if (!outputText?.trim()) {
      Alert.alert('Translate first', 'Please translate something first.');
      return;
    }
    setLoading(true);
    try {
      const result = await rephraseStyle({ text: outputText, targetLang });
      setResults(result.styles);
      setOpen(true);
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    } catch (err) {
      Alert.alert('Error', err.message || 'Vibe Check failed.');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    setResults(null);
    setOpen(false);
    fadeAnim.setValue(0);
  }, [outputText]);

  return (
    <View style={s.wrapper}>
      {/* Button */}
      <TouchableOpacity style={[s.btn, open && s.btnOpen]} onPress={handleToggle} disabled={loading} activeOpacity={0.8}>
        {loading ? (
          <View style={s.btnInner}>
            <ActivityIndicator size="small" color={isDark ? '#A78BFA' : '#7C3AED'} />
            <Text style={s.btnText}>Generating...</Text>
          </View>
        ) : (
          <View style={s.btnInner}>
            <Text style={s.btnEmoji}>{open ? '\u2715' : '\u2728'}</Text>
            <Text style={s.btnText}>{open ? 'Close' : 'Vibe Check'}</Text>
            {!open && <View style={s.pill}><Text style={s.pillText}>4 styles</Text></View>}
          </View>
        )}
      </TouchableOpacity>

      {/* Cards */}
      {open && results && (
        <Animated.View style={[s.cards, { opacity: fadeAnim }]}>
          {STYLES_CONFIG.map((cfg) => {
            const result = results[cfg.key];
            if (!result) return null;

            return (
              <View key={cfg.key} style={[s.card, { borderLeftColor: cfg.accent }]}>
                {/* Header */}
                <View style={s.cardHead}>
                  <View style={[s.iconBox, { backgroundColor: cfg.light }]}>
                    <Text style={s.cardEmoji}>{cfg.emoji}</Text>
                  </View>
                  <View style={s.cardHeadText}>
                    <Text style={[s.cardLabel, { color: cfg.accent }]}>{cfg.label}</Text>
                    <Text style={s.cardDesc}>{cfg.desc}</Text>
                  </View>
                </View>

                {/* Text */}
                <View style={s.textBox}>
                  <Text style={s.cardText} selectable>{result.text}</Text>
                </View>

                {/* Actions */}
                <View style={s.actions}>
                  <TouchableOpacity
                    onPress={() => { Clipboard.setString(result.text); Alert.alert('Copied!'); }}
                    style={[s.actionBtn, { borderColor: cfg.accent + '50' }]}
                  >
                    <Text style={[s.actionBtnTxt, { color: cfg.accent }]}>Copy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={async () => { try { await Share.share({ message: result.text }); } catch (e) {} }}
                    style={[s.actionBtn, { borderColor: cfg.accent + '50' }]}
                  >
                    <Text style={[s.actionBtnTxt, { color: cfg.accent }]}>Share</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => { onReplace(result.text); Alert.alert('Replaced!', 'Translated text updated.'); }}
                    style={[s.actionBtn, { borderColor: cfg.accent + '50', backgroundColor: cfg.accent + '15' }]}
                  >
                    <Text style={[s.actionBtnTxt, { color: cfg.accent }]}>Replace</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </Animated.View>
      )}
    </View>
  );
};

const makeStyles = (theme, isDark) => StyleSheet.create({
  wrapper: { marginTop: 12 },

  btn: {
    borderRadius: 14, borderWidth: 1.5,
    borderColor: isDark ? 'rgba(124,58,237,0.5)' : 'rgba(124,58,237,0.3)',
    backgroundColor: isDark ? 'rgba(124,58,237,0.1)' : 'rgba(124,58,237,0.05)',
    paddingVertical: 13,
  },
  btnOpen: {
    borderColor: isDark ? 'rgba(219,39,119,0.5)' : 'rgba(219,39,119,0.3)',
    backgroundColor: isDark ? 'rgba(219,39,119,0.1)' : 'rgba(219,39,119,0.05)',
  },
  btnInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnEmoji: { fontSize: 18 },
  btnText: { fontSize: 15, fontWeight: '700', color: theme.colors.text },
  pill: {
    backgroundColor: '#7C3AED', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  pillText: { fontSize: 11, color: '#fff', fontWeight: '700' },

  cards: { marginTop: 10, gap: 10 },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16, borderLeftWidth: 3,
    borderWidth: 1, borderColor: theme.colors.border,
    padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },

  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  iconBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardEmoji: { fontSize: 22 },
  cardHeadText: {},
  cardLabel: { fontSize: 15, fontWeight: '800' },
  cardDesc: { fontSize: 11, color: theme.colors.textSecondary, marginTop: 1 },

  textBox: { backgroundColor: theme.colors.background, borderRadius: 10, padding: 10, marginBottom: 10 },
  cardText: { fontSize: 14, color: theme.colors.text, lineHeight: 22, flex: 1 },
  optRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 6 },
  optRowBorder: { borderTopWidth: 1, borderTopColor: theme.colors.border },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 7, flexShrink: 0 },

  actions: { flexDirection: 'row', gap: 6 },
  actionBtn: {
    flex: 1,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1,
    alignItems: 'center',
  },
  actionBtnTxt: { fontSize: 12, fontWeight: '700' },
});

export default VibeCheckSection;
