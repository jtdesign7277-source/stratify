import React, { useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
import { Search } from 'lucide-react';

// ── Persistence ───────────────────────────────────────────────────────────────
const FREQUENT_STORAGE_KEY = 'stratify.community.frequentEmojis';
const MAX_FREQUENT = 18;
const DEFAULT_FREQUENT = ['🚀', '💯', '🔥', '📈', '💰', '👍', '❤️', '😂', '💎', '👀'];

// ── Emoji data ────────────────────────────────────────────────────────────────

const EMOJI_SECTIONS = [
  {
    title: 'Smileys & People',
    emojis: [
      '😀','😂','🤣','😊','😍','🥰','😘','😎','🤩','🥳',
      '😏','😒','😞','😢','😭','😤','😡','🤬','😱','😨',
      '😰','🤔','🤫','🤐','😴','🥱','😷','🤢','🤮','🤧',
      '🥵','🥶','😵','🤯','🫠','🫡',
    ],
  },
  {
    title: 'Gestures & Hands',
    emojis: [
      '👍','👎','👏','🙌','🤝','🙏','💪','✌️','🤞','🫶',
      '👊','✊','🤙','👋',
    ],
  },
  {
    title: 'Hearts & Symbols',
    emojis: [
      '❤️','🧡','💛','💚','💙','💜','🖤','🤍','💔','❤️‍🔥',
      '💯','💥','🔥','⭐','💫','✨','💎','👑','🏆',
    ],
  },
  {
    title: 'Finance',
    emojis: [
      '🚀','💰','📈','📉','💸','🎯','💵','💴','💶','💷',
      '💳','⚡','₿','📊','✅','❌',
    ],
  },
  {
    title: 'Objects & Misc',
    emojis: [
      '🎪','🎰','💊','🍺','🍿','☕','🧠','👀','💀','☠️',
      '🤡','👻','🎃',
    ],
  },
  {
    title: 'Animals',
    emojis: [
      '🐂','🐻','🦍','🐋','🦈','🐐','🦅','🐍','🐒','🌙',
    ],
  },
];

// Flat metadata for search
const EMOJI_META = {
  '👍': { label: 'Thumbs Up', keywords: ['upvote', 'like', 'approve', 'good'] },
  '👎': { label: 'Thumbs Down', keywords: ['downvote', 'dislike', 'bad'] },
  '💯': { label: 'One Hundred', keywords: ['perfect', 'agree', 'hype', '100'] },
  '🔥': { label: 'Fire', keywords: ['hot', 'momentum', 'strong', 'lit'] },
  '🚀': { label: 'Rocket', keywords: ['moon', 'pump', 'breakout', 'launch'] },
  '📈': { label: 'Chart Up', keywords: ['bull', 'uptrend', 'gain', 'green'] },
  '📉': { label: 'Chart Down', keywords: ['bear', 'downtrend', 'drop', 'red'] },
  '💰': { label: 'Money Bag', keywords: ['profit', 'cash', 'wins', 'rich'] },
  '💸': { label: 'Money Wings', keywords: ['loss', 'spend', 'outflow', 'flying money'] },
  '💵': { label: 'Dollar', keywords: ['usd', 'cash', 'dollar'] },
  '💴': { label: 'Yen', keywords: ['jpy', 'yen', 'fx'] },
  '💶': { label: 'Euro', keywords: ['eur', 'euro', 'fx'] },
  '💷': { label: 'Pound', keywords: ['gbp', 'pound', 'fx'] },
  '💳': { label: 'Credit Card', keywords: ['payment', 'credit', 'buy'] },
  '💎': { label: 'Diamond Hands', keywords: ['hold', 'conviction', 'diamond', 'hodl'] },
  '⚡': { label: 'Lightning', keywords: ['fast', 'energy', 'volatility', 'quick'] },
  '✨': { label: 'Sparkles', keywords: ['clean', 'nice', 'setup', 'shine'] },
  '💪': { label: 'Strong', keywords: ['confidence', 'discipline', 'strength', 'muscle'] },
  '🐂': { label: 'Bull', keywords: ['bullish', 'buyers', 'long', 'bull'] },
  '🐻': { label: 'Bear', keywords: ['bearish', 'sellers', 'short', 'bear'] },
  '🦍': { label: 'Ape', keywords: ['ape', 'community', 'degen', 'gmegme'] },
  '🌙': { label: 'Moon', keywords: ['moonshot', 'rally', 'upside', 'gm'] },
  '🎯': { label: 'Target', keywords: ['goal', 'level', 'entry', 'precision'] },
  '📊': { label: 'Bar Chart', keywords: ['analysis', 'stats', 'data', 'chart'] },
  '✅': { label: 'Check', keywords: ['confirmed', 'yes', 'done', 'correct'] },
  '❌': { label: 'Cross', keywords: ['no', 'invalid', 'wrong', 'cancel'] },
  '😂': { label: 'Laugh', keywords: ['funny', 'lol', 'humor', 'crying laughing'] },
  '👀': { label: 'Eyes', keywords: ['watching', 'attention', 'lurking', 'looking'] },
  '₿': { label: 'Bitcoin', keywords: ['btc', 'crypto', 'bitcoin'] },
  '😀': { label: 'Grinning', keywords: ['happy', 'smile', 'grin'] },
  '🤣': { label: 'ROFL', keywords: ['laugh', 'rolling', 'funny'] },
  '😊': { label: 'Smiling', keywords: ['happy', 'blush', 'smile'] },
  '😍': { label: 'Heart Eyes', keywords: ['love', 'amazing', 'beautiful'] },
  '🥰': { label: 'Smiling Hearts', keywords: ['love', 'adore', 'affection'] },
  '😘': { label: 'Kissing', keywords: ['kiss', 'love', 'mwah'] },
  '😎': { label: 'Sunglasses', keywords: ['cool', 'awesome', 'chill'] },
  '🤩': { label: 'Star Struck', keywords: ['wow', 'amazing', 'celebrity'] },
  '🥳': { label: 'Party', keywords: ['celebrate', 'birthday', 'congrats'] },
  '😏': { label: 'Smirk', keywords: ['smug', 'sly', 'suggestive'] },
  '😒': { label: 'Unamused', keywords: ['meh', 'unimpressed', 'side eye'] },
  '😞': { label: 'Disappointed', keywords: ['sad', 'down', 'unhappy'] },
  '😢': { label: 'Crying', keywords: ['sad', 'tear', 'cry'] },
  '😭': { label: 'Sobbing', keywords: ['cry', 'devastated', 'sad'] },
  '😤': { label: 'Fuming', keywords: ['angry', 'frustrated', 'steam'] },
  '😡': { label: 'Angry', keywords: ['mad', 'rage', 'fury'] },
  '🤬': { label: 'Swearing', keywords: ['furious', 'cursing', 'rage'] },
  '😱': { label: 'Shocked', keywords: ['screaming', 'fear', 'omg'] },
  '😨': { label: 'Fearful', keywords: ['scared', 'afraid', 'anxious'] },
  '😰': { label: 'Anxious', keywords: ['nervous', 'worried', 'sweat'] },
  '🤔': { label: 'Thinking', keywords: ['hmm', 'considering', 'pondering'] },
  '🤫': { label: 'Shushing', keywords: ['quiet', 'secret', 'shhh'] },
  '🤐': { label: 'Zipper Mouth', keywords: ['silent', 'sealed', 'zip'] },
  '😴': { label: 'Sleeping', keywords: ['tired', 'zzz', 'sleep'] },
  '🥱': { label: 'Yawning', keywords: ['tired', 'bored', 'yawn'] },
  '😷': { label: 'Mask', keywords: ['sick', 'covid', 'medical'] },
  '🤢': { label: 'Nauseated', keywords: ['sick', 'gross', 'ill'] },
  '🤮': { label: 'Vomiting', keywords: ['sick', 'disgusting', 'puke'] },
  '🤧': { label: 'Sneezing', keywords: ['cold', 'sick', 'achoo'] },
  '🥵': { label: 'Hot', keywords: ['overheating', 'sweating', 'hot'] },
  '🥶': { label: 'Cold', keywords: ['freezing', 'ice', 'cold'] },
  '😵': { label: 'Dizzy', keywords: ['confused', 'spinning', 'woozy'] },
  '🤯': { label: 'Mind Blown', keywords: ['explosion', 'shocked', 'wow'] },
  '🫠': { label: 'Melting', keywords: ['overwhelmed', 'melt', 'tired'] },
  '🫡': { label: 'Salute', keywords: ['respect', 'honor', 'aye'] },
  '👏': { label: 'Clapping', keywords: ['applause', 'bravo', 'great'] },
  '🙌': { label: 'Raised Hands', keywords: ['celebration', 'hooray', 'praise'] },
  '🤝': { label: 'Handshake', keywords: ['deal', 'agreement', 'partnership'] },
  '🙏': { label: 'Pray', keywords: ['please', 'thanks', 'hope'] },
  '✌️': { label: 'Peace', keywords: ['victory', 'two', 'peace'] },
  '🤞': { label: 'Fingers Crossed', keywords: ['luck', 'hope', 'wish'] },
  '🫶': { label: 'Heart Hands', keywords: ['love', 'care', 'heart'] },
  '👊': { label: 'Punch', keywords: ['fist', 'hit', 'power'] },
  '✊': { label: 'Raised Fist', keywords: ['solidarity', 'power', 'revolution'] },
  '🤙': { label: 'Call Me', keywords: ['shaka', 'hang loose', 'chill'] },
  '👋': { label: 'Wave', keywords: ['hello', 'bye', 'wave'] },
  '❤️': { label: 'Red Heart', keywords: ['love', 'heart', 'red'] },
  '🧡': { label: 'Orange Heart', keywords: ['orange', 'warm', 'heart'] },
  '💛': { label: 'Yellow Heart', keywords: ['yellow', 'friendship', 'heart'] },
  '💚': { label: 'Green Heart', keywords: ['green', 'nature', 'heart'] },
  '💙': { label: 'Blue Heart', keywords: ['blue', 'trust', 'heart'] },
  '💜': { label: 'Purple Heart', keywords: ['purple', 'compassion', 'heart'] },
  '🖤': { label: 'Black Heart', keywords: ['dark', 'evil', 'heart'] },
  '🤍': { label: 'White Heart', keywords: ['pure', 'white', 'heart'] },
  '💔': { label: 'Broken Heart', keywords: ['sad', 'heartbreak', 'loss'] },
  '❤️‍🔥': { label: 'Heart on Fire', keywords: ['passion', 'intense', 'burning love'] },
  '💥': { label: 'Explosion', keywords: ['boom', 'bang', 'impact'] },
  '⭐': { label: 'Star', keywords: ['favorite', 'gold', 'star'] },
  '💫': { label: 'Dizzy Star', keywords: ['sparkle', 'star', 'shine'] },
  '👑': { label: 'Crown', keywords: ['king', 'queen', 'royal'] },
  '🏆': { label: 'Trophy', keywords: ['win', 'award', 'champion'] },
  '🎪': { label: 'Circus', keywords: ['clown show', 'chaos', 'circus'] },
  '🎰': { label: 'Slot Machine', keywords: ['gamble', 'casino', 'risk'] },
  '💊': { label: 'Pill', keywords: ['red pill', 'medicine', 'drug'] },
  '🍺': { label: 'Beer', keywords: ['drink', 'cheers', 'beer'] },
  '🍿': { label: 'Popcorn', keywords: ['watching', 'drama', 'entertainment'] },
  '☕': { label: 'Coffee', keywords: ['morning', 'gm', 'caffeine'] },
  '🧠': { label: 'Brain', keywords: ['smart', 'big brain', 'intellect'] },
  '💀': { label: 'Skull', keywords: ['dead', 'rekt', 'destroyed'] },
  '☠️': { label: 'Skull Crossbones', keywords: ['danger', 'death', 'rekt'] },
  '🤡': { label: 'Clown', keywords: ['clown world', 'joke', 'idiot'] },
  '👻': { label: 'Ghost', keywords: ['spooky', 'ghosted', 'boo'] },
  '🎃': { label: 'Jack-o-Lantern', keywords: ['halloween', 'pumpkin', 'spooky'] },
  '🐋': { label: 'Whale', keywords: ['whale', 'big money', 'large holder'] },
  '🦈': { label: 'Shark', keywords: ['predator', 'aggressive', 'shark'] },
  '🐐': { label: 'GOAT', keywords: ['greatest', 'goat', 'legend'] },
  '🦅': { label: 'Eagle', keywords: ['soaring', 'freedom', 'eagle'] },
  '🐍': { label: 'Snake', keywords: ['snake', 'sly', 'danger'] },
  '🐒': { label: 'Monkey', keywords: ['ape', 'monkey', 'degen'] },
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
  } catch { /* ignore */ }
};

// ── Special glyphs ────────────────────────────────────────────────────────────

const HIGHCHARTS_CUSTOM_EMOJIS = [':hc_triangle:', ':hc_react:'];

const HighchartsTriangleGlyph = ({ size = 18, className = '' }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 2L2.5 20H21.5L12 2Z" fill="#1AB7FF" />
    <path d="M12 2L7.2 11H16.8L12 2Z" fill="#4CE06A" />
    <path d="M12 22L2.5 20H21.5L12 22Z" fill="#FF5A5F" />
  </svg>
);

const HighchartsReactGlyph = ({ size = 18, className = '' }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="1.8" fill="#61DAFB" />
    <ellipse cx="12" cy="12" rx="8.3" ry="3.3" stroke="#61DAFB" strokeWidth="1.4" />
    <ellipse cx="12" cy="12" rx="8.3" ry="3.3" stroke="#61DAFB" strokeWidth="1.4" transform="rotate(60 12 12)" />
    <ellipse cx="12" cy="12" rx="8.3" ry="3.3" stroke="#61DAFB" strokeWidth="1.4" transform="rotate(120 12 12)" />
  </svg>
);

export const EmojiGlyph = ({ emoji, size = 18, className = '' }) => {
  if (emoji === ':hc_triangle:') return <HighchartsTriangleGlyph size={size} className={className} />;
  if (emoji === ':hc_react:') return <HighchartsReactGlyph size={size} className={className} />;
  return <span className={className} style={{ fontSize: `${size}px`, lineHeight: 1 }}>{emoji}</span>;
};

// ── EmojiPicker ───────────────────────────────────────────────────────────────

const PICKER_HEIGHT_ESTIMATE = 360; // px — used for viewport flip detection

const EmojiPicker = ({ onSelect, onClose, align = 'left' }) => {
  const pickerRef = useRef(null);
  const triggerRef = useRef(null); // set via forwardRef on the wrapper div in ReactionBar
  const [search, setSearch] = useState('');
  const [frequentCounts, setFrequentCounts] = useState(() => readFrequentCounts());
  const [flipUp, setFlipUp] = useState(false);

  // ── Viewport-aware position: drop DOWN by default, flip UP if too close to bottom ──
  useLayoutEffect(() => {
    if (!pickerRef.current) return;
    const rect = pickerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.top;
    if (spaceBelow < PICKER_HEIGHT_ESTIMATE) {
      setFlipUp(true);
    }
  }, []);

  // ── Close on outside click / Escape ──
  useEffect(() => {
    const onPointerDown = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) onClose?.();
    };
    const onKeyDown = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  const frequentEmojis = useMemo(() => {
    const ranked = Object.entries(frequentCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([emoji]) => emoji);
    return dedupeEmojis(ranked.length > 0 ? ranked : DEFAULT_FREQUENT);
  }, [frequentCounts]);

  const allEmojiPool = useMemo(
    () => dedupeEmojis([...EMOJI_SECTIONS.flatMap(s => s.emojis), ...HIGHCHARTS_CUSTOM_EMOJIS]),
    []
  );

  const searchTerm = search.trim().toLowerCase();

  const searchResults = useMemo(() => {
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
      return [{ title: 'Search Results', emojis: searchResults }];
    }
    return [
      { title: 'Frequently Used', emojis: frequentEmojis },
      { title: 'Highcharts', emojis: HIGHCHARTS_CUSTOM_EMOJIS },
      ...EMOJI_SECTIONS,
    ];
  }, [frequentEmojis, searchResults, searchTerm]);

  const registerFrequentEmoji = (emoji) => {
    setFrequentCounts((prev) => {
      const next = { ...prev, [emoji]: (prev[emoji] || 0) + 1 };
      const trimmed = trimFrequentCounts(next);
      saveFrequentCounts(trimmed);
      return trimmed;
    });
  };

  const handlePick = (emoji) => {
    if (!emoji) return;
    registerFrequentEmoji(emoji);
    onSelect?.(emoji);
    onClose?.();
    setSearch('');
  };

  // Position: drop down (top-full mt-2) by default; flip to bottom-full mb-2 when near viewport bottom
  const positionClass = flipUp
    ? `bottom-full mb-2`
    : `top-full mt-2`;

  const alignClass = align === 'right' ? 'right-0' : 'left-0';

  return (
    <div
      ref={pickerRef}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      className={`absolute ${positionClass} ${alignClass} z-50 w-[min(340px,92vw)] bg-[#161b22] border border-white/10 rounded-xl shadow-xl`}
    >
      {/* ── Search ── */}
      <div className="px-3 pt-3 pb-2">
        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5">
          <Search size={13} className="text-[#7d8590] flex-shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search emoji..."
            className="w-full bg-transparent text-xs text-[#e6edf3] placeholder-[#7d8590] outline-none"
            autoFocus
          />
        </div>
      </div>

      {/* ── Emoji grid ── */}
      <div className="max-h-[280px] overflow-y-auto px-3 pb-3">
        {visibleSections.map((section, sIdx) => (
          <div key={section.title}>
            <div className={`text-[#7d8590] text-xs font-medium uppercase tracking-wide mb-1 ${sIdx === 0 ? '' : 'mt-3'}`}>
              {section.title}
            </div>
            {section.emojis.length === 0 ? (
              <div className="text-xs text-[#7d8590] py-2">No matches found.</div>
            ) : (
              <div className="grid grid-cols-8 gap-1">
                {dedupeEmojis(section.emojis).map((emoji) => {
                  const title = EMOJI_META[emoji]?.label || emoji;
                  return (
                    <button
                      key={`${section.title}-${emoji}`}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handlePick(emoji);
                      }}
                      title={title}
                      className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-white/10 active:scale-95 transition-all duration-150 cursor-pointer group"
                    >
                      <span className="text-xl inline-block transition-transform duration-150 group-hover:scale-110">
                        <EmojiGlyph emoji={emoji} size={20} />
                      </span>
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
