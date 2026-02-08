import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';

export default function AuthModal({ isOpen, onClose, defaultMode = 'signin' }) {
  const { signIn, signUp, loading } = useAuth();
  const [mode, setMode] = useState(defaultMode);
  const [formState, setFormState] = useState({
    email: '',
    password: '',
    first_name: '',
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setMode(defaultMode);
      setError('');
      setFormState({ email: '', password: '', first_name: '' });
    }
  }, [defaultMode, isOpen]);

  if (!isOpen) return null;

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (mode === 'signin') {
      const { error: signInError } = await signIn({
        email: formState.email,
        password: formState.password,
      });
      if (signInError) {
        setError(signInError.message || 'Unable to sign in.');
        return;
      }
      onClose?.();
      return;
    }

    const { error: signUpError } = await signUp({
      email: formState.email,
      password: formState.password,
      first_name: formState.first_name,
    });

    if (signUpError) {
      setError(signUpError.message || 'Unable to sign up.');
      return;
    }

    onClose?.();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-[#2a2a3d] bg-[#0b0b0b] shadow-[0_0_45px_rgba(0,0,0,0.65)]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a3d]">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-400/80">Stratify Access</p>
            <h2 className="text-lg font-semibold text-white">
              {mode === 'signin' ? 'Sign in to your account' : 'Create your Stratify account'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/5 transition-colors"
            aria-label="Close auth modal"
          >
            <svg className="w-4 h-4 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 6l12 12M18 6l-12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-6 space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-gray-400 mb-2">First name</label>
              <input
                type="text"
                name="first_name"
                value={formState.first_name}
                onChange={handleChange}
                className="w-full px-3 py-2.5 bg-[#0f0f16] border border-[#1e1e2d] rounded-xl text-white/90 placeholder-gray-500 text-sm focus:outline-none focus:border-emerald-400/60 focus:ring-1 focus:ring-emerald-500/20 transition-all"
                placeholder="Jeff"
                required
              />
            </div>
          )}
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-gray-400 mb-2">Email</label>
            <input
              type="email"
              name="email"
              value={formState.email}
              onChange={handleChange}
              className="w-full px-3 py-2.5 bg-[#0f0f16] border border-[#1e1e2d] rounded-xl text-white/90 placeholder-gray-500 text-sm focus:outline-none focus:border-emerald-400/60 focus:ring-1 focus:ring-emerald-500/20 transition-all"
              placeholder="you@stratify.com"
              required
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-gray-400 mb-2">Password</label>
            <input
              type="password"
              name="password"
              value={formState.password}
              onChange={handleChange}
              className="w-full px-3 py-2.5 bg-[#0f0f16] border border-[#1e1e2d] rounded-xl text-white/90 placeholder-gray-500 text-sm focus:outline-none focus:border-emerald-400/60 focus:ring-1 focus:ring-emerald-500/20 transition-all"
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-gradient-to-r from-emerald-500 via-emerald-400 to-cyan-400 text-[#0b0b12] font-semibold shadow-[0_0_20px_rgba(16,185,129,0.25)] hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {mode === 'signin' ? 'Sign In' : 'Create Account'}
          </button>

          <div className="text-center text-xs text-gray-400">
            {mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}{' '}
            <button
              type="button"
              onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
              className="text-emerald-300 hover:text-emerald-200 transition-colors"
            >
              {mode === 'signin' ? 'Sign up' : 'Sign in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
