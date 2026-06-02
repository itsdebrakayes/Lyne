/**
 * QMe Now Admin — Luxury Login
 * OLED Black · Bodoni Moda · Gold accents · Liquid glass card
 */
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';
import { useAdminAuth } from '../hooks/useAdminAuth';

const GOLD = '#CA8A04';
const GOLD_LIGHT = '#D4AF37';
const BG = '#080706';

function AmbientCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    let raf: number;
    const resize = () => { c.width = window.innerWidth; c.height = window.innerHeight; };
    resize();
    let t = 0;
    const draw = () => {
      ctx.clearRect(0, 0, c.width, c.height);
      const cx = c.width / 2, cy = c.height / 2;
      for (let ring = 0; ring < 3; ring++) {
        const r = Math.min(c.width, c.height) * (0.22 + ring * 0.15);
        const pts = 60;
        ctx.beginPath();
        for (let i = 0; i <= pts; i++) {
          const a = (i / pts) * Math.PI * 2;
          const n = 0.06 * Math.sin(3 * a + t * 0.5 + ring * 1.2) + 0.04 * Math.sin(7 * a - t * 0.3);
          const rr = r * (1 + n);
          const x = cx + rr * Math.cos(a), y = cy + rr * Math.sin(a);
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.strokeStyle = `rgba(202,138,4,${0.06 - ring * 0.015})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      t += 0.008;
      raf = requestAnimationFrame(draw);
    };
    draw();
    window.addEventListener('resize', resize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);
  return <canvas ref={ref} className="fixed inset-0 pointer-events-none z-0" />;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { signIn } = useAdminAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError('Please complete all fields.'); return; }
    setLoading(true); setError('');
    try { await signIn(email, password); navigate('/'); }
    catch (err: any) { setError(err.message || 'Invalid credentials.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={{ background: BG }}>
      <AmbientCanvas />
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 60% 60% at 50% 50%, rgba(202,138,4,0.05) 0%, transparent 70%)' }} />

      <div className="relative z-10 w-full mx-4" style={{ maxWidth: 480 }}>
        <div className="page-in rounded-3xl" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(212,175,55,0.14)', backdropFilter: 'blur(40px)', padding: '52px 52px 44px' }}>

          <div className="flex items-center gap-3 mb-12">
            <div className="rounded-xl flex items-center justify-center"
              style={{ width: 40, height: 40, background: `linear-gradient(135deg, ${GOLD}, ${GOLD_LIGHT})` }}>
              <span style={{ fontFamily: "'Bodoni Moda', serif", fontWeight: 700, fontSize: 16, color: BG }}>Q</span>
            </div>
            <div>
              <p style={{ fontFamily: "'Bodoni Moda', serif", fontSize: 15, fontWeight: 700, color: '#F5F0E8' }}>QMe Now</p>
              <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.16em', fontWeight: 600, color: GOLD }}>Admin Console</p>
            </div>
          </div>

          <h1 style={{ fontFamily: "'Bodoni Moda', serif", fontSize: '2.25rem', fontWeight: 600, color: '#F5F0E8', letterSpacing: '-0.01em', marginBottom: 6 }}>
            Sign in
          </h1>
          <p style={{ fontSize: 12, color: 'rgba(245,240,232,0.35)', letterSpacing: '0.03em', marginBottom: 36, fontFamily: 'Jost, sans-serif' }}>
            Access your admin dashboard
          </p>

          {error && (
            <div className="flex items-start gap-2.5 rounded-xl px-3.5 py-3 mb-5"
              style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}>
              <AlertCircle size={14} className="mt-0.5 flex-shrink-0" style={{ color: '#f87171' }} />
              <p style={{ fontSize: 11, color: '#fca5a5', fontFamily: 'Jost, sans-serif' }}>{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 600, color: 'rgba(245,240,232,0.35)', marginBottom: 10, fontFamily: 'Jost, sans-serif' }}>
                Email
              </label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@company.com"
                style={{ width: '100%', borderRadius: 14, padding: '15px 18px', fontSize: 14, outline: 'none', fontFamily: 'Jost, sans-serif',
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(212,175,55,0.12)', color: '#F5F0E8', transition: 'border-color 0.3s' }}
                onFocus={e => (e.target.style.borderColor = 'rgba(212,175,55,0.45)')}
                onBlur={e => (e.target.style.borderColor = 'rgba(212,175,55,0.12)')}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 600, color: 'rgba(245,240,232,0.35)', marginBottom: 10, fontFamily: 'Jost, sans-serif' }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"
                  style={{ width: '100%', borderRadius: 14, padding: '15px 50px 15px 18px', fontSize: 14, outline: 'none', fontFamily: 'Jost, sans-serif',
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(212,175,55,0.12)', color: '#F5F0E8', transition: 'border-color 0.3s' }}
                  onFocus={e => (e.target.style.borderColor = 'rgba(212,175,55,0.45)')}
                  onBlur={e => (e.target.style.borderColor = 'rgba(212,175,55,0.12)')}
                />
                <button type="button" onClick={() => setShowPw(!showPw)} style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', color: 'rgba(245,240,232,0.3)', cursor: 'pointer', background: 'none', border: 'none' }}>
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                fontFamily: 'Jost, sans-serif', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.18em',
                padding: '17px', borderRadius: 16, cursor: 'pointer', border: 'none', marginTop: 12,
                background: loading ? 'rgba(202,138,4,0.4)' : `linear-gradient(135deg, ${GOLD}, ${GOLD_LIGHT})`,
                color: loading ? 'rgba(8,7,6,0.5)' : BG,
                boxShadow: loading ? 'none' : '0 8px 40px rgba(202,138,4,0.3)',
                transition: 'all 0.4s',
              }}>
              {loading && <Loader2 size={14} className="animate-spin" />}
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div style={{ marginTop: 20, textAlign: 'center' }}>
          <p style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, color: 'rgba(245,240,232,0.35)', lineHeight: 1.6, marginBottom: 10 }}>
            Use the credentials provided to you by your administrator.<br />
            Contact them if you need access.
          </p>
          <p style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'rgba(245,240,232,0.15)' }}>
            © {new Date().getFullYear()} DS Tech
          </p>
        </div>
      </div>
    </div>
  );
}
