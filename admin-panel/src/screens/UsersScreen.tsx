import React, { useState } from 'react';
import { ScrollView, Text, StyleSheet } from 'react-native';
import { C } from '../constants/theme';
import { Card, JsonBox } from '../components/Card';
import { Btn } from '../components/Btn';
import { userApi } from '../api/client';

export default function UsersScreen() {
  const [profile,  setProfile]  = useState<any>(null);
  const [wallet,   setWallet]   = useState<any>(null);
  const [loading,  setLoading]  = useState('');

  const fetch = async (key: string, fn: () => Promise<any>) => {
    setLoading(key);
    try {
      const { data } = await fn();
      if (key === 'profile') setProfile(data);
      if (key === 'wallet')  setWallet(data);
    } catch (err: any) {
      const out = err?.response?.data || { error: err.message };
      if (key === 'profile') setProfile(out);
      if (key === 'wallet')  setWallet(out);
    } finally { setLoading(''); }
  };

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      <Text style={s.heading}>User Service</Text>
      <Text style={s.note}>Login via Auth Test first to get a token</Text>

      <Card title="GET /users/me — My Profile">
        <Btn label="Fetch Profile" onPress={() => fetch('profile', userApi.getProfile)} loading={loading === 'profile'} />
        {profile && <JsonBox data={profile} />}
      </Card>

      <Card title="GET /users/me/wallet — Wallet Balance">
        <Btn label="Fetch Wallet" onPress={() => fetch('wallet', userApi.getWallet)} loading={loading === 'wallet'} />
        {wallet && <JsonBox data={wallet} />}
      </Card>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, paddingBottom: 40 },
  heading: { color: C.text, fontSize: 22, fontWeight: '700', marginBottom: 4 },
  note:    { color: C.warning, fontSize: 12, marginBottom: 16 },
});
