/**
 * Two-factor sign-in in Settings (migration 053).
 *
 *   MyTwoFactorPanel    manager: is it required, read only
 *   OrgTwoFactorPanel   executive: require it for supervisors, managers and
 *                       executives; see who has set it up; reset a lost phone
 *
 * Off by default. Nobody switches it on for themselves: once the executive
 * requires it, each person it covers (the executive too) sets up their
 * authenticator app on the sign-in screen at their next sign-in. The rules
 * live on the server (apps/backend/src/lib/mfa.js, routes/mfa.js).
 */
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, ShieldAlert } from 'lucide-react';
import api from '@/lib/apiClient';
import { Card, Note } from '@/design/ui';
import { MICROSOFT_ENABLED, connectMicrosoft, disconnectMicrosoft, microsoftIdentity } from '@/lib/microsoftSignIn';

type Status = { applies: boolean; org_requires: boolean; enrolled: boolean; required: boolean; aal: string | null; satisfied: boolean };
type OrgStaff = { id: string; full_name: string; role: string; branch_name: string | null; must_use: boolean; has_login: boolean; enrolled: boolean | null; is_you: boolean };
type Org = { require_2fa: boolean; checked: boolean; truncated: boolean; staff: OrgStaff[] };

const ROLE: Record<string, string> = { executive: 'Executive', manager: 'Manager', supervisor: 'Supervisor', line_staff: 'Desk Staff' };
const pill = (on: boolean | null) => ({
  display: 'inline-block', padding: '2px 9px', borderRadius: 999, fontSize: 11.5, fontWeight: 700,
  background: on ? 'var(--c-primary-soft, #e6efff)' : 'var(--c-surface-2, #f1f3f7)',
  color: on ? 'var(--c-primary, #1b4b8f)' : 'var(--c-dim, #5b6575)',
});

/** A manager's view: whether their organisation requires it, and whether they
 *  have set it up. Read only: the executive decides, and set-up happens on the
 *  sign-in screen. */
export function MyTwoFactorPanel({ span = 12 }: { span?: number }) {
  const status = useQuery({ queryKey: ['mfa-status'], queryFn: () => api.get<Status>('/auth/mfa/status') });
  const s = status.data;
  return (
    <Card span={span} title="Two-Factor Sign-In" cap="A six-digit code from an authenticator app on your phone after your password. Your organisation's executive decides whether it is required.">
      {status.isLoading ? <div style={{ color: 'var(--c-dim)', fontSize: 12.5 }}>Checking…</div>
        : status.error ? <Note icon={ShieldAlert} tone="bad" title="Could not check two-factor" body={(status.error as Error).message} />
        : s?.required ? (
          <Note icon={ShieldCheck} title="Required by your organisation" body="You enter a code from your authenticator app each time you sign in. Lost your phone? Ask an executive to reset it." />
        ) : (
          <Note icon={ShieldAlert} title="Not required" body="Your organisation has not switched two-factor on. If it does, you will set it up at your next sign-in." />
        )}
    </Card>
  );
}

export function OrgTwoFactorPanel({ span = 12 }: { span?: number }) {
  const qc = useQueryClient();
  const org = useQuery({ queryKey: ['mfa-org'], queryFn: () => api.get<Org>('/auth/mfa/organisation') });
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'bad' | 'ok'; text: string } | null>(null);
  const o = org.data;
  const mustUse = o?.staff.filter((x) => x.must_use) ?? [];
  const missing = mustUse.filter((x) => x.enrolled === false);

  const flip = async () => {
    if (!o) return;
    const next = !o.require_2fa;
    const ask = next
      ? 'Require two-factor for every supervisor, manager and executive? Each of them, you included, will be taken to set up an authenticator app (Microsoft Authenticator, Google Authenticator or 1Password) the next time they sign in. You will be taken there now. Have your phone ready.'
      : 'Stop requiring two-factor? Everyone signs in with their password only.';
    if (!window.confirm(ask)) return;
    setBusy('switch'); setMessage(null);
    try {
      await api.put('/auth/mfa/organisation', { require_2fa: next });
      await qc.invalidateQueries({ queryKey: ['mfa-org'] });
      await qc.invalidateQueries({ queryKey: ['mfa-status'] });
      setMessage({ tone: 'ok', text: next ? 'Two-factor is now required.' : 'Two-factor is no longer required.' });
      // Switched on: the executive sets theirs up now, on the sign-in card.
      if (next) window.dispatchEvent(new Event('lyne:mfa'));
    } catch (err) {
      setMessage({ tone: 'bad', text: err instanceof Error ? err.message : 'Could not change the setting.' });
    } finally { setBusy(null); }
  };

  const reset = async (person: OrgStaff) => {
    if (!window.confirm(`Reset two-factor for ${person.full_name}? Use this when they have lost their phone. They are signed out everywhere and set it up again at their next sign-in.`)) return;
    setBusy(person.id); setMessage(null);
    try {
      await api.post('/auth/mfa/reset', { staff_id: person.id });
      await qc.invalidateQueries({ queryKey: ['mfa-org'] });
      setMessage({ tone: 'ok', text: `Two-factor reset for ${person.full_name}.` });
    } catch (err) {
      setMessage({ tone: 'bad', text: err instanceof Error ? err.message : 'Could not reset.' });
    } finally { setBusy(null); }
  };

  const cell = { padding: '8px 10px', fontSize: 12.5, borderTop: '1px solid var(--c-line)', textAlign: 'left' as const };
  const head = { ...cell, borderTop: 0, fontSize: 10.5, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase' as const, color: 'var(--c-dim)' };

  return (
    <Card span={span} title="Two-Factor For Your Organisation"
      cap="Off until you switch it on. Then every supervisor, manager and executive sets up an authenticator app at their next sign-in and enters its code after their password from then on. Lyne's server checks it on every request. Desk staff and kiosks are not asked."
      tools={o ? (
        <button type="button" className={o.require_2fa ? 'qx-btn ghost' : 'qx-btn'} disabled={busy !== null} onClick={flip}>
          {o.require_2fa ? 'Stop Requiring' : 'Require Two-Factor'}
        </button>
      ) : null}>
      {org.isLoading ? <div style={{ color: 'var(--c-dim)', fontSize: 12.5 }}>Loading…</div>
        : org.error ? <Note icon={ShieldAlert} tone="bad" title="Could not load two-factor settings" body={(org.error as Error).message} />
        : o ? (
          <>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
              <span style={pill(o.require_2fa)}>{o.require_2fa ? 'Required' : 'Not required'}</span>
              <span style={{ color: 'var(--c-dim)', fontSize: 12.5 }}>
                {mustUse.length - missing.length} of {mustUse.length} supervisors, managers and executives have set it up.
              </span>
            </div>
            {message ? <div role="status" style={{ fontSize: 12.5, marginBottom: 10, color: message.tone === 'bad' ? 'var(--c-bad, #b42318)' : 'var(--c-primary, #1b4b8f)' }}>{message.text}</div> : null}
            {!o.checked ? <Note icon={ShieldAlert} tone="warn" title="Set-up status unavailable" body="This server cannot read who has set up two-factor. The switch still works." /> : null}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><th style={head}>Name</th><th style={head}>Role</th><th style={head}>Branch</th><th style={head}>Two-Factor</th><th style={head} /></tr></thead>
                <tbody>
                  {o.staff.map((p) => (
                    <tr key={p.id}>
                      <td style={cell}><b>{p.full_name}</b>{p.is_you ? <span style={{ color: 'var(--c-dim)' }}> (you)</span> : null}</td>
                      <td style={cell}>{ROLE[p.role] || p.role}</td>
                      <td style={{ ...cell, color: 'var(--c-dim)' }}>{p.branch_name || 'All branches'}</td>
                      <td style={cell}>
                        {!p.has_login ? <span style={pill(false)}>No sign-in yet</span>
                          : p.enrolled === null ? <span style={pill(false)}>Unknown</span>
                          : <span style={pill(p.enrolled)}>{p.enrolled ? 'Set up' : !p.must_use ? 'Not needed' : o.require_2fa ? 'Sets up at next sign-in' : 'Not set up'}</span>}
                      </td>
                      <td style={{ ...cell, textAlign: 'right' }}>
                        {p.enrolled && !p.is_you ? (
                          <button type="button" className="qx-btn ghost" disabled={busy !== null} onClick={() => reset(p)}>{busy === p.id ? 'Resetting…' : 'Reset'}</button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {o.truncated ? <div style={{ color: 'var(--c-dim)', fontSize: 12, marginTop: 8 }}>Showing the first 300 people.</div> : null}
          </>
        ) : null}
    </Card>
  );
}

/**
 * Connect a Microsoft work account to this Lyne login, so "Sign in with
 * Microsoft" opens it (lib/microsoftSignIn.ts). Done while signed in, which is
 * what proves the Microsoft account belongs to this person; Lyne never matches
 * a Microsoft sign-in to staff by email.
 */
export function MicrosoftAccountPanel({ span = 12 }: { span?: number }) {
  const qc = useQueryClient();
  const linked = useQuery({ queryKey: ['ms-identity'], queryFn: microsoftIdentity, enabled: MICROSOFT_ENABLED });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!MICROSOFT_ENABLED) return null;
  const email = (linked.data?.identity_data as { email?: string } | undefined)?.email;

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true); setError('');
    try { await fn(); await qc.invalidateQueries({ queryKey: ['ms-identity'] }); }
    catch (err) { setError(err instanceof Error ? err.message : 'Something went wrong.'); }
    finally { setBusy(false); }
  };

  return (
    <Card span={span} title="Microsoft Account" cap="Connect your work Microsoft account and you can use Sign in with Microsoft instead of your Lyne password. Your organisation's own Microsoft rules (password, two-step, leavers) then apply.">
      {linked.isLoading ? <div style={{ color: 'var(--c-dim)', fontSize: 12.5 }}>Checking…</div>
        : linked.data ? (
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <Note icon={ShieldCheck} title="Connected" body={email ? `Signed in as ${email} at Microsoft.` : 'A Microsoft account is connected.'} />
            <button type="button" className="qx-btn ghost" disabled={busy}
              onClick={() => { if (window.confirm('Disconnect Microsoft? You will sign in with your Lyne email and password.')) act(disconnectMicrosoft); }}>
              Disconnect
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <Note icon={ShieldAlert} title="Not connected" body="You sign in with your Lyne email and password." />
            <button type="button" className="qx-btn" disabled={busy} onClick={() => act(connectMicrosoft)}>
              {busy ? 'Waiting for Microsoft…' : 'Connect Microsoft'}
            </button>
          </div>
        )}
      {error ? <div style={{ color: 'var(--c-bad, #a62b25)', fontSize: 12.5, marginTop: 8 }}>{error}</div> : null}
    </Card>
  );
}
