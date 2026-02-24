import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { supabase } from '../../lib/supabaseClient';
import { PRO_MONTHLY_PRICE, PRO_MONTHLY_PRICE_LABEL } from '../../lib/billing';

const PRO_YEARLY_PRICE_LABEL = `$${(PRO_MONTHLY_PRICE * 12 * 0.8).toFixed(2)}/year`;

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
  const actionButtonClass =
    'flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-300/40 bg-gradient-to-r from-emerald-500/30 via-emerald-400/22 to-cyan-400/22 py-2.5 text-sm font-semibold text-emerald-100 shadow-[0_0_22px_rgba(16,185,129,0.16)] backdrop-blur-sm transition hover:from-emerald-400/40 hover:via-emerald-300/30 hover:to-cyan-300/30 disabled:cursor-not-allowed disabled:opacity-60';

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
        @keyframes signup-galaxy-rotate {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }
        @keyframes signup-galaxy-pulse {
          0%, 100% { opacity: 0.45; transform: translate(-50%, -50%) scale(0.94); }
          50% { opacity: 0.88; transform: translate(-50%, -50%) scale(1.08); }
        }
        @keyframes signup-nebula-float {
          0%, 100% { transform: translate(-50%, -50%) translateX(0px) translateY(0px) rotate(-16deg) scale(1); }
          50% { transform: translate(-50%, -50%) translateX(12px) translateY(-10px) rotate(-14deg) scale(1.03); }
        }
        @keyframes signup-starfield-drift {
          from { transform: translateY(0px) scale(1); opacity: 0.6; }
          to { transform: translateY(-22px) scale(1.03); opacity: 0.85; }
        }
        @keyframes signup-star-twinkle {
          0%, 100% { opacity: 0.12; filter: brightness(0.88); }
          20% { opacity: 0.48; filter: brightness(1.25); }
          45% { opacity: 0.86; filter: brightness(1.85); }
          68% { opacity: 0.3; filter: brightness(1.08); }
          84% { opacity: 0.62; filter: brightness(1.45); }
        }
        @keyframes signup-star-flicker {
          0%, 100% { opacity: 0.06; }
          24% { opacity: 0.3; }
          41% { opacity: 0.14; }
          71% { opacity: 0.4; }
          88% { opacity: 0.18; }
        }
        @keyframes signup-milkyway-drift {
          0%, 100% { transform: translate(-50%, -50%) rotate(-15deg) scale(1); opacity: 0.38; }
          50% { transform: translate(-50%, -50%) rotate(-13deg) scale(1.03); opacity: 0.58; }
        }
      `}</style>

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 50% 50%, rgba(3, 6, 8, 0.12) 0%, rgba(3, 6, 8, 0.54) 60%, rgba(3, 6, 8, 0.82) 100%), radial-gradient(circle at 20% 80%, rgba(56, 189, 248, 0.1) 0%, transparent 34%), radial-gradient(circle at 78% 22%, rgba(147, 197, 253, 0.1) 0%, transparent 32%), radial-gradient(circle at 50% 44%, rgba(16, 185, 129, 0.1) 0%, transparent 44%)',
          }}
        />
        <div
          className="absolute left-1/2 top-[58%] h-[540px] w-[1700px] rounded-[50%]"
          style={{
            background:
              'linear-gradient(92deg, transparent 8%, rgba(255,255,255,0.2) 23%, rgba(56,189,248,0.24) 43%, rgba(16,185,129,0.2) 56%, rgba(96,165,250,0.18) 71%, transparent 91%), radial-gradient(ellipse at center, rgba(255,255,255,0.2) 0%, rgba(148,220,255,0.16) 36%, rgba(16,185,129,0.13) 58%, transparent 80%)',
            filter: 'blur(34px)',
            mixBlendMode: 'screen',
            animation: 'signup-milkyway-drift 34s ease-in-out infinite',
          }}
        />
        <div
          className="absolute left-1/2 top-[60%] h-[360px] w-[1140px] rounded-[50%]"
          style={{
            background:
              'radial-gradient(ellipse at center, rgba(255,255,255,0.28) 0%, rgba(167,243,208,0.2) 30%, rgba(125,211,252,0.16) 52%, transparent 78%)',
            filter: 'blur(30px)',
            mixBlendMode: 'screen',
            animation: 'signup-nebula-float 26s ease-in-out infinite',
          }}
        />
        <div
          className="absolute left-1/2 top-[62%] h-[960px] w-[1420px] rounded-[50%] blur-3xl"
          style={{
            background:
              'radial-gradient(ellipse at center, rgba(255,255,255,0.28) 0%, rgba(52, 211, 153, 0.22) 18%, rgba(96, 165, 250, 0.2) 36%, rgba(14, 24, 43, 0.08) 58%, transparent 74%)',
            animation: 'signup-nebula-float 24s ease-in-out infinite',
          }}
        />
        <div
          className="absolute left-1/2 top-[62%] h-[840px] w-[840px] rounded-full opacity-90"
          style={{
            background:
              'repeating-conic-gradient(from 0deg, rgba(255,255,255,0.16) 0deg 5deg, rgba(74,222,128,0.08) 5deg 15deg, rgba(56,189,248,0.05) 15deg 26deg, rgba(17,24,39,0.02) 26deg 40deg)',
            filter: 'blur(13px)',
            animation: 'signup-galaxy-rotate 90s linear infinite',
          }}
        />
        <div
          className="absolute left-1/2 top-[62%] h-[420px] w-[420px] rounded-full"
          style={{
            background:
              'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.65) 0%, rgba(167,243,208,0.35) 14%, rgba(125,211,252,0.18) 28%, transparent 64%)',
            filter: 'blur(2px)',
            animation: 'signup-galaxy-pulse 11s ease-in-out infinite',
          }}
        />
        <div
          className="absolute inset-0 opacity-95"
          style={{
            backgroundImage:
              'radial-gradient(circle at 5% 12%, rgba(255,255,255,0.96) 0 1.15px, transparent 1.6px), radial-gradient(circle at 9% 74%, rgba(255,255,255,0.78) 0 1.05px, transparent 1.45px), radial-gradient(circle at 17% 34%, rgba(167,243,208,0.7) 0 1px, transparent 1.4px), radial-gradient(circle at 24% 57%, rgba(255,255,255,0.8) 0 1.1px, transparent 1.5px), radial-gradient(circle at 30% 22%, rgba(125,211,252,0.7) 0 1px, transparent 1.4px), radial-gradient(circle at 37% 80%, rgba(255,255,255,0.75) 0 1.05px, transparent 1.4px), radial-gradient(circle at 44% 63%, rgba(255,255,255,0.7) 0 1px, transparent 1.35px), radial-gradient(circle at 52% 15%, rgba(167,243,208,0.72) 0 1.05px, transparent 1.45px), radial-gradient(circle at 59% 41%, rgba(255,255,255,0.74) 0 1px, transparent 1.35px), radial-gradient(circle at 67% 71%, rgba(125,211,252,0.7) 0 1.05px, transparent 1.45px), radial-gradient(circle at 73% 24%, rgba(255,255,255,0.85) 0 1.1px, transparent 1.5px), radial-gradient(circle at 78% 53%, rgba(255,255,255,0.7) 0 1px, transparent 1.35px), radial-gradient(circle at 84% 12%, rgba(167,243,208,0.72) 0 1px, transparent 1.35px), radial-gradient(circle at 90% 39%, rgba(255,255,255,0.86) 0 1.1px, transparent 1.5px), radial-gradient(circle at 94% 78%, rgba(255,255,255,0.76) 0 1px, transparent 1.35px)',
            animation: 'signup-starfield-drift 16s ease-in-out infinite alternate',
          }}
        />
        <div
          className="absolute inset-0 opacity-78"
          style={{
            backgroundImage:
              'radial-gradient(rgba(255,255,255,0.36) 0.65px, transparent 0.95px), radial-gradient(rgba(125,211,252,0.28) 0.55px, transparent 0.9px), radial-gradient(rgba(167,243,208,0.24) 0.6px, transparent 0.95px)',
            backgroundSize: '180px 180px, 250px 250px, 320px 320px',
            backgroundPosition: '0 0, 80px 120px, 140px 30px',
            animation: 'signup-star-twinkle 7.8s ease-in-out infinite',
          }}
        />
        <div
          className="absolute inset-0 opacity-62"
          style={{
            backgroundImage:
              'radial-gradient(rgba(255,255,255,0.4) 0.75px, transparent 1px), radial-gradient(rgba(56,189,248,0.36) 0.65px, transparent 0.95px)',
            backgroundSize: '220px 220px, 310px 310px',
            backgroundPosition: '40px 80px, 120px 30px',
            animation: 'signup-star-twinkle 6.2s ease-in-out infinite',
          }}
        />
        <div
          className="absolute inset-0 opacity-56"
          style={{
            backgroundImage:
              'radial-gradient(rgba(255,255,255,0.52) 0.5px, transparent 0.9px), radial-gradient(rgba(134,239,172,0.44) 0.55px, transparent 0.95px), radial-gradient(rgba(147,197,253,0.45) 0.5px, transparent 0.9px)',
            backgroundSize: '260px 260px, 340px 340px, 420px 420px',
            backgroundPosition: '120px 24px, 0 170px, 210px 90px',
            animation: 'signup-star-flicker 5.6s linear infinite',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(180deg, rgba(3,6,8,0.04) 0%, rgba(3,6,8,0.5) 45%, rgba(3,6,8,0.8) 100%)',
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

          <div className="mb-6 rounded-2xl border border-white/15 bg-black/20 p-3 backdrop-blur-sm">
            <p className="text-[10px] uppercase tracking-[0.22em] text-white/55">Stratify Pro Pricing</p>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
                <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">Monthly</p>
                <p className="mt-1 text-lg font-semibold text-white">{PRO_MONTHLY_PRICE_LABEL}</p>
              </div>
              <div className="rounded-xl border border-emerald-300/20 bg-emerald-500/[0.06] px-3 py-2">
                <p className="text-[10px] uppercase tracking-[0.18em] text-emerald-200/70">Yearly</p>
                <p className="mt-1 text-lg font-semibold text-emerald-100">{PRO_YEARLY_PRICE_LABEL}</p>
                <p className="text-[11px] text-emerald-300/80">20% discount</p>
              </div>
            </div>
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
                  className={actionButtonClass}
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
                      className="rounded-lg border border-emerald-300/40 bg-emerald-500/18 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-400/26"
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
                  className={actionButtonClass}
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
