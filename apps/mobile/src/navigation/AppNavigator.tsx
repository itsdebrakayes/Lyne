import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ActivityIndicator, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../hooks/useAuth';
import { colors } from '../lib/theme';

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

// Queue flow screens
import BusinessScreen   from '../screens/queue/BusinessScreen';
import BranchScreen     from '../screens/queue/BranchScreen';
import ServiceScreen    from '../screens/queue/ServiceScreen';
import JoinQueueScreen  from '../screens/queue/JoinQueueScreen';
import TicketScreen     from '../screens/queue/TicketScreen';

export type RootStackParamList = {
  Auth:       undefined;
  Signup:     undefined;
  Main:       undefined;
  History:    undefined;
  Notifications: undefined;
  Business:   { businessId: string; businessName: string };
  Branch:     { businessId: string; branchId: string; branchName: string };
  Service:    { businessId: string; branchId: string };
  JoinQueue:  { businessId: string; branchId: string; serviceId: string; serviceName?: string };
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
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <>
            <Stack.Screen name="Auth" component={LoginScreen} />
            <Stack.Screen name="Signup" component={SignupScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Main"      component={MainTabs}        />
            <Stack.Screen name="History"   component={HistoryScreen}   />
            <Stack.Screen name="Notifications" component={NotificationsScreen} />
            <Stack.Screen name="Business"  component={BusinessScreen}  />
            <Stack.Screen name="Branch"    component={BranchScreen}    />
            <Stack.Screen name="Service"   component={ServiceScreen}   />
            <Stack.Screen name="JoinQueue" component={JoinQueueScreen} />
            <Stack.Screen name="Ticket"    component={TicketScreen}    options={{ gestureEnabled: false }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
