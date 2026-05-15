import React, { useState } from 'react';
import { ScrollView, Text, StyleSheet } from 'react-native';
import { C } from '../constants/theme';
import { Card, JsonBox } from '../components/Card';
import { FormInput } from '../components/FormInput';
import { Btn } from '../components/Btn';
import { reviewApi } from '../api/client';

export default function ReviewsScreen() {
  const [workerId, setWorkerId] = useState('');
  const [reviews,  setReviews]  = useState<any>(null);
  const [loading,  setLoading]  = useState(false);

  const load = async () => {
    if (!workerId) return;
    setLoading(true);
    try {
      const { data } = await reviewApi.getWorkerReviews(workerId);
      setReviews(data);
    } catch (err: any) {
      setReviews(err?.response?.data || { error: err.message });
    } finally { setLoading(false); }
  };

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      <Text style={s.heading}>Review Service</Text>

      <Card title="GET /reviews/worker/:id — Worker Reviews">
        <FormInput label="Worker ID" value={workerId} onChangeText={setWorkerId} placeholder="paste worker _id" />
        <Btn label="Load Reviews" onPress={load} loading={loading} />
        {reviews && <JsonBox data={reviews} />}
      </Card>

      <Card title="POST /reviews — Submit Review">
        <Text style={s.info}>Reviews can only be submitted after a booking is completed.</Text>
        <Text style={s.info}>Use the Auth Test screen to log in, complete a booking flow, then the review endpoint becomes available.</Text>
        <Text style={s.info}>Required fields: bookingId, workerId, rating (1–5), comment (optional)</Text>
      </Card>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, paddingBottom: 40 },
  heading: { color: C.text, fontSize: 22, fontWeight: '700', marginBottom: 16 },
  info:    { color: C.muted, fontSize: 13, marginBottom: 6 },
});
