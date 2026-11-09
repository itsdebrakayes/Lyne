/**
 * UpdateNotice — tells people when a newer Lyne is in the store.
 *
 * Checked once per launch against /api/app/version. Two forms, following what
 * established apps do:
 *
 * - A newer version (soft update): a card slides up above the tab bar with the
 *   app icon, the version, one line on what is new, and Update / Not now. It
 *   never blocks anything, fades away on its own if ignored, and "Not now"
 *   keeps it quiet until the next version.
 * - This version below the minimum the server supports (required update): a
 *   full screen with one action, because the app would otherwise start failing
 *   in confusing ways. Kept for real breakage only, never to push a release.
 *
 * A store with no URL yet gets nothing.
 */
import React, { useEffect, useState } from 'react';
import { BackHandler, Image, Linking, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOutDown } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, font, shadow } from '../lib/theme';
import { compareVersions, storeInfo } from '../lib/storeLinks';
import Icon from './Icon';

const DISMISSED_KEY = 'lyne.updateDismissedFor';
const AUTO_HIDE_MS = 15000;
const APP_ICON = require('../../assets/icon.png');

type Notice = { url: string; latest: string; notes: string | null; required: boolean; mine: string };

export function UpdateNotice() {
  const insets = useSafeAreaInsets();
  const [notice, setNotice] = useState<Notice | null>(null);

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
      if (!cancelled) setNotice({ url: info.url, latest: info.latest, notes: info.notes ?? null, required, mine });
    })();
    return () => { cancelled = true; };
  }, []);

  /* Android's Back button would otherwise move the screens hidden under the
     required-update page. Nothing behind it works, so Back stays put. */
  useEffect(() => {
    if (!notice?.required) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [notice]);

  useEffect(() => {
    if (!notice || notice.required) return;
    const t = setTimeout(() => setNotice(null), AUTO_HIDE_MS);
    return () => clearTimeout(t);
  }, [notice]);

  if (!notice) return null;
  const update = () => Linking.openURL(notice.url).catch(() => {});
  const notNow = () => { AsyncStorage.setItem(DISMISSED_KEY, notice.latest).catch(() => {}); setNotice(null); };

  if (notice.required) {
    return (
      <Animated.View entering={FadeIn.duration(240)} accessibilityViewIsModal
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.bg, paddingTop: insets.top, paddingBottom: insets.bottom + 20, paddingHorizontal: 28 }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ borderRadius: 26, ...shadow.hero }}>
            <Image source={APP_ICON} style={{ width: 96, height: 96, borderRadius: 24 }} accessibilityIgnoresInvertColors />
          </View>
          <Text accessibilityRole="header" style={{ fontFamily: font.extra, fontSize: 26, letterSpacing: -0.6, color: colors.ink, marginTop: 28, textAlign: 'center' }}>
            Time to update Lyne
          </Text>
          <Text style={{ fontFamily: font.medium, fontSize: 15, lineHeight: 22, color: colors.sub, marginTop: 10, textAlign: 'center', maxWidth: 330 }}>
            This version no longer works with Lyne. The update takes a minute, and your account, documents and tickets stay as they are.
          </Text>
          {!!notice.notes && (
            <View style={{ marginTop: 22, alignSelf: 'stretch', maxWidth: 380, borderRadius: 18, padding: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderSoft }}>
              <Text style={{ fontFamily: font.bold, fontSize: 13, color: colors.ink }}>What’s new in {notice.latest}</Text>
              <Text style={{ fontFamily: font.medium, fontSize: 13.5, lineHeight: 19, color: colors.sub, marginTop: 4 }}>{notice.notes}</Text>
            </View>
          )}
        </View>
        <TouchableOpacity onPress={update} accessibilityRole="button" accessibilityLabel="Update Lyne in the store"
          style={{ minHeight: 56, borderRadius: 18, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: font.extra, fontSize: 16, color: colors.accentInk }}>Update now</Text>
        </TouchableOpacity>
        <Text style={{ fontFamily: font.medium, fontSize: 12, color: colors.faint, textAlign: 'center', marginTop: 12 }}>
          You have {notice.mine} · The latest is {notice.latest}
        </Text>
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={FadeInDown.duration(320)} exiting={FadeOutDown.duration(260)} pointerEvents="box-none"
      style={{ position: 'absolute', left: 16, right: 16, bottom: insets.bottom + 88, alignItems: 'center' }}>
      <View accessibilityLiveRegion="polite"
        style={{ alignSelf: 'stretch', maxWidth: 520, backgroundColor: colors.surface, borderRadius: 22, borderWidth: 1, borderColor: colors.borderSoft, padding: 14, ...shadow.floating }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Image source={APP_ICON} style={{ width: 46, height: 46, borderRadius: 12 }} accessibilityIgnoresInvertColors />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: font.extra, fontSize: 15, color: colors.ink }}>Update available</Text>
            <Text numberOfLines={2} style={{ fontFamily: font.medium, fontSize: 13, lineHeight: 18, color: colors.muted, marginTop: 2 }}>
              Lyne {notice.latest} · {notice.notes || 'Fixes and improvements'}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
          <TouchableOpacity onPress={notNow} accessibilityRole="button"
            style={{ flex: 1, minHeight: 44, borderRadius: 14, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: font.bold, fontSize: 14, color: colors.ink }}>Not now</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={update} accessibilityRole="button" accessibilityLabel="Update Lyne in the store"
            style={{ flex: 1, minHeight: 44, borderRadius: 14, backgroundColor: colors.accent, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="arrowUpCircle" size={16} color={colors.accentInk} />
            <Text style={{ fontFamily: font.extra, fontSize: 14, color: colors.accentInk }}>Update</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}
