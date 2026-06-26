import React from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, v3 } from '../../lib/mobileV3Styles';
import { demoBranches, statusMeta, DemoBranch } from '../../lib/prototypeData';

function MiniTabBar({ active }: { active: 'Home' | 'Search' | 'Saved' | 'Profile' }) {
  const navigation = useNavigation<any>();
  const tabs = [
    ['Home', 'home-outline'],
    ['Search', 'search-outline'],
    ['Saved', 'bookmark-outline'],
    ['Profile', 'person-outline'],
  ] as const;
  return (
    <View style={v3.bottomTabs}>
      {tabs.map(([name, icon]) => {
        const on = active === name;
        return (
          <TouchableOpacity key={name} onPress={() => navigation.navigate(name)} style={on ? v3.tabOn : v3.tabOff}>
            <Ionicons name={icon as any} size={21} color={on ? '#fff' : colors.muted} />
            {on && <Text style={v3.tabOnText}>{name}</Text>}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function BranchRow({ branch, dark = false }: { branch: DemoBranch; dark?: boolean }) {
  const navigation = useNavigation<any>();
  const meta = statusMeta(branch.status);
  const open = () => navigation.navigate('Branch', { businessId: branch.short, branchId: branch.id, branchName: branch.branch });
  if (dark) {
    return (
      <TouchableOpacity activeOpacity={0.86} onPress={open} style={[v3.darkCard, { padding: 20, marginBottom: 26 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={[v3.iconBox, { backgroundColor: 'rgba(255,255,255,.12)' }]}><Text style={[v3.iconText, { color: '#fff' }]}>{branch.mono}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>{branch.agency}</Text>
            <Text style={{ color: 'rgba(255,255,255,.6)', fontSize: 12, fontWeight: '500' }}>{branch.parish} · {branch.distance}</Text>
          </View>
          <Ionicons name="bookmark" size={18} color="#fff" />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: meta.color }} />
          <Text style={{ color: 'rgba(255,255,255,.6)', fontSize: 11, fontWeight: '800', letterSpacing: 0.6 }}>NEAREST BRANCH · LIVE</Text>
        </View>
        <Text style={{ color: '#fff', fontSize: 26, fontWeight: '800', letterSpacing: -0.6, marginTop: 2, marginBottom: 16 }}>{branch.branch}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Text style={{ backgroundColor: 'rgba(255,255,255,.12)', color: '#fff', paddingHorizontal: 13, paddingVertical: 8, borderRadius: 11, fontWeight: '700' }}>~{branch.wait} min wait</Text>
          <Text style={{ backgroundColor: 'rgba(255,255,255,.12)', color: '#fff', paddingHorizontal: 13, paddingVertical: 8, borderRadius: 11, fontWeight: '700' }}>{meta.label} · {branch.people} in line</Text>
        </View>
      </TouchableOpacity>
    );
  }
  return (
    <TouchableOpacity activeOpacity={0.86} onPress={open} style={[v3.card, { padding: 13, flexDirection: 'row', alignItems: 'center', gap: 13, marginBottom: 12 }]}>
      <View style={v3.iconBox}><Text style={v3.iconText}>{branch.mono}</Text></View>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ fontSize: 15.5, fontWeight: '800', color: colors.text }}>{branch.branch}</Text>
        <Text numberOfLines={1} style={{ fontSize: 12.5, color: colors.muted, fontWeight: '500', marginTop: 2 }}>{branch.short} · {branch.parish}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>{branch.wait}m</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: meta.color }} />
          <Text style={{ fontSize: 11, color: colors.muted, fontWeight: '700' }}>{meta.label}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const featured = demoBranches[0];
  const recent = [demoBranches[2], demoBranches[1], demoBranches[4]];

  return (
    <View style={v3.root}>
      <ScrollView contentContainerStyle={v3.content} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <View>
            <Text style={v3.small}>Hello, Andre</Text>
            <Text style={{ fontSize: 15, color: colors.text, fontWeight: '800' }}>Constant Spring, KGN</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Profile')} style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: colors.featured, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>A</Text>
          </TouchableOpacity>
        </View>

        <Text style={[v3.h1, { marginBottom: 20 }]}>Find your{'\n'}shortest wait.</Text>

        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 18 }}>
          <TouchableOpacity onPress={() => navigation.navigate('Search')} style={[v3.search, { flex: 1 }]}>
            <Ionicons name="search-outline" size={18} color={colors.muted} />
            <TextInput editable={false} pointerEvents="none" style={v3.searchText} placeholder="Search agencies..." placeholderTextColor={colors.muted} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Search')} style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: colors.featured, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="options-outline" size={19} color="#fff" />
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 9, marginBottom: 24 }}>
          {['All government', 'Banking', 'Health', 'Utilities'].map((cat, idx) => (
            <View key={cat} style={[v3.chip, idx === 0 && v3.chipActive]}>
              <Text style={[v3.chipText, idx === 0 && v3.chipTextActive]}>{cat}</Text>
            </View>
          ))}
        </ScrollView>

        <BranchRow branch={featured} dark />

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>Recent visits</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Search')}><Text style={{ fontSize: 13, fontWeight: '700', color: colors.muted }}>View all</Text></TouchableOpacity>
        </View>
        {recent.map((branch) => <BranchRow key={branch.id} branch={branch} />)}
      </ScrollView>
      <MiniTabBar active="Home" />
    </View>
  );
}

export { MiniTabBar, BranchRow };
