import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Clipboard,
  Share,
  Alert,
} from 'react-native';
import { useTheme } from '../ThemeContext';
import { rephraseStyle } from '../api';

const STYLES = [
  { key: 'gen_z',  emoji: '😎', label: 'Gen-Z',  color: '#6C63FF', bg: 'rgba(108,99,255,0.12)' },
  { key: 'formal', emoji: '👔', label: 'Formal',  color: '#43E8D8', bg: 'rgba(67,232,216,0.12)' },
  { key: 'funny',  emoji: '😂', label: 'Funny',   color: '#FF6584', bg: 'rgba(255,101,132,0.12)' },
];

const VibeCheckSection = ({ outputText }) => {
  const { theme } = useTheme();
  const styles = makeStyles(theme);

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);

  const handleToggle = async () => {
    if (open) {
      setOpen(false);
      return;
    }

    if (results) {
      setOpen(true);
      return;
    }

    if (!outputText?.trim()) {
      Alert.alert('Pehle translate karein');
      return;
    }

    setLoading(true);
    try {
      const result = await rephraseStyle({ text: outputText });
      setResults(result.styles);
      setOpen(true);
    } catch (err) {
      Alert.alert('Error', err.message || 'Vibe Check fail hua.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text) => {
    Clipboard.setString(text);
    Alert.alert('Copied!');
  };

  const handleShare = async (text) => {
    try { await Share.share({ message: text }); } catch (e) {}
  };

  // Reset when outputText changes
  React.useEffect(() => {
    setResults(null);
    setOpen(false);
  }, [outputText]);

  return (
    <View style={styles.container}>
      {/* Vibe Check Button */}
      <TouchableOpacity
        style={[styles.vibeBtn, open && styles.vibeBtnActive]}
        onPress={handleToggle}
        disabled={loading}
        accessibilityRole="button"
      >
        {loading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.vibeBtnText}>
            {open ? '✕ Close Vibe Check' : '🎭 Vibe Check'}
          </Text>
        )}
      </TouchableOpacity>

      {/* Style Cards */}
      {open && results && (
        <View style={styles.cardsContainer}>
          {STYLES.map((s) => {
            const result = results[s.key];
            if (!result) return null;
            return (
              <View
                key={s.key}
                style={[styles.card, { borderLeftColor: s.color, backgroundColor: s.bg }]}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.cardEmoji}>{s.emoji}</Text>
                  <Text style={[styles.cardLabel, { color: s.color }]}>{s.label}</Text>
                  <View style={styles.cardActions}>
                    <TouchableOpacity onPress={() => handleCopy(result.text)} style={styles.miniBtn}>
                      <Text style={styles.miniBtnText}>📋</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleShare(result.text)} style={styles.miniBtn}>
                      <Text style={styles.miniBtnText}>↗</Text>
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
      marginTop: 10,
    },
    vibeBtn: {
      backgroundColor: 'rgba(108,99,255,0.15)',
      borderWidth: 1.5,
      borderColor: '#6C63FF',
      borderRadius: 12,
      paddingVertical: 13,
      alignItems: 'center',
      justifyContent: 'center',
    },
    vibeBtnActive: {
      backgroundColor: 'rgba(255,101,132,0.15)',
      borderColor: '#FF6584',
    },
    vibeBtnText: {
      color: theme.colors.text,
      fontSize: 15,
      fontWeight: '700',
      letterSpacing: 0.3,
    },
    cardsContainer: {
      marginTop: 10,
      gap: 10,
    },
    card: {
      borderRadius: 12,
      borderLeftWidth: 3,
      padding: 12,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
      gap: 6,
    },
    cardEmoji: { fontSize: 18 },
    cardLabel: { fontSize: 13, fontWeight: '700', flex: 1 },
    cardActions: { flexDirection: 'row', gap: 6 },
    miniBtn: {
      padding: 4,
      borderRadius: 6,
      backgroundColor: 'rgba(255,255,255,0.1)',
    },
    miniBtnText: { fontSize: 14 },
    cardText: {
      fontSize: 14,
      color: theme.colors.text,
      lineHeight: 21,
    },
  });

export default VibeCheckSection;
