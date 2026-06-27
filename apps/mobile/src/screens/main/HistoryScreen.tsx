import React from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { colors, v3 } from '../../lib/mobileV3Styles';
import api from '../../lib/apiClient';
import { initials } from '../../lib/mobileData';
import { MiniTabBar } from './HomeScreen';

interface SavedBusiness { id: string; name: string; slug: string; description?: string; }

export default function SavedScreen() {
  const navigation = useNavigation<any>();
  const { data: saved = [], isLoading, error } = useQuery({
    queryKey: ['saved-businesses'],
    queryFn: () => api.get<SavedBusiness[]>('/saved'),
  });

  return (
    <View style={v3.root}>
      <ScrollView contentContainerStyle={v3.content} showsVerticalScrollIndicator={false}>
        <Text style={[v3.h2, { marginBottom: 18 }]}>Saved</Text>
        {isLoading && <ActivityIndicator color={colors.text} style={{ marginTop: 32 }} />}
        {!!error && <Text style={{ color: colors.danger, fontWeight: '700' }}>Saved businesses could not be loaded.</Text>}
        {!isLoading && !error && saved.length === 0 && <Text style={{ color: colors.muted, fontWeight: '600' }}>You have not saved any businesses yet.</Text>}
        {saved.map(business => (
          <TouchableOpacity key={business.id} activeOpacity={0.86} onPress={() => navigation.navigate('Business', { businessId: business.id, businessName: business.name })} style={[v3.card, { padding: 15, flexDirection: 'row', alignItems: 'center', gap: 13, marginBottom: 12 }]}>
            <View style={v3.iconBox}><Text style={v3.iconText}>{initials(business.name)}</Text></View>
            <View style={{ flex: 1 }}><Text style={{ fontSize: 15.5, fontWeight: '800', color: colors.text }}>{business.name}</Text><Text numberOfLines={1} style={{ fontSize: 12, color: colors.muted, marginTop: 3 }}>{business.description || 'View branches and live wait times'}</Text></View>
            <Ionicons name="chevron-forward" size={18} color={colors.text} />
          </TouchableOpacity>
        ))}
      </ScrollView>
      <MiniTabBar active="Saved" />
    </View>
  );
}
