import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, Alert, SafeAreaView, ActivityIndicator,
  ScrollView,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp }                 from '@react-navigation/native';
import { RootStackParamList }        from '../../navigation';
import { bookingApi }                from '../../api';
import { io, Socket }                from 'socket.io-client';
import { appLogger }                 from '../../utils/logger';
import { showAlert, showConfirm }    from '../../utils/dialog';
import { SPACING, BORDER_RADIUS, FONTS } from '../../constants';
import { useTheme }                  from '../../context/ThemeContext';
import { useAuth }                   from '../../context/AuthContext';
import { colors }                    from '../../theme/theme';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'BookingTracking'>;
  route:      RouteProp<RootStackParamList, 'BookingTracking'>;
};

const STATUS_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  searching:        { label: 'Looking for worker...',    icon: '🔍', color: colors.primary },
  accepted:         { label: 'Worker accepted!',         icon: '✅', color: colors.success },
  arrived:          { label: 'Worker has arrived',       icon: '📍', color: colors.primary },
  worker_en_route:  { label: 'Worker is on the way',     icon: '🚶', color: colors.primary },
  in_progress:      { label: 'Work in progress',         icon: '🔨', color: colors.primary },
  completed:        { label: 'Job completed!',           icon: '🎉', color: colors.success },
  cancelled_by_customer: { label: 'Cancelled',          icon: '❌', color: colors.error },
  cancelled_by_worker:   { label: 'Worker cancelled',   icon: '❌', color: colors.error },
  expired:          { label: 'Request expired',          icon: '⏱️', color: colors.error },
};

/** Statuses where the customer can still cancel the booking. */
const CANCELLABLE_STATUSES = ['searching', 'accepted', 'worker_en_route', 'arrived'];

/** Statuses where the customer is shown the OTP to share with the worker. */
const OTP_SHARE_STATUSES = ['accepted', 'worker_en_route', 'arrived'];

export default function BookingTrackingScreen({ navigation, route }: Props) {
  const { bookingId }   = route.params;
  const { colors: themeColors } = useTheme();
  const { isWorkerMode } = useAuth();
  const [booking,        setBooking]       = useState<any>(null);
  const [loading,        setLoading]       = useState(true);
  const [otp,            setOtp]           = useState('');
  const [otpLoading,     setOtpLoading]    = useState(false);
  const [workerLocation, setWorkerLocation]= useState<{ lat: number; lng: number } | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Load booking
    if (!bookingId) {
      Alert.alert('Error', 'Invalid booking');
      setLoading(false);
      return;
    }
    bookingApi.getById(bookingId)
      .then(({ data }) => {
        const bookingData = data.data || data;
        if (!bookingData) {
          appLogger.warn({ fn: 'useEffect', tag: 'BookingTrackingScreen_useEffect_bookingEmpty', screen: 'BookingTracking' }, 'Booking data empty', { bookingId });
          Alert.alert('Error', 'Booking not found');
          setLoading(false);
          return;
        }
        setBooking(bookingData);
        appLogger.info({ fn: 'useEffect', tag: 'BookingTrackingScreen_useEffect_bookingLoaded', screen: 'BookingTracking' }, 'Booking loaded', { bookingId });
      })
      .catch((err) => {
        appLogger.error({ fn: 'useEffect', tag: 'BookingTrackingScreen_useEffect_bookingLoadFailed', screen: 'BookingTracking' }, 'Could not load booking', err);
        Alert.alert('Error', err?.response?.data?.message || 'Could not load booking');
      })
      .finally(() => setLoading(false));

    // Socket for live tracking
    let socket: ReturnType<typeof io>;
    try {
      socket = io(process.env.EXPO_PUBLIC_API_URL || 'http://localhost:80');
      socketRef.current = socket;
      socket.emit('join_booking', bookingId);

      socket.on('connect_error', (err) => {
        appLogger.error({ fn: 'useEffect', tag: 'BookingTrackingScreen_useEffect_socketConnectError', screen: 'BookingTracking' }, 'Socket connection error', err);
      });

      socket.on('worker_moved', ({ lat, lng }: { lat: number; lng: number }) => {
        if (typeof lat !== 'number' || typeof lng !== 'number') {
          appLogger.warn({ fn: 'useEffect', tag: 'BookingTrackingScreen_useEffect_workerMovedBadData', screen: 'BookingTracking' }, 'Malformed worker_moved event', { lat, lng });
          return;
        }
        setWorkerLocation({ lat, lng });
      });

      socket.on('booking_status', (update: any) => {
        if (!update?.newStatus) {
          appLogger.warn({ fn: 'useEffect', tag: 'BookingTrackingScreen_useEffect_bookingStatusBadData', screen: 'BookingTracking' }, 'Malformed booking_status event', { update });
          return;
        }
        setBooking((prev: any) => prev ? { ...prev, status: update.newStatus } : prev);
      });
    } catch (err) {
      appLogger.error({ fn: 'useEffect', tag: 'BookingTrackingScreen_useEffect_socketSetupFailed', screen: 'BookingTracking' }, 'Failed to set up socket', err);
    }

    return () => { socketRef.current?.disconnect(); };
  }, [bookingId]);

  const handleStartWork = async () => {
    if (otp.length !== 4) { Alert.alert('Enter 4-digit OTP'); return; }
    setOtpLoading(true);
    try {
      await bookingApi.startWork(bookingId, otp);
      setBooking((prev: any) => prev ? { ...prev, status: 'in_progress' } : prev);
    } catch (err: any) {
      Alert.alert('Wrong OTP', err?.response?.data?.message || 'Please check the code and try again.');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleArrived = async () => {
    try {
      await bookingApi.arrived(bookingId);
      setBooking((prev:any)=>prev?{...prev,status:'arrived'}:prev);
    }
    catch (err:any){ Alert.alert('Error', err?.response?.data?.message); }
  };
  const handleEnRoute = async () => {
    try {
      await bookingApi.enRoute(bookingId);
      setBooking((prev:any)=>prev?{...prev,status:'worker_en_route'}:prev);
    }
    catch (err:any){ Alert.alert('Error', err?.response?.data?.message); }
  };
  const handleComplete = async () => {
    try { await bookingApi.completeWork(bookingId); setBooking((prev:any)=>prev?{...prev,status:'completed'}:prev); }
    catch (err:any){ Alert.alert('Error', err?.response?.data?.message); }
  };
  const handleCancelConfirm = async () => {
    try {
      const { data } = await bookingApi.cancel(bookingId);
      const penaltyAmount = data?.data?.penaltyAmount ?? 0;
      appLogger.info({ fn: 'handleCancel', tag: 'BookingTrackingScreen_handleCancel_success', screen: 'BookingTracking' }, 'Booking cancelled', { bookingId, penaltyAmount });
      showAlert(
        'Booking cancelled',
        penaltyAmount > 0
          ? `A cancellation fee of ₹${penaltyAmount} has been charged.`
          : 'Your booking has been cancelled.',
      );
      navigation.goBack();
    } catch (err: any) {
      appLogger.error({ fn: 'handleCancel', tag: 'BookingTrackingScreen_handleCancel_failed', screen: 'BookingTracking' }, 'Failed to cancel booking', err);
      showAlert('Error', err?.response?.data?.message || 'Could not cancel booking. Please try again.');
    }
  };

  const handleCancel = () => {
    showConfirm(
      'Cancel Booking',
      'Are you sure? A cancellation fee may apply.',
      handleCancelConfirm,
      'Yes, Cancel',
    );
  };

  if (loading) return <View style={[styles.center, { backgroundColor: themeColors.background }]}><ActivityIndicator size="large" color={themeColors.primary} /></View>;
  if (!booking) return (
    <SafeAreaView style={[styles.safe, { backgroundColor: themeColors.background }]}>
      <View style={[styles.header, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={[styles.back, { color: themeColors.textPrimary }]}>←</Text></TouchableOpacity>
        <Text style={[styles.headerTitle, { color: themeColors.textPrimary }]}>Booking</Text>
        <View style={{ width: 32 }} />
      </View>
      <View style={[styles.center, { backgroundColor: themeColors.background }]}>
        <Text style={{ color: themeColors.textSecondary }}>Booking details not available</Text>
      </View>
    </SafeAreaView>
  );

  const statusInfo = STATUS_LABELS[booking.status] ?? { label: booking.status || 'Unknown', icon: '📋', color: themeColors.textSecondary };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: themeColors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={[styles.back, { color: themeColors.textPrimary }]}>←</Text></TouchableOpacity>
        <Text style={[styles.headerTitle, { color: themeColors.textPrimary }]}>Booking #{booking.bookingId}</Text>
        {['accepted','worker_en_route','arrived','in_progress','completed','payment_done'].includes(booking.status) && (
          <TouchableOpacity style={styles.headerChatBtn} onPress={() => navigation.navigate('Chat', { bookingId })}>
            <Text style={[styles.headerChatBtnText, { color: themeColors.textPrimary }]}>Chat</Text>
          </TouchableOpacity>
        )}
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Map placeholder (swap for real MapView) */}
        <View style={[styles.mapPlaceholder, { backgroundColor: themeColors.cardBg }]}>
          <Text style={styles.mapIcon}>🗺️</Text>
          <Text style={[styles.mapText, { color: themeColors.textSecondary }]}>Live tracking map</Text>
          {workerLocation && (
            <Text style={[styles.mapCoords, { color: themeColors.textMuted }]}>Worker: {workerLocation.lat.toFixed(4)}, {workerLocation.lng.toFixed(4)}</Text>
          )}
        </View>

        {/* Status card */}
        <View style={[styles.card, { backgroundColor: themeColors.cardBg }]}>
          <View style={[styles.statusBadge, { backgroundColor: statusInfo.color + '20' }]}>
            <Text style={styles.statusIcon}>{statusInfo.icon}</Text>
            <Text style={[styles.statusLabel, { color: statusInfo.color }]}>{statusInfo.label}</Text>
          </View>

          {/* Booking details */}
          <View style={[styles.detailRow, { borderBottomColor: themeColors.border }]}><Text style={[styles.detailKey, { color: themeColors.textSecondary }]}>Service</Text><Text style={[styles.detailVal, { color: themeColors.textPrimary }]}>{booking.serviceCategory?.replace(/_/g, ' ') || '-'}</Text></View>
          <View style={[styles.detailRow, { borderBottomColor: themeColors.border }]}><Text style={[styles.detailKey, { color: themeColors.textSecondary }]}>Amount</Text><Text style={[styles.detailVal, { color: themeColors.textPrimary }]}>₹{booking.pricing?.totalAmount ?? '-'}</Text></View>
          <View style={[styles.detailRow, { borderBottomColor: themeColors.border }]}><Text style={[styles.detailKey, { color: themeColors.textSecondary }]}>Time slot</Text><Text style={[styles.detailVal, { color: themeColors.textPrimary }]}>{booking.schedule?.requestedTimeSlot || '-'}</Text></View>

          {/* OTP display for customer — shared with the worker once they arrive */}
          {!isWorkerMode && booking.otp && OTP_SHARE_STATUSES.includes(booking.status) && (
            <View style={styles.otpSection}>
              <Text style={[styles.otpTitle, { color: themeColors.textSecondary }]}>Share this 4-digit OTP with the worker when they arrive to start the work</Text>
              <Text style={[styles.otpDisplay, { color: themeColors.textPrimary }]}>{typeof booking.otp === 'object' ? booking.otp.code : booking.otp}</Text>
            </View>
          )}

          {/* Worker controls */}
          {isWorkerMode && (
            <View style={styles.otpSection}>
              {booking.status === 'accepted' && (
                <TouchableOpacity style={[styles.fullBtn, { backgroundColor: themeColors.primary }]} onPress={handleEnRoute}>
                  <Text style={[styles.fullBtnText, { color: themeColors.white }]}>Start Journey</Text>
                </TouchableOpacity>
              )}
              {booking.status === 'worker_en_route' && (
                <TouchableOpacity style={[styles.fullBtn, { backgroundColor: themeColors.primary }]} onPress={handleArrived}>
                  <Text style={[styles.fullBtnText, { color: themeColors.white }]}>Arrived at Location</Text>
                </TouchableOpacity>
              )}
              {booking.status === 'arrived' && (
                <View>
                  <Text style={[styles.otpTitle, { color: themeColors.textSecondary }]}>Enter Customer OTP to Start Work</Text>
                  <View style={[styles.otpInputRow, { flexDirection: 'column', alignItems: 'stretch' }]}>
                    <TextInput
                      style={[styles.otpInput, { backgroundColor: themeColors.inputBg, color: themeColors.textPrimary, borderColor: themeColors.border }]}
                      value={otp}
                      onChangeText={setOtp}
                      placeholder="Enter OTP"
                      keyboardType="numeric"
                      maxLength={4}
                      placeholderTextColor={themeColors.textMuted}
                    />
                    <TouchableOpacity style={[styles.otpBtn, { backgroundColor: themeColors.primary, width: '100%', marginTop: SPACING.sm }]} onPress={handleStartWork} disabled={otpLoading}>
                      {otpLoading ? <ActivityIndicator color={themeColors.white} /> : <Text style={[styles.otpBtnText, { color: themeColors.white }]}>Start Work</Text>}
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              {booking.status === 'in_progress' && (
                <TouchableOpacity style={[styles.fullBtn, { backgroundColor: colors.success }]} onPress={handleComplete}>
                  <Text style={[styles.fullBtnText, { color: themeColors.white }]}>Complete Task</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Cancel button (until the work starts) */}
          {!isWorkerMode && CANCELLABLE_STATUSES.includes(booking.status) && (
            <TouchableOpacity style={[styles.cancelBtn, { borderColor: themeColors.error }]} onPress={handleCancel}>
              <Text style={[styles.cancelBtnText, { color: themeColors.error }]}>Cancel Booking</Text>
            </TouchableOpacity>
          )}

          {/* Review prompt when completed */}
          {booking.status === 'completed' && (
            <TouchableOpacity style={[styles.reviewBtn, { backgroundColor: themeColors.primary }]} onPress={() => navigation.goBack()}>
              <Text style={[styles.reviewBtnText, { color: themeColors.white }]}>Rate your experience ★</Text>
            </TouchableOpacity>
          )}
      </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:           { flex: 1 },
  center:         { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SPACING.md, borderBottomWidth: 1 },
  back:           { fontSize: 24, width: 32 },
  headerTitle:    { fontSize: FONTS.sizes.base, fontWeight: '700' },
  headerChatBtn:  { marginLeft: SPACING.sm, paddingHorizontal: SPACING.sm },
  headerChatBtnText: { fontSize: FONTS.sizes.sm, fontWeight: '700' },
  mapPlaceholder: { height: 220, justifyContent: 'center', alignItems: 'center' },
  mapIcon:        { fontSize: 48, marginBottom: SPACING.xs },
  mapText:        { fontSize: FONTS.sizes.sm },
  mapCoords:      { fontSize: FONTS.sizes.xs, marginTop: 4 },
  scrollContent:  { paddingBottom: SPACING.lg },
  card:           { margin: SPACING.md, borderRadius: BORDER_RADIUS.lg, padding: SPACING.lg, elevation: 3 },
  statusBadge:    { flexDirection: 'row', alignItems: 'center', borderRadius: BORDER_RADIUS.full, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, marginBottom: SPACING.md, alignSelf: 'flex-start', gap: SPACING.xs },
  statusIcon:     { fontSize: FONTS.sizes.md },
  statusLabel:    { fontSize: FONTS.sizes.sm, fontWeight: '700' },
  detailRow:      { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: SPACING.xs, borderBottomWidth: 1 },
  detailKey:      { fontSize: FONTS.sizes.sm },
  detailVal:      { fontSize: FONTS.sizes.sm, fontWeight: '600' },
  otpSection:     { marginTop: SPACING.md },
  otpTitle:       { fontSize: FONTS.sizes.sm, marginBottom: SPACING.sm, textAlign: 'center' },
  otpInputRow:    { flexDirection: 'row', gap: SPACING.sm, alignItems: 'center' },
  otpInput:       { flex: 1, borderRadius: BORDER_RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, fontSize: FONTS.sizes.xl, textAlign: 'center', letterSpacing: 8, fontWeight: '700' },
  otpBtn:         { borderRadius: BORDER_RADIUS.md, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, justifyContent: 'center', minHeight: 48 },
  otpBtnText:     { fontSize: FONTS.sizes.sm, fontWeight: '700' },
  fullBtn:        { width: '100%', borderRadius: BORDER_RADIUS.md, paddingVertical: SPACING.md, alignItems: 'center', justifyContent: 'center', marginTop: SPACING.sm },
  fullBtnText:    { fontSize: FONTS.sizes.base, fontWeight: '700' },
  otpDisplay:     { fontSize: FONTS.sizes.xxl, fontWeight: '800', textAlign: 'center', letterSpacing: 8, marginVertical: SPACING.sm },
  cancelBtn:      { marginTop: SPACING.md, borderWidth: 1, borderRadius: BORDER_RADIUS.full, paddingVertical: SPACING.sm, alignItems: 'center' },
  cancelBtnText:  { fontSize: FONTS.sizes.sm, fontWeight: '600' },
  reviewBtn:      { marginTop: SPACING.md, borderRadius: BORDER_RADIUS.full, paddingVertical: SPACING.sm, alignItems: 'center' },
  reviewBtnText:  { fontSize: FONTS.sizes.sm, fontWeight: '700' },
});
