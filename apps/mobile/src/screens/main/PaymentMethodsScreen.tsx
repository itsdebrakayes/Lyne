/**
 * PaymentMethodsScreen — the cards on file, read-only.
 *
 * Adding one used to happen here through CardSheet. It does not any more:
 * every purchase now goes through the website, so a second place to enter a
 * card would be a second thing to keep correct, a second PCI surface, and — on
 * iOS — a card form inside an app that is not allowed to sell anything.
 *
 * Listing and removing stay. Seeing what is on file, and taking something off
 * it, are not transactions, and sending somebody to a browser to answer "which
 * card is Lyne holding" would be user-hostile.
 */
import React, { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, shadow, t } from '../../lib/theme';
import api from '../../lib/apiClient';
import { paymentsConfigured, brandLabel } from '../../lib/stripe';
import { openSubscriptionPortal } from '../../lib/subscriptionPortal';
import { Sheen } from '../../components/Glass';
import { ErrorCard, SkeletonRows } from '../../components/Feedback';
import EmptyState from '../../components/EmptyState';

interface Card { id: string; brand?: string; last4?: string; exp_month?: number; exp_year?: number; is_default?: boolean }

export default function PaymentMethodsScreen() {
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();

  const { data: cards = [], isLoading, error, refetch } = useQuery({
    queryKey: ['payment-methods'],
    queryFn: () => api.get<Card[]>('/payments/methods'),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['payment-methods'] });


  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/payments/methods/${id}`),
    onSuccess: refresh,
  });
  const confirmRemove = (card: Card) => Alert.alert(
    'Remove card',
    `Remove the ${brandLabel(card.brand)} ending ${card.last4}?`,
    [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => remove.mutate(card.id) }],
  );

  return (
    <View style={t.root}>
      <ScrollView contentContainerStyle={t.content} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 22 }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={t.iconBtn}><Ionicons name="chevron-back" size={20} color={colors.ink} /></TouchableOpacity>
          <Text style={t.h2}>Payment methods</Text>
        </View>

        <Text style={{ fontFamily: font.medium, fontSize: 14.5, color: colors.muted, lineHeight: 21, marginBottom: 6 }}>
          Cards you save here are used for Lyne Premium. Your card details are held securely by Stripe — never on our servers.
        </Text>

        {!paymentsConfigured() && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.warnSoft, borderRadius: 16, padding: 14, marginTop: 14 }}>
            <Ionicons name="time-outline" size={18} color={colors.moderate} />
            <Text style={{ flex: 1, fontFamily: font.semibold, fontSize: 13, color: colors.sub, lineHeight: 18 }}>Card payments are launching soon. You can add a card once we go live.</Text>
          </View>
        )}

        <View style={{ marginTop: 18, gap: 12 }}>
          {isLoading && <SkeletonRows count={2} />}
          {!!error && !isLoading && <ErrorCard title="Couldn’t load cards" message="Your saved cards couldn’t be loaded right now." onRetry={() => refetch()} />}
          {!isLoading && !error && cards.length === 0 && (
            <EmptyState
              compact
              icon="financial"
              title="No cards saved"
              body="Add a card once and Premium is a single tap from anywhere in the app. Your card details never touch our servers."
            />
          )}

          {cards.map(card => (
            <View key={card.id} style={[t.listRow, { ...shadow.card }]}>
              <View style={{ borderRadius: 12, ...shadow.depth }}>
                <View style={{ width: 46, height: 32, borderRadius: 8, backgroundColor: colors.dark, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  <Sheen radius={8} />
                  <Ionicons name="card" size={16} color={colors.accent} />
                </View>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontFamily: font.bold, fontSize: 15, color: colors.ink }}>{brandLabel(card.brand)} •••• {card.last4}</Text>
                <Text style={{ fontFamily: font.medium, fontSize: 12.5, color: colors.muted, marginTop: 2 }}>
                  Expires {String(card.exp_month).padStart(2, '0')}/{String(card.exp_year).slice(-2)}{card.is_default ? '  ·  Default' : ''}
                </Text>
              </View>
              <TouchableOpacity onPress={() => confirmRemove(card)} disabled={remove.isPending} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="trash-outline" size={19} color={colors.danger} />
              </TouchableOpacity>
            </View>
          ))}
        </View>

        <TouchableOpacity onPress={() => openSubscriptionPortal('manage')} style={[t.primaryBtn, { marginTop: 18, minHeight: 54 }]}>
          <Ionicons name="open-outline" size={18} color={colors.onDark} />
          <Text style={[t.primaryBtnText, { marginLeft: 6 }]}>Manage on the web</Text>
        </TouchableOpacity>
        <Text style={{ fontFamily: font.medium, fontSize: 12.5, color: colors.muted, textAlign: 'center', marginTop: 10 }}>
          Cards are added and changed on our website, using the same account.
        </Text>
      </ScrollView>
    </View>
  );
}
