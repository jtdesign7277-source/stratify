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
    const stars = Array.from({ length: 160 }, () => ({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, r: Math.random() * 1.2 + 0.2, o: Math.random() * 0.6 + 0.2, speed: Math.random() * 0.15 + 0.03 }));
    const beams = Array.from({ length: 6 }, (_, i) => ({ x: (canvas.width / 7) * (i + 1), o: Math.random() * 0.06 + 0.02 }));
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
      bg.addColorStop(0, '#060d18'); bg.addColorStop(0.5, '#091428'); bg.addColorStop(1, '#060d18');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, canvas.width, canvas.height);
      beams.forEach(b => { const g = ctx.createLinearGradient(b.x, 0, b.x, canvas.height); g.addColorStop(0, `rgba(59,130,246,0)`); g.addColorStop(0.3, `rgba(59,130,246,${b.o})`); g.addColorStop(0.7, `rgba(99,102,241,${b.o*0.7})`); g.addColorStop(1, `rgba(59,130,246,0)`); ctx.fillStyle = g; ctx.fillRect(b.x-1, 0, 2, canvas.height); });
      stars.forEach(s => { s.y -= s.speed; if (s.y < 0) { s.y = canvas.height; s.x = Math.random() * canvas.width; } ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2); ctx.fillStyle = `rgba(200,220,255,${s.o})`; ctx.fill(); });
      const orb = ctx.createRadialGradient(canvas.width*0.5, canvas.height*0.3, 0, canvas.width*0.5, canvas.height*0.3, canvas.width*0.5);
      orb.addColorStop(0, 'rgba(59,130,246,0.12)'); orb.addColorStop(0.5, 'rgba(79,70,229,0.06)'); orb.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = orb; ctx.fillRect(0, 0, canvas.width, canvas.height);
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
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/dashboard` } });
    if (error) setError(error.message);
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(''); setMessage(''); setLoading(true);
    try {
      if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
        if (error) throw error;
        setMessage('Check your email for a reset link.'); setLoading(false); return;
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
  const title = mode === 'signup' ? 'Create your account' : mode === 'login' ? 'Welcome back' : 'Reset password';
  const btnLabel = mode === 'signup' ? 'Sign up' : mode === 'login' ? 'Log in' : 'Send Reset Link';

  return (
    <>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}.su-card{animation:fadeUp 0.5s ease both}`}</style>
      <div className="min-h-screen relative flex items-center justify-center">
        <Starfield />
        <div className="relative z-10 w-full max-w-sm px-4 su-card">
          <div className="bg-[#0a1628]/80 backdrop-blur-xl border border-white/10 rounded-2xl px-8 py-10">
            <button onClick={onBackToLanding} className="w-full text-center mb-6">
              <span className="text-white text-2xl font-bold tracking-tight">Stratify</span>
            </button>
            <h1 className="text-white text-xl font-semibold text-center mb-8">{title}</h1>

            {mode !== 'forgot' && (
              <>
                <button onClick={handleGoogleAuth} className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 text-gray-800 font-medium rounded-xl px-4 py-3 text-sm transition-colors mb-5">
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </button>
                <div className="flex items-center gap-3 mb-5">
                  <div className="flex-1 h-px bg-white/10" />
                  <span className="text-gray-500 text-xs">or</span>
                  <div className="flex-1 h-px bg-white/10" />
                </div>
              </>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" required className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500/60 transition-all" />
              {mode !== 'forgot' && <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={mode === 'signup' ? 'Create password' : 'Password'} required className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500/60 transition-all" />}
              {mode === 'signup' && <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Confirm password" required className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500/60 transition-all" />}
              {error && <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">{error}</div>}
              {message && <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 text-emerald-400 text-sm">{message}</div>}
              <button type="submit" disabled={loading} className="mt-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl px-4 py-3 text-sm transition-colors flex items-center justify-center gap-2">
                {loading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Processing...</> : btnLabel}
              </button>
            </form>

            <div className="mt-5 flex flex-col gap-2 text-center text-sm text-gray-500">
              {mode === 'signup' && <span>Already have an account? <button onClick={() => switchMode('login')} className="text-blue-400 hover:text-blue-300 transition-colors">Sign in</button></span>}
              {mode === 'login' && <><button onClick={() => switchMode('forgot')} className="text-blue-400 hover:text-blue-300 transition-colors">Forgot password?</button><span>Don't have an account? <button onClick={() => switchMode('signup')} className="text-blue-400 hover:text-blue-300 transition-colors">Sign up</button></span></>}
              {mode === 'forgot' && <button onClick={() => switchMode('login')} className="text-blue-400 hover:text-blue-300 transition-colors">Back to login</button>}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
