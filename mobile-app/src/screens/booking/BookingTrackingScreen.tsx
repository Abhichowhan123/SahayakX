import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, Alert, SafeAreaView, ActivityIndicator,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp }                 from '@react-navigation/native';
import { RootStackParamList }        from '../../navigation';
import { bookingApi }                from '../../api';
import { io, Socket }                from 'socket.io-client';
import { appLogger }                 from '../../utils/logger';
import { SPACING, BORDER_RADIUS, FONTS } from '../../constants';
import { useTheme }                  from '../../context/ThemeContext';
import { colors }                    from '../../theme/theme';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'BookingTracking'>;
  route:      RouteProp<RootStackParamList, 'BookingTracking'>;
};

const STATUS_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  searching:        { label: 'Looking for worker...',    icon: '🔍', color: colors.primary },
  accepted:         { label: 'Worker accepted!',         icon: '✅', color: colors.success },
  worker_en_route:  { label: 'Worker is on the way',     icon: '🚶', color: colors.primary },
  in_progress:      { label: 'Work in progress',         icon: '🔨', color: colors.primary },
  completed:        { label: 'Job completed!',           icon: '🎉', color: colors.success },
  cancelled_by_customer: { label: 'Cancelled',          icon: '❌', color: colors.error },
  cancelled_by_worker:   { label: 'Worker cancelled',   icon: '❌', color: colors.error },
  expired:          { label: 'Request expired',          icon: '⏱️', color: colors.error },
};

export default function BookingTrackingScreen({ navigation, route }: Props) {
  const { bookingId }   = route.params;
  const { colors: themeColors } = useTheme();
  const [booking,        setBooking]       = useState<any>(null);
  const [loading,        setLoading]       = useState(true);
  const [otp,            setOtp]           = useState('');
  const [otpLoading,     setOtpLoading]    = useState(false);
  const [workerLocation, setWorkerLocation]= useState<{ lat: number; lng: number } | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Load booking
    bookingApi.getById(bookingId)
      .then(({ data }) => {
        setBooking(data.data);
        appLogger.info({ fn: 'useEffect', tag: 'BookingTrackingScreen_useEffect_bookingLoaded', screen: 'BookingTracking' }, 'Booking loaded', { bookingId });
      })
      .catch((err) => {
        appLogger.error({ fn: 'useEffect', tag: 'BookingTrackingScreen_useEffect_bookingLoadFailed', screen: 'BookingTracking' }, 'Could not load booking', err);
        Alert.alert('Error', 'Could not load booking');
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

  const handleCancel = () => {
    Alert.alert('Cancel Booking', 'Are you sure? A cancellation fee may apply.', [
      { text: 'No',  style: 'cancel' },
      { text: 'Yes, Cancel', style: 'destructive', onPress: async () => {
        try {
          await bookingApi.cancel(bookingId);
          appLogger.info({ fn: 'handleCancel', tag: 'BookingTrackingScreen_handleCancel_success', screen: 'BookingTracking' }, 'Booking cancelled', { bookingId });
          navigation.goBack();
        } catch (err: any) {
          appLogger.error({ fn: 'handleCancel', tag: 'BookingTrackingScreen_handleCancel_failed', screen: 'BookingTracking' }, 'Failed to cancel booking', err);
          Alert.alert('Error', err?.response?.data?.message || 'Could not cancel booking. Please try again.');
        }
      }},
    ]);
  };

  if (loading) return <View style={[styles.center, { backgroundColor: themeColors.background }]}><ActivityIndicator size="large" color={themeColors.primary} /></View>;
  if (!booking) return null;

  const statusInfo = STATUS_LABELS[booking.status] ?? { label: booking.status, icon: '📋', color: themeColors.textSecondary };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: themeColors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={[styles.back, { color: themeColors.textPrimary }]}>←</Text></TouchableOpacity>
        <Text style={[styles.headerTitle, { color: themeColors.textPrimary }]}>Booking #{booking.bookingId}</Text>
        <View style={{ width: 32 }} />
      </View>

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
        <View style={[styles.detailRow, { borderBottomColor: themeColors.border }]}><Text style={[styles.detailKey, { color: themeColors.textSecondary }]}>Service</Text><Text style={[styles.detailVal, { color: themeColors.textPrimary }]}>{booking.serviceCategory?.replace(/_/g, ' ')}</Text></View>
        <View style={[styles.detailRow, { borderBottomColor: themeColors.border }]}><Text style={[styles.detailKey, { color: themeColors.textSecondary }]}>Amount</Text><Text style={[styles.detailVal, { color: themeColors.textPrimary }]}>₹{booking.pricing?.totalAmount}</Text></View>
        <View style={[styles.detailRow, { borderBottomColor: themeColors.border }]}><Text style={[styles.detailKey, { color: themeColors.textSecondary }]}>Time slot</Text><Text style={[styles.detailVal, { color: themeColors.textPrimary }]}>{booking.schedule?.requestedTimeSlot}</Text></View>

        {/* OTP input to start work (shown when worker arrives) */}
        {booking.status === 'worker_en_route' && (
          <View style={styles.otpSection}>
            <Text style={[styles.otpTitle, { color: themeColors.textSecondary }]}>Share this OTP with your worker to start</Text>
            <View style={styles.otpInputRow}>
              <TextInput
                style={[styles.otpInput, { backgroundColor: themeColors.inputBg, color: themeColors.textPrimary }]}
                value={otp}
                onChangeText={setOtp}
                placeholder="4-digit OTP"
                keyboardType="numeric"
                maxLength={4}
                placeholderTextColor={themeColors.textMuted}
              />
              <TouchableOpacity style={[styles.otpBtn, { backgroundColor: themeColors.primary }]} onPress={handleStartWork} disabled={otpLoading}>
                {otpLoading
                  ? <ActivityIndicator color={themeColors.white} />
                  : <Text style={[styles.otpBtnText, { color: themeColors.white }]}>Confirm</Text>}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Cancel button (only when searching or accepted) */}
        {['searching', 'accepted'].includes(booking.status) && (
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:           { flex: 1 },
  center:         { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SPACING.md, borderBottomWidth: 1 },
  back:           { fontSize: 24, width: 32 },
  headerTitle:    { fontSize: FONTS.sizes.base, fontWeight: '700' },
  mapPlaceholder: { height: 220, justifyContent: 'center', alignItems: 'center' },
  mapIcon:        { fontSize: 48, marginBottom: SPACING.xs },
  mapText:        { fontSize: FONTS.sizes.sm },
  mapCoords:      { fontSize: FONTS.sizes.xs, marginTop: 4 },
  card:           { margin: SPACING.md, borderRadius: BORDER_RADIUS.lg, padding: SPACING.lg, elevation: 3 },
  statusBadge:    { flexDirection: 'row', alignItems: 'center', borderRadius: BORDER_RADIUS.full, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, marginBottom: SPACING.md, alignSelf: 'flex-start', gap: SPACING.xs },
  statusIcon:     { fontSize: FONTS.sizes.md },
  statusLabel:    { fontSize: FONTS.sizes.sm, fontWeight: '700' },
  detailRow:      { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: SPACING.xs, borderBottomWidth: 1 },
  detailKey:      { fontSize: FONTS.sizes.sm },
  detailVal:      { fontSize: FONTS.sizes.sm, fontWeight: '600' },
  otpSection:     { marginTop: SPACING.md },
  otpTitle:       { fontSize: FONTS.sizes.sm, marginBottom: SPACING.sm, textAlign: 'center' },
  otpInputRow:    { flexDirection: 'row', gap: SPACING.sm },
  otpInput:       { flex: 1, borderRadius: BORDER_RADIUS.md, paddingHorizontal: SPACING.md, fontSize: FONTS.sizes.xl, textAlign: 'center', letterSpacing: 8, fontWeight: '700' },
  otpBtn:         { borderRadius: BORDER_RADIUS.md, paddingHorizontal: SPACING.lg, justifyContent: 'center' },
  otpBtnText:     { fontSize: FONTS.sizes.sm, fontWeight: '700' },
  cancelBtn:      { marginTop: SPACING.md, borderWidth: 1, borderRadius: BORDER_RADIUS.full, paddingVertical: SPACING.sm, alignItems: 'center' },
  cancelBtnText:  { fontSize: FONTS.sizes.sm, fontWeight: '600' },
  reviewBtn:      { marginTop: SPACING.md, borderRadius: BORDER_RADIUS.full, paddingVertical: SPACING.sm, alignItems: 'center' },
  reviewBtnText:  { fontSize: FONTS.sizes.sm, fontWeight: '700' },
});
