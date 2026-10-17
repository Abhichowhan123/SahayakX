import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, TextInput, FlatList, Modal,
  SafeAreaView,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList }        from '../../navigation';
import { useAuth }                   from '../../context/AuthContext';
import {
  SERVICE_CATEGORIES, CONSTRUCTION_SUBTYPES,
  TEACHER_SUBTYPES, GARDEN_SUBTYPES, ELECTRICIAN_SUBTYPES,
  PLUMBER_SUBTYPES, MAID_SUBTYPES, GYM_SUBTYPES,
  COOK_SUBTYPES, DRIVER_SUBTYPES, PEST_SUBTYPES,
  AC_SUBTYPES, BABYSITTER_SUBTYPES, PET_CARE_SUBTYPES,
  SERVICE_SUBTYPES_MAP,
  COLORS, SPACING, BORDER_RADIUS, FONTS,
} from '../../constants';
import { userApi } from '../../api';

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
  const [search,        setSearch]        = useState('');
  const [subTypeModal,  setSubTypeModal]  = useState<{ category: typeof SERVICE_CATEGORIES[0]; options: string[] } | null>(null);
  const [customerName,  setCustomerName]  = useState<string | null>(null);

  useEffect(() => {
    userApi.getProfile()
      .then(({ data }) => setCustomerName(data?.data?.fullName || null))
      .catch(() => {});
  }, []);

  const filtered = SERVICE_CATEGORIES.filter((c) =>
    c.label.toLowerCase().includes(search.toLowerCase()),
  );

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
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{getGreeting()}, {customerName || user?.phone} 👋</Text>
            <Text style={styles.phone}>{user?.phone}</Text>
          </View>
          {user?.role === 'worker' && (
            <TouchableOpacity style={styles.modeToggle} onPress={() => setWorkerMode(!isWorkerMode)}>
              <Text style={styles.modeText}>{isWorkerMode ? 'Switch to Customer' : 'Worker Mode'}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Search bar */}
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search for a service..."
            placeholderTextColor={COLORS.textMuted}
          />
        </View>

        {/* Banner */}
        <View style={styles.banner}>
          <Text style={styles.bannerTitle}>Book a service in minutes</Text>
          <Text style={styles.bannerSub}>Verified professionals at your doorstep</Text>
        </View>

        {/* Categories grid */}
        <Text style={styles.sectionTitle}>Our Services</Text>
        <View style={styles.grid}>
          {filtered.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[styles.card, { backgroundColor: cat.color }]}
              onPress={() => handleCategoryPress(cat)}
              activeOpacity={0.8}
            >
              <Text style={styles.cardIcon}>{cat.icon}</Text>
              <Text style={styles.cardLabel}>{cat.label}</Text>
              {cat.hasSubTypes && <Text style={styles.cardArrow}>›</Text>}
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.bottomPad} />
      </ScrollView>

      {/* Sub-type selection modal */}
      <Modal visible={!!subTypeModal} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setSubTypeModal(null)} activeOpacity={1}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>
              {subTypeModal?.category.label} — Select type
            </Text>
            <FlatList
              data={subTypeModal?.options}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.subTypeItem} onPress={() => handleSubTypeSelect(item)}>
                  <Text style={styles.subTypeText}>{item}</Text>
                  <Text style={styles.subTypeArrow}>›</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: COLORS.background },
  container:      { flex: 1, paddingHorizontal: SPACING.md },
  header:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: SPACING.md, paddingBottom: SPACING.md },
  greeting:       { fontSize: FONTS.sizes.lg, fontWeight: '700', color: COLORS.textPrimary },
  phone:          { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, marginTop: 2 },
  modeToggle:     { backgroundColor: COLORS.primary + '15', paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs, borderRadius: BORDER_RADIUS.full },
  modeText:       { fontSize: FONTS.sizes.xs, color: COLORS.primary, fontWeight: '700' },
  searchBar:      { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.md, paddingHorizontal: SPACING.md, marginBottom: SPACING.md, elevation: 2, shadowColor: COLORS.shadow, shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  searchIcon:     { fontSize: FONTS.sizes.base, marginRight: SPACING.sm },
  searchInput:    { flex: 1, fontSize: FONTS.sizes.base, paddingVertical: SPACING.md, color: COLORS.textPrimary },
  banner:         { backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.lg, padding: SPACING.lg, marginBottom: SPACING.lg },
  bannerTitle:    { fontSize: FONTS.sizes.lg, fontWeight: '800', color: COLORS.white },
  bannerSub:      { fontSize: FONTS.sizes.sm, color: COLORS.white + 'CC', marginTop: SPACING.xs },
  sectionTitle:   { fontSize: FONTS.sizes.md, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.md },
  grid:           { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  card:           { width: '47%', borderRadius: BORDER_RADIUS.lg, padding: SPACING.md, alignItems: 'center', minHeight: 100, justifyContent: 'center', position: 'relative' },
  cardIcon:       { fontSize: 32, marginBottom: SPACING.xs },
  cardLabel:      { fontSize: FONTS.sizes.sm, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },
  cardArrow:      { position: 'absolute', top: SPACING.sm, right: SPACING.sm, fontSize: FONTS.sizes.md, color: COLORS.textSecondary },
  bottomPad:      { height: SPACING.xl },
  modalOverlay:   { flex: 1, backgroundColor: '#00000066', justifyContent: 'flex-end' },
  modalSheet:     { backgroundColor: COLORS.white, borderTopLeftRadius: BORDER_RADIUS.xl, borderTopRightRadius: BORDER_RADIUS.xl, padding: SPACING.lg, maxHeight: '70%' },
  modalHandle:    { width: 40, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: 'center', marginBottom: SPACING.md },
  modalTitle:     { fontSize: FONTS.sizes.md, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.md },
  subTypeItem:    { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  subTypeText:    { fontSize: FONTS.sizes.base, color: COLORS.textPrimary },
  subTypeArrow:   { fontSize: FONTS.sizes.md, color: COLORS.textMuted },
});
