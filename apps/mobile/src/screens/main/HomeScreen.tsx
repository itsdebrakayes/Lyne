import React from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { colors, v3 } from '../../lib/mobileV3Styles';
import api from '../../lib/apiClient';
import { useAuth } from '../../hooks/useAuth';
import { BranchSummary, initials, queueStatus, statusMeta } from '../../lib/mobileData';

function MiniTabBar({ active }: { active: 'Home' | 'Search' | 'Saved' | 'Profile' }) {
  const navigation = useNavigation<any>();
  const tabs = [['Home', 'home-outline'], ['Search', 'search-outline'], ['Saved', 'time-outline'], ['Profile', 'person-outline']] as const;
  return (
    <View style={v3.bottomTabs}>
      {tabs.map(([name, icon]) => {
        const on = active === name;
        return (
          <TouchableOpacity key={name} onPress={() => navigation.navigate(name)} style={on ? v3.tabOn : v3.tabOff}>
            <Ionicons name={icon} size={21} color={on ? '#fff' : colors.muted} />
            {on && <Text style={v3.tabOnText}>{name === 'Saved' ? 'History' : name}</Text>}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function BranchRow({ branch, dark = false }: { branch: BranchSummary; dark?: boolean }) {
  const navigation = useNavigation<any>();
  const wait = Math.round(Number(branch.avg_wait_minutes || 0));
  const meta = statusMeta(queueStatus(wait));
  const open = () => navigation.navigate('Branch', {
    businessId: branch.business_id,
    branchId: branch.id,
    branchName: branch.name,
  });
  const location = [branch.city, branch.parish].filter(Boolean).join(', ') || 'Location unavailable';

  if (dark) {
    return (
      <TouchableOpacity activeOpacity={0.86} onPress={open} style={[v3.darkCard, { padding: 20, marginBottom: 26 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={[v3.iconBox, { backgroundColor: 'rgba(255,255,255,.12)' }]}><Text style={[v3.iconText, { color: '#fff' }]}>{initials(branch.business_name)}</Text></View>
          <View style={{ flex: 1 }}><Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>{branch.business_name}</Text><Text style={{ color: 'rgba(255,255,255,.6)', fontSize: 12, fontWeight: '500' }}>{location}</Text></View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18 }}><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: meta.color }} /><Text style={{ color: 'rgba(255,255,255,.6)', fontSize: 11, fontWeight: '800' }}>LIVE</Text></View>
        <Text style={{ color: '#fff', fontSize: 26, fontWeight: '800', marginTop: 2, marginBottom: 16 }}>{branch.name}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}><Text style={{ backgroundColor: 'rgba(255,255,255,.12)', color: '#fff', paddingHorizontal: 13, paddingVertical: 8, borderRadius: 11, fontWeight: '700' }}>~{wait} min wait</Text><Text style={{ backgroundColor: 'rgba(255,255,255,.12)', color: '#fff', paddingHorizontal: 13, paddingVertical: 8, borderRadius: 11, fontWeight: '700' }}>{Number(branch.total_waiting || 0)} in line</Text></View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity activeOpacity={0.86} onPress={open} style={[v3.card, { padding: 13, flexDirection: 'row', alignItems: 'center', gap: 13, marginBottom: 12 }]}>
      <View style={v3.iconBox}><Text style={v3.iconText}>{initials(branch.business_name)}</Text></View>
      <View style={{ flex: 1 }}><Text numberOfLines={1} style={{ fontSize: 15.5, fontWeight: '800', color: colors.text }}>{branch.name}</Text><Text numberOfLines={1} style={{ fontSize: 12.5, color: colors.muted, fontWeight: '500', marginTop: 2 }}>{branch.business_name} · {location}</Text></View>
      <View style={{ alignItems: 'flex-end' }}><Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>{wait}m</Text><View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: meta.color }} /><Text style={{ fontSize: 11, color: colors.muted, fontWeight: '700' }}>{meta.label}</Text></View></View>
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { data: branches = [], isLoading, error } = useQuery({
    queryKey: ['mobile-branches'],
    queryFn: () => api.get<BranchSummary[]>('/branches', false),
    refetchInterval: 30_000,
  });
  const sorted = [...branches].sort((a, b) => Number(a.avg_wait_minutes) - Number(b.avg_wait_minutes));
  const featured = sorted[0];

  return (
    <View style={v3.root}>
      <ScrollView contentContainerStyle={v3.content} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}><View><Text style={v3.small}>Hello, {user?.full_name?.split(' ')[0] || 'there'}</Text><Text style={{ fontSize: 15, color: colors.text, fontWeight: '800' }}>Find a branch near you</Text></View><TouchableOpacity onPress={() => navigation.navigate('Profile')} style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: colors.featured, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>{initials(user?.full_name || 'User')}</Text></TouchableOpacity></View>
        <Text style={[v3.h1, { marginBottom: 20 }]}>Find your{`\n`}shortest wait.</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Search')} style={[v3.search, { marginBottom: 24 }]}><Ionicons name="search-outline" size={18} color={colors.muted} /><TextInput editable={false} pointerEvents="none" style={v3.searchText} placeholder="Search businesses and branches" placeholderTextColor={colors.muted} /></TouchableOpacity>
        {isLoading && <ActivityIndicator color={colors.text} style={{ marginTop: 40 }} />}
        {!!error && <Text style={{ color: colors.danger, fontWeight: '700' }}>Live branch data is unavailable. Pull to retry when the service is online.</Text>}
        {!isLoading && !error && !featured && <Text style={{ color: colors.muted, fontWeight: '600' }}>No branches are available yet.</Text>}
        {featured && <BranchRow branch={featured} dark />}
        {sorted.length > 1 && <><Text style={{ fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 14 }}>More branches</Text>{sorted.slice(1, 5).map(branch => <BranchRow key={branch.id} branch={branch} />)}</>}
      </ScrollView>
      <MiniTabBar active="Home" />
    </View>
  );
}

export { MiniTabBar, BranchRow };
