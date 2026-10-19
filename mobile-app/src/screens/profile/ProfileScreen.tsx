import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  SafeAreaView, Platform, Alert, Switch,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { userApi, workerApi } from '../../api';
import { useAuth }  from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { appLogger } from '../../utils/logger';
import { SPACING, BORDER_RADIUS, FONTS } from '../../constants';
import { colors, THEMES } from '../../theme/theme';

export default function ProfileScreen({ navigation }: any) {
  const { user, logout, isWorkerMode, setWorkerMode } = useAuth();
  const { colors: themeColors, setTheme } = useTheme();
  const [profile,  setProfile]  = useState<any>(null);
  const [wallet,   setWallet]   = useState<any>(null);
  const [isDark, setIsDark]     = useState(themeColors === THEMES.dark ? 'dark' : 'light');

  const fetchProfile = useCallback(async () => {
    try {
      if (isWorkerMode) {
        const p = await workerApi.getMyProfile();
        setProfile(p.data.data);
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
      <View style={[styles.rowIcon, { backgroundColor: themeColors.inputBg }]}>
        <Text style={[styles.menuIcon, { color: themeColors.textSecondary }]}>{icon}</Text>
      </View>
      <Text style={[styles.menuLabel, { color: themeColors.textPrimary }]}>{label}</Text>
      {isSwitch
        ? <Switch value={value} onValueChange={onPress} trackColor={{ true: themeColors.primary }} />
        : <Text style={[styles.menuArrow, { color: themeColors.textMuted }]}>›</Text>}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Profile header */}
        <View style={[styles.hero, { backgroundColor: colors.surface }]}>
          <View style={styles.avatarWrap}>
            <Text style={styles.avatarText}>{profile?.fullName?.[0] || user?.phone?.[0] || '?'}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.name}>{profile?.fullName || 'Set your name'}</Text>
            {isWorkerMode && profile?.verification?.status === 'verified' && (
              <Text style={{ fontSize: 18 }}>✅</Text>
            )}
            {isWorkerMode && profile?.verification?.status !== 'verified' && (
              <Text style={{ fontSize: 16, color: themeColors.textMuted }}>⚪</Text>
            )}
          </View>
          <Text style={styles.phone}>{user?.phone}</Text>

        </View>

        {/* Wallet (customer only) */}
        {!isWorkerMode && wallet && (
          <View style={[styles.walletCard, { backgroundColor: colors.primary }]}>
            <Text style={[styles.walletLabel, { color: colors.white + 'CC' }]}>Wallet Balance</Text>
            <Text style={[styles.walletAmount, { color: colors.white }]}>₹{wallet.balance?.toFixed(2) || '0.00'}</Text>
            <TouchableOpacity style={[styles.topupBtn, { backgroundColor: colors.white + '25' }]}>
              <Text style={[styles.topupText, { color: colors.white }]}>+ Add Money</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Worker earnings */}
        {isWorkerMode && profile?.wallet && (
          <View style={[styles.walletCard, { backgroundColor: colors.primary }]}>
            <Text style={[styles.walletLabel, { color: colors.white + 'CC' }]}>Wallet Balance</Text>
            <Text style={[styles.walletAmount, { color: colors.white }]}>₹{profile.wallet.balance?.toFixed(2) || '0.00'}</Text>
            <Text style={[styles.walletSub, { color: colors.white + 'AA' }]}>Total earned: ₹{profile.wallet.totalEarned?.toFixed(2) || '0.00'}</Text>
          </View>
        )}

        {/* Theme */}
        <View style={[styles.section, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Theme</Text>
          <MenuItem
            icon={isDark === 'dark' ? '🌙' : '☀️'}
            label="Dark Mode"
            isSwitch
            value={isDark === 'dark'}
            onPress={(val: boolean) => { setIsDark(val ? 'dark' : 'light'); setTheme(val ? 'dark' : 'light'); }}
          />
          <Text style={[styles.themeHint, { color: colors.textMuted }]}>More themes coming soon</Text>
        </View>

        {/* Account section */}
        <View style={[styles.section, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Account</Text>
          <MenuItem icon="👤" label="Edit Profile"      onPress={() => navigation.navigate('EditProfile')} />
          <MenuItem icon="📍" label="Manage Addresses"  onPress={() => navigation.navigate('Addresses')} />
          <MenuItem icon="💳" label="Payment Methods"   onPress={() => {}} />
          <MenuItem icon="📜" label="Transaction History" onPress={() => {}} />
        </View>

        {/* Mode switch — only for workers */}
        {user?.role === 'worker' && (
          <View style={[styles.section, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Mode</Text>
            <MenuItem icon={isWorkerMode ? '🛒' : '👷'} label={isWorkerMode ? 'Switch to Customer' : 'Switch to Worker Mode'} onPress={() => setWorkerMode(!isWorkerMode)} />
          </View>
        )}

        {/* Worker verification */}
        {user?.role === 'worker' && (
          <>
            <View style={[styles.section, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Verification</Text>
              <MenuItem
                icon="📄"
                label="Verification Documents"
                onPress={() => navigation.navigate('Verification')}
              />
            </View>
          </>
        )}

        {/* Support */}
        <View style={[styles.section, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Support</Text>
          <MenuItem icon="❓" label="Help & FAQs"    onPress={() => {}} />
          <MenuItem icon="📞" label="Contact Us"     onPress={() => {}} />
          <MenuItem icon="⭐" label="Rate the App"   onPress={() => {}} />
          <MenuItem icon="📄" label="Terms & Privacy" onPress={() => {}} />
        </View>

        {/* Logout */}
        <TouchableOpacity style={[styles.logoutBtn, { borderColor: colors.error }]} onPress={handleLogout}>
          <Text style={[styles.logoutText, { color: colors.error }]}>Logout</Text>
        </TouchableOpacity>

        <Text style={[styles.version, { color: colors.textMuted }]}>ServeEase v1.0.0</Text>
        <View style={{ height: SPACING.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: colors.background },
  content:     { paddingHorizontal: SPACING.md, gap: SPACING.sm },
  hero:        { backgroundColor: colors.surface, alignItems: 'center', paddingVertical: SPACING.xl },
  avatarWrap:  { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.sm },
  avatarText:  { fontSize: FONTS.sizes.xxl, fontWeight: '700', color: colors.white },
  name:        { fontSize: FONTS.sizes.lg, fontWeight: '700', color: colors.textPrimary },
  phone:       { fontSize: FONTS.sizes.sm, color: colors.textSecondary, marginTop: 4 },
  badge:       { marginTop: SPACING.sm, paddingHorizontal: SPACING.md, paddingVertical: 4, borderRadius: BORDER_RADIUS.full },
  badgeText:   { fontSize: FONTS.sizes.xs, fontWeight: '700', color: colors.white },
  walletCard:  { backgroundColor: colors.primary, margin: SPACING.md, borderRadius: BORDER_RADIUS.lg, padding: SPACING.lg },
  walletLabel: { fontSize: FONTS.sizes.sm, color: colors.white + 'CC' },
  walletAmount:{ fontSize: FONTS.sizes.xxl, fontWeight: '800', color: colors.white, marginTop: 4 },
  walletSub:   { fontSize: FONTS.sizes.xs, color: colors.white + 'AA', marginTop: 4 },
  topupBtn:    { marginTop: SPACING.sm, backgroundColor: colors.white + '25', borderRadius: BORDER_RADIUS.full, paddingVertical: 6, paddingHorizontal: SPACING.md, alignSelf: 'flex-start' },
  topupText:   { fontSize: FONTS.sizes.sm, fontWeight: '700', color: colors.white },
  section:     { backgroundColor: colors.cardBg, marginBottom: SPACING.sm, paddingHorizontal: SPACING.md, borderWidth: 1, borderColor: colors.border, borderRadius: BORDER_RADIUS.md },
  sectionTitle:{ fontSize: FONTS.sizes.xs, fontWeight: '700', color: colors.textMuted, paddingTop: SPACING.md, paddingBottom: SPACING.xs, textTransform: 'uppercase', letterSpacing: 1 },
  menuItem:    { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowIcon:     { width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginRight: SPACING.md },
  menuIcon:    { fontSize: FONTS.sizes.base },
  menuLabel:   { flex: 1, fontSize: FONTS.sizes.base, color: colors.textPrimary },
  menuArrow:   { fontSize: FONTS.sizes.lg, color: colors.textMuted },
  themeHint:   { fontSize: FONTS.sizes.xs, color: colors.textMuted, marginTop: SPACING.xs, paddingHorizontal: SPACING.md },
  logoutBtn:   { margin: SPACING.md, borderWidth: 1.5, borderColor: colors.error, borderRadius: BORDER_RADIUS.full, paddingVertical: SPACING.md, alignItems: 'center' },
  logoutText:  { fontSize: FONTS.sizes.base, fontWeight: '700', color: colors.error },
  version:     { textAlign: 'center', fontSize: FONTS.sizes.xs, color: colors.textMuted, marginTop: SPACING.sm },
});
