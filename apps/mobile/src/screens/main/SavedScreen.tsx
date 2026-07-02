import React from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { colors, v3 } from '../../lib/mobileV3Styles';
import api from '../../lib/apiClient';
import { SavedBusiness, initials } from '../../lib/mobileData';
import { MiniTabBar } from './HomeScreen';

export default function SavedScreen() {
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const { data: saved = [], isLoading, error } = useQuery({
    queryKey: ['saved-businesses'],
    queryFn: () => api.get<SavedBusiness[]>('/saved'),
  });

  const unsave = useMutation({
    mutationFn: (businessId: string) => api.delete(`/saved/${businessId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['saved-businesses'] }),
  });

  return (
    <View style={v3.root}>
      <ScrollView contentContainerStyle={v3.content} showsVerticalScrollIndicator={false}>
        <Text style={[v3.h2, { marginBottom: 6 }]}>Saved</Text>
        <Text style={[v3.small, { marginBottom: 18 }]}>Your favourite businesses, one tap from the line.</Text>
        {isLoading && <ActivityIndicator color={colors.text} style={{ marginTop: 32 }} />}
        {!!error && <Text style={{ color: colors.danger, fontWeight: '700' }}>Saved businesses could not be loaded.</Text>}
        {!isLoading && !error && saved.length === 0 && (
          <View style={[v3.card, { padding: 22, alignItems: 'center' }]}>
            <Ionicons name="bookmark-outline" size={30} color={colors.muted} />
            <Text style={{ color: colors.text, fontWeight: '800', fontSize: 15, marginTop: 12 }}>Nothing saved yet</Text>
            <Text style={{ color: colors.muted, fontWeight: '600', fontSize: 12.5, textAlign: 'center', marginTop: 6 }}>
              Save a business from its page to keep it here for quick queueing.
            </Text>
            <TouchableOpacity style={[v3.primaryButton, { marginTop: 16 }]} onPress={() => navigation.navigate('Search')}>
              <Text style={v3.primaryButtonText}>Explore businesses</Text>
            </TouchableOpacity>
          </View>
        )}
        {saved.map(business => (
          <TouchableOpacity
            key={business.id}
            activeOpacity={0.86}
            onPress={() => navigation.navigate('Business', { businessId: business.id, businessName: business.name })}
            style={[v3.card, { padding: 15, flexDirection: 'row', alignItems: 'center', gap: 13, marginBottom: 12 }]}
          >
            <View style={v3.iconBox}><Text style={v3.iconText}>{initials(business.name)}</Text></View>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={{ fontSize: 15.5, fontWeight: '800', color: colors.text }}>{business.name}</Text>
              {!!business.description && <Text numberOfLines={1} style={{ fontSize: 12, color: colors.muted, marginTop: 3 }}>{business.description}</Text>}
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={`Remove ${business.name} from saved`}
              disabled={unsave.isPending}
              onPress={() => unsave.mutate(business.id)}
              style={{ padding: 8 }}
            >
              <Ionicons name="bookmark" size={20} color={colors.text} />
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <MiniTabBar active="Saved" />
    </View>
  );
}
