import { useState, useEffect, useRef, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import api, { supabase } from '../lib/apiClient';

export interface UserProfile {
  id: string;
  supabase_uid?: string;
  full_name: string;
  email: string;
  phone?: string;
  national_id?: string;
  trn?: string;
  is_premium?: boolean | number;
}

interface AuthMe {
  type: 'user' | 'staff';
  record: UserProfile;
}

export const useAuth = () => {
  const [user, setUser]     = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Guards against the re-entrant sync loop: track the Supabase uid we have
  // already synced, and whether a sync is currently in flight. onAuthStateChange
  // fires on every TOKEN_REFRESHED (roughly hourly, plus on focus); without these
  // guards each event would call sync-user again and, on any transient failure,
  // retry in a tight loop.
  const syncedUid = useRef<string | null>(null);
  const inFlight  = useRef(false);

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

  const applySession = useCallback(async (session: Session | null, force = false) => {
    const sbUser = session?.user ?? null;

    if (!sbUser) {
      syncedUid.current = null;
      setUser(null);
      setLoading(false);
      return;
    }

    // Already synced this user and not explicitly forced (e.g. token refresh) —
    // nothing to do, so we never loop on repeated auth events.
    if (!force && syncedUid.current === sbUser.id) {
      setLoading(false);
      return;
    }
    if (inFlight.current) return;

    inFlight.current = true;
    setLoading(true);
    try {
      await syncMobileUser(sbUser.user_metadata as Record<string, string> | undefined);
      syncedUid.current = sbUser.id;
    } catch {
      syncedUid.current = null;
      setUser(null);
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, [syncMobileUser]);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) applySession(session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Only (re)sync the MySQL profile on real identity changes. Token refreshes
      // keep the same user, so they must not trigger another sync.
      if (event === 'SIGNED_OUT') { applySession(null); return; }
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'INITIAL_SESSION') {
        applySession(session);
      }
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, [applySession]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) {
      try {
        await syncMobileUser();
        const { data: { session } } = await supabase.auth.getSession();
        syncedUid.current = session?.user?.id ?? null;
      } catch (syncError) {
        return { error: syncError as Error };
      }
    }
    return { error };
  };

  const signUp = async (email: string, password: string, nameOrMeta: string | Record<string, string>): Promise<{ error: Error | null; needsConfirmation?: boolean }> => {
    const metadata: Record<string, string> = typeof nameOrMeta === 'string'
      ? { full_name: nameOrMeta }
      : nameOrMeta;
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: metadata } });
    if (error) return { error };
    // When the project requires email confirmation, signUp succeeds but returns
    // no session — we can't sync to the backend (it needs a token) until they
    // confirm, so surface that instead of failing on the sync call.
    if (!data.session) return { error: null, needsConfirmation: true };
    try {
      await syncMobileUser(metadata);
      syncedUid.current = data.session.user.id;
    } catch (syncError) {
      return { error: syncError as Error };
    }
    return { error: null };
  };

  const signOut = async () => {
    syncedUid.current = null;
    await supabase.auth.signOut();
    setUser(null);
  };

  // Re-reads the profile after an edit (e.g. adding a document) so the
  // screen reflects the saved values immediately.
  const refreshProfile = useCallback(async () => {
    const me = await api.get<AuthMe>('/auth/me');
    if (me.type === 'user') setUser(me.record);
    return me.record;
  }, []);

  return { user, loading, signIn, signUp, signOut, refreshProfile };
};
