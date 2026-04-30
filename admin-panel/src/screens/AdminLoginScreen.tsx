import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { C } from '../constants/theme';
import { FormInput } from '../components/FormInput';
import { Btn } from '../components/Btn';
import { adminApi } from '../api/client';
import { useAdminAuth } from '../context/AdminAuthContext';

export default function AdminLoginScreen() {
  const { login } = useAdminAuth();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleLogin = async () => {
    if (!username || !password) { Alert.alert('Fill in username and password'); return; }
    setLoading(true);
    try {
      const { data } = await adminApi.login(username, password);
      await login(username, data.data?.token || data.token);
    } catch (err: any) {
      Alert.alert('Login failed', err?.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      <Text style={s.logo}>ServeEase</Text>
      <Text style={s.subtitle}>Admin Panel</Text>

      <View style={s.form}>
        <FormInput label="Username" value={username} onChangeText={setUsername} />
        <FormInput label="Password" value={password} onChangeText={setPassword} secureTextEntry />
        <Btn label="Login" onPress={handleLogin} loading={loading} />
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root:     { flex: 1, backgroundColor: C.bg },
  content:  { flex: 1, justifyContent: 'center', padding: 32 },
  logo:     { color: C.primary, fontSize: 36, fontWeight: '800', textAlign: 'center', marginBottom: 4 },
  subtitle: { color: C.muted, fontSize: 16, textAlign: 'center', marginBottom: 40 },
  form:     { backgroundColor: C.card, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: C.border },
});
