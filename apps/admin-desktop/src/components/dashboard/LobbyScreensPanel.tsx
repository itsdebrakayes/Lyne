/**
 * LobbyScreensPanel — "Now Serving" screens for the waiting room.
 *
 * A screen is a web page with its own private link. It runs on whatever the
 * branch already has: open the link in a smart TV's browser, a streaming stick
 * or a spare PC, or paste the embed code into existing signage software. It
 * shows ticket numbers and counters only, never names. A manager creates and
 * switches off screens for their own branch; an executive for any branch.
 * (migration 052; GET/POST/DELETE /api/displays)
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Copy, ExternalLink, MonitorPlay, Trash2, Tv } from 'lucide-react';
import api, { API_URL } from '@/lib/apiClient';
import { Card, Note } from '@/design/ui';

type Screen = {
  id: string; branch_id: string; service_id: string | null; service_name: string | null;
  name: string; path: string; created_at: string; created_by: string | null; last_seen_at: string | null;
};

/** The API lives at <origin>/api; screens are served from the same origin. */
const ORIGIN = API_URL.replace(/\/api\/?$/, '');
const linkOf = (s: Screen) => `${ORIGIN}${s.path}`;
const embedOf = (s: Screen) => `<iframe src="${linkOf(s)}" style="width:100%;height:100%;border:0" allow="autoplay"></iframe>`;

function lastSeen(iso: string | null) {
  if (!iso) return 'Not opened yet';
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 3) return 'On now';
  if (minutes < 90) return `Last on ${minutes} min ago`;
  return `Last on ${new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`;
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* clipboard refused: the link is still shown */ }
  };
  return (
    <button type="button" className="qx-btn ghost" onClick={copy}>
      {copied ? <Check size={14} /> : <Copy size={14} />}{copied ? 'Copied' : label}
    </button>
  );
}

export function LobbyScreensPanel({ span = 12, branches, services }: {
  span?: number;
  /** Executives choose a branch; a manager's own branch is used when absent. */
  branches?: Array<{ id: string; name: string }>;
  services?: Array<{ id: string; name: string }>;
}) {
  const qc = useQueryClient();
  const [branchId, setBranchId] = useState(branches?.[0]?.id || '');
  const [name, setName] = useState('');
  const [serviceId, setServiceId] = useState('');
  const key = ['lobby-screens', branchId];
  const needsBranch = Boolean(branches);
  const list = useQuery({
    queryKey: key,
    enabled: !needsBranch || Boolean(branchId),
    queryFn: () => api.get<{ displays: Screen[] }>(`/displays${branchId ? `?branch_id=${encodeURIComponent(branchId)}` : ''}`),
  });
  const create = useMutation({
    mutationFn: () => api.post<Screen>('/displays', {
      ...(branchId ? { branch_id: branchId } : {}), name: name.trim(), ...(serviceId ? { service_id: serviceId } : {}),
    }),
    onSuccess: () => { setName(''); setServiceId(''); qc.invalidateQueries({ queryKey: key }); },
  });
  const revoke = useMutation({
    mutationFn: (id: string) => api.delete<{ revoked: boolean }>(`/displays/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });
  const [confirming, setConfirming] = useState<string | null>(null);

  const screens = list.data?.displays ?? [];
  const field = { padding: '9px 11px', borderRadius: 11, border: '1px solid var(--c-line)', background: 'var(--c-surface)', color: 'var(--c-text)', fontSize: 13 } as const;

  return (
    <Card span={span} title="Lobby Screens" cap="A Now Serving screen for the waiting room. It runs on a TV or signage player you already have: open its link in the browser, or paste the embed code into your signage software. It shows ticket numbers and counters, never names.">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <form style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}
          onSubmit={(e) => { e.preventDefault(); if (name.trim() && !create.isPending) create.mutate(); }}>
          {branches ? (
            <select aria-label="Branch" value={branchId} onChange={(e) => setBranchId(e.target.value)} style={field}>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          ) : null}
          <input aria-label="Screen name" placeholder="Name this screen, e.g. Main Hall" value={name} maxLength={80}
            onChange={(e) => setName(e.target.value)} style={{ ...field, flex: '1 1 220px' }} />
          {services?.length ? (
            <select aria-label="What it shows" value={serviceId} onChange={(e) => setServiceId(e.target.value)} style={field}>
              <option value="">Every line at the branch</option>
              {services.map((s) => <option key={s.id} value={s.id}>Only {s.name}</option>)}
            </select>
          ) : null}
          <button type="submit" className="qx-btn" disabled={!name.trim() || create.isPending || (needsBranch && !branchId)}>
            <Tv size={14} />{create.isPending ? 'Creating…' : 'Create Screen'}
          </button>
          {create.error ? <span role="alert" style={{ color: 'var(--c-bad)', fontSize: 12 }}>{(create.error as Error).message}</span> : null}
        </form>

        {list.isLoading ? (
          <div style={{ color: 'var(--c-dim)', fontSize: 12.5 }}>Loading screens…</div>
        ) : list.error ? (
          <Note icon={MonitorPlay} tone="bad" title="Could not load the lobby screens" body={(list.error as Error).message} />
        ) : !screens.length ? (
          <Note icon={MonitorPlay} title="No Screens Yet"
            body="Name one above and create it. You will get a link to open on the TV, and an embed code for signage software." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {screens.map((s) => (
              <div key={s.id} style={{ border: '1px solid var(--c-line)', borderRadius: 14, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 9 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'baseline' }}>
                  <div style={{ minWidth: 0 }}>
                    <b style={{ fontSize: 13.5 }}>{s.name}</b>
                    <span style={{ color: 'var(--c-dim)', fontSize: 12, marginLeft: 8 }}>{s.service_name ? `Only ${s.service_name}` : 'Every line'} · {lastSeen(s.last_seen_at)}</span>
                  </div>
                </div>
                <input readOnly aria-label={`Link for ${s.name}`} value={linkOf(s)} onFocus={(e) => e.currentTarget.select()}
                  style={{ ...field, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11.5, width: '100%' }} />
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <CopyButton text={linkOf(s)} label="Copy Link" />
                  <CopyButton text={embedOf(s)} label="Copy Embed Code" />
                  <a className="qx-btn ghost" href={linkOf(s)} target="_blank" rel="noreferrer"><ExternalLink size={14} />Preview</a>
                  {confirming === s.id ? (
                    <>
                      <button type="button" className="qx-btn" disabled={revoke.isPending}
                        onClick={() => revoke.mutate(s.id, { onSettled: () => setConfirming(null) })}>
                        {revoke.isPending ? 'Switching Off…' : 'Yes, Switch It Off'}
                      </button>
                      <button type="button" className="qx-btn ghost" onClick={() => setConfirming(null)}>Keep It</button>
                      <span style={{ color: 'var(--c-dim)', fontSize: 12 }}>The link stops working on every TV using it.</span>
                    </>
                  ) : (
                    <button type="button" className="qx-btn ghost" onClick={() => setConfirming(s.id)}><Trash2 size={14} />Switch Off</button>
                  )}
                </div>
              </div>
            ))}
            <div style={{ color: 'var(--c-dim)', fontSize: 12 }}>
              Anyone with a screen's link can see what it shows, so treat it like the screen itself. Add <code>?sound=0</code> to the link for no chime, or <code>?lines=0</code> to show only the numbers being called.
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
