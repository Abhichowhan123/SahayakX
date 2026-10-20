import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, View, Platform } from 'react-native';
import { C } from '../constants/theme';
import { useAdminAuth } from '../context/AdminAuthContext';

import AdminLoginScreen  from '../screens/AdminLoginScreen';
import DashboardScreen   from '../screens/DashboardScreen';
import AuthTestScreen    from '../screens/AuthTestScreen';
import WorkersScreen     from '../screens/WorkersScreen';
import BookingsScreen    from '../screens/BookingsScreen';
import PaymentsScreen    from '../screens/PaymentsScreen';
import AdminScreen       from '../screens/AdminScreen';

const Tab   = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
  'Service Health': 'pulse-outline',
  'Auth Service Test': 'key-outline',
  'Worker Service': 'hammer-outline',
  'Booking Service': 'receipt-outline',
  'Payment Service': 'card-outline',
  'Admin Panel': 'shield-outline',
};

const MainTabs = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      headerStyle:     { backgroundColor: C.card },
      headerTintColor: C.text,
      tabBarStyle:     Platform.OS === 'web' 
        ? { backgroundColor: C.card, borderTopColor: C.border, height: 60 } 
        : { backgroundColor: C.card, borderTopColor: C.border },
      tabBarActiveTintColor:   C.primary,
      tabBarInactiveTintColor: C.muted,
      tabBarLabelStyle: Platform.OS === 'web' ? { fontSize: 12, fontWeight: '600' } : { fontSize: 10 },
      tabBarShowLabel: true,
      tabBarIcon: ({ color, size }) => (
        <Ionicons name={icons[route.name] ?? 'ellipse-outline'} size={Platform.OS === 'web' ? 22 : size} color={color} />
      ),
    })}
  >
    <Tab.Screen name="Service Health" component={DashboardScreen} />
    <Tab.Screen name="Auth Service Test" component={AuthTestScreen} />
    <Tab.Screen name="Worker Service" component={WorkersScreen} />
    <Tab.Screen name="Booking Service" component={BookingsScreen} />
    <Tab.Screen name="Payment Service" component={PaymentsScreen} />
    <Tab.Screen name="Admin Panel" component={AdminScreen} />
  </Tab.Navigator>
);

export default function AppNavigator() {
  const { admin, isLoading } = useAdminAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={C.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!admin
          ? <Stack.Screen name="Login" component={AdminLoginScreen} />
          : <Stack.Screen name="Main"  component={MainTabs}         />
        }
      </Stack.Navigator>
    </NavigationContainer>
  );
}
