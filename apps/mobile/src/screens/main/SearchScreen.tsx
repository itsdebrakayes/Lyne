import React, { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { colors, v3 } from '../../lib/mobileV3Styles';
import api from '../../lib/apiClient';
import { BranchSummary } from '../../lib/mobileData';
import { BranchRow, MiniTabBar } from './HomeScreen';

export default function SearchScreen() {
  const navigation = useNavigation<any>();
  const [search, setSearch] = useState('');
  const { data: branches = [], isLoading, error } = useQuery({
    queryKey: ['mobile-branches'],
    queryFn: () => api.get<BranchSummary[]>('/branches', false),
    refetchInterval: 30_000,
  });
  const results = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return branches;
    return branches.filter(branch => [branch.name, branch.business_name, branch.city, branch.parish].some(value => value?.toLowerCase().includes(term)));
  }, [branches, search]);

  return (
    <View style={v3.root}>
      <ScrollView contentContainerStyle={v3.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="chevron-back" size={22} color={colors.text} /></TouchableOpacity>
          <View style={[v3.search, { flex: 1, height: 46, borderRadius: 14 }]}><Ionicons name="search-outline" size={17} color={colors.text} /><TextInput autoFocus value={search} onChangeText={setSearch} style={v3.searchText} placeholder="Search branches" placeholderTextColor={colors.muted} /></View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}><Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>Search results</Text><Text style={v3.small}>{results.length} branches</Text></View>
        {isLoading && <ActivityIndicator color={colors.text} style={{ marginTop: 32 }} />}
        {!!error && <Text style={{ color: colors.danger, fontWeight: '700' }}>Search is unavailable while the live service is offline.</Text>}
        {!isLoading && !error && results.length === 0 && <Text style={{ color: colors.muted, fontWeight: '600' }}>No matching branches found.</Text>}
        {results.map((branch, index) => <BranchRow key={branch.id} branch={branch} dark={index === 0} />)}
      </ScrollView>
      <MiniTabBar active="Search" />
    </View>
  );
}
