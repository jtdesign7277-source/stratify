import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, SmilePlus, Send, Wand2, CornerDownLeft } from 'lucide-react';
import EmojiPicker from '../EmojiPicker';
import { cachedFetch, createDebouncedFn } from '../../../utils/apiCache';
import {
  T,
  DEFAULT_TICKERS,
  OVERLAY_PANEL_TRANSITION,
  QUICK_POST_HASHTAGS,
  ALL_FEED_HASHTAGS,
  MAX_VISIBLE_FEED_HASHTAGS,
} from './communityConstants';
import {
  normalizeAiSearchQuery,
  generateSuggestions,
  toMaybeFiniteNumber,
  normalizeSymbolKey,
  buildCurrentUserAvatarUrl,
  escapeRegExp,
} from './communityHelpers';
import SuggestionPopover from './SuggestionPopover';
import { UserAvatar, XLogoIcon } from './CommunityShared';

const ChatInputBar = ({
  currentUser,
  currentUserAvatarUrl,
  trackedSymbols,
  quoteMap,
  streamStatus,
  searchMode,
  onModeChange,
  onOpenComposer,
  onSend,
  onSearch,
  onFeedSelect,
  activeFeed,
  enabledFeeds,
}) => {
  const [message, setMessage] = useState('');
  const [selectedHashtags, setSelectedHashtags] = useState([]);
  const [debouncedMessage, setDebouncedMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showFeedHashtags, setShowFeedHashtags] = useState(false);

  const visibleFeedHashtags = useMemo(() => (
    ALL_FEED_HASHTAGS.filter(feed => (enabledFeeds || []).includes(feed.id)).slice(0, MAX_VISIBLE_FEED_HASHTAGS)
  ), [enabledFeeds]);
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const inputRef = useRef(null);
  const lookupRef = useRef(null);
  const prevSearchModeRef = useRef(searchMode);

  const tickerQuery = useMemo(() => {
    const match = message.match(/(?:^|\s)\$([A-Za-z0-9./=-]{1,14})$/);
    return match ? match[1].toUpperCase() : '';
  }, [message]);

  const searchSuggestions = useMemo(() => {
    return generateSuggestions(debouncedMessage).map((text, idx) => ({
      id: `search-suggestion-${idx}`,
      text,
    }));
  }, [debouncedMessage]);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      setDebouncedMessage(message);
    }, 200);
    return () => window.clearTimeout(timerId);
  }, [message]);

  useEffect(() => {
    const wasSearchMode = Boolean(prevSearchModeRef.current);
    if (wasSearchMode && !searchMode) {
      setMessage('');
      setDebouncedMessage('');
      setSuggestions([]);
      setSuggestionsLoading(false);
      setActiveSuggestion(0);
      setSelectedHashtags([]);
    }
    prevSearchModeRef.current = searchMode;
  }, [searchMode]);

  useEffect(() => {
    if (searchMode) {
      setSuggestions([]);
      setSuggestionsLoading(false);
      return undefined;
    }

    let cancelled = false;

    const lookup = async (query) => {
      if (!query) {
        setSuggestions([]);
        setSuggestionsLoading(false);
        return;
      }

      const localUniverse = [...new Set([
        ...trackedSymbols,
        ...DEFAULT_TICKERS,
        ...Object.keys(quoteMap || {}),
      ].map(normalizeSymbolKey).filter(Boolean))];

      const localRows = localUniverse
        .filter((symbol) => symbol.includes(query))
        .slice(0, 8)
        .map((symbol) => ({
          symbol,
          name: symbol,
          price: toMaybeFiniteNumber(quoteMap?.[symbol]?.price),
          percentChange: toMaybeFiniteNumber(quoteMap?.[symbol]?.percentChange),
        }));

      let remoteRows = [];
      try {
        const payload = await cachedFetch(
          `/api/global-markets/list?market=nyse&q=${encodeURIComponent(query)}&limit=12`,
          { cache: 'no-store' },
          45_000,
        );

        const rows = Array.isArray(payload?.data) ? payload.data : (Array.isArray(payload) ? payload : []);
        remoteRows = rows
          .map((row) => ({
            symbol: normalizeSymbolKey(row?.symbol),
            name: row?.instrumentName || row?.name || row?.symbol,
            price: toMaybeFiniteNumber(quoteMap?.[normalizeSymbolKey(row?.symbol)]?.price),
            percentChange: toMaybeFiniteNumber(quoteMap?.[normalizeSymbolKey(row?.symbol)]?.percentChange),
          }))
          .filter((row) => row.symbol);
      } catch {
        remoteRows = [];
      }

      if (cancelled) return;

      const merged = [...localRows, ...remoteRows]
        .reduce((acc, row) => {
          if (acc.some((entry) => entry.symbol === row.symbol)) return acc;
          acc.push(row);
          return acc;
        }, [])
        .slice(0, 10);

      setSuggestions(merged);
      setActiveSuggestion(0);
      setSuggestionsLoading(false);
    };

    lookupRef.current = createDebouncedFn((query) => {
      void lookup(query);
    }, 500);

    return () => {
      cancelled = true;
      lookupRef.current?.cancel?.();
    };
  }, [trackedSymbols, quoteMap, searchMode]);

  useEffect(() => {
    if (searchMode) return;
    if (!tickerQuery) {
      setSuggestions([]);
      setSuggestionsLoading(false);
      return;
    }
    setSuggestionsLoading(true);
    lookupRef.current?.call(tickerQuery);
  }, [tickerQuery, searchMode]);

  const applySuggestion = useCallback((item, options = {}) => {
    const triggerSearch = Boolean(options?.triggerSearch);
    if (searchMode) {
      const text = String(item?.text || '').trim();
      if (!text) return;
      setMessage(text);
      setDebouncedMessage(text);
      setActiveSuggestion(0);
      if (triggerSearch) {
        void onSearch?.(text);
      }
      window.requestAnimationFrame(() => inputRef.current?.focus());
      return;
    }

    if (!item?.symbol) return;
    setMessage((prev) => {
      const replaced = prev.replace(/(?:^|\s)\$[A-Za-z0-9./=-]{0,14}$/, (match) => {
        const prefix = match.startsWith(' ') ? ' ' : '';
        return `${prefix}$${item.symbol} `;
      });
      if (replaced !== prev) return replaced;
      return `${prev.trim()} $${item.symbol} `.trimStart();
    });
    setSuggestions([]);
    setActiveSuggestion(0);
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }, [onSearch, searchMode]);

  const addHashtagToMessage = useCallback((value, hashtag) => {
    const input = inputRef.current;
    const safeValue = String(value || '');
    const safeHashtag = String(hashtag || '').trim();
    if (!safeHashtag) return safeValue;

    const start = Number.isInteger(input?.selectionStart) ? input.selectionStart : safeValue.length;
    const end = Number.isInteger(input?.selectionEnd) ? input.selectionEnd : start;
    const before = safeValue.slice(0, start);
    const after = safeValue.slice(end);
    const withLeadingSpace = before && !/\s$/.test(before) ? `${before} ` : before;
    const withTrailingSpace = after && !/^\s/.test(after) ? ` ${after}` : after;
    return `${withLeadingSpace}${safeHashtag}${withTrailingSpace}`;
  }, []);

  const removeHashtagFromMessage = useCallback((value, hashtag) => {
    const escaped = escapeRegExp(hashtag);
    return String(value || '')
      .replace(new RegExp(`(^|\\s)${escaped}(?=\\s|$)`, 'g'), '$1')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/ +\n/g, '\n')
      .replace(/\n +/g, '\n')
      .trim();
  }, []);

  const toggleHashtag = useCallback((hashtag) => {
    const normalized = String(hashtag || '').trim().toLowerCase();
    if (!normalized) return;

    setSelectedHashtags((prev) => {
      const isActive = prev.includes(normalized);
      setMessage((currentValue) => (
        isActive
          ? removeHashtagFromMessage(currentValue, normalized)
          : addHashtagToMessage(currentValue, normalized)
      ));
      return isActive
        ? prev.filter((tag) => tag !== normalized)
        : [...prev, normalized];
    });

    window.requestAnimationFrame(() => inputRef.current?.focus());
  }, [addHashtagToMessage, removeHashtagFromMessage]);

  const send = async () => {
    const trimmed = searchMode ? normalizeAiSearchQuery(message) : String(message || '').trim();
    if (!trimmed) return;
    const ok = searchMode
      ? await onSearch?.(trimmed)
      : await onSend?.(trimmed, 'general');
    if (ok !== false) {
      setMessage('');
      setSuggestions([]);
      setActiveSuggestion(0);
      setDebouncedMessage('');
      if (!searchMode) setSelectedHashtags([]);
    }
  };

  const switchToPostMode = useCallback(() => {
    setMessage('');
    setDebouncedMessage('');
    setSuggestions([]);
    setSuggestionsLoading(false);
    setActiveSuggestion(0);
    setSelectedHashtags([]);
    onModeChange?.(false, { source: 'post-toggle' });
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }, [onModeChange]);

  const openAiRewriteComposer = useCallback(() => {
    if (searchMode) return;
    const draft = String(message || '');
    if (!draft.trim()) return;

    onOpenComposer?.('general', {
      prefilledText: draft,
      openAiRewritePanel: true,
    });

    setMessage('');
    setSuggestions([]);
    setActiveSuggestion(0);
    setDebouncedMessage('');
    setSelectedHashtags([]);
    setShowEmojiPicker(false);
  }, [message, onOpenComposer, searchMode]);

  const handleKeyDown = (event) => {
    const currentSuggestions = suggestionOpen ? suggestionRows : [];
    if (currentSuggestions.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveSuggestion((prev) => (prev + 1) % currentSuggestions.length);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveSuggestion((prev) => (prev - 1 + currentSuggestions.length) % currentSuggestions.length);
        return;
      }
      if (event.key === 'Tab') {
        event.preventDefault();
        applySuggestion(currentSuggestions[activeSuggestion] || currentSuggestions[0]);
        return;
      }
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  };

  const isOnline = streamStatus?.connected;
  const statusText = isOnline
    ? 'Live tape connected'
    : streamStatus?.connecting
      ? 'Connecting live tape...'
      : 'Live tape offline';
  const canUseInput = searchMode || Boolean(currentUser?.id);
  const hasMessage = Boolean(String(message || '').trim());
  const canUseAiRewriteTransfer = !searchMode && canUseInput && hasMessage;
  const suggestionOpen = searchMode
    ? searchSuggestions.length > 0
    : Boolean(tickerQuery);
  const suggestionRows = searchMode ? searchSuggestions : suggestions;
  const hintText = searchMode
    ? 'Enter to search, Shift+Enter for newline'
    : 'Enter to send, Shift+Enter for newline';
  const chatAvatarSeed = String(currentUser?.display_name || currentUser?.email || 'Anonymous Trader').trim() || 'Anonymous Trader';
  const chatAvatarUrl = String(
    currentUserAvatarUrl
    || currentUser?.avatar_url
    || buildCurrentUserAvatarUrl(chatAvatarSeed)
  ).trim();

  return (
    <div className="max-w-3xl mx-auto w-full">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
        className="relative"
      >
        <div className="relative">
          <SuggestionPopover
            open={suggestionOpen}
            mode={searchMode ? 'search' : 'post'}
            loading={searchMode ? false : suggestionsLoading}
            suggestions={suggestionRows}
            activeIndex={activeSuggestion}
            onPick={(item) => applySuggestion(item, { triggerSearch: true })}
          />

          <div
            className="rounded-xl border min-h-[98px] flex flex-col transition-colors duration-200"
            style={{
              backgroundColor: '#151b23',
              borderColor: 'rgba(255,255,255,0.06)',
            }}
          >
            <div className="flex flex-1 items-start gap-2.5 px-3.5 pt-3">
              <div className="mt-0.5 flex-shrink-0">
                <UserAvatar
                  user={{
                    ...(currentUser || {}),
                    display_name: chatAvatarSeed,
                    avatar_url: chatAvatarUrl,
                  }}
                  size={32}
                  initialsClassName="text-xs"
                />
              </div>
              <div className="mt-0.5 flex-shrink-0 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowFeedHashtags(false);
                    switchToPostMode();
                  }}
                  className={`p-1.5 rounded-lg cursor-pointer transition-all duration-200 ${searchMode ? 'text-[#7d8590] hover:text-[#e6edf3] hover:bg-white/5' : 'text-[#58a6ff] bg-[#58a6ff]/10'} ${showFeedHashtags ? 'opacity-40' : ''}`}
                  title="Post mode"
                >
                  <XLogoIcon className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowFeedHashtags(prev => !prev)}
                  className={`p-1.5 rounded-lg cursor-pointer transition-all duration-200 ${showFeedHashtags ? 'text-[#58a6ff] bg-[#58a6ff]/10' : 'text-[#7d8590] hover:text-[#e6edf3] hover:bg-white/5 opacity-40'}`}
                  title="Feed channels"
                >
                  <Globe className="w-4 h-4" strokeWidth={1.5} />
                </button>
              </div>
              <textarea
                ref={inputRef}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                placeholder={searchMode ? 'Search stocks, crypto, news...' : 'Quick post... use $ for ticker suggestions'}
                className="flex-1 w-full bg-transparent text-sm resize-none outline-none leading-6 min-h-[56px] max-h-32"
                style={{ color: T.text }}
                disabled={!canUseInput}
              />
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1.5">
              {!searchMode ? (
                <div className="flex items-center gap-1.5">
                  {showFeedHashtags ? (
                    visibleFeedHashtags.map((feed) => {
                      const isActive = activeFeed && activeFeed.toLowerCase().replace('#', '') === feed.id;
                      return (
                        <button
                          key={feed.id}
                          type="button"
                          onClick={() => onFeedSelect?.(isActive ? null : feed.id)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200 cursor-pointer ${
                            isActive
                              ? 'bg-[#58a6ff]/15 border-[#58a6ff]/50 text-[#58a6ff] shadow-[0_0_8px_rgba(88,166,255,0.2)]'
                              : 'bg-white/5 border-white/8 text-[#c9d1d9] hover:bg-white/10 hover:border-white/15 hover:text-[#e6edf3]'
                          }`}
                        >
                          # {feed.label}
                        </button>
                      );
                    })
                  ) : (
                    QUICK_POST_HASHTAGS.map((hashtag) => {
                      const active = selectedHashtags.includes(hashtag);
                      return (
                        <button
                          key={hashtag}
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => toggleHashtag(hashtag)}
                          className={`bg-white/5 border border-white/8 rounded-full px-3 py-1 text-xs text-[#58a6ff] cursor-pointer hover:bg-white/10 transition-all duration-150 ${active ? 'bg-[#58a6ff]/15 border-[#58a6ff]/40 text-[#58a6ff]' : ''}`}
                          title={hashtag}
                        >
                          {hashtag}
                        </button>
                      );
                    })
                  )}
                </div>
              ) : null}

              <div className="ml-auto flex items-center gap-2">
                {!searchMode ? (
                  <button
                    type="button"
                    onClick={openAiRewriteComposer}
                    disabled={!canUseAiRewriteTransfer}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/20 text-white font-bold text-xs shadow-[0_0_12px_rgba(102,126,234,0.4)] transition-all duration-300 ${canUseAiRewriteTransfer ? 'hover:scale-105 hover:shadow-[0_0_20px_rgba(102,126,234,0.6)]' : 'opacity-40 pointer-events-none'}`}
                    style={{
                      background: 'linear-gradient(135deg, #667eea, #764ba2, #f093fb, #f5576c, #4facfe, #667eea)',
                      backgroundSize: '400% 400%',
                      animation: 'premiumShimmer 6s ease infinite',
                    }}
                    title="Open AI rewrite in composer"
                  >
                    <Wand2 strokeWidth={2} className="w-3.5 h-3.5 text-white" />
                    <span className="text-white">AI Rewrite</span>
                  </button>
                ) : null}

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker((open) => !open)}
                    className="inline-flex items-center justify-center transition-colors"
                    style={{ color: T.muted }}
                    title="Insert emoji"
                  >
                    <SmilePlus size={16} strokeWidth={1.5} className="h-4 w-4" />
                  </button>

                  <AnimatePresence initial={false}>
                    {showEmojiPicker && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.95 }}
                        transition={OVERLAY_PANEL_TRANSITION}
                      >
                        <EmojiPicker
                          align="right"
                          onClose={() => setShowEmojiPicker(false)}
                          onSelect={(emoji) => {
                            setMessage((prev) => `${prev}${emoji}`);
                            setShowEmojiPicker(false);
                            window.requestAnimationFrame(() => inputRef.current?.focus());
                          }}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <button
                  type="button"
                  onClick={() => void send()}
                  disabled={!canUseInput || !hasMessage}
                  className="inline-flex items-center gap-1.5 bg-[#58a6ff] text-black font-medium rounded-lg px-3 py-1.5 text-xs disabled:opacity-45 disabled:cursor-not-allowed transition-all duration-200 hover:bg-[#79b8ff] hover:scale-[1.02]"
                  title={searchMode ? 'Run AI search' : 'Publish quick post'}
                >
                  {searchMode ? (
                    <CornerDownLeft size={14} strokeWidth={1.9} className="h-3.5 w-3.5" />
                  ) : (
                    <Send size={14} strokeWidth={1.9} className="h-3.5 w-3.5" />
                  )}
                  <span>{searchMode ? 'Enter' : 'Post'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-1.5 flex items-center justify-between">
          <div className="text-xs" style={{ color: '#7d8590' }}>{statusText}</div>
          <div className="text-xs" style={{ color: '#7d8590' }}>{hintText}</div>
        </div>
      </motion.div>
    </div>
  );
};

export default ChatInputBar;
