import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { workerApi } from '../../api';
import { COLORS, SPACING, BORDER_RADIUS, FONTS } from '../../constants';

export default function WorkerVerificationStatusScreen({ navigation }: any) {
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
    return <View style={styles.center}><Text>Loading...</Text></View>;
  }

  const v = profile?.verification || {};
  const status = v.status || 'pending';

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: SPACING.lg }}>
      <Text style={styles.title}>Verification Status</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Status</Text>
        <Text style={[styles.status, status === 'verified' ? styles.verified : status === 'rejected' ? styles.rejected : styles.pending]}>
          {status.toUpperCase()}
        </Text>

        {v.submittedAt && <Text style={styles.item}>Submitted: {new Date(v.submittedAt).toLocaleString()}</Text>}
        {v.verifiedAt && <Text style={styles.item}>Verified: {new Date(v.verifiedAt).toLocaleString()}</Text>}
        {v.verifiedBy && <Text style={styles.item}>Verified By: {v.verifiedBy}</Text>}

        {status === 'rejected' && v.rejectionReason && (
          <View style={styles.rejectionBox}>
            <Text style={styles.rejectionLabel}>Rejection Reason</Text>
            <Text style={styles.rejectionText}>{v.rejectionReason}</Text>
          </View>
        )}

        {status === 'rejected' && (
          <TouchableOpacity style={styles.btn} onPress={() => navigation.navigate('Verification')}>
            <Text style={styles.btnText}>Resubmit Documents</Text>
          </TouchableOpacity>
        )}

        {status === 'pending' && (
          <Text style={styles.note}>Your documents are under review. Admin will verify soon.</Text>
        )}

        {status === 'verified' && (
          <Text style={styles.note}>Your account is verified. You can go online and receive bookings.</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: FONTS.sizes.xl, fontWeight: '800', color: COLORS.textPrimary, marginBottom: SPACING.lg },
  card: { backgroundColor: COLORS.inputBg, borderRadius: BORDER_RADIUS.lg, padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.border },
  label: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, marginBottom: SPACING.xs },
  status: { fontSize: FONTS.sizes.lg, fontWeight: '800', marginBottom: SPACING.md },
  verified: { color: COLORS.success },
  rejected: { color: COLORS.error },
  pending: { color: COLORS.warning || '#F59E0B' },
  item: { fontSize: FONTS.sizes.sm, color: COLORS.textPrimary, marginBottom: SPACING.xs },
  rejectionBox: { marginTop: SPACING.md, backgroundColor: '#FEE2E2', padding: SPACING.md, borderRadius: BORDER_RADIUS.md },
  rejectionLabel: { fontSize: FONTS.sizes.sm, fontWeight: '700', color: '#991B1B', marginBottom: SPACING.xs },
  rejectionText: { fontSize: FONTS.sizes.sm, color: '#991B1B' },
  btn: { backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.full, padding: SPACING.md, alignItems: 'center', marginTop: SPACING.lg },
  btnText: { color: COLORS.white, fontSize: FONTS.sizes.md, fontWeight: '700' },
  note: { marginTop: SPACING.md, fontSize: FONTS.sizes.sm, color: COLORS.textSecondary },
});
