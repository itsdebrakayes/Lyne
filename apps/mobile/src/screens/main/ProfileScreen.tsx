import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { colors, v3 } from '../../lib/mobileV3Styles';
import { MiniTabBar } from './HomeScreen';

const rows = [
  ['Notifications', 'Queue & peak-hour alerts', '#f5a623'],
  ['Queue history', '12 visits', '#2176f3'],
  ['Payment methods', '2 cards', '#2fbf71'],
  ['Account settings', 'Personal info, security', '#7c5cff'],
] as const;

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const name = user?.full_name || 'Andre Campbell';
  const email = user?.email || 'andre.c@email.com';
  return (
    <View style={v3.root}>
      <ScrollView contentContainerStyle={v3.content} showsVerticalScrollIndicator={false}>
        <Text style={[v3.h2, { marginBottom: 18 }]}>Profile</Text>
        <View style={[v3.darkCard, { padding: 20, flexDirection: 'row', alignItems: 'center', gap: 15 }]}>
          <View style={{ width: 60, height: 60, borderRadius: 18, backgroundColor: 'rgba(255,255,255,.12)', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 24, fontWeight: '800' }}>{name[0]}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontSize: 19, fontWeight: '800' }}>{name}</Text>
            <Text style={{ color: 'rgba(255,255,255,.6)', fontSize: 13 }}>{email}</Text>
          </View>
        </View>

        <View style={[v3.card, { marginTop: 16, overflow: 'hidden' }]}>
          {rows.map(([label, sub, dot], index) => (
            <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderBottomWidth: index === rows.length - 1 ? 0 : 1, borderBottomColor: colors.border }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.pill, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: dot }} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>{label}</Text>
                <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>{sub}</Text>
              </View>
              <Ionicons name="chevron-forward" size={17} color={colors.muted} />
            </View>
          ))}
        </View>

        <TouchableOpacity onPress={signOut} style={[v3.secondaryButton, { marginTop: 16 }]}>
          <Text style={{ color: colors.danger, fontSize: 15, fontWeight: '800' }}>Log out</Text>
        </TouchableOpacity>
      </ScrollView>
      <MiniTabBar active="Profile" />
    </View>
  );
}
