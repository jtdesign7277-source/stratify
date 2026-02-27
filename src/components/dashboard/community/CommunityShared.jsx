import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, ArrowLeftRight, Brain, Bell, BarChart3, Globe, MessageCircle } from 'lucide-react';
import {
  T,
  POST_TYPE_CONFIG,
  PROFILE_AVATAR_FALLBACK_COLOR,
} from './communityConstants';
import {
  normalizeAvatarColor,
  getResolvedAvatarUrl,
  sanitizePostType,
  formatSignedCurrency,
  formatSignedPercent,
} from './communityHelpers';

// ─── X Logo Icon ──────────────────────────────────────────
export const XLogoIcon = ({ className = 'h-3.5 w-3.5' }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

// ─── Shimmer Skeleton ─────────────────────────────────────
export const ShimmerLine = ({ w = '100%', h = 14, rounded = 6, className = '' }) => (
  <div
    className={`relative overflow-hidden ${className}`}
    style={{ width: w, height: h, borderRadius: rounded, background: 'rgba(255,255,255,0.04)' }}
  >
    <div
      className="absolute inset-0"
      style={{
        background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.6s ease-in-out infinite',
      }}
    />
  </div>
);

export const ShimmerBlock = ({ lines = 3, className = '' }) => (
  <div className={`space-y-2 ${className}`}>
    {Array.from({ length: lines }).map((_, i) => (
      <ShimmerLine key={i} w={i === lines - 1 ? '60%' : '100%'} />
    ))}
  </div>
);

// ─── User Avatar ──────────────────────────────────────────
export const UserAvatar = ({ user, size = 40, initialsClassName = '' }) => {
  const initials = String(user?.display_name || user?.email || user?.author_name || '?')
    .split(/\s+/)
    .map((part) => part?.[0] || '')
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';
  const initialsStyle = initialsClassName ? undefined : { fontSize: size * 0.36 };
  const [imageFailed, setImageFailed] = useState(false);
  const resolvedAvatarUrl = getResolvedAvatarUrl(user);
  const hasImage = Boolean(resolvedAvatarUrl) && !imageFailed;
  const fallbackColor = normalizeAvatarColor(user?.avatar_color) || PROFILE_AVATAR_FALLBACK_COLOR;
  const sizeClass = size === 40
    ? 'w-10 h-10'
    : size === 32
      ? 'w-8 h-8'
      : size === 24
        ? 'w-6 h-6'
        : '';

  useEffect(() => {
    setImageFailed(false);
  }, [resolvedAvatarUrl]);

  if (hasImage) {
    return (
      <img
        src={resolvedAvatarUrl}
        alt={user?.display_name || user?.author_name || 'User'}
        onError={() => setImageFailed(true)}
        className={`rounded-full object-cover flex-shrink-0 border border-white/8 ${sizeClass}`.trim()}
        style={sizeClass ? undefined : { width: size, height: size }}
        loading="lazy"
        decoding="async"
      />
    );
  }

  return (
    <div
      className={`rounded-full flex items-center justify-center flex-shrink-0 border border-white/8 ${sizeClass}`.trim()}
      style={sizeClass ? { backgroundColor: fallbackColor } : { width: size, height: size, backgroundColor: fallbackColor }}
    >
      <span className={`text-white font-bold ${initialsClassName}`.trim()} style={initialsStyle}>{initials}</span>
    </div>
  );
};

// ─── Post Type Badge ──────────────────────────────────────
export const PostTypeBadge = ({ type }) => {
  const normalizedType = sanitizePostType(type);
  const config = POST_TYPE_CONFIG[normalizedType];
  if (!config?.badge) return null;
  return (
    <div
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-[0.08em] border"
      style={config.badge}
    >
      <span>{config.label}</span>
    </div>
  );
};

// ─── P&L Card ─────────────────────────────────────────────
export const PnLCard = ({ metadata }) => {
  const pnlValue = Number(metadata?.pnl);
  if (!Number.isFinite(pnlValue)) return null;

  const isPositive = pnlValue >= 0;
  const percentValue = Number(metadata?.percent);
  const hasPercent = Number.isFinite(percentValue);
  const ticker = String(metadata?.ticker || metadata?.symbol || '').trim().toUpperCase();
  const moveClass = isPositive ? 'text-[#3fb950]' : 'text-[#f85149]';

  return (
    <div className="mt-2">
      <div className="flex items-center gap-3 py-1.5 px-2 rounded-md bg-white/3 border border-white/6">
        <span className="text-sm font-medium text-white">
          {ticker ? `$${ticker}` : 'P&L'}
        </span>
        <span className={`text-base font-semibold ${moveClass}`}>
          {formatSignedCurrency(pnlValue)}
        </span>
        <span className={`ml-auto text-sm font-medium ${moveClass}`}>
          {hasPercent ? formatSignedPercent(percentValue) : '--'}
        </span>
      </div>
    </div>
  );
};

// ─── Composer Type Pill ───────────────────────────────────
export const ComposerTypePill = ({ active, icon: Icon, label, onClick, accent = T.blue }) => (
  <button
    type="button"
    onClick={onClick}
    className="px-2.5 py-1.5 rounded-lg border text-xs font-medium inline-flex items-center gap-1.5 transition-colors"
    style={{
      borderColor: active ? accent : T.border,
      color: active ? accent : T.text,
      backgroundColor: active ? 'rgba(88,166,255,0.10)' : 'rgba(13,17,23,0.65)',
    }}
  >
    <Icon size={13} />
    {label}
  </button>
);
