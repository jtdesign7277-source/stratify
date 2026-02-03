import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Sparkles, Zap, Play, Check, Loader2, Brain, LineChart, Code, Rocket, Shield, BarChart3 } from 'lucide-react';

const LandingPage = ({ onEnter }) => {
  const [email, setEmail] = useState('');
  const [showIntro, setShowIntro] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null);
  const introVideoRef = useRef(null);

  const bgVideoSrc = '/runway-bg.mp4';
  const introVideoSrc = '/stratify-the-drop.mp4';
  const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzJnY1_65FEg5yqZgMRKwxRChY1nMDqZlErSJqBMfa2JOLLp0clT4IuD7gKvZc8qCIziw/exec';

  const handleWaitlistSubmit = async (e) => {
    e.preventDefault();
    if (!email || !email.includes('@')) return;
    setSubmitStatus('loading');
    try {
      await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email,
          timestamp: new Date().toISOString(),
          source: window.location.href
        })
      });
      setSubmitStatus('success');
      setEmail('');
      setTimeout(() => setSubmitStatus(null), 3000);
    } catch (error) {
      setSubmitStatus('error');
      setTimeout(() => setSubmitStatus(null), 3000);
    }
  };

  const handleExperienceClick = () => {
    setShowIntro(true);
    setTimeout(() => {
      if (introVideoRef.current) introVideoRef.current.play();
    }, 100);
  };

  const handleIntroEnd = () => onEnter && onEnter();
  const handleSkipIntro = () => onEnter && onEnter();

  return (
    <div className="relative w-full overflow-x-hidden bg-[#060d18]">
      
      {/* Intro Video Overlay */}
      <AnimatePresence>
        {showIntro && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black flex items-center justify-center"
          >
            <video
              ref={introVideoRef}
              src={introVideoSrc}
              className="w-full h-full object-cover"
              onEnded={handleIntroEnd}
              playsInline
            />
            <button
              onClick={handleSkipIntro}
              className="absolute bottom-8 right-8 px-4 py-2 text-white/50 hover:text-white text-sm transition-colors"
            >
              Skip →
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Background Video - Hero Only */}
      <div className="absolute inset-0 h-screen">
        <video
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: 'brightness(0.6)' }}
        >
          <source src={bgVideoSrc} type="video/mp4" />
        </video>
        <div 
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at center top, rgba(6, 13, 24, 0.3) 0%, rgba(6, 13, 24, 0.95) 100%)',
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10">
        
        {/* Navigation */}
        <nav className="flex items-center justify-between px-8 py-6">
          <span className="text-white text-xl font-semibold tracking-tight">Stratify</span>
          <div className="flex items-center gap-8">
            <a href="#how-it-works" className="text-white/60 hover:text-white transition-colors text-sm">How It Works</a>
            <a href="#pricing" className="text-white/60 hover:text-white transition-colors text-sm">Pricing</a>
            <button 
              onClick={() => onEnter && onEnter()}
              className="px-5 py-2.5 rounded-full border border-white/20 text-white text-sm hover:bg-white/5 transition-colors"
            >
              Get Started Free
            </button>
          </div>
        </nav>

        {/* ============ HERO SECTION ============ */}
        <div className="flex flex-col items-center justify-center px-8 pt-20 pb-24 min-h-screen">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-6xl md:text-7xl text-center font-light text-white mb-6"
          >
            A <span className="italic text-white/90">smarter way</span>
            <br />
            to trade
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-white/50 text-lg md:text-xl text-center max-w-2xl mb-10 font-light"
          >
            Unify strategies across technical analysis, sentiment, and
            fundamentals. Let AI surface the signals that matter.
          </motion.p>

          {/* Email Signup */}
          <motion.form
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            onSubmit={handleWaitlistSubmit}
            className="flex items-center gap-3 mb-4"
          >
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              disabled={submitStatus === 'loading' || submitStatus === 'success'}
              className="w-80 px-5 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50 transition-colors disabled:opacity-50"
            />
            <button 
              type="submit"
              disabled={submitStatus === 'loading' || submitStatus === 'success' || !email}
              className={`flex items-center gap-2 px-6 py-3.5 rounded-xl font-medium transition-all shadow-lg ${
                submitStatus === 'success'
                  ? 'bg-green-500 text-white shadow-green-500/25'
                  : 'bg-gradient-to-r from-blue-600 to-blue-500 text-white hover:from-blue-500 hover:to-blue-400 shadow-blue-500/25'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {submitStatus === 'loading' ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Joining...</>
              ) : submitStatus === 'success' ? (
                <><Check className="w-4 h-4" />You're in!</>
              ) : (
                <>Join Waitlist<ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </motion.form>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex items-center gap-2 text-white/40 text-sm mb-8"
          >
            <Sparkles className="w-4 h-4 text-yellow-400/70" />
            Join 501+ traders already on the waitlist
          </motion.p>

          <div className="w-96 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mb-8" />

          {/* Experience Button */}
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            onClick={handleExperienceClick}
            className="group relative mb-8"
          >
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-2xl opacity-30 group-hover:opacity-50 blur-lg transition-opacity" />
            <div className="relative flex items-center gap-4 px-8 py-4 rounded-xl bg-gradient-to-r from-blue-600/20 to-cyan-600/20 border border-blue-500/40 group-hover:border-blue-400/60 transition-all">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
                <Play className="w-5 h-5 text-white ml-0.5" fill="white" strokeWidth={0} />
              </div>
              <div className="flex flex-col items-start">
                <span className="text-white font-medium tracking-wide">Experience Stratify</span>
                <span className="text-blue-400/70 text-xs tracking-wider">Watch the intro</span>
              </div>
            </div>
          </motion.button>

          {/* Continue as Guest */}
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            onClick={() => onEnter && onEnter()}
            className="flex items-center gap-2 px-8 py-3 rounded-xl border border-white/10 text-white/80 hover:bg-white/5 hover:border-white/20 transition-all mb-3"
          >
            Continue as Guest
            <ArrowRight className="w-4 h-4" />
          </motion.button>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="text-white/30 text-sm mb-16"
          >
            Explore the full app without signing up
          </motion.p>

        </div>

        {/* ============ INFO SECTION ============ */}
        <motion.section
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="relative px-8 pb-24 pt-6 bg-[#060d18]"
        >
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <p className="text-white/30 text-xs tracking-[0.3em] uppercase mb-4">
                The Signal Stack
              </p>
              <h2 className="text-3xl md:text-4xl font-light text-white mb-4">
                Turn market noise into deployable strategies
              </h2>
              <p className="text-white/50 text-base md:text-lg max-w-2xl mx-auto">
                Stratify blends technicals, sentiment, and fundamentals into a single workflow so you can
                discover, validate, and deploy faster.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3 mb-14">
              {[
                {
                  title: 'Signal Fusion',
                  body: 'Combine technical setups with macro and sentiment context in one view.',
                  icon: <LineChart className="w-5 h-5 text-blue-400" strokeWidth={1.5} />
                },
                {
                  title: 'AI Strategy Builder',
                  body: 'Describe your edge and get production-ready code in seconds.',
                  icon: <Sparkles className="w-5 h-5 text-cyan-400" strokeWidth={1.5} />
                },
                {
                  title: 'Always-On Execution',
                  body: 'Deploy to paper or live trading with safety checks baked in.',
                  icon: <Shield className="w-5 h-5 text-purple-400" strokeWidth={1.5} />
                }
              ].map((item) => (
                <div
                  key={item.title}
                  className="p-6 rounded-2xl border border-white/10 bg-white/[0.02]"
                >
                  <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center mb-4">
                    {item.icon}
                  </div>
                  <h3 className="text-white text-lg font-medium mb-2">{item.title}</h3>
                  <p className="text-white/50 text-sm leading-relaxed">{item.body}</p>
                </div>
              ))}
            </div>

            {/* Stats below video */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="grid grid-cols-1 sm:grid-cols-2 gap-8 max-w-2xl mx-auto"
            >
              <div className="flex flex-col items-center justify-center text-center gap-2 rounded-2xl border border-white/10 bg-white/[0.02] px-8 py-6">
                <div className="text-4xl font-light bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                  501+
                </div>
                <div className="text-white/40 text-sm tracking-wide">Beta Waitlist</div>
              </div>
              <div className="flex flex-col items-center justify-center text-center gap-2 rounded-2xl border border-white/10 bg-white/[0.02] px-8 py-6">
                <div className="flex items-center justify-center gap-2 text-4xl font-light text-purple-400">
                  <Zap className="w-6 h-6" strokeWidth={1.5} />
                  Instant
                </div>
                <div className="text-white/40 text-sm tracking-wide">Strategy Deployment</div>
              </div>
            </motion.div>
          </div>
        </motion.section>

        {/* ============ INTEGRATIONS SECTION ============ */}
        <motion.section
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="py-20 px-8 bg-[#060d18]"
        >
          <div className="max-w-5xl mx-auto text-center">
            <p className="text-white/30 text-xs tracking-[0.3em] uppercase mb-10">
              Powered By Industry Leaders
            </p>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                {
                  name: 'Alpaca',
                  logo: '/logos/alpaca.png'
                },
                {
                  name: 'Anthropic',
                  logo: '/logos/anthropic.svg'
                },
                {
                  name: 'Vercel',
                  logo: 'https://assets.vercel.com/image/upload/front/assets/design/vercel-triangle-black.svg'
                },
                {
                  name: 'Railway',
                  logo: '/logos/railway.svg'
                }
              ].map((partner) => (
                <div
                  key={partner.name}
                  className="group flex items-center justify-center gap-4 rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-5 text-white/70 transition-all hover:border-white/20 hover:bg-white/[0.04]"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
                    <img
                      src={partner.logo}
                      alt={partner.name}
                      className="h-6 w-6 object-contain opacity-80 transition-opacity group-hover:opacity-100"
                      loading="lazy"
                    />
                  </div>
                  <span className="text-sm font-semibold tracking-[0.1em] uppercase text-white/60 group-hover:text-white">
                    {partner.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* ============ HOW IT WORKS SECTION ============ */}
        <motion.section
          id="how-it-works"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="py-24 px-8 bg-gradient-to-b from-[#060d18] to-[#0a1628]"
        >
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-light text-white mb-4">How It Works</h2>
              <p className="text-white/50 text-lg max-w-2xl mx-auto">
                From idea to execution in three simple steps
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8">
              {/* Step 1 */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="relative p-8 rounded-2xl bg-white/[0.02] border border-white/10 hover:border-blue-500/30 transition-colors"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/20 border border-blue-500/30 flex items-center justify-center mb-6">
                  <Brain className="w-6 h-6 text-blue-400" strokeWidth={1.5} />
                </div>
                <div className="text-blue-400/50 text-sm font-medium mb-2">Step 1</div>
                <h3 className="text-xl font-medium text-white mb-3">Describe Your Strategy</h3>
                <p className="text-white/50 text-sm leading-relaxed">
                  Tell Atlas AI what you want in plain English. "Buy $NVDA when RSI drops below 30" — that's all it takes.
                </p>
              </motion.div>
              
              {/* Step 2 */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="relative p-8 rounded-2xl bg-white/[0.02] border border-white/10 hover:border-cyan-500/30 transition-colors"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-cyan-600/20 border border-cyan-500/30 flex items-center justify-center mb-6">
                  <Code className="w-6 h-6 text-cyan-400" strokeWidth={1.5} />
                </div>
                <div className="text-cyan-400/50 text-sm font-medium mb-2">Step 2</div>
                <h3 className="text-xl font-medium text-white mb-3">AI Generates Code</h3>
                <p className="text-white/50 text-sm leading-relaxed">
                  Claude instantly writes production-ready Python code. Review it, tweak it, or run it as-is.
                </p>
              </motion.div>
              
              {/* Step 3 */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="relative p-8 rounded-2xl bg-white/[0.02] border border-white/10 hover:border-purple-500/30 transition-colors"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-600/20 border border-purple-500/30 flex items-center justify-center mb-6">
                  <Zap className="w-6 h-6 text-purple-400" strokeWidth={1.5} />
                </div>
                <div className="text-purple-400/50 text-sm font-medium mb-2">Step 3</div>
                <h3 className="text-xl font-medium text-white mb-3">Backtest & Deploy</h3>
                <p className="text-white/50 text-sm leading-relaxed">
                  Test against historical data, then deploy to paper or live trading with one click via Alpaca.
                </p>
              </motion.div>
            </div>
          </div>
        </motion.section>

        {/* ============ PRICING SECTION ============ */}
        <motion.section
          id="pricing"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="py-24 px-8 bg-[#0a1628]"
        >
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-light text-white mb-4">Simple Pricing</h2>
              <p className="text-white/50 text-lg max-w-2xl mx-auto">
                Start free, upgrade when you're ready
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8">
              {/* Free Tier */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="p-8 rounded-2xl bg-white/[0.02] border border-white/10"
              >
                <div className="mb-6">
                  <h3 className="text-lg font-medium text-white mb-1">Free</h3>
                  <p className="text-white/40 text-sm">Perfect for getting started</p>
                </div>
                <div className="mb-6">
                  <span className="text-4xl font-light text-white">$0</span>
                  <span className="text-white/40 text-sm">/month</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {['3 strategies', 'Paper trading only', 'Basic backtesting', 'Community support'].map((feature, i) => (
                    <li key={i} className="flex items-center gap-3 text-white/60 text-sm">
                      <Check className="w-4 h-4 text-blue-400" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <button 
                  onClick={() => onEnter && onEnter()}
                  className="w-full py-3 rounded-xl border border-white/20 text-white hover:bg-white/5 transition-colors"
                >
                  Get Started
                </button>
              </motion.div>
              
              {/* Pro Tier */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="relative p-8 rounded-2xl bg-gradient-to-b from-blue-500/10 to-transparent border border-blue-500/30"
              >
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-blue-500 text-white text-xs font-medium">
                  Most Popular
                </div>
                <div className="mb-6">
                  <h3 className="text-lg font-medium text-white mb-1">Pro</h3>
                  <p className="text-white/40 text-sm">For serious traders</p>
                </div>
                <div className="mb-6">
                  <span className="text-4xl font-light text-white">$29</span>
                  <span className="text-white/40 text-sm">/month</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {['Unlimited strategies', 'Live trading', 'Advanced backtesting', 'Real-time alerts', 'Priority support'].map((feature, i) => (
                    <li key={i} className="flex items-center gap-3 text-white/60 text-sm">
                      <Check className="w-4 h-4 text-blue-400" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <button className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 text-white font-medium hover:from-blue-500 hover:to-blue-400 transition-all shadow-lg shadow-blue-500/25">
                  Upgrade to Pro
                </button>
              </motion.div>
              
              {/* Enterprise Tier */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="p-8 rounded-2xl bg-white/[0.02] border border-white/10"
              >
                <div className="mb-6">
                  <h3 className="text-lg font-medium text-white mb-1">Enterprise</h3>
                  <p className="text-white/40 text-sm">For teams & funds</p>
                </div>
                <div className="mb-6">
                  <span className="text-4xl font-light text-white">Custom</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {['Everything in Pro', 'Team collaboration', 'Custom integrations', 'Dedicated account manager', 'SLA guarantee'].map((feature, i) => (
                    <li key={i} className="flex items-center gap-3 text-white/60 text-sm">
                      <Check className="w-4 h-4 text-purple-400" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <button className="w-full py-3 rounded-xl border border-white/20 text-white hover:bg-white/5 transition-colors">
                  Contact Sales
                </button>
              </motion.div>
            </div>
          </div>
        </motion.section>

        {/* ============ FOOTER ============ */}
        <footer className="py-12 px-8 bg-[#060d18] border-t border-white/5">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <span className="text-white/30 text-sm">© 2026 Stratify. All rights reserved.</span>
            <div className="flex items-center gap-6">
              <a href="#" className="text-white/30 hover:text-white/60 text-sm transition-colors">Terms</a>
              <a href="#" className="text-white/30 hover:text-white/60 text-sm transition-colors">Privacy</a>
              <a href="#" className="text-white/30 hover:text-white/60 text-sm transition-colors">Contact</a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default LandingPage;
