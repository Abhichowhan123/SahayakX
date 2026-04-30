import React, { useState } from 'react';
import { ScrollView, Text, StyleSheet, View, Alert } from 'react-native';
import { C } from '../constants/theme';
import { Card, JsonBox } from '../components/Card';
import { FormInput } from '../components/FormInput';
import { Btn } from '../components/Btn';
import { authApi } from '../api/client';
import * as SecureStore from 'expo-secure-store';

export default function AuthTestScreen() {
  const [phone,      setPhone]      = useState('');
  const [otp,        setOtp]        = useState('');
  const [role,       setRole]       = useState<'customer' | 'worker'>('customer');
  const [otpSent,    setOtpSent]    = useState(false);
  const [response,   setResponse]   = useState<any>(null);
  const [token,      setToken]      = useState<string | null>(null);
  const [loading,    setLoading]    = useState(false);

  const sendOtp = async () => {
    if (!phone) { Alert.alert('Enter phone number'); return; }
    setLoading(true);
    try {
      const { data } = await authApi.sendOtp(phone, role);
      setResponse(data);
      setOtpSent(true);
    } catch (err: any) {
      setResponse(err?.response?.data || { error: err.message });
    } finally { setLoading(false); }
  };

  const verifyOtp = async () => {
    if (!otp) { Alert.alert('Enter OTP'); return; }
    setLoading(true);
    try {
      const { data } = await authApi.verifyOtp(phone, otp);
      setResponse(data);
      const t = data.data?.token;
      if (t) {
        await SecureStore.setItemAsync('admin_token', t);
        setToken(t);
      }
    } catch (err: any) {
      setResponse(err?.response?.data || { error: err.message });
    } finally { setLoading(false); }
  };

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      <Text style={s.heading}>Auth Service Test</Text>

      <Card title="Send OTP">
        <FormInput label="Phone (+91...)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <View style={s.roleRow}>
          {(['customer', 'worker'] as const).map((r) => (
            <Btn
              key={r}
              label={r}
              onPress={() => setRole(r)}
              color={role === r ? C.primary : C.border}
              style={{ flex: 1, marginHorizontal: 4 }}
            />
          ))}
        </View>
        <Btn label="Send OTP" onPress={sendOtp} loading={loading && !otpSent} />
      </Card>

      {otpSent && (
        <Card title="Verify OTP">
          <FormInput label="OTP (check console / Twilio)" value={otp} onChangeText={setOtp} keyboardType="numeric" />
          <Btn label="Verify OTP" onPress={verifyOtp} loading={loading && otpSent} />
        </Card>
      )}

      {token && (
        <Card title="JWT Token (saved)">
          <Text style={s.token} numberOfLines={3}>{token}</Text>
        </Card>
      )}

      {response && (
        <Card title="Response">
          <JsonBox data={response} />
        </Card>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, paddingBottom: 40 },
  heading: { color: C.text, fontSize: 22, fontWeight: '700', marginBottom: 16 },
  roleRow: { flexDirection: 'row', marginBottom: 4 },
  token:   { color: C.success, fontSize: 10, fontFamily: 'monospace' },
});
