import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, BarChart3, Eye, EyeOff, Loader2, ShieldCheck, Timer, Users } from 'lucide-react';
import { useAdminAuth } from '../hooks/useAdminAuth';

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
    <main className="admin-login-page">
      <section className="admin-login-showcase">
        <div className="admin-login-brand">
          <div>L</div>
          <span>
            <b>Lyne</b>
            <small>Admin operations</small>
          </span>
        </div>

        <div className="admin-login-copy">
          <p>Dashboard console</p>
          <h1>Run queues, staff, and branch performance from one place.</h1>
          <span>Sign in to access the workspace for your assigned role.</span>
        </div>

        <div className="admin-login-metrics" aria-hidden="true">
          <div>
            <Users size={18} />
            <span>Live lines</span>
            <b>Every branch</b>
          </div>
          <div>
            <Timer size={18} />
            <span>Wait times</span>
            <b>As they happen</b>
          </div>
          <div>
            <BarChart3 size={18} />
            <span>Insights</span>
            <b>Against your targets</b>
          </div>
        </div>
      </section>

      <section className="admin-login-panel" aria-label="Admin Sign In">
        <div className="admin-login-card">
          <div className="admin-login-card-head">
            <ShieldCheck size={21} />
            <span>
              <small>Secure admin access</small>
              <h2>Sign In</h2>
            </span>
          </div>

          {error ? (
            <div className="admin-login-error" role="alert">
              <AlertCircle size={16} />
              <p>{error}</p>
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="admin-login-form">
            <label>
              <span>Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="admin@company.com"
                autoFocus
                autoComplete="email"
              />
            </label>

            <label>
              <span>Password</span>
              <div className="admin-password-field">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />
                <button type="button" onClick={() => setShowPw((value) => !value)} aria-label={showPw ? 'Hide password' : 'Show password'}>
                  {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </label>

            <button className="admin-login-submit" type="submit" disabled={loading}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              {loading ? 'Signing In' : 'Open Dashboard'}
            </button>
          </form>

          <p className="admin-login-help">Use the credentials provided by your administrator.</p>
        </div>
      </section>
    </main>
  );
}
