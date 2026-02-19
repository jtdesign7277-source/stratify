import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Ban,
  Bell,
  Brain,
  ChevronDown,
  Code,
  Crosshair,
  Eye,
  Globe,
  Lock,
  Monitor,
  Shield,
} from 'lucide-react';
import GlobalMarketsBadge from './GlobalMarketsBadge';

const PROBLEM_CARDS = [
  { title: 'Charts & Technicals', cost: '$60/mo' },
  { title: 'Broker App', cost: 'Varies' },
  { title: 'Twitter/X for News', cost: '$100/mo' },
  { title: 'Reddit for Ideas', cost: 'Time cost' },
  { title: 'AI Research', cost: '$200/mo' },
  { title: 'Email Alerts', cost: '$25/mo' },
  { title: 'Backtesting', cost: '$100/mo' },
  { title: 'Spreadsheet P&L', cost: 'Manual' },
];

const FEATURE_CARDS = [
  {
    title: 'War Room',
    description: 'Real-time market intelligence with AI web search.',
    icon: Crosshair,
  },
  {
    title: 'Sophia AI',
    description: 'Your personal trading analyst that knows your portfolio.',
    icon: Brain,
  },
  {
    title: 'Strategy Builder',
    description: 'AI-generated strategies with real trade analysis.',
    icon: Code,
  },
  {
    title: 'Live Terminal',
    description: 'Professional charts and one-click broker execution.',
    icon: Monitor,
  },
  {
    title: 'Smart Alerts',
    description: 'Custom price, volume, and sentiment triggers via email/SMS.',
    icon: Bell,
  },
  {
    title: 'Social Sentiment',
    description: 'X + Reddit monitoring with AI-filtered signals.',
    icon: Globe,
  },
];

const HOW_STEPS = [
  {
    title: 'Sign up & get your API key',
    description: 'Create your account and instantly unlock your Stratify key.',
  },
  {
    title: 'Connect your broker',
    description: 'Securely link your broker to enable execution and portfolio sync.',
  },
  {
    title: 'Customize your dashboard',
    description: 'Arrange modules, watchlists, and strategy tools around your workflow.',
  },
  {
    title: 'Let Sophia take over',
    description: 'Run deep scans, generate setups, and monitor conditions 24/7.',
  },
  {
    title: 'Trade with confidence',
    description: 'Move from signal to execution with speed, clarity, and control.',
  },
];

const PRICING_PLANS = [
  {
    id: 'starter',
    name: 'STARTER',
    price: 'Free',
    subtitle: 'Ideal for exploring the platform',
    features: ['Delayed data', '5 scans/day', 'Basic watchlist', '1 strategy'],
    borderClass: 'border-gray-800',
  },
  {
    id: 'pro',
    name: 'PRO',
    price: '$29/mo',
    subtitle: 'For active independent traders',
    features: [
      'Live data',
      '50 scans/day',
      'Unlimited watchlist',
      '1 broker connection',
      'Email alerts',
      'Sophia AI',
    ],
    borderClass: 'border-blue-500/50',
  },
  {
    id: 'elite',
    name: 'ELITE',
    price: '$99/mo',
    subtitle: 'Built for power users',
    features: [
      'Unlimited scans',
      '3 broker connections',
      'SMS alerts',
      'Social sentiment engine',
      'Custom layouts',
      'Browser extension',
    ],
    borderClass: 'border-amber-500',
    isPopular: true,
  },
  {
    id: 'institutional',
    name: 'INSTITUTIONAL',
    price: '$299/mo',
    subtitle: 'For teams and firms',
    features: ['Team accounts', 'White-label options', 'Dedicated support', 'Unlimited everything'],
    borderClass: 'border-purple-500/50',
  },
];

const SECURITY_ITEMS = [
  { icon: Shield, text: 'AES-256 encrypted broker credentials' },
  { icon: Lock, text: 'Hashed API keys - never stored in plaintext' },
  { icon: Globe, text: 'HTTPS/TLS encryption on all data' },
  { icon: Eye, text: 'Row-level security - your data is yours alone' },
  { icon: Ban, text: 'We never sell your data' },
];

const FAQ_ITEMS = [
  {
    question: 'What is a Stratify API key?',
    answer:
      'Your Stratify API key is your secure access credential that connects every service in the platform under one identity.',
  },
  {
    question: 'Do I need other subscriptions?',
    answer:
      'No. Stratify is designed to replace fragmented tools with one connected platform and one monthly plan.',
  },
  {
    question: 'Is my broker account safe?',
    answer:
      'Yes. Broker credentials are encrypted with enterprise-grade standards and handled with strict access controls.',
  },
  {
    question: 'Can I use it without a broker?',
    answer:
      'Yes. You can run scans, build strategies, monitor sentiment, and use Sophia AI before connecting execution.',
  },
  {
    question: 'What makes Sophia different from ChatGPT?',
    answer:
      'Sophia is embedded into your live trading workflow, connected to your strategies, and built for market execution context.',
  },
  {
    question: 'Can I cancel anytime?',
    answer: 'Yes. Every paid plan is month-to-month and can be cancelled anytime from your account settings.',
  },
  {
    question: 'What brokers do you support?',
    answer:
      'Current support includes Alpaca, Tradier, and Webull, with additional integrations on the roadmap.',
  },
];

const sectionMotion = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.25 },
  transition: { duration: 0.55, ease: 'easeOut' },
};

const landingStyles = `
  .landing-star {
    position: absolute;
    border-radius: 9999px;
    background: rgba(255, 255, 255, 0.85);
    animation: landingStarDrift linear infinite;
  }

  @keyframes landingStarDrift {
    0% {
      opacity: 0.15;
      transform: translate3d(0, 0, 0);
    }
    45% {
      opacity: 0.6;
    }
    100% {
      opacity: 0.1;
      transform: translate3d(var(--drift-x, 0px), -90px, 0);
    }
  }

  .landing-orb {
    animation: landingOrbFloat 9s ease-in-out infinite;
  }

  @keyframes landingOrbFloat {
    0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
    50% { transform: translate3d(0, -16px, 0) scale(1.03); }
  }

  .landing-mesh {
    background:
      radial-gradient(circle at 20% 20%, rgba(245, 158, 11, 0.14), transparent 38%),
      radial-gradient(circle at 80% 25%, rgba(99, 102, 241, 0.12), transparent 42%),
      radial-gradient(circle at 60% 80%, rgba(16, 185, 129, 0.08), transparent 45%);
  }
`;

const createStars = (count = 90) =>
  Array.from({ length: count }, (_, index) => ({
    id: `landing-star-${index}`,
    left: Math.random() * 100,
    top: Math.random() * 100,
    size: Math.random() > 0.75 ? 2 : 1,
    opacity: 0.2 + Math.random() * 0.75,
    duration: 60 + Math.random() * 70,
    delay: -Math.random() * 120,
    driftX: (Math.random() - 0.5) * 34,
  }));

const LandingPage = ({ onEnter, onSignUp, isAuthenticated }) => {
  const [openFaq, setOpenFaq] = useState(0);
  const stars = useMemo(() => createStars(90), []);

  useEffect(() => {
    const html = document.documentElement;
    const previous = html.style.scrollBehavior;
    html.style.scrollBehavior = 'smooth';
    return () => {
      html.style.scrollBehavior = previous;
    };
  }, []);

  const handleGetStarted = () => {
    if (onSignUp) {
      onSignUp();
      return;
    }

    onEnter?.();
  };

  return (
    <div className="relative min-h-screen bg-transparent text-white overflow-x-hidden">
      <style>{landingStyles}</style>

      <div className="absolute inset-0 pointer-events-none landing-mesh" />
      <div className="absolute inset-0 pointer-events-none">
        {stars.map((star) => (
          <span
            key={star.id}
            className="landing-star"
            style={{
              left: `${star.left}%`,
              top: `${star.top}%`,
              width: `${star.size}px`,
              height: `${star.size}px`,
              opacity: star.opacity,
              animationDuration: `${star.duration}s`,
              animationDelay: `${star.delay}s`,
              '--drift-x': `${star.driftX}px`,
            }}
          />
        ))}
      </div>

      {/* Top Row (integrated into page, no separate header bar) */}
      <nav className="relative z-20 mx-auto flex w-full max-w-6xl items-center justify-between px-6 pt-6">
        <span className="text-white/95 font-bold text-sm tracking-[0.3em]">STRATIFY</span>
        <div className="flex items-center gap-4">
          <a
            href="https://discord.gg/6RPsREggYV"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-[#5865F2] transition-colors"
            title="Join Discord"
          >
            <svg width="20" height="16" viewBox="0 0 71 55" fill="currentColor"><path d="M60.1 4.9C55.6 2.8 50.7 1.3 45.7.4c-.1 0-.2 0-.2.1-.6 1.1-1.3 2.6-1.8 3.7-5.5-.8-10.9-.8-16.3 0-.5-1.2-1.2-2.6-1.8-3.7 0-.1-.1-.1-.2-.1C20.3 1.3 15.4 2.8 10.9 4.9c0 0-.1 0-.1.1C1.6 18.7-.9 32.1.3 45.4v.2c6.1 4.5 12 7.2 17.7 9 .1 0 .2 0 .2-.1 1.4-1.9 2.6-3.8 3.6-5.9.1-.1 0-.3-.1-.3-2-.7-3.8-1.6-5.6-2.7-.1-.1-.1-.3 0-.4.4-.3.7-.6 1.1-.9.1-.1.1-.1.2-.1 11.6 5.3 24.2 5.3 35.7 0h.2c.4.3.7.6 1.1.9.1.1.1.3 0 .4-1.8 1-3.6 2-5.6 2.7-.1.1-.2.2-.1.3 1.1 2.1 2.3 4.1 3.6 5.9.1.1.2.1.2.1 5.8-1.8 11.6-4.5 17.7-9 0 0 .1-.1.1-.2 1.5-15.6-2.5-29.1-10.7-41.1 0 0 0 0-.1-.1z"/></svg>
          </a>
          <button
            type="button"
            onClick={handleGetStarted}
            className="bg-amber-500 hover:bg-amber-600 text-black font-bold px-4 py-1.5 rounded-lg text-sm transition-colors"
          >
            Sign Up
          </button>
        </div>
      </nav>

      <main className="relative z-10">
        <motion.section {...sectionMotion} className="pt-28 pb-28 md:pt-32 md:pb-32 px-6">
          <div className="max-w-6xl mx-auto text-center relative">
            <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] h-[420px] rounded-full bg-amber-500/12 blur-3xl landing-orb" />
            <div className="pointer-events-none absolute left-1/2 top-[45%] -translate-x-1/2 w-[620px] h-[260px] rounded-full bg-indigo-500/10 blur-3xl" />

            <p className="text-[11px] uppercase tracking-[0.45em] text-gray-500 mb-8">Market Infrastructure Reimagined</p>
            <h1 className="text-white font-bold text-6xl tracking-[0.3em] leading-tight">STRATIFY</h1>
            <p className="mt-6 text-amber-500 text-xl italic">One Key. Every Market. Total Control.</p>
            <p className="mt-6 text-gray-400 max-w-2xl mx-auto text-center text-base md:text-lg leading-relaxed">
              The all-in-one trading platform that connects live market data, AI-powered research, social sentiment,
              broker execution, and personalized alerts into a single interface.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleGetStarted}
                className="bg-amber-500 hover:bg-amber-600 text-black font-bold px-8 py-3 rounded-xl transition-colors inline-flex items-center gap-2"
              >
                Get Started — $9.99/mo
                <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
              </button>
              <a
                href="/whitepaper"
                className="border border-gray-700 hover:border-amber-500/50 text-gray-300 px-8 py-3 rounded-xl transition-colors"
              >
                Read White Paper
              </a>
            </div>

            {/* Discord Community CTA */}
            <div className="mt-8 flex items-center justify-center gap-2">
              <a
                href="https://discord.gg/6RPsREggYV"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-[#5865F2] transition-colors"
              >
                <svg width="20" height="16" viewBox="0 0 71 55" fill="currentColor" className="shrink-0">
                  <path d="M60.1 4.9C55.6 2.8 50.7 1.3 45.7.4c-.1 0-.2 0-.2.1-.6 1.1-1.3 2.6-1.8 3.7-5.5-.8-10.9-.8-16.3 0-.5-1.2-1.2-2.6-1.8-3.7 0-.1-.1-.1-.2-.1C20.3 1.3 15.4 2.8 10.9 4.9c0 0-.1 0-.1.1C1.6 18.7-.9 32.1.3 45.4v.2c6.1 4.5 12 7.2 17.7 9 .1 0 .2 0 .2-.1 1.4-1.9 2.6-3.8 3.6-5.9.1-.1 0-.3-.1-.3-2-.7-3.8-1.6-5.6-2.7-.1-.1-.1-.3 0-.4.4-.3.7-.6 1.1-.9.1-.1.1-.1.2-.1 11.6 5.3 24.2 5.3 35.7 0h.2c.4.3.7.6 1.1.9.1.1.1.3 0 .4-1.8 1-3.6 2-5.6 2.7-.1.1-.2.2-.1.3 1.1 2.1 2.3 4.1 3.6 5.9.1.1.2.1.2.1 5.8-1.8 11.6-4.5 17.7-9 0 0 .1-.1.1-.2 1.5-15.6-2.5-29.1-10.7-41.1 0 0 0 0-.1-.1z"/>
                </svg>
                Join the Stratify community on Discord
              </a>
            </div>

            <GlobalMarketsBadge />

            {/* Powered By — inline SVGs only, no boxes, no backgrounds */}
            <div className="mt-20 mb-16 flex flex-col items-center gap-10">
              <p className="text-xs uppercase tracking-[0.35em] text-gray-500 font-medium">Powered By</p>
              <div className="flex items-center justify-center gap-12 flex-wrap">
                {/* Stripe — exact wordmark */}
                <a href="https://stripe.com" target="_blank" rel="noopener noreferrer" className="opacity-50 hover:opacity-90 transition-opacity duration-300">
                  <svg xmlns="http://www.w3.org/2000/svg" width="120" height="50" fill="none" viewBox="0 0 60 25"><path fill="white" fillRule="evenodd" d="M59.6444 14.2813h-8.062c.1843 1.9296 1.5983 2.5476 3.2032 2.5476 1.6352 0 2.9534-.3656 4.0453-.9506v3.3179c-1.1186.7115-2.5964 1.1068-4.5645 1.1068-4.011 0-6.8218-2.5122-6.8218-7.4783 0-4.19441 2.3837-7.52509 6.3017-7.52509 3.912 0 5.9537 3.28038 5.9537 7.49819 0 .3982-.0372 1.261-.0556 1.4835Zm-5.9241-5.62407c-1.0294 0-2.1739.72812-2.1739 2.58387h4.2573c0-1.85362-1.0721-2.58387-2.0834-2.58387ZM40.9547 20.303c-1.4411 0-2.322-.6087-2.9133-1.0417l-.0088 4.6271-4.1181.8755-.0014-19.19053h3.7543l.0864 1.01784c.6035-.52914 1.6114-1.29157 3.2256-1.29162 2.8925 0 5.6162 2.6052 5.6162 7.39971 0 5.2327-2.6948 7.6037-5.6409 7.6037Zm-.959-11.35573c-.9453 0-1.5376.34559-1.9669.81586l.0245 6.11967c.3997.433.9763.7813 1.9424.7813 1.5231 0 2.5437-1.6575 2.5437-3.8745 0-2.1544-1.037-3.84233-2.5437-3.84233Zm-11.7602-3.3739h4.1341V20.0088h-4.1341V5.57337Zm0-4.694699L32.3696 0v3.35821l-4.1341.87868V.878671ZM23.9198 10.2223v9.7861h-4.1156V5.57296h3.6867l.1317 1.21751c1.0035-1.7722 3.0722-1.41321 3.6209-1.21594v3.78524c-.5242-.16908-2.2894-.42779-3.3237.86253Zm-8.5525 4.7221c0 2.4275 2.5988 1.6719 3.1263 1.4609v3.3522c-.5492.3013-1.5437.5458-2.8901.5458-2.4441 0-4.2773-1.7999-4.2773-4.2379l.0173-13.17658 4.0206-.85464.0032 3.5395h3.1278V9.0857h-3.1278v5.8588-.0001Zm-4.9069.7026c0 2.9645-2.31051 4.6562-5.73464 4.6562-1.41958 0-2.92289-.2761-4.453935-.9347v-3.9319c1.382085.7516 3.093705 1.315 4.457755 1.315.91864 0 1.53106-.2459 1.53106-1.0069C6.26064 13.7786 0 14.5192 0 9.95995 0 7.04457 2.27622 5.2998 5.61655 5.2998c1.36404 0 2.72806.20934 4.09208.75351V9.9317c-1.25265-.67618-2.84332-1.05979-4.09588-1.05979-.86296 0-1.44753.24965-1.44753.8924.0001 1.85329 6.29518.97249 6.29518 5.88279v-.0001Z" clipRule="evenodd"/></svg>
                </a>
                {/* Supabase — green icon + wordmark from their dark theme */}
                <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" className="opacity-50 hover:opacity-90 transition-opacity duration-300">
                  <img src="/logos/supabase-dark.png" alt="Supabase" className="h-[26px] w-auto" />
                </a>
                {/* Claude — exact wordmark SVG pulled from claude.ai */}
                <a href="https://anthropic.com/claude" target="_blank" rel="noopener noreferrer" className="opacity-50 hover:opacity-90 transition-opacity duration-300">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 112 24" height="28" fill="white"><path d="M11.376 24L10.776 23.544L10.44 22.8L10.776 21.312L11.16 19.392L11.472 17.856L11.76 15.96L11.928 15.336L11.904 15.288L11.784 15.312L10.344 17.28L8.16 20.232L6.432 22.056L6.024 22.224L5.304 21.864L5.376 21.192L5.784 20.616L8.16 17.568L9.6 15.672L10.536 14.592L10.512 14.448H10.464L4.128 18.576L3 18.72L2.496 18.264L2.568 17.52L2.808 17.28L4.704 15.96L9.432 13.32L9.504 13.08L9.432 12.96H9.192L8.4 12.912L5.712 12.84L3.384 12.744L1.104 12.624L0.528 12.504L0 11.784L0.048 11.424L0.528 11.112L1.224 11.16L2.736 11.28L5.016 11.424L6.672 11.52L9.12 11.784H9.504L9.552 11.616L9.432 11.52L9.336 11.424L6.96 9.84L4.416 8.16L3.072 7.176L2.352 6.672L1.992 6.216L1.848 5.208L2.496 4.488L3.384 4.56L3.6 4.608L4.488 5.304L6.384 6.768L8.88 8.616L9.24 8.904L9.408 8.808V8.736L9.24 8.472L7.896 6.024L6.456 3.528L5.808 2.496L5.64 1.872C5.576 1.656 5.544 1.416 5.544 1.152L6.288 0.144L6.696 0L7.704 0.144L8.112 0.504L8.736 1.92L9.72 4.152L11.28 7.176L11.736 8.088L11.976 8.904L12.072 9.168H12.24V9.024L12.36 7.296L12.6 5.208L12.84 2.52L12.912 1.752L13.296 0.84L14.04 0.36L14.616 0.624L15.096 1.32L15.024 1.752L14.76 3.6L14.184 6.504L13.824 8.472H14.04L14.28 8.208L15.264 6.912L16.92 4.848L17.64 4.032L18.504 3.12L19.056 2.688H20.088L20.832 3.816L20.496 4.992L19.44 6.336L18.552 7.464L17.28 9.168L16.512 10.536L16.584 10.632H16.752L19.608 10.008L21.168 9.744L22.992 9.432L23.832 9.816L23.928 10.2L23.592 11.016L21.624 11.496L19.32 11.952L15.888 12.768L15.84 12.792L15.888 12.864L17.424 13.008L18.096 13.056H19.728L22.752 13.272L23.544 13.8L24 14.424L23.928 14.928L22.704 15.528L21.072 15.144L17.232 14.232L15.936 13.92H15.744V14.016L16.848 15.096L18.84 16.896L21.36 19.224L21.48 19.8L21.168 20.28L20.832 20.232L18.624 18.552L17.76 17.808L15.84 16.2H15.72V16.368L16.152 17.016L18.504 20.544L18.624 21.624L18.456 21.96L17.832 22.176L17.184 22.056L15.792 20.136L14.376 17.952L13.224 16.008L13.104 16.104L12.408 23.352L12.096 23.712L11.376 24Z" fill="#D97757"/><path d="M39.504 21.264C37.688 21.264 36.06 20.9 34.62 20.172C33.18 19.444 32.048 18.416 31.224 17.088C30.408 15.76 30 14.224 30 12.48C30 10.656 30.412 9.032 31.236 7.608C32.06 6.176 33.196 5.068 34.644 4.284C36.1 3.492 37.74 3.096 39.564 3.096C40.692 3.096 41.82 3.22 42.948 3.468C44.084 3.716 45.072 4.096 45.912 4.608V8.568H44.832C44.536 7.168 43.96 6.124 43.104 5.436C42.256 4.748 41.076 4.404 39.564 4.404C38.164 4.404 36.996 4.732 36.06 5.388C35.132 6.036 34.444 6.936 33.996 8.088C33.548 9.24 33.324 10.564 33.324 12.06C33.324 13.548 33.576 14.888 34.08 16.08C34.584 17.272 35.328 18.216 36.312 18.912C37.296 19.6 38.476 19.944 39.852 19.944C40.796 19.944 41.608 19.748 42.288 19.356C42.968 18.964 43.54 18.436 44.004 17.772C44.468 17.1 44.908 16.28 45.324 15.312H46.464L45.684 19.68C44.892 20.2 43.936 20.596 42.816 20.868C41.704 21.132 40.6 21.264 39.504 21.264ZM47.964 21V19.956C48.356 19.9 48.668 19.84 48.9 19.776C49.14 19.704 49.332 19.588 49.476 19.428C49.628 19.268 49.704 19.044 49.704 18.756V5.832L47.964 5.088V4.284L51.612 2.736H52.56V18.756C52.56 19.052 52.632 19.28 52.776 19.44C52.928 19.6 53.12 19.712 53.352 19.776C53.592 19.84 53.912 19.9 54.312 19.956V21H47.964ZM59.028 21.264C58.38 21.264 57.792 21.136 57.264 20.88C56.736 20.624 56.32 20.256 56.016 19.776C55.712 19.296 55.56 18.736 55.56 18.096C55.56 17.12 55.86 16.344 56.46 15.768C57.068 15.184 57.916 14.74 59.004 14.436L63.24 13.236V11.712C63.24 10.888 63.048 10.252 62.664 9.804C62.288 9.348 61.708 9.12 60.924 9.12C60.228 9.12 59.704 9.332 59.352 9.756C59.008 10.172 58.836 10.748 58.836 11.484V12.612H56.988C56.764 12.468 56.588 12.276 56.46 12.036C56.34 11.788 56.28 11.516 56.28 11.22C56.28 10.556 56.516 9.988 56.988 9.516C57.46 9.036 58.06 8.676 58.788 8.436C59.516 8.196 60.256 8.076 61.008 8.076C62.592 8.076 63.836 8.44 64.74 9.168C65.644 9.896 66.096 11 66.096 12.48V18.54C66.096 18.86 66.168 19.104 66.312 19.272C66.456 19.44 66.644 19.56 66.876 19.632C67.116 19.696 67.44 19.756 67.848 19.812V20.856C67.536 20.968 67.208 21.056 66.864 21.12C66.528 21.184 66.204 21.216 65.892 21.216C65.148 21.216 64.548 21.048 64.092 20.712C63.644 20.368 63.372 19.864 63.276 19.2C62.716 19.864 62.08 20.376 61.368 20.736C60.664 21.088 59.884 21.264 59.028 21.264ZM60.444 19.344C60.948 19.344 61.44 19.228 61.92 18.996C62.408 18.756 62.848 18.44 63.24 18.048V14.34L60.168 15.252C59.592 15.428 59.152 15.7 58.848 16.068C58.544 16.436 58.392 16.9 58.392 17.46C58.392 17.82 58.48 18.144 58.656 18.432C58.832 18.72 59.076 18.944 59.388 19.104C59.7 19.264 60.052 19.344 60.444 19.344ZM73.608 21.264C72.32 21.264 71.356 20.928 70.716 20.256C70.084 19.584 69.768 18.636 69.768 17.412V10.908L68.016 10.26L68.112 9.456L71.664 8.076H72.624V16.932C72.624 17.692 72.812 18.256 73.188 18.624C73.564 18.992 74.14 19.176 74.916 19.176C75.428 19.176 75.964 19.06 76.524 18.828C77.084 18.588 77.6 18.28 78.072 17.904V10.908L76.32 10.26V9.456L79.98 8.076H80.928V17.832C80.928 18.152 81 18.4 81.144 18.576C81.288 18.744 81.476 18.864 81.708 18.936C81.948 19.008 82.272 19.072 82.68 19.128V20.16L79.02 21.18H78.072V19.08C77.44 19.736 76.728 20.264 75.936 20.664C75.144 21.064 74.368 21.264 73.608 21.264ZM89.328 21.264C88.264 21.264 87.312 21.008 86.472 20.496C85.632 19.976 84.976 19.268 84.504 18.372C84.032 17.476 83.796 16.484 83.796 15.396C83.796 13.964 84.08 12.696 84.648 11.592C85.224 10.488 86.032 9.628 87.072 9.012C88.112 8.388 89.32 8.076 90.696 8.076C91.12 8.076 91.556 8.124 92.004 8.22C92.46 8.308 92.896 8.436 93.312 8.604V5.82L91.56 5.088V4.284L95.22 2.736H96.168V17.832C96.168 18.152 96.24 18.4 96.384 18.576C96.536 18.744 96.728 18.864 96.96 18.936C97.2 19.008 97.52 19.072 97.92 19.128V20.16L94.26 21.18H93.312V19.584C92.752 20.112 92.132 20.524 91.452 20.82C90.78 21.116 90.072 21.264 89.328 21.264ZM90.504 19.332C90.976 19.332 91.456 19.236 91.944 19.044C92.432 18.852 92.888 18.588 93.312 18.252V10.356C92.584 9.764 91.776 9.468 90.888 9.468C89.992 9.468 89.236 9.696 88.62 10.152C88.004 10.608 87.54 11.228 87.228 12.012C86.924 12.788 86.772 13.656 86.772 14.616C86.772 15.528 86.908 16.34 87.18 17.052C87.452 17.756 87.868 18.312 88.428 18.72C88.988 19.128 89.68 19.332 90.504 19.332ZM105.252 21.264C104.068 21.264 103.004 20.988 102.06 20.436C101.116 19.884 100.376 19.116 99.84 18.132C99.304 17.148 99.036 16.044 99.036 14.82C99.036 13.556 99.308 12.412 99.852 11.388C100.404 10.356 101.156 9.548 102.108 8.964C103.068 8.372 104.136 8.076 105.312 8.076C106.216 8.076 107.048 8.264 107.808 8.64C108.568 9.016 109.2 9.544 109.704 10.224C110.216 10.904 110.552 11.688 110.712 12.576L101.928 15.288C102.168 16.4 102.644 17.276 103.356 17.916C104.076 18.556 104.968 18.876 106.032 18.876C106.92 18.876 107.716 18.652 108.42 18.204C109.124 17.748 109.748 17.06 110.292 16.14L111.228 16.44C111.012 17.4 110.62 18.244 110.052 18.972C109.484 19.7 108.784 20.264 107.952 20.664C107.128 21.064 106.228 21.264 105.252 21.264ZM107.628 12.204C107.516 11.652 107.324 11.168 107.052 10.752C106.788 10.328 106.46 10 106.068 9.768C105.676 9.536 105.244 9.42 104.772 9.42C104.18 9.42 103.656 9.6 103.2 9.96C102.752 10.312 102.4 10.816 102.144 11.472C101.896 12.12 101.772 12.872 101.772 13.728C101.772 13.88 101.776 13.996 101.784 14.076L107.628 12.204Z"/></svg>
                </a>
                {/* Vercel — exact triangle + wordmark */}
                <a href="https://vercel.com" target="_blank" rel="noopener noreferrer" className="opacity-50 hover:opacity-90 transition-opacity duration-300 flex items-center gap-2">
                  <svg height="20" viewBox="0 0 74 64" fill="white"><path d="M37.5896 0.25L74.5396 64.25H0.639648L37.5896 0.25Z"/></svg>
                  <span className="text-[22px] font-semibold text-white tracking-tight" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>Vercel</span>
                </a>
              </div>
            </div>
          </div>
        </motion.section>

        <motion.section {...sectionMotion} className="py-24 px-6">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-white text-3xl font-bold text-center">The Problem</h2>
            <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {PROBLEM_CARDS.map((card) => (
                <div key={card.title} className="bg-white/5 border border-red-500/20 rounded-xl p-4">
                  <p className="text-white font-medium">{card.title}</p>
                  <p className="text-red-300 text-sm mt-2">{card.cost}</p>
                </div>
              ))}
            </div>
            <p className="mt-8 text-center text-red-400 text-2xl font-bold">Total: $373-784/month</p>
            <p className="mt-2 text-center text-amber-500 text-xl">There&apos;s a better way.</p>
          </div>
        </motion.section>

        <motion.section {...sectionMotion} className="py-24 px-6">
          <div className="max-w-6xl mx-auto text-center">
            <h2 className="text-white text-3xl font-bold">One Platform. One Key.</h2>
            <div className="mt-10 max-w-md mx-auto rounded-2xl border border-amber-500/50 shadow-[0_0_36px_rgba(245,158,11,0.14)] bg-black/35 p-8">
              <p className="text-white text-xl font-semibold">Stratify - $29/mo</p>
            </div>
            <p className="mt-4 text-amber-400">Up to 87% savings with everything connected.</p>

            <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { value: '1', label: 'API Key' },
                { value: '15+', label: 'Services' },
                { value: '24/7', label: 'AI Monitoring' },
              ].map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-gray-800 bg-black/30 px-5 py-6">
                  <p className="text-4xl font-bold text-amber-400">{stat.value}</p>
                  <p className="mt-2 text-gray-400">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        <motion.section {...sectionMotion} className="py-24 px-6">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-white text-3xl font-bold text-center">Everything You Need</h2>
            <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {FEATURE_CARDS.map((feature) => {
                const Icon = feature.icon;
                return (
                  <div
                    key={feature.title}
                    className="bg-black/40 backdrop-blur border border-gray-800 rounded-2xl p-6 hover:border-amber-500/30 transition-all"
                  >
                    <Icon className="h-5 w-5 text-amber-400" strokeWidth={1.5} />
                    <h3 className="mt-4 text-white font-semibold">{feature.title}</h3>
                    <p className="mt-2 text-gray-400 text-sm leading-relaxed">{feature.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.section>

        <motion.section {...sectionMotion} className="py-24 px-6">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-white text-3xl font-bold text-center">Get Started in 5 Minutes</h2>

            <div className="mt-12 relative hidden md:block">
              <div className="absolute left-[10%] right-[10%] top-5 h-px bg-amber-500/35" />
              <div className="grid grid-cols-5 gap-4">
                {HOW_STEPS.map((step, index) => (
                  <div key={step.title} className="text-center px-2">
                    <div className="mx-auto h-10 w-10 rounded-full bg-amber-500/20 border border-amber-500/50 text-amber-300 flex items-center justify-center font-semibold">
                      {index + 1}
                    </div>
                    <h3 className="mt-4 text-white font-semibold text-sm">{step.title}</h3>
                    <p className="mt-2 text-gray-400 text-xs leading-relaxed">{step.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-10 space-y-4 md:hidden">
              {HOW_STEPS.map((step, index) => (
                <div key={step.title} className="relative rounded-xl border border-gray-800 bg-black/30 p-4 pl-14">
                  {index < HOW_STEPS.length - 1 ? (
                    <span className="absolute left-[26px] top-10 bottom-[-20px] w-px bg-amber-500/30" />
                  ) : null}
                  <span className="absolute left-3 top-3 h-7 w-7 rounded-full bg-amber-500/20 border border-amber-500/50 text-amber-300 text-sm font-semibold flex items-center justify-center">
                    {index + 1}
                  </span>
                  <h3 className="text-white font-semibold text-sm">{step.title}</h3>
                  <p className="mt-1 text-gray-400 text-xs">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        <motion.section {...sectionMotion} className="py-24 px-6" id="whitepaper-pricing">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-white text-3xl font-bold text-center">Simple Pricing</h2>
            <div className="mt-10 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-stretch">
              {PRICING_PLANS.map((plan) => (
                <div
                  key={plan.id}
                  className={`rounded-2xl border ${plan.borderClass} bg-black/35 p-6 flex flex-col ${
                    plan.isPopular ? 'xl:-translate-y-2 shadow-[0_0_38px_rgba(245,158,11,0.14)]' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-white font-semibold tracking-wide">{plan.name}</h3>
                    {plan.isPopular ? (
                      <span className="text-[10px] uppercase tracking-wide px-2 py-1 rounded-full bg-amber-500 text-black font-semibold">
                        Most Popular
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-4 text-3xl font-bold text-white">{plan.price}</p>
                  <p className="mt-2 text-gray-400 text-sm">{plan.subtitle}</p>

                  <div className="mt-5 space-y-2 flex-1">
                    {plan.features.map((feature) => (
                      <p key={feature} className="text-gray-300 text-sm">
                        {feature}
                      </p>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={handleGetStarted}
                    className="mt-6 w-full rounded-xl border border-gray-700 hover:border-amber-500/50 text-gray-200 hover:text-white px-4 py-2.5 transition-colors"
                  >
                    Get Started
                  </button>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        <motion.section {...sectionMotion} className="py-24 px-6">
          <div className="max-w-4xl mx-auto rounded-2xl border border-gray-800 bg-black/35 p-8">
            <h2 className="text-white text-3xl font-bold text-center">Your Security, Our Priority</h2>
            <div className="mt-8 space-y-3">
              {SECURITY_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.text} className="flex items-center gap-3 rounded-lg border border-gray-800/70 bg-black/30 px-4 py-3">
                    <Icon className="h-4 w-4 text-amber-400" strokeWidth={1.5} />
                    <span className="text-gray-300 text-sm">{item.text}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.section>

        <motion.section {...sectionMotion} className="py-24 px-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-white text-3xl font-bold text-center">Questions?</h2>
            <div className="mt-8 space-y-3">
              {FAQ_ITEMS.map((faq, index) => {
                const isOpen = openFaq === index;
                return (
                  <div key={faq.question} className="rounded-xl border border-gray-800 bg-black/35 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setOpenFaq((prev) => (prev === index ? -1 : index))}
                      className={`w-full flex items-center justify-between gap-3 px-4 py-3 text-left transition-colors ${
                        isOpen ? 'text-white' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      <span className="font-medium">{faq.question}</span>
                      <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} strokeWidth={1.5} />
                    </button>
                    {isOpen ? <div className="px-4 pb-4 text-sm text-gray-400 leading-relaxed">{faq.answer}</div> : null}
                  </div>
                );
              })}
            </div>
          </div>
        </motion.section>

        <motion.section {...sectionMotion} className="py-28 px-6">
          <div className="max-w-4xl mx-auto text-center rounded-3xl border border-gray-800 bg-black/30 p-10 md:p-14">
            <h2 className="text-white text-4xl font-bold">Ready to Trade Smarter?</h2>
            <p className="mt-4 text-gray-400 text-lg">Get your Stratify API key and take control.</p>
            <button
              type="button"
              onClick={handleGetStarted}
              className="mt-8 bg-amber-500 hover:bg-amber-600 text-black font-bold px-8 py-3 rounded-xl transition-colors"
            >
              Get Started — $9.99/mo
            </button>
            <p className="mt-5 text-sm text-gray-500">
              <a href="https://stratify.associates" className="text-amber-400 hover:text-amber-300 transition-colors">
                stratify.associates
              </a>
            </p>
          </div>
        </motion.section>

        <footer className="border-t border-gray-800 px-6 py-8">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-gray-500">
            <p>© {new Date().getFullYear()} Stratify. All rights reserved.</p>
            <div className="flex items-center gap-6">
              <a href="/whitepaper" className="hover:text-amber-300 transition-colors">
                White Paper
              </a>
              <a href="/privacy" className="hover:text-amber-300 transition-colors">
                Privacy
              </a>
              <a href="/terms" className="hover:text-amber-300 transition-colors">
                Terms
              </a>
            </div>
            <div className="flex items-center gap-5">
              {/* X (Twitter) */}
              <a href="https://x.com/StratifyAI" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-white transition-colors" title="X">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              </a>
              {/* Discord */}
              <a href="https://discord.gg/6RPsREggYV" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-white transition-colors" title="Discord">
                <svg width="20" height="15" viewBox="0 0 71 55" fill="currentColor"><path d="M60.1 4.9C55.6 2.8 50.7 1.3 45.7.4c-.1 0-.2 0-.2.1-.6 1.1-1.3 2.6-1.8 3.7-5.5-.8-10.9-.8-16.3 0-.5-1.2-1.2-2.6-1.8-3.7 0-.1-.1-.1-.2-.1C20.3 1.3 15.4 2.8 10.9 4.9c0 0-.1 0-.1.1C1.6 18.7-.9 32.1.3 45.4v.2c6.1 4.5 12 7.2 17.7 9 .1 0 .2 0 .2-.1 1.4-1.9 2.6-3.8 3.6-5.9.1-.1 0-.3-.1-.3-2-.7-3.8-1.6-5.6-2.7-.1-.1-.1-.3 0-.4.4-.3.7-.6 1.1-.9.1-.1.1-.1.2-.1 11.6 5.3 24.2 5.3 35.7 0h.2c.4.3.7.6 1.1.9.1.1.1.3 0 .4-1.8 1-3.6 2-5.6 2.7-.1.1-.2.2-.1.3 1.1 2.1 2.3 4.1 3.6 5.9.1.1.2.1.2.1 5.8-1.8 11.6-4.5 17.7-9 0 0 .1-.1.1-.2 1.5-15.6-2.5-29.1-10.7-41.1 0 0 0 0-.1-.1z"/></svg>
              </a>
              {/* GitHub */}
              <a href="https://github.com/jtdesign7277-source/stratify" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-white transition-colors" title="GitHub">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>
              </a>
              {/* Instagram */}
              <a href="https://instagram.com/stratifyai" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-white transition-colors" title="Instagram">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
              </a>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
};

export default LandingPage;
