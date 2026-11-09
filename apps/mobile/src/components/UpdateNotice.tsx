/**
 * UpdateNotice — a small notice at the bottom when a newer version is in the store.
 *
 * Checked once per launch against /api/app/version. Newer version available: the
 * notice slides up with Update and Not now, fades away on its own after a while,
 * and "Not now" keeps it quiet for that version. This version below the minimum
 * the server still supports: it stays until Update is tapped, because the app
 * would otherwise start failing. A store with no URL yet gets no notice.
 */
import React, { useEffect, useState } from 'react';
import { Linking, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, font, shadow } from '../lib/theme';
import { compareVersions, storeInfo } from '../lib/storeLinks';

const DISMISSED_KEY = 'lyne.updateDismissedFor';
const AUTO_HIDE_MS = 12000;

export function UpdateNotice() {
  const insets = useSafeAreaInsets();
  const [notice, setNotice] = useState<null | { url: string; latest: string; required: boolean }>(null);

  useEffect(() => {
    const mine = Constants.expoConfig?.version;
    if (!mine) return;
    let cancelled = false;
    (async () => {
      const info = await storeInfo();
      if (!info?.latest || cancelled) return;
      const required = Boolean(info.minimum && compareVersions(mine, info.minimum) < 0);
      if (!required && compareVersions(mine, info.latest) >= 0) return;
      if (!required) {
        const dismissed = await AsyncStorage.getItem(DISMISSED_KEY).catch(() => null);
        if (dismissed === info.latest) return;
      }
      if (!cancelled) setNotice({ url: info.url, latest: info.latest, required });
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!notice || notice.required) return;
    const t = setTimeout(() => setNotice(null), AUTO_HIDE_MS);
    return () => clearTimeout(t);
  }, [notice]);

  if (!notice) return null;
  const notNow = () => { AsyncStorage.setItem(DISMISSED_KEY, notice.latest).catch(() => {}); setNotice(null); };

  return (
    <Animated.View entering={FadeInDown.duration(320)} exiting={FadeOutDown.duration(260)} pointerEvents="box-none"
      style={{ position: 'absolute', left: 16, right: 16, bottom: insets.bottom + 84, alignItems: 'center' }}>
      <View accessibilityLiveRegion="polite" style={{ alignSelf: 'stretch', maxWidth: 520, backgroundColor: colors.dark, borderRadius: 20, padding: 16, ...shadow.hero }}>
        <Text style={{ fontFamily: font.extra, fontSize: 15, color: '#fff' }}>
          {notice.required ? 'Please update Lyne' : 'A new version of Lyne is ready'}
        </Text>
        <Text style={{ fontFamily: font.medium, fontSize: 13, color: 'rgba(255,255,255,.75)', marginTop: 4, lineHeight: 18 }}>
          {notice.required ? 'This version is no longer supported. Update to keep joining lines.' : `Version ${notice.latest} is in the store, with fixes and improvements.`}
        </Text>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
          {!notice.required && (
            <TouchableOpacity onPress={notNow} accessibilityRole="button" style={{ minHeight: 40, paddingHorizontal: 14, justifyContent: 'center' }}>
              <Text style={{ fontFamily: font.bold, fontSize: 14, color: 'rgba(255,255,255,.8)' }}>Not now</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => Linking.openURL(notice.url).catch(() => {})} accessibilityRole="button"
            style={{ minHeight: 40, paddingHorizontal: 18, borderRadius: 12, backgroundColor: '#fff', justifyContent: 'center' }}>
            <Text style={{ fontFamily: font.extra, fontSize: 14, color: colors.dark }}>Update</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}
