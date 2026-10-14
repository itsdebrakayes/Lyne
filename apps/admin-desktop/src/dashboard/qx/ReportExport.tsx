/**
 * The two pieces every Reports tab shares: the Word / PDF buttons, and a
 * preview that shows the document they will produce.
 *
 * The buttons used to be bare <button>s with no handler, so pressing them did
 * nothing at all. They now save the document built in ../reportDoc.ts.
 */
import { useState } from 'react';
import { Download, FileText } from 'lucide-react';
import { saveReport } from '../reportDoc';

export function ReportDownloadButtons({ html, filename, trailing }: {
  html: string; filename: string; trailing?: React.ReactNode;
}) {
  const [busy, setBusy] = useState<'doc' | 'pdf' | null>(null);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);

  const run = async (format: 'doc' | 'pdf') => {
    setBusy(format); setMsg(null);
    try {
      const res = await saveReport(html, filename, format);
      if (res.ok) {
        const where = res.path ? ` Saved to ${res.path}.` : '';
        setMsg({ tone: 'ok', text: `${format === 'pdf' ? 'PDF' : 'Word document'} ready.${where}` });
      } else {
        setMsg({ tone: 'bad', text: res.error });
      }
    } catch (err) {
      setMsg({ tone: 'bad', text: err instanceof Error ? err.message : 'The report could not be saved.' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 9, alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" className="qx-btn" onClick={() => run('doc')} disabled={busy !== null}>
          <Download size={14} />{busy === 'doc' ? 'Preparing…' : 'Download As Word'}
        </button>
        <button type="button" className="qx-btn ghost" onClick={() => run('pdf')} disabled={busy !== null}>
          <FileText size={14} />{busy === 'pdf' ? 'Preparing…' : 'Download As PDF'}
        </button>
        {trailing}
      </div>
      {msg ? (
        <div role="status" style={{
          fontSize: 12, fontWeight: 600, overflowWrap: 'anywhere',
          color: msg.tone === 'ok' ? 'var(--c-good)' : 'var(--c-bad)',
        }}>{msg.text}</div>
      ) : null}
    </div>
  );
}

/** The document itself, as it will be saved. Sandboxed: it runs no script. */
export function ReportPreview({ html, title }: { html: string; title: string }) {
  return (
    <iframe
      title={title}
      srcDoc={html}
      sandbox=""
      style={{ width: '100%', height: 640, border: '1px solid var(--c-line-2)', borderRadius: 12, background: '#fff' }}
    />
  );
}
