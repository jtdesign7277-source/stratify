import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Users, Hash, Zap } from 'lucide-react';
import { T, RAIL_TRENDS_PLACEHOLDER, ALL_FEED_HASHTAGS } from './communityConstants';
import { formatSignedPercent, toFiniteNumber } from './communityHelpers';
import { UserAvatar } from './CommunityShared';

const LeftRail = ({
  currentUser,
  currentUserAvatarUrl,
  displayName,
  trackedSymbols,
  quoteMap,
  activeFeed,
  enabledFeeds,
  onFeedSelect,
  onSymbolClick,
}) => {
  const topMovers = useMemo(() => {
    const symbols = Array.isArray(trackedSymbols) ? trackedSymbols : [];
    return symbols
      .map((symbol) => {
        const quote = quoteMap?.[symbol] || {};
        return {
          symbol,
          price: toFiniteNumber(quote.price, 0),
          percentChange: toFiniteNumber(quote.percentChange, 0),
          volume: toFiniteNumber(quote.volume, 0),
        };
      })
      .filter((row) => row.price > 0)
      .sort((a, b) => Math.abs(b.percentChange) - Math.abs(a.percentChange))
      .slice(0, 6);
  }, [trackedSymbols, quoteMap]);

  const feedChannels = useMemo(() => {
    const available = ALL_FEED_HASHTAGS.filter((feed) => (enabledFeeds || []).includes(feed.id));
    return available;
  }, [enabledFeeds]);

  const profileName = String(displayName || currentUser?.display_name || currentUser?.email?.split('@')[0] || 'Trader').trim() || 'Trader';
  const profileAvatar = String(currentUserAvatarUrl || currentUser?.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(profileName)}`).trim();

  return (
    <div className="space-y-3">
      {currentUser && (
        <div
          className="rounded-xl border p-3"
          style={{ borderColor: T.border, backgroundColor: T.card }}
        >
          <div className="flex items-center gap-2.5">
            <UserAvatar
              user={{ ...(currentUser || {}), display_name: profileName, avatar_url: profileAvatar }}
              size={36}
              initialsClassName="text-xs"
            />
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate" style={{ color: T.text }}>{profileName}</div>
              <div className="text-xs truncate" style={{ color: T.muted }}>
                {currentUser?.email || 'Community Member'}
              </div>
            </div>
          </div>
        </div>
      )}

      <div
        className="rounded-xl border p-3"
        style={{ borderColor: T.border, backgroundColor: T.card }}
      >
        <div className="flex items-center gap-1.5 mb-2.5">
          <Hash className="h-3.5 w-3.5" style={{ color: T.blue }} />
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: T.muted }}>Feeds</span>
        </div>

        {feedChannels.length > 0 ? (
          <div className="space-y-1">
            {feedChannels.map((feed) => {
              const isActive = activeFeed === feed.id;
              return (
                <button
                  key={feed.id}
                  type="button"
                  onClick={() => onFeedSelect?.(isActive ? null : feed.id)}
                  className="w-full text-left px-2 py-1.5 rounded-lg text-xs transition-all duration-150 cursor-pointer"
                  style={{
                    color: isActive ? T.blue : T.text,
                    backgroundColor: isActive ? 'rgba(88,166,255,0.1)' : 'transparent',
                  }}
                >
                  # {feed.label}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="text-xs" style={{ color: T.muted }}>No feeds available</div>
        )}
      </div>

      <div
        className="rounded-xl border p-3"
        style={{ borderColor: T.border, backgroundColor: T.card }}
      >
        <div className="flex items-center gap-1.5 mb-2.5">
          <Zap className="h-3.5 w-3.5" style={{ color: '#d29922' }} />
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: T.muted }}>Trending</span>
        </div>

        <div className="space-y-1">
          {RAIL_TRENDS_PLACEHOLDER.map((tag, index) => (
            <button
              key={`trend-${index}`}
              type="button"
              onClick={() => {}}
              className="w-full text-left px-2 py-1 rounded-lg text-xs transition-all duration-150 cursor-pointer hover:bg-white/5"
              style={{ color: T.text }}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {topMovers.length > 0 && (
        <div
          className="rounded-xl border p-3"
          style={{ borderColor: T.border, backgroundColor: T.card }}
        >
          <div className="flex items-center gap-1.5 mb-2.5">
            <TrendingUp className="h-3.5 w-3.5" style={{ color: T.green }} />
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: T.muted }}>Top Movers</span>
          </div>

          <div className="space-y-1.5">
            {topMovers.map((mover) => (
              <button
                key={mover.symbol}
                type="button"
                onClick={() => onSymbolClick?.(mover.symbol)}
                className="w-full flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-white/5 transition-all duration-150 cursor-pointer group"
              >
                <span className="text-xs font-medium group-hover:text-white transition-colors" style={{ color: T.blue }}>
                  ${mover.symbol}
                </span>
                <span
                  className="text-xs font-mono tabular-nums"
                  style={{ color: mover.percentChange >= 0 ? T.green : T.red }}
                >
                  {formatSignedPercent(mover.percentChange)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div
        className="rounded-xl border p-3"
        style={{ borderColor: T.border, backgroundColor: T.card }}
      >
        <div className="flex items-center gap-1.5 mb-2">
          <Users className="h-3.5 w-3.5" style={{ color: T.muted }} />
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: T.muted }}>Community</span>
        </div>
        <div className="text-xs" style={{ color: T.muted }}>
          Share setups, ideas, and trade recaps with other Stratify traders.
        </div>
      </div>
    </div>
  );
};

export default LeftRail;
