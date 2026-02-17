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

      <main className="relative z-10">
        <motion.section {...sectionMotion} className="py-32 md:py-36 px-6">
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
            <div className="flex items-center gap-4">
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
          </div>
        </footer>
      </main>
    </div>
  );
};

export default LandingPage;
