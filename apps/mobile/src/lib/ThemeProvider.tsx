/**
 * ThemeProvider — light / dark / system theming.
 *
 * Resolves the active scheme (a user override, or the OS appearance when set to
 * "system"), applies it to the live theme bindings (applyScheme), and remounts
 * the tree on change so the whole token-based UI reflows. The choice persists in
 * AsyncStorage.
 */
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { applyScheme, ThemeScheme } from './theme';

export type ThemeMode = 'light' | 'dark' | 'system';
const STORAGE_KEY = 'qme.theme-mode';

interface ThemeCtx { mode: ThemeMode; scheme: ThemeScheme; setMode: (m: ThemeMode) => void; }
const Ctx = createContext<ThemeCtx>({ mode: 'system', scheme: 'light', setMode: () => {} });
export const useTheme = () => useContext(Ctx);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(v => {
      if (v === 'light' || v === 'dark' || v === 'system') setModeState(v);
      setLoaded(true);
    });
  }, []);

  const scheme: ThemeScheme = mode === 'system' ? (system === 'dark' ? 'dark' : 'light') : mode;

  // Apply before children render so the live colors/t bindings are current.
  applyScheme(scheme);

  const setMode = (m: ThemeMode) => { setModeState(m); AsyncStorage.setItem(STORAGE_KEY, m).catch(() => {}); };
  const value = useMemo(() => ({ mode, scheme, setMode }), [mode, scheme]);

  if (!loaded) return null; // avoid a flash of the wrong theme before prefs load

  // key={scheme} remounts the subtree on a theme flip so every screen re-reads
  // the updated colors/t bindings and StyleSheets.
  return (
    <Ctx.Provider value={value}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <React.Fragment key={scheme}>{children}</React.Fragment>
    </Ctx.Provider>
  );
}
