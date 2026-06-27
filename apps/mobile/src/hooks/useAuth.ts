import { useState, useEffect, useCallback } from 'react';
import api, { supabase } from '../lib/apiClient';

export interface UserProfile {
  id: string;
  supabase_uid?: string;
  full_name: string;
  email: string;
  phone?: string;
  national_id?: string;
  trn?: string;
}

interface AuthMe {
  type: 'user' | 'staff';
  record: UserProfile;
}

export const useAuth = () => {
  const [user, setUser]     = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const syncMobileUser = useCallback(async (metadata?: Record<string, string>) => {
    await api.post('/auth/sync-user', metadata || {});
    const me = await api.get<AuthMe>('/auth/me');
    if (me.type !== 'user') {
      await supabase.auth.signOut();
      setUser(null);
      throw new Error('This account is provisioned for admin access, not the mobile app.');
    }
    setUser(me.record);
    return me.record;
  }, []);

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { user: sbUser } } = await supabase.auth.getUser();
      if (!sbUser) { setUser(null); return; }
      await syncMobileUser(sbUser.user_metadata as Record<string, string> | undefined);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [syncMobileUser]);

  useEffect(() => {
    loadProfile();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => loadProfile());
    return () => subscription.unsubscribe();
  }, [loadProfile]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) {
      try {
        await syncMobileUser();
      } catch (syncError) {
        return { error: syncError as Error };
      }
    }
    return { error };
  };

  const signUp = async (email: string, password: string, nameOrMeta: string | Record<string, string>) => {
    const metadata: Record<string, string> = typeof nameOrMeta === 'string'
      ? { full_name: nameOrMeta }
      : nameOrMeta;
    const { error } = await supabase.auth.signUp({ email, password, options: { data: metadata } });
    if (!error) {
      try {
        await syncMobileUser(metadata);
      } catch (syncError) {
        return { error: syncError as Error };
      }
    }
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return { user, loading, signIn, signUp, signOut };
};
