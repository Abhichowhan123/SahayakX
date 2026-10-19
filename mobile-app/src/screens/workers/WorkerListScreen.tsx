import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Image, Alert, RefreshControl, SafeAreaView,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp }                 from '@react-navigation/native';
import { RootStackParamList }        from '../../navigation';
import { workerApi, bookingApi }     from '../../api';
import PriceOfferModal               from '../../components/booking/PriceOfferModal';
import { SPACING, BORDER_RADIUS, FONTS } from '../../constants';
import { useTheme }                  from '../../context/ThemeContext';
import { colors }                    from '../../theme/theme';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'WorkerList'>;
  route:      RouteProp<RootStackParamList, 'WorkerList'>;
};

interface Worker {
  _id:             string;
  fullName:        string;
  profilePhoto?:   string;
  bio:             string;
  experience:      number;
  serviceCategory: string;
  serviceSubTypes: string[];
  skills:          string[];
  languages:       string[];
  serviceArea:     string;
  availability:    { days: string[]; shift: string };
  ratings:         { average: number; totalReviews: number };
  pricing:         { hourlyRate: number; currency: string; isNegotiable: boolean; suggestedFares?: number[] };
  isOnline:        boolean;
}

export default function WorkerListScreen({ navigation, route }: Props) {
  const { category, subType, categoryLabel } = route.params;
  const { colors: themeColors } = useTheme();
  const [workers,          setWorkers]          = useState<Worker[]>([]);
  const [loading,          setLoading]          = useState(true);
  const [refreshing,       setRefreshing]       = useState(false);
  const [selectedWorker,   setSelectedWorker]   = useState<Worker | null>(null);
  const [priceModalVisible,setPriceModalVisible] = useState(false);
  const [page,             setPage]             = useState(1);
  const [hasMore,          setHasMore]          = useState(true);

  const fetchWorkers = useCallback(async (p = 1, reset = false) => {
    try {
      const { data } = await workerApi.getWorkers({ category, subType, page: p });
      const newList  = data.data as Worker[];
      setWorkers((prev) => reset ? newList : [...prev, ...newList]);
      setHasMore(p < data.pagination.totalPages);
      setPage(p);
    } catch {
      Alert.alert('Error', 'Could not load workers. Pull to refresh.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [category, subType]);

  useEffect(() => { fetchWorkers(1, true); }, [fetchWorkers]);

  const onRefresh = () => { setRefreshing(true); fetchWorkers(1, true); };
  const onEndReached = () => { if (hasMore && !loading) fetchWorkers(page + 1); };

  const handleBook = (worker: Worker) => {
    setSelectedWorker(worker);
    setPriceModalVisible(true);
  };

  const handleConfirmBooking = async (offeredPrice?: number) => {
    if (!selectedWorker) return;
    setPriceModalVisible(false);
    try {
      const today = new Date();
      const { data } = await bookingApi.create({
        workerId:          selectedWorker._id,
        serviceCategory:   category,
        serviceSubType:    subType,
        requestedDate:     today.toISOString().split('T')[0],
        requestedTimeSlot: 'now',
        estimatedDuration: 1,
        customerAddress:   {},
        paymentMethod:     'cash',
        customerOfferedPrice: offeredPrice,
      });
      navigation.navigate('BookingTracking', { bookingId: data.data.bookingId });
    } catch {
      Alert.alert('Booking Failed', 'Could not create booking. Please try again.');
    } finally {
      setSelectedWorker(null);
    }
  };

  const renderWorker = ({ item }: { item: Worker }) => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: themeColors.cardBg }]}
      onPress={() => navigation.navigate('WorkerProfile', { workerId: item._id })}
      activeOpacity={0.9}
    >
      <View style={styles.cardRow}>
        {/* Avatar */}
        <View style={styles.avatarWrap}>
          {item.profilePhoto
            ? <Image source={{ uri: item.profilePhoto }} style={styles.avatar} />
            : <View style={[styles.avatarPlaceholder, { backgroundColor: themeColors.primary + '20' }]}><Text style={[styles.avatarInitial, { color: themeColors.primary }]}>{item.fullName?.[0] || '?'}</Text></View>}
          {item.isOnline && <View style={[styles.onlineDot, { backgroundColor: themeColors.success, borderColor: themeColors.white }]} />}
        </View>

        {/* Info */}
        <View style={styles.info}>
          <Text style={[styles.name, { color: themeColors.textPrimary }]}>{item.fullName || 'Worker'}</Text>
          <Text style={[styles.exp, { color: themeColors.textSecondary }]}>{item.experience} yr exp</Text>
          <View style={styles.ratingRow}>
            <Text style={styles.star}>★</Text>
            <Text style={[styles.rating, { color: themeColors.textPrimary }]}>{item.ratings.average.toFixed(1)}</Text>
            <Text style={[styles.ratingCount, { color: themeColors.textMuted }]}>({item.ratings.totalReviews} reviews)</Text>
          </View>
        </View>

        {/* Price */}
        <View style={styles.priceCol}>
          <Text style={[styles.price, { color: themeColors.primary }]}>₹{item.pricing.hourlyRate}</Text>
          <Text style={[styles.priceUnit, { color: themeColors.textSecondary }]}>/hr</Text>
          {item.pricing.isNegotiable && <Text style={[styles.negotiable, { color: themeColors.success }]}>Negotiable</Text>}
        </View>
      </View>

      {/* Sub-type chips */}
      {item.serviceSubTypes?.length > 0 && (
        <View style={styles.chipsRow}>
          {item.serviceSubTypes.slice(0, 4).map(st => (
            <View key={st} style={[styles.chip, { backgroundColor: themeColors.primary + '15' }]}><Text style={[styles.chipText, { color: themeColors.primary }]}>{st}</Text></View>
          ))}
          {item.serviceSubTypes.length > 4 && (
            <View style={[styles.chip, { backgroundColor: themeColors.primary + '15' }]}><Text style={[styles.chipText, { color: themeColors.primary }]}>+{item.serviceSubTypes.length - 4}</Text></View>
          )}
        </View>
      )}

      {/* Meta row: location + availability */}
      <View style={styles.metaRow}>
        {item.serviceArea ? (
          <Text style={[styles.metaTag, { color: themeColors.textSecondary, backgroundColor: themeColors.inputBg }]} numberOfLines={1}>📍 {item.serviceArea}</Text>
        ) : null}
        {item.availability?.shift ? (
          <Text style={[styles.metaTag, { color: themeColors.textSecondary, backgroundColor: themeColors.inputBg }]}>🕐 {item.availability.shift}</Text>
        ) : null}
        {item.languages?.length > 0 && (
          <Text style={[styles.metaTag, { color: themeColors.textSecondary, backgroundColor: themeColors.inputBg }]}>🗣 {item.languages.slice(0, 2).join(', ')}</Text>
        )}
      </View>

      <TouchableOpacity style={[styles.bookBtn, { backgroundColor: themeColors.primary }]} onPress={() => handleBook(item)}>
        <Text style={[styles.bookBtnText, { color: themeColors.white }]}>Book Now</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  if (loading) return (
    <View style={[styles.center, { backgroundColor: themeColors.background }]}><ActivityIndicator size="large" color={themeColors.primary} /></View>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: themeColors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={[styles.back, { color: themeColors.textPrimary }]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: themeColors.textPrimary }]}>{categoryLabel}</Text>
        <View style={{ width: 32 }} />
      </View>

      <FlatList
        data={workers}
        keyExtractor={(item) => item._id}
        renderItem={renderWorker}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={themeColors.primary} />}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>😕</Text>
            <Text style={[styles.emptyText, { color: themeColors.textPrimary }]}>No workers available right now</Text>
            <Text style={[styles.emptyHint, { color: themeColors.textMuted }]}>Pull down to refresh or try a different category</Text>
          </View>
        }
        ListFooterComponent={hasMore ? <ActivityIndicator color={themeColors.primary} style={{ padding: SPACING.md }} /> : null}
      />

      {/* Price offer modal — matches the screenshot exactly */}
      {selectedWorker && (
        <PriceOfferModal
          visible={priceModalVisible}
          worker={selectedWorker}
          onClose={() => { setPriceModalVisible(false); setSelectedWorker(null); }}
          onBook={handleConfirmBooking}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:             { flex: 1 },
  center:           { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SPACING.md, borderBottomWidth: 1 },
  back:             { fontSize: 24, width: 32 },
  title:            { fontSize: FONTS.sizes.md, fontWeight: '700', flex: 1, textAlign: 'center' },
  list:             { padding: SPACING.md, gap: SPACING.sm },
  card:             { borderRadius: BORDER_RADIUS.lg, padding: SPACING.md, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  cardRow:          { flexDirection: 'row', marginBottom: SPACING.md },
  avatarWrap:       { position: 'relative', marginRight: SPACING.md },
  avatar:           { width: 64, height: 64, borderRadius: 32 },
  avatarPlaceholder:{ width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center' },
  avatarInitial:    { fontSize: FONTS.sizes.xl, fontWeight: '700' },
  onlineDot:        { position: 'absolute', bottom: 2, right: 2, width: 14, height: 14, borderRadius: 7, borderWidth: 2 },
  info:             { flex: 1 },
  name:             { fontSize: FONTS.sizes.base, fontWeight: '700' },
  exp:              { fontSize: FONTS.sizes.xs, marginTop: 2 },
  ratingRow:        { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  star:             { color: '#F59E0B', fontSize: FONTS.sizes.sm },
  rating:           { fontSize: FONTS.sizes.sm, fontWeight: '700', marginLeft: 2 },
  ratingCount:      { fontSize: FONTS.sizes.xs, marginLeft: 2 },
  priceCol:         { alignItems: 'flex-end', justifyContent: 'center' },
  price:            { fontSize: FONTS.sizes.lg, fontWeight: '800' },
  priceUnit:        { fontSize: FONTS.sizes.xs },
  negotiable:       { fontSize: FONTS.sizes.xs, fontWeight: '600', marginTop: 2 },
  chipsRow:         { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: SPACING.sm },
  chip:             { paddingHorizontal: SPACING.sm, paddingVertical: 3, borderRadius: BORDER_RADIUS.full },
  chipText:         { fontSize: FONTS.sizes.xs, fontWeight: '600' },
  metaRow:          { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: SPACING.sm },
  metaTag:          { fontSize: FONTS.sizes.xs, paddingHorizontal: SPACING.sm, paddingVertical: 3, borderRadius: BORDER_RADIUS.full, overflow: 'hidden' },
  bookBtn:          { borderRadius: BORDER_RADIUS.full, paddingVertical: SPACING.sm, alignItems: 'center' },
  bookBtnText:      { fontSize: FONTS.sizes.sm, fontWeight: '700' },
  empty:            { alignItems: 'center', paddingTop: 80 },
  emptyIcon:        { fontSize: 48, marginBottom: SPACING.md },
  emptyText:        { fontSize: FONTS.sizes.md, fontWeight: '700' },
  emptyHint:        { fontSize: FONTS.sizes.sm, marginTop: SPACING.xs, textAlign: 'center' },
});
