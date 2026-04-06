import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  TextInput,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { useTheme } from '../ThemeContext';

const LanguagePicker = ({ languages, selectedCode, onSelect, label }) => {
  const { theme } = useTheme();
  const [visible, setVisible] = useState(false);
  const [search, setSearch] = useState('');

  const selected = languages.find((l) => l.code === selectedCode);

  const filtered = languages.filter((l) =>
    l.name.toLowerCase().includes(search.toLowerCase())
  );

  const styles = makeStyles(theme);

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.item, item.code === selectedCode && styles.itemActive]}
      onPress={() => {
        onSelect(item.code);
        setVisible(false);
        setSearch('');
      }}
      accessibilityRole="button"
      accessibilityLabel={`Select ${item.name}`}
    >
      <Text style={styles.itemFlag}>{item.flag}</Text>
      <Text style={[styles.itemName, item.code === selectedCode && styles.itemNameActive]}>
        {item.name}
      </Text>
      {item.code === selectedCode && (
        <Text style={styles.checkmark}>✓</Text>
      )}
    </TouchableOpacity>
  );

  return (
    <>
      <TouchableOpacity
        style={styles.trigger}
        onPress={() => setVisible(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected?.name || 'Select'}`}
      >
        <Text style={styles.triggerFlag}>{selected?.flag || '🌐'}</Text>
        <Text style={styles.triggerText} numberOfLines={1}>
          {selected?.name || 'Select'}
        </Text>
        <Text style={styles.chevron}>▾</Text>
      </TouchableOpacity>

      <Modal
        visible={visible}
        animationType="slide"
        transparent
        onRequestClose={() => { setVisible(false); setSearch(''); }}
      >
        <View style={styles.overlay}>
          <SafeAreaView style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{label}</Text>
              <TouchableOpacity
                onPress={() => { setVisible(false); setSearch(''); }}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.searchInput}
              placeholder="Search language..."
              placeholderTextColor={theme.colors.textPlaceholder}
              value={search}
              onChangeText={setSearch}
              autoFocus
            />
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.code}
              renderItem={renderItem}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            />
          </SafeAreaView>
        </View>
      </Modal>
    </>
  );
};

const makeStyles = (theme) =>
  StyleSheet.create({
    trigger: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surfaceVariant,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
      gap: 4,
    },
    triggerFlag: {
      fontSize: 18,
    },
    triggerText: {
      flex: 1,
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.text,
    },
    chevron: {
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
    overlay: {
      flex: 1,
      backgroundColor: theme.colors.overlay,
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '80%',
      paddingBottom: 20,
    },
    sheetHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.divider,
    },
    sheetTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.colors.text,
    },
    closeBtn: {
      fontSize: 18,
      color: theme.colors.textSecondary,
      padding: 4,
    },
    searchInput: {
      marginHorizontal: 16,
      marginVertical: 10,
      backgroundColor: theme.colors.surfaceVariant,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 15,
      color: theme.colors.text,
    },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 13,
      gap: 12,
    },
    itemActive: {
      backgroundColor: theme.colors.primaryLight,
    },
    itemFlag: {
      fontSize: 22,
    },
    itemName: {
      flex: 1,
      fontSize: 15,
      color: theme.colors.text,
    },
    itemNameActive: {
      color: theme.colors.primary,
      fontWeight: '600',
    },
    checkmark: {
      fontSize: 16,
      color: theme.colors.primary,
      fontWeight: '700',
    },
  });

export default LanguagePicker;
