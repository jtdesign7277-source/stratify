import { useState } from 'react';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

const LEFT_POINTS = [
  'Live market context and execution in one workspace.',
  'Fast strategy drafting, backtesting, and deployment flows.',
  'Risk-aware tooling with clear session-level controls.',
];

const LEFT_MARKET_ROWS = [
  { symbol: '$SPY', note: 'US index pulse and liquidity context' },
  { symbol: '$QQQ', note: 'Large-cap tech breadth confirmation' },
  { symbol: '$BTC', note: '24/7 crypto risk-on risk-off signal' },
  { symbol: '$NVDA', note: 'Momentum benchmark for AI complex' },
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

export default function SignUpPage({ onSuccess, onBackToLanding }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoogleAuth = async () => {
    setError('');
    const { error: signInError } = await supabase.auth.signInWithOAuth({ provider: 'google' });
    if (signInError) setError(signInError.message);
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
        const { error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) throw signUpError;
        setMessage('Check your email to confirm your account.');
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      onSuccess?.();
    } catch (submitError) {
      setError(String(submitError?.message || 'Unable to process your request.'));
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (next) => {
    setMode(next);
    setError('');
    setMessage('');
  };

  const heading = {
    signup: 'Create your Stratify account',
    login: 'Log in to Stratify',
    forgot: 'Reset your password',
  }[mode];

  const subtext = {
    signup: 'Start with live data, AI workflows, and execution-ready tooling.',
    login: 'Access your dashboard, signals, and live market context.',
    forgot: "Enter your email and we'll send you a reset link.",
  }[mode];

  const submitLabel = {
    signup: 'Create account',
    login: 'Log in',
    forgot: 'Send reset link',
  }[mode];

  const inputClassName =
    'h-[48px] w-full rounded-[10px] border border-white/60 bg-black px-4 text-[clamp(0.94rem,0.98vw,1.06rem)] text-white outline-none transition-colors placeholder:text-white/25 focus:border-white';
  const outlineButtonClassName =
    'h-[48px] w-full rounded-full border border-white/80 bg-transparent px-6 text-[clamp(0.95rem,1vw,1.06rem)] font-semibold text-white transition hover:bg-white/8 disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto grid min-h-screen w-full lg:grid-cols-[0.95fr_1.05fr]">
        <aside className="hidden border-r border-white/10 px-14 py-16 lg:flex lg:flex-col lg:justify-between">
          <div className="space-y-12">
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
              <h2 className="text-[clamp(2.5rem,4vw,4.7rem)] font-semibold leading-[0.96]">
                One workspace. Every market.
              </h2>
              <p className="text-[clamp(1rem,1.2vw,1.18rem)] leading-relaxed text-white/65">
                Build, test, and deploy smarter execution with live market context and AI-assisted workflows.
              </p>
              <div className="space-y-4">
                {LEFT_POINTS.map((point) => (
                  <div key={point} className="text-[clamp(0.96rem,1.02vw,1.08rem)] text-white/80">
                    {point}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="max-w-[620px] border border-white/12 px-6 py-5">
            <div className="mb-4 text-xs uppercase tracking-[0.2em] text-white/40">Live context</div>
            <div className="space-y-3">
              {LEFT_MARKET_ROWS.map((row) => (
                <div key={row.symbol} className="flex items-start justify-between gap-4">
                  <div className="font-mono text-base text-white">{row.symbol}</div>
                  <div className="text-right text-sm text-white/55">{row.note}</div>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <main className="flex max-h-screen items-start justify-center overflow-y-auto px-5 py-4 sm:px-8 lg:items-center lg:px-12 xl:px-14">
          <div className="w-full max-w-[760px]">
            <div className="mb-6 flex items-center justify-between lg:mb-8">
              <button
                type="button"
                onClick={onBackToLanding}
                className="inline-flex items-center gap-2 text-sm text-white/60 transition hover:text-white lg:hidden"
              >
                <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
                Back
              </button>
              <div className="text-sm font-semibold tracking-wide text-white/75 lg:text-base">Stratify</div>
            </div>

            <div className="mb-6 space-y-2 lg:mb-8">
              <h1 className="text-[clamp(1.7rem,2.4vw,2.5rem)] font-semibold leading-[1.08]">{heading}</h1>
              <p className="text-[clamp(0.9rem,0.96vw,1rem)] text-white/60">{subtext}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="block text-[clamp(0.95rem,0.98vw,1.03rem)] font-medium text-white">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@email.com"
                  className={inputClassName}
                  required
                />
              </div>

              {mode !== 'forgot' && (
                <div className="space-y-2">
                  <label className="block text-[clamp(0.95rem,0.98vw,1.03rem)] font-medium text-white">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder={mode === 'signup' ? 'Create password' : 'Password'}
                      className={`${inputClassName} pr-12`}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-white/75 transition hover:text-white"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" strokeWidth={1.5} /> : <Eye className="h-5 w-5" strokeWidth={1.5} />}
                    </button>
                  </div>
                </div>
              )}

              {mode === 'login' && (
                <label className="mt-0.5 inline-flex items-center gap-2.5 text-[clamp(0.86rem,0.92vw,0.96rem)] text-white/90">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(event) => setRememberMe(event.target.checked)}
                    className="h-5 w-5 rounded border border-white/60 bg-black accent-white"
                  />
                  Keep me logged in for up to 30 days
                </label>
              )}

              {mode === 'login' && (
                <button
                  type="button"
                  onClick={() => switchMode('forgot')}
                  className="text-[clamp(0.86rem,0.9vw,0.95rem)] text-white/75 underline-offset-4 transition hover:text-white hover:underline"
                >
                  Forgot password?
                </button>
              )}

              {error ? (
                <div className="border border-red-500/45 bg-red-500/8 px-3 py-2 text-xs text-red-300">
                  {error}
                </div>
              ) : null}
              {message ? (
                <div className="border border-emerald-500/45 bg-emerald-500/8 px-3 py-2 text-xs text-emerald-300">
                  {message}
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <button type="submit" disabled={loading} className={outlineButtonClassName}>
                  {loading ? 'Processing...' : submitLabel}
                </button>
                <button
                  type="button"
                  onClick={() => switchMode(mode === 'forgot' ? 'login' : 'forgot')}
                  className={outlineButtonClassName}
                >
                  Help
                </button>
              </div>

              {mode !== 'forgot' && (
                <>
                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-white/18" />
                    <span className="text-base text-white/50">or</span>
                    <div className="h-px flex-1 bg-white/18" />
                  </div>

                  <button
                    type="button"
                    onClick={handleGoogleAuth}
                    className={`${outlineButtonClassName} flex w-full items-center justify-center gap-3 sm:w-[360px]`}
                  >
                    <GoogleGlyph />
                    {mode === 'signup' ? 'Sign up with Google' : 'Log in with Google'}
                  </button>
                </>
              )}

              <div className="pt-1 text-[clamp(0.86rem,0.9vw,0.98rem)] text-white/75">
                {mode === 'signup' ? (
                  <span>
                    Already have an account?{' '}
                    <button type="button" onClick={() => switchMode('login')} className="font-semibold text-white underline underline-offset-4">
                      Sign in
                    </button>
                  </span>
                ) : mode === 'login' ? (
                  <span>
                    Not on Stratify?{' '}
                    <button type="button" onClick={() => switchMode('signup')} className="font-semibold text-white underline underline-offset-4">
                      Create an account
                    </button>
                  </span>
                ) : (
                  <button type="button" onClick={() => switchMode('login')} className="font-semibold text-white underline underline-offset-4">
                    Back to sign in
                  </button>
                )}
              </div>

              <p className="text-[clamp(0.76rem,0.82vw,0.9rem)] leading-relaxed text-white/45">
                This site is protected by reCAPTCHA and the Google Privacy Policy and Terms of Service apply.
              </p>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}
