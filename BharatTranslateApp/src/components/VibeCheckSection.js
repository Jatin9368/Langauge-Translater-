import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Clipboard, Share, Alert,
} from 'react-native';
import { useTheme } from '../ThemeContext';
import { rephraseStyle } from '../api';

const STYLES = [
  { key: 'gen_z',  emoji: '\uD83D\uDE0E', label: 'Gen-Z',  color: '#6C63FF', bg: 'rgba(108,99,255,0.1)' },
  { key: 'funny',  emoji: '\uD83D\uDE02', label: 'Funny',   color: '#FF6584', bg: 'rgba(255,101,132,0.1)' },
  { key: 'formal', emoji: '\uD83D\uDC54', label: 'Formal',  color: '#10B981', bg: 'rgba(16,185,129,0.1)' },
];

const VibeCheckSection = ({ outputText, targetLang }) => {
  const { theme } = useTheme();
  const styles = makeStyles(theme);

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);

  const handleToggle = async () => {
    if (open) { setOpen(false); return; }
    if (results) { setOpen(true); return; }
    if (!outputText?.trim()) {
      Alert.alert('Translate first', 'Please translate something first.');
      return;
    }
    setLoading(true);
    try {
      const result = await rephraseStyle({ text: outputText, targetLang });
      setResults(result.styles);
      setOpen(true);
    } catch (err) {
      Alert.alert('Error', err.message || 'Vibe Check failed.');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    setResults(null);
    setOpen(false);
  }, [outputText]);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.vibeBtn, open && styles.vibeBtnActive]}
        onPress={handleToggle}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.vibeBtnText}>
            {open ? 'Close Vibe Check' : 'Vibe Check'}
          </Text>
        )}
      </TouchableOpacity>

      {open && results && (
        <View style={styles.cardsContainer}>
          {STYLES.map((s) => {
            const result = results[s.key];
            if (!result) return null;
            const options = result.options || [result.text];
            return (
              <View key={s.key} style={[styles.card, { borderLeftColor: s.color, backgroundColor: s.bg }]}>
                {/* Card Header */}
                <View style={styles.cardHeader}>
                  <Text style={styles.cardEmoji}>{s.emoji}</Text>
                  <Text style={[styles.cardLabel, { color: s.color }]}>{s.label}</Text>
                </View>

                {/* Options */}
                {options.map((opt, idx) => (
                  <View key={idx} style={styles.optionRow}>
                    <Text style={[styles.optionNum, { color: s.color }]}>{idx + 1}</Text>
                    <Text style={styles.optionText} selectable>{opt}</Text>
                    <View style={styles.optionActions}>
                      <TouchableOpacity
                        onPress={() => { Clipboard.setString(opt); Alert.alert('Copied!'); }}
                        style={styles.miniBtn}
                      >
                        <Text style={styles.miniBtnText}>Copy</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={async () => { try { await Share.share({ message: opt }); } catch (e) {} }}
                        style={styles.miniBtn}
                      >
                        <Text style={styles.miniBtnText}>Share</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
};

const makeStyles = (theme) =>
  StyleSheet.create({
    container: { marginTop: 10 },
    vibeBtn: {
      backgroundColor: 'rgba(108,99,255,0.15)',
      borderWidth: 1.5, borderColor: '#6C63FF',
      borderRadius: 12, paddingVertical: 13,
      alignItems: 'center', justifyContent: 'center',
    },
    vibeBtnActive: { backgroundColor: 'rgba(255,101,132,0.15)', borderColor: '#FF6584' },
    vibeBtnText: { color: theme.colors.text, fontSize: 15, fontWeight: '700' },

    cardsContainer: { marginTop: 10, gap: 12 },
    card: { borderRadius: 14, borderLeftWidth: 3, padding: 14 },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
    cardEmoji: { fontSize: 20 },
    cardLabel: { fontSize: 15, fontWeight: '800' },

    optionRow: {
      flexDirection: 'row', alignItems: 'flex-start',
      gap: 8, marginBottom: 10,
      paddingBottom: 10, borderBottomWidth: 1,
      borderBottomColor: 'rgba(0,0,0,0.06)',
    },
    optionNum: { fontSize: 13, fontWeight: '800', marginTop: 2, minWidth: 16 },
    optionText: { flex: 1, fontSize: 14, color: theme.colors.text, lineHeight: 20 },
    optionActions: { flexDirection: 'row', gap: 4 },
    miniBtn: {
      paddingHorizontal: 8, paddingVertical: 4,
      borderRadius: 6, backgroundColor: 'rgba(0,0,0,0.08)',
    },
    miniBtnText: { fontSize: 11, color: theme.colors.text, fontWeight: '600' },
  });

export default VibeCheckSection;
