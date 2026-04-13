import React from 'react';
import { NavigationContainer }          from '@react-navigation/native';
import { createNativeStackNavigator }   from '@react-navigation/native-stack';
import { createBottomTabNavigator }     from '@react-navigation/bottom-tabs';
import { Ionicons }                     from '@expo/vector-icons';
import { ActivityIndicator, View }      from 'react-native';
import { useAuth }                      from '../context/AuthContext';
import { COLORS }                       from '../constants';

// Auth screens
import PhoneScreen          from '../screens/auth/PhoneScreen';
import OtpScreen            from '../screens/auth/OtpScreen';
// Customer screens
import HomeScreen           from '../screens/home/HomeScreen';
import WorkerListScreen     from '../screens/workers/WorkerListScreen';
import WorkerProfileScreen  from '../screens/workers/WorkerProfileScreen';
import BookingTrackingScreen from '../screens/booking/BookingTrackingScreen';
import BookingHistoryScreen from '../screens/booking/BookingHistoryScreen';
import ProfileScreen        from '../screens/profile/ProfileScreen';
// Worker screens
import WorkerDashboard      from '../screens/workers/WorkerDashboard';

export type RootStackParamList = {
  Auth:             undefined;
  Main:             undefined;
  WorkerList:       { category: string; subType?: string; categoryLabel: string };
  WorkerProfile:    { workerId: string };
  BookingTracking:  { bookingId: string };
};

export type AuthStackParamList = {
  Phone: undefined;
  Otp:   { phone: string; role: 'customer' | 'worker' };
};

export type TabParamList = {
  Home:     undefined;
  Bookings: undefined;
  Profile:  undefined;
};

const Stack  = createNativeStackNavigator<RootStackParamList>();
const Auth   = createNativeStackNavigator<AuthStackParamList>();
const Tab    = createBottomTabNavigator<TabParamList>();

const AuthNavigator = () => (
  <Auth.Navigator screenOptions={{ headerShown: false }}>
    <Auth.Screen name="Phone" component={PhoneScreen} />
    <Auth.Screen name="Otp"   component={OtpScreen}   />
  </Auth.Navigator>
);

const CustomerTabs = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      headerShown: false,
      tabBarActiveTintColor:   COLORS.primary,
      tabBarInactiveTintColor: COLORS.textMuted,
      tabBarStyle:             { borderTopColor: COLORS.border, height: 60, paddingBottom: 8 },
      tabBarIcon: ({ color, size }) => {
        const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
          Home:     'home-outline',
          Bookings: 'receipt-outline',
          Profile:  'person-outline',
        };
        return <Ionicons name={icons[route.name] ?? 'ellipse-outline'} size={size} color={color} />;
      },
    })}
  >
    <Tab.Screen name="Home"     component={HomeScreen}           />
    <Tab.Screen name="Bookings" component={BookingHistoryScreen} />
    <Tab.Screen name="Profile"  component={ProfileScreen}        />
  </Tab.Navigator>
);

const WorkerTabs = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      headerShown: false,
      tabBarActiveTintColor:   COLORS.primary,
      tabBarInactiveTintColor: COLORS.textMuted,
      tabBarStyle:             { borderTopColor: COLORS.border, height: 60, paddingBottom: 8 },
      tabBarIcon: ({ color, size }) => {
        const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
          Dashboard: 'grid-outline',
          Bookings:  'receipt-outline',
          Profile:   'person-outline',
        };
        return <Ionicons name={icons[route.name] ?? 'ellipse-outline'} size={size} color={color} />;
      },
    })}
  >
    <Tab.Screen name="Dashboard" component={WorkerDashboard}       />
    <Tab.Screen name="Bookings"  component={BookingHistoryScreen}  />
    <Tab.Screen name="Profile"   component={ProfileScreen}         />
  </Tab.Navigator>
);

export default function AppNavigator() {
  const { user, isLoading, isWorkerMode } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        ) : (
          <>
            <Stack.Screen name="Main" component={isWorkerMode ? WorkerTabs : CustomerTabs} />
            <Stack.Screen name="WorkerList"       component={WorkerListScreen}      />
            <Stack.Screen name="WorkerProfile"    component={WorkerProfileScreen}   />
            <Stack.Screen name="BookingTracking"  component={BookingTrackingScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
