import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, ChevronRight } from 'lucide-react';
import supabase from '../../lib/supabaseClient';

const FEATURE_ITEMS = [
  {
    title: 'API Aggregation',
    description:
      'One key unlocks broker execution, live feeds, AI context, and research modules without a fragmented stack.',
  },
  {
    title: 'Sophia AI Strategies',
    description:
      'Describe the setup in plain language and Sophia returns structured strategy logic you can test and deploy.',
  },
  {
    title: 'Real-Time Streaming',
    description:
      'Live market streams drive your watchlists, chart panels, and alerts in one synchronized flow.',
  },
  {
    title: 'Mission Control',
    description:
      'Unified workspace for positions, P&L, execution context, and operating metrics in a single command layer.',
  },
  {
    title: 'X-Ray Fundamentals',
    description:
      'Fundamentals, estimates, ratios, and profile intelligence alongside your live symbols and strategies.',
  },
  {
    title: 'Paper Trading',
    description:
      'Validate before capital deployment with realistic market conditions and full strategy telemetry.',
  },
];

const COMPARISON_ROWS = [
  ['Real-time market data', '$100+/mo', 'Included'],
  ['Professional charting', '$15-60/mo', 'Included'],
  ['AI strategy generation', '$20+/mo', 'Sophia built-in'],
  ['Fundamentals research', '$50+/mo', 'X-Ray included'],
  ['Paper trading', 'Separate broker setup', 'One-click toggle'],
];

const HOW_STEPS = [
  {
    title: 'Connect Once',
    description:
      'One Stratify account centralizes your workflow instead of managing multiple disconnected services.',
  },
  {
    title: 'Build With Sophia',
    description:
      'Convert idea to structured strategy logic with AI-assisted setup, filtering, and risk framing.',
  },
  {
    title: 'Test In Paper Mode',
    description:
      'Run strategy behavior against live conditions first, then tune entries, exits, and risk sizing.',
  },
  {
    title: 'Deploy And Monitor',
    description:
      'Go live and track performance from Mission Control with real-time visibility across the stack.',
  },
];

const TICKER_ITEMS = [
  'TSLA 398.91 +1.42%',
  'QQQ 601.44 +0.83%',
  'NVDA 893.20 +2.11%',
  'AAPL 198.30 -0.48%',
  'BTC 104,238 +1.90%',
  'SPY 598.67 +0.56%',
  'AMD 188.12 +1.77%',
  'META 536.80 +0.39%',
];

const INTEGRATIONS = ['Alpaca', 'Anthropic Claude', 'Twelve Data', 'TradingView', 'Vercel', 'Supabase'];

const sectionMotion = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.22 },
  transition: { duration: 0.55, ease: 'easeOut' },
};

const landingStyles = `
  @keyframes landing-float-a {
    0%, 100% { transform: translate(0, 0) scale(1); }
    50% { transform: translate(30px, 24px) scale(1.04); }
  }

  @keyframes landing-float-b {
    0%, 100% { transform: translate(0, 0) scale(1); }
    50% { transform: translate(-26px, -20px) scale(1.03); }
  }

  @keyframes landing-ticker-scroll {
    0% { transform: translateX(0); }
    100% { transform: translateX(-50%); }
  }

  @keyframes landing-twinkle {
    0%, 100% { opacity: 0.22; }
    50% { opacity: 0.66; }
  }

  @keyframes landing-shooting-star {
    0% {
      opacity: 0;
      transform: translate3d(0, 0, 0) rotate(-24deg) scale(0.8);
    }
    10% {
      opacity: 1;
    }
    70% {
      opacity: 1;
    }
    100% {
      opacity: 0;
      transform: translate3d(360px, 180px, 0) rotate(-24deg) scale(1.08);
    }
  }

  .landing-ticker-track {
    animation: landing-ticker-scroll 32s linear infinite;
    width: max-content;
  }

  .landing-particle {
    animation: landing-twinkle ease-in-out infinite;
  }

  .landing-shooting-star {
    animation-name: landing-shooting-star;
    animation-timing-function: linear;
    animation-iteration-count: infinite;
  }
`;

const LandingPage = ({ onEnter, onSignUp, onDashboard, canAccessDashboard = false }) => {
  const canvasRef = useRef(null);
  const timersRef = useRef([]);
  const [heroEmail, setHeroEmail] = useState('');
  const [bottomEmail, setBottomEmail] = useState('');
  const [loadingForm, setLoadingForm] = useState('');
  const [feedback, setFeedback] = useState({
    hero: { type: '', message: '' },
    bottom: { type: '', message: '' },
  });

  useEffect(() => {
    const html = document.documentElement;
    const previous = html.style.scrollBehavior;
    html.style.scrollBehavior = 'smooth';
    return () => {
      html.style.scrollBehavior = previous;
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    let frame = null;
    let stars = [];

    const initializeStars = () => {
      const count = Math.max(120, Math.floor((window.innerWidth * window.innerHeight) / 5200));
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        r: Math.random() * 1.2 + 0.2,
        speed: Math.random() * 0.003 + 0.0006,
        phase: Math.random() * Math.PI * 2,
      }));
    };

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      initializeStars();
    };

    const draw = (time) => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      for (const star of stars) {
        const alpha = 0.16 + 0.56 * (0.5 + 0.5 * Math.sin(time * star.speed + star.phase));
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.fill();
      }
      frame = window.requestAnimationFrame(draw);
    };

    resize();
    frame = window.requestAnimationFrame(draw);
    window.addEventListener('resize', resize);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
    };
  }, []);

  useEffect(() => {
    return () => {
      timersRef.current.forEach((id) => window.clearTimeout(id));
      timersRef.current = [];
    };
  }, []);

  const queueTimeout = (callback, delayMs) => {
    const id = window.setTimeout(callback, delayMs);
    timersRef.current.push(id);
  };

  const setFormFeedback = (formKey, type, message) => {
    setFeedback((prev) => ({
      ...prev,
      [formKey]: { type, message },
    }));

    if (message) {
      queueTimeout(() => {
        setFeedback((prev) => ({
          ...prev,
          [formKey]: { type: '', message: '' },
        }));
      }, 4200);
    }
  };

  const handleNewsletterSubmit = (formKey) => async (event) => {
    event.preventDefault();

    const email = (formKey === 'hero' ? heroEmail : bottomEmail).trim();
    if (!email || !email.includes('@')) {
      setFormFeedback(formKey, 'error', 'Enter a valid email address.');
      return;
    }

    setLoadingForm(formKey);
    setFormFeedback(formKey, '', '');

    try {
      const { error } = await supabase
        .from('newsletter_subscribers')
        .upsert({ email, source: formKey === 'hero' ? 'landing_page_hero' : 'landing_page_footer' }, { onConflict: 'email' });

      if (error) throw error;

      if (formKey === 'hero') setHeroEmail('');
      if (formKey === 'bottom') setBottomEmail('');
      setFormFeedback(formKey, 'success', 'Subscribed. You will get launch and newsletter updates.');
    } catch (err) {
      const isDuplicate = String(err?.message || '').toLowerCase().includes('duplicate');
      setFormFeedback(formKey, 'error', isDuplicate ? 'Already subscribed.' : 'Unable to subscribe right now.');
    } finally {
      setLoadingForm('');
    }
  };

  const handlePrimaryAction = () => {
    if (onSignUp) {
      onSignUp();
      return;
    }

    onEnter?.();
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#04060d] text-white">
      <style>{landingStyles}</style>

      <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-0" />

      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div
          className="absolute -left-24 -top-32 h-[760px] w-[760px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(56,189,248,0.08) 0%, transparent 66%)',
            filter: 'blur(70px)',
            animation: 'landing-float-a 20s ease-in-out infinite',
          }}
        />
        <div
          className="absolute -bottom-40 -right-20 h-[640px] w-[640px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 68%)',
            filter: 'blur(70px)',
            animation: 'landing-float-b 24s ease-in-out infinite',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.012) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.012) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
            maskImage: 'radial-gradient(ellipse 64% 42% at 50% 28%, black 16%, transparent 76%)',
          }}
        />
        <span
          className="landing-shooting-star absolute left-[9%] top-[18%] block h-[1.5px] w-24 bg-gradient-to-r from-white/0 via-white/90 to-cyan-200/0"
          style={{ animationDuration: '5.6s', animationDelay: '0.8s' }}
        />
        <span
          className="landing-shooting-star absolute left-[56%] top-[14%] block h-[1.5px] w-28 bg-gradient-to-r from-white/0 via-white/90 to-emerald-200/0"
          style={{ animationDuration: '6.8s', animationDelay: '2.1s' }}
        />
        <span
          className="landing-shooting-star absolute left-[22%] top-[30%] block h-[1.5px] w-20 bg-gradient-to-r from-white/0 via-white/85 to-cyan-100/0"
          style={{ animationDuration: '7.2s', animationDelay: '3.4s' }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,6,10,0.08)_0%,rgba(3,6,10,0.58)_55%,rgba(3,6,10,0.88)_100%)]" />
      </div>

      <div className="relative z-10">
        <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 pt-7">
          <div className="text-sm font-semibold uppercase tracking-[0.28em] text-white/90">Stratify</div>
          <div className="flex items-center gap-3">
            <span className="hidden text-[11px] uppercase tracking-[0.16em] text-white/65 md:inline-flex">
              Building in public
            </span>
            {canAccessDashboard ? (
              <button
                type="button"
                onClick={onDashboard || onEnter}
                className="rounded-full border border-cyan-300/28 bg-cyan-400/8 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-100 transition-colors hover:bg-cyan-400/16"
              >
                Dashboard
              </button>
            ) : (
              <button
                type="button"
                onClick={handlePrimaryAction}
                className="rounded-full border border-emerald-300/30 bg-emerald-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-100 transition-colors hover:bg-emerald-400/18"
              >
                Sign Up
              </button>
            )}
          </div>
        </nav>

        <main>
          <motion.section {...sectionMotion} className="px-6 pb-20 pt-20 md:pt-24">
            <div className="mx-auto max-w-5xl text-center">
              <span className="inline-flex rounded-full border border-cyan-300/24 bg-cyan-400/8 px-4 py-1.5 text-[11px] uppercase tracking-[0.24em] text-cyan-100/80">
                Early Access - Coming Soon
              </span>

              <h1 className="mt-8 text-balance text-5xl font-semibold leading-tight text-white md:text-7xl">
                A Smarter Way to <span className="bg-gradient-to-r from-cyan-300 via-blue-300 to-emerald-300 bg-clip-text text-transparent">Trade</span>
              </h1>

              <p className="mx-auto mt-7 max-w-3xl text-base leading-relaxed text-slate-300 md:text-lg">
                Stratify unifies trading APIs, real-time market data, and AI-powered strategy generation into one
                command center. Stop juggling five platforms. Start trading smarter.
              </p>

              <div className="mx-auto mt-9 max-w-2xl">
                <form
                  onSubmit={handleNewsletterSubmit('hero')}
                  className="flex flex-col gap-2 rounded-2xl border border-white/12 bg-[#070d18]/82 p-2 backdrop-blur sm:flex-row"
                >
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={heroEmail}
                    onChange={(event) => setHeroEmail(event.target.value)}
                    placeholder="Your email address"
                    className="h-12 flex-1 rounded-xl border border-transparent bg-transparent px-4 text-base text-white placeholder:text-slate-400 focus:border-cyan-300/28 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={loadingForm === 'hero'}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {loadingForm === 'hero' ? 'Joining...' : 'Join Newsletter'}
                    <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
                  </button>
                </form>

                <div className="mt-3 flex items-center justify-center gap-4">
                  <a
                    href="/whitepaper"
                    className="text-sm text-cyan-200/80 underline decoration-cyan-300/30 underline-offset-4 transition-colors hover:text-cyan-100"
                  >
                    Read White Paper
                  </a>
                </div>

                {feedback.hero.message ? (
                  <p className={`mt-3 text-sm ${feedback.hero.type === 'error' ? 'text-rose-300' : 'text-emerald-300'}`}>
                    {feedback.hero.message}
                  </p>
                ) : null}
              </div>

              <div className="mt-7 flex items-center justify-center gap-2">
                <a
                  href="https://discord.gg/6RPsREggYV"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-slate-300 transition-colors hover:text-[#5865F2]"
                >
                  <svg width="20" height="16" viewBox="0 0 71 55" fill="currentColor" className="shrink-0">
                    <path d="M60.1 4.9C55.6 2.8 50.7 1.3 45.7.4c-.1 0-.2 0-.2.1-.6 1.1-1.3 2.6-1.8 3.7-5.5-.8-10.9-.8-16.3 0-.5-1.2-1.2-2.6-1.8-3.7 0-.1-.1-.1-.2-.1C20.3 1.3 15.4 2.8 10.9 4.9c0 0-.1 0-.1.1C1.6 18.7-.9 32.1.3 45.4v.2c6.1 4.5 12 7.2 17.7 9 .1 0 .2 0 .2-.1 1.4-1.9 2.6-3.8 3.6-5.9.1-.1 0-.3-.1-.3-2-.7-3.8-1.6-5.6-2.7-.1-.1-.1-.3 0-.4.4-.3.7-.6 1.1-.9.1-.1.1-.1.2-.1 11.6 5.3 24.2 5.3 35.7 0h.2c.4.3.7.6 1.1.9.1.1.1.3 0 .4-1.8 1-3.6 2-5.6 2.7-.1.1-.2.2-.1.3 1.1 2.1 2.3 4.1 3.6 5.9.1.1.2.1.2.1 5.8-1.8 11.6-4.5 17.7-9 0 0 .1-.1.1-.2 1.5-15.6-2.5-29.1-10.7-41.1 0 0 0 0-.1-.1z" />
                  </svg>
                  Join the Stratify community on Discord
                </a>
              </div>

              <div className="mx-auto mt-10 grid max-w-lg grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/12 bg-white/5 p-4">
                  <p className="text-3xl font-semibold text-cyan-200">1</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.16em] text-white/60">Unified Key</p>
                </div>
                <div className="rounded-2xl border border-white/12 bg-white/5 p-4">
                  <p className="text-3xl font-semibold text-emerald-200">15+</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.16em] text-white/60">Connected Services</p>
                </div>
              </div>

              <div className="mt-10">
                <p className="text-xs uppercase tracking-[0.24em] text-white/55">Available In</p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-sm text-slate-200">
                  <span>🇺🇸 United States</span>
                  <span className="text-cyan-300/70">•</span>
                  <span>🇬🇧 London</span>
                  <span className="text-cyan-300/70">•</span>
                  <span>🇦🇺 Australia</span>
                  <span className="text-cyan-300/70">•</span>
                  <span>₿ Crypto</span>
                </div>
              </div>

              <div className="mt-16">
                <p className="text-xs uppercase tracking-[0.26em] text-white/50">Powered By</p>
                <div className="mt-7 flex flex-wrap items-center justify-center gap-12">
                  <a href="https://stripe.com" target="_blank" rel="noopener noreferrer" className="opacity-70 transition-opacity duration-300 hover:opacity-100">
                    <svg xmlns="http://www.w3.org/2000/svg" width="120" height="50" fill="none" viewBox="0 0 60 25"><path fill="white" fillRule="evenodd" d="M59.6444 14.2813h-8.062c.1843 1.9296 1.5983 2.5476 3.2032 2.5476 1.6352 0 2.9534-.3656 4.0453-.9506v3.3179c-1.1186.7115-2.5964 1.1068-4.5645 1.1068-4.011 0-6.8218-2.5122-6.8218-7.4783 0-4.19441 2.3837-7.52509 6.3017-7.52509 3.912 0 5.9537 3.28038 5.9537 7.49819 0 .3982-.0372 1.261-.0556 1.4835Zm-5.9241-5.62407c-1.0294 0-2.1739.72812-2.1739 2.58387h4.2573c0-1.85362-1.0721-2.58387-2.0834-2.58387ZM40.9547 20.303c-1.4411 0-2.322-.6087-2.9133-1.0417l-.0088 4.6271-4.1181.8755-.0014-19.19053h3.7543l.0864 1.01784c.6035-.52914 1.6114-1.29157 3.2256-1.29162 2.8925 0 5.6162 2.6052 5.6162 7.39971 0 5.2327-2.6948 7.6037-5.6409 7.6037Zm-.959-11.35573c-.9453 0-1.5376.34559-1.9669.81586l.0245 6.11967c.3997.433.9763.7813 1.9424.7813 1.5231 0 2.5437-1.6575 2.5437-3.8745 0-2.1544-1.037-3.84233-2.5437-3.84233Zm-11.7602-3.3739h4.1341V20.0088h-4.1341V5.57337Zm0-4.694699L32.3696 0v3.35821l-4.1341.87868V.878671ZM23.9198 10.2223v9.7861h-4.1156V5.57296h3.6867l.1317 1.21751c1.0035-1.7722 3.0722-1.41321 3.6209-1.21594v3.78524c-.5242-.16908-2.2894-.42779-3.3237.86253Zm-8.5525 4.7221c0 2.4275 2.5988 1.6719 3.1263 1.4609v3.3522c-.5492.3013-1.5437.5458-2.8901.5458-2.4441 0-4.2773-1.7999-4.2773-4.2379l.0173-13.17658 4.0206-.85464.0032 3.5395h3.1278V9.0857h-3.1278v5.8588-.0001Zm-4.9069.7026c0 2.9645-2.31051 4.6562-5.73464 4.6562-1.41958 0-2.92289-.2761-4.453935-.9347v-3.9319c1.382085.7516 3.093705 1.315 4.457755 1.315.91864 0 1.53106-.2459 1.53106-1.0069C6.26064 13.7786 0 14.5192 0 9.95995 0 7.04457 2.27622 5.2998 5.61655 5.2998c1.36404 0 2.72806.20934 4.09208.75351V9.9317c-1.25265-.67618-2.84332-1.05979-4.09588-1.05979-.86296 0-1.44753.24965-1.44753.8924.0001 1.85329 6.29518.97249 6.29518 5.88279v-.0001Z" clipRule="evenodd"/></svg>
                  </a>
                  <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" className="opacity-70 transition-opacity duration-300 hover:opacity-100">
                    <img src="/logos/supabase-dark.png" alt="Supabase" className="h-[26px] w-auto" />
                  </a>
                  <a href="https://anthropic.com/claude" target="_blank" rel="noopener noreferrer" className="opacity-70 transition-opacity duration-300 hover:opacity-100">
                    <img src="/logos/claude.png" alt="Claude" className="h-[28px] w-auto object-contain" />
                  </a>
                  <a href="https://vercel.com" target="_blank" rel="noopener noreferrer" className="opacity-70 transition-opacity duration-300 hover:opacity-100">
                    <div className="flex items-center gap-2">
                      <svg height="20" viewBox="0 0 74 64" fill="white"><path d="M37.5896 0.25L74.5396 64.25H0.639648L37.5896 0.25Z"/></svg>
                      <span className="text-[22px] font-semibold text-white tracking-tight" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>Vercel</span>
                    </div>
                  </a>
                </div>
              </div>
            </div>
          </motion.section>

          <div className="border-y border-white/10 bg-white/5 py-3">
            <div className="landing-ticker-track flex items-center gap-3 px-4 text-xs uppercase tracking-[0.12em] text-white/70">
              {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, index) => (
                <span key={`${item}-${index}`} className="inline-flex items-center gap-3">
                  {item}
                  <span className="text-cyan-300">•</span>
                </span>
              ))}
            </div>
          </div>

          <motion.section {...sectionMotion} className="px-6 py-24">
            <div className="mx-auto max-w-6xl">
              <h2 className="text-center text-3xl font-semibold text-white md:text-4xl">Everything You Need</h2>
              <p className="mx-auto mt-4 max-w-3xl text-center text-slate-300">
                Purpose-built modules that connect context, execution, and accountability in one dark-theme workspace.
              </p>

              <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {FEATURE_ITEMS.map((feature) => (
                  <div
                    key={feature.title}
                    className="group rounded-[24px] border border-white/12 bg-[linear-gradient(160deg,rgba(6,12,24,0.9),rgba(4,8,16,0.82))] p-6 backdrop-blur transition-colors hover:border-cyan-300/28"
                  >
                    <h3 className="text-xl font-semibold text-white">{feature.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-300">{feature.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.section>

          <motion.section {...sectionMotion} className="px-6 pb-24">
            <div className="mx-auto max-w-6xl rounded-[30px] border border-white/12 bg-[linear-gradient(160deg,rgba(6,12,24,0.92),rgba(4,8,16,0.84))] p-6 md:p-10">
              <h2 className="text-center text-3xl font-semibold text-white md:text-4xl">
                Stop Paying For <span className="text-cyan-200">Five Platforms</span>
              </h2>
              <p className="mt-3 text-center text-slate-300">Everything you need, unified under one subscription.</p>

              <div className="mt-8 overflow-hidden rounded-2xl border border-white/12">
                <div className="grid grid-cols-3 bg-white/5 px-4 py-3 text-xs uppercase tracking-[0.15em] text-white/70">
                  <span>Feature</span>
                  <span>Without Stratify</span>
                  <span>With Stratify</span>
                </div>
                {COMPARISON_ROWS.map(([feature, without, withStratify]) => (
                  <div
                    key={feature}
                    className="grid grid-cols-3 border-t border-white/10 px-4 py-3 text-sm text-slate-200"
                  >
                    <span className="text-white/90">{feature}</span>
                    <span className="text-rose-200/90">{without}</span>
                    <span className="text-emerald-200">{withStratify}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.section>

          <motion.section {...sectionMotion} className="px-6 pb-24">
            <div className="mx-auto max-w-6xl">
              <h2 className="text-center text-3xl font-semibold text-white md:text-4xl">How It Works</h2>
              <p className="mt-3 text-center text-slate-300">From idea to execution in minutes, not days.</p>

              <div className="mt-9 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {HOW_STEPS.map((step, index) => (
                  <div
                    key={step.title}
                    className="rounded-[22px] border border-white/12 bg-white/5 p-5 backdrop-blur"
                  >
                    <h3 className="text-lg font-semibold text-white">{`${index + 1}. ${step.title}`}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-300">{step.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.section>

          <motion.section {...sectionMotion} className="px-6 pb-24">
            <div className="mx-auto max-w-6xl text-center">
              <p className="text-xs uppercase tracking-[0.24em] text-white/60">Integrated With</p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-3 text-sm text-slate-200">
                {INTEGRATIONS.map((item, index) => (
                  <React.Fragment key={item}>
                    <span>{item}</span>
                    {index < INTEGRATIONS.length - 1 ? <span className="text-cyan-300/70">•</span> : null}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </motion.section>

          <motion.section {...sectionMotion} className="px-6 pb-24">
            <div className="mx-auto max-w-4xl rounded-[30px] border border-cyan-300/18 bg-[linear-gradient(160deg,rgba(6,12,24,0.96),rgba(4,8,16,0.88))] p-7 text-center md:p-10">
              <h2 className="text-3xl font-semibold text-white md:text-4xl">Be First In Line</h2>
              <p className="mx-auto mt-3 max-w-2xl text-slate-300">
                Join the newsletter waitlist for launch access, product drops, and market intelligence updates.
              </p>

              <form
                onSubmit={handleNewsletterSubmit('bottom')}
                className="mx-auto mt-7 flex max-w-2xl flex-col gap-2 rounded-2xl border border-white/12 bg-[#070d18]/82 p-2 backdrop-blur sm:flex-row"
              >
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={bottomEmail}
                  onChange={(event) => setBottomEmail(event.target.value)}
                  placeholder="Your email address"
                  className="h-12 flex-1 rounded-xl border border-transparent bg-transparent px-4 text-base text-white placeholder:text-slate-400 focus:border-cyan-300/28 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={loadingForm === 'bottom'}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {loadingForm === 'bottom' ? 'Joining...' : 'Get Early Access'}
                  <ChevronRight className="h-4 w-4" strokeWidth={1.8} />
                </button>
              </form>

              {feedback.bottom.message ? (
                <p className={`mt-3 text-sm ${feedback.bottom.type === 'error' ? 'text-rose-300' : 'text-emerald-300'}`}>
                  {feedback.bottom.message}
                </p>
              ) : null}

              <button
                type="button"
                onClick={handlePrimaryAction}
                className="mt-7 inline-flex items-center gap-2 rounded-full border border-emerald-300/28 bg-emerald-400/10 px-5 py-2.5 text-sm font-semibold text-emerald-100 transition-colors hover:bg-emerald-400/18"
              >
                Continue To Platform
                <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
              </button>
            </div>
          </motion.section>
        </main>

        <footer className="border-t border-white/10 px-6 py-8">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-xs text-slate-400 md:flex-row">
            <div className="flex items-center gap-5">
              <a href="https://x.com/stratify_hq" target="_blank" rel="noopener noreferrer" className="hover:text-white">
                X @stratify_hq
              </a>
              <a href="https://discord.gg/6RPsREggYV" target="_blank" rel="noopener noreferrer" className="hover:text-[#5865F2]">
                Discord
              </a>
            </div>
            <p>© {new Date().getFullYear()} Stratify · Built with obsession in Boston</p>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default LandingPage;
