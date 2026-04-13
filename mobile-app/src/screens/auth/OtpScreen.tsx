import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp }                 from '@react-navigation/native';
import { AuthStackParamList }        from '../../navigation';
import { useAuth }                   from '../../context/AuthContext';
import { COLORS, SPACING, BORDER_RADIUS, FONTS } from '../../constants';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Otp'>;
  route:      RouteProp<AuthStackParamList, 'Otp'>;
};

const OTP_LENGTH = 6;

export default function OtpScreen({ navigation, route }: Props) {
  const { phone, role } = route.params;
  const { verifyOtp, sendOtp } = useAuth();

  const [digits,    setDigits]    = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [loading,   setLoading]   = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const refs = useRef<Array<TextInput | null>>(Array(OTP_LENGTH).fill(null));

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const handleChange = (val: string, idx: number) => {
    const d = [...digits];
    d[idx]  = val.replace(/\D/g, '').slice(-1);
    setDigits(d);
    if (val && idx < OTP_LENGTH - 1) refs.current[idx + 1]?.focus();
    if (d.every(Boolean)) handleVerify(d.join(''));
  };

  const handleKeyPress = (e: any, idx: number) => {
    if (e.nativeEvent.key === 'Backspace' && !digits[idx] && idx > 0) {
      refs.current[idx - 1]?.focus();
    }
  };

  const handleVerify = async (otp?: string) => {
    const code = otp || digits.join('');
    if (code.length < OTP_LENGTH) { Alert.alert('Enter complete OTP'); return; }
    setLoading(true);
    try {
      await verifyOtp(phone, code);
      // Navigation handled by AuthContext → navigator re-renders
    } catch (err: any) {
      Alert.alert('Invalid OTP', err?.response?.data?.message || 'Please check the code and try again.');
      setDigits(Array(OTP_LENGTH).fill(''));
      refs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await sendOtp(phone, role);
      setCountdown(30);
      setDigits(Array(OTP_LENGTH).fill(''));
      refs.current[0]?.focus();
    } catch {
      Alert.alert('Error', 'Could not resend OTP. Try again.');
    } finally {
      setResending(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Enter OTP</Text>
      <Text style={styles.subtitle}>
        We sent a {OTP_LENGTH}-digit code to{'\n'}
        <Text style={styles.phone}>{phone}</Text>
      </Text>

      {/* OTP boxes */}
      <View style={styles.otpRow}>
        {digits.map((d, i) => (
          <TextInput
            key={i}
            ref={(r) => { refs.current[i] = r; }}
            style={[styles.otpBox, d ? styles.otpBoxFilled : null]}
            value={d}
            onChangeText={(v) => handleChange(v, i)}
            onKeyPress={(e) => handleKeyPress(e, i)}
            keyboardType="numeric"
            maxLength={1}
            selectTextOnFocus
          />
        ))}
      </View>

      {/* Verify button */}
      <TouchableOpacity style={styles.btn} onPress={() => handleVerify()} disabled={loading}>
        {loading
          ? <ActivityIndicator color={COLORS.white} />
          : <Text style={styles.btnText}>Verify & Continue</Text>}
      </TouchableOpacity>

      {/* Resend */}
      <View style={styles.resendRow}>
        {countdown > 0 ? (
          <Text style={styles.resendHint}>Resend OTP in <Text style={styles.timer}>{countdown}s</Text></Text>
        ) : (
          <TouchableOpacity onPress={handleResend} disabled={resending}>
            <Text style={styles.resendLink}>{resending ? 'Sending...' : 'Resend OTP'}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: COLORS.white, padding: SPACING.lg, paddingTop: 60 },
  back:         { marginBottom: SPACING.lg },
  backText:     { fontSize: FONTS.sizes.base, color: COLORS.primary, fontWeight: '600' },
  title:        { fontSize: FONTS.sizes.xxl, fontWeight: '800', color: COLORS.textPrimary, marginBottom: SPACING.sm },
  subtitle:     { fontSize: FONTS.sizes.base, color: COLORS.textSecondary, marginBottom: SPACING.xl, lineHeight: 24 },
  phone:        { fontWeight: '700', color: COLORS.textPrimary },
  otpRow:       { flexDirection: 'row', gap: SPACING.sm, justifyContent: 'center', marginBottom: SPACING.xl },
  otpBox:       { width: 48, height: 56, borderRadius: BORDER_RADIUS.md, borderWidth: 2, borderColor: COLORS.border, fontSize: FONTS.sizes.xl, textAlign: 'center', fontWeight: '700', color: COLORS.textPrimary, backgroundColor: COLORS.inputBg },
  otpBoxFilled: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '10' },
  btn:          { backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.full, paddingVertical: SPACING.md + 2, alignItems: 'center', marginBottom: SPACING.md },
  btnText:      { fontSize: FONTS.sizes.md, fontWeight: '700', color: COLORS.white },
  resendRow:    { alignItems: 'center' },
  resendHint:   { fontSize: FONTS.sizes.sm, color: COLORS.textMuted },
  timer:        { fontWeight: '700', color: COLORS.primary },
  resendLink:   { fontSize: FONTS.sizes.sm, color: COLORS.primary, fontWeight: '700' },
});
