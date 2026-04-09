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
    emoji: '\uD83D\uDE0E',
    label: 'Gen-Z',
    desc: 'Casual & Slangy',
    accent: '#7C3AED',
    light: 'rgba(124,58,237,0.07)',
  },
  {
    key: 'funny',
    emoji: '\uD83D\uDE02',
    label: 'Funny',
    desc: 'Witty & Playful',
    accent: '#DB2777',
    light: 'rgba(219,39,119,0.07)',
  },
  {
    key: 'formal',
    emoji: '\uD83D\uDC54',
    label: 'Formal',
    desc: 'Professional',
    accent: '#059669',
    light: 'rgba(5,150,105,0.07)',
  },
];

const VibeCheckSection = ({ outputText, targetLang }) => {
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
            {!open && <View style={s.pill}><Text style={s.pillText}>3 styles</Text></View>}
          </View>
        )}
      </TouchableOpacity>

      {/* Cards */}
      {open && results && (
        <Animated.View style={[s.cards, { opacity: fadeAnim }]}>
          {STYLES_CONFIG.map((cfg) => {
            const result = results[cfg.key];
            if (!result) return null;
            const options = (result.options || [result.text]).slice(0, 2);

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

                {/* Options */}
                {options.map((opt, i) => (
                  <View key={i} style={[s.optRow, i > 0 && s.optRowBorder]}>
                    <View style={[s.dot, { backgroundColor: cfg.accent }]} />
                    <Text style={s.optText} selectable>{opt}</Text>
                    <View style={s.optActions}>
                      <TouchableOpacity
                        onPress={() => { Clipboard.setString(opt); Alert.alert('Copied!'); }}
                        style={[s.optBtn, { borderColor: cfg.accent + '50' }]}
                      >
                        <Text style={[s.optBtnTxt, { color: cfg.accent }]}>Copy</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={async () => { try { await Share.share({ message: opt }); } catch (e) {} }}
                        style={[s.optBtn, { borderColor: cfg.accent + '50' }]}
                      >
                        <Text style={[s.optBtnTxt, { color: cfg.accent }]}>Share</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
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

  optRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    gap: 8, paddingTop: 10,
  },
  optRowBorder: { borderTopWidth: 1, borderTopColor: theme.colors.divider },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 7, flexShrink: 0 },
  optText: { flex: 1, fontSize: 14, color: theme.colors.text, lineHeight: 22 },
  optActions: { flexDirection: 'row', gap: 4, flexShrink: 0 },
  optBtn: {
    paddingHorizontal: 9, paddingVertical: 4,
    borderRadius: 8, borderWidth: 1,
  },
  optBtnTxt: { fontSize: 11, fontWeight: '700' },
});

export default VibeCheckSection;
