import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, SafeAreaView } from 'react-native';
import { bookingApi } from '../../api';
import { useTheme } from '../../context/ThemeContext';
import { showAlert, showConfirm } from '../../utils/dialog';
import { SPACING, BORDER_RADIUS, FONTS } from '../../constants';

export default function WorkerBookingDetailScreen({ route, navigation }: any) {
  const { bookingId } = route.params;
  const { colors } = useTheme();
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  const handleArrived = async () => {
    try { await bookingApi.arrived(bookingId); showAlert('Success', 'Marked as arrived'); } catch (e: any) { showAlert('Error', e?.response?.data?.message || 'Failed'); }
  };
  const handleEnRoute = async () => {
    try { await bookingApi.enRoute(bookingId); showAlert('Success', 'On the way'); } catch (e: any) { showAlert('Error', e?.response?.data?.message || 'Failed'); }
  };
  const submitOtp = async () => {
    if (otp.length !== 4) { showAlert('Error', 'Enter 4-digit OTP'); return; }
    setLoading(true);
    try { await bookingApi.startWork(bookingId, otp); showAlert('Success', 'Work started'); } catch (e: any) { showAlert('Error', e?.response?.data?.message || 'Invalid OTP'); }
    finally { setLoading(false); }
  };
  const complete = async () => {
    try { await bookingApi.completeWork(bookingId); showAlert('Success', 'Job completed'); navigation.goBack(); } catch (e: any) { showAlert('Error', e?.response?.data?.message || 'Failed'); }
  };
  const handleReject = async () => {
    showConfirm('Reject Booking', 'Are you sure?', async () => {
      try { await bookingApi.reject(bookingId); showAlert('Rejected'); navigation.goBack(); } catch (e: any) { showAlert('Error', e?.response?.data?.message || 'Failed'); }
    }, 'Yes, Reject');
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={[styles.back, { color: colors.textPrimary }]}>←</Text></TouchableOpacity>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Booking #{bookingId}</Text>
        <View style={{ width: 32 }} />
      </View>
      <View style={styles.content}>
        <TouchableOpacity style={[styles.btn, { backgroundColor: colors.primary }]} onPress={handleEnRoute}><Text style={[styles.btnText, { color: colors.white }]}>Start Journey (En Route)</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.btn, { backgroundColor: colors.primary }]} onPress={handleArrived}><Text style={[styles.btnText, { color: colors.white }]}>Mark Arrived</Text></TouchableOpacity>
        <Text style={[styles.label, { color: colors.textSecondary, marginBottom: SPACING.sm }]}>Enter Customer OTP to Start Work</Text>
        <TextInput style={[styles.input, { backgroundColor: colors.inputBg, color: colors.textPrimary, borderColor: colors.border }]} value={otp} onChangeText={setOtp} placeholder="4-digit OTP" keyboardType="numeric" maxLength={4} placeholderTextColor={colors.textMuted} />
        <TouchableOpacity style={[styles.btn, { backgroundColor: colors.success, marginTop: SPACING.sm }]} onPress={submitOtp} disabled={loading}><Text style={[styles.btnText, { color: colors.white }]}>{loading ? 'Verifying...' : 'Start Work'}</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.btn, { backgroundColor: colors.success }]} onPress={complete}><Text style={[styles.btnText, { color: colors.white }]}>Complete Job</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.btn, { backgroundColor: colors.error }]} onPress={handleReject}><Text style={[styles.btnText, { color: colors.white }]}>Reject Booking</Text></TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SPACING.md, borderBottomWidth: 1 },
  back: { fontSize: 24, width: 32 },
  title: { fontSize: FONTS.sizes.base, fontWeight: '700' },
  content: { padding: SPACING.lg },
  label: { fontSize: FONTS.sizes.sm, marginTop: SPACING.md, marginBottom: SPACING.sm, textAlign: 'center' },
  btn: { padding: SPACING.md, borderRadius: BORDER_RADIUS.md, marginBottom: SPACING.sm, alignItems: 'center' },
  btnText: { fontWeight: '700' },
  input: { borderWidth: 1, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm, textAlign: 'center', fontSize: FONTS.sizes.xl, letterSpacing: 8, fontWeight: '700' },
});
