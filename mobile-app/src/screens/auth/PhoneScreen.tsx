import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList }        from '../../navigation';
import { useAuth }                   from '../../context/AuthContext';
import { COLORS, SPACING, BORDER_RADIUS, FONTS } from '../../constants';

type Props = { navigation: NativeStackNavigationProp<AuthStackParamList, 'Phone'> };

export default function PhoneScreen({ navigation }: Props) {
  const { sendOtp }   = useAuth();
  const [phone,       setPhone]       = useState('');
  const [role,        setRole]        = useState<'customer' | 'worker'>('customer');
  const [loading,     setLoading]     = useState(false);

  const handleSend = async () => {
    const cleaned = phone.replace(/\s+/g, '');
    if (!/^\+?[1-9]\d{9,14}$/.test(cleaned)) {
      Alert.alert('Invalid number', 'Please enter a valid phone number with country code e.g. +919876543210');
      return;
    }
    setLoading(true);
    try {
      await sendOtp(cleaned, role);
      navigation.navigate('Otp', { phone: cleaned, role });
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to send OTP. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>ServeEase</Text>
          <Text style={styles.tagline}>Home services at your doorstep</Text>
        </View>

        {/* Role selector */}
        <View style={styles.roleRow}>
          {(['customer', 'worker'] as const).map((r) => (
            <TouchableOpacity
              key={r}
              style={[styles.roleBtn, role === r && styles.roleBtnActive]}
              onPress={() => setRole(r)}
            >
              <Text style={[styles.roleBtnText, role === r && styles.roleBtnTextActive]}>
                {r === 'customer' ? '🛒  I need a service' : '👷  I provide service'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Phone input */}
        <Text style={styles.label}>Enter your mobile number</Text>
        <View style={styles.inputWrapper}>
          <Text style={styles.flag}>🇮🇳 +91</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="98765 43210"
            placeholderTextColor={COLORS.textMuted}
            keyboardType="phone-pad"
            maxLength={15}
          />
        </View>

        <Text style={styles.hint}>We'll send a 6-digit OTP to verify your number</Text>

        <TouchableOpacity style={styles.btn} onPress={handleSend} disabled={loading}>
          {loading
            ? <ActivityIndicator color={COLORS.white} />
            : <Text style={styles.btnText}>Send OTP</Text>}
        </TouchableOpacity>

        <Text style={styles.terms}>
          By continuing you agree to our{' '}
          <Text style={styles.link}>Terms of Service</Text> and{' '}
          <Text style={styles.link}>Privacy Policy</Text>
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: COLORS.white },
  scroll:         { flexGrow: 1, padding: SPACING.lg, justifyContent: 'center' },
  header:         { alignItems: 'center', marginBottom: SPACING.xxl },
  logo:           { fontSize: FONTS.sizes.xxl, fontWeight: '800', color: COLORS.primary },
  tagline:        { fontSize: FONTS.sizes.base, color: COLORS.textSecondary, marginTop: SPACING.xs },
  roleRow:        { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg },
  roleBtn:        { flex: 1, padding: SPACING.md, borderRadius: BORDER_RADIUS.md, borderWidth: 2, borderColor: COLORS.border, alignItems: 'center' },
  roleBtnActive:  { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '10' },
  roleBtnText:    { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, fontWeight: '600' },
  roleBtnTextActive: { color: COLORS.primary },
  label:          { fontSize: FONTS.sizes.md, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.sm },
  inputWrapper:   { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.inputBg, borderRadius: BORDER_RADIUS.md, paddingHorizontal: SPACING.md, marginBottom: SPACING.sm },
  flag:           { fontSize: FONTS.sizes.base, marginRight: SPACING.sm, color: COLORS.textPrimary },
  input:          { flex: 1, fontSize: FONTS.sizes.lg, paddingVertical: SPACING.md, color: COLORS.textPrimary, letterSpacing: 1 },
  hint:           { fontSize: FONTS.sizes.sm, color: COLORS.textMuted, marginBottom: SPACING.lg },
  btn:            { backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.full, paddingVertical: SPACING.md + 2, alignItems: 'center', marginBottom: SPACING.lg },
  btnText:        { fontSize: FONTS.sizes.md, fontWeight: '700', color: COLORS.white },
  terms:          { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, textAlign: 'center', lineHeight: 18 },
  link:           { color: COLORS.primary, fontWeight: '600' },
});
