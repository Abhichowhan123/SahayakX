import React, { useState } from 'react';
import { ScrollView, Text, StyleSheet } from 'react-native';
import { C } from '../constants/theme';
import { Card, JsonBox } from '../components/Card';
import { Btn } from '../components/Btn';
import { catalogApi } from '../api/client';

export default function CatalogScreen() {
  const [categories, setCategories] = useState<any>(null);
  const [pricing,    setPricing]    = useState<any>(null);
  const [loading,    setLoading]    = useState('');

  const fetch = async (key: string, fn: () => Promise<any>) => {
    setLoading(key);
    try {
      const { data } = await fn();
      if (key === 'categories') setCategories(data);
      if (key === 'pricing')    setPricing(data);
    } catch (err: any) {
      const out = err?.response?.data || { error: err.message };
      if (key === 'categories') setCategories(out);
      if (key === 'pricing')    setPricing(out);
    } finally { setLoading(''); }
  };

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      <Text style={s.heading}>Catalog Service</Text>

      <Card title="GET /catalog/categories — All Service Categories">
        <Btn
          label="Load Categories"
          onPress={() => fetch('categories', catalogApi.getCategories)}
          loading={loading === 'categories'}
        />
        {categories && <JsonBox data={categories} />}
      </Card>

      <Card title="GET /catalog/pricing — Pricing Guidelines">
        <Btn
          label="Load Pricing"
          onPress={() => fetch('pricing', catalogApi.getPricing)}
          loading={loading === 'pricing'}
        />
        {pricing && <JsonBox data={pricing} />}
      </Card>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, paddingBottom: 40 },
  heading: { color: C.text, fontSize: 22, fontWeight: '700', marginBottom: 16 },
});
