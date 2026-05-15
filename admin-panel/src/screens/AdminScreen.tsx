import React, { useState } from 'react';
import { ScrollView, Text, StyleSheet, View, Alert } from 'react-native';
import { C } from '../constants/theme';
import { Card, JsonBox } from '../components/Card';
import { FormInput } from '../components/FormInput';
import { Btn } from '../components/Btn';
import { adminApi } from '../api/client';
import { useAdminAuth } from '../context/AdminAuthContext';

export default function AdminScreen() {
  const { admin, logout } = useAdminAuth();
  const [pending,    setPending]    = useState<any>(null);
  const [disputes,   setDisputes]   = useState<any>(null);
  const [result,     setResult]     = useState<any>(null);
  const [workerId,   setWorkerId]   = useState('');
  const [rejectMsg,  setRejectMsg]  = useState('');
  const [blockPhone, setBlockPhone] = useState('');
  const [broadTitle, setBroadTitle] = useState('');
  const [broadBody,  setBroadBody]  = useState('');
  const [loading,    setLoading]    = useState('');

  const run = async (key: string, fn: () => Promise<any>) => {
    setLoading(key);
    try {
      const { data } = await fn();
      setResult(data);
    } catch (err: any) {
      setResult(err?.response?.data || { error: err.message });
    } finally { setLoading(''); }
  };

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      <View style={s.header}>
        <Text style={s.heading}>Admin Panel</Text>
        {admin && (
          <Btn label="Logout" onPress={logout} color={C.danger} style={{ paddingVertical: 6 }} />
        )}
      </View>

      {admin && <Text style={s.loggedAs}>Logged in as: {admin.username}</Text>}

      <Card title="Worker Verification Queue">
        <Btn
          label="Load Pending Workers"
          onPress={() => run('pending', async () => { setPending(null); const r = await adminApi.getPendingWorkers(); setPending(r.data); return r; })}
          loading={loading === 'pending'}
        />
        {pending && <JsonBox data={pending} />}
        <View style={s.row}>
          <FormInput label="Worker ID" value={workerId} onChangeText={setWorkerId} style={{ flex: 1 }} />
        </View>
        <FormInput label="Reject reason (if rejecting)" value={rejectMsg} onChangeText={setRejectMsg} />
        <View style={s.row}>
          <Btn
            label="Approve"
            onPress={() => run('approve', () => adminApi.approveWorker(workerId))}
            loading={loading === 'approve'}
            color={C.success}
            style={{ flex: 1, marginRight: 6 }}
          />
          <Btn
            label="Reject"
            onPress={() => run('reject', () => adminApi.rejectWorker(workerId, rejectMsg))}
            loading={loading === 'reject'}
            color={C.danger}
            style={{ flex: 1 }}
          />
        </View>
      </Card>

      <Card title="Block User">
        <FormInput label="Phone number" value={blockPhone} onChangeText={setBlockPhone} keyboardType="phone-pad" />
        <Btn
          label="Block User"
          onPress={() => run('blockUser', () => adminApi.blockUser(blockPhone))}
          loading={loading === 'blockUser'}
          color={C.danger}
        />
      </Card>

      <Card title="Disputes">
        <Btn
          label="Load Disputed Bookings"
          onPress={() => run('disputes', async () => { const r = await adminApi.getDisputes(); setDisputes(r.data); return r; })}
          loading={loading === 'disputes'}
        />
        {disputes && <JsonBox data={disputes} />}
      </Card>

      <Card title="Broadcast Notification">
        <FormInput label="Title" value={broadTitle} onChangeText={setBroadTitle} />
        <FormInput label="Body" value={broadBody}  onChangeText={setBroadBody}  />
        <Btn
          label="Send Broadcast"
          onPress={() => {
            if (!broadTitle || !broadBody) { Alert.alert('Fill in title and body'); return; }
            run('broadcast', () => adminApi.broadcast(broadTitle, broadBody));
          }}
          loading={loading === 'broadcast'}
        />
      </Card>

      {result && (
        <Card title="Last Response">
          <JsonBox data={result} />
        </Card>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root:     { flex: 1, backgroundColor: C.bg },
  content:  { padding: 16, paddingBottom: 40 },
  header:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  heading:  { color: C.text, fontSize: 22, fontWeight: '700' },
  loggedAs: { color: C.success, fontSize: 12, marginBottom: 16 },
  row:      { flexDirection: 'row' },
});
