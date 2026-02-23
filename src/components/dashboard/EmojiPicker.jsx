import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';

const FREQUENT_STORAGE_KEY = 'stratify.community.frequentEmojis';
const MAX_FREQUENT = 18;
const DEFAULT_FREQUENT = ['🚀', '💯', '🔥', '📈', '💰', '👍'];

const HIGHCHARTS_CUSTOM_EMOJIS = [':hc_triangle:', ':hc_react:'];
const UPGRADE_CHAT_EMOJIS = [
  '₿',
  '📈',
  '📉',
  '💰',
  '💸',
  '💵',
  '💴',
  '💶',
  '💷',
  '💳',
  '💎',
  '🔥',
  '🚀',
  '⚡',
  '✨',
  '💪',
  '👍',
  '💯',
  '🐂',
  '🐻',
  '🦍',
  '🌙',
  '🎯',
  '📊',
];

const STANDARD_EMOJIS = ['👍', '💯', '🔥', '🚀', '📈', '📉', '💰', '💎', '🐂', '🐻', '✅', '❌', '😂', '👀', '💪'];

const EMOJI_META = {
  '👍': { label: 'Thumbs Up', keywords: ['upvote', 'like', 'approve'] },
  '💯': { label: 'One Hundred', keywords: ['perfect', 'agree', 'hype'] },
  '🔥': { label: 'Fire', keywords: ['hot', 'momentum', 'strong'] },
  '🚀': { label: 'Rocket', keywords: ['moon', 'pump', 'breakout'] },
  '📈': { label: 'Chart Up', keywords: ['bull', 'uptrend', 'gain'] },
  '📉': { label: 'Chart Down', keywords: ['bear', 'downtrend', 'drop'] },
  '💰': { label: 'Money Bag', keywords: ['profit', 'cash', 'wins'] },
  '💸': { label: 'Money Wings', keywords: ['loss', 'spend', 'outflow'] },
  '💵': { label: 'Dollar Bill', keywords: ['usd', 'cash', 'money'] },
  '💴': { label: 'Yen Bill', keywords: ['jpy', 'currency', 'fx'] },
  '💶': { label: 'Euro Bill', keywords: ['eur', 'currency', 'fx'] },
  '💷': { label: 'Pound Bill', keywords: ['gbp', 'currency', 'fx'] },
  '💳': { label: 'Card', keywords: ['payment', 'credit', 'buy'] },
  '💎': { label: 'Diamond Hands', keywords: ['hold', 'conviction', 'diamond'] },
  '⚡': { label: 'Lightning', keywords: ['fast', 'energy', 'volatility'] },
  '✨': { label: 'Sparkles', keywords: ['clean', 'nice', 'setup'] },
  '💪': { label: 'Strong', keywords: ['confidence', 'discipline', 'strength'] },
  '🐂': { label: 'Bull', keywords: ['bullish', 'buyers', 'long'] },
  '🐻': { label: 'Bear', keywords: ['bearish', 'sellers', 'short'] },
  '🦍': { label: 'Ape', keywords: ['ape', 'community', 'degen'] },
  '🌙': { label: 'Moon', keywords: ['moonshot', 'rally', 'upside'] },
  '🎯': { label: 'Target', keywords: ['goal', 'level', 'entry'] },
  '📊': { label: 'Bar Chart', keywords: ['analysis', 'stats', 'data'] },
  '✅': { label: 'Check', keywords: ['confirmed', 'yes', 'done'] },
  '❌': { label: 'Cross', keywords: ['no', 'invalid', 'wrong'] },
  '😂': { label: 'Laugh', keywords: ['funny', 'lol', 'humor'] },
  '👀': { label: 'Eyes', keywords: ['watching', 'attention', 'lurking'] },
  '₿': { label: 'Bitcoin', keywords: ['btc', 'crypto', 'bitcoin'] },
  ':hc_triangle:': { label: 'Highcharts Triangle', keywords: ['highcharts', 'triangle', 'logo'] },
  ':hc_react:': { label: 'Highcharts React', keywords: ['highcharts', 'react', 'integration'] },
};

const dedupeEmojis = (items) => [...new Set(items.filter(Boolean))];

const readFrequentCounts = () => {
  try {
    const raw = localStorage.getItem(FREQUENT_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const trimFrequentCounts = (counts = {}) => {
  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return ranked.slice(0, MAX_FREQUENT).reduce((acc, [emoji, count]) => {
    acc[emoji] = count;
    return acc;
  }, {});
};

const saveFrequentCounts = (counts = {}) => {
  try {
    localStorage.setItem(FREQUENT_STORAGE_KEY, JSON.stringify(counts));
  } catch {
    // ignore storage write failures
  }
};

const HighchartsTriangleGlyph = ({ size = 18, className = '' }) => (
  <svg
    className={className}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <path d="M12 2L2.5 20H21.5L12 2Z" fill="#1AB7FF" />
    <path d="M12 2L7.2 11H16.8L12 2Z" fill="#4CE06A" />
    <path d="M12 22L2.5 20H21.5L12 22Z" fill="#FF5A5F" />
  </svg>
);

const HighchartsReactGlyph = ({ size = 18, className = '' }) => (
  <svg
    className={className}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="1.8" fill="#61DAFB" />
    <ellipse cx="12" cy="12" rx="8.3" ry="3.3" stroke="#61DAFB" strokeWidth="1.4" />
    <ellipse
      cx="12"
      cy="12"
      rx="8.3"
      ry="3.3"
      stroke="#61DAFB"
      strokeWidth="1.4"
      transform="rotate(60 12 12)"
    />
    <ellipse
      cx="12"
      cy="12"
      rx="8.3"
      ry="3.3"
      stroke="#61DAFB"
      strokeWidth="1.4"
      transform="rotate(120 12 12)"
    />
  </svg>
);

export const EmojiGlyph = ({ emoji, size = 18, className = '' }) => {
  if (emoji === ':hc_triangle:') {
    return <HighchartsTriangleGlyph size={size} className={className} />;
  }
  if (emoji === ':hc_react:') {
    return <HighchartsReactGlyph size={size} className={className} />;
  }

  return (
    <span className={className} style={{ fontSize: `${size}px`, lineHeight: 1 }}>
      {emoji}
    </span>
  );
};

const EmojiPicker = ({ onSelect, onClose, align = 'left' }) => {
  const pickerRef = useRef(null);
  const [search, setSearch] = useState('');
  const [frequentCounts, setFrequentCounts] = useState(() => readFrequentCounts());

  useEffect(() => {
    const onPointerDown = (event) => {
      if (!pickerRef.current) return;
      if (!pickerRef.current.contains(event.target)) {
        onClose?.();
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [onClose]);

  const frequentEmojis = useMemo(() => {
    const ranked = Object.entries(frequentCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([emoji]) => emoji);

    return dedupeEmojis(ranked.length > 0 ? ranked : DEFAULT_FREQUENT);
  }, [frequentCounts]);

  const allEmojiPool = useMemo(
    () => dedupeEmojis([...HIGHCHARTS_CUSTOM_EMOJIS, ...UPGRADE_CHAT_EMOJIS, ...STANDARD_EMOJIS]),
    []
  );

  const searchTerm = search.trim().toLowerCase();
  const searched = useMemo(() => {
    if (!searchTerm) return [];
    return allEmojiPool.filter((emoji) => {
      const meta = EMOJI_META[emoji];
      const label = meta?.label?.toLowerCase() || '';
      const keywords = (meta?.keywords || []).join(' ').toLowerCase();
      return label.includes(searchTerm) || keywords.includes(searchTerm) || emoji.includes(searchTerm);
    });
  }, [allEmojiPool, searchTerm]);

  const visibleSections = useMemo(() => {
    if (searchTerm) {
      return [{ title: 'Search Results', emojis: searched }];
    }

    return [
      { title: 'Frequently Used', emojis: frequentEmojis },
      { title: 'Highcharts', emojis: HIGHCHARTS_CUSTOM_EMOJIS },
      { title: 'Upgrade.Chat', emojis: UPGRADE_CHAT_EMOJIS },
      { title: 'Standard', emojis: STANDARD_EMOJIS },
    ];
  }, [frequentEmojis, searched, searchTerm]);

  const registerFrequentEmoji = (emoji) => {
    setFrequentCounts((prev) => {
      const next = {
        ...prev,
        [emoji]: (prev[emoji] || 0) + 1,
      };
      const trimmed = trimFrequentCounts(next);
      saveFrequentCounts(trimmed);
      return trimmed;
    });
  };

  const handlePick = (emoji) => {
    if (!emoji) return;
    console.log('[EmojiPicker] Emoji picked:', emoji);
    registerFrequentEmoji(emoji);
    onSelect?.(emoji);
    onClose?.();
    setSearch('');
  };

  return (
    <div
      ref={pickerRef}
      onMouseDown={(event) => event.stopPropagation()}
      onTouchStart={(event) => event.stopPropagation()}
      className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} bottom-full mb-2 z-40 w-[min(340px,92vw)] rounded-2xl border border-[#252525] bg-[#0a0a0a] shadow-[0_18px_44px_rgba(0,0,0,0.6)]`}
    >
      <div className="p-3 border-b border-[#1c1c1c]">
        <div className="flex items-center gap-2 bg-[#111111] border border-[#242424] rounded-lg px-2.5 py-2">
          <Search size={14} className="text-gray-500 flex-shrink-0" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search emojis"
            className="w-full bg-transparent text-sm text-gray-100 placeholder-gray-600 outline-none"
          />
        </div>
      </div>

      <div className="max-h-[320px] overflow-y-auto px-2 py-2">
        {visibleSections.map((section) => (
          <div key={section.title} className="mb-2">
            <div className="px-1.5 py-1 text-[10px] uppercase tracking-[0.08em] text-gray-500">
              {section.title}
            </div>
            {section.emojis.length === 0 ? (
              <div className="px-1.5 py-2 text-xs text-gray-600">No matches found.</div>
            ) : (
              <div className="grid grid-cols-8 gap-1">
                {dedupeEmojis(section.emojis).map((emoji) => {
                  const title = EMOJI_META[emoji]?.label || emoji;
                  return (
                    <button
                      key={`${section.title}-${emoji}`}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        handlePick(emoji);
                      }}
                      className="h-9 w-9 rounded-lg flex items-center justify-center hover:bg-white/10 active:scale-95 transition"
                      title={title}
                    >
                      <EmojiGlyph emoji={emoji} size={19} />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default EmojiPicker;
