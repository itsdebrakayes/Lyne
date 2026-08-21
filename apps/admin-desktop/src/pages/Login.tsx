import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, BarChart3, Eye, EyeOff, Loader2, ShieldCheck, Timer, Users } from 'lucide-react';
import { useAdminAuth } from '../hooks/useAdminAuth';
import '../styles/admin-kit.css';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAdminAuth();
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
          <i>Q</i>
          <span><b>Lyne</b><small>Admin Operations</small></span>
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
            <span><small>Secure Admin Access</small><h2>Sign In</h2></span>
          </div>

          {error ? (
            <div className="qa-login-error"><AlertCircle size={16} /><span>{error}</span></div>
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

          <p className="qa-login-help">
            Forgotten your password? Your branch manager or IT administrator can reset it —
            accounts are created for you, so there is no self-service reset.
          </p>
        </div>
      </section>
    </div>
  );
}
