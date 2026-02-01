import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Sparkles } from 'lucide-react';

const VideoOverlay = ({ onStart }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 flex items-center justify-center"
      style={{
        background: 'radial-gradient(ellipse at center, rgba(6, 13, 24, 0.85) 0%, rgba(6, 13, 24, 0.98) 100%)',
        backdropFilter: 'blur(8px)',
      }}
    >
      {/* Ambient floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-blue-500/30 rounded-full"
            initial={{
              x: Math.random() * window.innerWidth,
              y: Math.random() * window.innerHeight,
            }}
            animate={{
              y: [null, Math.random() * -200],
              opacity: [0, 0.6, 0],
            }}
            transition={{
              duration: 4 + Math.random() * 4,
              repeat: Infinity,
              delay: Math.random() * 3,
              ease: 'easeOut',
            }}
          />
        ))}
      </div>

      {/* Subtle grid lines */}
      <div 
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(59, 130, 246, 0.5) 1px, transparent 1px),
            linear-gradient(90deg, rgba(59, 130, 246, 0.5) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
        }}
      />

      {/* Main content */}
      <div className="relative flex flex-col items-center gap-8">
        {/* Logo/Brand mark */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="flex items-center gap-3 mb-4"
        >
          <div className="relative">
            <motion.div
              animate={{
                boxShadow: [
                  '0 0 20px rgba(59, 130, 246, 0.3)',
                  '0 0 40px rgba(59, 130, 246, 0.5)',
                  '0 0 20px rgba(59, 130, 246, 0.3)',
                ],
              }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center"
            >
              <Sparkles className="w-6 h-6 text-white" strokeWidth={1.5} />
            </motion.div>
          </div>
          <span className="text-2xl font-light tracking-wider text-white/90">STRATIFY</span>
        </motion.div>

        {/* Tagline */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="text-white/50 text-sm tracking-widest uppercase mb-2"
        >
          AI-Powered Trading Intelligence
        </motion.p>

        {/* Main CTA Button */}
        <motion.button
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          onHoverStart={() => setIsHovered(true)}
          onHoverEnd={() => setIsHovered(false)}
          onClick={onStart}
          className="relative group cursor-pointer"
        >
          {/* Outer glow ring */}
          <motion.div
            className="absolute -inset-4 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            animate={{
              boxShadow: isHovered
                ? '0 0 60px rgba(59, 130, 246, 0.4)'
                : '0 0 30px rgba(59, 130, 246, 0.2)',
            }}
          />

          {/* Pulsing ring */}
          <motion.div
            className="absolute -inset-2 rounded-full border border-blue-500/30"
            animate={{
              scale: [1, 1.15, 1],
              opacity: [0.5, 0, 0.5],
            }}
            transition={{ duration: 2, repeat: Infinity }}
          />

          {/* Button container */}
          <div className="relative flex items-center gap-4 px-8 py-4 rounded-full bg-gradient-to-r from-blue-600/20 to-blue-500/20 border border-blue-500/40 group-hover:border-blue-400/60 group-hover:from-blue-600/30 group-hover:to-blue-500/30 transition-all duration-300">
            {/* Play icon with animation */}
            <motion.div
              animate={isHovered ? { scale: 1.1, x: 2 } : { scale: 1, x: 0 }}
              transition={{ duration: 0.2 }}
              className="relative"
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                <Play className="w-4 h-4 text-white ml-0.5" fill="white" strokeWidth={0} />
              </div>
            </motion.div>

            {/* Text */}
            <div className="flex flex-col items-start">
              <span className="text-white font-medium tracking-wide">Experience Stratify</span>
              <span className="text-blue-400/70 text-xs tracking-wider">Click to begin</span>
            </div>
          </div>
        </motion.button>

        {/* Sound indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.5 }}
          className="flex items-center gap-2 mt-4 text-white/30 text-xs tracking-wide"
        >
          <motion.div
            className="flex items-end gap-0.5 h-3"
            animate={{ opacity: [0.3, 0.7, 0.3] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            {[1, 2, 3, 2, 1].map((height, i) => (
              <motion.div
                key={i}
                className="w-0.5 bg-blue-400/50 rounded-full"
                animate={{ height: [height * 3, height * 6, height * 3] }}
                transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.1 }}
              />
            ))}
          </motion.div>
          <span>Audio enabled</span>
        </motion.div>
      </div>

      {/* Corner accents */}
      <div className="absolute top-8 left-8 w-16 h-16 border-l border-t border-blue-500/20" />
      <div className="absolute top-8 right-8 w-16 h-16 border-r border-t border-blue-500/20" />
      <div className="absolute bottom-8 left-8 w-16 h-16 border-l border-b border-blue-500/20" />
      <div className="absolute bottom-8 right-8 w-16 h-16 border-r border-b border-blue-500/20" />
    </motion.div>
  );
};

export default VideoOverlay;
