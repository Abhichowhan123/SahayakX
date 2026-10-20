import React, { useState, useCallback } from 'react';
import {
  ScrollView, View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform,
} from 'react-native';
import axios from 'axios';
import { C } from '../constants/theme';
import { Card, StatusBadge } from '../components/Card';
import { BASE_URL } from '../api/client';

const SERVICES = [
  { name: 'API Gateway',    path: '/health' },
  { name: 'Auth Service',   path: '/auth/health' },
  { name: 'User Service',   path: '/users/health' },
  { name: 'Worker Service', path: '/workers/health' },
  { name: 'Catalog',        path: '/catalog/health' },
  { name: 'Booking Service', path: '/bookings/health' },
  { name: 'Payment Service', path: '/payments/health' },
  { name: 'Notification',   path: '/notifications/health' },
  { name: 'Review',         path: '/reviews/health' },
  { name: 'Admin Service',  path: '/admin/health' },
];

type ServiceStatus = Record<string, boolean | null>;

export default function DashboardScreen() {
  const [statuses,  setStatuses]  = useState<ServiceStatus>({});
  const [checking,  setChecking]  = useState(false);

  const checkAll = useCallback(async () => {
    setChecking(true);
    const results: ServiceStatus = {};
    await Promise.all(
      SERVICES.map(async (svc) => {
        try {
          await axios.get(`${BASE_URL}${svc.path}`, { timeout: 4000 });
          results[svc.name] = true;
        } catch {
          results[svc.name] = false;
        }
      }),
    );
    setStatuses(results);
    setChecking(false);
  }, []);

  const allUp   = Object.values(statuses).every(Boolean);
  const checked = Object.keys(statuses).length > 0;

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      <Text style={s.heading}>Service Health</Text>
      <Text style={s.sub}>{BASE_URL}</Text>

      {checked && (
        <View style={[s.banner, { backgroundColor: allUp ? C.success : C.danger }]}>
          <Text style={s.bannerText}>{allUp ? '✓ All services UP' : '✗ Some services DOWN'}</Text>
        </View>
      )}

      <TouchableOpacity style={s.checkBtn} onPress={checkAll} disabled={checking} activeOpacity={0.8}>
        {checking
          ? <ActivityIndicator color={C.white} />
          : <Text style={s.checkBtnText}>Check All Services</Text>}
      </TouchableOpacity>

      <View style={Platform.OS === 'web' ? s.grid : {}}>
        {SERVICES.map((svc) => (
          <View key={svc.name} style={Platform.OS === 'web' ? s.gridItem : {}}>
            <Card>
              <View style={s.row}>
                <View>
                  <Text style={s.svcName}>{svc.name}</Text>
                  <Text style={s.svcPath}>{svc.path}</Text>
                </View>
                {statuses[svc.name] != null
                  ? <StatusBadge ok={statuses[svc.name] as boolean} />
                  : <View style={s.dot} />}
              </View>
            </Card>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root:     { flex: 1, backgroundColor: C.bg },
  content:  { padding: 16, paddingBottom: 40 },
  heading:  { color: C.text, fontSize: 24, fontWeight: '700', marginBottom: 4 },
  sub:      { color: C.muted, fontSize: 12, marginBottom: 12 },
  banner:   { padding: 10, borderRadius: 8, marginBottom: 12, alignItems: 'center' },
  bannerText:{ color: C.white, fontWeight: '600' },
  checkBtn: { backgroundColor: C.primary, padding: 12, borderRadius: 8, alignItems: 'center', marginBottom: 16 },
  checkBtnText: { color: C.white, fontWeight: '600' },
  grid:     Platform.OS === 'web' ? { flexDirection: 'row', flexWrap: 'wrap', gap: 12 } : {},
  gridItem: Platform.OS === 'web' ? { width: '32%' } : { width: '100%' },
  row:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  svcName:  { color: C.text, fontWeight: '600' },
  svcPath:  { color: C.muted, fontSize: 12 },
  dot:      { width: 10, height: 10, borderRadius: 5, backgroundColor: C.border },
});
