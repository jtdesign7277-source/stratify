import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home, Compass, Clock3, BarChart3, Globe, Hash, Settings,
  PanelLeftClose, PanelRightClose, ChevronRight, Bell, BellOff, Trash2, Pencil, Check, X,
} from 'lucide-react';
import { T, ALL_FEED_HASHTAGS, MAX_VISIBLE_FEED_HASHTAGS } from './communityConstants';
import { UserAvatar } from './CommunityShared';
import { buildCurrentUserAvatarUrl, toMaybeFiniteNumber } from './communityHelpers';

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
    </motion.aside>
  );
};

export default LeftRail;
