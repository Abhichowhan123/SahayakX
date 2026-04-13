import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Alert, Switch, SafeAreaView, ActivityIndicator,
} from 'react-native';
import { bookingApi, workerApi } from '../../api';
import { COLORS, SPACING, BORDER_RADIUS, FONTS } from '../../constants';

export default function WorkerDashboard() {
  const [pendingBookings, setPendingBookings] = useState<any[]>([]);
  const [activeBooking,   setActiveBooking]   = useState<any>(null);
  const [isOnline,        setIsOnline]        = useState(false);
  const [loading,         setLoading]         = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [pending, active] = await Promise.all([
          bookingApi.getMyBookings({ status: 'searching' }),
          bookingApi.getMyBookings({ status: 'accepted' }),
        ]);
        setPendingBookings(pending.data.data);
        setActiveBooking(active.data.data?.[0] || null);
      } catch { /* silent */ }
      finally { setLoading(false); }
    };
    load();
    // Poll every 10 seconds for new booking requests
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleOnline = async (val: boolean) => {
    try {
      await workerApi.toggleOnline(val);
      setIsOnline(val);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Could not update status');
    }
  };

  const handleAccept = async (bookingId: string) => {
    try {
      const { data } = await bookingApi.accept(bookingId);
      Alert.alert('Accepted!', `Show this OTP to start: ${data.data.otp}`);
      setPendingBookings((prev) => prev.filter((b) => b.bookingId !== bookingId));
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Could not accept booking');
    }
  };

  const handleDecline = (bookingId: string) => {
    setPendingBookings((prev) => prev.filter((b) => b.bookingId !== bookingId));
  };

  const renderRequest = ({ item }: { item: any }) => (
    <View style={styles.requestCard}>
      <View style={styles.requestHeader}>
        <Text style={styles.requestService}>{item.serviceCategory?.replace(/_/g, ' ')}</Text>
        <Text style={styles.requestAmount}>₹{item.pricing?.totalAmount}</Text>
      </View>
      <Text style={styles.requestTime}>📅 {item.schedule?.requestedDate} · {item.schedule?.requestedTimeSlot}</Text>
      <Text style={styles.requestDuration}>⏱️ ~{item.schedule?.estimatedDuration}hr job</Text>

      <View style={styles.requestBtns}>
        <TouchableOpacity style={styles.declineBtn} onPress={() => handleDecline(item.bookingId)}>
          <Text style={styles.declineBtnText}>Decline</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.acceptBtn} onPress={() => handleAccept(item.bookingId)}>
          <Text style={styles.acceptBtnText}>Accept</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Dashboard</Text>
        <View style={styles.onlineRow}>
          <Text style={styles.onlineLabel}>{isOnline ? 'Online' : 'Offline'}</Text>
          <Switch value={isOnline} onValueChange={handleToggleOnline} trackColor={{ true: COLORS.primary }} />
        </View>
      </View>

      {/* Active job banner */}
      {activeBooking && (
        <View style={styles.activeBanner}>
          <Text style={styles.activeBannerText}>🔨 Active job in progress</Text>
          <Text style={styles.activeBannerSub}>{activeBooking.serviceCategory?.replace(/_/g, ' ')} · ₹{activeBooking.pricing?.totalAmount}</Text>
        </View>
      )}

      {/* New requests */}
      <Text style={styles.sectionTitle}>
        {pendingBookings.length > 0
          ? `${pendingBookings.length} New Request${pendingBookings.length > 1 ? 's' : ''}`
          : 'No new requests'}
      </Text>

      {pendingBookings.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>{isOnline ? '⏳' : '😴'}</Text>
          <Text style={styles.emptyText}>{isOnline ? 'Waiting for booking requests...' : 'Go online to receive bookings'}</Text>
        </View>
      )}

      <FlatList
        data={pendingBookings}
        keyExtractor={(item) => item._id}
        renderItem={renderRequest}
        contentContainerStyle={styles.list}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:             { flex: 1, backgroundColor: COLORS.background },
  center:           { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.md, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  title:            { fontSize: FONTS.sizes.xl, fontWeight: '800', color: COLORS.textPrimary },
  onlineRow:        { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  onlineLabel:      { fontSize: FONTS.sizes.sm, fontWeight: '600', color: COLORS.textSecondary },
  activeBanner:     { backgroundColor: COLORS.primary, padding: SPACING.md },
  activeBannerText: { fontSize: FONTS.sizes.base, fontWeight: '700', color: COLORS.white },
  activeBannerSub:  { fontSize: FONTS.sizes.xs, color: COLORS.white + 'CC', marginTop: 2 },
  sectionTitle:     { fontSize: FONTS.sizes.md, fontWeight: '700', color: COLORS.textPrimary, padding: SPACING.md, paddingBottom: SPACING.sm },
  list:             { padding: SPACING.md, paddingTop: 0, gap: SPACING.sm },
  requestCard:      { backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.lg, padding: SPACING.md, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  requestHeader:    { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.xs },
  requestService:   { fontSize: FONTS.sizes.base, fontWeight: '700', color: COLORS.textPrimary, textTransform: 'capitalize' },
  requestAmount:    { fontSize: FONTS.sizes.base, fontWeight: '800', color: COLORS.primary },
  requestTime:      { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary, marginBottom: 2 },
  requestDuration:  { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary, marginBottom: SPACING.md },
  requestBtns:      { flexDirection: 'row', gap: SPACING.sm },
  declineBtn:       { flex: 1, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: BORDER_RADIUS.full, paddingVertical: SPACING.sm, alignItems: 'center' },
  declineBtnText:   { fontSize: FONTS.sizes.sm, fontWeight: '600', color: COLORS.textSecondary },
  acceptBtn:        { flex: 2, backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.full, paddingVertical: SPACING.sm, alignItems: 'center' },
  acceptBtnText:    { fontSize: FONTS.sizes.sm, fontWeight: '700', color: COLORS.white },
  emptyState:       { alignItems: 'center', paddingTop: 60 },
  emptyIcon:        { fontSize: 48, marginBottom: SPACING.md },
  emptyText:        { fontSize: FONTS.sizes.base, color: COLORS.textSecondary, textAlign: 'center' },
});
