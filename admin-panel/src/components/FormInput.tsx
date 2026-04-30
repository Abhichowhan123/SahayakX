import React from 'react';
import { TextInput, Text, View, StyleSheet, TextInputProps } from 'react-native';
import { C } from '../constants/theme';

interface Props extends TextInputProps {
  label: string;
}

export const FormInput = ({ label, ...props }: Props) => (
  <View style={s.wrap}>
    <Text style={s.label}>{label}</Text>
    <TextInput
      style={s.input}
      placeholderTextColor={C.muted}
      autoCapitalize="none"
      {...props}
    />
  </View>
);

const s = StyleSheet.create({
  wrap:  { marginBottom: 10 },
  label: { color: C.muted, fontSize: 12, marginBottom: 4 },
  input: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor:  C.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical:   10,
    color:        C.text,
    fontSize:     14,
  },
});
