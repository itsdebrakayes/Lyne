import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../lib/apiClient';
import { TicketRecord } from '../lib/mobileData';
import { colors, font, shadow } from '../lib/theme';

type TabKey = 'Home' | 'Search' | 'Saved' | 'Profile';

const TABS: Array<{ key: TabKey; label: string; icon: keyof typeof Ionicons.glyphMap; iconOn: keyof typeof Ionicons.glyphMap }> = [
  { key: 'Home', label: 'Home', icon: 'home-outline', iconOn: 'home' },
  { key: 'Search', label: 'Search', icon: 'search-outline', iconOn: 'search' },
  { key: 'Saved', label: 'Saved', icon: 'bookmark-outline', iconOn: 'bookmark' },
  { key: 'Profile', label: 'Account', icon: 'person-outline', iconOn: 'person' },
];

export function ActiveTicketPill() {
  const navigation = useNavigation<any>();
  const { data: ticket } = useQuery({
    queryKey: ['active-ticket'],
    queryFn: () => api.get<TicketRecord | null>('/tickets/active'),
    refetchInterval: 8_000,
  });
  if (!ticket || !['waiting', 'called', 'in_service'].includes(ticket.status)) return null;
  const called = ticket.status === 'called';
  const inService = ticket.status === 'in_service';
  const ahead = Math.max(0, (ticket.waiting_position ?? ticket.position ?? 1) - 1);
  const headline = called
    ? `${ticket.ticket_number} — it's your turn!`
    : inService
      ? `${ticket.ticket_number} · being served`
      : `Ticket ${ticket.ticket_number} · ${ahead} ahead`;
  const sub = called
    ? 'Head to the counter and show your code'
    : `${ticket.branch_name || 'Your branch'} · ~${ticket.estimated_wait_minutes} min`;
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => navigation.navigate('Ticket', { ticketId: ticket.id })}
      style={{ position: 'absolute', bottom: 104, left: 16, right: 16, backgroundColor: called ? colors.accent : colors.dark, borderRadius: 21, paddingVertical: 13, paddingHorizontal: 17, flexDirection: 'row', alignItems: 'center', gap: 12, zIndex: 31, ...shadow.hero }}
    >
      <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: called ? colors.accentInk : colors.light }} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: called ? colors.accentInk : '#fff', fontFamily: font.extra, fontSize: 13 }}>{headline}</Text>
        <Text style={{ color: called ? 'rgba(8,17,15,.65)' : 'rgba(255,255,255,.55)', fontFamily: font.medium, fontSize: 11 }}>{sub}</Text>
      </View>
      <Text style={{ color: called ? colors.accentInk : colors.accent, fontFamily: font.extra, fontSize: 16 }}>›</Text>
    </TouchableOpacity>
  );
}

export function TabBar({ active }: { active: TabKey }) {
  const navigation = useNavigation<any>();
  return (
    <>
      {/* Fade scrolling content out before it reaches the floating bar. */}
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(242,243,245,0)', 'rgba(242,243,245,.92)', colors.bg]}
        locations={[0, 0.42, 0.75]}
        style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 140, zIndex: 29 }}
      />
      <ActiveTicketPill />
      <View style={{ position: 'absolute', bottom: 22, left: 16, right: 16, height: 68, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 26, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 10, zIndex: 30, ...shadow.floating }}>
        {TABS.map(tab => {
          const on = tab.key === active;
          return (
            <TouchableOpacity key={tab.key} onPress={() => navigation.navigate(tab.key)} style={{ alignItems: 'center', gap: 4, width: 64 }}>
              <Ionicons name={on ? tab.iconOn : tab.icon} size={21} color={on ? colors.ink : '#a3aab3'} />
              <Text style={{ fontFamily: font.extra, fontSize: 10, color: on ? colors.ink : '#a3aab3' }}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </>
  );
}
