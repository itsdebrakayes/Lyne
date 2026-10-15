/**
 * PatientLine — the waiting line, in the order people will be called, that
 * staff can rearrange.
 *
 * Built for a hospital front desk and for a nurse with an iPad:
 *   - Each row carries the tags that matter for deciding who goes next:
 *     Possibly Urgent (from the patient's triage answers, or set by staff),
 *     Priority / Watch (flags staff put on the patient), Frequent Visitor and
 *     Repeat Unresolved (worked out from their recent visits).
 *   - Drag the handle to move someone anywhere in the line, like reordering a
 *     playlist. Pointer events, not HTML drag-and-drop, so it works with a
 *     finger on an iPad as well as a mouse.
 *   - Tap a row for the patient card: triage answers, flags, recent visits,
 *     and one-tap Move To Top / tag / call.
 *
 * The software never moves anyone on its own. A tag is a prompt for a person
 * to look; every move is made, and recorded, by staff.
 */
import { useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { AlertTriangle, ArrowUpToLine, GripVertical, Repeat, Star, Eye, X } from 'lucide-react';
import type { LineTicket } from './LineTabsQX';

type MoveTo = 'top' | 'bottom' | number;

const chip = (bg: string, fg: string) => ({
  display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 999,
  fontSize: 11, fontWeight: 700, background: bg, color: fg, whiteSpace: 'nowrap' as const,
});

export function PatientTags({ t }: { t: LineTicket }) {
  const tags: JSX.Element[] = [];
  if (t.triageFlag === 'possibly_urgent') {
    tags.push(<span key="u" style={chip('var(--c-bad-soft)', 'var(--c-bad)')}><AlertTriangle size={11} />Possibly Urgent</span>);
  }
  if (t.patientFlags?.includes('priority')) {
    tags.push(<span key="p" style={chip('var(--c-warn-soft)', 'var(--c-warn)')}><Star size={11} />Priority</span>);
  }
  if (t.patientFlags?.includes('watch')) {
    tags.push(<span key="w" style={chip('var(--c-primary-soft)', 'var(--c-primary)')}><Eye size={11} />Watch</span>);
  }
  if (t.frequentVisitor) {
    tags.push(<span key="f" style={chip('var(--c-surface-3)', 'var(--c-text)')}><Repeat size={11} />Frequent Visitor</span>);
  }
  if (t.repeatUnresolved) {
    tags.push(<span key="r" style={chip('var(--c-surface-3)', 'var(--c-dim)')}>Repeat Unresolved</span>);
  }
  return tags.length ? <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 5, marginTop: 4 }}>{tags}</span> : null;
}

export function PatientLine({ items, canAct, busy, onCall, onMove, onSetTriageFlag }: {
  items: LineTicket[];
  canAct: boolean;
  busy: boolean;
  onCall: (id: string) => void;
  onMove?: (id: string, to: MoveTo) => Promise<void> | void;
  onSetTriageFlag?: (id: string, flag: 'none' | 'possibly_urgent') => Promise<void> | void;
}) {
  const [open, setOpen] = useState<LineTicket | null>(null);
  const [drag, setDrag] = useState<{ id: string; from: number; over: number; y: number; startY: number } | null>(null);
  const rowsRef = useRef<Array<HTMLDivElement | null>>([]);
  // A drag ends with a click on the row underneath; this stops it opening the card.
  const justDragged = useRef(false);

  const indexAt = (clientY: number) => {
    const rows = rowsRef.current.filter(Boolean) as HTMLDivElement[];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i].getBoundingClientRect();
      if (clientY < r.top + r.height / 2) return i;
    }
    return Math.max(0, rows.length - 1);
  };

  const startDrag = (e: ReactPointerEvent, id: string, from: number) => {
    if (!onMove) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ id, from, over: from, y: e.clientY, startY: e.clientY });
  };
  const moveDrag = (e: ReactPointerEvent) => {
    if (!drag) return;
    setDrag({ ...drag, y: e.clientY, over: indexAt(e.clientY) });
  };
  const endDrag = async () => {
    if (!drag) return;
    const { id, from, over } = drag;
    setDrag(null);
    justDragged.current = true;
    window.setTimeout(() => { justDragged.current = false; }, 0);
    if (over !== from && onMove) await onMove(id, over + 1);
  };

  if (!items.length) {
    return <div style={{ padding: '22px 4px', color: 'var(--c-dim)', fontSize: 13, fontWeight: 600 }}>The line is empty.</div>;
  }

  return (
    <>
      <div role="list" aria-label="Patients waiting, in the order they will be called">
        {items.map((t, i) => {
          const dragging = drag?.id === t.id;
          const showGapAbove = drag && !dragging && drag.over === i && drag.from > i;
          const showGapBelow = drag && !dragging && drag.over === i && drag.from < i;
          return (
            <div key={t.id} role="listitem" ref={(el) => { rowsRef.current[i] = el; }}
              style={{
                display: 'grid', gridTemplateColumns: '34px 30px minmax(0,1fr) auto', alignItems: 'center', gap: 8,
                padding: '10px 6px', borderBottom: '1px solid var(--c-line)',
                borderTop: showGapAbove ? '3px solid var(--c-primary)' : undefined,
                boxShadow: showGapBelow ? 'inset 0 -3px 0 var(--c-primary)' : undefined,
                background: dragging ? 'var(--c-primary-soft)' : t.triageFlag === 'possibly_urgent' ? 'var(--c-bad-soft)' : undefined,
                transform: dragging ? `translateY(${drag!.y - drag!.startY}px)` : undefined,
                position: 'relative', zIndex: dragging ? 2 : undefined, cursor: 'pointer', minHeight: 56,
              }}
              onClick={() => { if (!drag && !justDragged.current) setOpen(t); }}>
              {onMove ? (
                <button type="button" aria-label={`Drag to move ${t.no}`} title="Drag to move"
                  onPointerDown={(e) => startDrag(e, t.id, i)} onPointerMove={moveDrag}
                  onPointerUp={endDrag} onPointerCancel={() => setDrag(null)}
                  onClick={(e) => e.stopPropagation()}
                  style={{ touchAction: 'none', width: 34, height: 44, display: 'grid', placeItems: 'center',
                    border: 0, background: 'transparent', color: 'var(--c-faint)', cursor: 'grab' }}>
                  <GripVertical size={18} />
                </button>
              ) : <span />}
              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--c-dim)', textAlign: 'center' }}>{i + 1}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                  <b style={{ fontSize: 14 }}>{t.no}</b>
                  <span style={{ fontSize: 13, color: 'var(--c-text)' }}>{t.name}</span>
                  <span style={{ fontSize: 12, color: t.waited > 30 ? 'var(--c-bad)' : 'var(--c-dim)', fontWeight: 700 }}>{t.waited} min</span>
                </div>
                {t.visitReason ? <div style={{ fontSize: 12, color: 'var(--c-dim)' }}>{t.visitReason}</div> : null}
                <PatientTags t={t} />
              </div>
              <button type="button" className="qx-btn ghost" disabled={!canAct || busy}
                onClick={(e) => { e.stopPropagation(); onCall(t.id); }}
                style={{ minHeight: 40 }}>Call</button>
            </div>
          );
        })}
      </div>

      {open ? (
        <PatientCard t={items.find((x) => x.id === open.id) || open} place={items.findIndex((x) => x.id === open.id) + 1}
          canAct={canAct} busy={busy} onClose={() => setOpen(null)}
          onCall={() => { onCall(open.id); setOpen(null); }}
          onTop={onMove ? async () => { await onMove(open.id, 'top'); setOpen(null); } : undefined}
          onFlag={onSetTriageFlag ? (f) => onSetTriageFlag(open.id, f) : undefined} />
      ) : null}
    </>
  );
}

function PatientCard({ t, place, canAct, busy, onClose, onCall, onTop, onFlag }: {
  t: LineTicket; place: number; canAct: boolean; busy: boolean;
  onClose: () => void; onCall: () => void; onTop?: () => void; onFlag?: (f: 'none' | 'possibly_urgent') => void;
}) {
  const answers = t.triageAnswers || [];
  return (
    <div role="dialog" aria-modal="true" aria-label={`Patient ${t.no}`}
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(10,20,40,.35)', zIndex: 60, display: 'grid', placeItems: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: 'min(520px, 100%)', maxHeight: '86vh', overflow: 'auto', background: 'var(--c-surface)',
          borderRadius: 18, boxShadow: '0 24px 60px rgba(0,0,0,.25)', padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-dim)' }}>Place {place} in line · waited {t.waited} min</div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{t.no} · {t.name}</div>
            {t.dateOfBirth ? <div style={{ fontSize: 12.5, color: 'var(--c-dim)' }}>Date of birth {t.dateOfBirth}</div> : null}
            {t.visitReason ? <div style={{ fontSize: 13, marginTop: 4 }}><b>Reason for visit:</b> {t.visitReason}</div> : null}
            <PatientTags t={t} />
          </div>
          <button type="button" className="qx-icon" aria-label="Close" onClick={onClose}><X size={16} /></button>
        </div>

        {t.flagNote ? (
          <div style={{ marginTop: 12, padding: 10, borderRadius: 12, background: 'var(--c-warn-soft)', fontSize: 13 }}>
            <b>Staff note:</b> {t.flagNote}
          </div>
        ) : null}

        <div style={{ marginTop: 14, fontSize: 12, fontWeight: 800, color: 'var(--c-dim)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
          Triage answers
        </div>
        {answers.length ? (
          <div style={{ marginTop: 6 }}>
            {answers.map((a) => (
              <div key={a.question_id} style={{ display: 'flex', gap: 10, padding: '7px 0', borderBottom: '1px solid var(--c-line)', fontSize: 13 }}>
                <span style={{ flex: 1 }}>{a.question}</span>
                <b style={{ color: a.answer && a.red_flag ? 'var(--c-bad)' : 'var(--c-text)' }}>{a.answer ? 'Yes' : 'No'}</b>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ marginTop: 6, fontSize: 13, color: 'var(--c-dim)' }}>No triage answers. They may have been checked in at the desk.</div>
        )}

        {(t.visits7d || t.unresolved30d) ? (
          <div style={{ marginTop: 12, fontSize: 13, color: 'var(--c-dim)' }}>
            {t.visits7d ? `${t.visits7d} other visit${t.visits7d === 1 ? '' : 's'} in the last 7 days. ` : ''}
            {t.unresolved30d ? `${t.unresolved30d} unresolved in the last 30 days.` : ''}
          </div>
        ) : null}

        <p style={{ marginTop: 12, fontSize: 11.5, color: 'var(--c-faint)' }}>
          Tags are prompts for clinical review, not a triage decision. Lyne never moves a patient by itself.
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
          {onTop ? <button type="button" className="qx-btn" disabled={busy || place === 1} onClick={onTop}><ArrowUpToLine size={14} />Move To Top</button> : null}
          <button type="button" className="qx-btn ghost" disabled={!canAct || busy} onClick={onCall}>Call Now</button>
          {onFlag ? (
            t.triageFlag === 'possibly_urgent'
              ? <button type="button" className="qx-btn ghost" disabled={busy} onClick={() => onFlag('none')}>Clear Possibly Urgent</button>
              : <button type="button" className="qx-btn ghost" disabled={busy} onClick={() => onFlag('possibly_urgent')}><AlertTriangle size={14} />Tag Possibly Urgent</button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
