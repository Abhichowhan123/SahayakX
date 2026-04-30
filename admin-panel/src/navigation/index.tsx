import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, View } from 'react-native';
import { C } from '../constants/theme';
import { useAdminAuth } from '../context/AdminAuthContext';

import AdminLoginScreen  from '../screens/AdminLoginScreen';
import DashboardScreen   from '../screens/DashboardScreen';
import AuthTestScreen    from '../screens/AuthTestScreen';
import UsersScreen       from '../screens/UsersScreen';
import WorkersScreen     from '../screens/WorkersScreen';
import CatalogScreen     from '../screens/CatalogScreen';
import BookingsScreen    from '../screens/BookingsScreen';
import PaymentsScreen    from '../screens/PaymentsScreen';
import ReviewsScreen     from '../screens/ReviewsScreen';
import AdminScreen       from '../screens/AdminScreen';

const Tab   = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
  Dashboard: 'pulse-outline',
  Auth:      'key-outline',
  Users:     'person-outline',
  Workers:   'hammer-outline',
  Catalog:   'grid-outline',
  Bookings:  'receipt-outline',
  Payments:  'card-outline',
  Reviews:   'star-outline',
  Admin:     'shield-outline',
};

const MainTabs = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      headerStyle:     { backgroundColor: C.card },
      headerTintColor: C.text,
      tabBarStyle:     { backgroundColor: C.card, borderTopColor: C.border },
      tabBarActiveTintColor:   C.primary,
      tabBarInactiveTintColor: C.muted,
      tabBarShowLabel: false,
      tabBarIcon: ({ color, size }) => (
        <Ionicons name={icons[route.name] ?? 'ellipse-outline'} size={size} color={color} />
      ),
    })}
  >
    <Tab.Screen name="Dashboard" component={DashboardScreen} />
    <Tab.Screen name="Auth"      component={AuthTestScreen}  />
    <Tab.Screen name="Users"     component={UsersScreen}     />
    <Tab.Screen name="Workers"   component={WorkersScreen}   />
    <Tab.Screen name="Catalog"   component={CatalogScreen}   />
    <Tab.Screen name="Bookings"  component={BookingsScreen}  />
    <Tab.Screen name="Payments"  component={PaymentsScreen}  />
    <Tab.Screen name="Reviews"   component={ReviewsScreen}   />
    <Tab.Screen name="Admin"     component={AdminScreen}     />
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
