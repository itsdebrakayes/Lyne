/**
 * useAuth.ts
 *
 * Authentication hook for Q ME NOW.
 *
 * - Uses the shared Supabase client (from integrations/supabase/client.ts)
 *   for ALL auth operations — no more duplicate client with hardcoded keys.
 * - After every successful signup or first login, calls POST /api/auth/sync-user
 *   to ensure the MySQL users table has a matching record.
 * - Exposes the MySQL user/staff record as `dbUser` / `dbStaff`.
 */

import { useState, useEffect, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import api from '@/lib/apiClient';

interface DbUser {
  id: string;
  supabase_uid: string;
  email: string;
  full_name: string;
  phone?: string;
  national_id?: string;
  trn?: string;
  created_at: string;
}

interface DbStaff {
  id: string;
  supabase_uid: string;
  email: string;
  full_name: string;
  staff_code: string;
  role_name: 'line_staff' | 'manager' | 'executive';
  role_label: string;
  business_id: string;
  branch_id?: string;
}

interface AuthMe {
  type: 'user' | 'staff';
  record: DbUser | DbStaff;
}

export const useAuth = () => {
  const [user,     setUser]     = useState<User | null>(null);
  const [session,  setSession]  = useState<Session | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [dbUser,   setDbUser]   = useState<DbUser | null>(null);
  const [dbStaff,  setDbStaff]  = useState<DbStaff | null>(null);

  // After Supabase auth succeeds, sync to MySQL and fetch the DB record
  const syncToMySQL = useCallback(async (profileData?: {
    full_name?: string;
    phone?: string;
    national_id?: string;
    trn?: string;
    date_of_birth?: string;
  }) => {
    try {
      await api.post('/auth/sync-user', profileData || {});
      const me = await api.get<AuthMe>('/auth/me');
      if (me.type === 'user')  setDbUser(me.record as DbUser);
      if (me.type === 'staff') setDbStaff(me.record as DbStaff);
    } catch (err) {
      console.warn('MySQL sync failed (non-critical):', err);
    }
  }, []);

  useEffect(() => {
    // Subscribe to auth state changes first
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        if (session?.user && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
          // Defer MySQL sync to avoid blocking the auth state update
          setTimeout(() => syncToMySQL(), 0);
        }

        if (event === 'SIGNED_OUT') {
          setDbUser(null);
          setDbStaff(null);
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) {
        setTimeout(() => syncToMySQL(), 0);
      }
    });

    return () => subscription.unsubscribe();
  }, [syncToMySQL]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (
    email: string,
    password: string,
    metadata: Record<string, unknown> = {}
  ) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: metadata,
      },
    });

    // If signup succeeded and user is immediately active, sync to MySQL
    if (!error && data.session) {
      setTimeout(() => syncToMySQL({
        full_name: metadata.full_name as string | undefined,
        phone:     metadata.phone     as string | undefined,
      }), 0);
    }

    return { error };
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/` },
    });
    return { error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  };

  const isStaff    = !!dbStaff;
  const isManager  = dbStaff?.role_name === 'manager'   || dbStaff?.role_name === 'executive';
  const isExecutive = dbStaff?.role_name === 'executive';

  return {
    user,
    session,
    loading,
    dbUser,
    dbStaff,
    isStaff,
    isManager,
    isExecutive,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
    syncToMySQL,
  };
};
