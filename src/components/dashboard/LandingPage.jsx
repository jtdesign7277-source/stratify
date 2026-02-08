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

      {/* Background Video - Hero Only - PREMIUM */}
      <div className="absolute inset-0 h-screen overflow-hidden">
        <video
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover scale-105"
          style={{ filter: 'brightness(0.9) saturate(1.3) contrast(1.1)' }}
        >
          <source src={bgVideoSrc} type="video/mp4" />
        </video>
        {/* Lighter gradient overlay */}
        <div 
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at center top, rgba(6, 13, 24, 0.1) 0%, rgba(6, 13, 24, 0.85) 100%)',
          }}
        />
        {/* Animated gradient orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute top-1/3 right-1/4 w-80 h-80 bg-blue-500/15 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute bottom-1/4 left-1/3 w-72 h-72 bg-purple-500/10 rounded-full blur-[80px] animate-pulse" style={{ animationDelay: '2s' }} />
        {/* Subtle grid overlay */}
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
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
            className="text-6xl md:text-8xl text-center font-light text-white mb-6"
            style={{ textShadow: '0 0 80px rgba(16, 185, 129, 0.3), 0 4px 20px rgba(0,0,0,0.5)' }}
          >
            A <span className="italic bg-gradient-to-r from-emerald-300 to-cyan-300 bg-clip-text text-transparent inline-block pt-2 pr-2">smarter way</span>
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
              className={`flex items-center gap-2 px-8 py-4 rounded-xl font-semibold transition-all ${
                submitStatus === 'success'
                  ? 'bg-green-500 text-white shadow-[0_0_40px_rgba(34,197,94,0.4)]'
                  : 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white hover:from-emerald-400 hover:to-cyan-400 shadow-[0_0_40px_rgba(16,185,129,0.4)] hover:shadow-[0_0_60px_rgba(16,185,129,0.5)]'
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

          {/* Experience Button - PREMIUM */}
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            onClick={handleExperienceClick}
            className="group relative mb-8"
          >
            <div className="absolute -inset-2 bg-gradient-to-r from-emerald-500 via-cyan-500 to-emerald-500 rounded-2xl opacity-40 group-hover:opacity-70 blur-xl transition-all duration-500 animate-pulse" />
            <div className="absolute -inset-1 bg-gradient-to-r from-emerald-600 to-cyan-500 rounded-2xl opacity-50 group-hover:opacity-80 blur-md transition-opacity" />
            <div className="relative flex items-center gap-4 px-10 py-5 rounded-xl bg-gradient-to-r from-emerald-600/30 to-cyan-600/30 border border-emerald-400/50 group-hover:border-emerald-300/80 transition-all backdrop-blur-sm">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-400 flex items-center justify-center shadow-lg shadow-emerald-500/50 group-hover:shadow-emerald-400/70 transition-shadow">
                <Play className="w-6 h-6 text-white ml-0.5" fill="white" strokeWidth={0} />
              </div>
              <div className="flex flex-col items-start">
                <span className="text-white font-semibold text-lg tracking-wide">Experience Stratify</span>
                <span className="text-emerald-300/80 text-xs tracking-wider uppercase">Watch the intro</span>
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
                  className="p-6 rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm hover:border-emerald-500/30 hover:bg-white/[0.05] transition-all duration-300 hover:shadow-[0_0_30px_rgba(16,185,129,0.1)]"
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
          className="relative overflow-hidden py-24 px-6 sm:px-8 bg-[#060d18]"
        >
          <div className="pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-blue-500/20 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 translate-x-16 translate-y-10 rounded-full bg-cyan-400/20 blur-3xl" />
          <div className="pointer-events-none absolute top-10 left-0 h-64 w-64 -translate-x-20 rounded-full bg-blue-500/10 blur-[100px]" />

          <div className="relative max-w-6xl mx-auto text-center">
            <p className="text-white/40 text-xs tracking-[0.4em] uppercase">
              Trusted Infrastructure
            </p>
            <h2 className="mt-4 text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight bg-gradient-to-r from-blue-400 via-cyan-300 to-blue-500 bg-clip-text text-transparent">
              Powered By Industry Leaders
            </h2>
            <p className="mt-4 text-white/60 text-base sm:text-lg max-w-2xl mx-auto">
              Built on the same partners powering the most advanced fintech platforms.
            </p>

            <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
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
                <div key={partner.name} className="group relative">
                  <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-r from-blue-500/40 via-cyan-400/40 to-blue-500/40 opacity-40 blur-md transition duration-500 group-hover:opacity-90" />
                  <div className="relative rounded-2xl bg-gradient-to-r from-blue-500/40 via-cyan-400/40 to-blue-500/40 p-[1px] transition duration-500 group-hover:-translate-y-2 group-hover:scale-[1.02] group-hover:shadow-[0_18px_45px_rgba(34,211,238,0.25)]">
                    <div className="flex items-center justify-center gap-5 rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-8 backdrop-blur-xl">
                      <img
                        src={partner.logo}
                        alt={partner.name}
                        className="h-16 w-16 object-contain opacity-90 drop-shadow-[0_0_16px_rgba(59,130,246,0.35)] transition duration-500 group-hover:opacity-100 group-hover:drop-shadow-[0_0_26px_rgba(34,211,238,0.55)]"
                        loading="lazy"
                      />
                      <span className="text-lg font-semibold tracking-[0.18em] uppercase text-white/60 transition duration-500 group-hover:text-white">
                        {partner.name}
                      </span>
                    </div>
                  </div>
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
                  Tell Grok AI what you want in plain English. "Buy $NVDA when RSI drops below 30" — that's all it takes.
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

        {/* ============ AI BACKTEST FEATURE SECTION ============ */}
        <motion.section
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="py-24 px-8 bg-gradient-to-b from-[#0a1628] to-[#060d18] relative overflow-hidden"
        >
          {/* Glow effects */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-[120px] pointer-events-none" />
          
          <div className="max-w-5xl mx-auto relative">
            <div className="text-center mb-12">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/30 mb-6"
              >
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span className="text-purple-300 text-sm font-medium">AI-Powered Backtesting</span>
              </motion.div>
              
              <h2 className="text-4xl md:text-5xl font-light text-white mb-4">
                Test Any Strategy.<br />
                <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">Real Historical Data.</span>
              </h2>
              <p className="text-white/50 text-lg max-w-2xl mx-auto">
                Write your strategy in plain English. Our AI understands it, calculates the indicators, 
                and shows you exactly what would've happened with real market data.
              </p>
            </div>

            {/* Strategy Examples */}
            <div className="grid md:grid-cols-2 gap-6 mb-12">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="p-6 rounded-2xl bg-[#0d1117] border border-white/10"
              >
                <div className="text-purple-400 text-xs font-medium tracking-wider uppercase mb-4">You Write</div>
                <div className="space-y-3 font-mono text-sm">
                  <p className="text-white/80">"Buy when <span className="text-cyan-400">RSI(14) drops below 30</span> AND price is above <span className="text-cyan-400">50-day EMA</span>"</p>
                  <p className="text-white/80">"Sell when <span className="text-pink-400">MACD crosses below signal</span> OR <span className="text-pink-400">5% stop loss</span> hit"</p>
                  <p className="text-white/80">"Position size: <span className="text-emerald-400">100 shares</span>"</p>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="p-6 rounded-2xl bg-[#0d1117] border border-emerald-500/20"
              >
                <div className="text-emerald-400 text-xs font-medium tracking-wider uppercase mb-4">You Get Real Results</div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-light text-white">12</div>
                    <div className="text-white/40 text-xs">Trades</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-light text-emerald-400">67%</div>
                    <div className="text-white/40 text-xs">Win Rate</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-light text-emerald-400">+$4,280</div>
                    <div className="text-white/40 text-xs">Total P&L</div>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-white/10 text-white/40 text-xs">
                  Backtested on 6 months of real TSLA data from Alpaca
                </div>
              </motion.div>
            </div>

            {/* Supported Indicators */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center"
            >
              <p className="text-white/30 text-sm mb-4">AI understands any indicator</p>
              <div className="flex flex-wrap justify-center gap-2">
                {['RSI', 'MACD', 'SMA', 'EMA', 'Bollinger Bands', 'VWAP', 'ATR', 'Stochastic', 'ADX', 'OBV', 'Fibonacci', 'Volume'].map((indicator) => (
                  <span key={indicator} className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-white/60 text-xs">
                    {indicator}
                  </span>
                ))}
              </div>
            </motion.div>
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
