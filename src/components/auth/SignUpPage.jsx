import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Gift,
  LineChart,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  User,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

const SignUpPage = ({ onBack, onSuccess }) => {
  const [formState, setFormState] = useState({
    full_name: '',
    email: '',
    password: '',
    confirm_password: '',
    referral: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [toast, setToast] = useState(null);

  const iconProps = { strokeWidth: 1.5, fill: 'none' };
  const labelClass = 'text-[10px] uppercase tracking-widest text-gray-400 mb-1 block';
  const inputClass =
    'w-full pl-10 pr-3 py-2 bg-[#0f0f16] border border-[#1e1e2d] rounded-xl text-white/90 placeholder-gray-500 text-sm focus:outline-none focus:border-cyan-400/70 focus:ring-1 focus:ring-cyan-400/20 transition-all';

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3800);
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (formState.password !== formState.confirm_password) {
      const message = 'Passwords do not match.';
      setError(message);
      showToast('error', message);
      return;
    }

    setLoading(true);
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: formState.email,
        password: formState.password,
        options: {
          data: {
            full_name: formState.full_name,
            referral: formState.referral || null,
          },
        },
      });

      if (signUpError) {
        const message = signUpError.message || 'Unable to create account.';
        setError(message);
        showToast('error', message);
        return;
      }

      const user = data?.user;
      if (user?.id) {
        const { error: profileError } = await supabase.from('profiles').upsert(
          {
            id: user.id,
            email: formState.email,
            full_name: formState.full_name,
            referral: formState.referral || null,
            created_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );

        if (profileError) {
          const message = profileError.message || 'Profile setup failed.';
          setError(message);
          showToast('error', message);
          return;
        }
      }

      const successMessage = 'Account created. Check your email for confirmation.';
      setSuccess(successMessage);
      showToast('success', 'Welcome to Stratify.');
      setFormState((prev) => ({
        ...prev,
        password: '',
        confirm_password: '',
      }));
      if (onSuccess) {
        setTimeout(() => onSuccess(), 1200);
      }
    } catch (submitError) {
      const message = submitError?.message || 'Something went wrong.';
      setError(message);
      showToast('error', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative h-screen overflow-hidden bg-[#060d18] text-white">
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.2),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_18%,rgba(34,211,238,0.18),transparent_45%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_82%,rgba(124,58,237,0.16),transparent_55%)]" />
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.12) 1px, transparent 1px)',
            backgroundSize: '70px 70px',
          }}
        />
        <div className="absolute top-8 left-8 h-64 w-64 rounded-full bg-sky-500/20 blur-[120px]" />
        <div className="absolute bottom-8 right-8 h-72 w-72 rounded-full bg-indigo-500/20 blur-[140px]" />
        <div className="absolute right-[20%] top-[40%] h-52 w-52 rounded-full bg-cyan-400/15 blur-[120px]" />
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className={`fixed top-6 right-6 z-50 rounded-xl border px-4 py-3 text-sm shadow-[0_0_30px_rgba(0,0,0,0.35)] backdrop-blur-xl ${
              toast.type === 'success'
                ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200'
                : 'border-red-500/40 bg-red-500/15 text-red-200'
            }`}
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative z-10 flex h-screen items-center justify-center px-6 py-6">
        <div className="grid w-full max-w-6xl items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            className="flex flex-col justify-between gap-6"
          >
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1 text-[11px] uppercase tracking-[0.28em] text-sky-200">
                <Sparkles className="h-3.5 w-3.5" {...iconProps} />
                Premium Access
              </div>
              <h1 className="mt-5 text-3xl font-light leading-tight text-white md:text-4xl">
                Build with{' '}
                <span className="bg-gradient-to-r from-sky-300 via-cyan-200 to-indigo-300 bg-clip-text text-transparent">
                  signal
                </span>
                , trade with conviction.
              </h1>
              <p className="mt-3 max-w-xl text-sm text-white/60">
                Quant signals, macro shifts, and AI sentiment in one command center. Activate real-time intelligence
                in minutes.
              </p>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#0b0f18] via-[#06080f] to-[#04060b] p-4 shadow-[0_0_35px_rgba(0,0,0,0.45)] backdrop-blur">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.16),transparent_55%)]" />
              <div className="absolute -right-10 top-6 h-28 w-28 rounded-full bg-emerald-500/10 blur-[55px]" />
              <div className="absolute bottom-4 left-6 h-20 w-40 rounded-full bg-cyan-400/10 blur-[55px]" />
              <div className="relative">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.32em] text-cyan-300/70">Quant Pulse</p>
                    <div className="flex items-center gap-2">
                      <p className="text-lg font-semibold text-white">Signal Flow Snapshot</p>
                      <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[9px] uppercase tracking-[0.3em] text-emerald-200/90">
                        Live
                      </span>
                    </div>
                  </div>
                  <LineChart className="h-5 w-5 text-cyan-300" {...iconProps} />
                </div>
                <div className="mt-3">
                  <svg viewBox="0 0 520 240" className="h-28 w-full">
                    <defs>
                      <linearGradient id="chartLine" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="rgba(56,189,248,0.2)" />
                        <stop offset="50%" stopColor="rgba(34,211,238,0.65)" />
                        <stop offset="100%" stopColor="rgba(99,102,241,0.55)" />
                      </linearGradient>
                      <linearGradient id="chartLineAlt" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="rgba(16,185,129,0.2)" />
                        <stop offset="60%" stopColor="rgba(45,212,191,0.55)" />
                        <stop offset="100%" stopColor="rgba(59,130,246,0.35)" />
                      </linearGradient>
                      <linearGradient id="chartFill" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="rgba(56,189,248,0.22)" />
                        <stop offset="100%" stopColor="rgba(56,189,248,0)" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M20 170 L90 120 L150 138 L220 90 L280 110 L340 70 L400 92 L460 50 L500 72"
                      fill="none"
                      stroke="url(#chartLine)"
                      strokeWidth="2.2"
                    />
                    <path
                      d="M20 162 L90 135 L150 128 L220 102 L280 118 L340 86 L400 104 L460 78 L500 86"
                      fill="none"
                      stroke="url(#chartLineAlt)"
                      strokeWidth="1.4"
                      strokeDasharray="6 6"
                    />
                    <path
                      d="M20 170 L90 120 L150 138 L220 90 L280 110 L340 70 L400 92 L460 50 L500 72 L500 212 L20 212 Z"
                      fill="url(#chartFill)"
                    />
                    <g opacity="0.35">
                      <rect x="30" y="198" width="16" height="20" rx="2" fill="rgba(16,185,129,0.25)" />
                      <rect x="74" y="206" width="16" height="12" rx="2" fill="rgba(56,189,248,0.3)" />
                      <rect x="118" y="192" width="16" height="26" rx="2" fill="rgba(59,130,246,0.3)" />
                      <rect x="162" y="204" width="16" height="14" rx="2" fill="rgba(16,185,129,0.22)" />
                      <rect x="206" y="196" width="16" height="22" rx="2" fill="rgba(56,189,248,0.28)" />
                      <rect x="250" y="202" width="16" height="16" rx="2" fill="rgba(99,102,241,0.3)" />
                      <rect x="294" y="194" width="16" height="24" rx="2" fill="rgba(16,185,129,0.22)" />
                      <rect x="338" y="206" width="16" height="12" rx="2" fill="rgba(56,189,248,0.28)" />
                      <rect x="382" y="200" width="16" height="18" rx="2" fill="rgba(99,102,241,0.3)" />
                      <rect x="426" y="196" width="16" height="22" rx="2" fill="rgba(16,185,129,0.22)" />
                      <rect x="470" y="206" width="16" height="12" rx="2" fill="rgba(56,189,248,0.28)" />
                    </g>
                    <g stroke="rgba(148,163,184,0.55)" strokeWidth="1.4">
                      <line x1="70" y1="88" x2="70" y2="150" />
                      <rect x="66" y="110" width="8" height="20" rx="1.5" fill="none" />
                      <line x1="150" y1="102" x2="150" y2="160" />
                      <rect x="146" y="126" width="8" height="18" rx="1.5" fill="none" />
                      <line x1="230" y1="70" x2="230" y2="140" />
                      <rect x="226" y="96" width="8" height="22" rx="1.5" fill="none" />
                      <line x1="310" y1="92" x2="310" y2="170" />
                      <rect x="306" y="122" width="8" height="26" rx="1.5" fill="none" />
                      <line x1="390" y1="60" x2="390" y2="132" />
                      <rect x="386" y="84" width="8" height="22" rx="1.5" fill="none" />
                      <line x1="470" y1="82" x2="470" y2="154" />
                      <rect x="466" y="110" width="8" height="24" rx="1.5" fill="none" />
                    </g>
                    <g stroke="rgba(16,185,129,0.6)" strokeWidth="1.6">
                      <line x1="110" y1="112" x2="110" y2="176" />
                      <rect x="106" y="134" width="8" height="22" rx="1.5" fill="none" />
                      <line x1="270" y1="86" x2="270" y2="160" />
                      <rect x="266" y="112" width="8" height="24" rx="1.5" fill="none" />
                      <line x1="350" y1="74" x2="350" y2="138" />
                      <rect x="346" y="98" width="8" height="22" rx="1.5" fill="none" />
                      <line x1="430" y1="96" x2="430" y2="170" />
                      <rect x="426" y="124" width="8" height="24" rx="1.5" fill="none" />
                    </g>
                  </svg>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-[10px]">
                    <div className="rounded-lg border border-white/10 bg-white/5 px-2 py-1">
                      <p className="text-[9px] uppercase tracking-[0.24em] text-white/40">Net Flow</p>
                      <p className="mt-0.5 text-[11px] font-semibold text-emerald-200">$4.2M</p>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-white/5 px-2 py-1">
                      <p className="text-[9px] uppercase tracking-[0.24em] text-white/40">Win Rate</p>
                      <p className="mt-0.5 text-[11px] font-semibold text-cyan-200">67.4%</p>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-white/5 px-2 py-1">
                      <p className="text-[9px] uppercase tracking-[0.24em] text-white/40">Alpha</p>
                      <p className="mt-0.5 text-[11px] font-semibold text-indigo-200">+1.9 SD</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-3 text-sm text-white/70 sm:grid-cols-2">
              <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 text-sky-300" {...iconProps} />
                <div>
                  <p className="text-white">Institution-grade security</p>
                  <p className="text-xs text-white/50">Encrypted sessions and audit trails.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <LineChart className="mt-0.5 h-5 w-5 text-cyan-300" {...iconProps} />
                <div>
                  <p className="text-white">Quant backtests ready</p>
                  <p className="text-xs text-white/50">Live P&L analytics at launch.</p>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut', delay: 0.1 }}
            className="w-full"
          >
            <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-6 shadow-[0_0_45px_rgba(56,189,248,0.22)] backdrop-blur-xl">
              <button
                type="button"
                onClick={onBack}
                className="flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-white/60 transition-colors hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" {...iconProps} />
                Back to landing
              </button>

              <div className="mt-4">
                <p className="text-xs uppercase tracking-[0.3em] text-cyan-300/70">Create account</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">
                  Start your <span className="text-cyan-200">Stratify</span> journey
                </h2>
                <p className="mt-2 text-sm text-white/55">Secure your workspace and confirm via email.</p>
              </div>

              <form onSubmit={handleSubmit} className="mt-5 space-y-3">
                <div>
                  <label className={labelClass}>Full name</label>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" {...iconProps} />
                    <input
                      type="text"
                      name="full_name"
                      value={formState.full_name}
                      onChange={handleChange}
                      className={inputClass}
                      placeholder="Jeff Thompson"
                      autoComplete="name"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Email</label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" {...iconProps} />
                    <input
                      type="email"
                      name="email"
                      value={formState.email}
                      onChange={handleChange}
                      className={inputClass}
                      placeholder="you@stratify.com"
                      autoComplete="email"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Password</label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" {...iconProps} />
                    <input
                      type="password"
                      name="password"
                      value={formState.password}
                      onChange={handleChange}
                      className={inputClass}
                      placeholder="********"
                      autoComplete="new-password"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Confirm password</label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" {...iconProps} />
                    <input
                      type="password"
                      name="confirm_password"
                      value={formState.confirm_password}
                      onChange={handleChange}
                      className={inputClass}
                      placeholder="********"
                      autoComplete="new-password"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Referral code (optional)</label>
                  <div className="relative">
                    <Gift className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" {...iconProps} />
                    <input
                      type="text"
                      name="referral"
                      value={formState.referral}
                      onChange={handleChange}
                      className={inputClass}
                      placeholder="STRATIFY-ALPHA"
                      autoComplete="off"
                    />
                  </div>
                </div>

                {error && (
                  <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                    {error}
                  </div>
                )}

                {success && (
                  <div className="flex items-center gap-2 rounded-lg border border-cyan-400/40 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-200">
                    <CheckCircle2 className="h-4 w-4" {...iconProps} />
                    {success}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-400 via-cyan-300 to-indigo-400 px-4 py-2.5 text-sm font-semibold text-[#0b0b12] shadow-[0_0_25px_rgba(56,189,248,0.35)] transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" {...iconProps} />
                      Creating account...
                    </>
                  ) : (
                    <>
                      Create account
                      <ArrowRight className="h-4 w-4" {...iconProps} />
                    </>
                  )}
                </button>

                <div className="text-center text-xs text-white/50">
                  Already have an account?{' '}
                  <button
                    type="button"
                    className="text-cyan-300 transition-colors hover:text-cyan-200"
                    onClick={() => showToast('error', 'Sign-in flow coming soon.')}
                  >
                    Sign in
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default SignUpPage;
