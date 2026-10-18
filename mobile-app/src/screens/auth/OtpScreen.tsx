import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp }                 from '@react-navigation/native';
import { AuthStackParamList }        from '../../navigation';
import { useAuth }                   from '../../context/AuthContext';
import { useTheme }                  from '../../context/ThemeContext';
import { colors }                    from '../../theme/theme';
import { SPACING, BORDER_RADIUS, FONTS } from '../../constants';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Otp'>;
  route:      RouteProp<AuthStackParamList, 'Otp'>;
};

const OTP_LENGTH = 6;

export default function OtpScreen({ navigation, route }: Props) {
  const { phone, role, mode, devOtp } = route.params;
  const { verifyOtp, sendOtp } = useAuth();
  const { colors: themeColors } = useTheme();

  const [digits,    setDigits]    = useState<string[]>(
    devOtp ? devOtp.split('') : Array(OTP_LENGTH).fill(''),
  );
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
      const result = await sendOtp(phone, role, mode);
      setCountdown(30);
      if (result?.devOtp) {
        setDigits(result.devOtp.split(''));
      } else {
        setDigits(Array(OTP_LENGTH).fill(''));
        refs.current[0]?.focus();
      }
    } catch {
      Alert.alert('Error', 'Could not resend OTP. Try again.');
    } finally {
      setResending(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
        <Text style={[styles.backText, { color: themeColors.primary }]}>← Back</Text>
      </TouchableOpacity>

      <Text style={[styles.title, { color: themeColors.textPrimary }]}>Enter OTP</Text>
      <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>
        We sent a {OTP_LENGTH}-digit code to{'\n'}
        <Text style={[styles.phone, { color: themeColors.textPrimary }]}>{phone}</Text>
      </Text>

      {devOtp ? (
        <View style={[styles.devBanner, { borderColor: '#FFC107' }]}>
          <Text style={[styles.devBannerText, { color: '#856404' }]}>🛠 DEV MODE — OTP: {devOtp}</Text>
        </View>
      ) : null}

      {/* OTP boxes */}
      <View style={styles.otpRow}>
        {digits.map((d, i) => (
          <TextInput
            key={i}
            ref={(r) => { refs.current[i] = r; }}
            style={[styles.otpBox, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }, d ? { backgroundColor: themeColors.primary + '10', borderColor: themeColors.primary } : null]}
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
      <TouchableOpacity style={[styles.btn, { backgroundColor: themeColors.primary }]} onPress={() => handleVerify()} disabled={loading}>
        {loading
          ? <ActivityIndicator color={themeColors.white} />
          : <Text style={[styles.btnText, { color: themeColors.white }]}>Verify & Continue</Text>}
      </TouchableOpacity>

      {/* Resend */}
      <View style={styles.resendRow}>
        {countdown > 0 ? (
          <Text style={[styles.resendHint, { color: themeColors.textMuted }]}>Resend OTP in <Text style={[styles.timer, { color: themeColors.primary }]}>{countdown}s</Text></Text>
        ) : (
          <TouchableOpacity onPress={handleResend} disabled={resending}>
            <Text style={[styles.resendLink, { color: themeColors.primary }]}>{resending ? 'Sending...' : 'Resend OTP'}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, padding: SPACING.lg, paddingTop: 60 },
  back:         { marginBottom: SPACING.lg },
  backText:     { fontSize: FONTS.sizes.base, fontWeight: '600' },
  title:        { fontSize: FONTS.sizes.xxl, fontWeight: '800', marginBottom: SPACING.sm },
  subtitle:     { fontSize: FONTS.sizes.base, marginBottom: SPACING.xl, lineHeight: 24 },
  phone:        { fontWeight: '700' },
  otpRow:       { flexDirection: 'row', gap: SPACING.sm, justifyContent: 'center', marginBottom: SPACING.xl },
  otpBox:       { width: 48, height: 56, borderRadius: BORDER_RADIUS.md, borderWidth: 2, fontSize: FONTS.sizes.xl, textAlign: 'center', fontWeight: '700' },
  btn:          { borderRadius: BORDER_RADIUS.full, paddingVertical: SPACING.md + 2, alignItems: 'center', marginBottom: SPACING.md },
  btnText:      { fontSize: FONTS.sizes.md, fontWeight: '700' },
  resendRow:    { alignItems: 'center' },
  resendHint:   { fontSize: FONTS.sizes.sm },
  timer:        { fontWeight: '700' },
  resendLink:   { fontSize: FONTS.sizes.sm, fontWeight: '700' },
  devBanner:    { backgroundColor: '#FFF3CD', borderRadius: BORDER_RADIUS.md, padding: SPACING.sm, marginBottom: SPACING.md, alignItems: 'center', borderWidth: 1 },
  devBannerText:{ fontSize: FONTS.sizes.sm, fontWeight: '700' },
});
