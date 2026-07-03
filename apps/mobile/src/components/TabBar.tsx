import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
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
  const ahead = ticket.waiting_position ?? ticket.position;
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => navigation.navigate('Ticket', { ticketId: ticket.id })}
      style={{ position: 'absolute', bottom: 100, left: 14, right: 14, backgroundColor: colors.dark, borderRadius: 20, paddingVertical: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12, zIndex: 31, ...shadow.hero }}
    >
      <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: colors.light }} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: '#fff', fontFamily: font.extra, fontSize: 13 }}>Ticket {ticket.ticket_number} · {ahead ?? 0} ahead</Text>
        <Text style={{ color: 'rgba(255,255,255,.55)', fontFamily: font.medium, fontSize: 11 }}>{ticket.branch_name || 'Your branch'} · ~{ticket.estimated_wait_minutes} min</Text>
      </View>
      <Text style={{ color: colors.accent, fontFamily: font.extra, fontSize: 16 }}>›</Text>
    </TouchableOpacity>
  );
}

export function TabBar({ active }: { active: TabKey }) {
  const navigation = useNavigation<any>();
  return (
    <>
      <ActiveTicketPill />
      <View style={{ position: 'absolute', bottom: 20, left: 14, right: 14, height: 66, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 8, zIndex: 30, ...shadow.floating }}>
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
