import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, SafeAreaView, Modal, TextInput, Alert,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation';
import { userApi } from '../../api';
import { COLORS, SPACING, BORDER_RADIUS, FONTS } from '../../constants';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Main'>;

interface Address {
  _id?: string;
  label?: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  country?: string;
}

export default function AddressesScreen() {
  const navigation = useNavigation<Nav>();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState<Address>({
    label: '', line1: '', line2: '', city: '', state: '', pincode: '', country: 'India'
  });

  const fetchAddresses = async () => {
    try {
      const { data } = await userApi.getProfile();
      setAddresses(data.data?.addresses || []);
    } catch (err) {
      Alert.alert('Error', 'Failed to load addresses');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchAddresses(); }, []));

  const handleAdd = async () => {
    if (!form.line1 || !form.city || !form.state || !form.pincode) {
      Alert.alert('Error', 'Please fill required fields (Line 1, City, State, Pincode)');
      return;
    }
    try {
      const { data } = await userApi.addAddress(form);
      setAddresses(data.data || data || []);
      setModalVisible(false);
      setForm({ label: '', line1: '', line2: '', city: '', state: '', pincode: '', country: 'India' });
    } catch (err) {
      Alert.alert('Error', 'Failed to add address');
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Address', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            const { data } = await userApi.deleteAddress(id);
            setAddresses(data.data || data || []);
          } catch (err) {
            Alert.alert('Error', 'Failed to delete address');
          }
        }
      }
    ]);
  };

  const renderItem = ({ item }: { item: Address }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.label}>{item.label || 'Home'}</Text>
        <TouchableOpacity onPress={() => item._id && handleDelete(item._id)}>
          <Text style={styles.delete}>Delete</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.addr}>{item.line1}</Text>
      {item.line2 && <Text style={styles.addr}>{item.line2}</Text>}
      <Text style={styles.addr}>{item.city}, {item.state} - {item.pincode}</Text>
      <Text style={styles.addr}>{item.country}</Text>
    </View>
  );

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Manage Addresses</Text>
        <View style={{ width: 32 }} />
      </View>

      <FlatList
        data={addresses}
        keyExtractor={(item, idx) => item._id || String(idx)}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>No addresses added yet</Text>}
      />

      <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
        <Text style={styles.addBtnText}>+ Add New Address</Text>
      </TouchableOpacity>

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Address</Text>
            <TextInput style={styles.input} placeholder="Label (e.g., Home, Work)" value={form.label} onChangeText={(v) => setForm({...form, label: v})} placeholderTextColor={COLORS.textMuted} />
            <TextInput style={styles.input} placeholder="Address Line 1 *" value={form.line1} onChangeText={(v) => setForm({...form, line1: v})} placeholderTextColor={COLORS.textMuted} />
            <TextInput style={styles.input} placeholder="Address Line 2" value={form.line2} onChangeText={(v) => setForm({...form, line2: v})} placeholderTextColor={COLORS.textMuted} />
            <View style={styles.row}>
              <TextInput style={[styles.input, styles.inputHalf]} placeholder="City *" value={form.city} onChangeText={(v) => setForm({...form, city: v})} placeholderTextColor={COLORS.textMuted} />
              <TextInput style={[styles.input, styles.inputHalf]} placeholder="State *" value={form.state} onChangeText={(v) => setForm({...form, state: v})} placeholderTextColor={COLORS.textMuted} />
            </View>
            <TextInput style={styles.input} placeholder="Pincode *" value={form.pincode} onChangeText={(v) => setForm({...form, pincode: v})} keyboardType="numeric" placeholderTextColor={COLORS.textMuted} />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleAdd}>
                <Text style={styles.saveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SPACING.md, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  back: { fontSize: 24, color: COLORS.textPrimary, width: 32 },
  title: { fontSize: FONTS.sizes.md, fontWeight: '700', color: COLORS.textPrimary },
  list: { padding: SPACING.md },
  card: { backgroundColor: COLORS.white, padding: SPACING.md, borderRadius: BORDER_RADIUS.lg, marginBottom: SPACING.sm },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.xs },
  label: { fontSize: FONTS.sizes.sm, fontWeight: '700', color: COLORS.textPrimary },
  delete: { fontSize: FONTS.sizes.xs, color: COLORS.error, fontWeight: '600' },
  addr: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, marginBottom: 2 },
  empty: { textAlign: 'center', color: COLORS.textMuted, marginTop: 50 },
  addBtn: { backgroundColor: COLORS.primary, margin: SPACING.md, padding: SPACING.md, borderRadius: BORDER_RADIUS.full, alignItems: 'center' },
  addBtnText: { color: COLORS.white, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.white, padding: SPACING.lg, borderTopLeftRadius: BORDER_RADIUS.xl, borderTopRightRadius: BORDER_RADIUS.xl },
  modalTitle: { fontSize: FONTS.sizes.md, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.md },
  input: { backgroundColor: COLORS.inputBg, padding: SPACING.sm, borderRadius: BORDER_RADIUS.md, marginBottom: SPACING.sm, color: COLORS.textPrimary },
  row: { flexDirection: 'row', gap: SPACING.sm },
  inputHalf: { flex: 1 },
  modalActions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.sm, borderRadius: BORDER_RADIUS.md, alignItems: 'center' },
  cancelBtnText: { color: COLORS.textPrimary, fontWeight: '600' },
  saveBtn: { flex: 1, backgroundColor: COLORS.primary, padding: SPACING.sm, borderRadius: BORDER_RADIUS.md, alignItems: 'center' },
  saveBtnText: { color: COLORS.white, fontWeight: '700' },
});
