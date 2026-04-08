import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Share, Clipboard, Alert,
} from 'react-native';
import { useTheme } from '../ThemeContext';
import { rephraseStyle } from '../api';

const STYLES = [
  { key: 'gen_z',  emoji: '\uD83D\uDE0E', label: 'Gen-Z',  color: '#6A1B9A', bg: '#F3E5F5' },
  { key: 'formal', emoji: '\uD83D\uDC54', label: 'Formal',  color: '#2E7D32', bg: '#E8F5E9' },
  { key: 'funny',  emoji: '\uD83D\uDE02', label: 'Funny',   color: '#E65100', bg: '#FFF8E1' },
];

const StyleSelector = ({ outputText }) => {
  const { theme } = useTheme();
  const styles = makeStyles(theme);

  const [loading, setLoading] = useState(false);
  const [styleResults, setStyleResults] = useState(null);
  const [expanded, setExpanded] = useState(false);

  const handleGenerate = async () => {
    if (!outputText?.trim()) {
      Alert.alert('Translate first', 'Please translate something first.');
      return;
    }
    setLoading(true);
    setStyleResults(null);
    try {
      const result = await rephraseStyle({ text: outputText });
      setStyleResults(result.styles);
      setExpanded(true);
    } catch (err) {
      Alert.alert('Error', err.message || 'Could not generate styles.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Vibe Check — 3 Styles</Text>
        <View style={styles.headerBtns}>
          {styleResults && (
            <TouchableOpacity
              style={styles.clearBtn}
              onPress={() => { setStyleResults(null); setExpanded(false); }}
            >
              <Text style={styles.clearBtnText}>X</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.generateBtn, (!outputText || loading) && styles.generateBtnDisabled]}
            onPress={handleGenerate}
            disabled={!outputText || loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.generateBtnText}>Generate</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.subtitle}>Same sentence in 3 different styles</Text>

      {expanded && styleResults && (
        <View style={styles.cardsContainer}>
          {STYLES.map((s) => {
            const result = styleResults[s.key];
            if (!result) return null;
            return (
              <View
                key={s.key}
                style={[styles.card, { borderLeftColor: s.color, backgroundColor: theme.dark ? theme.colors.surface : s.bg }]}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.cardEmoji}>{s.emoji}</Text>
                  <Text style={[styles.cardLabel, { color: s.color }]}>{s.label}</Text>
                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      onPress={() => { Clipboard.setString(result.text); Alert.alert('Copied!'); }}
                      style={styles.miniBtn}
                    >
                      <Text style={styles.miniBtnText}>Copy</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={async () => { try { await Share.share({ message: result.text }); } catch (e) {} }}
                      style={styles.miniBtn}
                    >
                      <Text style={styles.miniBtnText}>Share</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <Text style={styles.cardText} selectable>{result.text}</Text>
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
    container: {
      marginTop: 14, backgroundColor: theme.colors.surface,
      borderRadius: 14, borderWidth: 1, borderColor: theme.colors.border, padding: 14,
    },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    headerBtns: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    clearBtn: {
      width: 30, height: 30, borderRadius: 15,
      backgroundColor: '#FFEBEE', alignItems: 'center', justifyContent: 'center',
    },
    clearBtnText: { fontSize: 13, color: '#F44336', fontWeight: '700' },
    title: { fontSize: 15, fontWeight: '700', color: theme.colors.text },
    subtitle: { fontSize: 12, color: theme.colors.textSecondary, marginBottom: 12 },
    generateBtn: { backgroundColor: theme.colors.primary, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8 },
    generateBtnDisabled: { opacity: 0.4 },
    generateBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
    cardsContainer: { gap: 10 },
    card: { borderRadius: 10, borderLeftWidth: 4, padding: 12 },
    cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 6 },
    cardEmoji: { fontSize: 18 },
    cardLabel: { fontSize: 13, fontWeight: '700', flex: 1 },
    cardActions: { flexDirection: 'row', gap: 6 },
    miniBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: theme.colors.surfaceVariant },
    miniBtnText: { fontSize: 12, color: theme.colors.text, fontWeight: '600' },
    cardText: { fontSize: 14, color: theme.colors.text, lineHeight: 21 },
  });

export default StyleSelector;
