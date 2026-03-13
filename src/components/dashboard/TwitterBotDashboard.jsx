import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import CountUp from 'react-countup';
import gsap from 'gsap';
import { supabase } from '../../lib/supabaseClient';

const REFRESH_INTERVAL = 60000;

const CRON_SCHEDULE = [
  { time: '7:45 AM', days: 'Mon-Fri', label: 'Pre-engagement warm-up' },
  { time: '8:00 AM', days: 'Mon-Fri', label: 'Pre-market watchlist tweet' },
  { time: '9:35 AM', days: 'Mon-Fri', label: 'Market open reaction' },
  { time: '9:40 AM', days: 'Mon-Fri', label: 'Self-reply link drop' },
  { time: '10:30 AM', days: 'Mon-Fri', label: 'Quote tweet session' },
  { time: '11:30 AM', days: 'Mon-Fri', label: 'Educational content tweet' },
  { time: '11:35 AM', days: 'Mon-Fri', label: 'Self-reply link drop' },
  { time: '1:00 PM', days: 'Mon-Fri', label: 'FinTwit engagement sweep' },
  { time: '1:45 PM', days: 'Mon-Fri', label: 'Trade recap tweet' },
  { time: '1:50 PM', days: 'Mon-Fri', label: 'Self-reply link drop' },
  { time: '3:45 PM', days: 'Mon-Fri', label: 'End of day summary' },
  { time: '4:30 PM', days: 'Mon-Fri', label: 'Post-market quote tweet' },
  { time: '7:30 PM', days: 'Daily', label: 'Evening sportsbook content' },
  { time: '10:00 PM', days: 'Daily', label: 'Nightly report card' },
  { time: '8:00 PM', days: 'Sunday', label: 'Weekly watchlist thread' },
];

const PILLAR_COLORS = {
  'market-alpha': '#10b981',
  'education': '#3b82f6',
  'promo': '#f59e0b',
  'engagement': '#8b5cf6',
  'sportsbook': '#ec4899',
  'recap': '#06b6d4',
};

function cardClass() {
  return 'bg-gradient-to-br from-white/[0.04] to-white/[0.01] backdrop-blur-xl rounded-2xl border border-white/[0.06] shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.05)]';
}

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function formatDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function timeAgo(ts) {
  if (!ts) return '';
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// Stat card with CountUp
function StatCard({ label, value, prefix, suffix, color, isRed }) {
  return (
    <motion.div
      className={cardClass() + ' p-5 flex flex-col gap-1'}
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      <span className="text-[11px] uppercase tracking-widest text-white/40 font-medium">{label}</span>
      <span className={`text-2xl font-bold font-mono ${isRed ? 'text-red-400' : (color || 'text-emerald-400')}`}>
        {prefix}
        <CountUp end={value} duration={1.2} separator="," preserveValue />
        {suffix}
      </span>
    </motion.div>
  );
}

// Staggered list using GSAP
function StaggeredList({ children, deps }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const items = containerRef.current.children;
    if (!items.length) return;
    gsap.fromTo(
      items,
      { opacity: 0, y: 8 },
      { opacity: 1, y: 0, stagger: 0.06, duration: 0.4, ease: 'power2.out' }
    );
  }, deps);

  return <div ref={containerRef}>{children}</div>;
}

export default function TwitterBotDashboard() {
  const [tweets, setTweets] = useState([]);
  const [engagements, setEngagements] = useState([]);
  const [dailyStats, setDailyStats] = useState([]);
  const [todayStats, setTodayStats] = useState({ tweets: 0, likes: 0, replies: 0, promoRatio: 0 });
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const today = new Date().toISOString().slice(0, 10);

    const [tweetsRes, engagementsRes, dailyRes] = await Promise.all([
      supabase
        .from('bot_tweets')
        .select('*')
        .order('posted_at', { ascending: false })
        .limit(50),
      supabase
        .from('bot_engagements')
        .select('*')
        .order('engaged_at', { ascending: false })
        .limit(50),
      supabase
        .from('bot_daily_stats')
        .select('*')
        .order('date', { ascending: false })
        .limit(7),
    ]);

    const tweetData = tweetsRes.data || [];
    const engData = engagementsRes.data || [];
    const dailyData = dailyRes.data || [];

    setTweets(tweetData);
    setEngagements(engData);
    setDailyStats(dailyData);

    // Compute today's stats from tweets
    const todayTweets = tweetData.filter(t => t.posted_at && t.posted_at.startsWith(today));
    const todayTweetCount = todayTweets.length;
    const promoCount = todayTweets.filter(t => t.tweet_type === 'promo' || t.is_promo).length;
    const promoRatio = todayTweetCount > 0 ? Math.round((promoCount / todayTweetCount) * 100) : 0;

    const todayEngs = engData.filter(e => e.engaged_at && e.engaged_at.startsWith(today));
    const likesToday = todayEngs.filter(e => e.action_type === 'like').length;
    const repliesToday = todayEngs.filter(e => e.action_type === 'reply').length;

    setTodayStats({ tweets: todayTweetCount, likes: likesToday, replies: repliesToday, promoRatio });
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-white/40 text-sm font-mono">Loading bot dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <svg className="w-6 h-6 text-emerald-400" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
        <h1 className="text-xl font-bold tracking-tight">@stratify_hq Bot Dashboard</h1>
        <span className="text-[11px] text-white/30 font-mono ml-auto">Auto-refresh 60s</span>
      </div>

      {/* Today's Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Tweets Today" value={todayStats.tweets} />
        <StatCard label="Likes Today" value={todayStats.likes} />
        <StatCard label="Replies Today" value={todayStats.replies} />
        <StatCard
          label="Promo Ratio"
          value={todayStats.promoRatio}
          suffix="%"
          isRed={todayStats.promoRatio > 20}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Live Tweet Feed */}
        <div className={cardClass() + ' p-5'}>
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4">Live Tweet Feed</h2>
          <div className="max-h-[480px] overflow-y-auto pr-1 space-y-0">
            <StaggeredList deps={[tweets]}>
              {tweets.map((tweet, i) => {
                const pillar = tweet.pillar || tweet.content_pillar || '';
                const pillarColor = PILLAR_COLORS[pillar.toLowerCase()] || '#6b7280';
                const isPromo = tweet.tweet_type === 'promo' || tweet.is_promo;
                return (
                  <div
                    key={tweet.id || i}
                    className="py-3 border-b border-white/[0.04] last:border-0"
                  >
                    <p className="text-[13px] text-white/80 leading-relaxed mb-2">
                      {tweet.text || tweet.tweet_text || tweet.content || ''}
                    </p>
                    <div className="flex items-center gap-3 text-[11px]">
                      {pillar && (
                        <span style={{ color: pillarColor }} className="font-medium">{pillar}</span>
                      )}
                      {tweet.hook_type && (
                        <span className="text-white/30">{tweet.hook_type}</span>
                      )}
                      <span className={`font-medium ${isPromo ? 'text-amber-400' : 'text-emerald-400/70'}`}>
                        {isPromo ? 'Promo' : 'Value'}
                      </span>
                      <span className="text-white/20 ml-auto font-mono">
                        {timeAgo(tweet.posted_at)}
                      </span>
                    </div>
                  </div>
                );
              })}
              {tweets.length === 0 && (
                <p className="text-white/20 text-sm py-4">No tweets yet today</p>
              )}
            </StaggeredList>
          </div>
        </div>

        {/* Engagement Feed */}
        <div className={cardClass() + ' p-5'}>
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4">Engagement Feed</h2>
          <div className="max-h-[480px] overflow-y-auto pr-1 space-y-0">
            <StaggeredList deps={[engagements]}>
              {engagements.map((eng, i) => {
                const actionColors = { like: 'text-pink-400', reply: 'text-blue-400', quote: 'text-purple-400' };
                const actionIcons = { like: '♥', reply: '↩', quote: '🔁' };
                const action = eng.action_type || 'like';
                return (
                  <div
                    key={eng.id || i}
                    className="py-3 border-b border-white/[0.04] last:border-0"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-sm ${actionColors[action] || 'text-white/40'}`}>
                        {actionIcons[action] || '•'}
                      </span>
                      <span className={`text-[12px] font-medium ${actionColors[action] || 'text-white/40'}`}>
                        {action.charAt(0).toUpperCase() + action.slice(1)}
                      </span>
                      {eng.target_handle && (
                        <span className="text-[12px] text-white/50">@{eng.target_handle.replace('@', '')}</span>
                      )}
                      <span className="text-white/20 text-[11px] ml-auto font-mono">
                        {timeAgo(eng.engaged_at)}
                      </span>
                    </div>
                    {eng.reply_text && (
                      <p className="text-[12px] text-white/50 pl-5 leading-relaxed">{eng.reply_text}</p>
                    )}
                  </div>
                );
              })}
              {engagements.length === 0 && (
                <p className="text-white/20 text-sm py-4">No engagements yet today</p>
              )}
            </StaggeredList>
          </div>
        </div>
      </div>

      {/* Daily Report Card */}
      <div className={cardClass() + ' p-5 mb-8'}>
        <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4">Daily Report — Last 7 Days</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-white/30 text-left border-b border-white/[0.06]">
                <th className="pb-2 pr-4 font-medium">Date</th>
                <th className="pb-2 pr-4 font-medium text-right">Tweets</th>
                <th className="pb-2 pr-4 font-medium text-right">Value</th>
                <th className="pb-2 pr-4 font-medium text-right">Promo</th>
                <th className="pb-2 font-medium text-right">Promo %</th>
              </tr>
            </thead>
            <tbody>
              {dailyStats.map((day, i) => {
                const promoPercent = day.promo_percent ?? day.promo_ratio ?? (
                  day.tweets_posted > 0
                    ? Math.round(((day.promo_tweets || 0) / day.tweets_posted) * 100)
                    : 0
                );
                return (
                  <tr key={day.date || i} className="border-b border-white/[0.03] last:border-0">
                    <td className="py-2 pr-4 text-white/60 font-mono">{formatDate(day.date)}</td>
                    <td className="py-2 pr-4 text-right text-white/70 font-mono">{day.tweets_posted ?? 0}</td>
                    <td className="py-2 pr-4 text-right text-emerald-400/70 font-mono">{day.value_tweets ?? 0}</td>
                    <td className="py-2 pr-4 text-right text-amber-400/70 font-mono">{day.promo_tweets ?? 0}</td>
                    <td className={`py-2 text-right font-mono font-medium ${promoPercent > 20 ? 'text-red-400' : 'text-white/60'}`}>
                      {promoPercent}%
                    </td>
                  </tr>
                );
              })}
              {dailyStats.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-white/20 text-center py-4">No daily stats available</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cron Schedule */}
      <div className={cardClass() + ' p-5'}>
        <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4">Cron Schedule</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-0">
          <StaggeredList deps={[]}>
            {CRON_SCHEDULE.map((item, i) => (
              <div key={i} className="flex items-center gap-3 py-2 border-b border-white/[0.03] last:border-0">
                <span className="text-emerald-400 font-mono text-[13px] w-[80px] shrink-0">{item.time}</span>
                <span className="text-white/25 text-[11px] w-[60px] shrink-0">{item.days}</span>
                <span className="text-white/60 text-[13px]">{item.label}</span>
              </div>
            ))}
          </StaggeredList>
        </div>
      </div>
    </div>
  );
}
