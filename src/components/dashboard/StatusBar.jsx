import { useState, useEffect, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import MarketStatusIndicator from './MarketStatusIndicator';
import { getMarketStatus } from '../../lib/marketHours';

const EASTERN_TIMEZONE = 'America/New_York';
const OPEN_SECONDS = 9 * 3600 + 30 * 60;
const CLOSE_SECONDS = 16 * 3600;
const PRE_OPEN_START = OPEN_SECONDS - 3600;
const PRE_CLOSE_START = CLOSE_SECONDS - 3600;

const etFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: EASTERN_TIMEZONE,
  hour12: false,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

const getEtSecondsFromMidnight = (date = new Date()) => {
  const parts = etFormatter.formatToParts(date);
  const getPart = (type) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  const hours = getPart('hour') % 24;
  return hours * 3600 + getPart('minute') * 60 + getPart('second');
};

const formatCountdown = (totalSeconds) => {
  const clamped = Math.max(0, totalSeconds);
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

export default function StatusBar({ connectionStatus, theme, themeClasses, onOpenNewsletter }) {
  const [now, setNow] = useState(() => new Date());
  
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  const currentTime = useMemo(() => {
    return now.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  }, [now]);

  const countdownState = useMemo(() => {
    const marketStatus = getMarketStatus(now);
    if (marketStatus === 'Weekend' || marketStatus === 'Holiday') {
      return { mode: 'normal' };
    }

    const secondsFromMidnight = getEtSecondsFromMidnight(now);
    if (secondsFromMidnight >= PRE_OPEN_START && secondsFromMidnight < OPEN_SECONDS) {
      return { mode: 'open', remaining: OPEN_SECONDS - secondsFromMidnight };
    }

    if (secondsFromMidnight >= PRE_CLOSE_START && secondsFromMidnight < CLOSE_SECONDS) {
      return { mode: 'close', remaining: CLOSE_SECONDS - secondsFromMidnight };
    }

    return { mode: 'normal' };
  }, [now]);

  const countdownConfig = {
    open: {
      label: '🟢 OPENING BELL',
      text: `MARKET OPENS IN ${formatCountdown(countdownState.remaining ?? 0)}`,
      labelColor: 'text-emerald-300/80',
      textColor: 'text-emerald-400',
      glow: 'drop-shadow-[0_0_10px_rgba(16,185,129,0.7)]',
    },
    close: {
      label: '🔴 CLOSING BELL',
      text: `MARKET CLOSES IN ${formatCountdown(countdownState.remaining ?? 0)}`,
      labelColor: 'text-red-300/80',
      textColor: 'text-red-400',
      glow: 'drop-shadow-[0_0_10px_rgba(239,68,68,0.7)]',
    },
  };

  const statusConfig = {
    connected: { color: 'bg-emerald-500', textColor: 'text-emerald-400' },
    connecting: { color: 'bg-yellow-500', textColor: 'text-yellow-400' },
    disconnected: { color: 'bg-red-500', textColor: 'text-red-400' },
  };

  const status = statusConfig[connectionStatus] || statusConfig.disconnected;

  return (
    <div className={`h-7 flex items-center justify-between px-4 ${themeClasses.surfaceElevated} border-t ${themeClasses.border}`}>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${status.color} ${connectionStatus === 'connecting' ? 'animate-pulse' : ''}`} />
          <button 
            onClick={onOpenNewsletter}
            className="text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1.5 newsletter-glow"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Newsletter
          </button>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <span className={`text-xs ${themeClasses.textMuted} flex items-center gap-1`}>
          <kbd className="px-1.5 py-0.5 bg-[#1e1e2d] rounded text-[10px] font-mono text-white/50 border border-[#2a2a3d]">⌘K</kbd>
          <span className="text-gray-600">Command palette</span>
        </span>
        <MarketStatusIndicator compact />
        <AnimatePresence mode="wait" initial={false}>
          {countdownState.mode === 'normal' ? (
            <motion.span
              key="clock-normal"
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -3 }}
              transition={{ duration: 0.2 }}
              className={`text-xs ${themeClasses.textMuted} whitespace-nowrap`}
            >
              {currentTime}
            </motion.span>
          ) : (
            <motion.div
              key={`clock-${countdownState.mode}`}
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -3 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col items-start leading-none"
            >
              <span className={`text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap ${countdownConfig[countdownState.mode].labelColor}`}>
                {countdownConfig[countdownState.mode].label}
              </span>
              <span
                className={`text-lg font-semibold font-mono whitespace-nowrap animate-pulse ${countdownConfig[countdownState.mode].textColor} ${countdownConfig[countdownState.mode].glow}`}
              >
                {countdownConfig[countdownState.mode].text}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
        <span className={`text-xs ${themeClasses.textMuted}`}>Build 1.0.0</span>
        <span className={`text-xs ${themeClasses.textMuted}`}>MARKET DATA POWERED BY <a href="https://alpaca.markets" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">ALPACA</a></span>
      </div>
    </div>
  );
}
