import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, SafeAreaView,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList }        from '../../navigation';
import { bookingApi }                from '../../api';
import { appLogger }                 from '../../utils/logger';
import { COLORS, SPACING, BORDER_RADIUS, FONTS } from '../../constants';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Main'> };

const STATUS_COLORS: Record<string, string> = {
  searching:            COLORS.warning,
  accepted:             COLORS.primary,
  worker_en_route:      COLORS.primary,
  in_progress:          COLORS.primary,
  completed:            COLORS.success,
  cancelled_by_customer: COLORS.error,
  cancelled_by_worker:  COLORS.error,
  expired:              COLORS.error,
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

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  const renderItem = ({ item }: { item: any }) => {
    const statusColor = STATUS_COLORS[item.status] || COLORS.textMuted;
    const isActive    = ['searching', 'accepted', 'worker_en_route', 'in_progress'].includes(item.status);

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('BookingTracking', { bookingId: item.bookingId })}
        activeOpacity={0.85}
      >
        <View style={styles.cardTop}>
          <View style={styles.serviceInfo}>
            <Text style={styles.serviceLabel}>{item.serviceCategory?.replace(/_/g, ' ')}</Text>
            {item.serviceSubType && <Text style={styles.subType}>{item.serviceSubType}</Text>}
          </View>
          <View style={[styles.statusPill, { backgroundColor: statusColor + '20' }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>
              {item.status.replace(/_/g, ' ')}
            </Text>
          </View>
        </View>

        <View style={styles.cardMeta}>
          <Text style={styles.metaText}>📅 {new Date(item.schedule?.requestedDate).toLocaleDateString()}</Text>
          <Text style={styles.metaText}>💰 ₹{item.pricing?.totalAmount}</Text>
          <Text style={styles.metaText}>🕐 {item.schedule?.requestedTimeSlot}</Text>
        </View>

        {isActive && (
          <View style={styles.trackBtn}>
            <Text style={styles.trackBtnText}>Track Live →</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>My Bookings</Text>
      </View>

      {/* Filter tabs */}
      <View style={styles.filterRow}>
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
        ? <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
        : (
          <FlatList
            data={bookings}
            keyExtractor={(item) => item._id}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchBookings(); }} tintColor={COLORS.primary} />}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyIcon}>📋</Text>
                <Text style={styles.emptyText}>No bookings yet</Text>
                <Text style={styles.emptyHint}>Book a service from the Home tab</Text>
              </View>
            }
          />
        )
      }
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:               { flex: 1, backgroundColor: COLORS.background },
  center:             { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header:             { padding: SPACING.md, paddingBottom: 0 },
  title:              { fontSize: FONTS.sizes.xl, fontWeight: '800', color: COLORS.textPrimary },
  filterRow:          { flexDirection: 'row', padding: SPACING.md, gap: SPACING.xs },
  filterTab:          { paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs, borderRadius: BORDER_RADIUS.full, backgroundColor: COLORS.border },
  filterTabActive:    { backgroundColor: COLORS.primary },
  filterTabText:      { fontSize: FONTS.sizes.xs, fontWeight: '600', color: COLORS.textSecondary },
  filterTabTextActive:{ color: COLORS.white },
  list:               { padding: SPACING.md, gap: SPACING.sm },
  card:               { backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.lg, padding: SPACING.md, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  cardTop:            { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SPACING.sm },
  serviceInfo:        { flex: 1 },
  serviceLabel:       { fontSize: FONTS.sizes.base, fontWeight: '700', color: COLORS.textPrimary, textTransform: 'capitalize' },
  subType:            { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary, marginTop: 2 },
  statusPill:         { paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: BORDER_RADIUS.full },
  statusText:         { fontSize: FONTS.sizes.xs, fontWeight: '700', textTransform: 'capitalize' },
  cardMeta:           { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  metaText:           { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary },
  trackBtn:           { marginTop: SPACING.sm, backgroundColor: COLORS.primary + '15', borderRadius: BORDER_RADIUS.full, paddingVertical: 6, alignItems: 'center' },
  trackBtnText:       { fontSize: FONTS.sizes.xs, fontWeight: '700', color: COLORS.primary },
  empty:              { alignItems: 'center', paddingTop: 80 },
  emptyIcon:          { fontSize: 48, marginBottom: SPACING.md },
  emptyText:          { fontSize: FONTS.sizes.md, fontWeight: '700', color: COLORS.textPrimary },
  emptyHint:          { fontSize: FONTS.sizes.sm, color: COLORS.textMuted, marginTop: SPACING.xs },
});
