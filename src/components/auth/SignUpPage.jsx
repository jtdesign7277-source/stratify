import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';

function Starfield() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    window.addEventListener('resize', resize);
    const stars = Array.from({ length: 200 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.1 + 0.1,
      o: Math.random() * 0.7 + 0.1,
      speed: Math.random() * 0.12 + 0.02,
    }));
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // Deep space bg
      const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
      bg.addColorStop(0, '#04080f');
      bg.addColorStop(0.5, '#060d1a');
      bg.addColorStop(1, '#04080f');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // Subtle blue nebula glow
      const nebula = ctx.createRadialGradient(canvas.width * 0.5, canvas.height * 0.4, 0, canvas.width * 0.5, canvas.height * 0.4, canvas.width * 0.55);
      nebula.addColorStop(0, 'rgba(37,99,235,0.09)');
      nebula.addColorStop(0.6, 'rgba(30,58,138,0.04)');
      nebula.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = nebula;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // Stars
      stars.forEach(s => {
        s.y -= s.speed;
        if (s.y < 0) { s.y = canvas.height; s.x = Math.random() * canvas.width; }
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(210,225,255,${s.o})`;
        ctx.fill();
      });
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, []);
  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />;
}

export default function SignUpPage({ onSuccess, onBackToLanding }) {
  const [mode, setMode] = useState('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoogleAuth = async () => {
    setError('');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
    if (error) setError(error.message);
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(''); setMessage(''); setLoading(true);
    try {
      if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
        if (error) throw error;
        setMessage('Reset link sent — check your email.'); setLoading(false); return;
      }
      if (mode === 'signup') {
        if (password !== confirmPassword) throw new Error('Passwords do not match.');
        if (password.length < 8) throw new Error('Password must be at least 8 characters.');
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage('Check your email to confirm your account.'); setLoading(false); return;
      }
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onSuccess?.(); return;
      }
    } catch (err) { setError(err.message); }
    setLoading(false);
  };

  const switchMode = (next) => { setMode(next); setError(''); setMessage(''); };

  const heading = { signup: 'Create account', login: 'Sign in', forgot: 'Reset password' }[mode];
  const subtext = { signup: 'Trade smarter with AI-powered strategies.', login: 'Welcome back to Stratify.', forgot: "Enter your email and we'll send a reset link." }[mode];
  const btnLabel = { signup: 'Sign up', login: 'Sign in', forgot: 'Send reset link' }[mode];

  return (
    <>
      <style>{`
        @keyframes cardIn { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:translateY(0); } }
        .card-in { animation: cardIn 0.45s cubic-bezier(0.16,1,0.3,1) both; }
      `}</style>

      <div className="min-h-screen relative flex items-center justify-center p-4" style={{ background: '#04080f' }}>
        <Starfield />

        <div className="relative z-10 w-full max-w-[400px] card-in">
          {/* Card */}
          <div style={{
            background: 'rgba(8,16,32,0.85)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '16px',
            padding: '40px 36px',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)',
          }}>

            {/* Logo */}
            <div className="text-center mb-6">
              <button onClick={onBackToLanding} className="inline-block">
                <span style={{ color: '#fff', fontSize: '22px', fontWeight: '700', letterSpacing: '-0.3px' }}>Stratify</span>
              </button>
            </div>

            {/* Heading */}
            <div className="text-center mb-6">
              <h1 style={{ color: '#fff', fontSize: '22px', fontWeight: '600', marginBottom: '6px' }}>{heading}</h1>
              <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '14px' }}>{subtext}</p>
            </div>

            {/* Google */}
            {mode !== 'forgot' && (
              <>
                <button
                  onClick={handleGoogleAuth}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    gap: '10px', background: 'rgba(255,255,255,0.97)', border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '10px', padding: '11px 16px', fontSize: '14px', fontWeight: '500',
                    color: '#1a1a2e', cursor: 'pointer', marginBottom: '16px', transition: 'opacity 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.opacity = '0.92'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Sign {mode === 'signup' ? 'up' : 'in'} with Google
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
                  <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>or</span>
                  <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
                </div>
              </>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="Email" required
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '11px 14px', color: '#fff', fontSize: '14px', outline: 'none', transition: 'border-color 0.15s' }}
                onFocus={e => e.target.style.borderColor = 'rgba(59,130,246,0.6)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
              />

              {mode !== 'forgot' && (
                <input
                  type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder={mode === 'signup' ? 'Create password' : 'Password'} required
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '11px 14px', color: '#fff', fontSize: '14px', outline: 'none', transition: 'border-color 0.15s' }}
                  onFocus={e => e.target.style.borderColor = 'rgba(59,130,246,0.6)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
              )}

              {mode === 'signup' && (
                <input
                  type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Confirm password" required
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '11px 14px', color: '#fff', fontSize: '14px', outline: 'none', transition: 'border-color 0.15s' }}
                  onFocus={e => e.target.style.borderColor = 'rgba(59,130,246,0.6)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
              )}

              {/* Forgot password link - left aligned like TradeZella */}
              {mode === 'login' && (
                <div style={{ marginTop: '2px' }}>
                  <button type="button" onClick={() => switchMode('forgot')} style={{ color: 'rgba(96,165,250,0.9)', fontSize: '13px', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    Forgot password?
                  </button>
                </div>
              )}

              {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px', padding: '10px 14px', color: '#fca5a5', fontSize: '13px' }}>{error}</div>}
              {message && <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '10px', padding: '10px 14px', color: '#6ee7b7', fontSize: '13px' }}>{message}</div>}

              <button
                type="submit" disabled={loading}
                style={{ marginTop: '4px', background: loading ? 'rgba(37,99,235,0.6)' : '#2563eb', border: 'none', borderRadius: '10px', padding: '12px 16px', color: '#fff', fontSize: '14px', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'background 0.15s' }}
                onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#1d4ed8'; }}
                onMouseLeave={e => { if (!loading) e.currentTarget.style.background = '#2563eb'; }}
              >
                {loading ? <><div style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />Processing...</> : btnLabel}
              </button>
            </form>

            {/* Footer */}
            <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>
              {mode === 'signup' && <span>Already have an account?{' '}<button onClick={() => switchMode('login')} style={{ color: 'rgba(96,165,250,0.9)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px' }}>Sign in</button></span>}
              {mode === 'login' && <span>Don't have an account?{' '}<button onClick={() => switchMode('signup')} style={{ color: 'rgba(96,165,250,0.9)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px' }}>Sign up</button></span>}
              {mode === 'forgot' && <button onClick={() => switchMode('login')} style={{ color: 'rgba(96,165,250,0.9)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px' }}>Back to sign in</button>}
            </div>

          </div>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } input::placeholder { color: rgba(255,255,255,0.25) !important; }`}</style>
    </>
  );
}
