import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator, Alert, SafeAreaView,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp }                 from '@react-navigation/native';
import { RootStackParamList }        from '../../navigation';
import { workerApi, reviewApi }      from '../../api';
import PriceOfferModal               from '../../components/booking/PriceOfferModal';
import { COLORS, SPACING, BORDER_RADIUS, FONTS } from '../../constants';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'WorkerProfile'>;
  route:      RouteProp<RootStackParamList, 'WorkerProfile'>;
};

export default function WorkerProfileScreen({ navigation, route }: Props) {
  const { workerId } = route.params;
  const [worker,         setWorker]         = useState<any>(null);
  const [reviews,        setReviews]        = useState<any[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [priceModal,     setPriceModal]     = useState(false);

  useEffect(() => {
    Promise.all([
      workerApi.getWorkerById(workerId),
      reviewApi.getWorkerReviews(workerId),
    ]).then(([w, r]) => {
      setWorker(w.data.data);
      setReviews(r.data.data);
    }).catch(() => Alert.alert('Error', 'Could not load worker profile'))
      .finally(() => setLoading(false));
  }, [workerId]);

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  if (!worker) return null;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
        </View>

        {/* Profile hero */}
        <View style={styles.hero}>
          {worker.profilePhoto
            ? <Image source={{ uri: worker.profilePhoto }} style={styles.avatar} />
            : <View style={styles.avatarPlaceholder}><Text style={styles.avatarInitial}>{worker.fullName?.[0]}</Text></View>}
          <View style={styles.onlineRow}>
            <View style={[styles.dot, { backgroundColor: worker.isOnline ? COLORS.success : COLORS.textMuted }]} />
            <Text style={styles.onlineText}>{worker.isOnline ? 'Available now' : 'Currently offline'}</Text>
          </View>
          <Text style={styles.name}>{worker.fullName}</Text>
          <Text style={styles.category}>{worker.serviceCategory.replace(/_/g, ' ').toUpperCase()}</Text>
          <View style={styles.statsRow}>
            <View style={styles.stat}><Text style={styles.statVal}>★ {worker.ratings.average.toFixed(1)}</Text><Text style={styles.statLabel}>{worker.ratings.totalReviews} reviews</Text></View>
            <View style={styles.statDivider} />
            <View style={styles.stat}><Text style={styles.statVal}>{worker.experience}yr</Text><Text style={styles.statLabel}>experience</Text></View>
            <View style={styles.statDivider} />
            <View style={styles.stat}><Text style={styles.statVal}>₹{worker.pricing.hourlyRate}</Text><Text style={styles.statLabel}>per hour</Text></View>
          </View>
        </View>

        {/* Bio */}
        {worker.bio ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.bio}>{worker.bio}</Text>
          </View>
        ) : null}

        {/* Skills */}
        {worker.skills?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Skills</Text>
            <View style={styles.chips}>
              {worker.skills.map((s: string) => (
                <View key={s} style={styles.chip}><Text style={styles.chipText}>{s}</Text></View>
              ))}
            </View>
          </View>
        )}

        {/* Reviews */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reviews ({reviews.length})</Text>
          {reviews.slice(0, 5).map((r: any) => (
            <View key={r._id} style={styles.reviewCard}>
              <View style={styles.reviewHeader}>
                <Text style={styles.reviewRating}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</Text>
                <Text style={styles.reviewDate}>{new Date(r.createdAt).toLocaleDateString()}</Text>
              </View>
              <Text style={styles.reviewComment}>{r.comment}</Text>
              {r.workerReply && <Text style={styles.workerReply}>Reply: {r.workerReply}</Text>}
            </View>
          ))}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Book button */}
      <View style={styles.bookBar}>
        <View>
          <Text style={styles.bookPrice}>₹{worker.pricing.hourlyRate}/hr</Text>
          {worker.pricing.isNegotiable && <Text style={styles.negotiable}>Price negotiable</Text>}
        </View>
        <TouchableOpacity style={styles.bookBtn} onPress={() => setPriceModal(true)} disabled={!worker.isOnline}>
          <Text style={styles.bookBtnText}>{worker.isOnline ? 'Book Now' : 'Offline'}</Text>
        </TouchableOpacity>
      </View>

      <PriceOfferModal
        visible={priceModal}
        worker={worker}
        onClose={() => setPriceModal(false)}
        onBook={(price) => { setPriceModal(false); /* navigate to booking confirmation */ }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:              { flex: 1, backgroundColor: COLORS.background },
  center:            { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header:            { padding: SPACING.md },
  back:              { width: 40, height: 40, justifyContent: 'center' },
  backText:          { fontSize: 24, color: COLORS.textPrimary },
  hero:              { backgroundColor: COLORS.white, alignItems: 'center', paddingVertical: SPACING.xl, paddingHorizontal: SPACING.lg, marginBottom: SPACING.sm },
  avatar:            { width: 96, height: 96, borderRadius: 48, marginBottom: SPACING.sm },
  avatarPlaceholder: { width: 96, height: 96, borderRadius: 48, backgroundColor: COLORS.primary + '20', justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.sm },
  avatarInitial:     { fontSize: FONTS.sizes.xxl, fontWeight: '700', color: COLORS.primary },
  onlineRow:         { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.xs },
  dot:               { width: 8, height: 8, borderRadius: 4, marginRight: 4 },
  onlineText:        { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary },
  name:              { fontSize: FONTS.sizes.xl, fontWeight: '800', color: COLORS.textPrimary },
  category:          { fontSize: FONTS.sizes.xs, color: COLORS.primary, fontWeight: '700', letterSpacing: 1, marginTop: 2, marginBottom: SPACING.md },
  statsRow:          { flexDirection: 'row', alignItems: 'center' },
  stat:              { alignItems: 'center', paddingHorizontal: SPACING.lg },
  statVal:           { fontSize: FONTS.sizes.md, fontWeight: '800', color: COLORS.textPrimary },
  statLabel:         { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, marginTop: 2 },
  statDivider:       { width: 1, height: 32, backgroundColor: COLORS.border },
  section:           { backgroundColor: COLORS.white, padding: SPACING.lg, marginBottom: SPACING.sm },
  sectionTitle:      { fontSize: FONTS.sizes.base, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.sm },
  bio:               { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, lineHeight: 22 },
  chips:             { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  chip:              { backgroundColor: COLORS.primary + '15', paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: BORDER_RADIUS.full },
  chipText:          { fontSize: FONTS.sizes.xs, color: COLORS.primary, fontWeight: '600' },
  reviewCard:        { borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingVertical: SPACING.sm },
  reviewHeader:      { flexDirection: 'row', justifyContent: 'space-between' },
  reviewRating:      { color: '#F59E0B', fontSize: FONTS.sizes.sm },
  reviewDate:        { fontSize: FONTS.sizes.xs, color: COLORS.textMuted },
  reviewComment:     { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, marginTop: 4 },
  workerReply:       { fontSize: FONTS.sizes.xs, color: COLORS.primary, marginTop: 4, fontStyle: 'italic' },
  bookBar:           { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: COLORS.white, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.border, paddingBottom: 28 },
  bookPrice:         { fontSize: FONTS.sizes.lg, fontWeight: '800', color: COLORS.textPrimary },
  negotiable:        { fontSize: FONTS.sizes.xs, color: COLORS.success },
  bookBtn:           { backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.full, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md },
  bookBtnText:       { fontSize: FONTS.sizes.base, fontWeight: '700', color: COLORS.white },
});
