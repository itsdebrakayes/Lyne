import React, { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, t, initials, statusFromWait, statusMeta } from '../../lib/theme';
import api from '../../lib/apiClient';
import { BranchSummary, SavedBusiness, ServiceSummary } from '../../lib/mobileData';
import { RootStackParamList } from '../../navigation/AppNavigator';

type Params = RouteProp<RootStackParamList, 'Branch'>;
const TRAVEL_DEFAULT_MIN = 10;

function ServiceStat({ value, unit, label, accent }: { value: React.ReactNode; unit?: string; label: string; accent?: boolean }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ fontFamily: font.extra, fontSize: 22, color: accent ? colors.accentDeep : colors.ink }}>{value}{unit ? <Text style={{ fontSize: 12 }}>{unit}</Text> : null}</Text>
      <Text style={{ fontFamily: font.bold, fontSize: 10.5, color: colors.muted, marginTop: 5 }}>{label}</Text>
    </View>
  );
}

export default function BranchScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<Params>();
  const queryClient = useQueryClient();
  const { businessId, branchId, branchName } = route.params;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const branchQuery = useQuery({ queryKey: ['branch', branchId], queryFn: () => api.get<BranchSummary>(`/branches/${branchId}`, false) });
  const servicesQuery = useQuery({
    queryKey: ['branch-services', businessId, branchId],
    queryFn: () => api.get<ServiceSummary[]>(`/services?business_id=${businessId}&branch_id=${branchId}`, false),
    refetchInterval: 20_000,
  });
  const { data: saved = [] } = useQuery({ queryKey: ['saved-businesses'], queryFn: () => api.get<SavedBusiness[]>('/saved') });

  const branch = branchQuery.data;
  const services = servicesQuery.data || [];
  const selected = useMemo(() => services.find(s => s.id === selectedId) || services[0], [services, selectedId]);
  const others = services.filter(s => s.id !== selected?.id);
  const isSaved = saved.some(b => b.id === businessId);

  const toggleSave = useMutation({
    mutationFn: () => (isSaved ? api.delete(`/saved/${businessId}`) : api.post(`/saved/${businessId}`, {})),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['saved-businesses'] }),
  });

  // A live average of 0 (no served visits yet today) falls back to the
  // service's base estimate so the screen never advertises a 0-minute wait.
  const svcWait = (s: ServiceSummary) => Math.round(Number(s.avg_wait_minutes || s.base_avg_time_minutes || 0));
  const leaveIn = (s: ServiceSummary) => Math.max(0, svcWait(s) - TRAVEL_DEFAULT_MIN);
  const join = (s?: ServiceSummary) => {
    if (!s) return;
    navigation.navigate('JoinQueue', { businessId, branchId, serviceId: s.id, serviceName: s.name });
  };

  return (
    <View style={t.root}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 58, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* top bar */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={t.iconBtn}><Ionicons name="chevron-back" size={20} color={colors.ink} /></TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontFamily: font.bold, fontSize: 12, color: colors.muted }}>Now</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 1 }}>
              <Ionicons name="location" size={11} color={colors.ink} />
              <Text style={{ fontFamily: font.extra, fontSize: 13, color: colors.ink }}>{branch?.name || branchName}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => toggleSave.mutate()} disabled={toggleSave.isPending} style={t.iconBtn}>
            <Ionicons name={isSaved ? 'bookmark' : 'bookmark-outline'} size={18} color={colors.ink} />
          </TouchableOpacity>
        </View>

        {/* business heading */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 9 }}>
          <View style={{ width: 38, height: 38, borderRadius: 13, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: font.extra, fontSize: 11, color: colors.ink }}>{initials(branch?.business_name)}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.light }} />
            <Text style={{ fontFamily: font.bold, fontSize: 12, color: colors.muted }}>Live queue · open now</Text>
          </View>
        </View>
        <Text style={[t.h1, { marginBottom: 18 }]}>{branch?.business_name || 'Agency'}</Text>

        {servicesQuery.isLoading && <ActivityIndicator color={colors.accent} style={{ marginTop: 30 }} />}
        {!servicesQuery.isLoading && services.length === 0 && (
          <View style={[t.cardLg, { padding: 22, alignItems: 'center' }]}>
            <Ionicons name="time-outline" size={28} color={colors.muted} />
            <Text style={{ fontFamily: font.extra, fontSize: 15, color: colors.ink, marginTop: 12 }}>No open services right now</Text>
            <Text style={{ fontFamily: font.medium, fontSize: 12.5, color: colors.muted, textAlign: 'center', marginTop: 6 }}>This branch has no live queues at the moment. Check back a little later.</Text>
          </View>
        )}

        {selected && (
          <>
            {/* service picker card */}
            <View style={[t.cardLg, { padding: 16 }]}>
              <TouchableOpacity onPress={() => setPickerOpen(o => !o)} style={{ backgroundColor: colors.fieldBg, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 13, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ minWidth: 0, flex: 1 }}>
                  <Text style={{ fontFamily: font.extra, fontSize: 10.5, color: colors.muted, letterSpacing: 0.4, textTransform: 'uppercase' }}>Choose your service</Text>
                  <Text numberOfLines={1} style={{ fontFamily: font.extra, fontSize: 16, color: colors.ink, marginTop: 2 }}>{selected.name}</Text>
                </View>
                <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={pickerOpen ? 'chevron-up' : 'chevron-down'} size={15} color="#fff" />
                </View>
              </TouchableOpacity>

              {pickerOpen && (
                <View style={{ marginTop: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 6, gap: 3 }}>
                  {services.map(s => {
                    const on = s.id === selected.id;
                    const meta = statusMeta(statusFromWait(svcWait(s)));
                    return (
                      <TouchableOpacity key={s.id} onPress={() => { setSelectedId(s.id); setPickerOpen(false); }} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 11, borderRadius: 11, backgroundColor: on ? colors.surfaceAlt : 'transparent' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
                          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: meta.dot }} />
                          <Text style={{ fontFamily: font.bold, fontSize: 14, color: colors.ink }}>{s.name}</Text>
                        </View>
                        <Text style={{ fontFamily: font.extra, fontSize: 12.5, color: colors.muted }}>~{svcWait(s)}m</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              <View style={{ flexDirection: 'row', marginVertical: 16, marginBottom: 4 }}>
                <ServiceStat value={Number(selected.waiting_count || 0)} label="in line" />
                <View style={{ width: 1, backgroundColor: colors.border }} />
                <ServiceStat value={`~${svcWait(selected)}`} unit="m" label="est. wait" />
                <View style={{ width: 1, backgroundColor: colors.border }} />
                <ServiceStat value={leaveIn(selected)} unit="m" label="leave in" accent />
              </View>

              <TouchableOpacity onPress={() => join(selected)} style={{ backgroundColor: colors.dark, borderRadius: 18, height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 20, paddingRight: 8, marginTop: 14 }}>
                <Text style={{ fontFamily: font.extra, fontSize: 15.5, color: '#fff' }}>Join this queue · ~{svcWait(selected)}m</Text>
                <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: colors.accentInk, fontFamily: font.extra, fontSize: 17 }}>→</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* leave-in note */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: '#eef8fb', borderWidth: 1, borderColor: '#dbeef4', borderRadius: 18, padding: 13, paddingHorizontal: 15, marginTop: 14 }}>
              <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="time-outline" size={17} color={colors.accentDeep} />
              </View>
              <Text style={{ flex: 1, fontFamily: font.semibold, fontSize: 12.5, color: '#0d5c6e', lineHeight: 17 }}>Leave in <Text style={{ fontFamily: font.extra }}>~{leaveIn(selected)} min</Text> to reach the front on time — we&apos;ll remind you once you join.</Text>
            </View>

            {/* premium best-time teaser */}
            <View style={{ backgroundColor: colors.dark, borderRadius: 20, padding: 15, marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 13 }}>
              <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: 'rgba(255,255,255,.1)', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="sparkles-outline" size={19} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: font.extra, fontSize: 10, color: colors.accent, letterSpacing: 0.8 }}>PREMIUM · SMART TIMING</Text>
                <Text style={{ fontFamily: font.extra, fontSize: 14.5, color: '#fff', marginTop: 2 }}>Best time to visit</Text>
              </View>
            </View>

            {/* other services */}
            {others.length > 0 && (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 13 }}>
                  <Text style={t.section}>Other services</Text>
                  <Text style={{ fontFamily: font.semibold, fontSize: 12.5, color: colors.muted }}>{others.length} available</Text>
                </View>
                <View style={{ gap: 12 }}>
                  {others.map(s => {
                    const meta = statusMeta(statusFromWait(svcWait(s)));
                    return (
                      <TouchableOpacity key={s.id} activeOpacity={0.85} onPress={() => setSelectedId(s.id)} style={[t.card, { padding: 16, borderRadius: 22 }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Text style={{ fontFamily: font.extra, fontSize: 15, color: colors.ink }}>{s.name}</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surfaceAlt, borderRadius: 14, paddingVertical: 5, paddingHorizontal: 10 }}>
                            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: meta.dot }} />
                            <Text style={{ fontFamily: font.extra, fontSize: 10.5, color: colors.sub }}>{meta.label}</Text>
                          </View>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 }}>
                          <View style={{ alignItems: 'center' }}>
                            <Text style={{ fontFamily: font.extra, fontSize: 18, color: colors.ink }}>{Number(s.waiting_count || 0)}</Text>
                            <Text style={{ fontFamily: font.bold, fontSize: 9.5, color: colors.muted, marginTop: 3 }}>in line</Text>
                          </View>
                          <View style={{ flex: 1, height: 2, borderRadius: 1, backgroundColor: '#e0e3e8' }} />
                          <View style={{ alignItems: 'center' }}>
                            <Text style={{ fontFamily: font.extra, fontSize: 18, color: colors.ink }}>~{svcWait(s)}<Text style={{ fontSize: 11, color: colors.muted }}>m</Text></Text>
                            <Text style={{ fontFamily: font.bold, fontSize: 9.5, color: colors.muted, marginTop: 3 }}>est. wait</Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
