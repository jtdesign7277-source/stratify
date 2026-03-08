import { useState } from 'react';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

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

  const handleAppleAuth = async () => {
    setError('');
    const { error: signInError } = await supabase.auth.signInWithOAuth({ provider: 'apple' });
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

  const inputClassName =
    'h-[48px] w-full rounded-lg border border-white/20 bg-white/5 px-4 text-[clamp(0.94rem,0.98vw,1.06rem)] text-white outline-none transition-colors placeholder:text-white/40 focus:border-white/40';
  const outlineButtonClassName =
    'h-[48px] w-full rounded-lg border border-white/80 bg-transparent px-6 text-[clamp(0.95rem,1vw,1.06rem)] font-semibold text-white transition hover:bg-white/8 disabled:cursor-not-allowed disabled:opacity-50';
  // Same bordered box as Email/Password inputs so they look like clickable tabs
  const socialButtonClassName =
    `${inputClassName} flex items-center justify-center gap-3 font-medium cursor-pointer hover:bg-white/10 focus:border-white/50`;

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto grid min-h-screen w-full lg:grid-cols-[1.08fr_0.92fr]">
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

          <div className="max-w-[320px] px-2 py-2 overflow-hidden mt-auto">
            <style>{`
              @keyframes signup-fade-in {
                from { opacity: 0; transform: translateY(4px); }
                to { opacity: 1; transform: translateY(0); }
              }
              .signup-fade-item { animation: signup-fade-in 0.5s ease-out forwards; }
            `}</style>
            <div className="grid grid-cols-5 gap-2 items-center justify-items-center">
              {LEAGUE_LOGOS.map((league, i) => (
                <div
                  key={league.id}
                  className="signup-fade-item flex items-center justify-center opacity-0 w-7 h-7 flex-shrink-0"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  <img
                    src={league.src}
                    alt={league.alt}
                    className="w-full h-full object-contain opacity-90 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-300"
                  />
                </div>
              ))}
              <div
                className="signup-fade-item flex items-center justify-center opacity-0 w-7 h-7 flex-shrink-0"
                style={{ animationDelay: `${LEAGUE_LOGOS.length * 80}ms` }}
              >
                <span className="flex w-full h-full items-center justify-center font-mono text-base font-semibold text-white/90 leading-none">₿</span>
              </div>
            </div>
          </div>
        </aside>

        <main className="flex max-h-screen items-start justify-center overflow-y-auto px-5 py-4 sm:px-8 lg:items-center lg:px-12 xl:px-14">
          <div className="w-full max-w-[646px]">
            <div className="mb-6 flex items-center justify-between lg:mb-8">
              <button
                type="button"
                onClick={onBackToLanding}
                className="inline-flex items-center gap-2 text-sm text-white/60 transition hover:text-white lg:hidden"
              >
                <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
                Back
              </button>
              <div className="text-[11px] font-normal uppercase tracking-[0.32em] text-white/75">STRATIFY</div>
            </div>

            <div className="mb-6 space-y-1 lg:mb-8">
              <h1 className="text-[clamp(1.75rem,2.4vw,2.5rem)] font-semibold leading-tight text-white">
                {mode === 'forgot' ? heading : welcomeHeading}
              </h1>
              <p className="text-[clamp(0.9rem,0.96vw,1rem)] text-white/55">{subtext}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode !== 'forgot' && (
                <>
                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={handleAppleAuth}
                      className={socialButtonClassName}
                    >
                      <AppleGlyph />
                      Continue with Apple
                    </button>
                    <button
                      type="button"
                      onClick={handleGoogleAuth}
                      className={socialButtonClassName}
                    >
                      <GoogleGlyph />
                      Continue with Google
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-white/20" />
                    <span className="text-sm text-white/50">or</span>
                    <div className="h-px flex-1 bg-white/20" />
                  </div>
                </>
              )}

              <div className="space-y-2">
                <label className="block text-sm font-medium text-white/80">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  className={inputClassName}
                  required
                />
              </div>

              {mode !== 'forgot' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
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
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder={mode === 'signup' ? 'Create password' : 'Password'}
                      className={`${inputClassName} pr-12`}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" strokeWidth={1.5} /> : <Eye className="h-5 w-5" strokeWidth={1.5} />}
                    </button>
                  </div>
                </div>
              )}

              {mode === 'login' && (
                <label className="inline-flex items-center gap-2.5 text-sm text-white/80">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(event) => setRememberMe(event.target.checked)}
                    className="h-4 w-4 rounded border border-white/40 bg-white/5 accent-emerald-500"
                  />
                  Keep me logged in for up to 30 days
                </label>
              )}

              {error ? (
                <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                  {error}
                </div>
              ) : null}
              {message ? (
                <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
                  {message}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="h-[48px] w-full rounded-lg bg-emerald-500 px-6 text-[clamp(0.95rem,1vw,1.06rem)] font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-black"
              >
                {loading ? 'Processing...' : submitLabel}
              </button>

              <div className="text-center text-sm text-white/60">
                {mode === 'signup' ? (
                  <span>
                    Already have an account?{' '}
                    <button type="button" onClick={() => switchMode('login')} className="font-medium text-white hover:underline">
                      Sign in
                    </button>
                  </span>
                ) : mode === 'login' ? (
                  <span>
                    Don&apos;t have an account?{' '}
                    <button type="button" onClick={() => switchMode('signup')} className="font-medium text-white hover:underline">
                      Sign up now
                    </button>
                  </span>
                ) : (
                  <button type="button" onClick={() => switchMode('login')} className="font-medium text-white hover:underline">
                    Back to sign in
                  </button>
                )}
              </div>

              <p className="text-[clamp(0.72rem,0.8vw,0.85rem)] leading-relaxed text-white/40 text-center">
                By continuing, you agree to Stratify&apos;s Terms of Service and Privacy Policy.
              </p>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}
