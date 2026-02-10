import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const inputStyles =
  'w-full rounded-xl border border-[#1e1e2d] bg-[#0f0f16] px-3 py-2.5 text-sm text-white/90 placeholder:text-gray-500 focus:border-cyan-400/70 focus:outline-none focus:ring-1 focus:ring-cyan-400/20 transition-all';

export default function AuthPage({ onSkip }) {
  const { signIn, signUp, loading } = useAuth();
  const [mode, setMode] = useState('signin');
  const [formState, setFormState] = useState({
    email: '',
    password: '',
    full_name: '',
    referral: '',
  });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isSignIn = mode === 'signin';
  const iconProps = { strokeWidth: 1.5, fill: 'none' };
  const labelClass = 'mb-2 block text-[10px] font-semibold uppercase tracking-widest text-gray-400';

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    const payload = {
      email: formState.email,
      password: formState.password,
    };

    try {
      if (isSignIn) {
        const { error: signInError } = await signIn(payload);
        if (signInError) {
          setError(signInError.message || 'Unable to sign in.');
        }
        return;
      }

      const { error: signUpError } = await signUp({
        ...payload,
        full_name: formState.full_name,
        referral: formState.referral,
      });

      if (signUpError) {
        setError(signUpError.message || 'Unable to create your account.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative h-screen overflow-hidden bg-[#060d18] text-white">
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.22),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,rgba(124,58,237,0.18),transparent_65%)]" />
      </div>

      <div className="relative z-10 flex h-screen items-center justify-center px-6 py-6">
        <div className="w-full max-w-md space-y-5 rounded-3xl border border-white/10 bg-gradient-to-br from-[#0b0f18] via-[#070a12] to-[#05070d] p-7 shadow-[0_0_40px_rgba(0,0,0,0.55)] backdrop-blur">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1 text-[10px] uppercase tracking-[0.32em] text-sky-200">
              <Sparkles className="h-3.5 w-3.5" {...iconProps} />
              Stratify Access
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold text-white">
                {isSignIn ? 'Sign in to your account' : 'Create your Stratify account'}
              </h1>
              <p className="text-sm text-white/60">
                {isSignIn
                  ? 'Stay in sync with your strategies in real time.'
                  : 'Build, test, and deploy smarter strategies faster.'}
              </p>
            </div>

          </div>

          <div className="flex items-center rounded-2xl border border-white/10 bg-white/5 p-1 text-xs">
            <button
              type="button"
              onClick={() => setMode('signin')}
              className={`flex-1 rounded-xl px-3 py-2 font-semibold transition ${
                isSignIn
                  ? 'bg-gradient-to-r from-sky-500/20 via-cyan-400/20 to-indigo-500/20 text-white shadow-[0_0_25px_rgba(56,189,248,0.2)]'
                  : 'text-white/50 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setMode('signup')}
              className={`flex-1 rounded-xl px-3 py-2 font-semibold transition ${
                !isSignIn
                  ? 'bg-gradient-to-r from-sky-500/20 via-cyan-400/20 to-indigo-500/20 text-white shadow-[0_0_25px_rgba(99,102,241,0.2)]'
                  : 'text-white/50 hover:text-white'
              }`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isSignIn && (
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>Full name</label>
                  <input
                    type="text"
                    name="full_name"
                    value={formState.full_name}
                    onChange={handleChange}
                    className={inputStyles}
                    placeholder="Jeff Thompson"
                    required
                  />
                </div>
                <div>
                  <label className={labelClass}>Referral (optional)</label>
                  <input
                    type="text"
                    name="referral"
                    value={formState.referral}
                    onChange={handleChange}
                    className={inputStyles}
                    placeholder="Who sent you?"
                  />
                </div>
              </div>
            )}

            <div>
              <label className={labelClass}>Email</label>
              <input
                type="email"
                name="email"
                value={formState.email}
                onChange={handleChange}
                className={inputStyles}
                placeholder="you@stratify.com"
                required
              />
            </div>

            <div>
              <label className={labelClass}>Password</label>
              <input
                type="password"
                name="password"
                value={formState.password}
                onChange={handleChange}
                className={inputStyles}
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || isSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-400 via-cyan-300 to-indigo-400 py-2.5 text-sm font-semibold text-[#05070d] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_0_25px_rgba(56,189,248,0.35)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading || isSubmitting ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#05070d]/60 border-t-transparent" />
                  Working...
                </>
              ) : isSignIn ? (
                'Sign In'
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          <div className="flex flex-col items-center gap-3 text-xs text-white/60">
            <button
              type="button"
              onClick={onSkip}
              className="text-cyan-200 transition-colors hover:text-cyan-100"
            >
              Continue as guest
            </button>
            <p className="text-[11px] text-white/45">By continuing, you agree to the Stratify terms and privacy policy.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
