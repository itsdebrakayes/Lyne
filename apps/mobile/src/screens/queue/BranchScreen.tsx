import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, v3 } from '../../lib/mobileV3Styles';
import { getBranch, statusMeta } from '../../lib/prototypeData';

export default function BranchScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const branch = getBranch(route.params?.branchId);
  const meta = statusMeta(branch.status);

  return (
    <View style={v3.root}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={{ backgroundColor: colors.featured, paddingTop: 60, paddingHorizontal: 20, paddingBottom: 26, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,.12)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>Branch details</Text>
            <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,.12)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="bookmark" size={18} color="#fff" />
            </View>
          </View>

          <View style={{ alignItems: 'center', marginTop: 18 }}>
            <View style={{ width: 78, height: 78, borderRadius: 24, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
              <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800' }}>{branch.mono}</Text>
            </View>
            <Text style={{ color: 'rgba(255,255,255,.6)', fontSize: 13, fontWeight: '600' }}>{branch.agency}</Text>
            <Text style={{ color: '#fff', fontSize: 24, fontWeight: '800', letterSpacing: -0.5, marginTop: 2 }}>{branch.branch}</Text>
            <Text style={{ color: 'rgba(255,255,255,.6)', fontSize: 13, marginTop: 3 }}>{branch.parish} · {branch.distance} away</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
              <Text style={{ backgroundColor: 'rgba(255,255,255,.12)', color: '#fff', paddingHorizontal: 13, paddingVertical: 8, borderRadius: 11, fontWeight: '700' }}>~{branch.wait} min wait</Text>
              <Text style={{ backgroundColor: 'rgba(255,255,255,.12)', color: '#fff', paddingHorizontal: 13, paddingVertical: 8, borderRadius: 11, fontWeight: '700' }}>● {meta.label}</Text>
            </View>
          </View>
        </View>

        <View style={{ paddingHorizontal: 20, paddingTop: 22, paddingBottom: 150 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>Services & lines</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.success }} />
              <Text style={{ fontSize: 12, fontWeight: '800', color: colors.muted }}>LIVE</Text>
            </View>
          </View>

          {branch.services.map((service) => {
            const serviceMeta = statusMeta(service.status);
            return (
              <TouchableOpacity
                key={service.id}
                activeOpacity={0.85}
                style={[v3.card, { padding: 16, marginBottom: 12 }]}
                onPress={() => navigation.navigate('JoinQueue', { businessId: branch.short, branchId: branch.id, serviceId: service.id, serviceName: service.name })}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 15.5, fontWeight: '800', color: colors.text }}>{service.name}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.pill, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 9 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: serviceMeta.color }} />
                    <Text style={{ fontSize: 11, fontWeight: '800', color: colors.text }}>{serviceMeta.label}</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20, marginTop: 13 }}>
                  {[
                    [`${service.wait}m`, 'est. wait'],
                    [String(service.people), 'in line'],
                    [String(service.lines), 'open lines'],
                  ].map(([value, label]) => (
                    <View key={label}>
                      <Text style={{ fontSize: 19, fontWeight: '800', color: colors.text }}>{value}</Text>
                      <Text style={{ fontSize: 11, color: colors.muted, fontWeight: '600' }}>{label}</Text>
                    </View>
                  ))}
                  <View style={{ marginLeft: 'auto', width: 34, height: 34, borderRadius: 11, backgroundColor: colors.pill, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="chevron-forward" size={18} color={colors.text} />
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity style={[v3.darkCard, { padding: 18, marginTop: 2, flexDirection: 'row', alignItems: 'center', gap: 14 }]}>
            <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: 'rgba(255,255,255,.12)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="time-outline" size={21} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: 'rgba(255,255,255,.6)', fontSize: 10.5, fontWeight: '800', letterSpacing: 1 }}>PREMIUM · SMART TIMING</Text>
              <Text style={{ color: '#fff', fontSize: 15.5, fontWeight: '800', marginTop: 3 }}>Best time to visit</Text>
              <Text style={{ color: 'rgba(255,255,255,.6)', fontSize: 12 }}>Quietest window today · 2:30-3:30 PM · ~6m</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </ScrollView>

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 20, paddingBottom: 26, backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: 'row', gap: 12 }}>
        <TouchableOpacity style={[v3.secondaryButton, { width: 56 }]}><Ionicons name="bookmark" size={18} color={colors.text} /></TouchableOpacity>
        <TouchableOpacity style={[v3.primaryButton, { flex: 1 }]} onPress={() => {
          const first = branch.services[0];
          navigation.navigate('JoinQueue', { businessId: branch.short, branchId: branch.id, serviceId: first.id, serviceName: first.name });
        }}>
          <Text style={v3.primaryButtonText}>Join the queue · ~{branch.wait}m →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
