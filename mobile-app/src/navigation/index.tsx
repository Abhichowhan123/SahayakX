import React from 'react';
import { NavigationContainer }          from '@react-navigation/native';
import { createNativeStackNavigator }   from '@react-navigation/native-stack';
import { createBottomTabNavigator }     from '@react-navigation/bottom-tabs';
import { Ionicons }                     from '@expo/vector-icons';
import { ActivityIndicator, View }      from 'react-native';
import { useAuth }                      from '../context/AuthContext';
import { useTheme }                     from '../context/ThemeContext';
import { COLORS }                       from '../constants';

// Auth screens
import PhoneScreen          from '../screens/auth/PhoneScreen';
import OtpScreen            from '../screens/auth/OtpScreen';
import ProfileSetupScreen   from '../screens/auth/ProfileSetupScreen';
// Customer screens
import HomeScreen           from '../screens/home/HomeScreen';
import WorkerListScreen     from '../screens/workers/WorkerListScreen';
import WorkerProfileScreen  from '../screens/workers/WorkerProfileScreen';
import BookingTrackingScreen from '../screens/booking/BookingTrackingScreen';
import ChatScreen            from '../screens/booking/ChatScreen';
import BookingHistoryScreen from '../screens/booking/BookingHistoryScreen';
import ProfileScreen        from '../screens/profile/ProfileScreen';
import EditProfileScreen    from '../screens/profile/EditProfileScreen';
import AddressesScreen      from '../screens/profile/AddressesScreen';
// Worker screens
import WorkerDashboard      from '../screens/workers/WorkerDashboard';
import WorkerBookingDetailScreen from '../screens/workers/WorkerBookingDetailScreen';
import VerificationScreen   from '../screens/auth/VerificationScreen';
import WorkerVerificationStatusScreen from '../screens/workers/WorkerVerificationStatusScreen';

export type RootStackParamList = {
  Auth:             undefined;
  Main:             undefined;
  WorkerList:       { category: string; subType?: string; categoryLabel: string };
  WorkerProfile:    { workerId: string };
  BookingTracking:  { bookingId: string };
  Chat:             { bookingId: string };
  WorkerBookingDetail: { bookingId: string };
  EditProfile:      undefined;
  Addresses:        undefined;
  Verification:     undefined;
  VerificationStatus: undefined;
};

export type AuthStackParamList = {
  Phone: undefined;
  Otp:   { phone: string; role: 'customer' | 'worker'; mode: 'login' | 'register'; devOtp?: string };
};

export type TabParamList = {
  Home:      undefined;
  Bookings:  undefined;
  Profile:   undefined;
  Dashboard: undefined;
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

const CustomerTabs = () => {
  const { colors } = useTheme();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor:   colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle:             { backgroundColor: colors.surface, borderTopColor: colors.border, height: 60, paddingBottom: 8 },
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
};

const WorkerTabs = () => {
  const { colors } = useTheme();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor:   colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle:             { backgroundColor: colors.surface, borderTopColor: colors.border, height: 60, paddingBottom: 8 },
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
};

export default function AppNavigator() {
  const { user, isLoading, isWorkerMode, needsProfile } = useAuth();
  const { colors } = useTheme();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // New user: authenticated but hasn't set up profile yet
  if (user && needsProfile) {
    return (
      <NavigationContainer>
        <ProfileSetupScreen />
      </NavigationContainer>
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
            <Stack.Screen name="Chat"             component={ChatScreen}             />
            <Stack.Screen name="WorkerBookingDetail" component={WorkerBookingDetailScreen} />
            <Stack.Screen name="EditProfile"      component={EditProfileScreen}     />
            <Stack.Screen name="Addresses"        component={AddressesScreen}       />
            <Stack.Screen name="Verification"     component={VerificationScreen}    />
            <Stack.Screen name="VerificationStatus" component={WorkerVerificationStatusScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
