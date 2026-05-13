import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, SafeAreaView, Switch, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { userApi, workerApi } from '../../api';
import { useAuth }  from '../../context/AuthContext';
import { appLogger } from '../../utils/logger';
import { COLORS, SPACING, BORDER_RADIUS, FONTS } from '../../constants';

export default function ProfileScreen({ navigation }: any) {
  const { user, logout, isWorkerMode, setWorkerMode } = useAuth();
  const [profile,  setProfile]  = useState<any>(null);
  const [wallet,   setWallet]   = useState<any>(null);
  const [isOnline, setIsOnline] = useState(false);

  const fetchProfile = useCallback(async () => {
    try {
      if (isWorkerMode) {
        const p = await workerApi.getMyProfile();
        setProfile(p.data.data);
        setIsOnline(p.data.data.isOnline);
      } else {
        const [p, w] = await Promise.all([userApi.getProfile(), userApi.getWallet()]);
        setProfile(p.data.data);
        setWallet(w.data.data);
      }
    } catch (err) {
      appLogger.error({ fn: 'fetchProfile', tag: 'ProfileScreen_fetchProfile_failed', screen: 'Profile' }, 'Failed to fetch profile', err);
    }
  }, [isWorkerMode]);

  useFocusEffect(useCallback(() => { fetchProfile(); }, [fetchProfile]));

  const handleToggleOnline = async (val: boolean) => {
    try {
      await workerApi.toggleOnline(val);
      setIsOnline(val);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Could not update status');
    }
  };

  const handleLogout = () => {
    const doLogout = async () => {
      try {
        await logout();
      } catch (err) {
        appLogger.error({ fn: 'handleLogout', tag: 'ProfileScreen_handleLogout_failed', screen: 'Profile' }, 'Logout failed', err);
      }
    };
    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to logout?')) doLogout();
    } else {
      Alert.alert('Logout', 'Are you sure you want to logout?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: doLogout },
      ]);
    }
  };

  const MenuItem = ({ icon, label, onPress, value, isSwitch }: any) => (
    <TouchableOpacity style={styles.menuItem} onPress={isSwitch ? undefined : onPress}>
      <Text style={styles.menuIcon}>{icon}</Text>
      <Text style={styles.menuLabel}>{label}</Text>
      {isSwitch
        ? <Switch value={value} onValueChange={onPress} trackColor={{ true: COLORS.primary }} />
        : <Text style={styles.menuArrow}>›</Text>}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile header */}
        <View style={styles.hero}>
          <View style={styles.avatarWrap}>
            <Text style={styles.avatarText}>{profile?.fullName?.[0] || user?.phone?.[0] || '?'}</Text>
          </View>
          <Text style={styles.name}>{profile?.fullName || 'Set your name'}</Text>
          <Text style={styles.phone}>{user?.phone}</Text>
          {isWorkerMode && (
            <View style={[styles.badge, { backgroundColor: isOnline ? COLORS.success : COLORS.textMuted }]}>
              <Text style={styles.badgeText}>{isOnline ? 'Online' : 'Offline'}</Text>
            </View>
          )}
        </View>

        {/* Wallet (customer only) */}
        {!isWorkerMode && wallet && (
          <View style={styles.walletCard}>
            <Text style={styles.walletLabel}>Wallet Balance</Text>
            <Text style={styles.walletAmount}>₹{wallet.balance?.toFixed(2) || '0.00'}</Text>
            <TouchableOpacity style={styles.topupBtn}>
              <Text style={styles.topupText}>+ Add Money</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Worker earnings */}
        {isWorkerMode && profile?.wallet && (
          <View style={styles.walletCard}>
            <Text style={styles.walletLabel}>Wallet Balance</Text>
            <Text style={styles.walletAmount}>₹{profile.wallet.balance?.toFixed(2) || '0.00'}</Text>
            <Text style={styles.walletSub}>Total earned: ₹{profile.wallet.totalEarned?.toFixed(2) || '0.00'}</Text>
          </View>
        )}

        {/* Worker online toggle */}
        {isWorkerMode && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Availability</Text>
            <MenuItem icon="🟢" label="Go Online" isSwitch value={isOnline} onPress={handleToggleOnline} />
          </View>
        )}

        {/* Account section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <MenuItem icon="👤" label="Edit Profile"      onPress={() => navigation.navigate('EditProfile')} />
          <MenuItem icon="📍" label="Manage Addresses"  onPress={() => {}} />
          <MenuItem icon="💳" label="Payment Methods"   onPress={() => {}} />
          <MenuItem icon="📜" label="Transaction History" onPress={() => {}} />
        </View>

        {/* Mode switch — only for workers */}
        {user?.role === 'worker' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Mode</Text>
            <MenuItem icon={isWorkerMode ? '🛒' : '👷'} label={isWorkerMode ? 'Switch to Customer' : 'Switch to Worker Mode'} onPress={() => setWorkerMode(!isWorkerMode)} />
          </View>
        )}

        {/* Support */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>
          <MenuItem icon="❓" label="Help & FAQs"    onPress={() => {}} />
          <MenuItem icon="📞" label="Contact Us"     onPress={() => {}} />
          <MenuItem icon="⭐" label="Rate the App"   onPress={() => {}} />
          <MenuItem icon="📄" label="Terms & Privacy" onPress={() => {}} />
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        <Text style={styles.version}>ServeEase v1.0.0</Text>
        <View style={{ height: SPACING.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: COLORS.background },
  hero:        { backgroundColor: COLORS.white, alignItems: 'center', paddingVertical: SPACING.xl },
  avatarWrap:  { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.sm },
  avatarText:  { fontSize: FONTS.sizes.xxl, fontWeight: '700', color: COLORS.white },
  name:        { fontSize: FONTS.sizes.lg, fontWeight: '700', color: COLORS.textPrimary },
  phone:       { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, marginTop: 4 },
  badge:       { marginTop: SPACING.sm, paddingHorizontal: SPACING.md, paddingVertical: 4, borderRadius: BORDER_RADIUS.full },
  badgeText:   { fontSize: FONTS.sizes.xs, fontWeight: '700', color: COLORS.white },
  walletCard:  { backgroundColor: COLORS.primary, margin: SPACING.md, borderRadius: BORDER_RADIUS.lg, padding: SPACING.lg },
  walletLabel: { fontSize: FONTS.sizes.sm, color: COLORS.white + 'CC' },
  walletAmount:{ fontSize: FONTS.sizes.xxl, fontWeight: '800', color: COLORS.white, marginTop: 4 },
  walletSub:   { fontSize: FONTS.sizes.xs, color: COLORS.white + 'AA', marginTop: 4 },
  topupBtn:    { marginTop: SPACING.sm, backgroundColor: COLORS.white + '25', borderRadius: BORDER_RADIUS.full, paddingVertical: 6, paddingHorizontal: SPACING.md, alignSelf: 'flex-start' },
  topupText:   { fontSize: FONTS.sizes.sm, fontWeight: '700', color: COLORS.white },
  section:     { backgroundColor: COLORS.white, marginBottom: SPACING.sm, paddingHorizontal: SPACING.md },
  sectionTitle:{ fontSize: FONTS.sizes.xs, fontWeight: '700', color: COLORS.textMuted, paddingTop: SPACING.md, paddingBottom: SPACING.xs, textTransform: 'uppercase', letterSpacing: 1 },
  menuItem:    { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  menuIcon:    { fontSize: FONTS.sizes.base, marginRight: SPACING.md, width: 24 },
  menuLabel:   { flex: 1, fontSize: FONTS.sizes.base, color: COLORS.textPrimary },
  menuArrow:   { fontSize: FONTS.sizes.lg, color: COLORS.textMuted },
  logoutBtn:   { margin: SPACING.md, borderWidth: 1.5, borderColor: COLORS.error, borderRadius: BORDER_RADIUS.full, paddingVertical: SPACING.md, alignItems: 'center' },
  logoutText:  { fontSize: FONTS.sizes.base, fontWeight: '700', color: COLORS.error },
  version:     { textAlign: 'center', fontSize: FONTS.sizes.xs, color: COLORS.textMuted, marginTop: SPACING.sm },
});
