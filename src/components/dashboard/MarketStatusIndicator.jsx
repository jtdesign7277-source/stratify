import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, TrendingUp, Moon, Sun, Calendar } from 'lucide-react';

// US Stock Market Holidays 2026
const HOLIDAYS_2026 = {
  '2026-01-01': { name: "New Year's Day", earlyClose: false },
  '2026-01-19': { name: 'MLK Day', earlyClose: false },
  '2026-02-16': { name: "Presidents' Day", earlyClose: false },
  '2026-04-03': { name: 'Good Friday', earlyClose: false },
  '2026-05-25': { name: 'Memorial Day', earlyClose: false },
  '2026-06-19': { name: 'Juneteenth', earlyClose: false },
  '2026-07-03': { name: 'Independence Day (Observed)', earlyClose: false },
  '2026-09-07': { name: 'Labor Day', earlyClose: false },
  '2026-11-26': { name: 'Thanksgiving', earlyClose: false },
  '2026-12-25': { name: 'Christmas', earlyClose: false },
};

const EARLY_CLOSES_2026 = {
  '2026-07-02': { name: 'Independence Day Eve', closeTime: 780 }, // 1 PM ET
  '2026-11-25': { name: 'Thanksgiving Eve', closeTime: 780 },
  '2026-12-24': { name: 'Christmas Eve', closeTime: 780 },
};

// Market hours in minutes from midnight (ET)
const MARKET_HOURS = {
  preMarketOpen: 240,    // 4:00 AM
  regularOpen: 570,      // 9:30 AM
  regularClose: 960,     // 4:00 PM
  afterHoursClose: 1200, // 8:00 PM
};

const getETDate = () => {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
};

const formatDateKey = (date) => {
  return date.toISOString().split('T')[0];
};

const getSecondsFromMidnight = (date) => {
  return date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds();
};

const formatCountdown = (totalSeconds) => {
  if (totalSeconds <= 0) return '0s';
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}h ${mins}m ${secs}s`;
  }
  if (mins > 0) {
    return `${mins}m ${secs}s`;
  }
  return `${secs}s`;
};

const getMarketState = (etDate) => {
  const day = etDate.getDay();
  const seconds = getSecondsFromMidnight(etDate);
  const dateKey = formatDateKey(etDate);
  
  // Convert market hours to seconds
  const preMarketOpenSec = MARKET_HOURS.preMarketOpen * 60;
  const regularOpenSec = MARKET_HOURS.regularOpen * 60;
  const regularCloseSec = MARKET_HOURS.regularClose * 60;
  const afterHoursCloseSec = MARKET_HOURS.afterHoursClose * 60;
  
  // Check if it's a holiday
  if (HOLIDAYS_2026[dateKey]) {
    return {
      status: 'closed',
      label: HOLIDAYS_2026[dateKey].name,
      color: 'gray',
      nextEvent: 'Market reopens next trading day',
      countdown: null,
    };
  }
  
  // Weekend check
  if (day === 0 || day === 6) {
    const isToday = day === 0 ? 'Sunday' : 'Saturday';
    return {
      status: 'closed',
      label: `Weekend - ${isToday}`,
      color: 'gray',
      nextEvent: 'Market opens Monday',
      countdown: null,
    };
  }
  
  // Check for early close days
  const earlyClose = EARLY_CLOSES_2026[dateKey];
  const closeTimeSec = earlyClose ? earlyClose.closeTime * 60 : regularCloseSec;
  
  // Pre-market: 4:00 AM - 9:30 AM
  if (seconds >= preMarketOpenSec && seconds < regularOpenSec) {
    const countdown = regularOpenSec - seconds;
    return {
      status: 'premarket',
      label: 'Pre-Market',
      color: 'blue',
      nextEvent: 'Market opens',
      countdown,
    };
  }
  
  // Regular hours: 9:30 AM - 4:00 PM (or early close)
  if (seconds >= regularOpenSec && seconds < closeTimeSec) {
    const countdown = closeTimeSec - seconds;
    return {
      status: 'open',
      label: earlyClose ? `Open (Early Close)` : 'Market Open',
      color: 'green',
      nextEvent: 'Market closes',
      countdown,
    };
  }
  
  // After-hours: 4:00 PM - 8:00 PM (only if not early close day)
  if (!earlyClose && seconds >= regularCloseSec && seconds < afterHoursCloseSec) {
    const countdown = afterHoursCloseSec - seconds;
    return {
      status: 'afterhours',
      label: 'After-Hours',
      color: 'purple',
      nextEvent: 'Session ends',
      countdown,
    };
  }
  
  // Closed (before pre-market or after after-hours)
  let nextOpenSeconds;
  if (seconds < preMarketOpenSec) {
    nextOpenSeconds = preMarketOpenSec - seconds;
  } else {
    // After market close, next pre-market is tomorrow
    nextOpenSeconds = (24 * 3600 - seconds) + preMarketOpenSec;
  }
  
  return {
    status: 'closed',
    label: 'Market Closed',
    color: 'gray',
    nextEvent: 'Pre-market opens',
    countdown: nextOpenSeconds,
  };
};

const statusConfig = {
  open: {
    dotColor: 'bg-emerald-500',
    glowColor: 'shadow-[0_0_12px_rgba(16,185,129,0.5)]',
    textColor: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
    Icon: TrendingUp,
  },
  premarket: {
    dotColor: 'bg-blue-500',
    glowColor: 'shadow-[0_0_12px_rgba(59,130,246,0.5)]',
    textColor: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    Icon: Sun,
  },
  afterhours: {
    dotColor: 'bg-purple-500',
    glowColor: 'shadow-[0_0_12px_rgba(168,85,247,0.5)]',
    textColor: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
    Icon: Moon,
  },
  closed: {
    dotColor: 'bg-gray-500',
    glowColor: '',
    textColor: 'text-gray-400',
    bgColor: 'bg-gray-500/10',
    borderColor: 'border-gray-500/30',
    Icon: Calendar,
  },
};

const MarketStatusIndicator = ({ compact = false }) => {
  const [marketState, setMarketState] = useState(() => getMarketState(getETDate()));
  const [currentTime, setCurrentTime] = useState(getETDate());

  useEffect(() => {
    const interval = setInterval(() => {
      const now = getETDate();
      setCurrentTime(now);
      setMarketState(getMarketState(now));
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);

  const config = statusConfig[marketState.status];
  const Icon = config.Icon;

  const timeDisplay = useMemo(() => {
    return currentTime.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/New_York'
    });
  }, [currentTime]);

  if (compact) {
    return (
      <div className={`flex items-center gap-2 px-2 py-1 rounded-lg ${config.bgColor} border ${config.borderColor}`}>
        <motion.div 
          className={`w-2 h-2 rounded-full ${config.dotColor} ${config.glowColor}`}
          animate={marketState.status === 'open' ? { scale: [1, 1.2, 1] } : {}}
          transition={{ duration: 2, repeat: Infinity }}
        />
        <span className={`text-xs font-medium ${config.textColor}`}>
          {marketState.label}
        </span>
        {marketState.countdown && (
          <span className="text-xs text-white/50">
            {formatCountdown(marketState.countdown)}
          </span>
        )}
      </div>
    );
  }

  return (
    <motion.div 
      className={`bg-[#0b0b0b] border ${config.borderColor} rounded-lg p-3 min-w-[200px]`}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header with status */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <motion.div 
            className={`w-2.5 h-2.5 rounded-full ${config.dotColor} ${config.glowColor}`}
            animate={marketState.status === 'open' ? { scale: [1, 1.3, 1] } : {}}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
          <span className={`text-sm font-semibold ${config.textColor}`}>
            {marketState.label}
          </span>
        </div>
        <Icon className={`w-4 h-4 ${config.textColor}`} strokeWidth={1.5} />
      </div>
      
      {/* Current time */}
      <div className="flex items-center gap-1.5 mb-2">
        <Clock className="w-3 h-3 text-white/50" />
        <span className="text-xs text-gray-400 font-mono">{timeDisplay} ET</span>
      </div>
      
      {/* Countdown to next event */}
      {marketState.countdown && (
        <div className={`flex items-center justify-between px-2 py-1.5 rounded ${config.bgColor}`}>
          <span className="text-[10px] text-white/50 uppercase tracking-wider">
            {marketState.nextEvent}
          </span>
          <AnimatePresence mode="wait">
            <motion.span 
              key={marketState.countdown}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className={`text-xs font-semibold font-mono ${config.textColor}`}
            >
              {formatCountdown(marketState.countdown)}
            </motion.span>
          </AnimatePresence>
        </div>
      )}
      
      {/* Weekend/Holiday message */}
      {!marketState.countdown && marketState.nextEvent && (
        <div className="text-[10px] text-white/50 text-center py-1">
          {marketState.nextEvent}
        </div>
      )}
    </motion.div>
  );
};

export default MarketStatusIndicator;
