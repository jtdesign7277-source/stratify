import { useCallback, useRef, useState, useEffect, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Play, Radio, Square, Volume2, Zap } from 'lucide-react';
import SophiaCopilot from './SophiaCopilot';
import MarketStatusIndicator from './MarketStatusIndicator';
import { getMarketStatus } from '../../lib/marketHours';
import newsletterData from '../../data/newsletters.json';

const EASTERN_TIMEZONE = 'America/New_York';
const OPEN_SECONDS = 9 * 3600 + 30 * 60;
const CLOSE_SECONDS = 16 * 3600;
const PRE_OPEN_START = OPEN_SECONDS - 3600;
const PRE_CLOSE_START = CLOSE_SECONDS - 3600;
const NEWSLETTER_LAST_VIEWED_KEY = 'lastViewedNewsletter';
const MARKET_INTEL_LAST_VIEWED_KEY = 'lastViewedMarketIntel';
const LEGACY_MARKET_INTEL_LAST_VIEWED_KEY = 'stratify-market-intel-last-viewed';

const toTimestamp = (value) => {
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const resolveStoredTimestamp = (primaryKey, legacyKeys = []) => {
  try {
    const primary = Number(localStorage.getItem(primaryKey) || 0);
    if (Number.isFinite(primary) && primary > 0) return primary;

    for (const legacyKey of legacyKeys) {
      const legacy = Number(localStorage.getItem(legacyKey) || 0);
      if (Number.isFinite(legacy) && legacy > 0) return legacy;
    }
  } catch {}
  return 0;
};

const getLatestNewsletterTimestamp = () => {
  if (!Array.isArray(newsletterData) || newsletterData.length === 0) return 0;
  return newsletterData.reduce((latest, item) => {
    const candidate = Math.max(
      toTimestamp(item?.created_at),
      toTimestamp(item?.published_at),
      toTimestamp(item?.date),
      toTimestamp(item?.id),
    );
    return candidate > latest ? candidate : latest;
  }, 0);
};

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

export default function StatusBar({
  connectionStatus,
  theme,
  themeClasses,
  onOpenNewsletter,
  onOpenMarketIntel,
}) {
  const [now, setNow] = useState(() => new Date());
  const [latestNewsletterTimestamp, setLatestNewsletterTimestamp] = useState(0);
  const [hasUnreadNewsletter, setHasUnreadNewsletter] = useState(false);
  const [latestIntelTimestamp, setLatestIntelTimestamp] = useState(0);
  const [hasUnreadIntel, setHasUnreadIntel] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [hasNewInsight, setHasNewInsight] = useState(false);
  const [sophiaPlaying, setSophiaPlaying] = useState(false);
  const [sophiaLoading, setSophiaLoading] = useState(false);
  const sophiaAudioRef = useRef(null);

  const handlePlaySophia = useCallback(async () => {
    // Stop if already playing (audio or speech synthesis)
    if (sophiaAudioRef.current) {
      sophiaAudioRef.current.pause();
      sophiaAudioRef.current = null;
      setSophiaPlaying(false);
      return;
    }
    if (window.speechSynthesis?.speaking) {
      window.speechSynthesis.cancel();
      setSophiaPlaying(false);
      return;
    }

    setSophiaLoading(true);
    try {
      const res = await fetch('/api/sophia-copilot');
      if (!res.ok) throw new Error('Failed');
      const alerts = await res.json();
      if (!Array.isArray(alerts) || alerts.length === 0) {
        setSophiaLoading(false);
        return;
      }

      // Check for pre-generated audio URL
      const cachedAudio = alerts.find((a) => a.audio_url)?.audio_url;

      if (cachedAudio) {
        // Instant playback from cached audio
        const audio = new Audio(cachedAudio);
        sophiaAudioRef.current = audio;
        audio.addEventListener('play', () => setSophiaPlaying(true));
        audio.addEventListener('ended', () => { setSophiaPlaying(false); sophiaAudioRef.current = null; });
        audio.addEventListener('pause', () => setSophiaPlaying(false));
        audio.addEventListener('error', () => { setSophiaPlaying(false); sophiaAudioRef.current = null; });
        setSophiaLoading(false);
        await audio.play();
      } else {
        // Instant fallback: browser speech synthesis (no network call)
        const text = alerts
          .slice(0, 3)
          .map((a) => `${a.symbol}: ${a.message}`)
          .join('. ')
          .slice(0, 500);

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        // Try to pick a good female voice
        const voices = window.speechSynthesis.getVoices();
        const preferred = voices.find((v) => v.name.includes('Samantha') || v.name.includes('Karen') || v.name.includes('Zira') || v.name.includes('Google UK English Female'));
        if (preferred) utterance.voice = preferred;
        utterance.onstart = () => setSophiaPlaying(true);
        utterance.onend = () => setSophiaPlaying(false);
        utterance.onerror = () => setSophiaPlaying(false);
        setSophiaLoading(false);
        window.speechSynthesis.speak(utterance);
      }
    } catch (err) {
      console.error('Sophia play error:', err);
      setSophiaPlaying(false);
      setSophiaLoading(false);
    }
  }, []);

  // Poll for new Sophia insights every 5 min
  useEffect(() => {
    const INSIGHT_LAST_SEEN_KEY = 'stratify-copilot-last-seen';
    const check = async () => {
      try {
        const res = await fetch('/api/sophia-insight');
        if (!res.ok) return;
        const insights = await res.json();
        if (!Array.isArray(insights) || insights.length === 0) return;
        const latest = new Date(insights[0].created_at).getTime();
        const lastSeen = parseInt(localStorage.getItem(INSIGHT_LAST_SEEN_KEY) || '0', 10);
        setHasNewInsight(latest > lastSeen);
      } catch {}
    };
    check();
    const interval = setInterval(check, 300000); // 5 min
    return () => clearInterval(interval);
  }, []);

  // Mark seen when copilot opens
  useEffect(() => {
    if (copilotOpen) {
      setHasNewInsight(false);
      try { localStorage.setItem('stratify-copilot-last-seen', String(Date.now())); } catch {}
    }
  }, [copilotOpen]);
  
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const latestTimestamp = getLatestNewsletterTimestamp();
    const lastViewedTimestamp = resolveStoredTimestamp(NEWSLETTER_LAST_VIEWED_KEY);
    setLatestNewsletterTimestamp(latestTimestamp);
    setHasUnreadNewsletter(latestTimestamp > lastViewedTimestamp);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const syncMarketIntelStatus = async () => {
      try {
        const response = await fetch('/api/market-intel');
        if (!response.ok) return;

        const payload = await response.json();
        if (!Array.isArray(payload) || payload.length === 0) {
          if (!cancelled) {
            setLatestIntelTimestamp(0);
            setHasUnreadIntel(false);
          }
          return;
        }

        const latestTimestamp = Date.parse(String(payload[0]?.created_at || ''));
        if (!Number.isFinite(latestTimestamp) || latestTimestamp <= 0) return;

        const lastViewedTimestamp = resolveStoredTimestamp(
          MARKET_INTEL_LAST_VIEWED_KEY,
          [LEGACY_MARKET_INTEL_LAST_VIEWED_KEY],
        );

        if (!cancelled) {
          setLatestIntelTimestamp(latestTimestamp);
          setHasUnreadIntel(latestTimestamp > lastViewedTimestamp);
        }
      } catch {}
    };

    syncMarketIntelStatus();
    const interval = setInterval(syncMarketIntelStatus, 120000);
    const handleWindowFocus = () => syncMarketIntelStatus();
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener('focus', handleWindowFocus);
    };
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

  const handleOpenNewsletter = () => {
    const viewedTimestamp = latestNewsletterTimestamp || Date.now();
    try {
      localStorage.setItem(NEWSLETTER_LAST_VIEWED_KEY, String(viewedTimestamp));
    } catch {}
    setHasUnreadNewsletter(false);
    onOpenNewsletter?.();
  };

  const handleOpenMarketIntel = () => {
    const viewedTimestamp = latestIntelTimestamp || Date.now();
    try {
      localStorage.setItem(MARKET_INTEL_LAST_VIEWED_KEY, String(viewedTimestamp));
      localStorage.setItem(LEGACY_MARKET_INTEL_LAST_VIEWED_KEY, String(viewedTimestamp));
    } catch {}
    setHasUnreadIntel(false);
    onOpenMarketIntel?.();
  };

  return (
    <div className={`flex items-center justify-between px-4 py-2 ${themeClasses.surfaceElevated} border-t ${themeClasses.border}`}>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${status.color} ${connectionStatus === 'connecting' ? 'animate-pulse' : ''}`} />
          <button
            onClick={handleOpenNewsletter}
            className={`relative text-xs font-semibold transition-all flex items-center gap-1.5 px-2.5 py-1 rounded-full border backdrop-blur-md ${
              hasUnreadNewsletter
                ? 'text-emerald-200 bg-[rgba(16,185,129,0.15)] border-emerald-400/40 shadow-[0_0_16px_rgba(16,185,129,0.3)] animate-pulse'
                : 'text-emerald-300 hover:text-emerald-200 bg-[rgba(16,185,129,0.08)] border-[rgba(16,185,129,0.2)]'
            }`}
          >
            <svg className={`w-3 h-3 ${hasUnreadNewsletter ? 'animate-pulse' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Newsletter
            {hasUnreadNewsletter && (
              <>
                <span className="absolute -inset-0.5 rounded-full border border-emerald-400/35 animate-pulse pointer-events-none" />
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 animate-pulse pointer-events-none" />
              </>
            )}
          </button>
          <button
            onClick={handleOpenMarketIntel}
            className={`relative text-xs font-semibold transition-all flex items-center gap-1.5 px-2.5 py-1 rounded-full border backdrop-blur-md ${
              hasUnreadIntel
                ? 'text-blue-200 border-blue-400/45 bg-[rgba(59,130,246,0.14)] shadow-[0_0_16px_rgba(59,130,246,0.3)] animate-pulse'
                : 'text-blue-400 hover:text-blue-300 bg-[rgba(59,130,246,0.08)] border-[rgba(59,130,246,0.25)]'
            }`}
          >
            <Radio className={`w-3 h-3 ${hasUnreadIntel ? 'animate-pulse' : ''}`} />
            Market Intel
            {hasUnreadIntel && (
              <>
                <span className="absolute -inset-0.5 rounded-full border border-blue-400/35 animate-pulse pointer-events-none" />
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-blue-400 animate-pulse pointer-events-none" />
              </>
            )}
          </button>
          <div className="relative">
            <div className={`flex items-center rounded-full border backdrop-blur-md transition-all ${
              hasNewInsight
                ? 'border-amber-400/40 bg-[rgba(245,158,11,0.15)] shadow-[0_0_16px_rgba(245,158,11,0.3)]'
                : sophiaPlaying
                  ? 'border-emerald-500/40 bg-emerald-500/10 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                  : 'border-[rgba(245,158,11,0.25)] bg-[rgba(245,158,11,0.08)]'
            }`}>
              {/* Play/Stop side */}
              <button
                onClick={handlePlaySophia}
                disabled={sophiaLoading}
                className={`flex items-center justify-center w-7 h-7 rounded-l-full transition-colors ${
                  sophiaPlaying
                    ? 'text-emerald-300 hover:text-emerald-200'
                    : sophiaLoading
                      ? 'text-zinc-500 cursor-wait'
                      : 'text-amber-400 hover:text-amber-200'
                }`}
                title={sophiaPlaying ? 'Stop Sophia' : 'Listen to Sophia'}
              >
                {sophiaLoading ? (
                  <Volume2 className="w-3 h-3 animate-pulse" />
                ) : sophiaPlaying ? (
                  <Square className="w-2.5 h-2.5 fill-current" />
                ) : (
                  <Play className="w-3 h-3 fill-current" />
                )}
              </button>

              {/* Divider */}
              <div className="w-px h-4 bg-amber-400/20" />

              {/* Sophia name — opens dropdown */}
              <button
                onClick={() => setCopilotOpen((prev) => !prev)}
                className={`relative flex items-center gap-1.5 px-2.5 py-1 rounded-r-full text-xs font-semibold transition-colors ${
                  copilotOpen
                    ? 'text-amber-300'
                    : hasNewInsight
                      ? 'text-amber-200 animate-pulse'
                      : 'text-amber-400 hover:text-amber-200'
                }`}
              >
                <Zap className={`w-3 h-3 ${hasNewInsight ? 'animate-pulse' : ''}`} />
                Sophia
                {hasNewInsight && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-400 animate-pulse pointer-events-none" />
                )}
              </button>
            </div>
            {copilotOpen && (
              <SophiaCopilot onClose={() => setCopilotOpen(false)} />
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4">
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
