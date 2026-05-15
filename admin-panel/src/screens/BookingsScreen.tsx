import React, { useState } from 'react';
import { ScrollView, Text, StyleSheet, View } from 'react-native';
import { C } from '../constants/theme';
import { Card, JsonBox } from '../components/Card';
import { FormInput } from '../components/FormInput';
import { Btn } from '../components/Btn';
import { bookingApi } from '../api/client';

const STATUSES = ['', 'pending', 'accepted', 'en-route', 'in-progress', 'completed', 'cancelled'];

export default function BookingsScreen() {
  const [status,    setStatus]    = useState('');
  const [bookingId, setBookingId] = useState('');
  const [bookings,  setBookings]  = useState<any>(null);
  const [booking,   setBooking]   = useState<any>(null);
  const [loading,   setLoading]   = useState('');

  const listBookings = async () => {
    setLoading('list');
    try {
      const { data } = await bookingApi.getMyBookings(status || undefined);
      setBookings(data);
    } catch (err: any) {
      setBookings(err?.response?.data || { error: err.message });
    } finally { setLoading(''); }
  };

  const getBooking = async () => {
    if (!bookingId) return;
    setLoading('get');
    try {
      const { data } = await bookingApi.getById(bookingId);
      setBooking(data);
    } catch (err: any) {
      setBooking(err?.response?.data || { error: err.message });
    } finally { setLoading(''); }
  };

  const cancelBooking = async () => {
    if (!bookingId) return;
    setLoading('cancel');
    try {
      const { data } = await bookingApi.cancel(bookingId);
      setBooking(data);
    } catch (err: any) {
      setBooking(err?.response?.data || { error: err.message });
    } finally { setLoading(''); }
  };

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      <Text style={s.heading}>Booking Service</Text>

      <Card title="GET /bookings — My Bookings">
        <Text style={s.label}>Filter by status</Text>
        <View style={s.chips}>
          {STATUSES.map((st) => (
            <Btn
              key={st || 'all'}
              label={st || 'all'}
              onPress={() => setStatus(st)}
              color={status === st ? C.primary : C.card}
              style={{ marginRight: 6, marginBottom: 6 }}
            />
          ))}
        </View>
        <Btn label="List Bookings" onPress={listBookings} loading={loading === 'list'} />
        {bookings && <JsonBox data={bookings} />}
      </Card>

      <Card title="GET / POST /bookings/:id — Single Booking">
        <FormInput label="Booking ID" value={bookingId} onChangeText={setBookingId} placeholder="paste booking _id" />
        <View style={s.row}>
          <Btn label="Get" onPress={getBooking} loading={loading === 'get'} style={{ flex: 1, marginRight: 6 }} />
          <Btn label="Cancel" onPress={cancelBooking} loading={loading === 'cancel'} color={C.danger} style={{ flex: 1 }} />
        </View>
        {booking && <JsonBox data={booking} />}
      </Card>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, paddingBottom: 40 },
  heading: { color: C.text, fontSize: 22, fontWeight: '700', marginBottom: 16 },
  label:   { color: C.muted, fontSize: 12, marginBottom: 6 },
  chips:   { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  row:     { flexDirection: 'row' },
});
