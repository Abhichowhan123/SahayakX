import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert,
  TextInput,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { workerApi } from '../../api';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../theme/theme';
import { SPACING, BORDER_RADIUS, FONTS } from '../../constants';

export default function VerificationScreen({ navigation }: any) {
  const { colors: themeColors } = useTheme();
  const [aadhaarFront, setAadhaarFront] = useState<any>(null);
  const [aadhaarBack, setAadhaarBack] = useState<any>(null);
  const [selfie, setSelfie] = useState<any>(null);
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const pickImage = async (setter: (v: any) => void) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled) {
      setter(result.assets[0]);
    }
  };

  const handleSubmit = async () => {
    if (!aadhaarFront || !aadhaarBack || !selfie) {
      Alert.alert('Missing Documents', 'Please upload Aadhaar front, back, and selfie');
      return;
    }
    try {
      setSubmitting(true);
      const formData = new FormData();
      formData.append('aadhaarNumber', aadhaarNumber);
      formData.append('aadhaarFront', {
        uri: aadhaarFront.uri,
        name: 'aadhaarFront.jpg',
        type: 'image/jpeg',
      } as any);
      formData.append('aadhaarBack', {
        uri: aadhaarBack.uri,
        name: 'aadhaarBack.jpg',
        type: 'image/jpeg',
      } as any);
      formData.append('selfie', {
        uri: selfie.uri,
        name: 'selfie.jpg',
        type: 'image/jpeg',
      } as any);
      await workerApi.submitVerification(formData);
      Alert.alert('Success', 'Documents submitted for verification. Admin will review soon.');
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to submit documents');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: themeColors.background }]} contentContainerStyle={{ padding: SPACING.lg }}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginBottom: SPACING.md }}>
        <Text style={[styles.back, { color: themeColors.primary }]}>← Back</Text>
      </TouchableOpacity>
      <Text style={[styles.title, { color: themeColors.textPrimary }]}>Worker Verification</Text>
      <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>Upload Aadhaar card and selfie for verification</Text>

      <Text style={[styles.label, { color: themeColors.textSecondary }]}>Aadhaar Number</Text>
      <TextInput style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]} value={aadhaarNumber} onChangeText={setAadhaarNumber} placeholder="1234 5678 9012" />

      <TouchableOpacity style={[styles.btn, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border }]} onPress={() => pickImage(setAadhaarFront)}>
        <Text style={[styles.btnText, { color: themeColors.textPrimary }]}>{aadhaarFront ? '✓ Aadhaar Front Uploaded' : 'Upload Aadhaar Front'}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.btn, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border }]} onPress={() => pickImage(setAadhaarBack)}>
        <Text style={[styles.btnText, { color: themeColors.textPrimary }]}>{aadhaarBack ? '✓ Aadhaar Back Uploaded' : 'Upload Aadhaar Back'}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.btn, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border }]} onPress={() => pickImage(setSelfie)}>
        <Text style={[styles.btnText, { color: themeColors.textPrimary }]}>{selfie ? '✓ Selfie Uploaded' : 'Upload Selfie'}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.submitBtn, { backgroundColor: themeColors.primary }, submitting && styles.disabled]} onPress={handleSubmit} disabled={submitting}>
        {submitting ? <ActivityIndicator color={themeColors.white} /> : <Text style={[styles.submitText, { color: themeColors.white }]}>Submit for Verification</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  back: { fontSize: 18 },
  title: { fontSize: FONTS.sizes.xl, fontWeight: '800', marginBottom: SPACING.xs },
  subtitle: { fontSize: FONTS.sizes.sm, marginBottom: SPACING.lg },
  label: { fontSize: FONTS.sizes.sm, fontWeight: '600', marginBottom: SPACING.xs },
  input: { borderRadius: BORDER_RADIUS.md, padding: SPACING.md, marginBottom: SPACING.md, borderWidth: 1 },
  btn: { borderWidth: 1, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, alignItems: 'center', marginBottom: SPACING.md },
  btnText: { fontSize: FONTS.sizes.base, fontWeight: '600' },
  submitBtn: { borderRadius: BORDER_RADIUS.full, padding: SPACING.md, alignItems: 'center', marginTop: SPACING.lg },
  submitText: { fontSize: FONTS.sizes.md, fontWeight: '700' },
  disabled: { opacity: 0.6 },
});
