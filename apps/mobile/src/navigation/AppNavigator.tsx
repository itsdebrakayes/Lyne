import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ActivityIndicator, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../hooks/useAuth';
import { colors } from '../lib/theme';
import OfflineState from '../components/OfflineState';

// Auth screens
import LoginScreen    from '../screens/auth/LoginScreen';
import SignupScreen   from '../screens/auth/SignupScreen';

// Main screens
import HomeScreen       from '../screens/main/HomeScreen';
import SearchScreen     from '../screens/main/SearchScreen';
import SavedScreen      from '../screens/main/SavedScreen';
import HistoryScreen    from '../screens/main/HistoryScreen';
import NotificationsScreen from '../screens/main/NotificationsScreen';
import ProfileScreen    from '../screens/main/ProfileScreen';
import PlanVisitScreen  from '../screens/main/PlanVisitScreen';
import HelpScreen       from '../screens/main/HelpScreen';
import AgencyHelpScreen from '../screens/main/AgencyHelpScreen';
import DocumentCaptureScreen from '../screens/main/DocumentCaptureScreen';
import PaymentMethodsScreen from '../screens/main/PaymentMethodsScreen';
import PrivacySecurityScreen from '../screens/main/PrivacySecurityScreen';

// Queue flow screens
import BusinessScreen   from '../screens/queue/BusinessScreen';
import BranchScreen     from '../screens/queue/BranchScreen';
import ServiceScreen    from '../screens/queue/ServiceScreen';
import JoinQueueScreen  from '../screens/queue/JoinQueueScreen';
import QueueMapScreen   from '../screens/queue/QueueMapScreen';
import TicketScreen     from '../screens/queue/TicketScreen';

// Kiosk clerk (branch intake actor — adds walk-ins, not a customer)
import KioskScreen      from '../screens/kiosk/KioskScreen';

export type RootStackParamList = {
  Auth:       undefined;
  Signup:     undefined;
  Kiosk:      undefined;
  Main:       undefined;
  History:    undefined;
  Notifications: undefined;
  Help:       undefined;
  AgencyHelp: { slug: string };
  DocumentCapture: { field: 'national_id' | 'trn' };
  PaymentMethods: undefined;
  PrivacySecurity: undefined;
  Plan:       { businessId?: string; branchId?: string } | undefined;
  /* A sitting you must hold a place at in advance — only reachable when one is
     actually open, so the app never shows a door that leads nowhere. */
  Business:   { businessId: string; businessName: string };
  Branch:     { businessId: string; branchId: string; branchName: string };
  Service:    { businessId: string; branchId: string };
  JoinQueue:  { businessId: string; branchId: string; serviceId: string; serviceName?: string };
  QueueMap:   { businessId: string; branchId: string; serviceId: string; serviceName?: string };
  Ticket:     { ticketId?: string; businessId?: string; branchId?: string; serviceId?: string };
};

export type TabParamList = {
  Home:    undefined;
  Search:  undefined;
  Saved:   undefined;
  Profile: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab   = createBottomTabNavigator<TabParamList>();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: { display: 'none' },
        tabBarActiveTintColor:   '#15151a',
        tabBarInactiveTintColor: '#8b8b93',
        tabBarIcon: ({ focused, color, size }) => {
          const icons: Record<string, [string, string]> = {
            Home:    ['home',           'home-outline'],
            Search:  ['search',         'search-outline'],
            Saved:   ['bookmark',       'bookmark-outline'],
            Profile: ['person-circle',  'person-circle-outline'],
          };
          const [active, inactive] = icons[route.name] || ['help', 'help-outline'];
          return <Ionicons name={(focused ? active : inactive) as any} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home"    component={HomeScreen}    />
      <Tab.Screen name="Search"  component={SearchScreen}  />
      <Tab.Screen name="Saved"   component={SavedScreen}   />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Auth" component={LoginScreen} />
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  const { user, kiosk, loading, unreachable, retrySession } = useAuth();

  /* Signed in, but the profile could not be loaded because we could not reach
     the API. The old behaviour fell through to the auth stack, which asks for
     a password to solve a connectivity problem — and implies the session was
     lost when it is sitting intact on the device. Say what is actually wrong
     and offer the only thing that helps, which is trying again. */
  if (!loading && unreachable && !user && !kiosk) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <OfflineState onRetry={() => { void retrySession(); }} />
      </View>
    );
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {/* One transition for the whole stack. The native stack default varies by
          platform and by how a screen is pushed, so screens arrived
          inconsistently — some sliding, some fading. `slide_from_right` is the
          iOS convention and, crucially, it is the gesture users already expect
          to reverse with a swipe back. */}
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        {kiosk ? (
          // A kiosk clerk gets a single-purpose console — no customer tabs, no
          // queue-joining flow. Their whole job is adding walk-ins for others.
          <Stack.Screen name="Kiosk" component={KioskScreen} />
        ) : !user ? (
          <>
            <Stack.Screen name="Auth" component={LoginScreen} />
            <Stack.Screen name="Signup" component={SignupScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Main"      component={MainTabs}        />
            <Stack.Screen name="History"   component={HistoryScreen}   />
            <Stack.Screen name="Notifications" component={NotificationsScreen} />
            <Stack.Screen name="Help"      component={HelpScreen}      />
            <Stack.Screen name="AgencyHelp" component={AgencyHelpScreen} />
            <Stack.Screen name="DocumentCapture" component={DocumentCaptureScreen} />
            <Stack.Screen name="PaymentMethods" component={PaymentMethodsScreen} />
            <Stack.Screen name="PrivacySecurity" component={PrivacySecurityScreen} />
            <Stack.Screen name="Plan"      component={PlanVisitScreen} />
            <Stack.Screen name="Business"  component={BusinessScreen}  />
            <Stack.Screen name="Branch"    component={BranchScreen}    />
            <Stack.Screen name="Service"   component={ServiceScreen}   />
            <Stack.Screen name="QueueMap"  component={QueueMapScreen}  />
            <Stack.Screen name="JoinQueue" component={JoinQueueScreen} />
            <Stack.Screen name="Ticket"    component={TicketScreen}    options={{ gestureEnabled: false }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
