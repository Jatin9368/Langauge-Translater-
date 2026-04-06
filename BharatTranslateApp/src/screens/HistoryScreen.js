import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../ThemeContext';
import { fetchHistory, deleteHistoryItem, clearAllHistory } from '../api';

const LIMIT = 20;

const HistoryScreen = () => {
  const { theme } = useTheme();
  const styles = makeStyles(theme);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [total, setTotal] = useState(0);

  const loadHistory = async (pageNum = 1, append = false) => {
    if (pageNum === 1) setLoading(true);
    else setLoadingMore(true);

    try {
      const result = await fetchHistory(pageNum, LIMIT);
      const newItems = result.data || [];
      setItems((prev) => (append ? [...prev, ...newItems] : newItems));
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

  // Reload when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadHistory(1, false);
    }, [])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadHistory(1, false);
  };

  const handleLoadMore = () => {
    if (!hasMore || loadingMore || loading) return;
    loadHistory(page + 1, true);
  };

  const handleDelete = (id) => {
    Alert.alert('Delete', 'Remove this translation from history?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteHistoryItem(id);
            setItems((prev) => prev.filter((i) => i._id !== id));
            setTotal((prev) => Math.max(0, prev - 1));
          } catch (err) {
            Alert.alert('Error', err.message || 'Could not delete item.');
          }
        },
      },
    ]);
  };

  const handleClearAll = () => {
    if (items.length === 0) return;
    Alert.alert('Clear All History', 'This will permanently delete all translation history.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear All',
        style: 'destructive',
        onPress: async () => {
          try {
            await clearAllHistory();
            setItems([]);
            setTotal(0);
            setHasMore(false);
          } catch (err) {
            Alert.alert('Error', err.message || 'Could not clear history.');
          }
        },
      },
    ]);
  };

  const formatDate = (dateStr) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.langBadgeRow}>
          <View style={styles.langBadge}>
            <Text style={styles.langBadgeText}>{item.sourceLangName || item.sourceLang}</Text>
          </View>
          <Text style={styles.arrowText}>→</Text>
          <View style={styles.langBadge}>
            <Text style={styles.langBadgeText}>{item.targetLangName || item.targetLang}</Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => handleDelete(item._id)}
          style={styles.deleteBtn}
          accessibilityRole="button"
          accessibilityLabel="Delete this history item"
        >
          <Text style={styles.deleteBtnText}>🗑</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sourceText} numberOfLines={2}>{item.sourceText}</Text>
      <View style={styles.divider} />
      <Text style={styles.translatedText} numberOfLines={3}>{item.translatedText}</Text>

      {item.emotion && item.emotionText ? (
        <View style={styles.emotionRow}>
          <Text style={styles.emotionLabel}>
            {item.emotion === 'love' ? '❤️' : item.emotion === 'sad' ? '😢' : item.emotion === 'angry' ? '😡' : '😄'}{' '}
            {item.emotion}
          </Text>
          <Text style={styles.emotionText} numberOfLines={2}>{item.emotionText}</Text>
        </View>
      ) : null}

      <Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>
    </View>
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  };

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>📜</Text>
        <Text style={styles.emptyTitle}>No History Yet</Text>
        <Text style={styles.emptyDesc}>Your translations will appear here.</Text>
      </View>
    );
  };

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>History</Text>
          {total > 0 && (
            <Text style={styles.headerCount}>{total} translation{total !== 1 ? 's' : ''}</Text>
          )}
        </View>
        {items.length > 0 && (
          <TouchableOpacity
            onPress={handleClearAll}
            style={styles.clearBtn}
            accessibilityRole="button"
            accessibilityLabel="Clear all history"
          >
            <Text style={styles.clearBtnText}>Clear All</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading && items.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={renderFooter}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={theme.colors.primary}
            />
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

const makeStyles = (theme) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.divider,
    },
    headerTitle: {
      fontSize: 22,
      fontWeight: '700',
      color: theme.colors.text,
    },
    headerCount: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    clearBtn: {
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 8,
      backgroundColor: '#FFEBEE',
    },
    clearBtnText: {
      fontSize: 13,
      color: theme.colors.error,
      fontWeight: '600',
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    listContent: {
      padding: 16,
      paddingBottom: 32,
      flexGrow: 1,
    },
    card: {
      backgroundColor: theme.colors.historyCard,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.historyBorder,
      padding: 14,
      marginBottom: 12,
      shadowColor: theme.colors.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
    },
    cardTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    langBadgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    langBadge: {
      backgroundColor: theme.colors.primaryLight,
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    langBadgeText: {
      fontSize: 12,
      color: theme.colors.primary,
      fontWeight: '600',
    },
    arrowText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
    deleteBtn: {
      padding: 6,
    },
    deleteBtnText: {
      fontSize: 18,
    },
    sourceText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      lineHeight: 20,
    },
    divider: {
      height: 1,
      backgroundColor: theme.colors.divider,
      marginVertical: 8,
    },
    translatedText: {
      fontSize: 15,
      color: theme.colors.text,
      lineHeight: 22,
      fontWeight: '500',
    },
    emotionRow: {
      marginTop: 8,
      padding: 8,
      backgroundColor: theme.colors.primaryLight,
      borderRadius: 8,
    },
    emotionLabel: {
      fontSize: 11,
      color: theme.colors.primary,
      fontWeight: '700',
      textTransform: 'uppercase',
      marginBottom: 4,
    },
    emotionText: {
      fontSize: 13,
      color: theme.colors.text,
      lineHeight: 18,
    },
    dateText: {
      fontSize: 11,
      color: theme.colors.textPlaceholder,
      marginTop: 10,
      textAlign: 'right',
    },
    footerLoader: {
      paddingVertical: 20,
      alignItems: 'center',
    },
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 80,
    },
    emptyIcon: {
      fontSize: 56,
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 8,
    },
    emptyDesc: {
      fontSize: 15,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
  });

export default HistoryScreen;
