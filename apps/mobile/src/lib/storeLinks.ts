/**
 * storeLinks.ts — this app's own store page, for "Rate Lyne" and the update notice.
 *
 * Rate Lyne uses the store's own in-app rating sheet where it can. Apple and
 * Google decide whether that sheet appears (Apple at most three times a year),
 * so when it cannot, the store page opens instead. It is only ever offered from
 * Settings, never pushed at someone.
 */
import { Linking, Platform } from 'react-native';
import * as StoreReview from 'expo-store-review';
import api from './apiClient';

export type StoreInfo = { latest: string | null; minimum: string | null; url: string; notes?: string | null } | null;
export type VersionInfo = { ios: StoreInfo; android: StoreInfo };

const ANDROID_PAGE = 'https://play.google.com/store/apps/details?id=com.lyne.mobile';

export async function storeInfo(): Promise<StoreInfo> {
  try {
    const v = await api.get<VersionInfo>('/app/version', false);
    return (Platform.OS === 'ios' ? v.ios : v.android) ?? null;
  } catch {
    return null;
  }
}

export async function rateLyne() {
  try {
    if (await StoreReview.hasAction()) { await StoreReview.requestReview(); return; }
  } catch { /* fall through to the store page */ }
  const url = (await storeInfo())?.url || (Platform.OS === 'android' ? ANDROID_PAGE : null);
  if (url) Linking.openURL(Platform.OS === 'ios' ? `${url}${url.includes('?') ? '&' : '?'}action=write-review` : url).catch(() => {});
}

/** -1, 0 or 1, comparing dotted versions such as 1.0.9 and 1.1.0. */
export function compareVersions(a: string, b: string) {
  const pa = a.split('.').map(n => parseInt(n, 10) || 0);
  const pb = b.split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
}
