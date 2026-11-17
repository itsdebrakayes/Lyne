import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, BarChart3, Eye, EyeOff, Loader2, ShieldCheck, Timer, Users } from 'lucide-react';
import { useAdminAuth } from '../hooks/useAdminAuth';
import type { MfaGate } from '../hooks/useAdminAuth';
import MfaStep from '../components/MfaStep';
import { MICROSOFT_ENABLED, signInWithMicrosoft } from '../lib/microsoftSignIn';

/* Microsoft's four-square logo, as its sign-in button guidelines ask. */
function MicrosoftLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 21 21" aria-hidden="true">
      <rect x="1" y="1" width="9" height="9" fill="#f25022" /><rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" /><rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}
import '../styles/admin-kit.css';

export default function LoginPage() {
  const navigate = useNavigate();
  /* authError carries a refusal from a saved session (a kiosk or customer
     login found at launch), which never went through this form. */
  const { login, logout, checkAuth, mfaGate: realGate, error: authError } = useAdminAuth();
  /* Development only: #/login?preview-2fa=verify|enroll shows the code step
     without a real account, for checking its layout. Gone from a build. */
  const [params] = useSearchParams();
  const preview = import.meta.env.DEV ? params.get('preview-2fa') : null;
  const mfaGate: MfaGate | null = realGate ?? (preview === 'verify' || preview === 'enroll' ? { mode: preview, name: 'Preview' } : null);
  const [msBusy, setMsBusy] = useState(false);

  const microsoft = async () => {
    setMsBusy(true);
    setError('');
    try {
      const outcome = await signInWithMicrosoft();
      if (outcome === 'done') { await checkAuth(); navigate('/'); }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Microsoft sign-in failed.');
    } finally {
      setMsBusy(false);
    }
  };
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email || !password) {
      setError('Please complete all fields.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { error: authError } = await login(email, password);
      if (authError) throw authError;
      // With two-factor still to do, stay here: the code prompt replaces the form.
      navigate('/');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="qa-app qa-login" data-theme="light">
      <section className="qa-login-hero">
        <div className="qa-login-brand">
          {/* The brand symbol. The login hero is the dark navy panel, so
              this is the white-reversed mark; the rail uses the gradient one. */}
          <img src="/lyne-symbol-white.svg" alt="" aria-hidden="true" className="qx-mark" />
          <span><b className="lyne-mark">Lyne</b><small>Admin Operations</small></span>
        </div>
        <div className="qa-login-copy">
          <div className="eyebrow">Dashboard Console</div>
          <h1>Run queues, staff, and branch performance from one place.</h1>
          <p>Sign in to access the workspace for your assigned role.</p>
          {/* These were "Wait times / Accurate" and "Insights / Fresh" — claims
              nobody can check, on a screen the same staff open every morning.
              What they need is which workspace they are about to land in. */}
          <div className="qa-login-metrics" aria-hidden="true">
            <div className="qa-login-metric"><Users size={18} /><span>Front desk</span><b>Run the line</b></div>
            <div className="qa-login-metric"><Timer size={18} /><span>Branch manager</span><b>Staff the floor</b></div>
            <div className="qa-login-metric"><BarChart3 size={18} /><span>Executive</span><b>See every branch</b></div>
          </div>
        </div>
      </section>

      <section className="qa-login-panel" aria-label="Admin sign in">
        <div className="qa-login-card">
          <div className="qa-login-cardhead">
            <span className="shield"><ShieldCheck size={22} /></span>
            <span>
              <small>Secure Admin Access</small>
              <h2>{mfaGate ? (mfaGate.mode === 'enroll' ? 'Set Up Two-Factor' : 'Enter Your Code') : 'Sign In'}</h2>
            </span>
          </div>

          {mfaGate ? (
            <MfaStep
              key={mfaGate.mode}
              mode={mfaGate.mode}
              onDone={() => { checkAuth().then(() => navigate('/')); }}
              onCancel={() => { logout(); }}
            />
          ) : (<>

          {error || authError ? (
            <div className="qa-login-error"><AlertCircle size={16} /><span>{error || authError}</span></div>
          ) : null}

          <form onSubmit={handleSubmit} className="qa-login-form">
            <label>
              <span>Email</span>
              <div className="qa-login-input">
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@yourorganisation.com" autoComplete="email" />
              </div>
            </label>
            <label>
              <span>Password</span>
              <div className="qa-login-input">
                <input type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter password" autoComplete="current-password" />
                <button type="button" className="eye" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? 'Hide password' : 'Show password'}>
                  {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </label>
            <button className="qa-login-submit" type="submit" disabled={loading}>
              {loading ? <Loader2 size={16} className="qa-spin" /> : null}
              {loading ? 'Signing in' : 'Open dashboard'}
            </button>
          </form>

          {MICROSOFT_ENABLED ? (
            <>
              <div className="qa-login-or" aria-hidden="true"><span>or</span></div>
              <button type="button" className="qa-login-ms" onClick={microsoft} disabled={msBusy || loading}>
                {msBusy ? <Loader2 size={16} className="qa-spin" /> : <MicrosoftLogo />}
                <span>{msBusy ? 'Waiting for Microsoft' : 'Sign in with Microsoft'}</span>
              </button>
            </>
          ) : null}

          <p className="qa-login-help">
            Forgotten your password? Your branch manager or IT administrator can reset it —
            accounts are created for you, so there is no self-service reset.
          </p>
          </>)}
        </div>
      </section>
    </div>
  );
}
