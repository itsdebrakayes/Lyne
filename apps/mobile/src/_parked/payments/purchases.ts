/**
 * purchases.ts — Lyne Premium through Apple In-App Purchase and Google Play
 * Billing.
 *
 * The flow, for a purchase and for "Restore purchases" alike:
 *   1. the store completes the payment (the app never sees a card),
 *   2. the app sends the store's identifier for it to POST /iap/verify,
 *   3. the server asks Apple or Google directly and extends premium_until,
 *   4. only then is the transaction finished with the store.
 * A purchase the server has not confirmed is left unfinished, so the store
 * offers it again on the next launch or restore instead of losing it.
 *
 * Every purchase carries the Lyne account id (appAccountToken on iOS,
 * obfuscatedAccountId on Android), which is how the server refuses a
 * subscription bought from one account being used to unlock another.
 *
 * The product ids are the same in App Store Connect and Play Console.
 */
import { Platform } from 'react-native';
import {
  deepLinkToSubscriptions, fetchProducts, finishTransaction, getAvailablePurchases,
  initConnection, purchaseErrorListener, purchaseUpdatedListener, requestPurchase,
} from 'expo-iap';
import type { ProductSubscription, Purchase } from 'expo-iap';
import api from './apiClient';

export const PREMIUM_PRODUCTS = ['com.lyne.mobile.premium.monthly', 'com.lyne.mobile.premium.yearly'] as const;

let connected: Promise<boolean> | null = null;
function connect(): Promise<boolean> {
  if (!connected) connected = initConnection().then(() => true).catch(() => { connected = null; return false; });
  return connected;
}

export async function loadPremiumProducts(): Promise<ProductSubscription[]> {
  if (!(await connect())) return [];
  const products = await fetchProducts({ skus: [...PREMIUM_PRODUCTS], type: 'subs' });
  const list = (products || []) as ProductSubscription[];
  return [...list].sort((a, b) => PREMIUM_PRODUCTS.indexOf(a.id as never) - PREMIUM_PRODUCTS.indexOf(b.id as never));
}

/** Ask the server to confirm a purchase with the store; finish it only once confirmed. */
async function verifyAndFinish(purchase: Purchase): Promise<boolean> {
  if (!PREMIUM_PRODUCTS.includes(purchase.productId as never)) return false;
  const body = Platform.OS === 'ios'
    ? { platform: 'ios', product_id: purchase.productId, transaction_id: purchase.id }
    : { platform: 'android', product_id: purchase.productId, purchase_token: purchase.purchaseToken };
  try {
    await api.post('/iap/verify', body);
  } catch (err: any) {
    // Expired or refunded: nothing to keep open. Anything else: leave it for next time.
    if (err?.status === 410 || err?.status === 402) {
      await finishTransaction({ purchase, isConsumable: false }).catch(() => {});
    }
    throw err;
  }
  await finishTransaction({ purchase, isConsumable: false }).catch(() => {});
  return true;
}

/**
 * Start a subscription. Resolves when the server has confirmed it, rejects
 * with the store's or the server's message otherwise. Cancelling in the store
 * sheet rejects with { cancelled: true }.
 */
export function buyPremium(product: ProductSubscription, userId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const done = (fn: () => void) => { if (settled) return; settled = true; ok.remove(); bad.remove(); fn(); };
    const ok = purchaseUpdatedListener((purchase) => {
      if (purchase.productId !== product.id) return;
      verifyAndFinish(purchase).then(() => done(resolve), (err) => done(() => reject(err)));
    });
    const bad = purchaseErrorListener((error) => {
      const cancelled = /cancel/i.test(String(error.code)) || /cancel/i.test(error.message || '');
      done(() => reject(Object.assign(new Error(cancelled ? 'Purchase cancelled.' : error.message || 'The purchase did not go through.'), { cancelled })));
    });

    const offerToken = Platform.OS === 'android'
      ? (product.subscriptionOffers || []).find(o => o.offerTokenAndroid)?.offerTokenAndroid || undefined
      : undefined;
    connect().then((up) => {
      if (!up) throw new Error('The store is not available right now. Try again in a moment.');
      return requestPurchase({
        type: 'subs',
        request: {
          apple: { sku: product.id, appAccountToken: userId },
          google: {
            skus: [product.id],
            obfuscatedAccountId: userId,
            ...(offerToken ? { subscriptionOffers: [{ sku: product.id, offerToken }] } : {}),
          },
        },
      });
    }).catch((err) => done(() => reject(err)));
  });
}

/**
 * "Restore purchases": ask the store for this Apple ID / Google account's
 * subscriptions and have the server confirm each. Resolves true when Premium
 * was restored.
 */
export async function restorePremium(): Promise<boolean> {
  if (!(await connect())) throw new Error('The store is not available right now. Try again in a moment.');
  const purchases = (await getAvailablePurchases()) || [];
  let restored = false;
  let lastError: unknown = null;
  for (const p of purchases) {
    if (!PREMIUM_PRODUCTS.includes(p.productId as never)) continue;
    try { if (await verifyAndFinish(p)) restored = true; } catch (err) { lastError = err; }
  }
  if (!restored && lastError) throw lastError;
  return restored;
}

/** The store's own subscription management (change plan, cancel). */
export function manageSubscription(): Promise<void> {
  return deepLinkToSubscriptions({ skuAndroid: PREMIUM_PRODUCTS[0], packageNameAndroid: 'com.lyne.mobile' } as never).catch(() => {});
}
