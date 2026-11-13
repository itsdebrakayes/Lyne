/**
 * MfaStep — the second step of signing in, and setting it up (migration 053).
 *
 *   verify   the person has an authenticator app: enter its six-digit code
 *   enroll   they have none yet: scan a QR code, then confirm one code
 *
 * Talks to Supabase Auth directly (it holds the secret and checks the code);
 * when the code is right Supabase upgrades this session to "aal2", which is
 * what the Lyne API checks on every request (apps/backend/src/lib/mfa.js).
 * Used on the sign-in screen and, for setting it up by choice, in Settings.
 *
 * No text-message fallback, deliberately: SIM swaps defeat it. A lost phone is
 * reset by an executive (Settings → Two-Factor Sign-In).
 */
import { useEffect, useRef, useState } from 'react';
import { AlertCircle, KeyRound, Loader2, Smartphone } from 'lucide-react';
import { supabase } from '@/lib/apiClient';

type Props = {
  mode: 'verify' | 'enroll';
  /** Called once Supabase has accepted the code. */
  onDone: () => void;
  /** Sign out (on the sign-in screen) or close (in Settings). */
  onCancel: () => void;
  cancelLabel?: string;
  /** True on the sign-in screen when the organisation requires it; false when chosen in Settings. */
  required?: boolean;
};

const line = 'var(--qa-line, var(--c-line, #e3e7ee))';
const dim = 'var(--qa-dim, var(--c-dim, #5b6575))';
const input: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: 11, border: `1px solid ${line}`,
  background: 'var(--qa-surface-2, var(--c-surface-2, #f6f8fb))', color: 'inherit', outline: 'none',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 22, letterSpacing: '.35em', textAlign: 'center',
};

const qrSrc = (qr: string) => (qr.startsWith('data:') ? qr : `data:image/svg+xml;utf-8,${encodeURIComponent(qr)}`);
const grouped = (secret: string) => secret.replace(/(.{4})/g, '$1 ').trim();

export default function MfaStep({ mode, onDone, onCancel, cancelLabel = 'Sign out', required = false }: Props) {
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [preparing, setPreparing] = useState(true);
  const [error, setError] = useState('');
  const started = useRef(false);
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => {
    /* Once only: React's development double-run would otherwise enrol twice. */
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        const { data, error: listErr } = await supabase.auth.mfa.listFactors();
        if (listErr) throw listErr;
        if (mode === 'verify') {
          const f = data.totp.find((x) => x.status === 'verified');
          if (!f) throw new Error('No authenticator app is set up on this account. Ask an executive to reset your two-factor.');
          setFactorId(f.id);
        } else {
          /* A set-up abandoned half way leaves an unverified factor behind,
             which would block a new one with the same name. Clear those. */
          for (const f of data.all.filter((x) => x.status !== 'verified')) {
            await supabase.auth.mfa.unenroll({ factorId: f.id }).catch(() => {});
          }
          const { data: made, error: enrollErr } = await supabase.auth.mfa.enroll({
            factorType: 'totp',
            issuer: 'Lyne',
            friendlyName: `Lyne ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
          });
          if (enrollErr) throw enrollErr;
          setFactorId(made.id);
          setQr(made.totp.qr_code);
          setSecret(made.totp.secret);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not start two-factor. Try again.');
      } finally {
        setPreparing(false);
        window.setTimeout(() => field.current?.focus(), 50);
      }
    })();
  }, [mode]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!factorId || code.length !== 6) { setError('Enter the six-digit code.'); return; }
    setBusy(true);
    setError('');
    try {
      const { error: verifyErr } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
      if (verifyErr) throw verifyErr;
      onDone();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      setError(/invalid|expired|code/i.test(msg) ? 'That code is not right, or it has just changed. Enter the code showing now.' : (msg || 'Could not check the code.'));
      setCode('');
      field.current?.focus();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      {mode === 'enroll' ? (
        <>
          <p style={{ margin: '0 0 12px', fontSize: 13.5, lineHeight: 1.5 }}>
            {required ? 'Your organisation asks for a code from an authenticator app as well as your password. ' : ''}
            Open Microsoft Authenticator, Google Authenticator or 1Password on your phone, add an account, and scan this.
          </p>
          <div style={{ display: 'grid', placeItems: 'center', padding: 14, border: `1px solid ${line}`, borderRadius: 14, background: '#fff', marginBottom: 10, minHeight: 196 }}>
            {preparing ? <Loader2 size={22} className="qa-spin" /> : qr ? <img src={qrSrc(qr)} alt="QR code to add Lyne to your authenticator app" width={180} height={180} /> : <Smartphone size={28} color="#9aa3b2" />}
          </div>
          {secret ? (
            <p style={{ margin: '0 0 14px', fontSize: 12, color: dim, textAlign: 'center' }}>
              Can't scan? Type this key instead:<br />
              <code style={{ fontSize: 13, letterSpacing: '.06em', userSelect: 'all' }}>{grouped(secret)}</code>
            </p>
          ) : null}
        </>
      ) : (
        <p style={{ margin: '0 0 14px', fontSize: 13.5, lineHeight: 1.5, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <KeyRound size={17} style={{ flex: 'none', marginTop: 1 }} />
          <span>Open your authenticator app and enter the six-digit code for Lyne.</span>
        </p>
      )}

      {error ? (
        <div role="alert" style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, padding: '10px 12px', borderRadius: 10, fontSize: 12.5, fontWeight: 600, background: 'var(--qa-neg-soft, var(--c-bad-soft, #f9e7e6))', color: 'var(--qa-neg, var(--c-bad, #a62b25))' }}>
          <AlertCircle size={16} /><span>{error}</span>
        </div>
      ) : null}

      <form onSubmit={submit}>
        <label style={{ display: 'block', marginBottom: 12 }}>
          <span style={{ display: 'block', color: dim, fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
            {mode === 'enroll' ? 'Code from the app, to confirm' : 'Six-digit code'}
          </span>
          <input
            ref={field}
            style={input}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            aria-label="Six-digit code"
            disabled={preparing || !factorId}
          />
        </label>
        <button className="qa-login-submit" type="submit" disabled={busy || preparing || !factorId || code.length !== 6} style={{ width: '100%' }}>
          {busy ? <Loader2 size={16} className="qa-spin" /> : null}
          {busy ? 'Checking' : mode === 'enroll' ? 'Turn On Two-Factor' : 'Continue'}
        </button>
      </form>
      <button type="button" onClick={onCancel} style={{ display: 'block', margin: '14px auto 0', background: 'none', border: 0, color: dim, fontSize: 12.5, cursor: 'pointer', textDecoration: 'underline' }}>
        {cancelLabel}
      </button>
    </div>
  );
}
