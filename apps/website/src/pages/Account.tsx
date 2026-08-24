/**
 * Account.tsx — the subscription portal.
 *
 * Reached only from the app. There is no link to it in the nav, the footer or
 * the sitemap, and typing the URL renders the same 404 as any other unknown
 * path: no form, no "session expired", nothing that confirms the address is
 * real. The handoff token from the app is what makes the page exist.
 *
 * Three states, in order:
 *   locked   — no valid handoff. Renders <NotFound />, indistinguishable.
 *   signIn   — handoff accepted, but we still ask who you are. The token
 *              proves where you came from, never who you are: a link that
 *              signs you in is a link that signs in whoever finds it.
 *   portal   — plan, price, renewal date, and the two Stripe handoffs.
 */
import * as React from 'react';
import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import NotFound from './NotFound';
import { MarketingFooter } from '@/components/lyne/Marketing';
import {
  supabase, ensureUnlocked,
  getSubscription, getPlans, startCheckout, openBillingPortal, formatDate,
  type SubscriptionState, type PlanOption,
} from '@/lib/account';

type Gate = 'checking' | 'locked' | 'open';

export default function Account() {
  const [gate, setGate] = useState<Gate>('checking');
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    let cancelled = false;

    /* One shared promise, so StrictMode's double-invoke cannot spend the
       single-use token on the first pass and lock the page on the second.
       See ensureUnlocked() in lib/account.ts. */
    ensureUnlocked().then((open) => {
      if (!cancelled) setGate(open ? 'open' : 'locked');
    });

    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) setSession(data.session);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, []);

  /* Render nothing at all while deciding. A flash of a login form before the
     404 would give away exactly what the 404 is there to hide. */
  if (gate === 'checking') return null;
  if (gate === 'locked') return <NotFound />;

  return (
    <div className="min-h-screen bg-background">
      <main className="lux-container pb-24 pt-16">
        <div className="mx-auto max-w-xl">
          {session ? <Portal session={session} /> : <SignIn />}
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}

/* ── sign in ─────────────────────────────────────────────────────────────── */

function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError('');
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) setError(authError.message || 'Could not sign you in.');
    setBusy(false);
  };

  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight">Sign in to manage Lyne Premium</h1>
      <p className="mt-3 text-muted-foreground">
        Use the same email and password as the app.
      </p>

      <form onSubmit={submit} className="mt-8 flex flex-col gap-4">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold">Email</span>
          <input
            type="email" required autoComplete="email" value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-12 rounded-xl border border-white/10 bg-white/[0.04] px-4 outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold">Password</span>
          <input
            type="password" required autoComplete="current-password" value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-12 rounded-xl border border-white/10 bg-white/[0.04] px-4 outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
        </label>

        {error && <p role="alert" className="text-sm font-semibold text-red-400">{error}</p>}

        <button
          type="submit" disabled={busy}
          className="mt-2 flex h-12 items-center justify-center rounded-xl bg-primary font-semibold text-primary-foreground disabled:opacity-60"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </>
  );
}

/* ── the portal ──────────────────────────────────────────────────────────── */

function Portal({ session }: { session: Session }) {
  const [sub, setSub] = useState<SubscriptionState | null>(null);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [saving, setSaving] = useState(0);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const [s, p] = await Promise.all([getSubscription(), getPlans()]);
      setSub(s); setPlans(p.plans); setSaving(p.yearly_saving_cents);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your subscription.');
    }
  };
  useEffect(() => { load(); }, []);

  const go = async (fn: () => Promise<{ url: string }>, key: string) => {
    setBusy(key); setError('');
    try {
      const { url } = await fn();
      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      setBusy('');
    }
  };

  const tier = sub?.is_subscribed ? 'Premium' : 'Free';

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Your account</h1>
          <p className="mt-2 text-sm text-muted-foreground">{session.user.email}</p>
        </div>
        <button
          onClick={() => supabase.auth.signOut()}
          className="text-sm font-semibold text-muted-foreground underline hover:text-foreground"
        >
          Sign out
        </button>
      </div>

      <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Current plan</div>
        <div className="mt-2 text-2xl font-bold">{tier}</div>

        {sub?.is_subscribed && (
          <div className="mt-3 text-sm text-muted-foreground">
            {sub.price_label}
            {/* Two different sentences, because these are two different facts.
                Printing "renews on" over what is actually the last day of
                access is the lie this split exists to prevent. */}
            {sub.cancel_at_period_end
              ? <> · ends {formatDate(sub.access_until)}, and you will not be charged again</>
              : sub.renews_on ? <> · renews {formatDate(sub.renews_on)}</> : null}
          </div>
        )}

        {sub?.status === 'past_due' && (
          <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
            We could not take your last payment. You still have access — update your card to keep it.
          </p>
        )}
      </div>

      {error && <p role="alert" className="mt-4 text-sm font-semibold text-red-400">{error}</p>}

      {!sub?.is_subscribed ? (
        <div className="mt-8">
          <h2 className="text-lg font-bold">Upgrade to Premium</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Tell Lyne what you need to do and it works out the best times to go.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {plans.map((p) => (
              <button
                key={p.id}
                disabled={!!busy}
                onClick={() => go(() => startCheckout(p.id), p.id)}
                className="flex flex-col items-start gap-1 rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-left transition hover:border-primary/60 disabled:opacity-60"
              >
                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  {p.interval === 'year' ? 'Yearly' : 'Monthly'}
                </span>
                <span className="text-xl font-bold">{p.label}</span>
                {p.interval === 'year' && saving > 0 && (
                  <span className="text-sm font-semibold text-primary">
                    Save ${(saving / 100).toFixed(0)} — two months free
                  </span>
                )}
                <span className="mt-2 text-sm text-muted-foreground">
                  {busy === p.id ? 'Opening Stripe…' : 'Choose this plan'}
                </span>
              </button>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Payment is handled by Stripe. Cancel any time — you keep what you have paid for.
          </p>
        </div>
      ) : (
        <div className="mt-8">
          <h2 className="text-lg font-bold">Manage your subscription</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Change your plan or card, cancel, or download invoices.
          </p>
          {/* One button, straight to Stripe. No retention flow, no chain of
              "are you sure", no support ticket — cancelling is as easy as
              subscribing was, which is the whole commitment. */}
          <button
            disabled={!!busy}
            onClick={() => go(openBillingPortal, 'portal')}
            className="mt-5 flex h-12 w-full items-center justify-center rounded-xl bg-primary font-semibold text-primary-foreground disabled:opacity-60"
          >
            {busy === 'portal' ? 'Opening Stripe…' : 'Manage or cancel subscription'}
          </button>
        </div>
      )}
    </>
  );
}
