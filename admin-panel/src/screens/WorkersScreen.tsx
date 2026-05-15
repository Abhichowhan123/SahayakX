import React, { useState } from 'react';
import { ScrollView, Text, StyleSheet, View } from 'react-native';
import { C } from '../constants/theme';
import { Card, JsonBox } from '../components/Card';
import { FormInput } from '../components/FormInput';
import { Btn } from '../components/Btn';
import { workerApi } from '../api/client';

const CATEGORIES = ['house-maid', 'plumber', 'electrician', 'cook', 'gardener', 'carpenter', 'gym-trainer', 'home-teacher'];

export default function WorkersScreen() {
  const [category,  setCategory]  = useState('plumber');
  const [workerId,  setWorkerId]  = useState('');
  const [workers,   setWorkers]   = useState<any>(null);
  const [worker,    setWorker]    = useState<any>(null);
  const [loading,   setLoading]   = useState('');

  const searchWorkers = async () => {
    setLoading('search');
    try {
      const { data } = await workerApi.search(category);
      setWorkers(data);
    } catch (err: any) {
      setWorkers(err?.response?.data || { error: err.message });
    } finally { setLoading(''); }
  };

  const getWorker = async () => {
    if (!workerId) return;
    setLoading('get');
    try {
      const { data } = await workerApi.getById(workerId);
      setWorker(data);
    } catch (err: any) {
      setWorker(err?.response?.data || { error: err.message });
    } finally { setLoading(''); }
  };

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      <Text style={s.heading}>Worker Service</Text>

      <Card title="GET /workers — Search Nearby Workers">
        <Text style={s.label}>Category</Text>
        <View style={s.chips}>
          {CATEGORIES.map((c) => (
            <Btn
              key={c}
              label={c}
              onPress={() => setCategory(c)}
              color={category === c ? C.primary : C.card}
              style={{ marginRight: 6, marginBottom: 6 }}
            />
          ))}
        </View>
        <Btn label="Search Workers" onPress={searchWorkers} loading={loading === 'search'} />
        {workers && <JsonBox data={workers} />}
      </Card>

      <Card title="GET /workers/:id — Worker Detail">
        <FormInput label="Worker ID" value={workerId} onChangeText={setWorkerId} placeholder="paste worker _id here" />
        <Btn label="Get Worker" onPress={getWorker} loading={loading === 'get'} />
        {worker && <JsonBox data={worker} />}
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
});
