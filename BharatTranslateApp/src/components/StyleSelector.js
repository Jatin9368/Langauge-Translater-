import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Share,
  Clipboard,
  Alert,
  ScrollView,
} from 'react-native';
import { useTheme } from '../ThemeContext';
import { rephraseStyle } from '../api';

const STYLES = [
  { key: 'gen_z',  emoji: '😎', label: 'Gen-Z',  color: '#6A1B9A', bg: '#F3E5F5' },
  { key: 'formal', emoji: '👔', label: 'Formal',  color: '#2E7D32', bg: '#E8F5E9' },
  { key: 'funny',  emoji: '😂', label: 'Funny',   color: '#E65100', bg: '#FFF8E1' },
];

const StyleSelector = ({ outputText, targetLang }) => {
  const { theme } = useTheme();
  const styles = makeStyles(theme);

  const [loading, setLoading] = useState(false);
  const [styleResults, setStyleResults] = useState(null);
  const [expanded, setExpanded] = useState(false);

  const handleGenerate = async () => {
    if (!outputText?.trim()) {
      Alert.alert('Pehle translate karein', 'Style ke liye pehle kuch translate karo.');
      return;
    }
    setLoading(true);
    setStyleResults(null);
    try {
      const result = await rephraseStyle({ text: outputText });
      setStyleResults(result.styles);
      setExpanded(true);
    } catch (err) {
      Alert.alert('Error', err.message || 'Style generate nahi ho saka.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text) => {
    Clipboard.setString(text);
    Alert.alert('Copied!', 'Text copy ho gaya.');
  };

  const handleShare = async (text) => {
    try {
      await Share.share({ message: text });
    } catch (err) {}
  };

  return (
    <View style={styles.container}>
      {/* Header row */}
      <TouchableOpacity
        style={styles.headerRow}
        onPress={() => outputText && setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <Text style={styles.title}>🎭 Vibe Check — 3 Styles</Text>
        <View style={styles.headerBtns}>
          {/* Cross button — sirf tab dikhe jab content ho */}
          {styleResults && (
            <TouchableOpacity
              style={styles.clearBtn}
              onPress={() => { setStyleResults(null); setExpanded(false); }}
              accessibilityRole="button"
              accessibilityLabel="Clear styles"
            >
              <Text style={styles.clearBtnText}>✕</Text>
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
      </TouchableOpacity>

      <Text style={styles.subtitle}>
        Same sentence — Gen-Z, Formal, Funny style mein
      </Text>

      {/* Style cards */}
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
                {/* Card header */}
                <View style={styles.cardHeader}>
                  <Text style={styles.cardEmoji}>{s.emoji}</Text>
                  <Text style={[styles.cardLabel, { color: s.color }]}>{s.label}</Text>
                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      onPress={() => handleCopy(result.text)}
                      style={styles.miniBtn}
                    >
                      <Text style={styles.miniBtnText}>📋</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleShare(result.text)}
                      style={styles.miniBtn}
                    >
                      <Text style={styles.miniBtnText}>↗</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                {/* Card text */}
                <Text style={styles.cardText} selectable>
                  {result.text}
                </Text>
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
      marginTop: 14,
      backgroundColor: theme.colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 14,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    },
    headerBtns: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    clearBtn: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: '#FFEBEE',
      alignItems: 'center',
      justifyContent: 'center',
    },
    clearBtnText: {
      fontSize: 14,
      color: '#F44336',
      fontWeight: '700',
    },
    title: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.colors.text,
    },
    subtitle: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginBottom: 12,
    },
    generateBtn: {
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 8,
    },
    generateBtnDisabled: {
      opacity: 0.4,
    },
    generateBtnText: {
      color: '#fff',
      fontSize: 13,
      fontWeight: '700',
    },
    cardsContainer: {
      gap: 10,
    },
    card: {
      borderRadius: 10,
      borderLeftWidth: 4,
      padding: 12,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
      gap: 6,
    },
    cardEmoji: {
      fontSize: 18,
    },
    cardLabel: {
      fontSize: 13,
      fontWeight: '700',
      flex: 1,
    },
    cardActions: {
      flexDirection: 'row',
      gap: 6,
    },
    miniBtn: {
      padding: 4,
      borderRadius: 6,
      backgroundColor: theme.colors.surfaceVariant,
    },
    miniBtnText: {
      fontSize: 14,
    },
    cardText: {
      fontSize: 14,
      color: theme.colors.text,
      lineHeight: 21,
    },
  });

export default StyleSelector;
