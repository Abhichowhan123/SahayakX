import React, { useState } from 'react';
import { ScrollView, Text, StyleSheet } from 'react-native';
import { C } from '../constants/theme';
import { Card, JsonBox } from '../components/Card';
import { Btn } from '../components/Btn';
import { paymentApi } from '../api/client';

export default function PaymentsScreen() {
  const [history, setHistory] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const { data } = await paymentApi.getHistory();
      setHistory(data);
    } catch (err: any) {
      setHistory(err?.response?.data || { error: err.message });
    } finally { setLoading(false); }
  };

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      <Text style={s.heading}>Payment Service</Text>
      <Text style={s.note}>Razorpay test mode — use test card 4111 1111 1111 1111</Text>

      <Card title="GET /payments/history — Payment History">
        <Btn label="Load History" onPress={loadHistory} loading={loading} />
        {history && <JsonBox data={history} />}
      </Card>

      <Card title="Payment Flow (requires full booking)">
        <Text style={s.info}>1. Create a booking via Bookings tab</Text>
        <Text style={s.info}>2. Worker accepts the booking</Text>
        <Text style={s.info}>3. POST /payments/order — creates Razorpay order</Text>
        <Text style={s.info}>4. Complete payment in Razorpay checkout</Text>
        <Text style={s.info}>5. POST /payments/verify — verifies signature</Text>
        <Text style={s.info}>6. Payment released to worker on job completion</Text>
      </Card>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, paddingBottom: 40 },
  heading: { color: C.text, fontSize: 22, fontWeight: '700', marginBottom: 4 },
  note:    { color: C.warning, fontSize: 12, marginBottom: 16 },
  info:    { color: C.muted, fontSize: 13, marginBottom: 6 },
});
