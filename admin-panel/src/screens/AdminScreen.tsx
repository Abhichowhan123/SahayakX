import React, { useState } from 'react';
import { ScrollView, Text, StyleSheet, View, Alert, Image } from 'react-native';
import { C } from '../constants/theme';
import { Card, JsonBox } from '../components/Card';
import { FormInput } from '../components/FormInput';
import { Btn } from '../components/Btn';
import { adminApi } from '../api/client';
import { useAdminAuth } from '../context/AdminAuthContext';

export default function AdminScreen() {
  const { admin, logout } = useAdminAuth();
  const [pendingWorkers, setPendingWorkers] = useState<any[]>([]);
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
          onPress={() => run('pending', async () => { const r = await adminApi.getPendingWorkers(); setPendingWorkers(r.data?.data || r.data || []); return r; })}
          loading={loading === 'pending'}
        />
        {pendingWorkers.map((w: any) => {
          const v = w.verification || {};
          return (
            <View key={w._id || w.id} style={{ marginBottom: 12, padding: 8, borderWidth: 1, borderColor: '#ccc', borderRadius: 8 }}>
              <Text style={{ fontWeight: 'bold' }}>Worker Details</Text>
              <Text>Name: {w.fullName || 'N/A'}</Text>
              <Text>Phone: {w.phone || 'N/A'}</Text>
              <Text>Category: {w.serviceCategory || 'N/A'}</Text>
              {w.serviceArea && <Text>Service Area: {w.serviceArea}</Text>}
              <Text>Submitted At: {v.submittedAt ? new Date(v.submittedAt).toLocaleString() : (w.createdAt ? new Date(w.createdAt).toLocaleString() : 'N/A')}</Text>

              <Text style={{ marginTop: 8, fontWeight: 'bold' }}>Aadhaar Card Details</Text>
              {v.aadhaarNumber ? <Text>Aadhaar Number: {v.aadhaarNumber}</Text> : <Text>Aadhaar Number: Not provided (may be encrypted/masked on fetch)</Text>}
              {v.aadhaarFrontPhoto && (
                <>
                  <Text>Aadhaar Front Photo:</Text>
                  <Image source={{ uri: v.aadhaarFrontPhoto }} style={{ width: 200, height: 120, marginBottom: 4 }} />
                </>
              )}
              {v.aadhaarBackPhoto && (
                <>
                  <Text>Aadhaar Back Photo:</Text>
                  <Image source={{ uri: v.aadhaarBackPhoto }} style={{ width: 200, height: 120, marginBottom: 4 }} />
                </>
              )}

              <Text style={{ marginTop: 8, fontWeight: 'bold' }}>Face Verification</Text>
              <Text>Selfie Uploaded: {v.selfiePhoto ? 'Yes' : 'No'}</Text>
              {v.selfiePhoto && <Image source={{ uri: v.selfiePhoto }} style={{ width: 120, height: 160, marginBottom: 4 }} />}
              <Text>Face Verification Done: {v.selfiePhoto ? 'Yes' : 'No'}</Text>

              <View style={s.row}>
                <Btn
                  label="Approve"
                  onPress={() => run('approve', async () => {
                    const r = await adminApi.approveWorker(w._id || w.id);
                    setPendingWorkers(p => p.filter(x => (x._id || x.id) !== (w._id || w.id)));
                    return r;
                  })}
                  loading={loading === 'approve'}
                  color={C.success}
                  style={{ flex: 1, marginRight: 6 }}
                />
                <Btn
                  label="Reject"
                  onPress={() => {
                    if (!rejectMsg) {
                      Alert.alert('Rejection Reason Required', 'Please enter a rejection reason in the "Reject reason" field below before rejecting this worker.');
                      return;
                    }
                    run('reject', async () => {
                      const r = await adminApi.rejectWorker(w._id || w.id, rejectMsg);
                      setPendingWorkers(p => p.filter(x => (x._id || x.id) !== (w._id || w.id)));
                      setRejectMsg(''); // Clear after rejection
                      return r;
                    });
                  }}
                  loading={loading === 'reject'}
                  color={C.danger}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          );
        })}
        <View style={s.row}>
          <FormInput label="Worker ID" value={workerId} onChangeText={setWorkerId} style={{ flex: 1 }} />
        </View>
        <FormInput label="Reject reason (if rejecting)" value={rejectMsg} onChangeText={setRejectMsg} />
        <View style={s.row}>
          <Btn
            label="Approve"
            onPress={() => {
              if (!workerId.trim()) { Alert.alert('Worker ID required'); return; }
              run('approve', () => adminApi.approveWorker(workerId.trim()));
            }}
            loading={loading === 'approve'}
            color={C.success}
            style={{ flex: 1, marginRight: 6 }}
          />
          <Btn
            label="Reject"
            onPress={() => {
              if (!workerId.trim()) { Alert.alert('Worker ID required'); return; }
              if (!rejectMsg) { Alert.alert('Rejection Reason Required', 'Please enter a rejection reason before rejecting.'); return; }
              run('reject', () => adminApi.rejectWorker(workerId.trim(), rejectMsg));
            }}
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
