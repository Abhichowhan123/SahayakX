import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  TextInput, Image, Alert,
} from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, FONTS } from '../../constants';

interface Worker {
  _id:           string;
  fullName:      string;
  profilePhoto?: string;
  pricing:       { hourlyRate: number; currency: string; isNegotiable: boolean; suggestedFares?: number[] };
  ratings:       { average: number };
}

interface Props {
  visible:  boolean;
  worker:   Worker;
  onClose:  () => void;
  onBook:   (offeredPrice?: number) => void;
}

/**
 * PriceOfferModal — matches the screenshot:
 *   ┌───────────────────────────────┐
 *   │  PayFast  [worker name]       │
 *   │  ─────────────────────────── │
 *   │  [Accept for ₹100]  ← green  │
 *   │                               │
 *   │  Offer your fare:             │
 *   │  [₹110]  [₹120]  [₹130]     │
 *   │                               │
 *   │         [Close]               │
 *   └───────────────────────────────┘
 */
export default function PriceOfferModal({ visible, worker, onClose, onBook }: Props) {
  const basePrice     = worker.pricing.hourlyRate;
  const [custom,      setCustom]      = useState('');
  const [selected,    setSelected]    = useState<number | null>(null);

  // Generate suggested fares: base + 10%, +20%, +30% (or use worker's suggestions)
  const suggestedFares = worker.pricing.suggestedFares?.length
    ? worker.pricing.suggestedFares
    : [
        Math.round(basePrice * 1.10),
        Math.round(basePrice * 1.20),
        Math.round(basePrice * 1.30),
      ];

  const handleAcceptBase = () => onBook(basePrice);

  const handleOfferFare = (amount: number) => {
    setSelected(amount);
    setCustom('');
  };

  const handleConfirmOffer = () => {
    const amount = custom ? parseInt(custom, 10) : selected;
    if (!amount || amount < basePrice * 0.5) {
      Alert.alert('Low offer', `Minimum offer is ₹${Math.round(basePrice * 0.5)}`);
      return;
    }
    onBook(amount);
  };

  const currencySymbol = worker.pricing.currency === 'ZAR' ? 'R' : '₹';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={styles.sheet} activeOpacity={1}>

          {/* Drag handle */}
          <View style={styles.handle} />

          {/* Worker identity */}
          <View style={styles.workerRow}>
            {worker.profilePhoto
              ? <Image source={{ uri: worker.profilePhoto }} style={styles.avatar} />
              : <View style={styles.avatarPlaceholder}><Text style={styles.avatarInitial}>{worker.fullName?.[0] || '?'}</Text></View>
            }
            <View style={styles.workerInfo}>
              <Text style={styles.workerName}>{worker.fullName}</Text>
              <Text style={styles.workerRating}>★ {worker.ratings.average.toFixed(1)}</Text>
            </View>
            <View style={styles.payBadge}>
              <Text style={styles.payBadgeText}>PayFast</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Primary CTA — Accept at quoted price */}
          <TouchableOpacity style={styles.acceptBtn} onPress={handleAcceptBase} activeOpacity={0.85}>
            <Text style={styles.acceptBtnText}>
              Accept for {currencySymbol}{basePrice}
            </Text>
          </TouchableOpacity>

          {/* Fare offer section */}
          {worker.pricing.isNegotiable && (
            <>
              <Text style={styles.offerLabel}>Offer your fare</Text>

              {/* Suggested fare chips */}
              <View style={styles.faresRow}>
                {suggestedFares.map((fare) => (
                  <TouchableOpacity
                    key={fare}
                    style={[styles.fareChip, selected === fare && styles.fareChipSelected]}
                    onPress={() => handleOfferFare(fare)}
                  >
                    <Text style={[styles.fareChipText, selected === fare && styles.fareChipTextSelected]}>
                      {currencySymbol}{fare}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Custom amount input */}
              <View style={styles.customRow}>
                <TextInput
                  style={styles.customInput}
                  value={custom}
                  onChangeText={(v) => { setCustom(v.replace(/\D/g, '')); setSelected(null); }}
                  placeholder={`Custom amount (min ${currencySymbol}${Math.round(basePrice * 0.5)})`}
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="numeric"
                />
              </View>

              {(selected !== null || custom !== '') && (
                <TouchableOpacity style={styles.offerBtn} onPress={handleConfirmOffer}>
                  <Text style={styles.offerBtnText}>
                    Send offer of {currencySymbol}{custom || selected}
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}

          {/* Close */}
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Close</Text>
          </TouchableOpacity>

        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay:            { flex: 1, backgroundColor: '#00000055', justifyContent: 'flex-end' },
  sheet:              { backgroundColor: COLORS.white, borderTopLeftRadius: BORDER_RADIUS.xl, borderTopRightRadius: BORDER_RADIUS.xl, padding: SPACING.lg, paddingBottom: 32 },
  handle:             { width: 40, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: 'center', marginBottom: SPACING.md },
  workerRow:          { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md },
  avatar:             { width: 48, height: 48, borderRadius: 24, marginRight: SPACING.sm },
  avatarPlaceholder:  { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.primary + '20', justifyContent: 'center', alignItems: 'center', marginRight: SPACING.sm },
  avatarInitial:      { fontSize: FONTS.sizes.lg, fontWeight: '700', color: COLORS.primary },
  workerInfo:         { flex: 1 },
  workerName:         { fontSize: FONTS.sizes.base, fontWeight: '700', color: COLORS.textPrimary },
  workerRating:       { fontSize: FONTS.sizes.sm, color: '#F59E0B', marginTop: 2 },
  payBadge:           { backgroundColor: COLORS.primary + '15', paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: BORDER_RADIUS.sm },
  payBadgeText:       { fontSize: FONTS.sizes.xs, fontWeight: '700', color: COLORS.primary },
  divider:            { height: 1, backgroundColor: COLORS.border, marginBottom: SPACING.md },
  // Accept button — main green CTA matching screenshot
  acceptBtn:          { backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.lg, paddingVertical: SPACING.md + 2, alignItems: 'center', marginBottom: SPACING.md },
  acceptBtnText:      { fontSize: FONTS.sizes.md, fontWeight: '800', color: COLORS.white, letterSpacing: 0.3 },
  // Offer section
  offerLabel:         { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, textAlign: 'center', marginBottom: SPACING.sm },
  faresRow:           { flexDirection: 'row', justifyContent: 'center', gap: SPACING.sm, marginBottom: SPACING.md },
  fareChip:           { backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.lg, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm + 2, minWidth: 72, alignItems: 'center' },
  fareChipSelected:   { backgroundColor: COLORS.primaryDark, borderWidth: 2, borderColor: COLORS.white },
  fareChipText:       { fontSize: FONTS.sizes.base, fontWeight: '700', color: COLORS.white },
  fareChipTextSelected: { color: COLORS.white },
  customRow:          { marginBottom: SPACING.sm },
  customInput:        { backgroundColor: COLORS.inputBg, borderRadius: BORDER_RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, fontSize: FONTS.sizes.base, color: COLORS.textPrimary, textAlign: 'center' },
  offerBtn:           { backgroundColor: COLORS.primaryDark, borderRadius: BORDER_RADIUS.full, paddingVertical: SPACING.sm + 2, alignItems: 'center', marginBottom: SPACING.sm },
  offerBtnText:       { fontSize: FONTS.sizes.sm, fontWeight: '700', color: COLORS.white },
  // Close
  closeBtn:           { alignItems: 'center', paddingVertical: SPACING.sm },
  closeBtnText:       { fontSize: FONTS.sizes.base, color: COLORS.textSecondary, fontWeight: '600' },
});
