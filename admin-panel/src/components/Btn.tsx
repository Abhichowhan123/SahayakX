import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle } from 'react-native';
import { C } from '../constants/theme';

interface Props {
  label:    string;
  onPress:  () => void;
  loading?: boolean;
  color?:   string;
  style?:   ViewStyle;
}

export const Btn = ({ label, onPress, loading, color = C.primary, style }: Props) => (
  <TouchableOpacity
    style={[s.btn, { backgroundColor: color }, style]}
    onPress={onPress}
    disabled={loading}
    activeOpacity={0.8}
  >
    {loading
      ? <ActivityIndicator color={C.white} size="small" />
      : <Text style={s.text}>{label}</Text>}
  </TouchableOpacity>
);

const s = StyleSheet.create({
  btn:  { borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16, alignItems: 'center', marginTop: 6 },
  text: { color: C.white, fontSize: 14, fontWeight: '600' },
});
