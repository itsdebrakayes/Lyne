import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAuth } from '../../hooks/useAuth';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  return (
    <View style={styles.container}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{user?.full_name?.slice(0, 2).toUpperCase() || 'ME'}</Text>
      </View>
      <Text style={styles.name}>{user?.full_name || 'User'}</Text>
      <Text style={styles.email}>{user?.email}</Text>
      <TouchableOpacity style={styles.signOutBtn} onPress={signOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', paddingTop: 80 },
  avatar:       { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  avatarText:   { color: '#fff', fontSize: 28, fontWeight: '700' },
  name:         { color: '#fff', fontSize: 20, fontWeight: '700' },
  email:        { color: 'rgba(255,255,255,0.4)', fontSize: 14, marginTop: 4, marginBottom: 40 },
  signOutBtn:   { borderWidth: 1, borderColor: 'rgba(248,113,113,0.3)', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 40 },
  signOutText:  { color: '#f87171', fontWeight: '600', fontSize: 15 },
});
