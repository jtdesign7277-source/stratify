import { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import TermsModal from '../legal/TermsModal';
import PrivacyModal from '../legal/PrivacyModal';

const LEFT_POINTS = [
  'Live market context and execution in one workspace.',
  'Fast strategy drafting, backtesting, and deployment flows.',
  'Risk-aware tooling with clear session-level controls.',
];

// Official league logos (Wikimedia Commons / Wikipedia)
const LEAGUE_LOGOS = [
  { id: 'nba', alt: 'NBA', src: 'https://upload.wikimedia.org/wikipedia/commons/e/e5/NBA_script.svg' },
  { id: 'nhl', alt: 'NHL', src: 'https://upload.wikimedia.org/wikipedia/de/1/19/Logo-NHL.svg' },
  { id: 'mlb', alt: 'MLB', src: 'https://upload.wikimedia.org/wikipedia/commons/a/a6/Major_League_Baseball_logo.svg' },
  { id: 'nfl', alt: 'NFL', src: 'https://upload.wikimedia.org/wikipedia/en/a/a2/National_Football_League_logo.svg' },
];

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function AppleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}

// Nasdaq logo: text only
function NasdaqLogoIcon() {
  return (
    <svg viewBox="0 0 80 28" className="w-full h-full" fill="none" aria-hidden="true">
      <text x="0" y="20" fill="rgba(255,255,255,0.95)" fontFamily="system-ui, Arial, sans-serif" fontWeight="600" fontSize="18" letterSpacing="0.02em">Nasdaq</text>
    </svg>
  );
}

export default function SignUpPage({ initialMode = 'login', onSuccess, onBackToLanding }) {
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const leftPanelCanvasRef = useRef(null);

  useEffect(() => {
    const canvas = leftPanelCanvasRef.current;
    const container = canvas?.parentElement;
    if (!canvas || !container) return;

    const setSize = () => {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    };
    setSize();
    const resizeObserver = new ResizeObserver(setSize);
    resizeObserver.observe(container);

    const tickerStrings = ['$AAPL +1.2%', '$TSLA -0.8%', '$NVDA +2.4%', '$SPY +0.3%', '$BTC +3.1%', '$ETH -1.5%', '$GOOGL +0.5%', '$MSFT -0.2%', '$META +1.1%', '$AMZN +0.7%'];
    const candleCount = 50;
    const tickerCount = 10;
    let candles = Array.from({ length: candleCount }, () => ({
      x: Math.random() * (container.clientWidth || 800),
      y: Math.random() * (container.clientHeight || 600),
      bodyH: 8 + Math.random() * 12,
      isGreen: Math.random() > 0.5,
    }));
    let tickers = Array.from({ length: tickerCount }, (_, i) => ({
      text: tickerStrings[i % tickerStrings.length],
      x: Math.random() * (container.clientWidth || 800),
      y: Math.random() * (container.clientHeight || 600),
      speed: 0.2 + Math.random() * 0.3,
    }));
    const driftPerFrame = 0.3;
    const startTime = performance.now();

    let rafId;
    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      if (!w || !h) { rafId = requestAnimationFrame(draw); return; }
      const ctx = canvas.getContext('2d');
      if (!ctx) { rafId = requestAnimationFrame(draw); return; }
      ctx.clearRect(0, 0, w, h);

      for (let i = 0; i < h; i += 40) {
        ctx.strokeStyle = 'rgba(255,255,255,0.03)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(w, i);
        ctx.stroke();
      }

      const pulse = 0.04 + 0.04 * Math.sin((performance.now() - startTime) / 4000 * 2 * Math.PI);
      const gradient = ctx.createRadialGradient(0, h, 0, 0, h, 300);
      gradient.addColorStop(0, `rgba(16,185,129,${pulse})`);
      gradient.addColorStop(1, 'rgba(16,185,129,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);

      const bodyW = 3;
      const wickW = 1;
      candles.forEach((c) => {
        c.y -= driftPerFrame;
        if (c.y + c.bodyH < 0) {
          c.y = h + c.bodyH;
          c.x = Math.random() * w;
          c.bodyH = 8 + Math.random() * 12;
          c.isGreen = Math.random() > 0.5;
        }
        const openY = c.y + c.bodyH;
        const closeY = c.y;
        ctx.fillStyle = c.isGreen ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)';
        ctx.fillRect(c.x - bodyW / 2, Math.min(openY, closeY), bodyW, Math.abs(c.bodyH));
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(c.x - wickW / 2, c.y, wickW, c.bodyH);
      });

      ctx.font = '12px monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      tickers.forEach((t) => {
        t.y -= t.speed;
        if (t.y < -20) {
          t.y = h + 20;
          t.x = Math.random() * w;
        }
        ctx.fillText(t.text, t.x, t.y);
      });

      rafId = requestAnimationFrame(draw);
    };
    rafId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
    };
  }, []);

  const handleGoogleAuth = async () => {
    setError('');
    setOauthLoading(true);
    try {
      const { data, error: signInError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/dashboard` : undefined },
      });
      if (signInError) {
        const m = String(signInError.message || 'Could not start Google sign-in.');
        const connectionErr = /fetch|network|connection|refused|failed to load/i.test(m) || signInError?.name === 'TypeError';
        setError(connectionErr ? "Can't reach the server. Check your connection and try again." : m);
        return;
      }
      if (data?.url) window.location.href = data.url;
    } finally {
      setOauthLoading(false);
    }
  };

  const handleAppleAuth = async () => {
    setError('');
    setOauthLoading(true);
    try {
      const { data, error: signInError } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: { redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/dashboard` : undefined },
      });
      if (signInError) {
        const m = String(signInError.message || 'Could not start Apple sign-in.');
        const connectionErr = /fetch|network|connection|refused|failed to load/i.test(m) || signInError?.name === 'TypeError';
        setError(connectionErr ? "Can't reach the server. Check your connection and try again." : m);
        return;
      }
      if (data?.url) window.location.href = data.url;
    } finally {
      setOauthLoading(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      if (mode === 'forgot') {
        const { error: forgotError } = await supabase.auth.resetPasswordForEmail(email);
        if (forgotError) throw forgotError;
        setMessage('Password reset email sent.');
        return;
      }

      if (mode === 'signup') {
        if (password !== confirmPassword) {
          setError('Passwords do not match.');
          return;
        }
        const { error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) throw signUpError;
        setMessage('Check your email to confirm your account.');
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      onSuccess();
    } catch (submitError) {
      const msg = String(submitError?.message || 'Unable to process your request.');
      const isConnectionError = /fetch|network|connection|refused|failed to load/i.test(msg) || submitError?.name === 'TypeError';
      setError(isConnectionError ? "Can't reach the server. Check your connection and try again." : msg);
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (next) => {
    setMode(next);
    setError('');
    setMessage('');
    setConfirmPassword('');
  };

  const heading = {
    signup: 'Create your Stratify account',
    login: 'Log in to Stratify',
    forgot: 'Reset your password',
  }[mode];

  const subtext = {
    signup: 'Create your account to get started.',
    login: 'Sign in to your account',
    forgot: "Enter your email and we'll send you a reset link.",
  }[mode];

  const welcomeHeading = mode === 'login' ? 'Welcome back' : mode === 'signup' ? 'Create your account' : heading;

  const submitLabel = {
    signup: 'Create account',
    login: 'Log in',
    forgot: 'Send reset link',
  }[mode];

  const inputStyle = {
    height: 48,
    width: '100%',
    borderRadius: 10,
    border: '1px solid #555',
    background: '#252525',
    padding: '0 16px',
    fontSize: 'clamp(0.94rem, 0.98vw, 1.06rem)',
    color: '#fff',
    outline: 'none',
  };
  const tabStyle = {
    height: 48,
    width: '100%',
    borderRadius: 10,
    border: '1px solid #555',
    background: '#252525',
    padding: '0 16px',
    fontSize: 'clamp(0.94rem, 0.98vw, 1.06rem)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    cursor: 'pointer',
    fontWeight: 500,
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto grid min-h-screen w-full lg:grid-cols-[1.08fr_0.92fr]">
        <aside className="hidden border-r border-white/10 px-14 py-16 lg:flex lg:flex-col lg:justify-between relative">
          <canvas ref={leftPanelCanvasRef} className="absolute inset-0 z-0" style={{ width: '100%', height: '100%' }} />
          <div className="relative z-10 space-y-12">
            <button
              type="button"
              onClick={onBackToLanding}
              className="inline-flex items-center gap-2 text-sm text-white/60 transition hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
              Back
            </button>

            <div className="max-w-[620px] space-y-7">
              <p className="text-[11px] uppercase tracking-[0.32em] text-white/45">Stratify Platform</p>
              <div className="relative z-10 bg-gradient-to-r from-black/50 via-black/30 to-transparent rounded-2xl px-6 py-4">
                <h2 className="text-[clamp(2.5rem,4vw,4.7rem)] font-semibold leading-[0.96]">
                  One workspace. Every market.
                </h2>
                <p className="mt-5 text-[clamp(1rem,1.2vw,1.18rem)] leading-relaxed text-white/65">
                  Build, test, and deploy smarter execution with live market context and AI-assisted workflows.
                </p>
                <div className="mt-5 space-y-4">
                  {LEFT_POINTS.map((point) => (
                    <div key={point} className="text-[clamp(0.96rem,1.02vw,1.08rem)] text-white/80">
                      {point}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="relative z-10 max-w-[320px] px-2 py-2 overflow-visible mt-auto">
            <style>{`
              @keyframes signup-fade-in {
                from { opacity: 0; transform: translateY(4px); }
                to { opacity: 1; transform: translateY(0); }
              }
              .signup-fade-item { animation: signup-fade-in 0.5s ease-out forwards; }
            `}</style>
            <div className="grid grid-cols-5 gap-3 items-center justify-items-center">
              {LEAGUE_LOGOS.map((league, i) => (
                <div
                  key={league.id}
                  className="signup-fade-item flex items-center justify-center opacity-0 w-7 h-7 flex-shrink-0"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  <img
                    src={league.src}
                    alt={league.alt}
                    className={`w-full h-full object-contain grayscale hover:grayscale-0 transition-all duration-300 ${league.id === 'nba' ? 'opacity-100 brightness-110' : 'opacity-90 hover:opacity-100'}`}
                  />
                </div>
              ))}
              <div
                className="signup-fade-item flex items-center justify-center opacity-0 w-[5rem] h-7 flex-shrink-0 ml-8"
                style={{ animationDelay: `${LEAGUE_LOGOS.length * 80}ms` }}
              >
                <div className="w-full h-full flex items-center justify-center opacity-90 hover:opacity-100 transition-opacity duration-300">
                  <NasdaqLogoIcon />
                </div>
              </div>
            </div>
          </div>
        </aside>

        <main className="flex max-h-screen items-start justify-center overflow-y-auto px-5 py-4 sm:px-8 lg:items-center lg:px-12 xl:px-14">
          <div className="w-full max-w-[420px]">
            <header className="mb-6 flex items-center justify-between lg:mb-8">
              <button
                type="button"
                onClick={onBackToLanding}
                className="inline-flex items-center gap-2 text-sm text-white/60 transition hover:text-white lg:hidden"
              >
                <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
                Back
              </button>
              <span className="text-[11px] font-normal uppercase tracking-[0.32em] text-white/75">STRATIFY</span>
            </header>

            <section className="mb-6 lg:mb-8">
              <h1 className="text-[clamp(1.75rem,2.4vw,2.5rem)] font-semibold leading-tight text-white">
                {mode === 'forgot' ? heading : welcomeHeading}
              </h1>
              <p className="mt-1 text-[clamp(0.9rem,0.96vw,1rem)] text-white/55">{subtext}</p>
            </section>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode !== 'forgot' && (
                <>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-white/80">Sign in with</label>
                    <div className="space-y-3">
                      <button
                        type="button"
                        onClick={handleAppleAuth}
                        disabled={oauthLoading}
                        style={tabStyle}
                        onMouseOver={(e) => { e.currentTarget.style.background = '#2a2a2a'; e.currentTarget.style.borderColor = '#666'; }}
                        onMouseOut={(e) => { e.currentTarget.style.background = '#252525'; e.currentTarget.style.borderColor = '#555'; }}
                      >
                        <AppleGlyph />
                        {oauthLoading ? 'Redirecting…' : 'Continue with Apple'}
                      </button>
                      <button
                        type="button"
                        onClick={handleGoogleAuth}
                        disabled={oauthLoading}
                        style={tabStyle}
                        onMouseOver={(e) => { e.currentTarget.style.background = '#2a2a2a'; e.currentTarget.style.borderColor = '#666'; }}
                        onMouseOut={(e) => { e.currentTarget.style.background = '#252525'; e.currentTarget.style.borderColor = '#555'; }}
                      >
                        <GoogleGlyph />
                        {oauthLoading ? 'Redirecting…' : 'Continue with Google'}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-white/20" />
                    <span className="text-sm text-white/50">or</span>
                    <div className="h-px flex-1 bg-white/20" />
                  </div>
                </>
              )}

              <div>
                <label className="mb-2 block text-sm font-medium text-white/80">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  style={inputStyle}
                  required
                />
              </div>

              {mode !== 'forgot' && (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="block text-sm font-medium text-white/80">Password</label>
                    {mode === 'login' && (
                      <button
                        type="button"
                        onClick={() => switchMode('forgot')}
                        className="text-sm text-white/60 hover:text-white transition"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={mode === 'signup' ? 'Create password' : 'Password'}
                      style={{ ...inputStyle, paddingRight: 48 }}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((p) => !p)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" strokeWidth={1.5} /> : <Eye className="h-5 w-5" strokeWidth={1.5} />}
                    </button>
                  </div>
                </div>
              )}

              {mode === 'signup' && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-white/80">Re-enter password</label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      style={{ ...inputStyle, paddingRight: 48 }}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((p) => !p)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition"
                      aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    >
                      {showConfirmPassword ? <EyeOff className="h-5 w-5" strokeWidth={1.5} /> : <Eye className="h-5 w-5" strokeWidth={1.5} />}
                    </button>
                  </div>
                </div>
              )}

              {mode === 'login' && (
                <label className="inline-flex items-center gap-2.5 text-sm text-white/80">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 rounded border border-white/40 bg-white/5 accent-[#609968]"
                  />
                  Keep me logged in for up to 30 days
                </label>
              )}

              {error && (
                <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                  {error}
                </div>
              )}
              {message && (
                <div className="rounded-lg border border-[#609968]/50 bg-[#609968]/15 px-3 py-2 text-sm text-[#8fbc97]">
                  {message}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="h-12 w-full rounded-lg bg-[#609968] px-6 text-[clamp(0.95rem,1vw,1.06rem)] font-semibold text-white transition hover:bg-[#4d7a54] disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[#609968] focus:ring-offset-2 focus:ring-offset-black"
              >
                {loading ? 'Processing...' : submitLabel}
              </button>

              <div className="text-center text-sm text-white/60">
                {mode === 'signup' && (
                  <span>
                    Already have an account?{' '}
                    <button type="button" onClick={() => switchMode('login')} className="font-medium text-white hover:underline">
                      Sign in
                    </button>
                  </span>
                )}
                {mode === 'login' && (
                  <span>
                    Don&apos;t have an account?{' '}
                    <button type="button" onClick={() => switchMode('signup')} className="font-medium text-white hover:underline">
                      Sign up now
                    </button>
                  </span>
                )}
                {mode === 'forgot' && (
                  <button type="button" onClick={() => switchMode('login')} className="font-medium text-white hover:underline">
                    Back to sign in
                  </button>
                )}
              </div>

              <p className="text-[clamp(0.72rem,0.8vw,0.85rem)] leading-relaxed text-white/40 text-center">
                By continuing, you agree to Stratify&apos;s{' '}
                <button type="button" onClick={() => setShowTerms(true)} className="text-[#609968] cursor-pointer hover:text-[#7ab88a] underline underline-offset-2 transition-colors">
                  Terms of Service
                </button>
                {' '}and{' '}
                <button type="button" onClick={() => setShowPrivacy(true)} className="text-[#609968] cursor-pointer hover:text-[#7ab88a] underline underline-offset-2 transition-colors">
                  Privacy Policy
                </button>
                .
              </p>
            </form>
          </div>
        </main>
      </div>
      <TermsModal isOpen={showTerms} onClose={() => setShowTerms(false)} />
      <PrivacyModal isOpen={showPrivacy} onClose={() => setShowPrivacy(false)} />
    </div>
  );
}
