/**
 * DataExportPanel — the executive downloads everything their organisation owns.
 *
 * "Your data is yours" has to be something an executive can do on their own:
 * one button, one .zip of spreadsheet files (GET/POST /api/export/organisation,
 * executive only, every download written to the audit log). The list shows what
 * is in it before anything is downloaded.
 */
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FileSpreadsheet, ShieldCheck } from 'lucide-react';
import api, { downloadFile } from '@/lib/apiClient';
import { Card, Note } from '@/design/ui';

type Summary = {
  files: Array<{ file: string; about: string; rows: number }>;
  total_rows: number;
  last_exported_at: string | null;
  last_exported_by: string | null;
};

const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const n = (v: number) => v.toLocaleString('en-JM');
/** visit_events.csv -> Visit Events */
const label = (file: string) => file.replace(/\.csv$/, '').split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

export function DataExportPanel({ span = 12 }: { span?: number }) {
  const qc = useQueryClient();
  const summary = useQuery({ queryKey: ['organisation-export'], queryFn: () => api.get<Summary>('/export/organisation') });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const download = async () => {
    setBusy(true); setError(null); setDone(null);
    try {
      const { blob, filename } = await downloadFile('POST', '/export/organisation');
      const name = filename || `lyne-export-${new Date().toISOString().slice(0, 10)}.zip`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = name;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setDone(name);
      qc.invalidateQueries({ queryKey: ['organisation-export'] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The export could not be made.');
    } finally {
      setBusy(false);
    }
  };

  const filled = summary.data?.files.filter((f) => f.rows > 0) ?? [];

  return (
    <Card span={span} title="Your Data" cap="A full copy of your organisation's records, as spreadsheet files in one download. The records are yours; you do not need to ask us for them.">
      {summary.isLoading ? (
        <div style={{ color: 'var(--c-dim)', fontSize: 12.5 }}>Counting your records…</div>
      ) : summary.error ? (
        <Note icon={FileSpreadsheet} tone="bad" title="Could not read your records" body="Check your connection and reopen Settings." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '6px 18px' }}>
            {filled.map((f) => (
              <div key={f.file} title={f.about} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12.5, minWidth: 0 }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label(f.file)}</span>
                <b style={{ flex: 'none', fontVariantNumeric: 'tabular-nums' }}>{n(f.rows)}</b>
              </div>
            ))}
          </div>
          <Note icon={ShieldCheck} title="What Is Not Included"
            body="Passwords, sign-in identifiers and verification codes are never exported, and neither are app users' own email addresses and phone numbers. Every download is recorded in your audit log." />
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="button" className="qx-btn" disabled={busy} onClick={download}>
              <Download size={14} />{busy ? 'Preparing Your Export…' : `Download Everything (${n(summary.data!.total_rows)} Records)`}
            </button>
            {error ? <span role="alert" style={{ color: 'var(--c-bad)', fontSize: 12 }}>{error}</span> : null}
            {done ? <span role="status" style={{ color: 'var(--c-dim)', fontSize: 12 }}>Saved as {done}.</span> : null}
            {!error && !done && summary.data?.last_exported_at ? (
              <span style={{ color: 'var(--c-dim)', fontSize: 12 }}>
                Last downloaded {when(summary.data.last_exported_at)}{summary.data.last_exported_by ? ` by ${summary.data.last_exported_by}` : ''}.
              </span>
            ) : null}
          </div>
        </div>
      )}
    </Card>
  );
}
