import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert,
  TextInput,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { workerApi } from '../../api';
import { COLORS, SPACING, BORDER_RADIUS, FONTS } from '../../constants';

export default function VerificationScreen({ navigation }: any) {
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
    <ScrollView style={{ flex: 1, backgroundColor: COLORS.white }} contentContainerStyle={{ padding: SPACING.lg }}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginBottom: SPACING.md }}>
        <Text style={{ fontSize: 18, color: COLORS.primary }}>← Back</Text>
      </TouchableOpacity>
      <Text style={styles.title}>Worker Verification</Text>
      <Text style={styles.subtitle}>Upload Aadhaar card and selfie for verification</Text>

      <Text style={styles.label}>Aadhaar Number</Text>
      <TextInput style={styles.input} value={aadhaarNumber} onChangeText={setAadhaarNumber} placeholder="1234 5678 9012" />

      <TouchableOpacity style={styles.btn} onPress={() => pickImage(setAadhaarFront)}>
        <Text style={styles.btnText}>{aadhaarFront ? '✓ Aadhaar Front Uploaded' : 'Upload Aadhaar Front'}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.btn} onPress={() => pickImage(setAadhaarBack)}>
        <Text style={styles.btnText}>{aadhaarBack ? '✓ Aadhaar Back Uploaded' : 'Upload Aadhaar Back'}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.btn} onPress={() => pickImage(setSelfie)}>
        <Text style={styles.btnText}>{selfie ? '✓ Selfie Uploaded' : 'Upload Selfie'}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.submitBtn, submitting && styles.disabled]} onPress={handleSubmit} disabled={submitting}>
        {submitting ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.submitText}>Submit for Verification</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: FONTS.sizes.xl, fontWeight: '800', color: COLORS.textPrimary, marginBottom: SPACING.xs },
  subtitle: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, marginBottom: SPACING.lg },
  label: { fontSize: FONTS.sizes.sm, fontWeight: '600', color: COLORS.textSecondary, marginBottom: SPACING.xs },
  input: { backgroundColor: COLORS.inputBg, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.border },
  btn: { backgroundColor: COLORS.inputBg, borderWidth: 1, borderColor: COLORS.border, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, alignItems: 'center', marginBottom: SPACING.md },
  btnText: { fontSize: FONTS.sizes.base, fontWeight: '600', color: COLORS.textPrimary },
  submitBtn: { backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.full, padding: SPACING.md, alignItems: 'center', marginTop: SPACING.lg },
  submitText: { color: COLORS.white, fontSize: FONTS.sizes.md, fontWeight: '700' },
  disabled: { opacity: 0.6 },
});
