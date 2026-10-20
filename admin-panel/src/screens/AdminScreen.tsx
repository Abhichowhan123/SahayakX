import React, { useState } from 'react';
import { ScrollView, Text, StyleSheet, View, Alert, Image, Platform, Modal } from 'react-native';
import { C } from '../constants/theme';
import { Card, JsonBox } from '../components/Card';
import { FormInput } from '../components/FormInput';
import { Btn } from '../components/Btn';
import { adminApi, adminUserApi, adminWorkerMgmtApi } from '../api/client';
import { useAdminAuth } from '../context/AdminAuthContext';

export default function AdminScreen() {
  const { admin, logout } = useAdminAuth();
  const [pendingWorkers, setPendingWorkers] = useState<any[]>([]);
  const [disputes, setDisputes] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const [workerId, setWorkerId] = useState('');
  const [blockPhone, setBlockPhone] = useState('');
  const [broadTitle, setBroadTitle] = useState('');
  const [broadBody, setBroadBody] = useState('');
  const [loading, setLoading] = useState('');

  const [userSearch, setUserSearch] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [userEditData, setUserEditData] = useState<any>({});

  const [workerSearch, setWorkerSearch] = useState('');
  const [workersList, setWorkersList] = useState<any[]>([]);
  const [editingWorker, setEditingWorker] = useState<any>(null);
  const [workerEditData, setWorkerEditData] = useState<any>({});

  const run = async (key: string, fn: () => Promise<any>) => {
    setLoading(key);
    try {
      const { data } = await fn();
      setResult(data);
    } catch (err: any) {
      setResult(err?.response?.data || { error: err.message });
    } finally {
      setLoading('');
    }
  };

  const fetchUsers = async () => {
    setLoading('users');
    try {
      const { data } = await adminUserApi.list({ search: userSearch || undefined });
      setUsers(data.data?.data || data.data || []);
    } catch (err: any) {
      setResult(err?.response?.data || { error: err.message });
    } finally {
      setLoading('');
    }
  };

  const fetchWorkers = async () => {
    setLoading('workersList');
    try {
      const { data } = await adminWorkerMgmtApi.list({ search: workerSearch || undefined });
      setWorkersList(data.data?.data || data.data || []);
    } catch (err: any) {
      setResult(err?.response?.data || { error: err.message });
    } finally {
      setLoading('');
    }
  };

  const deleteUser = async (phone: string) => {
    if (Platform.OS === 'web') {
      if (!confirm('Permanently delete this user? This cannot be undone.')) return;
    } else {
      Alert.alert('Confirm', 'Permanently delete this user?', [
        { text: 'Cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => doDeleteUser(phone) },
      ]);
      return;
    }
    doDeleteUser(phone);
  };

  const doDeleteUser = (phone: string) => {
    run('delUser', async () => {
      const r = await adminUserApi.delete(phone);
      setUsers((u) => u.filter((x: any) => x.phone !== phone));
      return r;
    });
  };

  const deleteWorker = async (id: string) => {
    if (Platform.OS === 'web') {
      if (!confirm('Permanently delete this worker? This cannot be undone.')) return;
    } else {
      Alert.alert('Confirm', 'Permanently delete this worker?', [
        { text: 'Cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => doDeleteWorker(id) },
      ]);
      return;
    }
    doDeleteWorker(id);
  };

  const doDeleteWorker = (id: string) => {
    run('delWorker', async () => {
      const r = await adminWorkerMgmtApi.delete(id);
      setWorkersList((w) => w.filter((x: any) => (x._id || x.id) !== id));
      return r;
    });
  };

  const saveUser = async () => {
    if (!editingUser) return;
    run('saveUser', async () => {
      const r = await adminUserApi.update(editingUser.phone, userEditData);
      setEditingUser(null);
      fetchUsers();
      return r;
    });
  };

  const saveWorker = async () => {
    if (!editingWorker) return;
    run('saveWorker', async () => {
      const r = await adminWorkerMgmtApi.update(editingWorker._id || editingWorker.id, workerEditData);
      setEditingWorker(null);
      fetchWorkers();
      return r;
    });
  };

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      <View style={s.header}>
        <Text style={s.heading}>Admin Panel</Text>
        {admin && <Btn label="Logout" onPress={logout} color={C.danger} style={{ paddingVertical: 6, paddingHorizontal: 16 }} />}
      </View>
      {admin && <Text style={s.loggedAs}>Logged in as: {admin.username}</Text>}

      <View style={s.grid}>
        <View style={s.section}>
          <Card title="Worker Verification">
            <Btn
              label="Load Pending Workers"
              onPress={() =>
                run('pending', async () => {
                  const r = await adminApi.getPendingWorkers();
                  setPendingWorkers(r.data?.data || r.data || []);
                  return r;
                })
              }
              loading={loading === 'pending'}
            />
            {pendingWorkers.map((w: any) => {
              const v = w.verification || {};
              return (
                <View key={w._id || w.id} style={s.workerCard}>
                  <Text style={s.workerTitle}>Worker Details</Text>
                  <Text style={s.workerInfo}>Name: {w.fullName || 'N/A'}</Text>
                  <Text style={s.workerInfo}>Phone: {w.phone || 'N/A'}</Text>
                  <Text style={s.workerInfo}>Category: {w.serviceCategory || 'N/A'}</Text>
                  {w.serviceArea && <Text style={s.workerInfo}>Service Area: {w.serviceArea}</Text>}
                  <Text style={s.workerInfo}>
                    Submitted: {v.submittedAt ? new Date(v.submittedAt).toLocaleString() : w.createdAt ? new Date(w.createdAt).toLocaleString() : 'N/A'}
                  </Text>
                  <Text style={[s.workerTitle, { marginTop: 10 }]}>Aadhaar</Text>
                  {v.aadhaarFrontPhoto && (
                    <>
                      <Text style={s.workerInfo}>Front:</Text>
                      <Image source={{ uri: v.aadhaarFrontPhoto }} style={s.photo} />
                    </>
                  )}
                  {v.aadhaarBackPhoto && (
                    <>
                      <Text style={s.workerInfo}>Back:</Text>
                      <Image source={{ uri: v.aadhaarBackPhoto }} style={s.photo} />
                    </>
                  )}
                  <Text style={[s.workerTitle, { marginTop: 10 }]}>Face Verification</Text>
                  <Text style={s.workerInfo}>Selfie: {v.selfiePhoto ? 'Yes' : 'No'}</Text>
                  {v.selfiePhoto && <Image source={{ uri: v.selfiePhoto }} style={s.selfie} />}
                  <View style={s.row}>
                    <Btn
                      label="Approve"
                      onPress={() =>
                        run('approve', async () => {
                          const r = await adminApi.approveWorker(w._id || w.id);
                          setPendingWorkers((p) => p.filter((x) => (x._id || x.id) !== (w._id || w.id)));
                          return r;
                        })
                      }
                      loading={loading === 'approve'}
                      color={C.success}
                      style={{ flex: 1, marginRight: 6 }}
                    />
                    <Btn
                      label="Reject"
                      onPress={() =>
                        run('reject', async () => {
                          const r = await adminApi.rejectWorker(w._id || w.id);
                          setPendingWorkers((p) => p.filter((x) => (x._id || x.id) !== (w._id || w.id)));
                          return r;
                        })
                      }
                      loading={loading === 'reject'}
                      color={C.danger}
                      style={{ flex: 1 }}
                    />
                  </View>
                </View>
              );
            })}
            <View style={[s.row, { marginTop: 12 }]}>
              <FormInput label="Worker ID (Manual)" value={workerId} onChangeText={setWorkerId} style={{ flex: 1 }} />
            </View>
            <View style={s.row}>
              <Btn
                label="Approve"
                onPress={() => {
                  if (!workerId.trim()) {
                    Alert.alert('Worker ID required');
                    return;
                  }
                  run('approve', () => adminApi.approveWorker(workerId.trim()));
                }}
                loading={loading === 'approve'}
                color={C.success}
                style={{ flex: 1, marginRight: 6 }}
              />
              <Btn
                label="Reject"
                onPress={() => {
                  if (!workerId.trim()) {
                    Alert.alert('Worker ID required');
                    return;
                  }
                  run('reject', () => adminApi.rejectWorker(workerId.trim()));
                }}
                loading={loading === 'reject'}
                color={C.danger}
                style={{ flex: 1 }}
              />
            </View>
          </Card>

          <Card title="Worker Details Management">
            <View style={s.row}>
              <FormInput label="Search by name/phone" value={workerSearch} onChangeText={setWorkerSearch} style={{ flex: 1 }} />
            </View>
            <Btn label="Fetch Workers" onPress={fetchWorkers} loading={loading === 'workersList'} />
            {workersList.map((w: any) => (
              <View key={w._id || w.id} style={s.workerCard}>
                <Text style={s.workerTitle}>{w.fullName || 'N/A'}</Text>
                <Text style={s.workerInfo}>Phone: {w.phone}</Text>
                <Text style={s.workerInfo}>Category: {w.serviceCategory}</Text>
                <Text style={s.workerInfo}>
                  Status: {w.verification?.status} | Online: {w.isOnline ? 'Yes' : 'No'} | Blocked: {w.isBlocked ? 'Yes' : 'No'}
                </Text>
                <View style={s.row}>
                  <Btn
                    label="Edit"
                    onPress={() => {
                      setEditingWorker(w);
                      setWorkerEditData({
                        fullName: w.fullName,
                        phone: w.phone,
                        email: w.email,
                        serviceCategory: w.serviceCategory,
                        serviceArea: w.serviceArea,
                        isOnline: w.isOnline,
                        isBlocked: w.isBlocked,
                      });
                    }}
                    color={C.primary}
                    style={{ flex: 1, marginRight: 4 }}
                  />
                  <Btn label="Delete" onPress={() => deleteWorker(w._id || w.id)} color={C.danger} style={{ flex: 1, marginLeft: 4 }} loading={loading === 'delWorker'} />
                </View>
              </View>
            ))}
          </Card>
        </View>

        <View style={s.section}>
          <Card title="User Management">
            <FormInput label="Block User by Phone" value={blockPhone} onChangeText={setBlockPhone} keyboardType="phone-pad" />
            <Btn
              label="Block User"
              onPress={() => {
                if (!blockPhone.trim()) {
                  Alert.alert('Phone number required');
                  return;
                }
                run('blockUser', () => adminApi.blockUser(blockPhone));
              }}
              loading={loading === 'blockUser'}
              color={C.danger}
            />
          </Card>

          <Card title="User Details Management">
            <View style={s.row}>
              <FormInput label="Search by name/phone" value={userSearch} onChangeText={setUserSearch} style={{ flex: 1 }} />
            </View>
            <Btn label="Fetch Users" onPress={fetchUsers} loading={loading === 'users'} />
            {users.map((u: any) => (
              <View key={u._id || u.phone} style={s.workerCard}>
                <Text style={s.workerTitle}>{u.fullName || 'N/A'}</Text>
                <Text style={s.workerInfo}>Phone: {u.phone}</Text>
                <Text style={s.workerInfo}>Role: {u.role} | Blocked: {u.isBlocked ? 'Yes' : 'No'}</Text>
                <Text style={s.workerInfo}>Wallet: Rs.{u.wallet?.balance || 0}</Text>
                <View style={s.row}>
                  <Btn
                    label="Edit"
                    onPress={() => {
                      setEditingUser(u);
                      setUserEditData({ fullName: u.fullName, email: u.email, role: u.role, isBlocked: u.isBlocked });
                    }}
                    color={C.primary}
                    style={{ flex: 1, marginRight: 4 }}
                  />
                  <Btn label="Delete" onPress={() => deleteUser(u.phone)} color={C.danger} style={{ flex: 1, marginLeft: 4 }} loading={loading === 'delUser'} />
                </View>
              </View>
            ))}
          </Card>

          <Card title="Disputes">
            <Btn
              label="Load Disputed Bookings"
              onPress={() =>
                run('disputes', async () => {
                  const r = await adminApi.getDisputes();
                  setDisputes(r.data);
                  return r;
                })
              }
              loading={loading === 'disputes'}
            />
            {disputes && <JsonBox data={disputes} />}
          </Card>

          <Card title="Broadcast Notification">
            <FormInput label="Title" value={broadTitle} onChangeText={setBroadTitle} />
            <FormInput label="Body" value={broadBody} onChangeText={setBroadBody} />
            <Btn
              label="Send Broadcast"
              onPress={() => {
                if (!broadTitle || !broadBody) {
                  Alert.alert('Fill in title and body');
                  return;
                }
                run('broadcast', () => adminApi.broadcast(broadTitle, broadBody));
              }}
              loading={loading === 'broadcast'}
            />
          </Card>
        </View>
      </View>

      <Modal visible={!!editingUser} transparent animationType="slide">
        <View style={s.modal}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>Edit User</Text>
            <FormInput label="Full Name" value={userEditData.fullName || ''} onChangeText={(t) => setUserEditData({ ...userEditData, fullName: t })} />
            <FormInput label="Email" value={userEditData.email || ''} onChangeText={(t) => setUserEditData({ ...userEditData, email: t })} />
            <FormInput label="Role" value={userEditData.role || ''} onChangeText={(t) => setUserEditData({ ...userEditData, role: t })} />
            <View style={s.row}>
              <Btn
                label={userEditData.isBlocked ? 'Unblock' : 'Block'}
                onPress={() => setUserEditData({ ...userEditData, isBlocked: !userEditData.isBlocked })}
                color={userEditData.isBlocked ? C.success : C.warning}
                style={{ flex: 1 }}
              />
            </View>
            <View style={s.row}>
              <Btn label="Cancel" onPress={() => setEditingUser(null)} style={{ flex: 1, marginRight: 4 }} />
              <Btn label="Save" onPress={saveUser} loading={loading === 'saveUser'} color={C.primary} style={{ flex: 1, marginLeft: 4 }} />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!editingWorker} transparent animationType="slide">
        <View style={s.modal}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>Edit Worker</Text>
            <FormInput label="Full Name" value={workerEditData.fullName || ''} onChangeText={(t) => setWorkerEditData({ ...workerEditData, fullName: t })} />
            <FormInput label="Phone" value={workerEditData.phone || ''} onChangeText={(t) => setWorkerEditData({ ...workerEditData, phone: t })} />
            <FormInput label="Email" value={workerEditData.email || ''} onChangeText={(t) => setWorkerEditData({ ...workerEditData, email: t })} />
            <FormInput label="Category" value={workerEditData.serviceCategory || ''} onChangeText={(t) => setWorkerEditData({ ...workerEditData, serviceCategory: t })} />
            <FormInput label="Service Area" value={workerEditData.serviceArea || ''} onChangeText={(t) => setWorkerEditData({ ...workerEditData, serviceArea: t })} />
            <View style={s.row}>
              <Btn
                label={workerEditData.isOnline ? 'Go Offline' : 'Go Online'}
                onPress={() => setWorkerEditData({ ...workerEditData, isOnline: !workerEditData.isOnline })}
                color={workerEditData.isOnline ? C.warning : C.success}
                style={{ flex: 1, marginRight: 4 }}
              />
              <Btn
                label={workerEditData.isBlocked ? 'Unblock' : 'Block'}
                onPress={() => setWorkerEditData({ ...workerEditData, isBlocked: !workerEditData.isBlocked })}
                color={workerEditData.isBlocked ? C.success : C.danger}
                style={{ flex: 1, marginLeft: 4 }}
              />
            </View>
            <View style={s.row}>
              <Btn label="Cancel" onPress={() => setEditingWorker(null)} style={{ flex: 1, marginRight: 4 }} />
              <Btn label="Save" onPress={saveWorker} loading={loading === 'saveWorker'} color={C.primary} style={{ flex: 1, marginLeft: 4 }} />
            </View>
          </View>
        </View>
      </Modal>

      {result && (
        <Card title="Last Response">
          <JsonBox data={result} />
        </Card>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  heading: { color: C.text, fontSize: 24, fontWeight: '700' },
  loggedAs: { color: C.success, fontSize: 12, marginBottom: 16 },
  grid: Platform.OS === 'web' ? { flexDirection: 'row', flexWrap: 'wrap', gap: 16 } : {},
  section: Platform.OS === 'web' ? { flex: 1, minWidth: 400, maxWidth: '50%' } : { width: '100%' },
  row: { flexDirection: 'row', marginTop: 8 },
  workerCard: { marginTop: 12, padding: 12, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 8 },
  workerTitle: { fontWeight: 'bold', color: C.text, marginBottom: 4 },
  workerInfo: { color: C.text, fontSize: 13, marginBottom: 2 },
  photo: { width: 200, height: 120, marginBottom: 8, borderRadius: 4, resizeMode: 'contain' },
  selfie: { width: 120, height: 160, marginBottom: 8, borderRadius: 4, resizeMode: 'contain' },
  modal: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: C.card, borderRadius: 12, padding: 20, width: '100%', maxWidth: 500 },
  modalTitle: { color: C.text, fontSize: 18, fontWeight: '700', marginBottom: 12 },
});
