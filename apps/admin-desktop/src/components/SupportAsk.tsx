/**
 * SupportAsk — "ask a question, get an answer if we have one, email us if not".
 *
 * This is what sits behind the button that used to read "Start A Conversation"
 * and do nothing. The label was its own problem: an executive is the top of
 * their own organisation, so a conversation with whom? There is nobody above
 * them inside the business. The only honest counterparty is Lyne support, and
 * the button says so now.
 *
 * It answers from the same FAQ the page already lists, matched on words rather
 * than on an exact substring — somebody types "how do I change the wait
 * target", the entry is titled "Where Do Targets Come From", and a substring
 * search finds nothing while a human would match them immediately.
 *
 * WHEN IT HAS NO ANSWER IT SAYS SO AND HANDS OVER. No invented reply, no "I'm
 * not sure, try rephrasing" loop — a mailto with the question already in the
 * body, so the thing they typed is not lost and they do not have to write it
 * twice. That is the whole of the brief: custom answers where we have them,
 * email where we do not.
 */
import { useMemo, useState } from 'react';
import { Mail, Search, X } from 'lucide-react';

const STOP = new Set([
  'the', 'a', 'an', 'is', 'are', 'do', 'does', 'how', 'what', 'why', 'when',
  'where', 'who', 'can', 'i', 'my', 'me', 'we', 'our', 'to', 'of', 'in', 'on',
  'for', 'and', 'or', 'it', 'this', 'that', 'with', 'you', 'your',
]);

const words = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));

export function SupportAsk({
  faq, supportEmail, onClose,
}: {
  faq: Array<{ q: string; a: string }>;
  supportEmail: string;
  onClose: () => void;
}) {
  const [question, setQuestion] = useState('');

  /* Scored, not filtered. Every FAQ entry gets a count of how many meaningful
     words of the question it contains, title matches weighted double because a
     hit in the question itself is a stronger signal than one in the body. */
  const matches = useMemo(() => {
    const ws = words(question);
    if (ws.length === 0) return [];
    return faq
      .map((f) => {
        const q = f.q.toLowerCase();
        const a = f.a.toLowerCase();
        const score = ws.reduce((t, w) => t + (q.includes(w) ? 2 : 0) + (a.includes(w) ? 1 : 0), 0);
        return { ...f, score };
      })
      .filter((f) => f.score > 0)
      .sort((x, y) => y.score - x.score)
      .slice(0, 3);
  }, [question, faq]);

  const asked = question.trim().length > 2;
  const mailto = `mailto:${supportEmail}`
    + `?subject=${encodeURIComponent('Question from the Lyne dashboard')}`
    + `&body=${encodeURIComponent(question.trim() || '')}`;

  return (
    <div className="qx-mc-scrim" role="presentation" onClick={onClose}>
      <div className="qx-mc" role="dialog" aria-modal="true" aria-label="Ask Lyne support" onClick={(e) => e.stopPropagation()}>
        <header className="qx-mc-head">
          <div>
            <small>Lyne Support</small>
            <b>Ask a question</b>
          </div>
          <button type="button" className="qx-btn ghost" onClick={onClose} aria-label="Close"><X size={15} /></button>
        </header>

        <label className="qx-mc-field">
          <span>What do you need?</span>
          <input
            autoFocus
            value={question}
            onChange={(e) => setQuestion(e.target.value.slice(0, 300))}
            placeholder="How do I change the wait target for a branch?"
          />
        </label>

        {!asked ? (
          <p className="qx-mc-hint"><Search size={13} /> Type a question and we will answer it here if we can.</p>
        ) : matches.length ? (
          <>
            <p className="qx-mc-hint">{matches.length === 1 ? 'This should answer it:' : 'One of these should answer it:'}</p>
            <div className="qx-mc-answers">
              {matches.map((m) => (
                <div className="qx-mc-answer" key={m.q}>
                  <b>{m.q}</b>
                  <p>{m.a}</p>
                </div>
              ))}
            </div>
            <footer className="qx-mc-foot">
              <a className="qx-btn ghost" href={mailto}><Mail size={14} />Still stuck — email us</a>
              <button type="button" className="qx-btn" onClick={onClose}>That answers it</button>
            </footer>
          </>
        ) : (
          <>
            {/* No match, said plainly. The question travels in the mail body so
                nobody types it twice. */}
            <p className="qx-mc-hint">
              We do not have a written answer for that one. Email it to us and a person will reply
              within one business day — your question is already in the message.
            </p>
            <footer className="qx-mc-foot">
              <button type="button" className="qx-btn ghost" onClick={onClose}>Cancel</button>
              <a className="qx-btn" href={mailto}><Mail size={14} />Email {supportEmail}</a>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}

export default SupportAsk;
