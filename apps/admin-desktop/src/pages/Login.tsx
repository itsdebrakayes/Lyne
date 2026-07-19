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
          <span><b>QMe Now</b><small>Admin Operations</small></span>
        </div>
        <div className="qa-login-copy">
          <div className="eyebrow">Dashboard Console</div>
          <h1>Run queues, staff, and branch performance from one place.</h1>
          <p>Sign in to access the workspace for your assigned role.</p>
          <div className="qa-login-metrics" aria-hidden="true">
            <div className="qa-login-metric"><Users size={18} /><span>Live lines</span><b>42</b></div>
            <div className="qa-login-metric"><Timer size={18} /><span>Avg wait</span><b>12m</b></div>
            <div className="qa-login-metric"><BarChart3 size={18} /><span>Insights</span><b>Fresh</b></div>
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
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@agency.gov.jm" autoComplete="email" />
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

          <p className="qa-login-help">Use the credentials provided by your administrator.</p>
        </div>
      </section>
    </div>
  );
}
