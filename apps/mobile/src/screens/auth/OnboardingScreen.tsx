/**
 * OnboardingScreen.tsx
 *
 * Shown to new users after signup.
 * Lets them select ≥1 preferred businesses to save to their profile.
 * On completion, navigates to the Main tab navigator.
 */
import React, { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/apiClient';

interface Business {
  id: string;
  name: string;
  description?: string;
  slug: string;
}

export default function OnboardingScreen() {
  const navigation    = useNavigation<any>();
  const queryClient   = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: businesses = [], isLoading } = useQuery({
    queryKey: ['businesses-onboarding'],
    queryFn:  () => api.get<Business[]>('/businesses', false),
  });

  const saveMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map(id => api.post(`/saved/${id}`, {})));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-businesses'] });
      navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    },
    onError: () => {
      Alert.alert('Error', 'Could not save preferences. You can add favourites later.');
      navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    },
  });

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleContinue = () => {
    if (selected.size === 0) {
      navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
      return;
    }
    saveMutation.mutate(Array.from(selected));
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color="#fff" size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Choose Your Favourites</Text>
        <Text style={styles.subtitle}>
          Select the businesses you visit most often.{'\n'}
          You can always change this later.
        </Text>
      </View>

      <FlatList
        data={businesses}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const isSelected = selected.has(item.id);
          return (
            <TouchableOpacity
              style={[styles.card, isSelected && styles.cardSelected]}
              onPress={() => toggle(item.id)}
              activeOpacity={0.75}
            >
              <View style={styles.cardInner}>
                <Text style={styles.cardName}>{item.name}</Text>
                {item.description ? (
                  <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
                ) : null}
              </View>
              {isSelected && (
                <View style={styles.checkCircle}>
                  <Text style={styles.checkMark}>✓</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        }}
      />

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.button, selected.size === 0 && styles.buttonSecondary]}
          onPress={handleContinue}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending
            ? <ActivityIndicator color="#000" />
            : <Text style={[styles.buttonText, selected.size === 0 && styles.buttonTextSecondary]}>
                {selected.size === 0 ? 'Skip for now' : `Continue (${selected.size} selected)`}
              </Text>
          }
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:         { flex: 1, backgroundColor: '#0a0a0a' },
  center:            { justifyContent: 'center', alignItems: 'center' },
  header:            { padding: 24, paddingTop: 60 },
  title:             { fontSize: 26, fontWeight: '700', color: '#fff', marginBottom: 8 },
  subtitle:          { fontSize: 15, color: 'rgba(255,255,255,0.5)', lineHeight: 22 },
  list:              { padding: 16, gap: 12 },
  card:              { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 16,
                       flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  cardSelected:      { borderColor: 'rgba(255,255,255,0.4)', backgroundColor: 'rgba(255,255,255,0.1)' },
  cardInner:         { flex: 1 },
  cardName:          { fontSize: 16, fontWeight: '600', color: '#fff', marginBottom: 4 },
  cardDesc:          { fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 18 },
  checkCircle:       { width: 28, height: 28, borderRadius: 14, backgroundColor: '#fff',
                       justifyContent: 'center', alignItems: 'center', marginLeft: 12 },
  checkMark:         { color: '#000', fontWeight: '700', fontSize: 14 },
  footer:            { padding: 20, paddingBottom: 36 },
  button:            { backgroundColor: '#fff', borderRadius: 14, padding: 16, alignItems: 'center' },
  buttonSecondary:   { backgroundColor: 'transparent', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  buttonText:        { color: '#000', fontWeight: '700', fontSize: 16 },
  buttonTextSecondary: { color: 'rgba(255,255,255,0.6)' },
});
