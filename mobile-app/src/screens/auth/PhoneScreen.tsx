import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList }        from '../../navigation';
import { useAuth }                   from '../../context/AuthContext';
import { useTheme }                  from '../../context/ThemeContext';
import { colors }                    from '../../theme/theme';
import { SPACING, BORDER_RADIUS, FONTS } from '../../constants';

type Props = { navigation: NativeStackNavigationProp<AuthStackParamList, 'Phone'> };

export default function PhoneScreen({ navigation }: Props) {
  const { sendOtp } = useAuth();
  const { colors: themeColors } = useTheme();
  const [phone,         setPhone]         = useState('');
  const [role,          setRole]          = useState<'customer' | 'worker'>('customer');
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState('');
  const [notRegistered, setNotRegistered] = useState(false);

  const getCleanedPhone = () => {
    const digits = phone.replace(/\D/g, '');
    return { digits, cleaned: '+91' + digits.slice(-10) };
  };

  const showError = (msg: string) => {
    if (Platform.OS === 'web') {
      setError(msg);
    } else {
      Alert.alert('Error', msg);
    }
  };

  const handleSend = async () => {
    setError('');
    setNotRegistered(false);
    const { digits, cleaned } = getCleanedPhone();
    console.log("getCleanedPhone", digits);
    
    if (digits.length < 10) {
      showError('Please enter a valid 10-digit mobile number');
      return;
    }
    setLoading(true);
    try {
      const result = await sendOtp(cleaned, role, 'login');
      navigation.navigate('Otp', { phone: cleaned, role, mode: 'login', devOtp: result?.devOtp });
    } catch (err: any) {
      const msg: string = err?.response?.data?.message || '';
      if (msg === 'NOT_REGISTERED') {
        setNotRegistered(true);
        setError('This number is not registered. Please create an account.');
      } else {
        showError(msg || 'Failed to send OTP. Try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAccount = async () => {
    setError('');
    const { digits, cleaned } = getCleanedPhone();
    if (digits.length < 10) {
      showError('Enter your mobile number above first, then tap Create Account.');
      return;
    }
    setLoading(true);
    try {
      const result = await sendOtp(cleaned, role, 'register');
      navigation.navigate('Otp', { phone: cleaned, role, mode: 'register', devOtp: result?.devOtp });
    } catch (err: any) {
      const msg: string = err?.response?.data?.message || '';
      if (msg.toLowerCase().includes('already registered')) {
        try {
          const result = await sendOtp(cleaned, role, 'login');
          navigation.navigate('Otp', { phone: cleaned, role, mode: 'login', devOtp: result?.devOtp });
        } catch (loginErr: any) {
          showError(loginErr?.response?.data?.message || 'Failed to send OTP. Try again.');
        }
      } else {
        showError(msg || 'Failed to send OTP. Try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: themeColors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.logo, { color: themeColors.primary }]}>ServeEase</Text>
          <Text style={[styles.tagline, { color: themeColors.textSecondary }]}>Home services at your doorstep</Text>
        </View>

        {/* Role selector */}
        <View style={styles.roleRow}>
          {(['customer', 'worker'] as const).map((r) => (
            <TouchableOpacity
              key={r}
              style={[styles.roleBtn, role === r && { backgroundColor: themeColors.primary + '10' }]}
              onPress={() => { setRole(r); setError(''); setNotRegistered(false); }}
            >
              <Text style={[styles.roleBtnText, role === r && styles.roleBtnTextActive]}>
                {r === 'customer' ? '🛒  I need a service' : '👷  I provide service'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Phone input */}
        <Text style={[styles.label, { color: themeColors.textPrimary }]}>Enter your mobile number</Text>
        <View style={[styles.inputWrapper, { backgroundColor: themeColors.inputBg }]}>
          <Text style={[styles.flag, { color: themeColors.textPrimary }]}>🇮🇳 +91</Text>
          <TextInput
            style={[styles.input, { color: themeColors.textPrimary }]}
            value={phone}
            onChangeText={(v) => { setPhone(v); setError(''); setNotRegistered(false); }}
            placeholder="98765 43210"
            placeholderTextColor={themeColors.textMuted}
            keyboardType="phone-pad"
            maxLength={15}
          />
        </View>

        <Text style={[styles.hint, { color: themeColors.textMuted }]}>We'll send a 6-digit OTP to verify your number</Text>

        {/* Error message */}
        {error ? <Text style={[styles.error, { color: themeColors.error }]}>{error}</Text> : null}

        {/* Send OTP / Create Account primary button */}
        {notRegistered ? (
          <TouchableOpacity
            style={[styles.createAccountBtn, { backgroundColor: themeColors.success }]}
            onPress={handleCreateAccount}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color={themeColors.white} />
              : <Text style={[styles.createAccountText, { color: themeColors.white }]}>Create Account & Send OTP</Text>}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.btn, { backgroundColor: themeColors.primary }]} onPress={handleSend} disabled={loading}>
            {loading
              ? <ActivityIndicator color={themeColors.white} />
              : <Text style={[styles.btnText, { color: themeColors.white }]}>Send OTP</Text>}
          </TouchableOpacity>
        )}

        {/* Always visible create account link */}
        {!notRegistered && (
          <TouchableOpacity style={styles.createAccountLink} onPress={handleCreateAccount} disabled={loading}>
            <Text style={[styles.createAccountLinkText, { color: themeColors.textMuted }]}>New user? <Text style={[styles.createAccountLinkBold, { color: themeColors.primary }]}>Create Account</Text></Text>
          </TouchableOpacity>
        )}

        <Text style={[styles.terms, { color: themeColors.textMuted }]}>
          By continuing you agree to our{' '}
          <Text style={[styles.link, { color: themeColors.primary }]}>Terms of Service</Text> and{' '}
          <Text style={[styles.link, { color: themeColors.primary }]}>Privacy Policy</Text>
        </Text>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:         { flex: 1 },
  scroll:            { flexGrow: 1, padding: SPACING.lg, justifyContent: 'center' },
  header:            { alignItems: 'center', marginBottom: SPACING.xxl },
  logo:              { fontSize: FONTS.sizes.xxl, fontWeight: '800' },
  tagline:           { fontSize: FONTS.sizes.base, marginTop: SPACING.xs },
  roleRow:           { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg },
  roleBtn:           { flex: 1, padding: SPACING.md, borderRadius: BORDER_RADIUS.md, borderWidth: 2, alignItems: 'center' },
  roleBtnText:       { fontSize: FONTS.sizes.sm, fontWeight: '600' },
  roleBtnTextActive: { fontWeight: '700' },
  label:             { fontSize: FONTS.sizes.md, fontWeight: '700', marginBottom: SPACING.sm },
  inputWrapper:      { flexDirection: 'row', alignItems: 'center', borderRadius: BORDER_RADIUS.md, paddingHorizontal: SPACING.md, marginBottom: SPACING.sm },
  flag:              { fontSize: FONTS.sizes.base, marginRight: SPACING.sm },
  input:             { flex: 1, fontSize: FONTS.sizes.lg, paddingVertical: SPACING.md, letterSpacing: 1 },
  hint:              { fontSize: FONTS.sizes.sm, marginBottom: SPACING.lg },
  error:             { fontSize: FONTS.sizes.sm, marginBottom: SPACING.sm, textAlign: 'center' },
  btn:               { borderRadius: BORDER_RADIUS.full, paddingVertical: SPACING.md + 2, alignItems: 'center', marginBottom: SPACING.lg },
  btnText:           { fontSize: FONTS.sizes.md, fontWeight: '700' },
  createAccountBtn:      { borderRadius: BORDER_RADIUS.full, paddingVertical: SPACING.md + 2, alignItems: 'center', marginBottom: SPACING.md },
  createAccountText:     { fontSize: FONTS.sizes.md, fontWeight: '700' },
  createAccountLink:     { alignItems: 'center', marginBottom: SPACING.lg },
  createAccountLinkText: { fontSize: FONTS.sizes.sm },
  createAccountLinkBold: { fontWeight: '700' },
  terms:                 { fontSize: FONTS.sizes.xs, textAlign: 'center', lineHeight: 18 },
  link:              { fontWeight: '600' },
});
