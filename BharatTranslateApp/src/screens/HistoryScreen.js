import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, RefreshControl, Clipboard, StatusBar, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../ThemeContext';
import { fetchHistory, deleteHistoryItem, clearAllHistory } from '../api';

const LIMIT = 20;

const HistoryScreen = ({ navigation }) => {
  const { theme, isDark } = useTheme();
  const s = makeStyles(theme, isDark);

  const [items, setItems]             = useState([]);
  const [loading, setLoading]         = useState(false);
  const [refreshing, setRefreshing]   = useState(false);
  const [page, setPage]               = useState(1);
  const [hasMore, setHasMore]         = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [total, setTotal]             = useState(0);

  const loadHistory = async (pageNum = 1, append = false) => {
    if (pageNum === 1) setLoading(true);
    else setLoadingMore(true);
    try {
      const result = await fetchHistory(pageNum, LIMIT);
      const newItems = result.data || [];
      setItems(prev => append ? [...prev, ...newItems] : newItems);
      setHasMore(result.pagination?.hasMore || false);
      setTotal(result.pagination?.total || 0);
      setPage(pageNum);
    } catch (err) {
      Alert.alert('Error', err.message || 'Could not load history.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { loadHistory(1, false); }, []));

  const handleDelete = (id) => {
    Alert.alert('Delete Entry', 'Remove this translation from history?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await deleteHistoryItem(id);
            setItems(prev => prev.filter(i => i._id !== id));
            setTotal(prev => Math.max(0, prev - 1));
          } catch (err) { Alert.alert('Error', err.message); }
        },
      },
    ]);
  };

  const handleClearAll = () => {
    if (!items.length) return;
    Alert.alert('Clear All History', 'This will permanently delete all your translations.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear All', style: 'destructive',
        onPress: async () => {
          try {
            await clearAllHistory();
            setItems([]); setTotal(0); setHasMore(false);
          } catch (err) { Alert.alert('Error', err.message); }
        },
      },
    ]);
  };

  const formatDate = (d) => {
    try {
      const date = new Date(d);
      const now = new Date();
      const diff = now - date;
      if (diff < 60000) return 'Just now';
      if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
      if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
      if (diff < 172800000) return 'Yesterday';
      return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    } catch { return ''; }
  };

  const renderItem = ({ item, index }) => (
    <View style={s.card}>
      {/* Header row */}
      <View style={s.cardHeader}>
        <View style={s.langRow}>
          <View style={s.langBadge}>
            <Text style={s.langBadgeTxt}>{item.sourceLangName || item.sourceLang}</Text>
          </View>
          <Text style={s.arrow}>→</Text>
          <View style={[s.langBadge, s.langBadgeTarget]}>
            <Text style={[s.langBadgeTxt, s.langBadgeTargetTxt]}>{item.targetLangName || item.targetLang}</Text>
          </View>
        </View>
        <View style={s.headerRight}>
          <Text style={s.timeText}>{formatDate(item.createdAt)}</Text>
          <TouchableOpacity
            onPress={() => handleDelete(item._id)}
            style={s.deleteBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={s.deleteTxt}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      <View style={s.cardBody}>
        <View style={s.textBlock}>
          <Text style={s.textLabel}>Original</Text>
          <Text style={s.sourceText} numberOfLines={2}>{item.sourceText}</Text>
        </View>
        <View style={s.divider} />
        <View style={s.textBlock}>
          <Text style={[s.textLabel, { color: '#6366F1' }]}>Translation</Text>
          <Text style={s.translatedText} numberOfLines={3}>{item.translatedText}</Text>
        </View>
      </View>

      {/* Actions */}
      <View style={s.cardFooter}>
        <TouchableOpacity
          style={s.copyBtn}
          onPress={() => { Clipboard.setString(item.translatedText); Alert.alert('Copied!'); }}
          activeOpacity={0.7}
        >
          <Text style={s.copyBtnIcon}>📋</Text>
          <Text style={s.copyBtnTxt}>Copy</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={s.useAgainBtn}
          onPress={() => navigation.navigate('Home', {
            retranslate: {
              text: item.sourceText,
              sourceLang: item.sourceLang,
              targetLang: item.targetLang,
              translatedText: item.translatedText,
            }
          })}
          activeOpacity={0.7}
        >
          <Text style={s.useAgainBtnIcon}>🔄</Text>
          <Text style={s.useAgainBtnTxt}>Use Again</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={s.root}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />

      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>History</Text>
          <Text style={s.headerSub}>
            {total > 0 ? `${total} translation${total > 1 ? 's' : ''}` : 'No translations yet'}
          </Text>
        </View>
        {items.length > 0 && (
          <TouchableOpacity onPress={handleClearAll} style={s.clearBtn} activeOpacity={0.8}>
            <Text style={s.clearBtnTxt}>🗑 Clear All</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading && !items.length ? (
        <View style={s.centered}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={s.loadingTxt}>Loading history...</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => item._id}
          renderItem={renderItem}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyIcon}>🌐</Text>
              <Text style={s.emptyTitle}>No History Yet</Text>
              <Text style={s.emptyDesc}>Your translations will appear here once you start translating.</Text>
            </View>
          }
          ListFooterComponent={
            loadingMore
              ? <ActivityIndicator color={theme.colors.primary} style={{ paddingVertical: 20 }} />
              : null
          }
          onEndReached={() => { if (hasMore && !loadingMore) loadHistory(page + 1, true); }}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); loadHistory(1, false); }}
              tintColor={theme.colors.primary}
            />
          }
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

const makeStyles = (theme, isDark) => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 52 : 20,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 30, fontWeight: '800', color: theme.colors.text, letterSpacing: -0.5,
  },
  headerSub: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 3 },
  clearBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : '#FEE2E2',
  },
  clearBtnTxt: { fontSize: 13, color: '#EF4444', fontWeight: '700' },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingTxt: { fontSize: 14, color: theme.colors.textSecondary },

  listContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 48, flexGrow: 1 },

  // ── Card ──────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: isDark ? '#1E1E2E' : '#F5F6FF',
    borderRadius: 20, marginBottom: 14,
    borderWidth: 1, borderColor: isDark ? 'rgba(99,102,241,0.35)' : '#E0E2FF',
    overflow: 'hidden',
    shadowColor: isDark ? '#6366F1' : '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: isDark ? 0.3 : 0.08,
    shadowRadius: 10, elevation: isDark ? 6 : 3,
  },

  // Card header
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: isDark ? 'rgba(99,102,241,0.2)' : '#ECEEFF',
    borderBottomWidth: 1, borderBottomColor: isDark ? 'rgba(99,102,241,0.3)' : '#E0E2FF',
  },
  langRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  langBadge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
    backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.8)',
  },
  langBadgeTxt: { fontSize: 12, fontWeight: '700', color: isDark ? '#C7D2FE' : '#4338CA' },
  langBadgeTarget: { backgroundColor: '#6366F1' },
  langBadgeTargetTxt: { color: '#fff' },
  arrow: { fontSize: 14, color: isDark ? '#A5B4FC' : '#6366F1', fontWeight: '700' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  timeText: { fontSize: 11, color: isDark ? '#94A3B8' : theme.colors.textSecondary },
  deleteBtn: { padding: 2 },
  deleteTxt: { fontSize: 13, color: isDark ? '#F87171' : theme.colors.textSecondary },

  // Card body
  cardBody: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 4 },
  textBlock: { gap: 4 },
  textLabel: {
    fontSize: 10, fontWeight: '800', letterSpacing: 0.8,
    color: isDark ? '#94A3B8' : theme.colors.textSecondary, textTransform: 'uppercase',
  },
  sourceText: {
    fontSize: 14, color: isDark ? '#CBD5E1' : theme.colors.textSecondary, lineHeight: 21,
  },
  divider: {
    height: 1, backgroundColor: isDark ? 'rgba(99,102,241,0.25)' : theme.colors.border,
    marginVertical: 10,
  },
  translatedText: {
    fontSize: 16, color: isDark ? '#F1F5F9' : theme.colors.text,
    lineHeight: 24, fontWeight: '600',
  },

  // Card footer
  cardFooter: {
    flexDirection: 'row', alignItems: 'center',
    gap: 10,
    padding: 12,
    borderTopWidth: 1, borderTopColor: isDark ? 'rgba(99,102,241,0.25)' : '#E0E2FF',
    marginTop: 4,
  },
  copyBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 9, borderRadius: 12,
    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9',
    borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.12)' : '#E2E8F0',
  },
  copyBtnIcon: { fontSize: 14 },
  copyBtnTxt: { fontSize: 13, fontWeight: '700', color: isDark ? '#CBD5E1' : '#475569' },
  useAgainBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 9, borderRadius: 12,
    backgroundColor: isDark ? 'rgba(99,102,241,0.25)' : '#6366F1',
    borderWidth: 1, borderColor: isDark ? 'rgba(99,102,241,0.5)' : '#6366F1',
  },
  useAgainBtnIcon: { fontSize: 14 },
  useAgainBtnTxt: { fontSize: 13, fontWeight: '700', color: '#fff' },

  // old footer styles kept for safety
  footerBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11 },
  footerBtnPrimary: { backgroundColor: isDark ? 'rgba(99,102,241,0.18)' : 'rgba(99,102,241,0.08)' },
  footerDivider: { width: 1, height: '60%', backgroundColor: isDark ? 'rgba(99,102,241,0.25)' : theme.colors.border },
  footerBtnIcon: { fontSize: 14 },
  footerBtnTxt: { fontSize: 13, fontWeight: '700', color: isDark ? '#94A3B8' : theme.colors.textSecondary },

  // Empty state
  empty: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingTop: 100, paddingHorizontal: 40,
  },
  emptyIcon: { fontSize: 72, marginBottom: 20 },
  emptyTitle: {
    fontSize: 22, fontWeight: '800', color: theme.colors.text,
    marginBottom: 10, textAlign: 'center',
  },
  emptyDesc: {
    fontSize: 15, color: theme.colors.textSecondary,
    textAlign: 'center', lineHeight: 23,
  },
});

export default HistoryScreen;
