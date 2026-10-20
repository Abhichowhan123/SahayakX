import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Alert, Switch, SafeAreaView, ActivityIndicator,
} from 'react-native';
import { bookingApi, workerApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, BORDER_RADIUS, FONTS } from '../../constants';

export default function WorkerDashboard() {
  const { isOnline, setOnline } = useAuth();
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const [pendingBookings, setPendingBookings] = useState<any[]>([]);
  const [activeBooking,   setActiveBooking]   = useState<any>(null);
  const [loading,         setLoading]         = useState(true);

  const loadData = async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      const profileRes = await workerApi.getMyProfile().catch(() => null);
      const [pending, active] = await Promise.all([
        bookingApi.getAvailable({ category: profileRes?.data?.data?.serviceCategory }),
        bookingApi.getMyBookings({ status: 'accepted' }),
      ]);
      setPendingBookings(pending.data.data);
      setActiveBooking(active.data.data?.[0] || null);
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  useEffect(() => {
    loadData(true);
    // Poll every 10 seconds for new booking requests
    const interval = setInterval(() => loadData(false), 10000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleOnline = async (val: boolean) => {
    try {
      await setOnline(val);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Could not update status');
    }
  };

  const handleAccept = async (bookingId: string) => {
    try {
      const { data } = await bookingApi.accept(bookingId);
      Alert.alert('Accepted!', `Show this OTP to start: ${data.data.otp}`);
      setPendingBookings((prev) => prev.filter((b) => b.bookingId !== bookingId));
      await loadData(false);
      navigation.navigate('BookingTracking', { bookingId });
    } catch (err: any) {
      console.error('Accept failed', err?.response?.status, err?.response?.data);
      Alert.alert('Error', err?.response?.data?.message || 'Could not accept booking');
    }
  };

  const handleDecline = (bookingId: string) => {
    setPendingBookings((prev) => prev.filter((b) => b.bookingId !== bookingId));
  };

  const renderRequest = ({ item }: { item: any }) => (
    <View style={[styles.requestCard, { backgroundColor: colors.cardBg }]}>
      <View style={styles.requestHeader}>
        <Text style={[styles.requestService, { color: colors.textPrimary }]}>{item.serviceCategory?.replace(/_/g, ' ')}</Text>
        <Text style={[styles.requestAmount, { color: colors.primary }]}>₹{item.pricing?.totalAmount}</Text>
      </View>
      <Text style={[styles.requestTime, { color: colors.textSecondary }]}>📅 {item.schedule?.requestedDate} · {item.schedule?.requestedTimeSlot}</Text>
      <Text style={[styles.requestDuration, { color: colors.textSecondary }]}>⏱️ ~{item.schedule?.estimatedDuration}hr job</Text>

      <View style={styles.requestBtns}>
        <TouchableOpacity style={[styles.declineBtn, { borderColor: colors.border }]} onPress={() => handleDecline(item.bookingId)}>
          <Text style={[styles.declineBtnText, { color: colors.textSecondary }]}>Decline</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.acceptBtn, { backgroundColor: colors.primary }]} onPress={() => handleAccept(item.bookingId)}>
          <Text style={[styles.acceptBtnText, { color: colors.white }]}>Accept</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) return <View style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator size="large" color={colors.primary} /></View>;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Dashboard</Text>
        <View style={styles.onlineRow}>
          <Text style={[styles.onlineLabel, { color: colors.textSecondary }]}>{isOnline ? 'Online' : 'Offline'}</Text>
          <Switch value={isOnline} onValueChange={handleToggleOnline} trackColor={{ true: colors.primary }} />
        </View>
      </View>

      {/* Active job banner */}
      {activeBooking && (
        <TouchableOpacity onPress={() => navigation.navigate('BookingTracking', { bookingId: activeBooking.bookingId || activeBooking._id })} style={[styles.activeBanner, { backgroundColor: colors.primary }]}>
          <Text style={[styles.activeBannerText, { color: colors.white }]}>🔨 Active job in progress</Text>
          <Text style={[styles.activeBannerSub, { color: colors.white + 'CC' }]}>{activeBooking.serviceCategory?.replace(/_/g, ' ')} · ₹{activeBooking.pricing?.totalAmount}</Text>
        </TouchableOpacity>
      )}

      {/* New requests */}
      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
        {pendingBookings.length > 0
          ? `${pendingBookings.length} New Request${pendingBookings.length > 1 ? 's' : ''}`
          : 'No new requests'}
      </Text>

      {pendingBookings.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyIcon, { color: colors.textSecondary }]}>{isOnline ? '⏳' : '😴'}</Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{isOnline ? 'Waiting for booking requests...' : 'Go online to receive bookings'}</Text>
        </View>
      )}

      <FlatList
        data={pendingBookings}
        keyExtractor={(item) => item.bookingId || item._id}
        renderItem={renderRequest}
        contentContainerStyle={styles.list}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:             { flex: 1 },
  center:           { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.md, borderBottomWidth: 1 },
  title:            { fontSize: FONTS.sizes.xl, fontWeight: '800' },
  onlineRow:        { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  onlineLabel:      { fontSize: FONTS.sizes.sm, fontWeight: '600' },
  activeBanner:     { padding: SPACING.md },
  activeBannerText: { fontSize: FONTS.sizes.base, fontWeight: '700' },
  activeBannerSub:  { fontSize: FONTS.sizes.xs, marginTop: 2 },
  sectionTitle:     { fontSize: FONTS.sizes.md, fontWeight: '700', padding: SPACING.md, paddingBottom: SPACING.sm },
  list:             { padding: SPACING.md, paddingTop: 0, gap: SPACING.sm },
  requestCard:      { borderRadius: BORDER_RADIUS.lg, padding: SPACING.md, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  requestHeader:    { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.xs },
  requestService:   { fontSize: FONTS.sizes.base, fontWeight: '700', textTransform: 'capitalize' },
  requestAmount:    { fontSize: FONTS.sizes.base, fontWeight: '800' },
  requestTime:      { fontSize: FONTS.sizes.xs, marginBottom: 2 },
  requestDuration:  { fontSize: FONTS.sizes.xs, marginBottom: SPACING.md },
  requestBtns:      { flexDirection: 'row', gap: SPACING.sm },
  declineBtn:       { flex: 1, borderWidth: 1.5, borderRadius: BORDER_RADIUS.full, paddingVertical: SPACING.sm, alignItems: 'center' },
  declineBtnText:   { fontSize: FONTS.sizes.sm, fontWeight: '600' },
  acceptBtn:        { flex: 2, borderRadius: BORDER_RADIUS.full, paddingVertical: SPACING.sm, alignItems: 'center' },
  acceptBtnText:    { fontSize: FONTS.sizes.sm, fontWeight: '700' },
  emptyState:       { alignItems: 'center', paddingTop: 60 },
  emptyIcon:        { fontSize: 48, marginBottom: SPACING.md },
  emptyText:        { fontSize: FONTS.sizes.base, textAlign: 'center' },
});
