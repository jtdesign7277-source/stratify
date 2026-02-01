import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Sparkles, Zap, Play } from 'lucide-react';

const LandingPage = ({ onEnter }) => {
  const [email, setEmail] = useState('');
  const [showIntro, setShowIntro] = useState(false);
  const introVideoRef = useRef(null);

  // Video sources
  const bgVideoSrc = '/runway-bg.mp4';            // Silent background loop
  const introVideoSrc = '/stratify-the-drop.mp4'; // Intro with sound

  const handleExperienceClick = () => {
    setShowIntro(true);
    setTimeout(() => {
      if (introVideoRef.current) {
        introVideoRef.current.play();
      }
    }, 100);
  };

  const handleIntroEnd = () => {
    if (onEnter) onEnter();
  };

  const handleSkipIntro = () => {
    if (onEnter) onEnter();
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#060d18]">
      
      {/* ============ INTRO VIDEO OVERLAY ============ */}
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
            
            {/* Skip button */}
            <button
              onClick={handleSkipIntro}
              className="absolute bottom-8 right-8 px-4 py-2 text-white/50 hover:text-white text-sm transition-colors"
            >
              Skip →
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============ RUNWAY BACKGROUND VIDEO (silent loop) ============ */}
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

      {/* Gradient overlay for readability */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at center top, rgba(6, 13, 24, 0.3) 0%, rgba(6, 13, 24, 0.85) 100%)',
        }}
      />

      {/* ============ MAIN CONTENT ============ */}
      <div className="relative z-10">
        
        {/* Navigation */}
        <nav className="flex items-center justify-between px-8 py-6">
          <span className="text-white text-xl font-semibold tracking-tight">Stratify</span>
          
          <div className="flex items-center gap-8">
            <a href="#features" className="text-white/60 hover:text-white transition-colors text-sm">
              Features
            </a>
            <a href="#pricing" className="text-white/60 hover:text-white transition-colors text-sm">
              Pricing
            </a>
            <a href="#login" className="text-white/60 hover:text-white transition-colors text-sm">
              Log In
            </a>
            <button className="px-5 py-2.5 rounded-full border border-white/20 text-white text-sm hover:bg-white/5 transition-colors">
              Get Started Free
            </button>
          </div>
        </nav>

        {/* Hero Section */}
        <div className="flex flex-col items-center justify-center px-8 pt-20 pb-16">
          
          {/* Main headline */}
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

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-white/50 text-lg md:text-xl text-center max-w-2xl mb-10 font-light"
          >
            Unify strategies across technical analysis, sentiment, and
            fundamentals. Let AI surface the signals that matter.
          </motion.p>

          {/* Email signup */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex items-center gap-3 mb-4"
          >
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="w-80 px-5 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50 transition-colors"
            />
            <button className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 text-white font-medium hover:from-blue-500 hover:to-blue-400 transition-all shadow-lg shadow-blue-500/25">
              Join Waitlist
              <ArrowRight className="w-4 h-4" />
            </button>
          </motion.div>

          {/* Social proof */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex items-center gap-2 text-white/40 text-sm mb-8"
          >
            <Sparkles className="w-4 h-4 text-yellow-400/70" />
            Join 501+ traders already on the waitlist
          </motion.p>

          {/* Divider */}
          <div className="w-96 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mb-8" />

          {/* Experience Stratify Button - Triggers Intro Video */}
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            onClick={handleExperienceClick}
            className="group relative mb-8"
          >
            {/* Glow effect */}
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-2xl opacity-30 group-hover:opacity-50 blur-lg transition-opacity" />
            
            <div className="relative flex items-center gap-4 px-8 py-4 rounded-xl bg-gradient-to-r from-blue-600/20 to-cyan-600/20 border border-blue-500/40 group-hover:border-blue-400/60 transition-all">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/30 group-hover:shadow-blue-500/50 transition-shadow">
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

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="flex items-center gap-20"
          >
            <div className="text-center">
              <div className="text-4xl font-light bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent mb-1">
                501+
              </div>
              <div className="text-white/40 text-sm tracking-wide">Beta Waitlist</div>
            </div>
            
            <div className="text-center">
              <div className="flex items-center gap-2 text-4xl font-light text-purple-400 mb-1">
                <Zap className="w-6 h-6" strokeWidth={1.5} />
                Instant
              </div>
              <div className="text-white/40 text-sm tracking-wide">Strategy Deployment</div>
            </div>
          </motion.div>

          {/* Integrated with */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="mt-20"
          >
            <p className="text-white/20 text-xs tracking-[0.3em] uppercase mb-6">
              Integrated With
            </p>
            <div className="flex items-center gap-8 opacity-40">
              <div className="w-24 h-8 rounded bg-white/10" />
              <div className="w-24 h-8 rounded bg-white/10" />
              <div className="w-24 h-8 rounded bg-white/10" />
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
