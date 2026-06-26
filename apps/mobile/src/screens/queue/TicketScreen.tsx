import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { colors, v3 } from '../../lib/mobileV3Styles';
import { getBranch, getService } from '../../lib/prototypeData';
import api from '../../lib/apiClient';

const barcode = [3,1,2,1,4,1,1,3,2,1,1,2,4,1,2,1,3,1,1,2,1,4,2,1,3,1,2,1,1,4,1,2,3,1,1,2,1,3,2,1,4,1,2,1,3,1,1,2,4,1,2,1,1,3];

export default function TicketScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState('');
  const branch = getBranch(route.params?.branchId);
  const service = getService(branch.id, route.params?.serviceId);
  const liveTicket = route.params?.ticket;
  const ticketNo = liveTicket?.ticket_number || (service.id === 'tax-payment' ? 'B-43' : 'B-40');
  const nowServing = service.id === 'tax-payment' ? 'B-39' : 'B-37';
  const position = liveTicket?.position || Math.max(2, service.people - 1);
  const wait = liveTicket?.estimated_wait_minutes ?? service.wait;
  const verificationCode = liveTicket?.verification_code || `0x${branch.short.toLowerCase()}F3Bd9e4007E`;

  const leaveQueue = async () => {
    if (!liveTicket?.id) {
      navigation.navigate('Main');
      return;
    }
    try {
      setLeaving(true);
      setError('');
      await api.put(`/tickets/${liveTicket.id}/leave`, {});
      navigation.navigate('Main');
    } catch (err: any) {
      setError(err?.message || 'Could not leave this queue.');
    } finally {
      setLeaving(false);
    }
  };

  return (
    <View style={v3.root}>
      <ScrollView contentContainerStyle={[v3.content, { paddingBottom: 36 }]} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <Text style={v3.label}>YOUR TICKET</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Main')} style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 13, paddingHorizontal: 15, paddingVertical: 9 }}>
            <Text style={{ color: colors.text, fontSize: 13, fontWeight: '800' }}>Minimise</Text>
          </TouchableOpacity>
        </View>

        <View style={{ backgroundColor: colors.featured, borderRadius: 30, overflow: 'hidden' }}>
          <View style={{ padding: 28, alignItems: 'center' }}>
            <Text style={{ color: 'rgba(255,255,255,.6)', fontSize: 13, fontWeight: '600' }}>{branch.agency}</Text>
            <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 3 }}>{branch.branch}</Text>
            <Text style={{ color: 'rgba(255,255,255,.6)', fontSize: 13, marginTop: 14 }}>{service.name}</Text>
            <Text style={{ color: '#fff', fontSize: 72, fontWeight: '800', letterSpacing: -3, lineHeight: 82, marginVertical: 6 }}>{ticketNo}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,.12)', paddingHorizontal: 15, paddingVertical: 9, borderRadius: 13 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success }} />
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>Now serving {nowServing}</Text>
            </View>
            <View style={{ flexDirection: 'row', marginTop: 24 }}>
              {[
                [String(position), 'ahead of you'],
                [`${wait}m`, 'active wait'],
                ['5m', 'to branch'],
              ].map(([value, label], index) => (
                <View key={label} style={{ flex: 1, alignItems: 'center', borderLeftWidth: index === 0 ? 0 : 1, borderLeftColor: 'rgba(255,255,255,.12)' }}>
                  <Text style={{ color: '#fff', fontSize: 24, fontWeight: '800' }}>{value}</Text>
                  <Text style={{ color: 'rgba(255,255,255,.6)', fontSize: 11, fontWeight: '700', marginTop: 5 }}>{label}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={{ height: 2, marginHorizontal: 18, borderStyle: 'dashed', borderTopWidth: 2, borderTopColor: 'rgba(255,255,255,.2)' }} />

          <View style={{ padding: 26, alignItems: 'center' }}>
            <Text style={{ color: 'rgba(255,255,255,.6)', fontSize: 13, fontWeight: '700', letterSpacing: 1, marginBottom: 16 }}>{verificationCode}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'stretch', justifyContent: 'center', gap: 2, height: 62 }}>
              {barcode.map((width, index) => <View key={`${width}-${index}`} style={{ width, borderRadius: 1, backgroundColor: index % 9 === 4 ? 'transparent' : '#fff' }} />)}
            </View>
            <Text style={{ color: 'rgba(255,255,255,.55)', fontSize: 12, fontWeight: '700', marginTop: 16 }}>Show at registration to confirm it is you</Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
          <TouchableOpacity onPress={() => navigation.navigate('Main')} style={[v3.primaryButton, { flex: 1 }]}>
            <Text style={v3.primaryButtonText}>Notify me</Text>
          </TouchableOpacity>
          <TouchableOpacity disabled={leaving} onPress={leaveQueue} style={[v3.secondaryButton, { flex: 1 }]}>
            {leaving ? <ActivityIndicator color={colors.danger} /> : <Text style={{ color: colors.danger, fontSize: 15, fontWeight: '800' }}>Leave queue</Text>}
          </TouchableOpacity>
        </View>
        {!!error && <Text style={{ color: colors.danger, fontWeight: '700', marginTop: 14 }}>{error}</Text>}
      </ScrollView>
    </View>
  );
}
