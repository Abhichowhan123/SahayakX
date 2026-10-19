import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { workerApi } from '../../api';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../theme/theme';
import { SPACING, BORDER_RADIUS, FONTS } from '../../constants';

export default function WorkerVerificationStatusScreen({ navigation }: any) {
  const { colors: themeColors } = useTheme();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      const p = await workerApi.getMyProfile();
      setProfile(p.data.data);
    } catch (err) {
      Alert.alert('Error', 'Failed to load verification status');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchProfile(); }, [fetchProfile]));

  if (loading) {
    return <View style={[styles.center, { backgroundColor: themeColors.background }]}><Text style={{ color: themeColors.textPrimary }}>Loading...</Text></View>;
  }

  const v = profile?.verification || {};
  const status = v.status || 'pending';

  return (
    <ScrollView style={[styles.container, { backgroundColor: themeColors.background }]} contentContainerStyle={{ padding: SPACING.lg }}>
      <Text style={[styles.title, { color: themeColors.textPrimary }]}>Verification Status</Text>

      <View style={[styles.card, { backgroundColor: themeColors.cardBg, borderColor: themeColors.border }]}>
        <Text style={[styles.label, { color: themeColors.textSecondary }]}>Status</Text>
        <Text style={[styles.status, status === 'verified' ? { color: themeColors.success } : status === 'rejected' ? { color: themeColors.error } : { color: themeColors.warning || '#F59E0B' }]}>
          {status.toUpperCase()}
        </Text>

        {v.submittedAt && <Text style={[styles.item, { color: themeColors.textPrimary }]}>Submitted: {new Date(v.submittedAt).toLocaleString()}</Text>}
        {v.verifiedAt && <Text style={[styles.item, { color: themeColors.textPrimary }]}>Verified: {new Date(v.verifiedAt).toLocaleString()}</Text>}
        {v.verifiedBy && <Text style={[styles.item, { color: themeColors.textPrimary }]}>Verified By: {v.verifiedBy}</Text>}

        {status === 'rejected' && v.rejectionReason && (
          <View style={[styles.rejectionBox, { backgroundColor: themeColors.error + '15' }]}>
            <Text style={[styles.rejectionLabel, { color: '#991B1B' }]}>Rejection Reason</Text>
            <Text style={[styles.rejectionText, { color: '#991B1B' }]}>{v.rejectionReason}</Text>
          </View>
        )}

        {status === 'rejected' && (
          <TouchableOpacity style={[styles.btn, { backgroundColor: themeColors.primary }]} onPress={() => navigation.navigate('Verification')}>
            <Text style={[styles.btnText, { color: themeColors.white }]}>Resubmit Documents</Text>
          </TouchableOpacity>
        )}

        {status === 'pending' && (
          <Text style={[styles.note, { color: themeColors.textSecondary }]}>Your documents are under review. Admin will verify soon.</Text>
        )}

        {status === 'verified' && (
          <Text style={[styles.note, { color: themeColors.textSecondary }]}>Your account is verified. You can go online and receive bookings.</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: FONTS.sizes.xl, fontWeight: '800', marginBottom: SPACING.lg },
  card: { borderRadius: BORDER_RADIUS.lg, padding: SPACING.lg, borderWidth: 1 },
  label: { fontSize: FONTS.sizes.sm, marginBottom: SPACING.xs },
  status: { fontSize: FONTS.sizes.lg, fontWeight: '800', marginBottom: SPACING.md },
  verified: { fontSize: FONTS.sizes.lg, fontWeight: '800', marginBottom: SPACING.md },
  rejected: { fontSize: FONTS.sizes.lg, fontWeight: '800', marginBottom: SPACING.md },
  pending: { fontSize: FONTS.sizes.lg, fontWeight: '800', marginBottom: SPACING.md },
  item: { fontSize: FONTS.sizes.sm, marginBottom: SPACING.xs },
  rejectionBox: { marginTop: SPACING.md, padding: SPACING.md, borderRadius: BORDER_RADIUS.md },
  rejectionLabel: { fontSize: FONTS.sizes.sm, fontWeight: '700', marginBottom: SPACING.xs },
  rejectionText: { fontSize: FONTS.sizes.sm },
  btn: { borderRadius: BORDER_RADIUS.full, padding: SPACING.md, alignItems: 'center', marginTop: SPACING.lg },
  btnText: { fontSize: FONTS.sizes.md, fontWeight: '700' },
  note: { marginTop: SPACING.md, fontSize: FONTS.sizes.sm },
});
