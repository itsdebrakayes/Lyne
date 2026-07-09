/**
 * stripe.ts — client-side card tokenization.
 *
 * The raw card number goes directly from the device to Stripe using the
 * PUBLISHABLE key; it never touches our server (PCI-clean). We send only the
 * resulting payment_method id to the backend. Until a publishable key is
 * configured (EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY), paymentsConfigured() is
 * false and the UI shows a "coming soon" state instead of failing.
 */
import Constants from 'expo-constants';

const extra = (Constants.expoConfig?.extra || {}) as { stripePublishableKey?: string };
export const STRIPE_PK = (extra.stripePublishableKey || '').trim();

export function paymentsConfigured(): boolean {
  return STRIPE_PK.startsWith('pk_');
}

// A client idempotency key for a charge attempt (retries never double-charge).
export function idempotencyKey(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export interface CardInput { number: string; exp_month: number; exp_year: number; cvc: string; name?: string }
export interface TokenizedCard { id: string; brand?: string; last4?: string }

export async function createPaymentMethod(card: CardInput): Promise<TokenizedCard> {
  if (!paymentsConfigured()) throw new Error('Card payments aren’t switched on yet.');
  const body = new URLSearchParams();
  body.append('type', 'card');
  body.append('card[number]', card.number.replace(/\s+/g, ''));
  body.append('card[exp_month]', String(card.exp_month));
  body.append('card[exp_year]', String(card.exp_year));
  body.append('card[cvc]', card.cvc);
  if (card.name) body.append('billing_details[name]', card.name);

  const res = await fetch('https://api.stripe.com/v1/payment_methods', {
    method: 'POST',
    headers: { Authorization: `Bearer ${STRIPE_PK}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || 'Your card could not be verified.');
  return { id: data.id, brand: data.card?.brand, last4: data.card?.last4 };
}

// Card-brand → display label + a hint for the icon.
export function brandLabel(brand?: string): string {
  if (!brand) return 'Card';
  return brand.charAt(0).toUpperCase() + brand.slice(1);
}
