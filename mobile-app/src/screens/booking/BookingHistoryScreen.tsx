import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, SafeAreaView,
} from 'react-native';
import { useFocusEffect }                from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList }        from '../../navigation';
import { bookingApi }                from '../../api';
import { appLogger }                 from '../../utils/logger';
import { useTheme }                  from '../../context/ThemeContext';
import { SPACING, BORDER_RADIUS, FONTS } from '../../constants';
import { colors } from '../../theme/theme';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Main'> };

const STATUS_COLORS: Record<string, string> = {
  searching:            colors.warning,
  accepted:             colors.primary,
  worker_en_route:      colors.primary,
  in_progress:          colors.primary,
  completed:            colors.success,
  cancelled_by_customer: colors.error,
  cancelled_by_worker:  colors.error,
  expired:              colors.error,
};

export default function BookingHistoryScreen({ navigation }: Props) {
  const [bookings,   setBookings]   = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter,     setFilter]     = useState<string | undefined>();

  const FILTERS = [
    { label: 'All',       value: undefined },
    { label: 'Active',    value: 'in_progress' },
    { label: 'Completed', value: 'completed' },
    { label: 'Cancelled', value: 'cancelled_by_customer' },
  ];

  const fetchBookings = useCallback(async () => {
    try {
      const { data } = await bookingApi.getMyBookings({ status: filter });
      setBookings(data.data);
    } catch (err) {
      appLogger.error({ fn: 'fetchBookings', tag: 'BookingHistoryScreen_fetchBookings_failed', screen: 'BookingHistory' }, 'Failed to fetch bookings', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  // Refetch on every focus so a booking cancelled (or updated) on the
  // tracking screen shows its latest status when the user comes back.
  useFocusEffect(useCallback(() => { fetchBookings(); }, [fetchBookings]));

  const renderItem = ({ item }: { item: any }) => {
    const statusColor = STATUS_COLORS[item.status] || colors.textMuted;
    const isActive    = ['searching', 'accepted', 'worker_en_route', 'in_progress'].includes(item.status);

    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
        onPress={() => navigation.navigate('BookingTracking', { bookingId: item.bookingId || item._id })}
        activeOpacity={0.85}
      >
        <View style={styles.cardTop}>
          <View style={styles.serviceInfo}>
            <Text style={[styles.serviceLabel, { color: colors.textPrimary }]}>{item.serviceCategory?.replace(/_/g, ' ')}</Text>
            {item.serviceSubType && <Text style={[styles.subType, { color: colors.textSecondary }]}>{item.serviceSubType}</Text>}
          </View>
          <View style={[styles.statusPill, { backgroundColor: statusColor + '20' }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>
              {item.status.replace(/_/g, ' ')}
            </Text>
          </View>
        </View>

        <View style={styles.cardMeta}>
          <Text style={[styles.metaText, { color: colors.textSecondary }]}>📅 {new Date(item.schedule?.requestedDate).toLocaleDateString()}</Text>
          <Text style={[styles.metaText, { color: colors.textSecondary }]}>💰 ₹{item.pricing?.totalAmount}</Text>
          <Text style={[styles.metaText, { color: colors.textSecondary }]}>🕐 {item.schedule?.requestedTimeSlot}</Text>
        </View>

        {isActive && (
          <View style={[styles.trackBtn, { backgroundColor: colors.primary + '15' }]}>
            <Text style={[styles.trackBtnText, { color: colors.primary }]}>Track Live →</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface }]}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>My Bookings</Text>
      </View>

      {/* Filter tabs */}
      <View style={[styles.filterRow, { backgroundColor: colors.surface }]}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={String(f.value)}
            style={[styles.filterTab, filter === f.value && styles.filterTabActive]}
            onPress={() => { setFilter(f.value); setLoading(true); }}
          >
            <Text style={[styles.filterTabText, filter === f.value && styles.filterTabTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading
        ? <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
        : (
          <FlatList
            data={bookings}
            keyExtractor={(item) => item.bookingId || item._id}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchBookings(); }} tintColor={colors.primary} />}
            ListEmptyComponent={
              <View style={[styles.empty, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                <Text style={[styles.emptyIcon, { color: colors.textMuted }]}>📋</Text>
                <Text style={[styles.emptyText, { color: colors.textPrimary }]}>No bookings yet</Text>
                <Text style={[styles.emptyHint, { color: colors.textSecondary }]}>Book a service from the Home tab</Text>
              </View>
            }
          />
        )
      }
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:               { flex: 1, backgroundColor: colors.background },
  center:             { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header:             { padding: SPACING.md, paddingBottom: 0 },
  title:              { fontSize: FONTS.sizes.xl, fontWeight: '800', color: colors.textPrimary },
  filterRow:          { flexDirection: 'row', padding: SPACING.md, gap: SPACING.xs },
  filterTab:          { paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs, borderRadius: BORDER_RADIUS.full, backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.border },
  filterTabActive:    { backgroundColor: colors.primary },
  filterTabText:      { fontSize: FONTS.sizes.xs, fontWeight: '600', color: colors.textSecondary },
  filterTabTextActive:{ color: colors.white },
  list:               { padding: SPACING.md, gap: SPACING.sm },
  card:               { backgroundColor: colors.cardBg, borderRadius: BORDER_RADIUS.lg, padding: SPACING.md, elevation: 2, shadowColor: colors.shadow, shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  cardTop:            { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SPACING.sm },
  serviceInfo:        { flex: 1 },
  serviceLabel:       { fontSize: FONTS.sizes.base, fontWeight: '700', color: colors.textPrimary, textTransform: 'capitalize' },
  subType:            { fontSize: FONTS.sizes.xs, color: colors.textSecondary, marginTop: 2 },
  statusPill:         { paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: BORDER_RADIUS.full },
  statusText:         { fontSize: FONTS.sizes.xs, fontWeight: '700', textTransform: 'capitalize' },
  cardMeta:           { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  metaText:           { fontSize: FONTS.sizes.xs, color: colors.textSecondary },
  trackBtn:           { marginTop: SPACING.sm, backgroundColor: colors.primary + '15', borderRadius: BORDER_RADIUS.full, paddingVertical: 6, alignItems: 'center' },
  trackBtnText:       { fontSize: FONTS.sizes.xs, fontWeight: '700', color: colors.primary },
  empty:              { alignItems: 'center', paddingTop: 80 },
  emptyIcon:          { fontSize: 48, marginBottom: SPACING.md },
  emptyText:          { fontSize: FONTS.sizes.md, fontWeight: '700', color: colors.textPrimary },
  emptyHint:          { fontSize: FONTS.sizes.sm, color: colors.textMuted, marginTop: SPACING.xs },
});
