import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';

const TOC_ITEMS = [
  { id: 'problem', label: 'The Problem' },
  { id: 'solution', label: 'The Solution' },
  { id: 'how-it-works', label: 'How It Works' },
  { id: 'core-features', label: 'Core Features' },
  { id: 'under-the-hood', label: "What's Under The Hood" },
  { id: 'browser-extension', label: 'Browser Extension' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'security', label: 'Security & Trust' },
  { id: 'faq', label: 'FAQ' },
  { id: 'final-cta', label: 'Final CTA' },
];

const BODY_CLASS = 'text-gray-300 text-base leading-relaxed mb-4';

const AMBER_BULLET = ({ children }) => (
  <li className="text-gray-400 text-base leading-relaxed flex gap-3">
    <span className="text-amber-400">•</span>
    <span>{children}</span>
  </li>
);

export default function WhitePaperPage({ onBackHome }) {
  const [activeSection, setActiveSection] = useState(TOC_ITEMS[0].id);
  const [mobileTocOpen, setMobileTocOpen] = useState(false);

  useEffect(() => {
    const html = document.documentElement;
    const previous = html.style.scrollBehavior;
    html.style.scrollBehavior = 'smooth';
    return () => {
      html.style.scrollBehavior = previous;
    };
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        if (visible[0]) {
          setActiveSection(visible[0].target.id);
        }
      },
      {
        rootMargin: '-30% 0px -55% 0px',
        threshold: [0.1, 0.4, 0.7],
      },
    );

    TOC_ITEMS.forEach(({ id }) => {
      const section = document.getElementById(id);
      if (section) observer.observe(section);
    });

    return () => observer.disconnect();
  }, []);

  const handleDownloadPdf = () => {
    window.print();
  };

  const handleNavigateHome = (event) => {
    if (onBackHome) {
      event.preventDefault();
      onBackHome();
    }
  };

  return (
    <div className="min-h-screen bg-[#030608] text-white">
      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }

          body {
            background: white !important;
            color: black !important;
          }

          .print-paper {
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .print-paper h1,
          .print-paper h2,
          .print-paper h3 {
            color: black !important;
          }

          .print-paper p,
          .print-paper li,
          .print-paper td,
          .print-paper th {
            color: #111 !important;
          }

          .print-paper table {
            border-color: #ddd !important;
          }
        }
      `}</style>

      <div className="mx-auto max-w-[1320px] px-6 py-12 lg:py-16">
        <div className="grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="no-print hidden lg:block">
            <div className="sticky top-10 rounded-xl border border-amber-500/20 bg-black/30 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-amber-400 mb-3">Contents</p>
              <nav className="space-y-1">
                {TOC_ITEMS.map((item) => (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    className={`block rounded-md px-2 py-1.5 text-sm transition-colors ${
                      activeSection === item.id
                        ? 'bg-amber-500/15 text-amber-300'
                        : 'text-gray-500 hover:text-white'
                    }`}
                  >
                    {item.label}
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          <main className="print-paper">
            <div className="no-print mb-6 lg:hidden">
              <button
                type="button"
                onClick={() => setMobileTocOpen((prev) => !prev)}
                className="w-full rounded-lg border border-amber-500/30 bg-black/40 px-4 py-3 text-left text-sm text-amber-300 flex items-center justify-between"
              >
                <span>Table of Contents</span>
                {mobileTocOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              {mobileTocOpen && (
                <div className="mt-2 rounded-lg border border-gray-800 bg-black/40 p-3 space-y-1">
                  {TOC_ITEMS.map((item) => (
                    <a
                      key={item.id}
                      href={`#${item.id}`}
                      onClick={() => setMobileTocOpen(false)}
                      className={`block rounded px-2 py-1.5 text-sm ${
                        activeSection === item.id
                          ? 'bg-amber-500/15 text-amber-300'
                          : 'text-gray-500 hover:text-white'
                      }`}
                    >
                      {item.label}
                    </a>
                  ))}
                </div>
              )}
            </div>

            <div className="max-w-3xl mx-auto px-0 sm:px-2 lg:px-6 py-2 sm:py-6">
              <div className="no-print mb-8">
                <a
                  href="/"
                  onClick={handleNavigateHome}
                  className="text-sm text-gray-400 hover:text-white transition-colors"
                >
                  ← Back to Home
                </a>
              </div>

              <header className="border-b border-amber-500/30 pb-8 mb-10">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.25em] text-gray-500 mb-2">STRATIFY</p>
                    <h1 className="text-white text-4xl font-bold mb-2">White Paper</h1>
                    <p className="text-gray-400 text-sm">One Key. Every Market. Total Control.</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadPdf}
                    className="no-print border border-amber-500/50 text-amber-400 px-4 py-2 rounded-lg text-sm hover:bg-amber-500/10 transition-colors"
                  >
                    Download PDF
                  </button>
                </div>
              </header>

              <section id="problem" className="scroll-mt-24 border-b border-amber-500/30 pb-10 mb-10">
                <h2 className="text-white text-2xl font-semibold mb-4">THE PROBLEM</h2>
                <p className={BODY_CLASS}>
                  Modern traders are forced into fragmented workflows. A typical stack includes separate charting tools,
                  broker apps, social feeds, research terminals, alert platforms, and manual spreadsheets. Every extra
                  platform introduces latency, context switching, and execution risk.
                </p>
                <p className={BODY_CLASS}>
                  The result is expensive and inefficient. Most active traders spend hundreds per month and still lack a
                  unified source of truth when markets move quickly.
                </p>
                <ul className="space-y-2">
                  <AMBER_BULLET>Charts and technical tools with separate subscriptions.</AMBER_BULLET>
                  <AMBER_BULLET>Disconnected broker execution and portfolio visibility.</AMBER_BULLET>
                  <AMBER_BULLET>Manual monitoring across X, Reddit, and financial news.</AMBER_BULLET>
                  <AMBER_BULLET>No single AI analyst connected to live strategy context.</AMBER_BULLET>
                </ul>
              </section>

              <section id="solution" className="scroll-mt-24 border-b border-amber-500/30 pb-10 mb-10">
                <h2 className="text-white text-2xl font-semibold mb-4">THE SOLUTION</h2>
                <h3 className="text-amber-400 text-xl font-semibold mb-3">One Platform. One Key.</h3>
                <p className={BODY_CLASS}>
                  Stratify consolidates the full trading workflow into one secure operating system. With a single API key,
                  users connect research, strategy generation, market intelligence, broker execution, alerts, and
                  performance tracking in one interface.
                </p>
                <p className={BODY_CLASS}>
                  Instead of stitching together tools, Stratify creates an integrated stack for active decision-making,
                  enabling faster analysis and cleaner execution with lower operational overhead.
                </p>
              </section>

              <section id="how-it-works" className="scroll-mt-24 border-b border-amber-500/30 pb-10 mb-10">
                <h2 className="text-white text-2xl font-semibold mb-4">HOW IT WORKS</h2>
                <div className="space-y-5">
                  {[
                    {
                      step: '01',
                      title: 'Sign up and receive your Stratify key',
                      text: 'Create your account and unlock platform access instantly.',
                    },
                    {
                      step: '02',
                      title: 'Connect broker infrastructure',
                      text: 'Securely connect Alpaca, Tradier, Webull, and additional broker integrations.',
                    },
                    {
                      step: '03',
                      title: 'Configure dashboard intelligence',
                      text: 'Customize Terminal, War Room, watchlists, and analytics around your process.',
                    },
                    {
                      step: '04',
                      title: 'Deploy Sophia AI workflows',
                      text: 'Generate and refine strategies with context-aware AI support and live market inputs.',
                    },
                    {
                      step: '05',
                      title: 'Execute and monitor with confidence',
                      text: 'Move from insight to action with integrated risk controls and post-trade review.',
                    },
                  ].map((item) => (
                    <div key={item.step} className="rounded-xl border border-gray-800 bg-black/30 p-4">
                      <p className="text-amber-400 text-xs tracking-[0.2em] mb-1">STEP {item.step}</p>
                      <p className="text-white text-lg font-medium mb-1">{item.title}</p>
                      <p className="text-gray-400 text-sm">{item.text}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section id="core-features" className="scroll-mt-24 border-b border-amber-500/30 pb-10 mb-10">
                <h2 className="text-white text-2xl font-semibold mb-4">CORE FEATURES</h2>
                <h3 className="text-amber-400 text-xl font-semibold mb-3">Everything required for modern execution</h3>
                <ul className="space-y-3">
                  <AMBER_BULLET>
                    <strong className="text-white">War Room:</strong> Real-time institutional intelligence, web-validated
                    research scans, and catalyst monitoring.
                  </AMBER_BULLET>
                  <AMBER_BULLET>
                    <strong className="text-white">Sophia AI:</strong> Portfolio-aware strategy analyst for setup validation,
                    refinement, and execution confidence.
                  </AMBER_BULLET>
                  <AMBER_BULLET>
                    <strong className="text-white">Strategy Builder:</strong> AI-generated strategy outputs with trade setup
                    structures and activation workflows.
                  </AMBER_BULLET>
                  <AMBER_BULLET>
                    <strong className="text-white">Live Terminal:</strong> Unified watchlists, execution tools, and streaming
                    market context.
                  </AMBER_BULLET>
                  <AMBER_BULLET>
                    <strong className="text-white">Smart Alerts:</strong> Price, volatility, and sentiment triggers delivered
                    in real time.
                  </AMBER_BULLET>
                  <AMBER_BULLET>
                    <strong className="text-white">Social Sentiment:</strong> Signal extraction from X and Reddit with
                    AI-filtered scoring.
                  </AMBER_BULLET>
                </ul>
              </section>

              <section id="under-the-hood" className="scroll-mt-24 border-b border-amber-500/30 pb-10 mb-10">
                <h2 className="text-white text-2xl font-semibold mb-4">WHAT'S UNDER THE HOOD</h2>
                <p className={BODY_CLASS}>
                  Stratify combines a production-grade data and AI stack into a trader-friendly interface. Every service is
                  abstracted so users get enterprise capability without enterprise complexity.
                </p>
                <ul className="space-y-3">
                  <AMBER_BULLET>
                    <strong className="text-white">Frontend:</strong> React + Vite + Tailwind for high-speed UI rendering.
                  </AMBER_BULLET>
                  <AMBER_BULLET>
                    <strong className="text-white">Auth & Data:</strong> Supabase for account security, row-level storage,
                    and synchronized strategy persistence.
                  </AMBER_BULLET>
                  <AMBER_BULLET>
                    <strong className="text-white">Market Feeds:</strong> Alpaca SIP data and websocket stream handling for
                    low-latency updates.
                  </AMBER_BULLET>
                  <AMBER_BULLET>
                    <strong className="text-white">AI Reasoning:</strong> Claude-powered strategy generation and market
                    analysis workflows.
                  </AMBER_BULLET>
                  <AMBER_BULLET>
                    <strong className="text-white">Payments:</strong> Stripe billing with tiered plans and secure checkout.
                  </AMBER_BULLET>
                  <AMBER_BULLET>
                    <strong className="text-white">Deployment:</strong> Vercel + Railway architecture for scalable edge
                    delivery and realtime services.
                  </AMBER_BULLET>
                </ul>
              </section>

              <section id="browser-extension" className="scroll-mt-24 border-b border-amber-500/30 pb-10 mb-10">
                <h2 className="text-white text-2xl font-semibold mb-4">BROWSER EXTENSION</h2>
                <p className={BODY_CLASS}>
                  The Stratify browser extension brings market intelligence directly into your browsing workflow.
                  Highlight a ticker, capture a headline, or send context from any page into War Room and Sophia for
                  immediate analysis.
                </p>
                <p className={BODY_CLASS}>
                  This extension layer reduces switching cost and ensures no relevant catalyst is lost while moving between
                  research, charting, and execution environments.
                </p>
              </section>

              <section id="pricing" className="scroll-mt-24 border-b border-amber-500/30 pb-10 mb-10">
                <h2 className="text-white text-2xl font-semibold mb-4">PRICING</h2>
                <div className="overflow-x-auto border border-gray-800 rounded-xl">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-black/50 text-gray-300">
                      <tr>
                        <th className="px-4 py-3 font-medium">Plan</th>
                        <th className="px-4 py-3 font-medium">Price</th>
                        <th className="px-4 py-3 font-medium">Included</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      <tr>
                        <td className="px-4 py-3 text-white">Starter</td>
                        <td className="px-4 py-3 text-gray-300">Free</td>
                        <td className="px-4 py-3 text-gray-400">Delayed data, 5 scans/day, basic watchlist, 1 strategy</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-white">Pro</td>
                        <td className="px-4 py-3 text-gray-300">$29/mo</td>
                        <td className="px-4 py-3 text-gray-400">Live data, Sophia AI, alerts, 1 broker, 50 scans/day</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-white">Elite</td>
                        <td className="px-4 py-3 text-gray-300">$99/mo</td>
                        <td className="px-4 py-3 text-gray-400">Unlimited scans, sentiment tools, 3 brokers, custom layouts</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-white">Institutional</td>
                        <td className="px-4 py-3 text-gray-300">$299/mo</td>
                        <td className="px-4 py-3 text-gray-400">Team controls, dedicated support, unlimited everything</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>

              <section id="security" className="scroll-mt-24 border-b border-amber-500/30 pb-10 mb-10">
                <h2 className="text-white text-2xl font-semibold mb-4">SECURITY & TRUST</h2>
                <div className="rounded-xl border border-gray-800 bg-black/35 p-5 space-y-3">
                  <p className="text-gray-300">AES-256 encrypted broker credentials</p>
                  <p className="text-gray-300">Hashed API keys, never stored in plaintext</p>
                  <p className="text-gray-300">HTTPS/TLS encryption for all transmitted data</p>
                  <p className="text-gray-300">Row-level security and strict access isolation</p>
                  <p className="text-gray-300">No user data resale policy</p>
                </div>
              </section>

              <section id="faq" className="scroll-mt-24 border-b border-amber-500/30 pb-10 mb-10">
                <h2 className="text-white text-2xl font-semibold mb-4">FAQ</h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-amber-400 text-xl font-semibold mb-3">What is a Stratify API key?</h3>
                    <p className={BODY_CLASS}>
                      Your Stratify API key is the single credential that powers access to platform modules and connected
                      services.
                    </p>
                  </div>
                  <div>
                    <h3 className="text-amber-400 text-xl font-semibold mb-3">Do I need other subscriptions?</h3>
                    <p className={BODY_CLASS}>
                      No. Stratify is designed to consolidate the tools most active traders currently pay for separately.
                    </p>
                  </div>
                  <div>
                    <h3 className="text-amber-400 text-xl font-semibold mb-3">Is my broker account safe?</h3>
                    <p className={BODY_CLASS}>
                      Yes. Credentials are encrypted and broker connectivity follows strict security controls.
                    </p>
                  </div>
                  <div>
                    <h3 className="text-amber-400 text-xl font-semibold mb-3">Can I use Stratify without a broker?</h3>
                    <p className={BODY_CLASS}>
                      Yes. You can still run scans, build strategies, and use research tools before connecting execution.
                    </p>
                  </div>
                  <div>
                    <h3 className="text-amber-400 text-xl font-semibold mb-3">What makes Sophia different?</h3>
                    <p className={BODY_CLASS}>
                      Sophia is embedded in the live trading stack with direct strategy context, not a standalone chat
                      assistant.
                    </p>
                  </div>
                </div>
              </section>

              <section id="final-cta" className="scroll-mt-24 pb-4">
                <h2 className="text-white text-2xl font-semibold mb-4">READY TO TRADE SMARTER?</h2>
                <p className={BODY_CLASS}>Get your Stratify API key and take control.</p>
                <a
                  href="/"
                  onClick={handleNavigateHome}
                  className="inline-flex items-center gap-2 bg-amber-500 text-black font-bold px-6 py-3 rounded-xl hover:bg-amber-600 transition-colors no-print"
                >
                  Start Free — No Credit Card Required
                </a>
                <div className="mt-6">
                  <a
                    href="https://stratify.associates"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-amber-400 hover:underline"
                  >
                    stratify.associates
                    <ExternalLink size={14} />
                  </a>
                </div>
              </section>

              <footer className="mt-14 pt-8 border-t border-gray-800 text-sm text-gray-500">
                <div className="flex flex-wrap items-center gap-4">
                  <span>© {new Date().getFullYear()} Stratify. All rights reserved.</span>
                  <a href="/whitepaper" className="hover:text-amber-400 transition-colors">
                    White Paper
                  </a>
                  <a href="/privacy" className="hover:text-amber-400 transition-colors">
                    Privacy
                  </a>
                  <a href="/terms" className="hover:text-amber-400 transition-colors">
                    Terms
                  </a>
                </div>
              </footer>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
