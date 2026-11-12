/**
 * StopTexts — where the link in a Lyne text lands.
 *
 * Texts come from the name "Lyne", which cannot receive a reply, so STOP does not
 * work and this page is how someone without the app says it. It asks for a tap
 * rather than stopping on load: link previews and scanners open links too.
 */
import { useState } from 'react';
import { useParams } from 'react-router-dom';

const API = ((import.meta.env.VITE_API_URL as string) || 'https://api.uselyne.com/api').replace(/\/+$/, '');

const StopTexts = () => {
  const { code = '' } = useParams();
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'bad'>('idle');
  const [message, setMessage] = useState('');

  const stop = async () => {
    setState('busy');
    try {
      const res = await fetch(`${API}/sms/stop`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }),
      });
      if (res.ok) { setState('done'); return; }
      const body = await res.json().catch(() => null);
      setMessage(body?.error || 'That did not work. Try again in a moment.');
      setState('bad');
    } catch {
      setMessage('That did not work. Check your connection and try again.');
      setState('bad');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-lyne-night px-5 text-white">
      <main id="main" className="panel w-full max-w-md p-8 text-center">
        <h1 className="text-2xl font-bold tracking-tight">{state === 'done' ? 'Texts Stopped' : 'Stop Texts From Lyne?'}</h1>
        <p className="mt-3 text-sm text-lyne-lavender/80">
          {state === 'done'
            ? 'This number will not get any more texts from Lyne. Your place in line is not affected.'
            : 'This stops all text alerts from Lyne to this number. Your place in line is not affected.'}
        </p>
        {state === 'bad' ? <p role="alert" className="mt-3 text-sm text-red-300">{message}</p> : null}
        {state !== 'done' ? (
          <button type="button" onClick={stop} disabled={state === 'busy'} className="mt-6 w-full rounded-xl bg-white px-5 py-3 font-semibold text-lyne-night disabled:opacity-60">
            {state === 'busy' ? 'Stopping…' : 'Stop Texts'}
          </button>
        ) : null}
      </main>
    </div>
  );
};

export default StopTexts;
