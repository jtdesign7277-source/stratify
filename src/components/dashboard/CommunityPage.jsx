import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { AnimatePresence, motion } from 'framer-motion';
import EmojiPicker, { EmojiGlyph } from './EmojiPicker';
import {
  Heart,
  MessageCircle,
  Share2,
  Send,
  X,
  TrendingUp,
  BarChart3,
  Bell,
  Zap,
  MoreHorizontal,
  Trash2,
  Loader2,
  Camera,
  SmilePlus,
  CalendarDays,
  Clock3,
  Copy,
  ExternalLink,
} from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────
const timeAgo = (date) => {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const extractTickers = (text) => {
  const matches = text.match(/\$[A-Z]{1,6}/g);
  return matches ? [...new Set(matches.map((t) => t.replace('$', '')))] : [];
};

const highlightTickers = (text) => {
  return text.replace(
    /\$([A-Z]{1,6})/g,
    '<span class="text-cyan-400 font-semibold cursor-pointer hover:underline">$$$1</span>'
  );
};

const POST_TYPE_CONFIG = {
  post: { label: null, icon: null, color: null },
  pnl_share: { label: 'P&L', icon: TrendingUp, color: 'emerald' },
  strategy_share: { label: 'Strategy', icon: Zap, color: 'cyan' },
  alert_share: { label: 'Alert', icon: Bell, color: 'amber' },
  trade_share: { label: 'Trade', icon: BarChart3, color: 'blue' },
};

const buildReactionSummary = (rows = [], currentUserId = null) => {
  const grouped = rows.reduce((acc, row) => {
    const emoji = row?.emoji;
    if (!emoji) return acc;

    if (!acc[emoji]) {
      acc[emoji] = {
        emoji,
        count: 0,
        reacted: false,
      };
    }

    acc[emoji].count += 1;
    if (currentUserId && row.user_id === currentUserId) {
      acc[emoji].reacted = true;
    }

    return acc;
  }, {});

  return Object.values(grouped).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.emoji.localeCompare(b.emoji);
  });
};

const applyReactionState = (currentReactions = [], emoji, shouldReact) => {
  let changed = false;
  const next = currentReactions
    .map((reaction) => {
      if (reaction.emoji !== emoji) return reaction;
      changed = true;

      const nextCount = Math.max(0, (reaction.count || 0) + (shouldReact ? 1 : -1));
      if (nextCount === 0) return null;

      return {
        ...reaction,
        count: nextCount,
        reacted: shouldReact,
      };
    })
    .filter(Boolean);

  if (!changed && shouldReact) {
    next.push({
      emoji,
      count: 1,
      reacted: true,
    });
  }

  return next.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.emoji.localeCompare(b.emoji);
  });
};

const sortByCreatedAtAsc = (rows = []) =>
  [...rows].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

const toFiniteNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toMaybeFiniteNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatCurrency = (value) => `$${Math.abs(toFiniteNumber(value)).toLocaleString('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})}`;

const formatSignedCurrency = (value) => `${toFiniteNumber(value) >= 0 ? '+' : '-'}${formatCurrency(value)}`;

const formatSignedPercent = (value, digits = 2) => {
  const amount = toFiniteNumber(value);
  return `${amount >= 0 ? '+' : ''}${amount.toFixed(digits)}%`;
};

const formatDateTime = (value) => {
  const timestamp = Number.isFinite(value) ? value : Date.parse(value);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return '—';
  return new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const normalizeTradeForSlip = (rawTrade) => {
  if (!rawTrade || typeof rawTrade !== 'object') return null;

  const symbol = String(rawTrade.symbol ?? rawTrade.ticker ?? '').trim().toUpperCase();
  if (!symbol) return null;

  const shares = Math.abs(toFiniteNumber(
    rawTrade.shares
      ?? rawTrade.qty
      ?? rawTrade.quantity
      ?? rawTrade.size
      ?? rawTrade.amount,
  ));
  const price = toFiniteNumber(
    rawTrade.price
      ?? rawTrade.fillPrice
      ?? rawTrade.avgPrice
      ?? rawTrade.executionPrice
      ?? rawTrade.cost
      ?? rawTrade.limitPrice,
  );
  if (shares <= 0 || price <= 0) return null;

  const sideRaw = String(rawTrade.side ?? rawTrade.type ?? rawTrade.action ?? '').trim().toLowerCase();
  const side = sideRaw.includes('sell') || sideRaw.includes('short') || sideRaw.includes('close')
    ? 'sell'
    : 'buy';

  const timestamp = Number.isFinite(rawTrade.timestamp)
    ? rawTrade.timestamp
    : Date.parse(rawTrade.timestamp ?? rawTrade.time ?? rawTrade.date ?? rawTrade.created_at);
  if (!Number.isFinite(timestamp)) return null;

  return {
    id: String(rawTrade.id ?? `${symbol}-${side}-${timestamp}-${shares}`).trim(),
    symbol,
    side,
    shares,
    price,
    timestamp,
  };
};

const buildClosedTradesForSlip = (tradeHistory = []) => {
  const normalized = (Array.isArray(tradeHistory) ? tradeHistory : [])
    .map(normalizeTradeForSlip)
    .filter(Boolean)
    .sort((a, b) => a.timestamp - b.timestamp);

  const lotsBySymbol = new Map();
  const closedTrades = [];

  normalized.forEach((trade) => {
    if (!lotsBySymbol.has(trade.symbol)) {
      lotsBySymbol.set(trade.symbol, []);
    }

    const lots = lotsBySymbol.get(trade.symbol);
    if (trade.side === 'buy') {
      lots.push({
        shares: trade.shares,
        price: trade.price,
        timestamp: trade.timestamp,
      });
      return;
    }

    let remaining = trade.shares;
    let matchedShares = 0;
    let totalEntryValue = 0;
    let openedAt = null;

    while (remaining > 0 && lots.length > 0) {
      const lot = lots[0];
      const sharesToMatch = Math.min(remaining, lot.shares);
      if (sharesToMatch <= 0) break;

      matchedShares += sharesToMatch;
      totalEntryValue += sharesToMatch * lot.price;
      openedAt = openedAt === null ? lot.timestamp : Math.min(openedAt, lot.timestamp);

      lot.shares -= sharesToMatch;
      remaining -= sharesToMatch;

      if (lot.shares <= 0) {
        lots.shift();
      }
    }

    if (matchedShares <= 0 || totalEntryValue <= 0) return;

    const exitValue = matchedShares * trade.price;
    const pnl = exitValue - totalEntryValue;
    const percent = (pnl / totalEntryValue) * 100;

    closedTrades.push({
      id: `${trade.symbol}-${trade.timestamp}-${closedTrades.length}`,
      symbol: trade.symbol,
      shares: matchedShares,
      entryPrice: totalEntryValue / matchedShares,
      exitPrice: trade.price,
      pnl,
      percent,
      openedAt,
      closedAt: trade.timestamp,
    });
  });

  return closedTrades.sort((a, b) => b.closedAt - a.closedAt);
};

const createSlipCaption = ({ trade, emojis = [], note = '' }) => {
  if (!trade) return '';

  const emojiPrefix = Array.isArray(emojis) && emojis.length > 0 ? `${emojis.join('')} ` : '';
  const lines = [];
  if (note?.trim()) lines.push(note.trim());
  lines.push(
    `${emojiPrefix}$${trade.symbol} ${formatSignedPercent(trade.percent)} • ${formatSignedCurrency(trade.pnl)}`
  );
  lines.push(
    `In ${formatCurrency(trade.entryPrice)} → Out ${formatCurrency(trade.exitPrice)} • ${trade.shares.toLocaleString('en-US', { maximumFractionDigits: 4 })} sh`
  );
  lines.push(`Opened ${formatDateTime(trade.openedAt)} • Closed ${formatDateTime(trade.closedAt)}`);
  lines.push('#StratifyPnl');
  return lines.join('\n');
};

const normalizePnlShareSnapshot = (post) => {
  const pnl = toMaybeFiniteNumber(post?.metadata?.pnl);
  if (pnl === null) return null;

  const percentRaw = toMaybeFiniteNumber(post?.metadata?.percent);
  const ticker = String(post?.metadata?.ticker || '').trim().toUpperCase();
  const author = (
    post?.profiles?.display_name
    || post?.author_name
    || post?.metadata?.display_name
    || post?.metadata?.author_name
    || post?.metadata?.username
    || 'Trader'
  );

  return {
    id: String(post?.id || '').trim() || `${ticker || 'TRADE'}-${post?.created_at || Date.now()}`,
    ticker: ticker || 'TRADE',
    pnl,
    percent: percentRaw,
    author,
    createdAt: post?.created_at || null,
    entryPrice: toMaybeFiniteNumber(post?.metadata?.entry_price ?? post?.metadata?.entryPrice),
    exitPrice: toMaybeFiniteNumber(post?.metadata?.exit_price ?? post?.metadata?.exitPrice),
    shares: toMaybeFiniteNumber(post?.metadata?.shares ?? post?.metadata?.qty ?? post?.metadata?.quantity),
    openedAt: post?.metadata?.opened_at ?? post?.metadata?.openedAt ?? null,
    closedAt: post?.metadata?.closed_at ?? post?.metadata?.closedAt ?? post?.created_at ?? null,
    note: String(post?.metadata?.note || '').trim(),
  };
};

// ─── Share to X ───────────────────────────────────────────
const shareToX = (post) => {
  let text = post.content;
  const pnlValue = Number(post?.metadata?.pnl);
  if (post.post_type === 'pnl_share' && Number.isFinite(pnlValue)) {
    const ticker = post?.metadata?.ticker ? `$${post.metadata.ticker}` : 'my trade';
    text = `${ticker} ${formatSignedCurrency(pnlValue)}${
      Number.isFinite(Number(post?.metadata?.percent)) ? ` (${formatSignedPercent(Number(post.metadata.percent))})` : ''
    }\n\n${post.content}`;
  }
  text += '\n\nPowered by @StratifyTrading';
  const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank', 'width=550,height=420');
};

// ─── Avatar Component ─────────────────────────────────────
const UserAvatar = ({ user, size = 40 }) => {
  const initials = (user?.display_name || user?.email || '?')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  if (user?.avatar_url) {
    return (
      <img
        src={user.avatar_url}
        alt={user.display_name || 'User'}
        className="rounded-full object-cover flex-shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }

  const colors = [
    'from-cyan-500 to-blue-600',
    'from-emerald-500 to-teal-600',
    'from-amber-500 to-orange-600',
    'from-purple-500 to-pink-600',
    'from-red-500 to-rose-600',
    'from-indigo-500 to-violet-600',
  ];
  const colorIdx =
    (user?.id || '')
      .split('')
      .reduce((acc, c) => acc + c.charCodeAt(0), 0) % colors.length;

  return (
    <div
      className={`rounded-full bg-gradient-to-br ${colors[colorIdx]} flex items-center justify-center flex-shrink-0`}
      style={{ width: size, height: size }}
    >
      <span className="text-white font-bold" style={{ fontSize: size * 0.36 }}>
        {initials}
      </span>
    </div>
  );
};

// ─── Post Type Badge ──────────────────────────────────────
const PostTypeBadge = ({ type, metadata }) => {
  const config = POST_TYPE_CONFIG[type];
  if (!config?.label) return null;
  const Icon = config.icon;

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-${config.color}-500/10 text-${config.color}-400 border border-${config.color}-500/20`}
    >
      <Icon size={12} strokeWidth={1.5} />
      <span>{config.label}</span>
      {metadata?.pnl !== undefined && (
        <span className={metadata.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>
          {metadata.pnl >= 0 ? '+' : ''}${Math.abs(metadata.pnl).toLocaleString()}
        </span>
      )}
    </div>
  );
};

// ─── P&L Card (for pnl_share posts) ──────────────────────
const PnLCard = ({ metadata }) => {
  const pnlValue = Number(metadata?.pnl);
  if (!Number.isFinite(pnlValue)) return null;

  const isPositive = pnlValue >= 0;
  const percentValue = Number(metadata?.percent);
  const hasPercent = Number.isFinite(percentValue);
  const entryPrice = Number(metadata?.entry_price ?? metadata?.entryPrice);
  const exitPrice = Number(metadata?.exit_price ?? metadata?.exitPrice);
  const openedAt = metadata?.opened_at ?? metadata?.openedAt;
  const closedAt = metadata?.closed_at ?? metadata?.closedAt;
  const shares = Number(metadata?.shares ?? metadata?.qty ?? metadata?.quantity);
  const hasShares = Number.isFinite(shares) && shares > 0;
  const rawEmoji = metadata?.emoji;
  const emojis = Array.isArray(rawEmoji) ? rawEmoji : (rawEmoji ? [rawEmoji] : []);

  return (
    <div
      className={`mt-3 rounded-xl border overflow-hidden ${
        isPositive ? 'border-emerald-500/30 bg-emerald-500/[0.06]' : 'border-red-500/30 bg-red-500/[0.06]'
      }`}
    >
      <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
        <div className="text-xs tracking-[0.14em] uppercase text-gray-500">Stratify Bet Slip</div>
        {emojis.length > 0 && <div className="text-lg leading-none">{emojis.join(' ')}</div>}
      </div>

      <div className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.14em] text-gray-500">
              {metadata?.ticker ? `$${metadata.ticker}` : 'Portfolio'}
            </div>
            <div className={`text-2xl font-semibold font-mono ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
              {formatSignedCurrency(pnlValue)}
            </div>
          </div>
          {hasPercent && (
            <div className={`text-lg font-semibold font-mono ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
              {formatSignedPercent(percentValue)}
            </div>
          )}
        </div>

        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-gray-300">
          {Number.isFinite(entryPrice) && (
            <div className="rounded-lg border border-white/10 bg-black/20 px-2.5 py-2">
              <div className="text-[10px] uppercase tracking-[0.14em] text-gray-500 mb-1">Entry</div>
              <div className="font-mono">{formatCurrency(entryPrice)}</div>
            </div>
          )}
          {Number.isFinite(exitPrice) && (
            <div className="rounded-lg border border-white/10 bg-black/20 px-2.5 py-2">
              <div className="text-[10px] uppercase tracking-[0.14em] text-gray-500 mb-1">Exit</div>
              <div className="font-mono">{formatCurrency(exitPrice)}</div>
            </div>
          )}
          {openedAt && (
            <div className="rounded-lg border border-white/10 bg-black/20 px-2.5 py-2">
              <div className="text-[10px] uppercase tracking-[0.14em] text-gray-500 mb-1">Bought</div>
              <div>{formatDateTime(openedAt)}</div>
            </div>
          )}
          {closedAt && (
            <div className="rounded-lg border border-white/10 bg-black/20 px-2.5 py-2">
              <div className="text-[10px] uppercase tracking-[0.14em] text-gray-500 mb-1">Sold</div>
              <div>{formatDateTime(closedAt)}</div>
            </div>
          )}
          {hasShares && (
            <div className="rounded-lg border border-white/10 bg-black/20 px-2.5 py-2 sm:col-span-2">
              <div className="text-[10px] uppercase tracking-[0.14em] text-gray-500 mb-1">Size</div>
              <div className="font-mono">{shares.toLocaleString('en-US', { maximumFractionDigits: 4 })} shares</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const SLIP_EMOJIS = ['🚀', '💰', '👍', '👎', '🦍', '🔥', '📈', '📉'];

const BetSlipPanel = ({
  open,
  onClose,
  closedTrades = [],
  posting = false,
  onSubmit,
}) => {
  const [selectedTradeId, setSelectedTradeId] = useState('');
  const [note, setNote] = useState('');
  const [selectedEmojis, setSelectedEmojis] = useState([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelectedTradeId(closedTrades[0]?.id || '');
    setNote('');
    setSelectedEmojis([]);
    setCopied(false);
  }, [open, closedTrades]);

  const selectedTrade = useMemo(
    () => closedTrades.find((trade) => trade.id === selectedTradeId) || null,
    [closedTrades, selectedTradeId],
  );

  const shareText = useMemo(
    () => createSlipCaption({ trade: selectedTrade, emojis: selectedEmojis, note }),
    [selectedTrade, selectedEmojis, note],
  );

  const hasTradeSelection = Boolean(selectedTrade);

  const toggleEmoji = (emoji) => {
    setSelectedEmojis((prev) =>
      prev.includes(emoji) ? prev.filter((item) => item !== emoji) : [...prev, emoji]
    );
  };

  const copyShareText = async () => {
    if (!shareText) return;
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch (error) {
      console.warn('[CommunityPage] Failed to copy share text:', error);
    }
  };

  const shareToExternal = (platform) => {
    if (!shareText) return;
    const pageUrl = window.location.origin;
    let url = '';

    if (platform === 'x') {
      url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
    } else if (platform === 'facebook') {
      url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}&quote=${encodeURIComponent(shareText)}`;
    } else {
      void copyShareText();
      url = 'https://www.instagram.com/';
    }

    window.open(url, '_blank', 'noopener,noreferrer,width=980,height=720');
  };

  if (!open) return null;

  return (
    <div className="w-full rounded-2xl border border-[#21314f] bg-[#070b12] shadow-[0_22px_50px_rgba(0,0,0,0.45)] overflow-hidden">
      <div className="px-4 py-3 border-b border-[#1b2a45] flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-300/80">Share P&L</div>
          <h3 className="text-base font-semibold text-white">Bet Slip</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg border border-[#1b2a45] text-gray-400 hover:text-white hover:border-[#2e4a73] transition-colors"
          title="Hide panel"
        >
          <X size={14} />
        </button>
      </div>

      <div className="p-4 space-y-3">
        {closedTrades.length === 0 ? (
          <div className="rounded-xl border border-[#1a2233] bg-[#0b1019] p-4 text-sm text-gray-400">
            No completed trades found yet. Close a trade first, then you can share a generated slip.
          </div>
        ) : (
          <>
            <div>
              <label className="text-xs uppercase tracking-[0.14em] text-gray-500">Previous Trade</label>
              <select
                value={selectedTradeId}
                onChange={(e) => setSelectedTradeId(e.target.value)}
                className="mt-1.5 w-full bg-[#0b1019] border border-[#1e2e4b] rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/40"
              >
                {closedTrades.map((trade) => (
                  <option key={trade.id} value={trade.id}>
                    {trade.symbol} {formatSignedPercent(trade.percent)}
                  </option>
                ))}
              </select>
            </div>

            {selectedTrade && (
              <div className="rounded-2xl border border-[#203255] bg-gradient-to-br from-[#091321] via-[#0b1828] to-[#11161d]">
                <div className="px-3 py-2.5 border-b border-[#203255]/70 flex items-center justify-between">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-300/80">Stratify Ticket</div>
                  <div className={`text-xs font-semibold font-mono ${selectedTrade.pnl >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                    {formatSignedPercent(selectedTrade.percent)}
                  </div>
                </div>
                <div className="p-3 grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-black/25 border border-white/10 p-2.5">
                    <div className="text-[10px] uppercase tracking-[0.14em] text-gray-400 mb-1">Ticker</div>
                    <div className="text-xl font-semibold text-white">${selectedTrade.symbol}</div>
                  </div>
                  <div className="rounded-xl bg-black/25 border border-white/10 p-2.5">
                    <div className="text-[10px] uppercase tracking-[0.14em] text-gray-400 mb-1">Total P&L</div>
                    <div className={`text-lg font-semibold font-mono ${selectedTrade.pnl >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                      {formatSignedCurrency(selectedTrade.pnl)}
                    </div>
                  </div>
                  <div className="rounded-xl bg-black/25 border border-white/10 p-2.5">
                    <div className="text-[10px] uppercase tracking-[0.14em] text-gray-400 mb-1">Entry</div>
                    <div className="text-xs text-white font-mono">{formatCurrency(selectedTrade.entryPrice)}</div>
                  </div>
                  <div className="rounded-xl bg-black/25 border border-white/10 p-2.5">
                    <div className="text-[10px] uppercase tracking-[0.14em] text-gray-400 mb-1">Exit</div>
                    <div className="text-xs text-white font-mono">{formatCurrency(selectedTrade.exitPrice)}</div>
                  </div>
                  <div className="rounded-xl bg-black/25 border border-white/10 p-2.5">
                    <div className="text-[10px] uppercase tracking-[0.14em] text-gray-400 mb-1 flex items-center gap-1">
                      <CalendarDays size={11} />
                      Bought
                    </div>
                    <div className="text-xs text-white">{formatDateTime(selectedTrade.openedAt)}</div>
                  </div>
                  <div className="rounded-xl bg-black/25 border border-white/10 p-2.5">
                    <div className="text-[10px] uppercase tracking-[0.14em] text-gray-400 mb-1 flex items-center gap-1">
                      <Clock3 size={11} />
                      Sold
                    </div>
                    <div className="text-xs text-white">{formatDateTime(selectedTrade.closedAt)}</div>
                  </div>
                  <div className="rounded-xl bg-black/25 border border-white/10 p-2.5 col-span-2">
                    <div className="text-[10px] uppercase tracking-[0.14em] text-gray-400 mb-1">Size</div>
                    <div className="text-xs text-white font-mono">
                      {selectedTrade.shares.toLocaleString('en-US', { maximumFractionDigits: 4 })} shares
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div>
              <div className="text-xs uppercase tracking-[0.14em] text-gray-500 mb-1.5">Customize</div>
              <div className="flex flex-wrap items-center gap-1.5">
                {SLIP_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => toggleEmoji(emoji)}
                    className={`h-8 w-8 rounded-lg border text-base transition-colors ${
                      selectedEmojis.includes(emoji)
                        ? 'border-cyan-400/70 bg-cyan-400/15'
                        : 'border-[#1e2b44] bg-[#0b1019] hover:border-[#33507a]'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs uppercase tracking-[0.14em] text-gray-500">Caption (optional)</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add context before sharing..."
                rows={2}
                className="mt-1.5 w-full bg-[#0b1019] border border-[#1e2e4b] rounded-xl px-3 py-2 text-sm text-gray-100 placeholder-gray-600 outline-none focus:border-cyan-400/40 resize-none"
              />
            </div>

            <div className="rounded-xl border border-[#1f2a3f] bg-[#0b1019] p-3">
              <div className="text-xs uppercase tracking-[0.14em] text-gray-500 mb-1.5">Generated Post</div>
              <pre className="text-[11px] text-gray-200 whitespace-pre-wrap break-words font-sans leading-relaxed">
                {shareText}
              </pre>
            </div>
          </>
        )}
      </div>

      <div className="px-4 py-3 border-t border-[#1b2a45] bg-[#060a11] flex flex-col gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={copyShareText}
            disabled={!hasTradeSelection}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#30496f] text-cyan-300 text-[11px] hover:border-cyan-300/60 disabled:opacity-40 transition-colors"
          >
            <Copy size={11} />
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button
            type="button"
            onClick={() => shareToExternal('x')}
            disabled={!hasTradeSelection}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#30496f] text-cyan-300 text-[11px] hover:border-cyan-300/60 disabled:opacity-40 transition-colors"
          >
            <ExternalLink size={11} />
            X
          </button>
          <button
            type="button"
            onClick={() => shareToExternal('instagram')}
            disabled={!hasTradeSelection}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#30496f] text-cyan-300 text-[11px] hover:border-cyan-300/60 disabled:opacity-40 transition-colors"
          >
            <ExternalLink size={11} />
            Instagram
          </button>
          <button
            type="button"
            onClick={() => shareToExternal('facebook')}
            disabled={!hasTradeSelection}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#30496f] text-cyan-300 text-[11px] hover:border-cyan-300/60 disabled:opacity-40 transition-colors"
          >
            <ExternalLink size={11} />
            Facebook
          </button>
        </div>
        <button
          type="button"
          onClick={() => {
            if (!selectedTrade || !onSubmit) return;
            onSubmit({
              trade: selectedTrade,
              caption: shareText,
              emojis: selectedEmojis,
              note: note.trim(),
            });
          }}
          disabled={!hasTradeSelection || posting}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-cyan-500 text-black text-sm font-semibold hover:bg-cyan-400 disabled:bg-gray-700 disabled:text-gray-500 transition-colors"
        >
          {posting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} strokeWidth={2} />}
          Post to Community
        </button>
      </div>
    </div>
  );
};

const pnlShowcaseStyles = `
  @keyframes pnlSlipRiseIn {
    0% { opacity: 0; transform: translateY(34px) scale(0.95); }
    100% { opacity: 1; transform: translateY(0) scale(1); }
  }

  @keyframes pnlStarDrift {
    0% { transform: translate3d(0, 0, 0) scale(1.1); }
    100% { transform: translate3d(-180px, -220px, 0) scale(1.1); }
  }

  @keyframes pnlFireballBurst {
    0% { opacity: 0; transform: scale(0.35) translateY(35px); }
    40% { opacity: 0.95; }
    100% { opacity: 0; transform: scale(1.9) translateY(-45px); }
  }

  @keyframes pnlIcePulse {
    0% { opacity: 0; transform: scale(0.5); }
    45% { opacity: 0.85; }
    100% { opacity: 0; transform: scale(1.8); }
  }

  .pnl-showcase-stars {
    position: absolute;
    inset: -20%;
    background-image:
      radial-gradient(1px 1px at 16px 22px, rgba(255,255,255,0.88), transparent),
      radial-gradient(1px 1px at 74px 114px, rgba(196,181,253,0.75), transparent),
      radial-gradient(1px 1px at 132px 46px, rgba(186,230,253,0.82), transparent),
      radial-gradient(1px 1px at 204px 180px, rgba(255,255,255,0.65), transparent);
    background-size: 240px 240px;
    animation: pnlStarDrift 30s linear infinite;
    opacity: 0.45;
  }

  .pnl-showcase-stars.pnl-showcase-stars--slow {
    opacity: 0.26;
    animation-duration: 55s;
    transform: scale(1.35);
  }

  .pnl-showcase-slip {
    animation: pnlSlipRiseIn 0.52s cubic-bezier(0.22, 1, 0.36, 1);
  }
`;

const PnlShowcaseOverlay = ({ trade, onClose }) => {
  useEffect(() => {
    if (!trade) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [trade, onClose]);

  const isWin = Number(trade?.pnl) >= 0;

  return (
    <AnimatePresence>
      {trade ? (
        <motion.div
          key={trade.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[140] overflow-hidden"
        >
          <style>{pnlShowcaseStyles}</style>
          <button
            type="button"
            aria-label="Close showcase"
            className="absolute inset-0 bg-[#02050c]/90"
            onClick={onClose}
          />
          <div className="pnl-showcase-stars" />
          <div className="pnl-showcase-stars pnl-showcase-stars--slow" />

          <div className="pointer-events-none absolute inset-0">
            {[...Array(6)].map((_, index) => (
              <span
                key={`fx-${index}`}
                className={`absolute rounded-full blur-2xl ${isWin ? 'bg-emerald-500/55' : 'bg-cyan-300/45'}`}
                style={{
                  width: `${120 + (index * 16)}px`,
                  height: `${120 + (index * 16)}px`,
                  left: `${12 + (index * 13)}%`,
                  top: `${14 + ((index * 11) % 58)}%`,
                  animation: `${isWin ? 'pnlFireballBurst' : 'pnlIcePulse'} ${2.4 + (index * 0.18)}s ease-out ${index * 0.12}s infinite`,
                }}
              />
            ))}
          </div>

          <div className="absolute inset-0 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.97 }}
              transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
              className={`pnl-showcase-slip relative w-full max-w-2xl rounded-2xl border backdrop-blur-sm shadow-[0_26px_120px_rgba(0,0,0,0.72)] ${
                isWin
                  ? 'border-emerald-400/45 bg-gradient-to-br from-emerald-500/16 via-[#061115]/92 to-[#04090d]/94'
                  : 'border-cyan-300/45 bg-gradient-to-br from-cyan-300/14 via-[#05111c]/92 to-[#04090d]/94'
              }`}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="px-5 py-4 border-b border-white/10 flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.22em] text-gray-300/80">Underground Bet Slip</div>
                  <h3 className="mt-1 text-2xl font-semibold text-white">${trade.ticker}</h3>
                  <p className="mt-1 text-xs text-gray-300/75">Shared by {trade.author}</p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-white/20 bg-black/25 px-2 py-1 text-xs text-gray-200 hover:border-white/40"
                >
                  Close
                </button>
              </div>

              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-sm">
                <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-gray-400 mb-1">P&L</div>
                  <div className={`text-2xl font-semibold font-mono ${isWin ? 'text-emerald-300' : 'text-cyan-200'}`}>
                    {formatSignedCurrency(trade.pnl)}
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-gray-400 mb-1">Return</div>
                  <div className={`text-2xl font-semibold font-mono ${isWin ? 'text-emerald-300' : 'text-cyan-200'}`}>
                    {Number.isFinite(trade.percent) ? formatSignedPercent(trade.percent) : '—'}
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-gray-400 mb-1">Entry</div>
                  <div className="text-white font-mono">{Number.isFinite(trade.entryPrice) ? formatCurrency(trade.entryPrice) : '—'}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-gray-400 mb-1">Exit</div>
                  <div className="text-white font-mono">{Number.isFinite(trade.exitPrice) ? formatCurrency(trade.exitPrice) : '—'}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-gray-400 mb-1">Opened</div>
                  <div className="text-white">{formatDateTime(trade.openedAt || trade.createdAt)}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-gray-400 mb-1">Closed</div>
                  <div className="text-white">{formatDateTime(trade.closedAt || trade.createdAt)}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/25 p-3 sm:col-span-2">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-gray-400 mb-1">Position Size</div>
                  <div className="text-white font-mono">
                    {Number.isFinite(trade.shares) ? `${trade.shares.toLocaleString('en-US', { maximumFractionDigits: 4 })} shares` : '—'}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};

const TrendingPnlPanel = ({ wins = [], losses = [], loading = false, onSelectTrade }) => {
  const renderRow = (item, label) => (
    <button
      key={`${label}-${item.id}`}
      type="button"
      onClick={() => onSelectTrade?.(item)}
      className="w-full text-left rounded-xl border border-white/10 bg-black/20 px-2.5 py-2 hover:border-cyan-300/50 hover:bg-black/35 transition-colors"
    >
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-white">${item.ticker}</div>
        <div className={`text-xs font-semibold font-mono ${item.pnl >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
          {formatSignedCurrency(item.pnl)}
        </div>
      </div>
      <div className="mt-1 flex items-center justify-between text-[11px] text-gray-400">
        <span className="truncate pr-2">{item.author}</span>
        <span>{Number.isFinite(item.percent) ? formatSignedPercent(item.percent) : '—'}</span>
      </div>
    </button>
  );

  return (
    <div className="w-full rounded-2xl border border-gray-800/60 bg-black/30 backdrop-blur-sm overflow-hidden xl:max-h-[46vh] flex flex-col">
      <div className="px-4 py-3 border-b border-gray-800/70">
        <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-300/80">Trending</div>
        <h3 className="text-base font-semibold text-white">Wins & Losses</h3>
      </div>
      <div className="p-4 space-y-3 overflow-y-auto">
        {loading ? (
          <div className="text-xs text-gray-500">Loading trend tape...</div>
        ) : (
          <>
            <div>
              <div className="text-[11px] uppercase tracking-[0.14em] text-emerald-300/90 mb-2">Top Wins</div>
              <div className="space-y-2">
                {wins.length > 0 ? wins.map((item) => renderRow(item, 'win')) : (
                  <div className="text-xs text-gray-500">No winning slips posted yet.</div>
                )}
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.14em] text-red-300/90 mb-2">Top Losses</div>
              <div className="space-y-2">
                {losses.length > 0 ? losses.map((item) => renderRow(item, 'loss')) : (
                  <div className="text-xs text-gray-500">No losing slips posted yet.</div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ─── Compose Box ──────────────────────────────────────────
const ComposeBox = ({ currentUser, onPost, onOpenBetSlip, betSlipOpen = false }) => {
  const [content, setContent] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [postType, setPostType] = useState('post');
  const [posting, setPosting] = useState(false);
  const fileRef = useRef(null);
  const textRef = useRef(null);

  const createPost = useCallback(
    async ({ contentText, metadata = {}, postKind = 'post', imageUrl = null }) => {
      const { data: newPost, error } = await supabase
        .from('community_posts')
        .insert({
          user_id: currentUser.id,
          author_name: currentUser.display_name || currentUser.email?.split('@')[0] || 'Trader',
          content: contentText,
          image_url: imageUrl,
          ticker_mentions: extractTickers(contentText),
          post_type: postKind,
          metadata,
        })
        .select('*')
        .single();

      if (error) throw error;

      if (newPost && onPost) {
        const postWithProfile = {
          ...newPost,
          community_reactions: [],
          reaction_summary: [],
          profiles: {
            id: currentUser.id,
            display_name: currentUser.display_name,
            avatar_url: currentUser.avatar_url,
            email: currentUser.email,
          },
        };
        onPost(postWithProfile);
      }
    },
    [currentUser, onPost],
  );

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be under 5MB');
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const resetComposer = useCallback(() => {
    setContent('');
    setImageFile(null);
    setImagePreview(null);
    setPostType('post');
    if (fileRef.current) fileRef.current.value = '';
  }, []);

  const handleSubmit = async () => {
    if (!content.trim() && !imageFile) return;
    setPosting(true);

    try {
      const safePostType = ['post', 'strategy_share', 'trade_share', 'alert_share'].includes(postType)
        ? postType
        : 'post';
      let imageUrl = null;

      if (imageFile) {
        const ext = imageFile.name.split('.').pop();
        const fileName = `${currentUser.id}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('community-images')
          .upload(fileName, imageFile);

        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = supabase.storage.from('community-images').getPublicUrl(fileName);
        imageUrl = publicUrl;
      }

      await createPost({
        contentText: content.trim(),
        postKind: safePostType,
        imageUrl,
      });

      resetComposer();
    } catch (err) {
      console.error('Post failed:', err);
      alert('Failed to post. Try again.');
    } finally {
      setPosting(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSubmit();
    }
  };

  return (
    <div className="bg-[#111111] border border-[#1f1f1f] rounded-2xl p-4 mb-4">
      <div className="flex gap-3">
        <UserAvatar user={currentUser} size={40} />
        <div className="flex-1 min-w-0">
          <textarea
            ref={textRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Share a trade, strategy, or insight..."
            className="w-full bg-transparent text-gray-100 placeholder-gray-600 text-sm resize-none outline-none min-h-[60px] max-h-[200px]"
            rows={2}
          />

          {imagePreview && (
            <div className="relative mt-2 inline-block">
              <img
                src={imagePreview}
                alt="Upload preview"
                className="max-h-48 rounded-xl border border-[#1f1f1f] object-cover"
              />
              <button
                onClick={removeImage}
                className="absolute top-2 right-2 p-1 bg-black/70 rounded-full hover:bg-black/90 transition-colors"
              >
                <X size={14} className="text-white" />
              </button>
            </div>
          )}

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#1a1a1a]">
            <div className="flex items-center gap-1">
              <input
                type="file"
                ref={fileRef}
                onChange={handleImageSelect}
                accept="image/*"
                className="hidden"
              />
              <button
                onClick={() => fileRef.current?.click()}
                className="p-2 rounded-lg hover:bg-white/5 text-gray-500 hover:text-cyan-400 transition-colors"
                title="Add image"
              >
                <Camera size={18} strokeWidth={1.5} />
              </button>

              <button
                onClick={() => onOpenBetSlip?.()}
                className={`p-2 rounded-lg hover:bg-white/5 transition-colors ${
                  betSlipOpen ? 'text-emerald-400' : 'text-gray-500 hover:text-emerald-400'
                }`}
                title="Share P&L"
              >
                <TrendingUp size={18} strokeWidth={1.5} />
              </button>

              <button
                onClick={() => setPostType(postType === 'strategy_share' ? 'post' : 'strategy_share')}
                className={`p-2 rounded-lg hover:bg-white/5 transition-colors ${
                  postType === 'strategy_share' ? 'text-cyan-400' : 'text-gray-500 hover:text-cyan-400'
                }`}
                title="Share Strategy"
              >
                <Zap size={18} strokeWidth={1.5} />
              </button>

              <button
                onClick={() => setPostType(postType === 'trade_share' ? 'post' : 'trade_share')}
                className={`p-2 rounded-lg hover:bg-white/5 transition-colors ${
                  postType === 'trade_share' ? 'text-blue-400' : 'text-gray-500 hover:text-blue-400'
                }`}
                title="Share Trade"
              >
                <BarChart3 size={18} strokeWidth={1.5} />
              </button>

              {postType !== 'post' && (
                <span className="text-xs text-gray-600 ml-2">
                  Posting as <span className="text-gray-400">{POST_TYPE_CONFIG[postType]?.label}</span>
                </span>
              )}
            </div>

            <button
              onClick={handleSubmit}
              disabled={posting || (!content.trim() && !imageFile)}
              className="flex items-center gap-2 px-4 py-1.5 bg-cyan-500 hover:bg-cyan-400 disabled:bg-gray-700 disabled:text-gray-500 text-black font-semibold text-sm rounded-full transition-colors"
            >
              {posting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} strokeWidth={2} />}
              Post
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const ReactionBar = ({ postId, currentUser, initialReactions = [], compact = false, inActionRow = false }) => {
  const [reactions, setReactions] = useState(initialReactions || []);
  const [showPicker, setShowPicker] = useState(false);
  const isInteractive = Boolean(currentUser?.id);

  useEffect(() => {
    setReactions(initialReactions || []);
    setShowPicker(false);
  }, [postId, initialReactions]);

  const toggleReaction = async (emoji) => {
    if (!currentUser?.id || !emoji) return;

    const target = reactions.find((reaction) => reaction.emoji === emoji);
    const shouldReact = !target?.reacted;
    const previousReactions = [...reactions];

    console.log('[CommunityPage] Toggle reaction requested:', {
      postId,
      userId: currentUser.id,
      emoji,
      shouldReact,
    });

    setReactions((prev) => applyReactionState(prev, emoji, shouldReact));

    try {
      if (shouldReact) {
        const payload = {
          post_id: postId,
          user_id: currentUser.id,
          emoji,
        };
        console.log('[CommunityPage] Inserting reaction:', payload);
        const { error } = await supabase.from('community_reactions').insert(payload);

        // Duplicate insertion means the user already reacted in another session.
        if (error && error.code !== '23505') throw error;
        console.log('[CommunityPage] Reaction insert completed:', {
          postId,
          emoji,
          duplicate: error?.code === '23505',
        });
      } else {
        console.log('[CommunityPage] Removing reaction:', {
          postId,
          userId: currentUser.id,
          emoji,
        });
        const { error } = await supabase
          .from('community_reactions')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', currentUser.id)
          .eq('emoji', emoji);

        if (error) throw error;
        console.log('[CommunityPage] Reaction removal completed:', { postId, emoji });
      }
    } catch (err) {
      console.error('[CommunityPage] Failed to toggle reaction:', {
        postId,
        emoji,
        shouldReact,
        err,
      });
      setReactions(previousReactions);
    }
  };

  const renderTrigger = () => {
    // Don't render button if no user is logged in
    if (!currentUser?.id) return null;

    return (
      <span className="relative inline-flex">
        <button
          type="button"
          onClick={() => setShowPicker((open) => !open)}
          disabled={!isInteractive}
          className={
            inActionRow
              ? `inline-flex items-center gap-1.5 text-xs transition-colors ${
                  isInteractive ? 'text-gray-600 hover:text-gray-300' : 'text-gray-700 cursor-not-allowed'
                }`
              : `inline-flex items-center justify-center rounded-full border px-2.5 ${
                  compact ? 'h-7 w-7' : 'h-8 w-8'
                } transition-colors ${
                  isInteractive
                    ? 'border-[#2a2a2a] bg-[#121212] text-gray-400 hover:text-gray-200 hover:border-[#3a3a3a]'
                    : 'border-[#232323] bg-[#101010] text-gray-600 cursor-not-allowed'
                }`
          }
          title={isInteractive ? 'Add reaction' : 'Sign in to react'}
        >
          <SmilePlus size={compact ? 13 : 15} strokeWidth={1.8} />
          {inActionRow && <span>React</span>}
        </button>

        {showPicker && isInteractive && (
          <EmojiPicker
            align={compact ? 'right' : 'left'}
            onClose={() => setShowPicker(false)}
            onSelect={(emoji) => {
              console.log('[CommunityPage] Emoji selected from picker:', {
                postId,
                userId: currentUser?.id,
                emoji,
              });
              setShowPicker(false);
              void toggleReaction(emoji);
            }}
          />
        )}
      </span>
    );
  };

  return (
    inActionRow ? (
      <>
        {renderTrigger()}
        {reactions.length > 0 && (
          <div className="w-full mt-1.5 flex flex-wrap items-center gap-1.5">
            <AnimatePresence initial={false}>
              {reactions.map((reaction) => (
                <motion.button
                  key={`${postId}-${reaction.emoji}`}
                  layout
                  initial={{ opacity: 0, scale: 0.86 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.86 }}
                  transition={{ duration: 0.16 }}
                  type="button"
                  onClick={() => void toggleReaction(reaction.emoji)}
                  disabled={!isInteractive}
                  className={`inline-flex items-center gap-1 transition-colors ${
                    compact ? 'text-[11px]' : 'text-xs'
                  } ${
                    reaction.reacted
                      ? 'text-cyan-400'
                      : 'text-gray-400 hover:text-gray-300'
                  } ${!isInteractive ? 'opacity-70 cursor-not-allowed' : ''}`}
                  title={isInteractive ? 'Toggle reaction' : 'Sign in to react'}
                >
                  <EmojiGlyph emoji={reaction.emoji} size={16} />
                  <span className="font-semibold">{reaction.count}</span>
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
        )}
      </>
    ) : (
      <div className={compact ? 'mt-1.5' : 'mt-2.5'}>
        <div className="flex flex-wrap items-center gap-1.5">
          {renderTrigger()}
          <AnimatePresence initial={false}>
            {reactions.map((reaction) => (
              <motion.button
                key={`${postId}-${reaction.emoji}`}
                layout
                initial={{ opacity: 0, scale: 0.86 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.86 }}
                transition={{ duration: 0.16 }}
                type="button"
                onClick={() => void toggleReaction(reaction.emoji)}
                disabled={!isInteractive}
                className={`inline-flex items-center gap-1 transition-colors ${
                  compact ? 'text-[11px]' : 'text-xs'
                } ${
                  reaction.reacted
                    ? 'text-cyan-400'
                    : 'text-gray-400 hover:text-gray-300'
                } ${!isInteractive ? 'opacity-70 cursor-not-allowed' : ''}`}
                title={isInteractive ? 'Toggle reaction' : 'Sign in to react'}
              >
                <EmojiGlyph emoji={reaction.emoji} size={16} />
                <span className="font-semibold">{reaction.count}</span>
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      </div>
    )
  );
};

// ─── Single Post Component ────────────────────────────────
const PostCard = ({ post, currentUser, onDelete }) => {
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(post.likes_count || post.likes || 0);
  const [showReplies, setShowReplies] = useState(false);
  const [replies, setReplies] = useState([]);
  const [replyContent, setReplyContent] = useState('');
  const [replying, setReplying] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const initialReactions = useMemo(() => {
    if (Array.isArray(post.reaction_summary)) return post.reaction_summary;
    return buildReactionSummary(post.community_reactions || [], currentUser?.id);
  }, [post.reaction_summary, post.community_reactions, currentUser?.id]);

  // Check if current user liked this post
  useEffect(() => {
    if (!currentUser) return;
    const checkLike = async () => {
      const { data } = await supabase
        .from('community_likes')
        .select('id')
        .eq('post_id', post.id)
        .eq('user_id', currentUser.id)
        .maybeSingle();
      if (data) setLiked(true);
    };
    checkLike();
  }, [post.id, currentUser]);

  const toggleLike = async () => {
    if (!currentUser) return;

    if (liked) {
      setLiked(false);
      setLikesCount((c) => c - 1);
      await supabase
        .from('community_likes')
        .delete()
        .eq('post_id', post.id)
        .eq('user_id', currentUser.id);
    } else {
      setLiked(true);
      setLikesCount((c) => c + 1);
      await supabase
        .from('community_likes')
        .insert({ post_id: post.id, user_id: currentUser.id });
    }
  };

  const loadReplies = async () => {
    setLoadingReplies(true);
    const { data, error } = await supabase
      .from('community_posts')
      .select('*, profiles:user_id(id, display_name, avatar_url, email), community_reactions(emoji, user_id)')
      .or(`parent_id.eq.${post.id},parent_post_id.eq.${post.id}`)
      .order('created_at', { ascending: true });
    
    if (error) {
      console.error('[CommunityPage] Failed to load replies:', error);
      setLoadingReplies(false);
      return;
    }

    const mappedReplies = (data || []).map((reply) => ({
      ...reply,
      reaction_summary: buildReactionSummary(reply.community_reactions || [], currentUser?.id),
    }));
    console.log('[CommunityPage] Replies loaded:', {
      postId: post.id,
      count: mappedReplies.length,
      data: mappedReplies,
    });
    setReplies((prev) => {
      if (prev.length === 0) return mappedReplies;

      const merged = new Map(prev.map((reply) => [reply.id, reply]));
      mappedReplies.forEach((reply) => {
        merged.set(reply.id, reply);
      });

      return sortByCreatedAtAsc(Array.from(merged.values()));
    });
    setLoadingReplies(false);
  };

  const toggleReplies = () => {
    if (!showReplies && replies.length === 0) {
      loadReplies();
    }
    setShowReplies(!showReplies);
  };

  useEffect(() => {
    setReplies((prev) =>
      prev.map((reply) => ({
        ...reply,
        reaction_summary: buildReactionSummary(reply.community_reactions || [], currentUser?.id),
      }))
    );
  }, [currentUser?.id]);

  const submitReply = async () => {
    if (replying || !replyContent.trim() || !currentUser) return;

    const trimmedReply = replyContent.trim();
    setReplying(true);

    try {
      const { data: insertedReply, error } = await supabase
        .from('community_posts')
        .insert({
          user_id: currentUser.id,
          author_name: currentUser.display_name || currentUser.email?.split('@')[0] || 'Trader',
          content: trimmedReply,
          parent_id: post.id,
          parent_post_id: post.id,
          ticker_mentions: extractTickers(trimmedReply),
        })
        .select('*, profiles:user_id(id, display_name, avatar_url, email), community_reactions(emoji, user_id)')
        .single();

      if (error) {
        console.error('[CommunityPage] Reply insert error:', error);
      } else {
        console.log('[CommunityPage] Reply inserted:', insertedReply);
        const mappedReply = {
          ...insertedReply,
          profiles: insertedReply.profiles || {
            id: currentUser.id,
            display_name: currentUser.display_name,
            avatar_url: currentUser.avatar_url,
            email: currentUser.email,
          },
          reaction_summary: buildReactionSummary(insertedReply.community_reactions || [], currentUser?.id),
        };

        setReplies((prev) => {
          if (prev.some((reply) => reply.id === mappedReply.id)) return prev;
          return sortByCreatedAtAsc([...prev, mappedReply]);
        });

        setReplyContent('');
        setShowReplies(true);
      }
    } catch (err) {
      console.error('[CommunityPage] Reply failed:', err);
    } finally {
      setReplying(false);
    }
  };

  const user = post.profiles || {
    display_name: post.author_name,
    avatar_url: post.metadata?.bot_avatar_url,
  };
  const isOwner = currentUser?.id === post.user_id;
  const repliesCount = replies.length > 0 ? replies.length : (post.replies_count ?? post.comments_count ?? 0);

  return (
    <div className="bg-[#111111] border border-[#1f1f1f] rounded-2xl p-4 hover:border-[#2a2a2a] transition-colors">
      <div className="flex gap-3">
        <UserAvatar user={user} size={40} />

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-semibold text-gray-100 text-sm truncate">
                {user.display_name || post.author_name || user.email?.split('@')[0] || 'Trader'}
              </span>
              <span className="text-gray-600 text-xs">•</span>
              <span className="text-gray-600 text-xs flex-shrink-0">{timeAgo(post.created_at)}</span>
              <PostTypeBadge type={post.post_type} metadata={post.metadata} />
            </div>

            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-1 rounded hover:bg-white/5 text-gray-600 hover:text-gray-400 transition-colors"
              >
                <MoreHorizontal size={16} strokeWidth={1.5} />
              </button>
              {showMenu && (
                <div className="absolute right-0 top-8 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl shadow-xl py-1 z-20 min-w-[140px]">
                  <button
                    onClick={() => {
                      shareToX(post);
                      setShowMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-300 hover:bg-white/5 transition-colors"
                  >
                    <Share2 size={13} strokeWidth={1.5} />
                    Share to X
                  </button>
                  {isOwner && (
                    <button
                      onClick={() => {
                        onDelete?.(post.id);
                        setShowMenu(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-white/5 transition-colors"
                    >
                      <Trash2 size={13} strokeWidth={1.5} />
                      Delete
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Content */}
          <div
            className="text-gray-300 text-sm leading-relaxed mb-2 break-words"
            dangerouslySetInnerHTML={{ __html: highlightTickers(post.content) }}
          />

          {/* P&L Card */}
          {post.post_type === 'pnl_share' && <PnLCard metadata={post.metadata} />}

          {/* Image */}
          {post.image_url && (
            <div className="mt-3">
              <img
                src={post.image_url}
                alt="Post attachment"
                className="max-w-full max-h-[400px] rounded-xl border border-[#1f1f1f] object-cover cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => window.open(post.image_url, '_blank')}
              />
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-4 mt-3 pt-2">
            <button
              onClick={toggleLike}
              className={`inline-flex items-center gap-1.5 text-xs transition-colors ${
                liked ? 'text-red-400' : 'text-gray-600 hover:text-red-400'
              }`}
            >
              <Heart size={15} strokeWidth={1.5} fill={liked ? 'currentColor' : 'none'} />
              <span>Like</span>
              {likesCount > 0 && <span className="text-[11px] text-gray-500">{likesCount}</span>}
            </button>

            <button
              onClick={toggleReplies}
              className="inline-flex items-center gap-1.5 text-xs text-gray-600 hover:text-cyan-400 transition-colors"
            >
              <MessageCircle size={15} strokeWidth={1.5} />
              <span>Reply</span>
              {repliesCount > 0 && <span className="text-[11px] text-gray-500">{repliesCount}</span>}
            </button>

            <button
              onClick={() => shareToX(post)}
              className="inline-flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-300 transition-colors"
            >
              <Share2 size={15} strokeWidth={1.5} />
              <span>Share</span>
            </button>

            <ReactionBar
              postId={post.id}
              currentUser={currentUser}
              initialReactions={initialReactions}
              inActionRow
            />
          </div>

          {/* Replies Section */}
          {showReplies && (
            <div className="mt-3 pt-3 border-t border-[#1a1a1a]">
              {loadingReplies ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 size={16} className="animate-spin text-gray-600" />
                </div>
              ) : (
                <div className="space-y-3">
                  {replies.map((reply) => {
                    const replyUser = reply.profiles || {
                      display_name: reply.author_name,
                      avatar_url: reply.metadata?.bot_avatar_url,
                    };
                    return (
                      <div key={reply.id} className="flex gap-2.5">
                        <UserAvatar user={replyUser} size={28} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-medium text-gray-200 text-xs">
                              {replyUser.display_name || reply.author_name || replyUser.email?.split('@')[0] || 'Trader'}
                            </span>
                            <span className="text-gray-700 text-xs">{timeAgo(reply.created_at)}</span>
                          </div>
                          <div
                            className="text-gray-400 text-xs leading-relaxed break-words"
                            dangerouslySetInnerHTML={{ __html: highlightTickers(reply.content) }}
                          />
                          <ReactionBar
                            postId={reply.id}
                            currentUser={currentUser}
                            initialReactions={reply.reaction_summary || []}
                            compact
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Reply Input */}
              <div className="flex items-center gap-2 mt-3">
                <UserAvatar user={currentUser} size={24} />
                <input
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return;
                    e.preventDefault();
                    void submitReply();
                  }}
                  placeholder="Write a reply..."
                  className="flex-1 bg-[#0b0b0b] border border-[#1f1f1f] rounded-full px-3 py-1.5 text-xs text-gray-200 placeholder-gray-600 outline-none focus:border-cyan-500/30 transition-colors"
                />
                <button
                  onClick={submitReply}
                  disabled={replying || !replyContent.trim()}
                  className="p-1.5 rounded-full bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 disabled:opacity-30 transition-colors"
                >
                  {replying ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Send size={12} strokeWidth={2} />
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Filter Tabs ──────────────────────────────────────────
const FilterTabs = ({ active, onChange }) => {
  const tabs = [
    { key: 'all', label: 'All' },
    { key: 'pnl_share', label: 'P&L' },
    { key: 'strategy_share', label: 'Strategies' },
    { key: 'trade_share', label: 'Trades' },
    { key: 'alert_share', label: 'Alerts' },
  ];

  return (
    <div className="flex items-center gap-1 mb-4 overflow-x-auto scrollbar-hide">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
            active === tab.key
              ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
              : 'text-gray-500 hover:text-gray-300 hover:bg-white/5 border border-transparent'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
};

// ─── Main Community Page ──────────────────────────────────
const CommunityPage = ({ tradeHistory = [] }) => {
  const [posts, setPosts] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [pnlPanelOpen, setPnlPanelOpen] = useState(false);
  const [pnlPosting, setPnlPosting] = useState(false);
  const [trendingRows, setTrendingRows] = useState([]);
  const [trendingLoading, setTrendingLoading] = useState(false);
  const [showcaseTrade, setShowcaseTrade] = useState(null);
  const PAGE_SIZE = 20;

  const closedTrades = useMemo(
    () => buildClosedTradesForSlip(tradeHistory).slice(0, 120),
    [tradeHistory],
  );

  const prependPost = useCallback((newPost) => {
    setPosts((prev) => {
      if (prev.some((post) => post.id === newPost.id)) return prev;
      return [newPost, ...prev];
    });
  }, []);

  const upsertTrendingRow = useCallback((post) => {
    if (!post || post.post_type !== 'pnl_share') return;
    setTrendingRows((prev) => [post, ...prev.filter((item) => item.id !== post.id)].slice(0, 160));
  }, []);

  const removeTrendingRow = useCallback((postId) => {
    if (!postId) return;
    setTrendingRows((prev) => prev.filter((item) => item.id !== postId));
  }, []);

  useEffect(() => {
    const getUser = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .maybeSingle();

          setCurrentUser({
            id: user.id,
            email: user.email,
            display_name: profile?.display_name || user.user_metadata?.full_name || user.email?.split('@')[0],
            avatar_url: profile?.avatar_url || user.user_metadata?.avatar_url,
          });
        }
      } catch (err) {
        console.error('[CommunityPage] Failed to get user:', err);
      }
    };
    getUser();
  }, []);

  useEffect(() => {
    if (!currentUser?.id) return;

    setPosts((prevPosts) =>
      prevPosts.map((post) => ({
        ...post,
        reaction_summary: buildReactionSummary(post.community_reactions || [], currentUser.id),
      }))
    );
  }, [currentUser?.id]);

  useEffect(() => {
    const verifyReactionsTable = async () => {
      const { error } = await supabase
        .from('community_reactions')
        .select('id')
        .limit(1);

      if (error) {
        console.error('[CommunityPage] community_reactions table check failed:', error);
        if (error.code === '42P01') {
          console.warn('[CommunityPage] Missing table. Run migration: supabase/migrations/003_community_reactions.sql');
        }
      }
    };

    verifyReactionsTable();
  }, []);

  const fetchTrendingPnl = useCallback(async () => {
    setTrendingLoading(true);
    try {
      const { data, error } = await supabase
        .from('community_posts')
        .select('id, user_id, author_name, created_at, metadata, post_type, parent_id, parent_post_id, profiles:user_id(display_name, email)')
        .eq('post_type', 'pnl_share')
        .is('parent_id', null)
        .is('parent_post_id', null)
        .order('created_at', { ascending: false })
        .limit(160);

      if (error) throw error;
      setTrendingRows(Array.isArray(data) ? data : []);
    } catch (error) {
      console.warn('[CommunityPage] Failed to load trending pnl posts:', error);
      setTrendingRows([]);
    } finally {
      setTrendingLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrendingPnl();
  }, [fetchTrendingPnl]);

  const fetchPosts = useCallback(
    async (pageNum = 0, append = false) => {
      setLoading(!append);

      try {
        const { error: testError } = await supabase
          .from('community_posts')
          .select('id')
          .limit(1);

        if (testError) {
          console.error('[CommunityPage] community_posts table check failed:', testError);
          if (testError.code === '42P01') {
            alert('Community feature is not yet set up. Please contact support to enable the community_posts table.');
            setLoading(false);
            return;
          }
        }

        const runPostsQuery = (withReactions) => {
          let query = supabase
            .from('community_posts')
            .select(withReactions ? '*, community_reactions(emoji, user_id)' : '*')
            .is('parent_id', null)
            .is('parent_post_id', null)
            .order('created_at', { ascending: false })
            .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1);

          if (filter !== 'all') {
            query = query.eq('post_type', filter);
          }

          return query;
        };

        let { data: postsData, error: postsError } = await runPostsQuery(true);
        if (postsError && postsError.message?.includes('community_reactions')) {
          const fallback = await runPostsQuery(false);
          postsData = fallback.data;
          postsError = fallback.error;
        }

        if (postsError) {
          console.error('[CommunityPage] fetchPosts query error:', postsError);
          setLoading(false);
          return;
        }

        const userIds = [...new Set(postsData.map((p) => p.user_id).filter(Boolean))];
        let profilesData = [];
        if (userIds.length > 0) {
          const { data } = await supabase
            .from('profiles')
            .select('id, display_name, avatar_url, email')
            .in('id', userIds);
          profilesData = data || [];
        }

        const profilesMap = {};
        profilesData.forEach((profile) => {
          profilesMap[profile.id] = profile;
        });

        const data = (postsData || []).map((post) => ({
          ...post,
          profiles: profilesMap[post.user_id] || null,
          reaction_summary: buildReactionSummary(post.community_reactions || [], currentUser?.id),
        }));

        if (append) {
          setPosts((prev) => [...prev, ...data]);
        } else {
          setPosts(data);
        }
        setHasMore(data.length === PAGE_SIZE);
      } catch (err) {
        console.error('[CommunityPage] fetchPosts exception:', err);
      } finally {
        setLoading(false);
      }
    },
    [filter, currentUser?.id]
  );

  useEffect(() => {
    setPage(0);
    fetchPosts(0);
  }, [filter, fetchPosts]);

  useEffect(() => {
    const channel = supabase
      .channel('community-feed')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'community_posts',
          filter: 'parent_id=is.null',
        },
        async (payload) => {
          const { data: insertedPost } = await supabase
            .from('community_posts')
            .select('*, community_reactions(emoji, user_id)')
            .eq('id', payload.new.id)
            .maybeSingle();

          if (!insertedPost) return;

          let profile = null;
          if (insertedPost.user_id) {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('id, display_name, avatar_url, email')
              .eq('id', insertedPost.user_id)
              .maybeSingle();
            profile = profileData;
          }

          const hydratedPost = {
            ...insertedPost,
            profiles: profile,
            reaction_summary: buildReactionSummary(insertedPost.community_reactions || [], currentUser?.id),
          };

          prependPost(hydratedPost);
          upsertTrendingRow(insertedPost);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'community_posts',
        },
        (payload) => {
          setPosts((prev) => prev.filter((post) => post.id !== payload.old.id));
          removeTrendingRow(payload.old.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser?.id, prependPost, removeTrendingRow, upsertTrendingRow]);

  const handleSharePnl = useCallback(async ({ trade, caption, emojis, note }) => {
    if (!currentUser?.id || !trade || !caption) return;
    setPnlPosting(true);

    try {
      const metadata = {
        ticker: trade.symbol,
        pnl: Number(trade.pnl.toFixed(2)),
        percent: Number(trade.percent.toFixed(2)),
        shares: Number(trade.shares.toFixed(4)),
        entry_price: Number(trade.entryPrice.toFixed(4)),
        exit_price: Number(trade.exitPrice.toFixed(4)),
        opened_at: new Date(trade.openedAt).toISOString(),
        closed_at: new Date(trade.closedAt).toISOString(),
        emoji: Array.isArray(emojis) ? emojis : [],
        note: note || '',
      };

      const { data: newPost, error } = await supabase
        .from('community_posts')
        .insert({
          user_id: currentUser.id,
          author_name: currentUser.display_name || currentUser.email?.split('@')[0] || 'Trader',
          content: caption,
          ticker_mentions: extractTickers(caption),
          post_type: 'pnl_share',
          metadata,
        })
        .select('*')
        .single();

      if (error) throw error;

      const postWithProfile = {
        ...newPost,
        community_reactions: [],
        reaction_summary: [],
        profiles: {
          id: currentUser.id,
          display_name: currentUser.display_name,
          avatar_url: currentUser.avatar_url,
          email: currentUser.email,
        },
      };

      prependPost(postWithProfile);
      upsertTrendingRow(newPost);
    } catch (error) {
      console.error('[CommunityPage] P&L share failed:', error);
      alert('Failed to share P&L. Try again.');
    } finally {
      setPnlPosting(false);
    }
  }, [currentUser, prependPost, upsertTrendingRow]);

  const trendingSnapshots = useMemo(() => {
    const source = trendingRows.length > 0
      ? trendingRows
      : posts.filter((post) => post.post_type === 'pnl_share');

    const byId = new Map();
    source.forEach((post) => {
      const snapshot = normalizePnlShareSnapshot(post);
      if (snapshot && !byId.has(snapshot.id)) {
        byId.set(snapshot.id, snapshot);
      }
    });

    return Array.from(byId.values());
  }, [trendingRows, posts]);

  const topWins = useMemo(
    () => trendingSnapshots
      .filter((item) => item.pnl > 0)
      .sort((a, b) => b.pnl - a.pnl)
      .slice(0, 5),
    [trendingSnapshots],
  );

  const topLosses = useMemo(
    () => trendingSnapshots
      .filter((item) => item.pnl < 0)
      .sort((a, b) => a.pnl - b.pnl)
      .slice(0, 5),
    [trendingSnapshots],
  );

  const handleDelete = async (postId) => {
    const confirmed = window.confirm('Delete this post?');
    if (!confirmed) return;

    await supabase.from('community_posts').delete().eq('id', postId);
    setPosts((prev) => prev.filter((post) => post.id !== postId));
    removeTrendingRow(postId);
    if (showcaseTrade?.id === postId) setShowcaseTrade(null);
  };

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchPosts(nextPage, true);
  };

  return (
    <div className="h-full w-full bg-transparent relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(245,158,11,0.08),transparent_38%),radial-gradient(circle_at_90%_100%,rgba(59,130,246,0.06),transparent_42%)]" />
      <div className="relative z-10 h-full flex flex-col">
        <div className="flex-shrink-0 px-6 pt-4 pb-2">
          <FilterTabs active={filter} onChange={setFilter} />
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6">
          <div className="max-w-[1280px] mx-auto grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-4 items-start">
            <div className="min-w-0">
              {currentUser && (
                <ComposeBox
                  currentUser={currentUser}
                  betSlipOpen={pnlPanelOpen}
                  onOpenBetSlip={() => setPnlPanelOpen(true)}
                  onPost={prependPost}
                />
              )}

              {loading && posts.length === 0 ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 size={24} className="animate-spin text-gray-600" />
                </div>
              ) : posts.length === 0 ? (
                <div className="text-center py-20">
                  <div className="text-gray-600 text-sm">No posts yet. Be the first to share!</div>
                </div>
              ) : (
                <div className="space-y-3">
                  {posts.map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      currentUser={currentUser}
                      onDelete={handleDelete}
                    />
                  ))}

                  {hasMore && (
                    <div className="text-center py-4">
                      <button
                        onClick={loadMore}
                        className="text-xs text-gray-500 hover:text-cyan-400 transition-colors"
                      >
                        Load more
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <aside className="space-y-4 xl:sticky xl:top-0 xl:max-h-[calc(100vh-7.5rem)] xl:overflow-y-auto pr-1">
              {pnlPanelOpen ? (
                <BetSlipPanel
                  open={pnlPanelOpen}
                  onClose={() => setPnlPanelOpen(false)}
                  closedTrades={closedTrades}
                  posting={pnlPosting}
                  onSubmit={handleSharePnl}
                />
              ) : (
                <div className="w-full rounded-2xl border border-gray-800/60 bg-black/30 backdrop-blur-sm overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-800/70">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-300/80">Share P&L</div>
                    <h3 className="text-base font-semibold text-white">Open Bet Slip</h3>
                  </div>
                  <div className="p-4">
                    <p className="text-xs text-gray-500 mb-3">
                      Build a polymarket-style ticket from your completed trades and post it directly in chat.
                    </p>
                    <button
                      onClick={() => setPnlPanelOpen(true)}
                      className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-cyan-500 text-black text-sm font-semibold hover:bg-cyan-400 transition-colors"
                    >
                      <TrendingUp size={14} strokeWidth={2} />
                      Share P&L
                    </button>
                  </div>
                </div>
              )}

              <TrendingPnlPanel
                wins={topWins}
                losses={topLosses}
                loading={trendingLoading}
                onSelectTrade={setShowcaseTrade}
              />
            </aside>
          </div>
        </div>
      </div>
      <PnlShowcaseOverlay
        trade={showcaseTrade}
        onClose={() => setShowcaseTrade(null)}
      />
    </div>
  );
};

export default CommunityPage;
