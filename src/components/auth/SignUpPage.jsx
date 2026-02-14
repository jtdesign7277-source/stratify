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
    'w-full rounded-xl border border-white/10 bg-[#0b1220] px-4 py-2.5 text-sm text-white/90 placeholder:text-white/30 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/30 transition';

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
    <div className="min-h-screen bg-[#060d18] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center px-6 py-10">
        <button
          type="button"
          onClick={() => (onBackToLanding ? onBackToLanding() : window.location.assign('/'))}
          className="text-xs text-white/60 transition hover:text-white"
        >
          Back to landing
        </button>

        <div className="mt-4 rounded-3xl border border-white/10 bg-[#0a1220] p-6 shadow-[0_0_40px_rgba(0,0,0,0.4)]">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold">Welcome to Stratify</h1>
            <p className="mt-1 text-sm text-white/60">
              {isSignIn ? 'Sign in to continue.' : 'Create your account in seconds.'}
            </p>
          </div>

          <div className="mb-6 flex rounded-2xl border border-white/10 bg-white/5 p-1 text-xs">
            <button
              type="button"
              onClick={() => handleTabChange('signin')}
              className={`flex-1 rounded-xl px-3 py-2 font-semibold transition ${
                isSignIn
                  ? 'bg-blue-500/20 text-blue-200 shadow-[0_0_20px_rgba(59,130,246,0.35)]'
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
                  ? 'bg-blue-500/20 text-blue-200 shadow-[0_0_20px_rgba(59,130,246,0.35)]'
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
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-500 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
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
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
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
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-500 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
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
