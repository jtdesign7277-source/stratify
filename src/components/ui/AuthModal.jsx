import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Chrome, Lock, Mail, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const fieldStyles =
  'w-full px-3 py-2.5 bg-[#0f0f16] border border-[#1e1e2d] rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:border-emerald-400/60 focus:ring-1 focus:ring-emerald-500/20 transition-all';

export default function AuthModal({ isOpen, onClose, defaultMode = 'signin' }) {
  const { signIn, signUp, signInWithGoogle, loading } = useAuth();
  const [mode, setMode] = useState(defaultMode);
  const [formState, setFormState] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const primaryLabel = mode === 'signin' ? 'Sign In' : 'Create Account';

  const isPrimaryLoading = loading || isSubmitting;
  const isGoogleBusy = loading || isGoogleLoading;

  useEffect(() => {
    if (!isOpen) return;
    setMode(defaultMode);
    setFormState({ email: '', password: '' });
    setError('');
  }, [defaultMode, isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      if (mode === 'signin') {
        const { error: signInError } = await signIn({
          email: formState.email,
          password: formState.password,
        });
        if (signInError) {
          setError(signInError.message || 'Unable to sign in.');
          return;
        }
      } else {
        const { error: signUpError } = await signUp({
          email: formState.email,
          password: formState.password,
        });
        if (signUpError) {
          setError(signUpError.message || 'Unable to sign up.');
          return;
        }
      }

      onClose?.();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setIsGoogleLoading(true);

    try {
      if (typeof signInWithGoogle !== 'function') {
        setError('Google sign-in is not available yet.');
        return;
      }
      const { error: googleError } = await signInWithGoogle();
      if (googleError) {
        setError(googleError.message || 'Unable to sign in with Google.');
        return;
      }
      onClose?.();
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a0a0f] p-6 overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onMouseDown={onClose}
          role="dialog"
          aria-modal="true"
        >
          <motion.div
            className="relative w-full max-w-md rounded-2xl border border-[#1e1e2d] bg-[#0f0f16] shadow-[0_0_30px_rgba(16,185,129,0.15)] overflow-hidden"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.12),transparent_55%)]" />

            <div className="relative border-b border-[#1e1e2d] px-6 pb-5 pt-6">
              <p className="text-[11px] uppercase tracking-[0.3em] text-emerald-400/80">Stratify Access</p>
              <h2 className="mt-2 text-xl font-semibold text-white">
                {mode === 'signin' ? 'Sign in to your account' : 'Create your Stratify account'}
              </h2>
              <p className="mt-2 text-sm text-gray-400">
                {mode === 'signin'
                  ? 'Trade with clarity and confidence in seconds.'
                  : 'Start building smarter strategies today.'}
              </p>
              <button
                type="button"
                onClick={onClose}
                className="absolute right-4 top-4 rounded-lg border border-transparent p-2 text-gray-400 transition-colors hover:border-[#1e1e2d] hover:text-white"
                aria-label="Close auth modal"
              >
                <X className="h-4 w-4" strokeWidth={1.5} fill="none" />
              </button>
            </div>

            <div className="relative space-y-5 px-6 py-6">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isGoogleBusy}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#1e1e2d] bg-[#0f0f16] px-4 py-2.5 text-sm font-medium text-white transition-all duration-200 hover:border-emerald-400/60 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isGoogleBusy ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-400/80 border-t-transparent" />
                    Connecting...
                  </span>
                ) : (
                  <>
                    <Chrome className="h-4 w-4" strokeWidth={1.5} fill="none" />
                    Continue with Google
                  </>
                )}
              </button>

              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span className="h-px flex-1 bg-[#1e1e2d]" />
                or
                <span className="h-px flex-1 bg-[#1e1e2d]" />
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-400/80" strokeWidth={1.5} fill="none" />
                    <input
                      type="email"
                      name="email"
                      value={formState.email}
                      onChange={handleChange}
                      className={`${fieldStyles} pl-10`}
                      placeholder="you@stratify.com"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-400/80" strokeWidth={1.5} fill="none" />
                    <input
                      type="password"
                      name="password"
                      value={formState.password}
                      onChange={handleChange}
                      className={`${fieldStyles} pl-10`}
                      placeholder="••••••••"
                      required
                    />
                  </div>
                </div>

                {error && (
                  <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isPrimaryLoading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 via-emerald-400 to-cyan-400 py-2.5 text-[#0b0b12] font-semibold transition-all duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isPrimaryLoading ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#0b0b12]/60 border-t-transparent" />
                      Working...
                    </>
                  ) : (
                    primaryLabel
                  )}
                </button>
              </form>

              <div className="text-center text-xs text-gray-400">
                {mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}{' '}
                <button
                  type="button"
                  onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
                  className="font-semibold text-emerald-400 transition-colors hover:text-emerald-300"
                >
                  {mode === 'signin' ? 'Sign up' : 'Sign in'}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
