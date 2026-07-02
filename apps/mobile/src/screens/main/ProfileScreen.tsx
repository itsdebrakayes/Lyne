import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import api from '../../lib/apiClient';
import { colors, v3 } from '../../lib/mobileV3Styles';
import { MiniTabBar } from './HomeScreen';

const baseRows = [
  ['Notifications', 'Queue & peak-hour alerts', '#f5a623'],
  ['Payment methods', '2 cards', '#2fbf71'],
  ['Account settings', 'Personal info, security', '#7c5cff'],
] as const;

export default function ProfileScreen() {
  const navigation = useNavigation<any>();
  const { user, signOut } = useAuth();
  const { data: history = [] } = useQuery({
    queryKey: ['visit-history-count'],
    queryFn: () => api.get<Array<{ id: string }>>('/history'),
  });
  const name = user?.full_name || 'Andre Campbell';
  const email = user?.email || 'andre.c@email.com';
  const rows = [
    ['Queue history', `${history.length} ${history.length === 1 ? 'visit' : 'visits'}`, '#2176f3', () => navigation.navigate('History')],
    ...baseRows.map(row => [...row, undefined] as const),
  ] as const;
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
          {rows.map(([label, sub, dot, onPress], index) => (
            <TouchableOpacity key={label} disabled={!onPress} onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderBottomWidth: index === rows.length - 1 ? 0 : 1, borderBottomColor: colors.border }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.pill, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: dot }} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>{label}</Text>
                <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>{sub}</Text>
              </View>
              <Ionicons name="chevron-forward" size={17} color={colors.muted} />
            </TouchableOpacity>
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
