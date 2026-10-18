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
import { SPACING, BORDER_RADIUS, FONTS } from '../../constants';
import { useTheme }                  from '../../context/ThemeContext';
import { colors }                    from '../../theme/theme';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'WorkerProfile'>;
  route:      RouteProp<RootStackParamList, 'WorkerProfile'>;
};

export default function WorkerProfileScreen({ navigation, route }: Props) {
  const { workerId } = route.params;
  const { colors: themeColors } = useTheme();
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

  if (loading) return <View style={[styles.center, { backgroundColor: themeColors.background }]}><ActivityIndicator size="large" color={themeColors.primary} /></View>;
  if (!worker) return null;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: themeColors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
            <Text style={[styles.backText, { color: themeColors.textPrimary }]}>←</Text>
          </TouchableOpacity>
        </View>

        {/* Profile hero */}
        <View style={[styles.hero, { backgroundColor: themeColors.surface }]}>
          {worker.profilePhoto
            ? <Image source={{ uri: worker.profilePhoto }} style={styles.avatar} />
            : <View style={[styles.avatarPlaceholder, { backgroundColor: themeColors.primary + '20' }]}><Text style={[styles.avatarInitial, { color: themeColors.primary }]}>{worker.fullName?.[0]}</Text></View>}
          <View style={styles.onlineRow}>
            <View style={[styles.dot, { backgroundColor: worker.isOnline ? themeColors.success : themeColors.textMuted }]} />
            <Text style={[styles.onlineText, { color: themeColors.textSecondary }]}>{worker.isOnline ? 'Available now' : 'Currently offline'}</Text>
          </View>
          <Text style={[styles.name, { color: themeColors.textPrimary }]}>{worker.fullName}</Text>
          <Text style={[styles.category, { color: themeColors.primary }]}>{worker.serviceCategory.replace(/_/g, ' ').toUpperCase()}</Text>
          <View style={styles.statsRow}>
            <View style={styles.stat}><Text style={[styles.statVal, { color: themeColors.textPrimary }]}>★ {worker.ratings.average.toFixed(1)}</Text><Text style={[styles.statLabel, { color: themeColors.textMuted }]}>{worker.ratings.totalReviews} reviews</Text></View>
            <View style={styles.statDivider} />
            <View style={styles.stat}><Text style={[styles.statVal, { color: themeColors.textPrimary }]}>{worker.experience}yr</Text><Text style={[styles.statLabel, { color: themeColors.textMuted }]}>experience</Text></View>
            <View style={styles.statDivider} />
            <View style={styles.stat}><Text style={[styles.statVal, { color: themeColors.textPrimary }]}>₹{worker.pricing.hourlyRate}</Text><Text style={[styles.statLabel, { color: themeColors.textMuted }]}>per hour</Text></View>
          </View>
        </View>

        {/* Bio */}
        {worker.bio ? (
          <View style={[styles.section, { backgroundColor: themeColors.cardBg }]}>
            <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>About</Text>
            <Text style={[styles.bio, { color: themeColors.textSecondary }]}>{worker.bio}</Text>
          </View>
        ) : null}

        {/* Specializations */}
        {worker.serviceSubTypes?.length > 0 && (
          <View style={[styles.section, { backgroundColor: themeColors.cardBg }]}>
            <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>Specializations</Text>
            <View style={styles.chips}>
              {worker.serviceSubTypes.map((s: string) => (
                <View key={s} style={[styles.chipPrimary, { backgroundColor: themeColors.primary + '15' }]}><Text style={[styles.chipPrimaryText, { color: themeColors.primary }]}>{s}</Text></View>
              ))}
            </View>
          </View>
        )}

        {/* Skills & Certifications */}
        {worker.skills?.length > 0 && (
          <View style={[styles.section, { backgroundColor: themeColors.cardBg }]}>
            <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>Skills & Certifications</Text>
            <View style={styles.chips}>
              {worker.skills.map((s: string) => (
                <View key={s} style={[styles.chip, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border }]}><Text style={[styles.chipText, { color: themeColors.textSecondary }]}>{s}</Text></View>
              ))}
            </View>
          </View>
        )}

        {/* Service area + availability + languages */}
        {(worker.serviceArea || worker.availability?.shift || worker.languages?.length > 0) && (
          <View style={[styles.section, { backgroundColor: themeColors.cardBg }]}>
            <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>Details</Text>

            {worker.serviceArea ? (
              <View style={styles.detailRow}>
                <Text style={styles.detailIcon}>📍</Text>
                <View style={styles.detailBody}>
                  <Text style={[styles.detailLabel, { color: themeColors.textMuted }]}>Service Area</Text>
                  <Text style={[styles.detailValue, { color: themeColors.textPrimary }]}>{worker.serviceArea}</Text>
                </View>
              </View>
            ) : null}

            {(worker.availability?.days?.length > 0 || worker.availability?.shift) && (
              <View style={styles.detailRow}>
                <Text style={styles.detailIcon}>🗓</Text>
                <View style={styles.detailBody}>
                  <Text style={[styles.detailLabel, { color: themeColors.textMuted }]}>Availability</Text>
                  {worker.availability.days?.length > 0 && (
                    <Text style={[styles.detailValue, { color: themeColors.textPrimary }]}>{worker.availability.days.join(', ')}</Text>
                  )}
                  {worker.availability.shift ? (
                    <Text style={[styles.detailValue, { color: themeColors.textPrimary }]}>{worker.availability.shift}</Text>
                  ) : null}
                </View>
              </View>
            )}

            {worker.languages?.length > 0 && (
              <View style={styles.detailRow}>
                <Text style={styles.detailIcon}>🗣</Text>
                <View style={styles.detailBody}>
                  <Text style={[styles.detailLabel, { color: themeColors.textMuted }]}>Languages</Text>
                  <Text style={[styles.detailValue, { color: themeColors.textPrimary }]}>{worker.languages.join(', ')}</Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Reviews */}
        <View style={[styles.section, { backgroundColor: themeColors.cardBg }]}>
          <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>Reviews ({reviews.length})</Text>
          {reviews.slice(0, 5).map((r: any) => (
            <View key={r._id} style={[styles.reviewCard, { borderBottomColor: themeColors.border }]}>
              <View style={styles.reviewHeader}>
                <Text style={styles.reviewRating}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</Text>
                <Text style={[styles.reviewDate, { color: themeColors.textMuted }]}>{new Date(r.createdAt).toLocaleDateString()}</Text>
              </View>
              <Text style={[styles.reviewComment, { color: themeColors.textSecondary }]}>{r.comment}</Text>
              {r.workerReply && <Text style={[styles.workerReply, { color: themeColors.primary }]}>Reply: {r.workerReply}</Text>}
            </View>
          ))}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Book button */}
      <View style={[styles.bookBar, { backgroundColor: themeColors.surface, borderTopColor: themeColors.border }]}>
        <View>
          <Text style={[styles.bookPrice, { color: themeColors.textPrimary }]}>₹{worker.pricing.hourlyRate}/hr</Text>
          {worker.pricing.isNegotiable && <Text style={[styles.negotiable, { color: themeColors.success }]}>Price negotiable</Text>}
        </View>
        <TouchableOpacity style={[styles.bookBtn, { backgroundColor: themeColors.primary }]} onPress={() => setPriceModal(true)} disabled={!worker.isOnline}>
          <Text style={[styles.bookBtnText, { color: themeColors.white }]}>{worker.isOnline ? 'Book Now' : 'Offline'}</Text>
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
  safe:              { flex: 1 },
  center:            { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header:            { padding: SPACING.md },
  back:              { width: 40, height: 40, justifyContent: 'center' },
  backText:          { fontSize: 24 },
  hero:              { alignItems: 'center', paddingVertical: SPACING.xl, paddingHorizontal: SPACING.lg, marginBottom: SPACING.sm },
  avatar:            { width: 96, height: 96, borderRadius: 48, marginBottom: SPACING.sm },
  avatarPlaceholder: { width: 96, height: 96, borderRadius: 48, justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.sm },
  avatarInitial:     { fontSize: FONTS.sizes.xxl, fontWeight: '700' },
  onlineRow:         { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.xs },
  dot:               { width: 8, height: 8, borderRadius: 4, marginRight: 4 },
  onlineText:        { fontSize: FONTS.sizes.xs },
  name:              { fontSize: FONTS.sizes.xl, fontWeight: '800' },
  category:          { fontSize: FONTS.sizes.xs, fontWeight: '700', letterSpacing: 1, marginTop: 2, marginBottom: SPACING.md },
  statsRow:          { flexDirection: 'row', alignItems: 'center' },
  stat:              { alignItems: 'center', paddingHorizontal: SPACING.lg },
  statVal:           { fontSize: FONTS.sizes.md, fontWeight: '800' },
  statLabel:         { fontSize: FONTS.sizes.xs, marginTop: 2 },
  statDivider:       { width: 1, height: 32 },
  section:           { padding: SPACING.lg, marginBottom: SPACING.sm, borderRadius: BORDER_RADIUS.md },
  sectionTitle:      { fontSize: FONTS.sizes.base, fontWeight: '700', marginBottom: SPACING.sm },
  bio:               { fontSize: FONTS.sizes.sm, lineHeight: 22 },
  chips:             { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  chip:              { paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: BORDER_RADIUS.full, borderWidth: 1 },
  chipText:          { fontSize: FONTS.sizes.xs, fontWeight: '600' },
  chipPrimary:       { paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: BORDER_RADIUS.full },
  chipPrimaryText:   { fontSize: FONTS.sizes.xs, fontWeight: '700' },
  detailRow:         { flexDirection: 'row', alignItems: 'flex-start', marginBottom: SPACING.md },
  detailIcon:        { fontSize: 18, marginRight: SPACING.sm, marginTop: 1 },
  detailBody:        { flex: 1 },
  detailLabel:       { fontSize: FONTS.sizes.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  detailValue:       { fontSize: FONTS.sizes.sm, lineHeight: 20 },
  reviewCard:        { paddingVertical: SPACING.sm },
  reviewHeader:      { flexDirection: 'row', justifyContent: 'space-between' },
  reviewRating:      { color: '#F59E0B', fontSize: FONTS.sizes.sm },
  reviewDate:        { fontSize: FONTS.sizes.xs },
  reviewComment:     { fontSize: FONTS.sizes.sm, marginTop: 4 },
  workerReply:       { fontSize: FONTS.sizes.xs, marginTop: 4, fontStyle: 'italic' },
  bookBar:           { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.md, borderTopWidth: 1, paddingBottom: 28 },
  bookPrice:         { fontSize: FONTS.sizes.lg, fontWeight: '800' },
  negotiable:        { fontSize: FONTS.sizes.xs },
  bookBtn:           { borderRadius: BORDER_RADIUS.full, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md },
  bookBtnText:       { fontSize: FONTS.sizes.base, fontWeight: '700' },
});
