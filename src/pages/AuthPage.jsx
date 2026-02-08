import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

const AuthPage = () => {
  const { user, authLoading, signIn, signUp } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);

  useEffect(() => {
    if (user) {
      window.location.replace('/');
    }
  }, [user]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const showToast = (type, message) => {
    setToast({ type, message });
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => setToast(null), 4200);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmedEmail = email.trim();

    if (!trimmedEmail || !password) {
      showToast('error', 'Enter your email and password to continue.');
      return;
    }

    if (isSignUp) {
      const { data, error } = await signUp(trimmedEmail, password);
      if (error) {
        showToast('error', error.message);
        return;
      }
      if (!data?.session) {
        showToast('success', 'Check your email to confirm your account.');
        return;
      }
      showToast('success', 'Account created. Welcome to Stratify.');
      window.location.replace('/');
    } else {
      const { error } = await signIn(trimmedEmail, password);
      if (error) {
        showToast('error', error.message);
        return;
      }
      showToast('success', 'Welcome back. Loading your workspace.');
      window.location.replace('/');
    }
  };

  const handleForgotPassword = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      showToast('error', 'Enter your email to reset your password.');
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
      redirectTo: `${window.location.origin}/auth`,
    });

    if (error) {
      showToast('error', error.message);
      return;
    }

    showToast('success', 'Password reset email sent. Check your inbox.');
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.16),transparent_55%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(59,130,246,0.12),transparent_45%)]" />
      <div className="absolute -top-32 left-1/2 h-96 w-[700px] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl" />

      <div className="relative z-10 min-h-screen flex items-center justify-center px-6 py-14">
        <div className="w-full max-w-6xl grid gap-10 lg:grid-cols-[1.05fr_0.95fr] items-center">
          <div className="hidden lg:block">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold text-emerald-200 tracking-[0.2em] uppercase">
              <Sparkles className="h-3.5 w-3.5" strokeWidth={1.5} />
              Premium Access
            </div>
            <h1 className="mt-6 text-4xl xl:text-5xl font-semibold leading-tight">
              Command the market with
              <span className="block bg-gradient-to-r from-emerald-400 via-emerald-300 to-cyan-300 bg-clip-text text-transparent">
                Stratify Intelligence
              </span>
            </h1>
            <p className="mt-4 text-lg text-gray-300 max-w-xl">
              Secure access to live strategies, real-time portfolio tracking, and Grok-grade signal execution — built for traders
              who demand precision.
            </p>
            <div className="mt-8 space-y-4">
              {[
                'Institutional-grade security with Supabase auth.',
                'Emerald-powered dashboards with real-time insight.',
                'Seamless session syncing across every Stratify panel.',
              ].map((item) => (
                <div key={item} className="flex items-start gap-3 text-gray-300">
                  <div className="mt-1 h-7 w-7 rounded-lg bg-emerald-500/15 flex items-center justify-center border border-emerald-500/30">
                    <ShieldCheck className="h-4 w-4 text-emerald-300" strokeWidth={1.5} />
                  </div>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-[#1e1e2d] bg-[#0f0f16]/90 p-8 shadow-[0_0_40px_rgba(16,185,129,0.2)] backdrop-blur">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.3em] text-gray-500">Stratify Access</div>
                <h2 className="mt-2 text-2xl font-semibold">
                  {isSignUp ? 'Create your account' : 'Sign in to Stratify'}
                </h2>
              </div>
              <div className="h-12 w-12 rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex items-center justify-center">
                <ShieldCheck className="h-6 w-6 text-emerald-300" strokeWidth={1.5} />
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 rounded-xl border border-[#1e1e2d] bg-[#111118] p-1">
              {[
                { label: 'Login', value: false },
                { label: 'Sign Up', value: true },
              ].map((option) => (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => setIsSignUp(option.value)}
                  className={`rounded-lg py-2 text-sm font-semibold transition-all duration-200 ${
                    isSignUp === option.value
                      ? 'bg-gradient-to-r from-emerald-500 via-emerald-400 to-cyan-400 text-[#0b0b12] shadow-[0_0_20px_rgba(16,185,129,0.25)]'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label className="text-gray-400 text-[10px] font-semibold mb-2 block tracking-widest uppercase">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" strokeWidth={1.5} />
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@stratify.ai"
                    className="w-full px-3 py-2.5 pl-10 bg-[#0f0f16] border border-[#1e1e2d] rounded-xl text-white/90 placeholder-gray-500 text-sm focus:outline-none focus:border-emerald-400/60 focus:ring-1 focus:ring-emerald-500/20 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="text-gray-400 text-[10px] font-semibold mb-2 block tracking-widest uppercase">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" strokeWidth={1.5} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="********"
                    className="w-full px-3 py-2.5 pl-10 pr-10 bg-[#0f0f16] border border-[#1e1e2d] rounded-xl text-white/90 placeholder-gray-500 text-sm focus:outline-none focus:border-emerald-400/60 focus:ring-1 focus:ring-emerald-500/20 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" strokeWidth={1.5} />
                    ) : (
                      <Eye className="h-4 w-4" strokeWidth={1.5} />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  {isSignUp ? 'Secure onboarding takes under 60 seconds.' : 'Secure login with enterprise encryption.'}
                </span>
                {!isSignUp && (
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-xs text-emerald-300 hover:text-emerald-200 transition-colors"
                  >
                    Forgot password?
                  </button>
                )}
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="w-full py-2.5 px-4 rounded-lg bg-gradient-to-r from-emerald-500 via-emerald-400 to-cyan-400 text-[#0b0b12] font-semibold shadow-[0_0_20px_rgba(16,185,129,0.25)] hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              >
                <span className="flex items-center justify-center gap-2">
                  {authLoading ? 'Securing access...' : isSignUp ? 'Create Account' : 'Continue'}
                  <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
                </span>
              </button>

              <div className="rounded-xl border border-[#1e1e2d] bg-[#111118] p-4 text-xs text-gray-400">
                <div className="flex items-center gap-2 text-gray-300">
                  <ShieldCheck className="h-4 w-4 text-emerald-300" strokeWidth={1.5} />
                  Stratify sessions auto-sync across devices.
                </div>
                <p className="mt-2 text-gray-500">
                  By continuing, you agree to Stratify security policies and data processing standards.
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>

      {toast && (
        <div className="fixed top-6 right-6 z-50">
          <div
            className={`flex items-start gap-3 rounded-xl border px-4 py-3 shadow-[0_0_25px_rgba(16,185,129,0.2)] backdrop-blur bg-[#0f0f16] ${
              toast.type === 'success'
                ? 'border-emerald-500/40'
                : 'border-red-500/40'
            }`}
          >
            <div
              className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg ${
                toast.type === 'success' ? 'bg-emerald-500/15' : 'bg-red-500/15'
              }`}
            >
              {toast.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-300" strokeWidth={1.5} />
              ) : (
                <AlertTriangle className="h-4 w-4 text-red-300" strokeWidth={1.5} />
              )}
            </div>
            <div className="text-sm text-gray-200 max-w-[260px]">{toast.message}</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuthPage;
