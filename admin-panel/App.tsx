import 'react-native-gesture-handler';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';
import { AdminAuthProvider } from './src/context/AdminAuthContext';
import AppNavigator from './src/navigation';

export default function App() {
  return (
    <GestureHandlerRootView style={s.root}>
      <StatusBar style="light" />
      <AdminAuthProvider>
        <AppNavigator />
      </AdminAuthProvider>
    </GestureHandlerRootView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
});
