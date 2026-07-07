import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../lib/apiClient';
import { TicketRecord } from '../lib/mobileData';
import { colors, font, shadow } from '../lib/theme';
import { GlassView } from './Glass';

type TabKey = 'Home' | 'Search' | 'Saved' | 'Profile';

// Compact dark pill: icon-only tabs, active icon lifted in a white circle,
// and a cyan center action for the app's core verb — joining a line.
const LEFT_TABS: Array<{ key: TabKey; icon: keyof typeof Ionicons.glyphMap; iconOn: keyof typeof Ionicons.glyphMap }> = [
  { key: 'Home', icon: 'home-outline', iconOn: 'home' },
  { key: 'Search', icon: 'search-outline', iconOn: 'search' },
];
const RIGHT_TABS: Array<{ key: TabKey; icon: keyof typeof Ionicons.glyphMap; iconOn: keyof typeof Ionicons.glyphMap }> = [
  { key: 'Saved', icon: 'bookmark-outline', iconOn: 'bookmark' },
  { key: 'Profile', icon: 'person-outline', iconOn: 'person' },
];

function useActiveTicket() {
  const { data: ticket } = useQuery({
    queryKey: ['active-ticket'],
    queryFn: () => api.get<TicketRecord | null>('/tickets/active'),
    refetchInterval: 8_000,
  });
  if (!ticket || !['waiting', 'called', 'in_service'].includes(ticket.status)) return null;
  return ticket;
}

export function ActiveTicketPill() {
  const navigation = useNavigation<any>();
  const ticket = useActiveTicket();
  if (!ticket) return null;
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
      style={{ position: 'absolute', bottom: 102, left: 16, right: 16, backgroundColor: called ? colors.accent : colors.dark, borderRadius: 21, paddingVertical: 13, paddingHorizontal: 17, flexDirection: 'row', alignItems: 'center', gap: 12, zIndex: 31, ...shadow.hero }}
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

function TabIcon({ tab, active, onPress }: { tab: { key: TabKey; icon: keyof typeof Ionicons.glyphMap; iconOn: keyof typeof Ionicons.glyphMap }; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
      style={{
        width: 46, height: 46, borderRadius: 23,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: active ? '#fff' : 'transparent',
      }}
    >
      <Ionicons name={active ? tab.iconOn : tab.icon} size={20} color={active ? colors.dark : 'rgba(255,255,255,.55)'} />
    </TouchableOpacity>
  );
}

export function TabBar({ active }: { active: TabKey }) {
  const navigation = useNavigation<any>();
  const ticket = useActiveTicket();

  // Center = the live ticket. It only lights cyan when there IS a line to
  // return to; with no active ticket it sits hollow/grey and does nothing
  // (the join journey belongs to Search / the Home hero, not here).
  const hasTicket = Boolean(ticket);
  const centerPress = () => { if (ticket) navigation.navigate('Ticket', { ticketId: ticket.id }); };

  return (
    <>
      {/* Fade scrolling content out before it reaches the floating bar. */}
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(242,243,245,0)', 'rgba(242,243,245,.85)', colors.bg]}
        locations={[0, 0.42, 0.78]}
        style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 140, zIndex: 29 }}
      />
      <ActiveTicketPill />
      <GlassView
        tint="dark"
        intensity={55}
        radius={34}
        style={{
          position: 'absolute', bottom: 24, alignSelf: 'center',
          flexDirection: 'row', alignItems: 'center', gap: 4,
          paddingHorizontal: 10, paddingVertical: 8,
          zIndex: 30, ...shadow.floating,
        }}
      >
        {LEFT_TABS.map(tab => (
          <TabIcon key={tab.key} tab={tab} active={tab.key === active} onPress={() => navigation.navigate(tab.key)} />
        ))}
        <TouchableOpacity
          onPress={centerPress}
          disabled={!hasTicket}
          activeOpacity={hasTicket ? 0.85 : 1}
          style={{
            width: 50, height: 50, borderRadius: 25, marginHorizontal: 3,
            alignItems: 'center', justifyContent: 'center',
            backgroundColor: hasTicket ? colors.accent : 'rgba(255,255,255,0.08)',
            borderWidth: hasTicket ? 0 : 1.5, borderColor: 'rgba(255,255,255,0.22)',
            ...(hasTicket ? { shadowColor: colors.accent, shadowOpacity: 0.55, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 7 } : null),
          }}
        >
          <Ionicons name="ticket" size={21} color={hasTicket ? colors.accentInk : 'rgba(255,255,255,0.4)'} />
        </TouchableOpacity>
        {RIGHT_TABS.map(tab => (
          <TabIcon key={tab.key} tab={tab} active={tab.key === active} onPress={() => navigation.navigate(tab.key)} />
        ))}
      </GlassView>
    </>
  );
}
