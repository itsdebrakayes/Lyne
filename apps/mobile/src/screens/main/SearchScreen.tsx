import React, { useState } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/apiClient';

interface Business { id: string; name: string; description?: string; primary_color?: string; }

export default function SearchScreen() {
  const nav = useNavigation<any>();
  const [query, setQuery] = useState('');

  const { data: businesses = [], isLoading } = useQuery({
    queryKey: ['businesses', query],
    queryFn: () => api.get<Business[]>(`/businesses${query ? `?search=${encodeURIComponent(query)}` : ''}`, false),
    staleTime: 30_000,
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Find a Business</Text>
      <TextInput
        style={styles.searchInput}
        value={query}
        onChangeText={setQuery}
        placeholder="Search businesses…"
        placeholderTextColor="rgba(255,255,255,0.3)"
      />
      {isLoading ? (
        <ActivityIndicator color="#fff" style={{ marginTop: 32 }} />
      ) : (
        <FlatList
          data={businesses}
          keyExtractor={b => b.id}
          contentContainerStyle={{ paddingBottom: 32 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => nav.navigate('Business', { businessId: item.id, businessName: item.name })}
            >
              <View style={[styles.icon, { backgroundColor: item.primary_color ? `${item.primary_color}33` : 'rgba(255,255,255,0.08)' }]}>
                <Text style={styles.iconText}>{item.name.slice(0, 2).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                {item.description && <Text style={styles.desc} numberOfLines={1}>{item.description}</Text>}
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#0a0a0a', paddingHorizontal: 20, paddingTop: 60 },
  title:       { fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 16 },
  searchInput: { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13, color: '#fff', fontSize: 15, marginBottom: 20 },
  card:        { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 14, marginBottom: 10 },
  icon:        { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  iconText:    { color: '#fff', fontWeight: '700', fontSize: 14 },
  name:        { color: '#fff', fontSize: 15, fontWeight: '600' },
  desc:        { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 },
});
