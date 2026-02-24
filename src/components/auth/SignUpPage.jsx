import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';

// ── Starfield canvas ──────────────────────────────────────────────────────────
function Starfield() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const stars = Array.from({ length: 160 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.2 + 0.2,
      o: Math.random() * 0.6 + 0.2,
      speed: Math.random() * 0.15 + 0.03,
    }));

    // Vertical light beams
    const beams = Array.from({ length: 6 }, (_, i) => ({
      x: (canvas.width / 7) * (i + 1),
      o: Math.random() * 0.06 + 0.02,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Deep space gradient
      const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
      bg.addColorStop(0, '#060d18');
      bg.addColorStop(0.5, '#091428');
      bg.addColorStop(1, '#060d18');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Beams
      beams.forEach(b => {
        const g = ctx.createLinearGradient(b.x, 0, b.x, canvas.height);
        g.addColorStop(0, `rgba(59,130,246,0)`);
        g.addColorStop(0.3, `rgba(59,130,246,${b.o})`);
        g.addColorStop(0.7, `rgba(99,102,241,${b.o * 0.7})`);
        g.addColorStop(1, `rgba(59,130,246,0)`);
        ctx.fillStyle = g;
        ctx.fillRect(b.x - 1, 0, 2, canvas.height);
      });

      // Stars
      stars.forEach(s => {
        s.y -= s.speed;
        if (s.y < 0) { s.y = canvas.height; s.x = Math.random() * canvas.width; }
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200,220,255,${s.o})`;
        ctx.fill();
      });

      // Blue glow orb top-right
      const orb = ctx.createRadialGradient(
        canvas.width * 0.75, canvas.height * 0.2, 0,
        canvas.width * 0.75, canvas.height * 0.2, canvas.width * 0.45
      );
      orb.addColorStop(0, 'rgba(59,130,246,0.18)');
      orb.addColorStop(0.5, 'rgba(79,70,229,0.08)');
      orb.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = orb;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />;
}

// ── Floating stat card ────────────────────────────────────────────────────────
function StatCard({ label, value, change, positive, delay }) {
  return (
    <div
      className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3 flex items-center justify-between gap-6"
      style={{ animation: `fadeUp 0.6s ease ${delay}s both` }}
    >
      <div>
        <div className="text-gray-400 text-xs mb-0.5">{label}</div>
        <div className="text-white font-semibold text-sm font-mono">{value}</div>
      </div>
      <div className={`text-xs font-mono font-semibold px-2 py-1 rounded-md ${positive ? 'text-emerald-400 bg-emerald-400/10' : 'text-red-400 bg-red-400/10'}`}>
        {change}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function SignUpPage({ onSuccess, onBackToLanding }) {
  const [mode, setMode] = useState('signup'); // 'signup' | 'login' | 'forgot'
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
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setMessage('Check your email for a reset link.');
        setLoading(false);
        return;
      }

      if (mode === 'signup') {
        if (password !== confirmPassword) throw new Error('Passwords do not match.');
        if (password.length < 8) throw new Error('Password must be at least 8 characters.');
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage('Check your email to confirm your account.');
        setLoading(false);
        return;
      }

      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onSuccess?.();
        return;
      }
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const title = mode === 'signup' ? 'Create your account' : mode === 'login' ? 'Welcome back' : 'Reset password';
  const btnLabel = mode === 'signup' ? 'Create Account' : mode === 'login' ? 'Log In' : 'Send Reset Link';

  return (
    <>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .fade-up { animation: fadeUp 0.5s ease both; }
        .fade-up-1 { animation: fadeUp 0.5s ease 0.05s both; }
        .fade-up-2 { animation: fadeUp 0.5s ease 0.1s both; }
        .fade-up-3 { animation: fadeUp 0.5s ease 0.15s both; }
        .fade-up-4 { animation: fadeUp 0.5s ease 0.2s both; }
        .fade-up-5 { animation: fadeUp 0.5s ease 0.25s both; }
      `}</style>

      <div className="min-h-screen flex bg-[#060d18]">

        {/* ── LEFT: Form panel ─────────────────────────────────────── */}
        <div className="w-full lg:w-[480px] flex-shrink-0 flex flex-col justify-center px-8 py-12 relative z-10 bg-[#060d18]">

          {/* Logo */}
          <button
            onClick={onBackToLanding}
            className="flex items-center gap-2 mb-12 group w-fit fade-up"
          >
            <span className="text-white text-lg font-bold tracking-tight">Stratify</span>
          </button>

          <h1 className="text-white text-2xl font-semibold mb-8 fade-up-1">{title}</h1>

          {/* Google button — only on signup/login */}
          {mode !== 'forgot' && (
            <button
              onClick={handleGoogleAuth}
              className="fade-up-2 w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 text-gray-800 font-medium rounded-xl px-4 py-3 text-sm transition-colors mb-6"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>
          )}

          {mode !== 'forgot' && (
            <div className="fade-up-2 flex items-center gap-3 mb-6">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-gray-500 text-xs uppercase tracking-wider">or</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="fade-up-3 flex flex-col gap-1.5">
              <label className="text-gray-400 text-xs uppercase tracking-wider font-medium">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500/60 focus:bg-white/8 transition-all"
              />
            </div>

            {mode !== 'forgot' && (
              <div className="fade-up-3 flex flex-col gap-1.5">
                <label className="text-gray-400 text-xs uppercase tracking-wider font-medium">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={mode === 'signup' ? 'Min. 8 characters' : 'Your password'}
                  required
                  className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500/60 focus:bg-white/8 transition-all"
                />
              </div>
            )}

            {mode === 'signup' && (
              <div className="fade-up-4 flex flex-col gap-1.5">
                <label className="text-gray-400 text-xs uppercase tracking-wider font-medium">Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Repeat your password"
                  required
                  className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500/60 focus:bg-white/8 transition-all"
                />
              </div>
            )}

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">
                {error}
              </div>
            )}
            {message && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 text-emerald-400 text-sm">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="fade-up-5 mt-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl px-4 py-3 text-sm transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Processing...</>
              ) : btnLabel}
            </button>
          </form>

          {/* Footer links */}
          <div className="fade-up-5 mt-6 flex flex-col gap-2 text-center text-sm text-gray-500">
            {mode === 'login' && (
              <button onClick={() => { setMode('forgot'); setError(''); setMessage(''); }} className="text-blue-400 hover:text-blue-300 transition-colors">
                Forgot password?
              </button>
            )}
            {mode === 'signup' && (
              <span>Already have an account?{' '}
                <button onClick={() => { setMode('login'); setError(''); setMessage(''); }} className="text-blue-400 hover:text-blue-300 transition-colors">Log in</button>
              </span>
            )}
            {mode === 'login' && (
              <span>Don't have an account?{' '}
                <button onClick={() => { setMode('signup'); setError(''); setMessage(''); }} className="text-blue-400 hover:text-blue-300 transition-colors">Sign up</button>
              </span>
            )}
            {mode === 'forgot' && (
              <button onClick={() => { setMode('login'); setError(''); setMessage(''); }} className="text-blue-400 hover:text-blue-300 transition-colors">
                Back to login
              </button>
            )}
          </div>
        </div>

        {/* ── RIGHT: Visual panel ──────────────────────────────────── */}
        <div className="hidden lg:flex flex-1 relative overflow-hidden">
          <Starfield />
          <div className="relative z-10 flex flex-col justify-center px-16 w-full">

            {/* Headline */}
            <div className="mb-10">
              <div className="inline-flex items-center gap-2 text-blue-400 text-xs font-medium mb-4">
                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
                Live Market Data
              </div>
              <h2 className="text-white text-4xl font-bold leading-tight mb-3">
                Institutional-grade<br />trading intelligence
              </h2>
              <p className="text-gray-400 text-base leading-relaxed max-w-sm">
                AI-powered strategies, real-time analysis, and automated execution — all in one platform.
              </p>
            </div>

            {/* Stat cards */}
            <div className="flex flex-col gap-3 max-w-sm">
              <StatCard label="$NVDA" value="$142.86" change="+3.24%" positive delay={0.1} />
              <StatCard label="$SPY"  value="$598.41" change="+0.87%" positive delay={0.2} />
              <StatCard label="$AAPL" value="$227.52" change="-0.43%" positive={false} delay={0.3} />
              <StatCard label="Portfolio P&L" value="+$4,821.33" change="+2.1% today" positive delay={0.4} />
            </div>

            {/* Floating code snippet */}
            <div className="mt-8 bg-[#0a1628]/80 backdrop-blur-sm border border-white/10 rounded-2xl p-4 max-w-sm" style={{ animation: 'fadeUp 0.6s ease 0.5s both' }}>
              <div className="flex items-center gap-1.5 mb-3">
                <div className="w-2.5 h-2.5 rounded-full bg-red-400/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/60" />
                <span className="text-gray-500 text-xs ml-2 font-mono">strategy.py</span>
              </div>
              <pre className="text-xs font-mono leading-relaxed">
                <span className="text-blue-400">strategy</span>
                <span className="text-gray-400"> = sophia.</span>
                <span className="text-emerald-400">generate</span>
                <span className="text-gray-400">(</span>
                {'\n'}
                <span className="text-gray-400">  ticker=</span>
                <span className="text-yellow-300">"$NVDA"</span>
                <span className="text-gray-400">,</span>
                {'\n'}
                <span className="text-gray-400">  type=</span>
                <span className="text-yellow-300">"momentum"</span>
                {'\n'}
                <span className="text-gray-400">)</span>
              </pre>
            </div>
          </div>
        </div>

      </div>
    </>
  );
}
