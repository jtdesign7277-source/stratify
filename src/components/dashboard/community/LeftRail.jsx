import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home, Compass, Clock3, BarChart3, Globe, Hash, Settings,
  PanelLeftClose, PanelRightClose, ChevronRight, Bell, BellOff, Trash2, Pencil, Check, X,
} from 'lucide-react';
import { T, ALL_FEED_HASHTAGS, MAX_VISIBLE_FEED_HASHTAGS, MOOD_CONFIG, MOOD_LS_KEY, DEFAULT_MOOD } from './communityConstants';
import { UserAvatar, MoodAvatar } from './CommunityShared';
import { buildCurrentUserAvatarUrl, toMaybeFiniteNumber } from './communityHelpers';
import { supabase } from '../../../lib/supabaseClient';

const EXPLORE_TABS = [
  { id: 'history', label: 'History', icon: Clock3 },
  { id: 'discover', label: 'Discover', icon: Compass },
  { id: 'finance', label: 'Finance', icon: BarChart3 },
  { id: 'spaces', label: 'Spaces', icon: Globe },
];

const LeftRail = ({
  // collapse
  collapsed,
  onToggleCollapse,
  // feed filter
  filter,
  onFilter,
  // price alerts
  priceAlerts = [],
  onTogglePriceAlert,
  onDeletePriceAlert,
  // user / profile
  currentUser,
  avatarUrl,
  displayName,
  isEditingName,
  editName,
  setEditName,
  setIsEditingName,
  handleSaveName,
  // feeds customizer
  enabledFeeds = [],
  onOpenFeedCustomizer,
  // explore tabs
  activeExploreTab,
  onExploreTabChange,
}) => {
  const [priceAlertsOpen, setPriceAlertsOpen] = useState(false);
  const [mood, setMood] = useState(() => {
    try { return localStorage.getItem(MOOD_LS_KEY) || DEFAULT_MOOD; } catch { return DEFAULT_MOOD; }
  });
  const [moodPickerOpen, setMoodPickerOpen] = useState(false);
  const moodPickerRef = useRef(null);
  const isPro = true; // hardcoded until Stripe subscription wired

  // Close mood picker on outside click / Escape
  useEffect(() => {
    if (!moodPickerOpen) return;
    const onDown = (e) => {
      if (moodPickerRef.current && !moodPickerRef.current.contains(e.target)) setMoodPickerOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setMoodPickerOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [moodPickerOpen]);

  const selectMood = async (key) => {
    setMood(key);
    setMoodPickerOpen(false);
    try {
      localStorage.setItem(MOOD_LS_KEY, key);
      // Notify same-tab listeners (storage event only fires cross-tab natively)
      window.dispatchEvent(new StorageEvent('storage', { key: MOOD_LS_KEY, newValue: key }));
    } catch { /* ignore */ }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) await supabase.auth.updateUser({ data: { mood: key } });
    } catch { /* ignore */ }
  };

  const profileName = String(displayName || currentUser?.display_name || currentUser?.email?.split('@')[0] || 'Trader').trim() || 'Trader';
  const profileAvatarUrl = String(avatarUrl || currentUser?.avatar_url || buildCurrentUserAvatarUrl(profileName)).trim();
  const profileUser = currentUser
    ? { ...currentUser, display_name: profileName, avatar_url: profileAvatarUrl }
    : { id: 'guest-user', display_name: profileName, avatar_url: profileAvatarUrl };

  const activeAlerts = (Array.isArray(priceAlerts) ? priceAlerts : []).filter((a) => a?.active && !a?.triggered);
  const feedChannels = ALL_FEED_HASHTAGS.filter((feed) => (Array.isArray(enabledFeeds) ? enabledFeeds : []).includes(feed.id));

  if (collapsed) {
    return (
      <motion.aside
        initial={false}
        animate={{ width: 56 }}
        className="h-full flex-shrink-0 flex flex-col items-center py-3 gap-3 border-r"
        style={{ borderColor: T.border, backgroundColor: T.bg }}
      >
        <button
          type="button"
          onClick={onToggleCollapse}
          className="h-8 w-8 inline-flex items-center justify-center rounded-lg hover:bg-white/8 transition-colors"
          style={{ color: T.muted }}
          title="Expand sidebar"
        >
          <PanelRightClose size={15} strokeWidth={1.5} />
        </button>

        <button
          type="button"
          onClick={() => onFilter?.(null)}
          className="h-8 w-8 inline-flex items-center justify-center rounded-lg hover:bg-white/8 transition-colors"
          style={{ color: !filter && !activeExploreTab ? T.blue : T.muted }}
          title="Home feed"
        >
          <Home size={15} strokeWidth={1.5} />
        </button>

        {EXPLORE_TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onExploreTabChange?.(activeExploreTab === tab.id ? null : tab.id)}
              className="h-8 w-8 inline-flex items-center justify-center rounded-lg hover:bg-white/8 transition-colors"
              style={{ color: activeExploreTab === tab.id ? T.blue : T.muted }}
              title={tab.label}
            >
              <Icon size={15} strokeWidth={1.5} />
            </button>
          );
        })}

        <div className="mt-auto">
          <UserAvatar user={profileUser} size={32} initialsClassName="text-[10px]" />
        </div>
      </motion.aside>
    );
  }

  return (
    <motion.aside
      initial={false}
      animate={{ width: 240 }}
      className="h-full flex-shrink-0 flex flex-col border-r overflow-y-auto"
      style={{ borderColor: T.border, backgroundColor: T.bg, minWidth: 240, maxWidth: 240 }}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b flex-shrink-0" style={{ borderColor: T.border }}>
        <span className="text-sm font-semibold uppercase tracking-wider" style={{ color: T.muted }}>Community</span>
        <button
          type="button"
          onClick={onToggleCollapse}
          className="h-6 w-6 inline-flex items-center justify-center rounded hover:bg-white/8 transition-colors"
          style={{ color: T.muted }}
          title="Collapse sidebar"
        >
          <PanelLeftClose size={13} strokeWidth={1.5} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
        {/* ── Profile ── */}
        {currentUser && (
          <div className="px-2 py-2 mb-1">
            <div className="flex items-center gap-2.5">
              <UserAvatar user={profileUser} size={40} initialsClassName="text-xs" />
              <div className="flex-1 min-w-0">
                {isEditingName ? (
                  <div className="flex items-center gap-1">
                    <input
                      value={editName}
                      onChange={(e) => setEditName?.(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveName?.();
                        if (e.key === 'Escape') setIsEditingName?.(false);
                      }}
                      className="flex-1 min-w-0 bg-white/8 border border-white/15 rounded px-1.5 py-0.5 text-sm outline-none"
                      style={{ color: T.text }}
                      autoFocus
                      maxLength={24}
                    />
                    <button type="button" onClick={handleSaveName} className="text-[#3fb950] hover:brightness-110" title="Save">
                      <Check size={13} strokeWidth={2} />
                    </button>
                    <button type="button" onClick={() => setIsEditingName?.(false)} className="text-[#7d8590] hover:text-[#e6edf3]" title="Cancel">
                      <X size={13} strokeWidth={2} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 group">
                    <span className="text-base font-bold truncate" style={{ color: T.text }}>{profileName}</span>
                    <button
                      type="button"
                      onClick={() => { setEditName?.(profileName); setIsEditingName?.(true); }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: T.muted }}
                      title="Edit display name"
                    >
                      <Pencil size={12} strokeWidth={1.5} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Home ── */}
        <button
          type="button"
          onClick={() => { onExploreTabChange?.(null); onFilter?.(null); }}
          className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-base transition-colors"
          style={{
            color: !filter && !activeExploreTab ? T.blue : T.text,
            backgroundColor: !filter && !activeExploreTab ? 'rgba(88,166,255,0.1)' : 'transparent',
          }}
        >
          <Home size={20} strokeWidth={1.5} />
          <span>Home Feed</span>
        </button>

        {/* ── Explore Tabs ── */}
        {EXPLORE_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeExploreTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onExploreTabChange?.(isActive ? null : tab.id)}
              className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-base transition-colors"
              style={{
                color: isActive ? T.blue : T.text,
                backgroundColor: isActive ? 'rgba(88,166,255,0.1)' : 'transparent',
              }}
            >
              <Icon size={20} strokeWidth={1.5} />
              <span>{tab.label}</span>
              {isActive && <ChevronRight size={14} strokeWidth={1.5} className="ml-auto" style={{ color: T.blue }} />}
            </button>
          );
        })}

        {/* ── Feed Channels ── */}
        <div className="pt-2 pb-1">
          <div className="flex items-center justify-between px-2 mb-1.5">
            <span className="text-sm font-semibold uppercase tracking-wider" style={{ color: T.muted }}>Feeds</span>
            <button
              type="button"
              onClick={onOpenFeedCustomizer}
              className="hover:text-[#e6edf3] transition-colors"
              style={{ color: T.muted }}
              title="Customize feeds"
            >
              <Settings size={16} strokeWidth={1.5} />
            </button>
          </div>

          {feedChannels.length > 0 ? (
            feedChannels.slice(0, MAX_VISIBLE_FEED_HASHTAGS).map((feed) => {
              const isActive = filter === feed.id;
              return (
                <button
                  key={feed.id}
                  type="button"
                  onClick={() => { onExploreTabChange?.(null); onFilter?.(isActive ? null : feed.id); }}
                  className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-base transition-colors"
                  style={{
                    color: isActive ? T.blue : T.text,
                    backgroundColor: isActive ? 'rgba(88,166,255,0.1)' : 'transparent',
                  }}
                >
                  <Hash size={14} strokeWidth={1.5} />
                  <span className="truncate">{feed.label}</span>
                </button>
              );
            })
          ) : (
            <button
              type="button"
              onClick={onOpenFeedCustomizer}
              className="w-full px-2 py-2 text-base text-left rounded-lg hover:bg-white/5 transition-colors"
              style={{ color: T.muted }}
            >
              + Add feed channels
            </button>
          )}
        </div>

        {/* ── Price Alerts ── */}
        {Array.isArray(priceAlerts) && priceAlerts.length > 0 && (
          <div className="pt-2 pb-1">
            <button
              type="button"
              onClick={() => setPriceAlertsOpen((o) => !o)}
              className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-base transition-colors hover:bg-white/5"
              style={{ color: T.text }}
            >
              <Bell size={16} strokeWidth={1.5} style={{ color: activeAlerts.length > 0 ? T.blue : T.muted }} />
              <span>Price Alerts</span>
              <span
                className="ml-auto text-xs font-semibold px-1.5 py-0.5 rounded-full"
                style={{
                  backgroundColor: activeAlerts.length > 0 ? 'rgba(88,166,255,0.15)' : 'rgba(255,255,255,0.06)',
                  color: activeAlerts.length > 0 ? T.blue : T.muted,
                }}
              >
                {priceAlerts.length}
              </span>
            </button>

            <AnimatePresence initial={false}>
              {priceAlertsOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.18 }}
                  className="overflow-hidden"
                >
                  <div className="pl-2 pr-1 pb-1 space-y-1 mt-1">
                    {priceAlerts.map((alert) => {
                      const isActive = alert?.active && !alert?.triggered;
                      const isTriggered = Boolean(alert?.triggered);
                      return (
                        <div
                          key={alert.id}
                          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px]"
                          style={{
                            backgroundColor: 'rgba(255,255,255,0.03)',
                            borderLeft: `2px solid ${isTriggered ? T.green : isActive ? T.blue : 'rgba(255,255,255,0.1)'}`,
                          }}
                        >
                          <span className="font-medium truncate" style={{ color: T.text }}>{alert.ticker}</span>
                          <span style={{ color: T.muted }}>{alert.direction === 'below' ? '↓' : '↑'}</span>
                          <span className="font-mono tabular-nums" style={{ color: T.text }}>
                            ${toMaybeFiniteNumber(alert.targetPrice) != null ? Number(alert.targetPrice).toFixed(2) : '--'}
                          </span>
                          {isTriggered && <span className="text-[#3fb950] text-[9px] font-bold ml-auto">HIT</span>}
                          <div className="ml-auto flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => onTogglePriceAlert?.(alert.id)}
                              className="opacity-60 hover:opacity-100 transition-opacity"
                              style={{ color: isActive ? T.blue : T.muted }}
                              title={isActive ? 'Disable alert' : 'Enable alert'}
                            >
                              {isActive ? <Bell size={10} strokeWidth={1.5} /> : <BellOff size={10} strokeWidth={1.5} />}
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeletePriceAlert?.(alert.id)}
                              className="opacity-60 hover:opacity-100 transition-opacity"
                              style={{ color: T.red }}
                              title="Delete alert"
                            >
                              <Trash2 size={10} strokeWidth={1.5} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* ── Bottom mood / profile card ── */}
      <div className="mt-auto px-2 pb-3 flex-shrink-0">
        <div
          className="relative overflow-hidden flex items-center gap-3 px-4 py-3 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md shadow-lg transition-all duration-300 hover:bg-white/[0.07] hover:border-white/15"
        >
          {/* Shine streak */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
            <div
              className="absolute top-0 -left-[100%] w-[60%] h-full opacity-[0.07]"
              style={{
                background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.8) 50%, transparent 60%)',
                animation: 'shine 6s ease-in-out infinite',
                animationDelay: '2s',
              }}
            />
          </div>

          {/* Avatar — click to open mood picker */}
          <div className="relative flex-shrink-0" ref={moodPickerRef}>
            <button
              type="button"
              onClick={() => setMoodPickerOpen((prev) => !prev)}
              className={`w-11 h-11 rounded-full flex-shrink-0 ring-0 hover:ring-2 hover:ring-[#58a6ff]/50 transition-all duration-200 overflow-hidden ${moodPickerOpen ? 'ring-2 ring-[#58a6ff]/50' : ''}`}
              title="Set your mood"
            >
              <MoodAvatar mood={mood} size={44} />
            </button>

            {/* Mood picker popup */}
            <AnimatePresence>
              {moodPickerOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.96 }}
                  transition={{ duration: 0.15 }}
                  className="absolute bottom-full left-0 mb-2 z-50 bg-[#161b22] border border-white/10 rounded-xl p-3 shadow-xl"
                  style={{ width: 220 }}
                >
                  <div className="text-[#7d8590] text-xs font-medium uppercase tracking-wide mb-2">
                    How's your day?
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(MOOD_CONFIG).map(([key, cfg]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => selectMood(key)}
                        className={`rounded-xl p-2 flex flex-col items-center gap-1 cursor-pointer transition-all duration-150 hover:scale-105 ${cfg.cardBg} ${cfg.border} ${mood === key ? 'ring-2 ring-[#58a6ff] bg-[#58a6ff]/10' : ''}`}
                      >
                        <span className="text-2xl leading-none">{cfg.emoji}</span>
                        <span className="text-[#c9d1d9] text-[10px] leading-tight">{cfg.label}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Name + verified badge + mood label */}
          <div className="flex flex-col min-w-0 flex-1">
            <div className="flex items-center gap-0 min-w-0">
              <span className="text-base font-bold truncate" style={{ color: T.text }}>
                {profileName}
              </span>
              {isPro && (
                <svg viewBox="0 0 22 22" className="w-5 h-5 inline-block ml-1 flex-shrink-0" aria-label="Verified">
                  <g>
                    <path d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.855-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.69-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.636.433 1.221.878 1.69.47.446 1.055.752 1.69.883.635.13 1.294.083 1.902-.14.272.587.7 1.086 1.24 1.44s1.167.551 1.813.568c.647-.017 1.277-.213 1.818-.567s.972-.854 1.245-1.44c.604.223 1.26.27 1.894.14.634-.132 1.22-.437 1.69-.883.445-.47.75-1.055.88-1.69.131-.634.084-1.29-.139-1.896.587-.274 1.084-.705 1.438-1.246.355-.54.552-1.17.57-1.817z" fill="#1D9BF0"/>
                    <path d="M9.585 14.929l-3.28-3.28 1.168-1.168 2.112 2.112 5.321-5.321 1.168 1.168-6.489 6.489z" fill="white"/>
                  </g>
                </svg>
              )}
            </div>
            <span className="text-xs truncate" style={{ color: T.muted }}>
              Feeling {MOOD_CONFIG[mood]?.label?.toLowerCase() || 'confident'} {MOOD_CONFIG[mood]?.emoji || '😎'}
            </span>
          </div>
        </div>
      </div>
    </motion.aside>
  );
};

export default LeftRail;
