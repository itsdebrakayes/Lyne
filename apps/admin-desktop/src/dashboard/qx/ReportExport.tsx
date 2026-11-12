/**
 * The two pieces every Reports tab shares: the Word / PDF buttons, and a
 * preview that shows the document they will produce.
 *
 * The buttons used to be bare <button>s with no handler, so pressing them did
 * nothing at all. They now save the document built in ../reportDoc.ts.
 */
import { useEffect, useState } from 'react';
import { Download, FileText } from 'lucide-react';
import { saveReport } from '../reportDoc';

export function ReportDownloadButtons({ html, filename, trailing, disabled }: {
  html: string; filename: string; trailing?: React.ReactNode;
  /** The figures are still loading, so what would save is not the finished report. */
  disabled?: boolean;
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
        <button type="button" className="qx-btn" onClick={() => run('doc')} disabled={busy !== null || disabled}>
          <Download size={14} />{busy === 'doc' ? 'Preparing…' : 'Download As Word'}
        </button>
        <button type="button" className="qx-btn ghost" onClick={() => run('pdf')} disabled={busy !== null || disabled}>
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
export function ReportPreview({ html, title, loaded = 1, total = 1 }: {
  html: string; title: string;
  /** How many of the report's pieces of data have arrived. */
  loaded?: number; total?: number;
}) {
  /* An empty white box reads as a failure, so until the document has actually
     painted this says what is happening. The bar is real progress: one step for
     each piece of data, and a last one for laying the document out. */
  const [painted, setPainted] = useState(false);
  useEffect(() => { setPainted(false); }, [html]);
  const done = loaded >= total && painted;
  const steps = total + 1;
  const step = Math.min(steps, loaded + (done ? 1 : 0));

  return (
    <div style={{ position: 'relative' }}>
      <iframe
        title={title}
        srcDoc={html}
        sandbox=""
        onLoad={() => setPainted(true)}
        style={{ width: '100%', height: 640, border: '1px solid var(--c-line-2)', borderRadius: 12, background: '#fff', display: 'block' }}
      />
      {done ? null : (
        <div role="status" aria-live="polite" style={{
          position: 'absolute', inset: 1, borderRadius: 11, background: 'var(--c-surface)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32,
        }}>
          <b style={{ fontSize: 14 }}>{loaded < total ? 'Gathering The Figures…' : 'Generating Preview…'}</b>
          <div className="qx-bar" style={{ width: 'min(280px, 80%)' }}>
            <i style={{ width: `${Math.max(8, (step / steps) * 100)}%`, background: 'var(--c-primary)', transition: 'width .3s ease' }} />
          </div>
          <small style={{ fontSize: 12, color: 'var(--c-faint)', fontWeight: 600 }}>Step {Math.min(step + 1, steps)} of {steps}</small>
        </div>
      )}
    </div>
  );
}
