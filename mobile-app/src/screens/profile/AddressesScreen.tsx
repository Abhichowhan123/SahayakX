import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, SafeAreaView, Modal, TextInput, Alert,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation';
import { userApi } from '../../api';
import { SPACING, BORDER_RADIUS, FONTS } from '../../constants';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../theme/theme';

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
  const { colors: themeColors } = useTheme();
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
    <View style={[styles.card, { backgroundColor: themeColors.cardBg }]}>
      <View style={styles.cardHeader}>
        <Text style={[styles.label, { color: themeColors.textPrimary }]}>{item.label || 'Home'}</Text>
        <TouchableOpacity onPress={() => item._id && handleDelete(item._id)}>
          <Text style={[styles.delete, { color: themeColors.error }]}>Delete</Text>
        </TouchableOpacity>
      </View>
      <Text style={[styles.addr, { color: themeColors.textSecondary }]}>{item.line1}</Text>
      {item.line2 && <Text style={[styles.addr, { color: themeColors.textSecondary }]}>{item.line2}</Text>}
      <Text style={[styles.addr, { color: themeColors.textSecondary }]}>{item.city}, {item.state} - {item.pincode}</Text>
      <Text style={[styles.addr, { color: themeColors.textSecondary }]}>{item.country}</Text>
    </View>
  );

  if (loading) {
    return <View style={[styles.center, { backgroundColor: themeColors.background }]}><ActivityIndicator size="large" color={themeColors.primary} /></View>;
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: themeColors.background }]}>
      <View style={[styles.header, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={[styles.back, { color: themeColors.textPrimary }]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: themeColors.textPrimary }]}>Manage Addresses</Text>
        <View style={{ width: 32 }} />
      </View>

      <FlatList
        data={addresses}
        keyExtractor={(item, idx) => item._id || String(idx)}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={[styles.empty, { color: themeColors.textMuted }]}>No addresses added yet</Text>}
      />

      <TouchableOpacity style={[styles.addBtn, { backgroundColor: themeColors.primary }]} onPress={() => setModalVisible(true)}>
        <Text style={[styles.addBtnText, { color: themeColors.white }]}>+ Add New Address</Text>
      </TouchableOpacity>

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <View style={[styles.modalContent, { backgroundColor: themeColors.surface }]}>
            <Text style={[styles.modalTitle, { color: themeColors.textPrimary }]}>Add Address</Text>
            <TextInput style={[styles.input, { backgroundColor: themeColors.inputBg, color: themeColors.textPrimary }]} placeholder="Label (e.g., Home, Work)" value={form.label} onChangeText={(v) => setForm({...form, label: v})} placeholderTextColor={themeColors.textMuted} />
            <TextInput style={[styles.input, { backgroundColor: themeColors.inputBg, color: themeColors.textPrimary }]} placeholder="Address Line 1 *" value={form.line1} onChangeText={(v) => setForm({...form, line1: v})} placeholderTextColor={themeColors.textMuted} />
            <TextInput style={[styles.input, { backgroundColor: themeColors.inputBg, color: themeColors.textPrimary }]} placeholder="Address Line 2" value={form.line2} onChangeText={(v) => setForm({...form, line2: v})} placeholderTextColor={themeColors.textMuted} />
            <View style={styles.row}>
              <TextInput style={[styles.input, styles.inputHalf, { backgroundColor: themeColors.inputBg, color: themeColors.textPrimary }]} placeholder="City *" value={form.city} onChangeText={(v) => setForm({...form, city: v})} placeholderTextColor={themeColors.textMuted} />
              <TextInput style={[styles.input, styles.inputHalf, { backgroundColor: themeColors.inputBg, color: themeColors.textPrimary }]} placeholder="State *" value={form.state} onChangeText={(v) => setForm({...form, state: v})} placeholderTextColor={themeColors.textMuted} />
            </View>
            <TextInput style={[styles.input, { backgroundColor: themeColors.inputBg, color: themeColors.textPrimary }]} placeholder="Pincode *" value={form.pincode} onChangeText={(v) => setForm({...form, pincode: v})} keyboardType="numeric" placeholderTextColor={themeColors.textMuted} />
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.cancelBtn, { borderColor: themeColors.border }]} onPress={() => setModalVisible(false)}>
                <Text style={[styles.cancelBtnText, { color: themeColors.textPrimary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: themeColors.primary }]} onPress={handleAdd}>
                <Text style={[styles.saveBtnText, { color: themeColors.white }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:        { flex: 1 },
  center:      { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1 },
  back:        { fontSize: 24, width: 32 },
  title:       { fontSize: FONTS.sizes.md, fontWeight: '700' },
  list:        { padding: 16 },
  card:        { padding: 16, borderRadius: BORDER_RADIUS.lg, marginBottom: 8 },
  cardHeader:  { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  label:       { fontSize: FONTS.sizes.sm, fontWeight: '700' },
  delete:      { fontSize: FONTS.sizes.xs, fontWeight: '600' },
  addr:        { fontSize: FONTS.sizes.sm, marginBottom: 2 },
  empty:       { textAlign: 'center', marginTop: 50 },
  addBtn:      { margin: 16, padding: 16, borderRadius: BORDER_RADIUS.full, alignItems: 'center' },
  addBtnText:  { fontWeight: '700' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalContent: { padding: 24, borderTopLeftRadius: BORDER_RADIUS.xl, borderTopRightRadius: BORDER_RADIUS.xl },
  modalTitle:  { fontSize: FONTS.sizes.md, fontWeight: '700', marginBottom: 16 },
  input:       { padding: 12, borderRadius: BORDER_RADIUS.md, marginBottom: 12 },
  row:         { flexDirection: 'row', gap: 8 },
  inputHalf:   { flex: 1 },
  modalActions:{ flexDirection: 'row', gap: 8, marginTop: 12 },
  cancelBtn:   { flex: 1, borderWidth: 1, padding: 12, borderRadius: BORDER_RADIUS.md, alignItems: 'center' },
  cancelBtnText:{ fontWeight: '600' },
  saveBtn:     { flex: 1, padding: 12, borderRadius: BORDER_RADIUS.md, alignItems: 'center' },
  saveBtnText: { fontWeight: '700' },
});
