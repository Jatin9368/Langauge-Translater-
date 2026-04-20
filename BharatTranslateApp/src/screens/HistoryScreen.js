import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, RefreshControl, Clipboard,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../ThemeContext';
import { fetchHistory, deleteHistoryItem, clearAllHistory } from '../api';

const LIMIT = 20;

const HistoryScreen = ({ navigation }) => {
  const { theme, isDark } = useTheme();
  const s = makeStyles(theme, isDark);

  const [items, setItems]           = useState([]);
  const [loading, setLoading]       = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage]             = useState(1);
  const [hasMore, setHasMore]       = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [total, setTotal]           = useState(0);

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
    Alert.alert('Delete', 'Remove this item?', [
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
    Alert.alert('Clear All', 'Delete all history?', [
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
      return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    } catch { return d; }
  };

  const renderItem = ({ item, index }) => (
    <View style={s.card}>
      {/* Top row — lang badges + delete */}
      <View style={s.cardTop}>
        <View style={s.langPill}>
          <Text style={s.langFrom}>{item.sourceLangName || item.sourceLang}</Text>
          <Text style={s.langArrow}>›</Text>
          <Text style={s.langTo}>{item.targetLangName || item.targetLang}</Text>
        </View>
        <View style={s.cardTopRight}>
          <Text style={s.timeText}>{formatDate(item.createdAt)}</Text>
          <TouchableOpacity onPress={() => handleDelete(item._id)} style={s.deleteBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={s.deleteBtnText}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Source text */}
      <Text style={s.sourceText} numberOfLines={2}>{item.sourceText}</Text>

      {/* Translated text */}
      <View style={s.translatedBox}>
        <Text style={s.translatedText} numberOfLines={3}>{item.translatedText}</Text>
      </View>

      {/* Actions */}
      <View style={s.actions}>
        <TouchableOpacity
          style={s.actionBtn}
          onPress={() => { Clipboard.setString(item.translatedText); Alert.alert('Copied!'); }}
        >
          <Text style={s.actionBtnTxt}>📋 Copy</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.actionBtn, s.actionBtnRetranslate]}
          onPress={() => navigation.navigate('Home', {
            retranslate: {
              text: item.sourceText,
              sourceLang: item.sourceLang,
              targetLang: item.targetLang,
              translatedText: item.translatedText,
            }
          })}
        >
          <Text style={[s.actionBtnTxt, s.actionBtnTxtRetranslate]}>🔄 Retranslate</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>History</Text>
          <Text style={s.headerSub}>{total > 0 ? `${total} translations` : 'No translations yet'}</Text>
        </View>
        {items.length > 0 && (
          <TouchableOpacity onPress={handleClearAll} style={s.clearBtn}>
            <Text style={s.clearBtnText}>🗑 Clear All</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading && !items.length ? (
        <View style={s.centered}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={s.loadingText}>Loading history...</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => item._id}
          renderItem={renderItem}
          ListEmptyComponent={
            <View style={s.emptyContainer}>
              <Text style={s.emptyIcon}>📜</Text>
              <Text style={s.emptyTitle}>No History Yet</Text>
              <Text style={s.emptyDesc}>Your translations will appear here automatically.</Text>
            </View>
          }
          ListFooterComponent={
            loadingMore
              ? <ActivityIndicator color={theme.colors.primary} style={{ padding: 20 }} />
              : null
          }
          onEndReached={() => { if (hasMore && !loadingMore) loadHistory(page + 1, true); }}
          onEndReachedThreshold={0.3}
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
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  headerTitle: { fontSize: 26, fontWeight: '800', color: theme.colors.text, letterSpacing: -0.5 },
  headerSub: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 2 },
  clearBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12,
    backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : '#FEE2E2',
  },
  clearBtnText: { fontSize: 13, color: '#EF4444', fontWeight: '700' },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: theme.colors.textSecondary },

  listContent: { padding: 16, paddingBottom: 40, flexGrow: 1 },

  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 20, marginBottom: 14,
    borderWidth: 1, borderColor: theme.colors.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: isDark ? 0.2 : 0.07,
    shadowRadius: 8, elevation: 3,
  },

  cardTop: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 14, paddingTop: 12, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
    backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
  },
  langPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: theme.colors.primaryLight,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  langFrom: { fontSize: 12, fontWeight: '700', color: theme.colors.primary },
  langArrow: { fontSize: 14, color: theme.colors.primary, fontWeight: '800' },
  langTo: { fontSize: 12, fontWeight: '700', color: theme.colors.primary },
  cardTopRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  timeText: { fontSize: 11, color: theme.colors.textSecondary },
  deleteBtn: { padding: 2 },
  deleteBtnText: { fontSize: 13, color: theme.colors.textSecondary },

  sourceText: {
    fontSize: 14, color: theme.colors.textSecondary,
    lineHeight: 20, paddingHorizontal: 14, paddingTop: 12,
  },

  translatedBox: {
    marginHorizontal: 14, marginTop: 8, marginBottom: 4,
    backgroundColor: isDark ? 'rgba(99,102,241,0.08)' : 'rgba(99,102,241,0.05)',
    borderRadius: 12, padding: 10,
    borderLeftWidth: 3, borderLeftColor: theme.colors.primary,
  },
  translatedText: {
    fontSize: 16, color: theme.colors.text,
    lineHeight: 24, fontWeight: '600',
  },

  actions: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  actionBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 10,
    backgroundColor: theme.colors.primaryLight, alignItems: 'center',
  },
  actionBtnSecondary: {
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
  },
  actionBtnRetranslate: {
    backgroundColor: isDark ? 'rgba(16,185,129,0.15)' : 'rgba(16,185,129,0.08)',
  },
  actionBtnTxt: { fontSize: 13, color: theme.colors.primary, fontWeight: '700' },
  actionBtnTxtRetranslate: { color: '#10B981' },

  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 64, marginBottom: 20 },
  emptyTitle: { fontSize: 22, fontWeight: '800', color: theme.colors.text, marginBottom: 10 },
  emptyDesc: { fontSize: 15, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 22 },
});

export default HistoryScreen;
