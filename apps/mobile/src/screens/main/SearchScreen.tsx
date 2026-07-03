import React, { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, t, initials, statusFromWait, statusMeta } from '../../lib/theme';
import api from '../../lib/apiClient';
import { BranchSummary } from '../../lib/mobileData';
import { TabBar } from '../../components/TabBar';

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
    return branches.filter(b => [b.name, b.business_name, b.city, b.parish].some(v => v?.toLowerCase().includes(term)));
  }, [branches, search]);

  const openBranch = (b: BranchSummary) => navigation.navigate('Branch', { businessId: b.business_id, branchId: b.id, branchName: b.name });

  return (
    <View style={t.root}>
      <ScrollView contentContainerStyle={t.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* search bar */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <TouchableOpacity onPress={() => navigation.navigate('Home')} style={t.iconBtn}><Ionicons name="chevron-back" size={20} color={colors.ink} /></TouchableOpacity>
          <View style={{ flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 23, height: 46, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16 }}>
            <Ionicons name="search-outline" size={16} color={colors.ink} />
            <TextInput autoFocus value={search} onChangeText={setSearch} style={{ flex: 1, fontFamily: font.semibold, fontSize: 14.5, color: colors.ink }} placeholder="Search agencies & branches" placeholderTextColor={colors.muted} />
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
          <Text style={t.section}>Result branches</Text>
          <Text style={{ fontFamily: font.semibold, fontSize: 12.5, color: colors.muted }}>{results.length} found</Text>
        </View>

        {isLoading && <ActivityIndicator color={colors.accent} style={{ marginTop: 32 }} />}
        {!!error && <Text style={{ fontFamily: font.bold, color: colors.danger }}>Search is unavailable while the live service is offline.</Text>}
        {!isLoading && !error && results.length === 0 && <Text style={{ fontFamily: font.semibold, color: colors.muted }}>No matching branches found.</Text>}

        <View style={{ gap: 12 }}>
          {results.map((b, index) => {
            const wait = Math.round(Number(b.avg_wait_minutes || 0));
            const meta = statusMeta(statusFromWait(wait));
            const dark = index === 0;
            const ink = dark ? '#fff' : colors.ink;
            const muted = dark ? 'rgba(255,255,255,.55)' : colors.muted;
            return (
              <TouchableOpacity
                key={b.id}
                activeOpacity={0.9}
                onPress={() => openBranch(b)}
                style={{ backgroundColor: dark ? colors.dark : colors.surface, borderWidth: dark ? 0 : 1, borderColor: colors.border, borderRadius: 22, padding: 17 }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: dark ? '#fff' : colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontFamily: font.extra, fontSize: 12, color: colors.ink }}>{initials(b.business_name)}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={{ fontFamily: font.bold, fontSize: 13.5, color: ink }}>{b.business_name}</Text>
                    <Text numberOfLines={1} style={{ fontFamily: font.medium, fontSize: 11.5, color: muted }}>{[b.city, b.parish].filter(Boolean).join(', ') || 'Location'}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontFamily: font.extra, fontSize: 13, color: dark ? colors.accent : colors.accentDeep }}>~{wait} min</Text>
                    <Text style={{ fontFamily: font.semibold, fontSize: 10.5, color: muted }}>{Number(b.total_waiting || 0)} in line</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14 }}>
                  <Text style={{ flex: 1, fontFamily: font.extra, fontSize: 19, color: ink, letterSpacing: -0.4 }}>{b.name}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: meta.dot }} />
                    <Text style={{ fontFamily: font.bold, fontSize: 11, color: muted }}>{meta.label}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
      <TabBar active="Search" />
    </View>
  );
}
