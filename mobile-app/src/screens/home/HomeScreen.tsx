import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, TextInput, FlatList, Modal,
  SafeAreaView,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList }        from '../../navigation';
import { useAuth }                   from '../../context/AuthContext';
import { useTheme }                  from '../../context/ThemeContext';
import {
  SERVICE_CATEGORIES,
  CONSTRUCTION_SUBTYPES,
  TEACHER_SUBTYPES, GARDEN_SUBTYPES, ELECTRICIAN_SUBTYPES,
  PLUMBER_SUBTYPES, MAID_SUBTYPES, GYM_SUBTYPES,
  COOK_SUBTYPES, DRIVER_SUBTYPES, PEST_SUBTYPES,
  AC_SUBTYPES, BABYSITTER_SUBTYPES, PET_CARE_SUBTYPES,
  SERVICE_SUBTYPES_MAP,
  SPACING, BORDER_RADIUS, FONTS,
} from '../../constants';
import { userApi } from '../../api';
import { colors } from '../../theme/theme';

const getGreeting = () => {
  const h = new Date().getHours();
  if (h >= 5  && h < 12) return 'Good morning';
  if (h >= 12 && h < 17) return 'Good afternoon';
  if (h >= 17 && h < 21) return 'Good evening';
  return 'Good night';
};

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Main'> };

export default function HomeScreen({ navigation }: Props) {
  const { user, isWorkerMode, setWorkerMode } = useAuth();
  const { colors: themeColors } = useTheme();
  const [search,        setSearch]        = useState('');
  const [subTypeModal,  setSubTypeModal]  = useState<{ category: typeof SERVICE_CATEGORIES[0]; options: string[] } | null>(null);
  const [customerName,  setCustomerName]  = useState<string | null>(null);

  useEffect(() => {
    userApi.getProfile()
      .then(({ data }) => setCustomerName(data?.data?.fullName || null))
      .catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return SERVICE_CATEGORIES.filter((c) => {
      if (c.label.toLowerCase().includes(q)) return true;
      const options = SERVICE_SUBTYPES_MAP[c.id] || [];
      return options.some((o) => o.toLowerCase().includes(q));
    });
  }, [search]);

  const handleCategoryPress = (cat: typeof SERVICE_CATEGORIES[0]) => {
    if (cat.hasSubTypes) {
      const options = SERVICE_SUBTYPES_MAP[cat.id] || [];
      setSubTypeModal({ category: cat, options });
    } else {
      navigation.navigate('WorkerList', { category: cat.id, categoryLabel: cat.label });
    }
  };

  const handleSubTypeSelect = (subType: string) => {
    if (!subTypeModal) return;
    setSubTypeModal(null);
    navigation.navigate('WorkerList', {
      category:      subTypeModal.category.id,
      subType,
      categoryLabel: `${subTypeModal.category.label} › ${subType}`,
    });
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView style={[styles.container, { backgroundColor: colors.background }]} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.background }]}>
          <View>
            <Text style={[styles.greeting, { color: colors.textPrimary }]}>{getGreeting()}, {customerName || user?.phone} 👋</Text>
            <Text style={[styles.phone, { color: colors.textSecondary }]}>{user?.phone}</Text>
          </View>
          {user?.role === 'worker' && (
            <TouchableOpacity style={[styles.modeToggle, { backgroundColor: themeColors.primary + '15' }]} onPress={() => setWorkerMode(!isWorkerMode)}>
              <Text style={[styles.modeText, { color: themeColors.primary }]}>{isWorkerMode ? 'Switch to Customer' : 'Worker Mode'}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Search bar */}
        <View style={[styles.searchBar, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border }]}>
          <Text style={[styles.searchIcon, { color: themeColors.textSecondary }]}>🔍</Text>
          <TextInput
            style={[styles.searchInput, { color: themeColors.textPrimary }]}
            value={search}
            onChangeText={setSearch}
            placeholder="Search for a service..."
            placeholderTextColor={themeColors.textMuted}
          />
        </View>

        {/* Banner */}
        <View style={[styles.banner, { backgroundColor: colors.primary }]}>
          <Text style={[styles.bannerTitle, { color: colors.white }]}>Book a service in minutes</Text>
          <Text style={[styles.bannerSub, { color: colors.white + 'CC' }]}>Verified professionals at your doorstep</Text>
        </View>

        {/* Categories grid */}
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Our Services</Text>
        <View style={styles.grid}>
          {filtered.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[styles.card, { backgroundColor: colors.accentTile }]}
              onPress={() => handleCategoryPress(cat)}
              activeOpacity={0.8}
            >
              <Text style={[styles.cardIcon, { color: colors.primary }]}>{cat.icon}</Text>
              <Text style={[styles.cardLabel, { color: colors.textPrimary }]}>{cat.label}</Text>
              {cat.hasSubTypes && <Text style={[styles.cardArrow, { color: colors.textSecondary }]}>›</Text>}
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.bottomPad} />

        {/* Sub-type selection modal */}
        <Modal visible={!!subTypeModal} transparent animationType="slide">
          <TouchableOpacity style={styles.modalOverlay} onPress={() => setSubTypeModal(null)} activeOpacity={1}>
            <View style={[styles.modalSheet, { backgroundColor: colors.cardBg }]}>
              <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                {subTypeModal?.category.label} — Select type
              </Text>
              <FlatList
                data={subTypeModal?.options}
                keyExtractor={(item) => item}
                renderItem={({ item }) => (
                  <TouchableOpacity style={[styles.subTypeItem, { borderBottomColor: colors.border }]} onPress={() => handleSubTypeSelect(item)}>
                    <Text style={[styles.subTypeText, { color: colors.textPrimary }]}>{item}</Text>
                    <Text style={[styles.subTypeArrow, { color: colors.textMuted }]}>›</Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          </TouchableOpacity>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:           { flex: 1 },
  container:      { flex: 1, paddingHorizontal: SPACING.md },
  content:        { gap: SPACING.md },
  header:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: SPACING.md, paddingBottom: SPACING.md },
  greeting:       { fontSize: FONTS.sizes.lg, fontWeight: '700', color: colors.textPrimary },
  phone:          { fontSize: FONTS.sizes.sm, color: colors.textSecondary, marginTop: 2 },
  modeToggle:     { backgroundColor: colors.primary + '15', paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs, borderRadius: BORDER_RADIUS.full },
  modeText:       { fontSize: FONTS.sizes.xs, color: colors.primary, fontWeight: '700' },
  searchBar:      { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.inputBg, borderRadius: BORDER_RADIUS.md, paddingHorizontal: SPACING.md, marginBottom: SPACING.md, elevation: 2, shadowColor: colors.shadow, shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  searchIcon:     { fontSize: FONTS.sizes.base, marginRight: SPACING.sm },
  searchInput:    { flex: 1, fontSize: FONTS.sizes.base, paddingVertical: SPACING.md, color: colors.textPrimary },
  banner:         { backgroundColor: colors.primary, borderRadius: BORDER_RADIUS.lg, padding: SPACING.lg, marginBottom: SPACING.lg },
  bannerTitle:    { fontSize: FONTS.sizes.lg, fontWeight: '800', color: colors.white },
  bannerSub:      { fontSize: FONTS.sizes.sm, color: colors.white + 'CC', marginTop: SPACING.xs },
  sectionTitle:   { fontSize: FONTS.sizes.md, fontWeight: '700', color: colors.textPrimary, marginBottom: SPACING.md },
  grid:           { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  card:           { width: '47%', borderRadius: BORDER_RADIUS.lg, padding: SPACING.md, alignItems: 'center', minHeight: 100, justifyContent: 'center', position: 'relative' },
  cardIcon:       { fontSize: 32, marginBottom: SPACING.xs },
  cardLabel:      { fontSize: FONTS.sizes.sm, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' },
  cardArrow:      { position: 'absolute', top: SPACING.sm, right: SPACING.sm, fontSize: FONTS.sizes.md, color: colors.textSecondary },
  bottomPad:      { height: SPACING.xl },
  modalOverlay:   { flex: 1, backgroundColor: '#00000066', justifyContent: 'flex-end' },
  modalSheet:     { backgroundColor: colors.cardBg, borderTopLeftRadius: BORDER_RADIUS.xl, borderTopRightRadius: BORDER_RADIUS.xl, padding: SPACING.lg, maxHeight: '70%' },
  modalHandle:    { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: SPACING.md },
  modalTitle:     { fontSize: FONTS.sizes.md, fontWeight: '700', color: colors.textPrimary, marginBottom: SPACING.md },
  subTypeItem:    { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  subTypeText:    { fontSize: FONTS.sizes.base, color: colors.textPrimary },
  subTypeArrow:   { fontSize: FONTS.sizes.md, color: colors.textMuted },
});
