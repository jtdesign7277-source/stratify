import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const inputStyles =
  'w-full rounded-xl border border-[#1e1e2d] bg-[#0f0f16] px-3 py-2.5 text-sm text-white/90 placeholder:text-gray-500 focus:border-emerald-400/60 focus:outline-none focus:ring-1 focus:ring-emerald-500/20 transition-all';

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
    <div className="min-h-screen bg-[#07070a] text-white">
      <div className="relative min-h-screen overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.16),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,rgba(59,130,246,0.12),transparent_55%)]" />

        <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-6 py-12">
          <div className="w-full max-w-md space-y-6 rounded-3xl border border-[#1e1e2d] bg-[#0b0b12]/95 p-8 shadow-[0_0_40px_rgba(0,0,0,0.55)] backdrop-blur">
            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-[0.35em] text-emerald-400/80">Stratify Access</p>
              <h1 className="text-2xl font-semibold text-white">
                {isSignIn ? 'Sign in to your account' : 'Create your Stratify account'}
              </h1>
              <p className="text-sm text-gray-400">
                {isSignIn
                  ? 'Stay in sync with your strategies in real time.'
                  : 'Build, test, and deploy smarter strategies faster.'}
              </p>
            </div>

            <div className="flex items-center rounded-xl border border-[#1e1e2d] bg-[#0f0f16] p-1 text-xs">
              <button
                type="button"
                onClick={() => setMode('signin')}
                className={`flex-1 rounded-lg px-3 py-2 font-semibold transition ${
                  isSignIn ? 'bg-[#12121a] text-white shadow-inner' : 'text-gray-400 hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => setMode('signup')}
                className={`flex-1 rounded-lg px-3 py-2 font-semibold transition ${
                  !isSignIn ? 'bg-[#12121a] text-white shadow-inner' : 'text-gray-400 hover:text-white'
                }`}
              >
                Sign Up
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {!isSignIn && (
                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                      Full name
                    </label>
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
                    <label className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                      Referral (optional)
                    </label>
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
                <label className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                  Email
                </label>
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
                <label className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                  Password
                </label>
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
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 via-emerald-400 to-cyan-400 py-2.5 text-sm font-semibold text-[#0b0b12] transition-all duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading || isSubmitting ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#0b0b12]/60 border-t-transparent" />
                    Working...
                  </>
                ) : isSignIn ? (
                  'Sign In'
                ) : (
                  'Create Account'
                )}
              </button>
            </form>

            <div className="flex flex-col items-center gap-3 text-xs text-gray-400">
              <button
                type="button"
                onClick={onSkip}
                className="text-emerald-300 transition-colors hover:text-emerald-200"
              >
                Continue as guest
              </button>
              <p className="text-[11px] text-gray-500">
                By continuing, you agree to the Stratify terms and privacy policy.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
