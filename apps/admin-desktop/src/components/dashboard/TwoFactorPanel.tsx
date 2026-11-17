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
type OrgStaff = { id: string; full_name: string; role: string; branch_name: string | null; must_use: boolean; could_use: boolean; has_login: boolean; enrolled: boolean | null; is_you: boolean };
type Org = { require_2fa: boolean; checked: boolean; truncated: boolean; branches: { id: string; name: string; require_2fa: boolean }[]; staff: OrgStaff[] };

const ROLE: Record<string, string> = { executive: 'Executive', manager: 'Manager', supervisor: 'Supervisor', line_staff: 'Desk Staff' };
const pill = (on: boolean | null) => ({
  display: 'inline-block', padding: '2px 9px', borderRadius: 999, fontSize: 11.5, fontWeight: 700,
  background: on ? 'var(--c-primary-soft, #e6efff)' : 'var(--c-surface-2, #f1f3f7)',
  color: on ? 'var(--c-primary, #1b4b8f)' : 'var(--c-dim, #5b6575)',
});

type BranchView = { branch_id: string; branch_name: string; require_2fa: boolean; org_requires: boolean; checked: boolean;
  staff: { id: string; full_name: string; role: string; has_login: boolean; enrolled: boolean | null; must_use: boolean; is_you: boolean }[] };

/** A manager's switch for THEIR branch only (the server refuses any other).
 *  Covers that branch's supervisors and managers, the manager included. */
export function BranchTwoFactorPanel({ span = 12 }: { span?: number }) {
  const qc = useQueryClient();
  const view = useQuery({ queryKey: ['mfa-branch'], queryFn: () => api.get<BranchView>('/auth/mfa/branch') });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'bad' | 'ok'; text: string } | null>(null);
  const v = view.data;

  const flip = async () => {
    if (!v) return;
    const next = !v.require_2fa;
    const ask = next
      ? `Require two-factor at ${v.branch_name}? Its supervisors and managers, you included, will set up an authenticator app (Microsoft Authenticator, Google Authenticator or 1Password) at their next sign-in. You will be taken there now. Have your phone ready. Other branches are not affected.`
      : `Stop requiring two-factor at ${v.branch_name}?`;
    if (!window.confirm(ask)) return;
    setBusy(true); setMessage(null);
    try {
      await api.put('/auth/mfa/branch', { require_2fa: next });
      await qc.invalidateQueries({ queryKey: ['mfa-branch'] });
      setMessage({ tone: 'ok', text: next ? `Two-factor is now required at ${v.branch_name}.` : `Two-factor is no longer required at ${v.branch_name}.` });
      if (next) window.dispatchEvent(new Event('lyne:mfa'));
    } catch (err) {
      setMessage({ tone: 'bad', text: err instanceof Error ? err.message : 'Could not change the setting.' });
    } finally { setBusy(false); }
  };

  const cell = { padding: '8px 10px', fontSize: 12.5, borderTop: '1px solid var(--c-line)', textAlign: 'left' as const };
  return (
    <Card span={span} title="Two-Factor For Your Branch"
      cap="Off until switched on. Then this branch's supervisors and managers set up an authenticator app at their next sign-in and enter its code after their password. Only this branch; other branches and organisations are not affected."
      tools={v && !v.org_requires ? (
        <button type="button" className={v.require_2fa ? 'qx-btn ghost' : 'qx-btn'} disabled={busy} onClick={flip}>
          {v.require_2fa ? 'Stop Requiring' : 'Require Two-Factor'}
        </button>
      ) : null}>
      {view.isLoading ? <div style={{ color: 'var(--c-dim)', fontSize: 12.5 }}>Loading…</div>
        : view.error ? <Note icon={ShieldAlert} tone="bad" title="Could not load two-factor settings" body={(view.error as Error).message} />
        : v ? (
          <>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
              <span style={pill(v.require_2fa || v.org_requires)}>{v.org_requires ? 'Required organisation-wide' : v.require_2fa ? 'Required at this branch' : 'Not required'}</span>
              {v.org_requires ? <span style={{ color: 'var(--c-dim)', fontSize: 12.5 }}>Your executive requires it for the whole organisation.</span> : null}
            </div>
            {message ? <div role="status" style={{ fontSize: 12.5, marginBottom: 10, color: message.tone === 'bad' ? 'var(--c-bad, #a62b25)' : 'var(--c-primary, #1b4b8f)' }}>{message.text}</div> : null}
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {v.staff.map((p) => (
                  <tr key={p.id}>
                    <td style={cell}><b>{p.full_name}</b>{p.is_you ? <span style={{ color: 'var(--c-dim)' }}> (you)</span> : null}</td>
                    <td style={cell}>{ROLE[p.role] || p.role}</td>
                    <td style={cell}>
                      {!p.has_login ? <span style={pill(false)}>No sign-in yet</span>
                        : p.enrolled === null ? <span style={pill(false)}>Unknown</span>
                        : <span style={pill(p.enrolled)}>{p.enrolled ? 'Set up' : p.must_use ? 'Sets up at next sign-in' : 'Not set up'}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : null}
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

  const flipBranch = async (b: { id: string; name: string; require_2fa: boolean }) => {
    const next = !b.require_2fa;
    if (!window.confirm(next
      ? `Require two-factor at ${b.name} only? Its supervisors and managers set it up at their next sign-in. Other branches are not affected.`
      : `Stop requiring two-factor at ${b.name}?`)) return;
    setBusy(b.id); setMessage(null);
    try {
      await api.put('/auth/mfa/branch', { branch_id: b.id, require_2fa: next });
      await qc.invalidateQueries({ queryKey: ['mfa-org'] });
      setMessage({ tone: 'ok', text: next ? `Two-factor is now required at ${b.name}.` : `Two-factor is no longer required at ${b.name}.` });
    } catch (err) {
      setMessage({ tone: 'bad', text: err instanceof Error ? err.message : 'Could not change the setting.' });
    } finally { setBusy(null); }
  };

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
                {mustUse.length ? `${mustUse.length - missing.length} of the ${mustUse.length} people who must use it have set it up.` : 'Nobody is required to use it yet.'}
              </span>
            </div>
            {message ? <div role="status" style={{ fontSize: 12.5, marginBottom: 10, color: message.tone === 'bad' ? 'var(--c-bad, #b42318)' : 'var(--c-primary, #1b4b8f)' }}>{message.text}</div> : null}
            {!o.require_2fa && o.branches.length ? (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--c-dim)', marginBottom: 6 }}>Or one branch at a time</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {o.branches.map((b) => (
                    <button key={b.id} type="button" className={b.require_2fa ? 'qx-btn' : 'qx-btn ghost'} disabled={busy !== null} onClick={() => flipBranch(b)}
                      aria-pressed={b.require_2fa} title={b.require_2fa ? 'Required here. Click to stop.' : 'Not required here. Click to require.'}>
                      {b.name}{b.require_2fa ? ' · Required' : ''}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
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
                          : <span style={pill(p.enrolled)}>{p.enrolled ? 'Set up' : p.must_use ? 'Sets up at next sign-in' : p.could_use ? 'Not required' : 'Never asked'}</span>}
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
