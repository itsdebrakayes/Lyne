import { useState, useEffect, useRef, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import api, { supabase, isOffline } from '../lib/apiClient';
import { GOVERNMENT_TERMS, type SectorTerms } from '../lib/sectorTerms';

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

// The staff record /auth/me returns. Only the kiosk_clerk role is accepted on
// the mobile app; every other staff role is rejected below.
interface StaffRecord {
  id: string;
  full_name: string;
  role_name: string;
  role_label?: string;
  branch_id?: string;
  branch_name?: string;
  business_id?: string;
  business_name?: string;
  /** What this tenant's sector calls the people it serves. /auth/me always
   *  sends it; the government wording is the server-side fallback. */
  terms?: SectorTerms;
}

interface AuthMe {
  type: 'user' | 'staff';
  record: UserProfile & StaffRecord;
}

// A logged-in kiosk clerk — the branch intake actor. Distinct from a customer:
// they don't have a queue ticket of their own, they add walk-ins for others.
export interface KioskActor {
  staffId: string;
  name: string;
  branchId: string;
  branchName: string;
  businessName: string;
  roleLabel: string;
  /** The kiosk is the one mobile screen that belongs to a single tenant, so it
   *  is the one that can — and must — speak that tenant's language. A credit
   *  union's front desk should not be asking a clerk to type in a "Customer". */
  terms: SectorTerms;
}

export const useAuth = () => {
  const [user, setUser]     = useState<UserProfile | null>(null);
  const [kiosk, setKiosk]   = useState<KioskActor | null>(null);
  const [loading, setLoading] = useState(true);
  /* Signed in, but we could not reach the API to load the profile. Distinct
     from `!user`, which means genuinely signed out — the screens that read
     this must not offer a password box to somebody who already has a session. */
  const [unreachable, setUnreachable] = useState(false);

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
    if (me.type === 'user') {
      setKiosk(null);
      setUser(me.record);
      return me.record;
    }
    // The one staff role the mobile app serves: a kiosk clerk, who logs in here
    // to add walk-in customers on the branch's behalf. Everyone else (managers,
    // executives, line staff) belongs on the admin desktop, not the phone.
    if (me.type === 'staff' && me.record?.role_name === 'kiosk_clerk') {
      if (!me.record.branch_id) {
        await supabase.auth.signOut();
        setUser(null); setKiosk(null);
        /* Carries a status so the catch in applySession reads it as a refusal
           rather than a connectivity failure. This account is genuinely not
           usable here, and no amount of signal will change that. */
        throw Object.assign(
          new Error('This kiosk account is not assigned to a branch. Ask an administrator to set one.'),
          { status: 403 },
        );
      }
      setUser(null);
      setKiosk({
        staffId:      me.record.id,
        name:         me.record.full_name,
        branchId:     me.record.branch_id,
        branchName:   me.record.branch_name || 'this branch',
        businessName: me.record.business_name || '',
        roleLabel:    me.record.role_label || 'Kiosk Clerk',
        terms:        me.record.terms?.visitor?.many ? me.record.terms : GOVERNMENT_TERMS,
      });
      return me.record;
    }
    await supabase.auth.signOut();
    setUser(null); setKiosk(null);
    throw Object.assign(
      new Error('This account is provisioned for admin access, not the mobile app.'),
      { status: 403 },
    );
  }, []);

  const applySession = useCallback(async (session: Session | null, force = false) => {
    const sbUser = session?.user ?? null;

    if (!sbUser) {
      syncedUid.current = null;
      setUser(null);
      setKiosk(null);
      setUnreachable(false);
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
      setUnreachable(false);
    } catch (error) {
      /* Not being able to reach us is not the same as not being signed in.
         This catch used to clear the profile on ANY failure, so a dropped
         connection — a queue hall with bad signal, a phone coming back from
         the lock screen on the venue wifi — logged the person out and put a
         login form in front of somebody whose session was still perfectly
         valid. They then retype a password to fix a problem the password was
         never part of.

         A refusal still signs them out, because that one is real: the server
         looked at the token and said no. */
      if (isOffline(error)) {
        setUnreachable(true);
      } else {
        syncedUid.current = null;
        setUser(null);
        setKiosk(null);
      }
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
    setKiosk(null);
    setUnreachable(false);
  };

  /* Try the profile load again with the session already in hand.
     `force` matters: the guard in applySession short-circuits a uid it thinks
     is already synced, and after a failed load that is exactly the uid we need
     to retry. */
  const retrySession = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    await applySession(session, true);
  }, [applySession]);

  // Re-reads the profile after an edit (e.g. adding a document) so the
  // screen reflects the saved values immediately.
  const refreshProfile = useCallback(async () => {
    const me = await api.get<AuthMe>('/auth/me');
    if (me.type === 'user') setUser(me.record);
    return me.record;
  }, []);

  return { user, kiosk, loading, unreachable, signIn, signUp, signOut, refreshProfile, retrySession };
};
