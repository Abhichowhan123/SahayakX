import React, { ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { C } from '../constants/theme';

export const Card = ({ title, children }: { title?: string; children: ReactNode }) => (
  <View style={s.card}>
    {title && <Text style={s.title}>{title}</Text>}
    {children}
  </View>
);

export const JsonBox = ({ data }: { data: unknown }) => (
  <View style={s.json}>
    <Text style={s.jsonText}>{JSON.stringify(data, null, 2)}</Text>
  </View>
);

export const StatusBadge = ({ ok }: { ok: boolean }) => (
  <View style={[s.badge, { backgroundColor: ok ? C.success : C.danger }]}>
    <Text style={s.badgeText}>{ok ? 'UP' : 'DOWN'}</Text>
  </View>
);

const s = StyleSheet.create({
  card:      { backgroundColor: C.card, borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  title:     { color: C.text, fontSize: 15, fontWeight: '600', marginBottom: 10 },
  json:      { backgroundColor: '#0D1117', borderRadius: 8, padding: 12, marginTop: 8 },
  jsonText:  { color: '#7DD3FC', fontSize: 11, fontFamily: 'monospace' },
  badge:     { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, alignSelf: 'flex-start' },
  badgeText: { color: C.white, fontSize: 11, fontWeight: '700' },
});
