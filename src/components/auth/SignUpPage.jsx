import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { supabase } from '../../lib/supabaseClient';

const SignUpPage = ({ onSuccess, onBackToLanding }) => {
  const [mode, setMode] = useState('signup');
  const [formState, setFormState] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [status, setStatus] = useState({ type: '', message: '' });
  const [loading, setLoading] = useState(false);

  const isSignIn = mode === 'signin';

  const inputClass =
    'w-full rounded-xl border border-white/15 bg-black/25 px-4 py-2.5 text-sm text-white/90 placeholder:text-white/35 backdrop-blur-sm focus:border-emerald-400/70 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 transition';

  const resetStatus = () => setStatus({ type: '', message: '' });

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const handleTabChange = (nextMode) => {
    if (nextMode === mode) return;
    setMode(nextMode);
    resetStatus();
  };

  const handleSignUp = async (event) => {
    event.preventDefault();
    resetStatus();

    if (formState.password !== formState.confirmPassword) {
      setStatus({ type: 'error', message: 'Passwords do not match' });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: formState.email,
        password: formState.password,
        options: {
          data: {
            full_name: formState.fullName,
          },
        },
      });

      if (error) {
        setStatus({ type: 'error', message: error.message || 'Unable to create your account.' });
        return;
      }

      try {
        const userId = data?.user?.id;
        if (userId) {
          await supabase.from('profiles').upsert(
            {
              id: userId,
              email: formState.email,
              full_name: formState.fullName,
              subscription_status: 'free',
              paper_trading_balance: 100000,
            },
            { onConflict: 'id' }
          );
        }
      } catch (profileError) {
        // Profile setup should never block signup success.
      }

      setStatus({ type: 'success', message: 'Check your email to confirm your account!' });
    } catch (submitError) {
      setStatus({
        type: 'error',
        message: submitError?.message || 'Unable to create your account.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (event) => {
    event.preventDefault();
    resetStatus();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: formState.email,
        password: formState.password,
      });

      if (error) {
        setStatus({ type: 'error', message: error.message || 'Unable to sign in.' });
        return;
      }

      if (onSuccess) {
        onSuccess();
        return;
      }

      window.location.assign('/dashboard');
    } catch (submitError) {
      setStatus({ type: 'error', message: submitError?.message || 'Unable to sign in.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-transparent text-white">
      <style>{`
        @keyframes auth-galaxy-rotate {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }
        @keyframes auth-galaxy-pulse {
          0%, 100% { opacity: 0.45; transform: translate(-50%, -50%) scale(0.94); }
          50% { opacity: 0.88; transform: translate(-50%, -50%) scale(1.08); }
        }
        @keyframes auth-nebula-float {
          0%, 100% { transform: translate(-50%, -50%) translateX(0px) translateY(0px) rotate(-16deg) scale(1); }
          50% { transform: translate(-50%, -50%) translateX(12px) translateY(-10px) rotate(-14deg) scale(1.03); }
        }
        @keyframes auth-starfield-drift {
          from { transform: translateY(0px) scale(1); opacity: 0.6; }
          to { transform: translateY(-22px) scale(1.03); opacity: 0.85; }
        }
      `}</style>

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 50% 50%, rgba(3, 6, 8, 0.16) 0%, rgba(3, 6, 8, 0.58) 60%, rgba(3, 6, 8, 0.84) 100%), radial-gradient(circle at 20% 80%, rgba(56, 189, 248, 0.08) 0%, transparent 34%), radial-gradient(circle at 78% 22%, rgba(147, 197, 253, 0.08) 0%, transparent 32%), radial-gradient(circle at 50% 44%, rgba(217, 70, 239, 0.08) 0%, transparent 44%)',
          }}
        />
        <div
          className="absolute left-1/2 top-1/2 h-[960px] w-[1420px] rounded-[50%] blur-3xl"
          style={{
            background:
              'radial-gradient(ellipse at center, rgba(255,255,255,0.26) 0%, rgba(192, 132, 252, 0.20) 18%, rgba(96, 165, 250, 0.18) 36%, rgba(14, 24, 43, 0.08) 58%, transparent 74%)',
            animation: 'auth-nebula-float 24s ease-in-out infinite',
          }}
        />
        <div
          className="absolute left-1/2 top-1/2 h-[840px] w-[840px] rounded-full opacity-90"
          style={{
            background:
              'repeating-conic-gradient(from 0deg, rgba(255,255,255,0.16) 0deg 5deg, rgba(196,181,253,0.08) 5deg 15deg, rgba(56,189,248,0.05) 15deg 26deg, rgba(17,24,39,0.02) 26deg 40deg)',
            filter: 'blur(13px)',
            animation: 'auth-galaxy-rotate 90s linear infinite',
          }}
        />
        <div
          className="absolute left-1/2 top-1/2 h-[420px] w-[420px] rounded-full"
          style={{
            background:
              'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.65) 0%, rgba(191,219,254,0.35) 14%, rgba(167,139,250,0.18) 28%, transparent 64%)',
            filter: 'blur(2px)',
            animation: 'auth-galaxy-pulse 11s ease-in-out infinite',
          }}
        />
        <div
          className="absolute inset-0 opacity-80"
          style={{
            backgroundImage:
              'radial-gradient(circle at 10% 18%, rgba(255,255,255,0.92) 0 1px, transparent 1px), radial-gradient(circle at 28% 76%, rgba(255,255,255,0.72) 0 1px, transparent 1px), radial-gradient(circle at 41% 62%, rgba(255,255,255,0.65) 0 1px, transparent 1px), radial-gradient(circle at 58% 22%, rgba(255,255,255,0.72) 0 1px, transparent 1px), radial-gradient(circle at 73% 42%, rgba(255,255,255,0.68) 0 1px, transparent 1px), radial-gradient(circle at 82% 14%, rgba(255,255,255,0.82) 0 1px, transparent 1px), radial-gradient(circle at 90% 78%, rgba(255,255,255,0.68) 0 1px, transparent 1px)',
            animation: 'auth-starfield-drift 15s ease-in-out infinite alternate',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(3,6,8,0.08) 0%, rgba(3,6,8,0.56) 45%, rgba(3,6,8,0.84) 100%)',
          }}
        />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center px-6 py-10">
        <button
          type="button"
          onClick={() => (onBackToLanding ? onBackToLanding() : window.location.assign('/'))}
          className="text-xs text-white/60 transition hover:text-white"
        >
          Back to landing
        </button>

        <div className="mt-4 rounded-3xl border border-white/20 bg-[#040912]/24 p-6 shadow-[0_0_65px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold">Welcome to Stratify</h1>
            <p className="mt-1 text-sm text-white/60">
              {isSignIn ? 'Sign in to continue.' : 'Create your account in seconds.'}
            </p>
          </div>

          <div className="mb-6 flex rounded-2xl border border-white/15 bg-black/20 p-1 text-xs backdrop-blur-sm">
            <button
              type="button"
              onClick={() => handleTabChange('signin')}
                className={`flex-1 rounded-xl px-3 py-2 font-semibold transition ${
                  isSignIn
                  ? 'border border-white/20 bg-white/10 text-white shadow-[0_0_20px_rgba(255,255,255,0.12)]'
                  : 'text-white/50 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('signup')}
                className={`flex-1 rounded-xl px-3 py-2 font-semibold transition ${
                !isSignIn
                  ? 'border border-white/20 bg-white/10 text-white shadow-[0_0_20px_rgba(255,255,255,0.12)]'
                  : 'text-white/50 hover:text-white'
              }`}
            >
              Sign Up
            </button>
          </div>

          <AnimatePresence mode="wait">
            {isSignIn ? (
              <motion.form
                key="signin"
                onSubmit={handleSignIn}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <div>
                  <label className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-white/50">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formState.email}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="you@stratify.com"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-white/50">
                    Password
                  </label>
                  <input
                    type="password"
                    name="password"
                    value={formState.password}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="••••••••"
                    required
                  />
                </div>

                {status.message && status.type === 'error' && (
                  <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                    {status.message}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500/85 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? 'Signing in...' : 'Sign In'}
                </button>
              </motion.form>
            ) : (
              <motion.form
                key="signup"
                onSubmit={handleSignUp}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <div>
                  <label className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-white/50">
                    Full Name
                  </label>
                  <input
                    type="text"
                    name="fullName"
                    value={formState.fullName}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="Alex Morgan"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-white/50">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formState.email}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="you@stratify.com"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-white/50">
                    Password
                  </label>
                  <input
                    type="password"
                    name="password"
                    value={formState.password}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="••••••••"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-white/50">
                    CONFIRM PASSWORD
                  </label>
                  <input
                    type="password"
                    name="confirmPassword"
                    value={formState.confirmPassword}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="••••••••"
                    required
                  />
                </div>

                {status.message && status.type === 'success' && (
                  <>
                    <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
                      <div className="flex items-start gap-2">
                        <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300">
                          <svg
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            className="h-3 w-3"
                            aria-hidden="true"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.704 5.293a1 1 0 0 1 0 1.414l-7.5 7.5a1 1 0 0 1-1.414 0l-3.5-3.5a1 1 0 1 1 1.414-1.414L8.5 12.086l6.793-6.793a1 1 0 0 1 1.411 0Z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </span>
                        <span>{status.message}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleTabChange('signin')}
                      className="rounded-lg bg-emerald-600/90 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500"
                    >
                      I confirmed my email — Sign In
                    </button>
                  </>
                )}

                {status.message && status.type === 'error' && (
                  <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                    {status.message}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500/85 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? 'Creating account...' : 'Create Account'}
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>

        <div className="mt-6 text-center text-xs text-white/60">
          <button
            type="button"
            onClick={() => (onBackToLanding ? onBackToLanding() : window.location.assign('/'))}
            className="text-white/70 transition hover:text-white"
          >
            Continue as guest
          </button>
        </div>
      </div>
    </div>
  );
};

export default SignUpPage;
