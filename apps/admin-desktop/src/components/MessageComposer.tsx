/**
 * MessageComposer — the thing behind "Message Your Executive".
 *
 * That button, and "Start A Conversation" on the executive's own support panel,
 * were `<button type="button" className="qx-btn">` with no onClick. So were the
 * email and phone buttons beside them. Four controls on the Help & Support page
 * of two dashboards, all of which highlighted on hover and did nothing.
 *
 * A dead button is worse than a missing one. Somebody with a real question —
 * "can we raise the counter target", "why is this branch flagged" — spends
 * their one attempt on it, nothing happens, and they conclude the product does
 * not listen. They do not file a bug about it.
 *
 * It sends through POST /api/notifications/staff-message, which addresses a
 * ROLE rather than a person: an executive is a post, not an individual, and a
 * manager with a question wants whoever holds it today rather than a name they
 * picked who may be on leave. Replies are the one case addressed to a person,
 * and only the actual recipient of a message may send one.
 */
import { useEffect, useRef, useState } from 'react';
import { Send, X } from 'lucide-react';
import api from '@/lib/apiClient';

export type ComposerTarget =
  | { mode: 'role'; to: 'executive' | 'manager' | 'supervisor' | 'line_staff'; label: string; branchId?: string }
  | { mode: 'reply'; inReplyTo: string; label: string; quoted?: string };

export function MessageComposer({ target, onClose }: { target: ComposerTarget; onClose: () => void }) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');
  const first = useRef<HTMLTextAreaElement>(null);

  /* Focus lands in the box, and Escape closes — a modal that traps the keyboard
     without offering a way out is the usual accessibility failure here. */
  useEffect(() => {
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const send = async () => {
    const text = body.trim();
    if (!text) { setError('Write a message first.'); return; }
    setState('sending'); setError('');
    try {
      await api.post('/notifications/staff-message',
        target.mode === 'reply'
          ? { in_reply_to: target.inReplyTo, message: text }
          : { to: target.to, branch_id: target.branchId, subject: subject.trim() || undefined, message: text });
      setState('sent');
      /* Held open for a beat on success so the confirmation is actually read,
         rather than the dialog vanishing and leaving the person unsure. */
      setTimeout(onClose, 1400);
    } catch (e: any) {
      setState('error');
      setError(e?.message || 'That did not send. Try again in a moment.');
    }
  };

  return (
    <div className="qx-mc-scrim" role="presentation" onClick={onClose}>
      <div
        className="qx-mc"
        role="dialog"
        aria-modal="true"
        aria-label={target.mode === 'reply' ? `Reply to ${target.label}` : `Message ${target.label}`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="qx-mc-head">
          <div>
            <small>{target.mode === 'reply' ? 'Reply' : 'New Message'}</small>
            <b>{target.label}</b>
          </div>
          <button type="button" className="qx-btn ghost" onClick={onClose} aria-label="Close">
            <X size={15} />
          </button>
        </header>

        {target.mode === 'reply' && target.quoted ? (
          <blockquote className="qx-mc-quote">{target.quoted}</blockquote>
        ) : null}

        {state === 'sent' ? (
          <p className="qx-mc-sent">Sent. It is in their notifications now.</p>
        ) : (
          <>
            {target.mode === 'role' ? (
              <label className="qx-mc-field">
                <span>Subject <i>optional</i></span>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value.slice(0, 120))}
                  placeholder="Counter target, staffing, a branch that needs a look…"
                />
              </label>
            ) : null}

            <label className="qx-mc-field">
              <span>Message</span>
              <textarea
                ref={first}
                value={body}
                onChange={(e) => setBody(e.target.value.slice(0, 2000))}
                rows={5}
                placeholder={target.mode === 'reply'
                  ? 'Your reply…'
                  : 'What do you need? Be specific — a branch name and a number helps.'}
              />
              <small className="qx-mc-count">{body.length}/2000</small>
            </label>

            {error ? <p className="qx-mc-err">{error}</p> : null}

            <footer className="qx-mc-foot">
              <button type="button" className="qx-btn ghost" onClick={onClose}>Cancel</button>
              <button type="button" className="qx-btn" onClick={send} disabled={state === 'sending' || !body.trim()}>
                <Send size={14} />{state === 'sending' ? 'Sending…' : 'Send'}
              </button>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}

export default MessageComposer;
