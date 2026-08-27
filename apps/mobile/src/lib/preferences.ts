/**
 * preferences.ts — the handful of answers onboarding is allowed to ask for.
 *
 * The rule that keeps this honest: every question here CHANGES something the
 * person will notice. Onboarding that collects preferences nothing reads is
 * worse than no onboarding — it costs the user time, teaches them their answers
 * do not matter, and it is the first thing the app ever asks of them.
 *
 * So there are two questions, and both are load-bearing:
 *
 *   city     the Home header stops claiming "Kingston, Jamaica" at somebody in
 *            Montego Bay, and Search opens filtered to where they actually are.
 *   sectors  which kinds of place they queue at, used to order the Home rail so
 *            the first card is a bank if they came here for a bank.
 *
 * Both are optional and both are changeable later from the Account screen. A
 * skipped answer is stored as absent, never as a guess.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

const KEY = 'lyne.preferences.v1';

/** The eight towns Lyne actually has branches in. */
export const CITIES = [
  'Kingston',
  'Spanish Town',
  'Portmore',
  'Montego Bay',
  'Mandeville',
  'May Pen',
  'Old Harbour',
  'Morant Bay',
] as const;

/**
 * The sectors as the DATABASE spells them, paired with what a person would
 * call them. Storing the raw key means filtering never needs a lookup table
 * that can drift; showing the plain label means nobody is asked to pick
 * "government_revenue".
 */
export const SECTORS: Array<{ key: string; label: string; hint: string; icon: string }> = [
  { key: 'financial_services', label: 'Banking & credit unions', hint: 'Accounts, loans, member services', icon: 'card-outline' },
  { key: 'government_revenue', label: 'Government offices', hint: 'Tax, passports, housing', icon: 'business-outline' },
  { key: 'university', label: 'Campus services', hint: 'Registry, enrolment, student finance', icon: 'school-outline' },
  { key: 'judiciary', label: 'Courts', hint: 'Traffic tickets, summonses', icon: 'shield-checkmark-outline' },
];

export type Preferences = {
  city?: string;
  sectors?: string[];
  /** Set once the flow has been completed or skipped, so it never reappears. */
  onboardedAt?: string;
};

export async function readPreferences(): Promise<Preferences> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Preferences) : {};
  } catch {
    /* A corrupt or unreadable store must not block the app from opening — the
       worst case is that we ask again, which is recoverable. */
    return {};
  }
}

export async function writePreferences(next: Preferences): Promise<void> {
  try {
    const current = await readPreferences();
    await AsyncStorage.setItem(KEY, JSON.stringify({ ...current, ...next }));
  } catch {
    /* Preferences are a convenience. Failing to save one is not worth
       interrupting anybody over. */
  }
}

/** Read preferences reactively; `ready` guards against a flash of the default. */
export function usePreferences() {
  const [prefs, setPrefs] = useState<Preferences>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    readPreferences().then((p) => {
      if (alive) { setPrefs(p); setReady(true); }
    });
    return () => { alive = false; };
  }, []);

  const save = useCallback(async (next: Preferences) => {
    setPrefs((current) => ({ ...current, ...next }));
    await writePreferences(next);
  }, []);

  return { prefs, ready, save };
}

/**
 * Where to say the person is. Falls back to Kingston only because the header
 * needs a word — it is a label, not a claim about their location.
 */
export function homeLocationLabel(prefs: Preferences): string {
  return `${prefs.city || 'Kingston'}, Jamaica`;
}
