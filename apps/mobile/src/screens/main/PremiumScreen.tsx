/**
 * PremiumScreen — Lyne Premium, bought through the App Store or Google Play.
 *
 * Prices come from the store, already localised; nothing here hard-codes an
 * amount. The screen carries what both stores require of a subscription
 * offer: the title, length and price of each plan, that it renews until
 * cancelled and how to cancel, Restore purchases, and the Terms and Privacy
 * links. The purchase itself is lib/purchases.ts.
 */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import type { ProductSubscription } from 'expo-iap';
import { colors, font, shadow, t } from '../../lib/theme';
import { useNavBarLift, useTopPad } from '../../lib/insets';
import { useAuth } from '../../hooks/useAuth';
import { buyPremium, loadPremiumProducts, manageSubscription, restorePremium } from '../../lib/purchases';

const BENEFITS = [
  { icon: 'calendar-outline', text: 'Busy times for every hour of the week, per service' },
  { icon: 'sparkles-outline', text: 'Week planner with the quietest window each day' },
  { icon: 'time-outline', text: 'Line Helper: we join the line for you at the right time' },
] as const;

function periodLabel(p: ProductSubscription): string {
  return /year/i.test(p.id) ? 'per year' : 'per month';
}
function planName(p: ProductSubscription): string {
  return /year/i.test(p.id) ? 'Yearly' : 'Monthly';
}

export default function PremiumScreen() {
  const navigation = useNavigation<any>();
  const topPad = useTopPad(14);
  const lift = useNavBarLift();
  const { user, refreshProfile } = useAuth();
  const [products, setProducts] = useState<ProductSubscription[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState<'buy' | 'restore' | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const premium = Boolean(Number(user?.is_premium || 0));

  useEffect(() => {
    let live = true;
    loadPremiumProducts()
      .then(list => { if (!live) return; setProducts(list); setSelected(list.find(p => /year/i.test(p.id))?.id ?? list[0]?.id ?? null); })
      .catch(() => { if (live) setProducts([]); });
    return () => { live = false; };
  }, []);

  const product = products?.find(p => p.id === selected) ?? null;

  const subscribe = async () => {
    if (!product || !user?.id) return;
    setBusy('buy'); setError(''); setNotice('');
    try {
      await buyPremium(product, String(user.id));
      await refreshProfile();
      setNotice('Welcome to Lyne Premium.');
    } catch (e: any) {
      if (!e?.cancelled) setError(e?.message || 'The purchase did not go through.');
    } finally {
      setBusy(null);
    }
  };

  const restore = async () => {
    setBusy('restore'); setError(''); setNotice('');
    try {
      const restored = await restorePremium();
      await refreshProfile();
      setNotice(restored ? 'Your Premium subscription is restored.' : 'No active Lyne Premium subscription was found for this account.');
    } catch (e: any) {
      setError(e?.message || 'Could not restore purchases. Try again in a moment.');
    } finally {
      setBusy(null);
    }
  };

  const store = Platform.OS === 'ios' ? 'Apple ID' : 'Google Play account';

  return (
    <View style={t.root}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingTop: topPad, paddingBottom: 40 + lift }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 22 }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={t.iconBtn} accessibilityLabel="Go back"><Ionicons name="chevron-back" size={20} color={colors.ink} /></TouchableOpacity>
          <Text style={t.h2}>Lyne Premium</Text>
        </View>

        <View style={[t.card, { padding: 18, gap: 14, ...shadow.card }]}>
          {BENEFITS.map(b => (
            <View key={b.text} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <Ionicons name={b.icon} size={20} color={colors.accentDeep} />
              <Text style={{ flex: 1, fontFamily: font.semibold, fontSize: 14.5, color: colors.ink, lineHeight: 20 }}>{b.text}</Text>
            </View>
          ))}
        </View>

        {premium ? (
          <View style={[t.card, { padding: 18, marginTop: 18, ...shadow.card }]}>
            <Text style={{ fontFamily: font.bold, fontSize: 15, color: colors.ink }}>Premium is on</Text>
            <Text style={{ fontFamily: font.medium, fontSize: 13.5, color: colors.muted, marginTop: 6, lineHeight: 19 }}>
              Change plan or cancel in your {store}'s subscriptions.
            </Text>
            <TouchableOpacity onPress={manageSubscription} style={[t.ghostBtn, { marginTop: 14, minHeight: 50 }]} accessibilityRole="button">
              <Text style={{ fontFamily: font.bold, fontSize: 15, color: colors.ink }}>Manage subscription</Text>
            </TouchableOpacity>
          </View>
        ) : products === null ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 30 }} />
        ) : products.length === 0 ? (
          <Text style={{ fontFamily: font.medium, fontSize: 14, color: colors.muted, marginTop: 20, textAlign: 'center', lineHeight: 20 }}>
            Plans could not be loaded from the {Platform.OS === 'ios' ? 'App Store' : 'Play Store'}. Check your connection and try again.
          </Text>
        ) : (
          <>
            <View style={{ gap: 10, marginTop: 18 }}>
              {products.map(p => {
                const on = p.id === selected;
                return (
                  <TouchableOpacity
                    key={p.id}
                    onPress={() => setSelected(p.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 18, borderWidth: 2, borderColor: on ? colors.accent : colors.border, backgroundColor: colors.surface }}
                  >
                    <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={20} color={on ? colors.accent : colors.faint} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: font.bold, fontSize: 15.5, color: colors.ink }}>{planName(p)}</Text>
                      <Text style={{ fontFamily: font.medium, fontSize: 13, color: colors.muted, marginTop: 2 }}>Renews automatically</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontFamily: font.extra, fontSize: 17, color: colors.ink }}>{p.displayPrice}</Text>
                      <Text style={{ fontFamily: font.medium, fontSize: 12, color: colors.muted }}>{periodLabel(p)}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity disabled={!product || !!busy} onPress={subscribe} style={[t.primaryBtn, { marginTop: 18, opacity: product ? 1 : 0.5 }]} accessibilityRole="button">
              {busy === 'buy' ? <ActivityIndicator color="#fff" /> : (
                <Text style={t.primaryBtnText}>{product ? `Subscribe for ${product.displayPrice} ${periodLabel(product)}` : 'Subscribe'}</Text>
              )}
            </TouchableOpacity>

            <Text style={{ fontFamily: font.medium, fontSize: 12, color: colors.muted, marginTop: 12, lineHeight: 17 }}>
              Payment is charged to your {store} at confirmation. The subscription renews automatically at the same price for the same period unless it is cancelled at least 24 hours before the end of the current period. Manage or cancel it any time in your {store} settings.
            </Text>
          </>
        )}

        {!!error && <Text style={{ fontFamily: font.bold, fontSize: 13, color: colors.danger, marginTop: 14 }}>{error}</Text>}
        {!!notice && <Text style={{ fontFamily: font.bold, fontSize: 13, color: colors.light, marginTop: 14 }}>{notice}</Text>}

        <TouchableOpacity onPress={restore} disabled={!!busy} style={{ alignItems: 'center', marginTop: 20, minHeight: 44, justifyContent: 'center' }} accessibilityRole="button">
          {busy === 'restore' ? <ActivityIndicator color={colors.accentDeep} /> : (
            <Text style={{ fontFamily: font.bold, fontSize: 14.5, color: colors.accentDeep }}>Restore purchases</Text>
          )}
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 22, marginTop: 4 }}>
          <TouchableOpacity onPress={() => navigation.navigate('Legal', { tab: 'terms' })} style={{ minHeight: 40, justifyContent: 'center' }}>
            <Text style={{ fontFamily: font.semibold, fontSize: 13, color: colors.muted }}>Terms of Use</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Legal', { tab: 'privacy' })} style={{ minHeight: 40, justifyContent: 'center' }}>
            <Text style={{ fontFamily: font.semibold, fontSize: 13, color: colors.muted }}>Privacy Policy</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
