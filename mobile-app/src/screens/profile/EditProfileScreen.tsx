import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, SafeAreaView, Platform, Alert,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation';
import { userApi } from '../../api';
import { COLORS, SPACING, BORDER_RADIUS, FONTS } from '../../constants';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'EditProfile'> };

export default function EditProfileScreen({ navigation }: Props) {
  const [fullName, setFullName] = useState('');
  const [email,    setEmail]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');

  useEffect(() => {
    setLoading(true);
    userApi.getProfile()
      .then(res => {
        setFullName(res.data.data?.fullName || '');
        setEmail(res.data.data?.email || '');
      })
      .catch(() => setError('Failed to load profile'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setError('');
    if (!fullName.trim()) { setError('Name is required'); return; }
    setSaving(true);
    try {
      await userApi.updateProfile({ fullName: fullName.trim(), email: email.trim() });
      if (Platform.OS === 'web') {
        window.alert('Profile updated successfully');
      } else {
        Alert.alert('Success', 'Profile updated successfully');
      }
      navigation.goBack();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Edit Profile</Text>

        <Text style={styles.label}>Full Name</Text>
        <TextInput
          style={styles.input}
          value={fullName}
          onChangeText={setFullName}
          placeholder="Enter your full name"
          placeholderTextColor={COLORS.textMuted}
        />

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="Enter your email"
          placeholderTextColor={COLORS.textMuted}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
          {saving
            ? <ActivityIndicator color={COLORS.white} />
            : <Text style={styles.saveBtnText}>Save Changes</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: COLORS.background },
  center:        { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content:       { padding: SPACING.lg },
  heading:       { fontSize: FONTS.sizes.xl, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.xl },
  label:         { fontSize: FONTS.sizes.sm, fontWeight: '600', color: COLORS.textSecondary, marginBottom: SPACING.xs },
  input:         { backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, fontSize: FONTS.sizes.base, color: COLORS.textPrimary, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.border },
  error:         { color: COLORS.error, fontSize: FONTS.sizes.sm, marginBottom: SPACING.md, textAlign: 'center' },
  saveBtn:       { backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.full, paddingVertical: SPACING.md, alignItems: 'center', marginBottom: SPACING.sm },
  saveBtnText:   { fontSize: FONTS.sizes.base, fontWeight: '700', color: COLORS.white },
  cancelBtn:     { borderRadius: BORDER_RADIUS.full, paddingVertical: SPACING.md, alignItems: 'center' },
  cancelBtnText: { fontSize: FONTS.sizes.base, fontWeight: '600', color: COLORS.textSecondary },
});
