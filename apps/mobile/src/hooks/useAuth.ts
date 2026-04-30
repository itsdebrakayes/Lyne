import { useState, useEffect, useCallback } from 'react';
import api, { supabase } from '../lib/apiClient';

export interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  national_id?: string;
  trn?: string;
}

export const useAuth = () => {
  const [user, setUser]     = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { user: sbUser } } = await supabase.auth.getUser();
      if (!sbUser) { setUser(null); return; }
      const profile = await api.get<UserProfile>('/auth/me');
      setUser(profile);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => loadProfile());
    return () => subscription.unsubscribe();
  }, [loadProfile]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string, metadata: Record<string, string>) => {
    const { error } = await supabase.auth.signUp({ email, password, options: { data: metadata } });
    if (!error) {
      await api.post('/auth/sync-user', metadata);
    }
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return { user, loading, signIn, signUp, signOut };
};
