import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import api from '../../lib/apiClient';
import { brandGradient, colors, shadow, v3 } from '../../lib/mobileV3Styles';
import { MiniTabBar } from './HomeScreen';

const baseRows = [
  ['Notifications', 'Queue & peak-hour alerts', '#f5a623'],
  ['Payment methods', '2 cards', '#2fbf71'],
  ['Account settings', 'Personal info, security', '#7b5fff'],
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
    ['Queue history', `${history.length} ${history.length === 1 ? 'visit' : 'visits'}`, '#7b5fff', () => navigation.navigate('History')],
    ...baseRows.map(row => [...row, undefined] as const),
  ] as const;
  return (
    <View style={v3.root}>
      <ScrollView contentContainerStyle={v3.content} showsVerticalScrollIndicator={false}>
        <Text style={[v3.h2, { marginBottom: 18 }]}>Profile</Text>
        <LinearGradient colors={brandGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[{ borderRadius: 28, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 15 }, shadow.brand]}>
          <View style={{ width: 62, height: 62, borderRadius: 20, backgroundColor: 'rgba(255,255,255,.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,.25)', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 24, fontWeight: '800' }}>{name[0]}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontSize: 19, fontWeight: '800' }}>{name}</Text>
            <Text style={{ color: 'rgba(255,255,255,.75)', fontSize: 13 }}>{email}</Text>
          </View>
        </LinearGradient>

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
