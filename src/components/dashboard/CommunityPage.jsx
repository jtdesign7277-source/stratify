import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { AnimatePresence, motion } from 'framer-motion';
import EmojiPicker, { EmojiGlyph } from './EmojiPicker';
import FeedsSidebar from './FeedsSidebar';
import FeedView, { ArticleReader } from './FeedView';
import TodaysNews from 'components/dashboard/TodaysNews';
import { subscribeTwelveDataQuotes, subscribeTwelveDataStatus } from '../../services/twelveDataWebSocket';
import { cachedFetch, createDebouncedFn } from '../../utils/apiCache';
import useClickHistory from '../../hooks/useClickHistory';
import {
  Heart, MessageCircle, Send, X, TrendingUp, BarChart3, Bell, BellOff, Brain,
  MoreHorizontal, Trash2, Loader2, Camera, SmilePlus, CalendarDays, Clock3,
  Copy, ExternalLink, ChevronDown, ChevronRight, Home, Flame, Newspaper, Globe,
  Compass, Users, Star, ArrowDown, ArrowLeftRight, PanelLeftClose, PanelRightClose, Sparkles,
  Plus, Wand2, Pencil, Hash,
  CornerDownLeft,
} from 'lucide-react';

// ─── Community Module Imports ─────────────────────────────
import {
  T,
  BASE_STREAM_STATUS,
  FEED_VARIANTS,
  CARD_VARIANTS,
  COMMUNITY_PAGE_STYLES,
  DEFAULT_TICKERS,
  MARKET_MOVER_SYMBOLS,
  AI_SEARCH_CLIENT_CACHE_TTL,
  AI_SEARCH_CLIENT_CACHE,
  AI_SEARCH_INFLIGHT,
  PROFILE_PICKER_AVATAR_OPTIONS,
  QUICK_POST_HASHTAGS,
  USER_AVATAR_SEED_STORAGE_KEY,
  USER_AVATAR_URL_STORAGE_KEY,
  DISPLAY_NAME_STORAGE_KEY,
  HASHTAG_WEB_CACHE_STORAGE_KEY,
  HASHTAG_WEB_CACHE_TTL_MS,
  PRICE_ALERTS_STORAGE_KEY,
  FEED_HASHTAGS_ENABLED_STORAGE_KEY,
  POST_TYPE_CONFIG,
  POST_TYPE_ORDER,
  ALL_FEED_HASHTAGS,
  FEED_HASHTAGS,
  MAX_VISIBLE_FEED_HASHTAGS,
  HASHTAG_WEB_MIN_VISIBLE_POSTS,
  MOCK_REACTION_POOL,
  MOCK_BASE_SETUPS,
  BOT_HASHTAG_CONTEXT_BY_TAG,
  MODAL_BACKDROP_TRANSITION,
  MODAL_PANEL_ENTER_TRANSITION,
  MODAL_PANEL_EXIT_TRANSITION,
  OVERLAY_PANEL_TRANSITION,
  modalSectionMotion,
  SLIP_EMOJI_PRESETS,
  AI_REWRITE_STYLE_OPTIONS,
  AI_REWRITE_PERSONALITY_OPTIONS,
  AI_REWRITE_ACTION_ROW_VARIANTS,
  AI_REWRITE_ACTION_ITEM_VARIANTS,
  RAIL_TRENDS_PLACEHOLDER,
} from './community/communityConstants';
import {
  buildProfileAvatarUrl,
  buildProfilePickerAvatarOptions,
  hashString,
  normalizeAvatarColor,
  getAvatarSeed,
  buildCurrentUserAvatarUrl,
  readCurrentUserAvatar,
  getResolvedAvatarUrl,
  timeAgo,
  extractTickers,
  extractHashtags,
  highlightTickers,
  normalizeAiSearchQuery,
  escapeRegExp,
  getClientAiSearchCached,
  setClientAiSearchCached,
  sanitizeAiSentiment,
  sanitizeAiSources,
  sanitizeAiTickers,
  sanitizeAiSearchData,
  generateSuggestions,
  buildReactionSummary,
  applyReactionState,
  sortByCreatedAtAsc,
  toFiniteNumber,
  toMaybeFiniteNumber,
  formatCurrency,
  formatSignedCurrency,
  formatSignedPercent,
  formatDateTime,
  formatPrice,
  normalizeTradeForSlip,
  buildClosedTradesForSlip,
  createSlipCaption,
  shareToX,
  normalizeSymbolKey,
  normalizePriceAlertTicker,
  mergeQuotesFromPayload,
  mergeStreamQuote,
  mentionSymbolsFromPosts,
  sanitizePostType,
  normalizeFeedHashtag,
  sanitizeHashtagLabel,
  postMatchesFeedFilter,
  getBotHashtagContextLine,
  normalizeHashtagWebTickers,
  normalizeHashtagWebResults,
  readStoredHashtagWebCache,
  persistHashtagWebCache,
  readEnabledFeedHashtags,
  persistEnabledFeedHashtags,
  makeMockReactionRows,
  generateMockFeed,
} from './community/communityHelpers';
import {
  XLogoIcon,
  ShimmerLine,
  ShimmerBlock,
  UserAvatar,
  PostTypeBadge,
  PnLCard,
  ComposerTypePill,
} from './community/CommunityShared';
import SuggestionPopover from './community/SuggestionPopover';
import ChatInputBar from './community/ChatInputBar';
import { AiSearchLoadingCard, AiSearchResultCard } from './community/AiSearchCards';
import PostComposerModal from './community/PostComposerModal';
import ReactionBar from './community/ReactionBar';
import PostCard from './community/PostCard';
import FeedCustomizerModal from './community/FeedCustomizerModal';
import { HistoryView, DiscoverView, SpacesView, FinanceView, RightSidebar } from './community/ExploreViews';
import LeftRail from './community/LeftRail';

// ─── Main Community Page ──────────────────────────────────
const CommunityPage = ({ tradeHistory = [] }) => {
  const [posts, setPosts] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState(null);
  const [sidebarArticle, setSidebarArticle] = useState(null); // article opened from right-sidebar news
  const [searchMode, setSearchMode] = useState(false);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerSubmitting, setComposerSubmitting] = useState(false);
  const [composerInitialType, setComposerInitialType] = useState('general');
  const [composerPrefilledText, setComposerPrefilledText] = useState('');
  const [composerOpenRewritePanel, setComposerOpenRewritePanel] = useState(false);
  const [quoteMap, setQuoteMap] = useState({});
  const [streamStatus, setStreamStatus] = useState(BASE_STREAM_STATUS);
  const [aiSearchResults, setAiSearchResults] = useState([]);
  const [aiSearchPending, setAiSearchPending] = useState([]);
  const [hashtagWebResults, setHashtagWebResults] = useState([]);
  const [hashtagWebLoading, setHashtagWebLoading] = useState(false);
  const [hashtagWebTag, setHashtagWebTag] = useState('');
  const [hashtagWebError, setHashtagWebError] = useState('');
  const [hashtagWebCache, setHashtagWebCache] = useState(() => readStoredHashtagWebCache());
  const [priceAlerts, setPriceAlerts] = useState(() => {
    if (typeof window === 'undefined') return [];
    try {
      const parsed = JSON.parse(window.localStorage.getItem(PRICE_ALERTS_STORAGE_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [priceAlertPopoverOpen, setPriceAlertPopoverOpen] = useState(false);
  const [priceAlertTickerInput, setPriceAlertTickerInput] = useState('');
  const [priceAlertTargetInput, setPriceAlertTargetInput] = useState('');
  const [priceAlertDirection, setPriceAlertDirection] = useState('above');
  const [alertToasts, setAlertToasts] = useState([]);
  const [feedCustomizerOpen, setFeedCustomizerOpen] = useState(false);
  const [enabledFeeds, setEnabledFeeds] = useState(() => readEnabledFeedHashtags());
  const toggleFeedEnabled = useCallback((id) => {
    setEnabledFeeds((prev) => {
      const next = prev.includes(id) ? prev.filter((f) => f !== id) : (prev.length >= MAX_VISIBLE_FEED_HASHTAGS ? prev : [...prev, id]);
      persistEnabledFeedHashtags(next);
      return next;
    });
  }, []);
  const [activeExploreTab, setActiveExploreTab] = useState(null);
  const [discoverData, setDiscoverData] = useState(null);
  const [financeData, setFinanceData] = useState(null);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [financeLoading, setFinanceLoading] = useState(false);
  const [displayName, setDisplayName] = useState(() => {
    if (typeof window === 'undefined') return 'Anonymous Trader';
    try {
      return window.localStorage.getItem(DISPLAY_NAME_STORAGE_KEY) || 'Anonymous Trader';
    } catch {
      return 'Anonymous Trader';
    }
  });
  const [currentUserAvatar, setCurrentUserAvatar] = useState(() => readCurrentUserAvatar('Anonymous Trader'));
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState('');
  const activeDisplayName = String(
    displayName || currentUser?.display_name || currentUser?.email?.split('@')[0] || 'Anonymous Trader'
  ).trim().slice(0, 24) || 'Anonymous Trader';
  const activeAvatarSeed = String(
    currentUserAvatar?.seed || activeDisplayName || 'Anonymous Trader'
  ).trim() || 'Anonymous Trader';
  const activeAvatarUrl = String(
    currentUserAvatar?.url || buildCurrentUserAvatarUrl(activeAvatarSeed)
  ).trim() || buildCurrentUserAvatarUrl(activeAvatarSeed);
  const priceAlertPopoverRef = useRef(null);
  const alertToastTimersRef = useRef(new Map());

  const mockFeed = useMemo(() => generateMockFeed(), []);

  const { history: clickHistory, loading: clickHistoryLoading, trackClick, clearHistory: clearClickHistory } = useClickHistory();

  // Preload discover + finance data on mount
  useEffect(() => {
    let cancelled = false;
    setDiscoverLoading(true);
    setFinanceLoading(true);

    Promise.allSettled([
      fetch('/api/discover').then((r) => r.ok ? r.json() : null),
      fetch('/api/finance').then((r) => r.ok ? r.json() : null),
    ]).then(([discoverResult, financeResult]) => {
      if (cancelled) return;
      if (discoverResult.status === 'fulfilled' && discoverResult.value) {
        setDiscoverData(discoverResult.value);
      }
      if (financeResult.status === 'fulfilled' && financeResult.value) {
        setFinanceData(financeResult.value);
      }
      setDiscoverLoading(false);
      setFinanceLoading(false);
    });

    return () => { cancelled = true; };
  }, []);

  const closedTrades = useMemo(
    () => buildClosedTradesForSlip(tradeHistory).slice(0, 140),
    [tradeHistory],
  );

  const prependPost = useCallback((post) => {
    if (!post?.id) return;
    setPosts((prev) => {
      if (prev.some((row) => row.id === post.id)) return prev;
      return [post, ...prev];
    });
  }, []);

  const dismissAlertToast = useCallback((toastId) => {
    setAlertToasts((prev) => prev.filter((toast) => toast.id !== toastId));
    const timeoutId = alertToastTimersRef.current.get(toastId);
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      alertToastTimersRef.current.delete(toastId);
    }
  }, []);

  const pushAlertToast = useCallback((alert, currentPrice) => {
    const toastId = `price-alert-toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const normalizedPrice = toMaybeFiniteNumber(currentPrice);
    setAlertToasts((prev) => ([
      ...prev,
      {
        id: toastId,
        ticker: alert.ticker,
        targetPrice: alert.targetPrice,
        direction: alert.direction,
        price: Number.isFinite(normalizedPrice) ? normalizedPrice : toMaybeFiniteNumber(alert.targetPrice),
      },
    ]));

    const timeoutId = window.setTimeout(() => {
      dismissAlertToast(toastId);
    }, 8000);
    alertToastTimersRef.current.set(toastId, timeoutId);
  }, [dismissAlertToast]);

  const playAlertSound = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.8);
      setTimeout(() => {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.frequency.value = 1320;
        osc2.type = 'sine';
        gain2.gain.setValueAtTime(0.12, ctx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
        osc2.start(ctx.currentTime);
        osc2.stop(ctx.currentTime + 0.6);
      }, 200);
    } catch (e) {
      console.log('Audio not available');
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(PRICE_ALERTS_STORAGE_KEY, JSON.stringify(priceAlerts));
    } catch {
      // localStorage sync is best effort only
    }
  }, [priceAlerts]);

  useEffect(() => {
    if (!priceAlertPopoverOpen) return undefined;

    const handlePointerDown = (event) => {
      if (priceAlertPopoverRef.current?.contains(event.target)) return;
      setPriceAlertPopoverOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [priceAlertPopoverOpen]);

  useEffect(() => {
    return () => {
      alertToastTimersRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      alertToastTimersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    persistHashtagWebCache(hashtagWebCache);
  }, [hashtagWebCache]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const syncAvatarFromStorage = () => {
      const nextAvatar = readCurrentUserAvatar(activeDisplayName);
      setCurrentUserAvatar((prev) => {
        if (prev?.seed === nextAvatar.seed && prev?.url === nextAvatar.url) return prev;
        return nextAvatar;
      });
    };

    syncAvatarFromStorage();
    window.addEventListener('storage', syncAvatarFromStorage);
    return () => {
      window.removeEventListener('storage', syncAvatarFromStorage);
    };
  }, [activeDisplayName]);

  useEffect(() => {
    let cancelled = false;

    const getUser = async () => {
      let localDisplayName = '';
      if (typeof window !== 'undefined') {
        try {
          localDisplayName = String(window.localStorage.getItem(DISPLAY_NAME_STORAGE_KEY) || '').trim().slice(0, 24);
          if (localDisplayName) setDisplayName(localDisplayName);
        } catch {
          localDisplayName = '';
        }
      }

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user || cancelled) return;

        let profile = null;
        try {
          const { data } = await supabase
            .from('profiles')
            .select('id, display_name, avatar_url, email')
            .eq('id', user.id)
            .maybeSingle();
          profile = data;
        } catch {
          profile = null;
        }

        if (cancelled) return;

        const remoteDisplayName = String(profile?.display_name || '').trim().slice(0, 24);
        const metadataDisplayName = String(user.user_metadata?.full_name || '').trim().slice(0, 24);
        const emailDisplayName = String(user.email?.split('@')[0] || '').trim().slice(0, 24);
        const resolvedDisplayName = remoteDisplayName
          || localDisplayName
          || metadataDisplayName
          || emailDisplayName
          || 'Anonymous Trader';

        setDisplayName(resolvedDisplayName);
        if (typeof window !== 'undefined') {
          try {
            window.localStorage.setItem(DISPLAY_NAME_STORAGE_KEY, resolvedDisplayName);
            const existingAvatarSeed = String(window.localStorage.getItem(USER_AVATAR_SEED_STORAGE_KEY) || '').trim();
            if (!existingAvatarSeed) {
              window.localStorage.setItem(USER_AVATAR_SEED_STORAGE_KEY, resolvedDisplayName);
            }

            const existingAvatarUrl = String(window.localStorage.getItem(USER_AVATAR_URL_STORAGE_KEY) || '').trim();
            const remoteAvatarUrl = String(profile?.avatar_url || user.user_metadata?.avatar_url || '').trim();
            if (!existingAvatarUrl && remoteAvatarUrl) {
              window.localStorage.setItem(USER_AVATAR_URL_STORAGE_KEY, remoteAvatarUrl);
            }
          } catch {
            // localStorage sync is best effort only
          }
        }

        const resolvedAvatar = readCurrentUserAvatar(resolvedDisplayName);
        setCurrentUserAvatar(resolvedAvatar);

        setCurrentUser({
          id: user.id,
          email: user.email,
          display_name: resolvedDisplayName,
          avatar_url: resolvedAvatar.url,
          avatar_color: user.user_metadata?.avatar_color || null,
        });
      } catch {
        // fall back to local storage name and anonymous browsing
      }
    };

    void getUser();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setCurrentUser((prev) => {
      if (!prev) return prev;
      const sameDisplayName = String(prev.display_name || '').trim() === activeDisplayName;
      const sameAvatarUrl = String(prev.avatar_url || '').trim() === activeAvatarUrl;
      if (sameDisplayName && sameAvatarUrl) return prev;
      return { ...prev, display_name: activeDisplayName, avatar_url: activeAvatarUrl };
    });
  }, [activeAvatarUrl, activeDisplayName]);

  const handleSaveName = useCallback(async () => {
    const trimmedInput = String(editName || '').trim();
    if (!trimmedInput) {
      setEditName(activeDisplayName);
      setIsEditingName(false);
      return;
    }

    const trimmedName = trimmedInput.slice(0, 24);
    setDisplayName(trimmedName);
    setIsEditingName(false);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(DISPLAY_NAME_STORAGE_KEY, trimmedName);
        window.localStorage.setItem(USER_AVATAR_SEED_STORAGE_KEY, trimmedName);
      } catch {
        // localStorage sync is best effort only
      }
      window.dispatchEvent(new Event('storage'));
    }

    try {
      if (currentUser?.id) {
        await supabase.from('profiles').upsert({
          id: currentUser.id,
          display_name: trimmedName,
        });
      }
    } catch {
      // best effort profile sync; UI should not block on failure
    }
  }, [activeDisplayName, currentUser?.id, editName]);

  const hydratePosts = useCallback((rows) => {
    return (Array.isArray(rows) ? rows : []).map((post) => ({
      ...post,
      is_mock: Boolean(post?.is_mock),
      reaction_summary: buildReactionSummary(post.community_reactions || [], currentUser?.id),
    }));
  }, [currentUser?.id]);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      let { data: rows, error: queryError } = await supabase
        .from('community_posts')
        .select('*, community_reactions(emoji, user_id)')
        .is('parent_id', null)
        .is('parent_post_id', null)
        .order('created_at', { ascending: false })
        .limit(120);

      if (queryError && String(queryError.message || '').includes('community_reactions')) {
        const fallback = await supabase
          .from('community_posts')
          .select('*')
          .is('parent_id', null)
          .is('parent_post_id', null)
          .order('created_at', { ascending: false })
          .limit(120);
        rows = fallback.data;
        queryError = fallback.error;
      }

      if (queryError) throw queryError;

      const userIds = [...new Set((rows || []).map((row) => row.user_id).filter(Boolean))];
      let profilesMap = {};

      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url, email')
          .in('id', userIds);

        profilesMap = (profiles || []).reduce((acc, profile) => {
          acc[profile.id] = profile;
          return acc;
        }, {});
      }

      const hydrated = hydratePosts((rows || []).map((post) => ({
        ...post,
        profiles: profilesMap[post.user_id] || null,
      })));

      if (hydrated.length === 0) {
        setPosts(mockFeed);
      } else {
        setPosts(hydrated);
      }
    } catch {
      setPosts(mockFeed);
      setError('Using offline mock feed while live community data is unavailable.');
    } finally {
      setLoading(false);
    }
  }, [hydratePosts, mockFeed]);

  useEffect(() => {
    void fetchPosts();
  }, [fetchPosts]);

  useEffect(() => {
    const channel = supabase
      .channel('community-feed-rebuild-v2')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'community_posts',
          filter: 'parent_id=is.null',
        },
        async (payload) => {
          try {
            const insertedId = payload?.new?.id;
            if (!insertedId) return;

            const { data: inserted } = await supabase
              .from('community_posts')
              .select('*, community_reactions(emoji, user_id)')
              .eq('id', insertedId)
              .maybeSingle();

            if (!inserted) return;

            let profile = null;
            if (inserted.user_id) {
              const { data: profileData } = await supabase
                .from('profiles')
                .select('id, display_name, avatar_url, email')
                .eq('id', inserted.user_id)
                .maybeSingle();
              profile = profileData;
            }

            prependPost({
              ...inserted,
              profiles: profile,
              reaction_summary: buildReactionSummary(inserted.community_reactions || [], currentUser?.id),
              is_mock: false,
            });
          } catch {
            // ignore realtime transient failures
          }
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'community_posts',
        },
        (payload) => {
          const id = payload?.old?.id;
          if (!id) return;
          setPosts((prev) => prev.filter((post) => post.id !== id));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser?.id, prependPost]);

  const trackedSymbols = useMemo(() => {
    const alertSymbols = (Array.isArray(priceAlerts) ? priceAlerts : [])
      .map((alert) => normalizeSymbolKey(String(alert?.ticker || '').replace(/^\$+/, '')))
      .filter(Boolean);
    const symbols = [...new Set([...alertSymbols, ...DEFAULT_TICKERS, ...mentionSymbolsFromPosts(posts)].map(normalizeSymbolKey).filter(Boolean))];
    return symbols.slice(0, 48);
  }, [posts, priceAlerts]);

  const previousTrackedSymbolsRef = useRef([]);

  const refreshQuotesFromCache = useCallback(async (symbols) => {
    const targetSymbols = [...new Set(
      (Array.isArray(symbols) ? symbols : [symbols]).map(normalizeSymbolKey).filter(Boolean)
    )];
    if (targetSymbols.length === 0) return;

    try {
      const params = new URLSearchParams({ symbols: targetSymbols.join(',') });
      const response = await fetch(`/api/community/market-data?${params.toString()}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      if (!response.ok) return;

      const payload = await response.json().catch(() => ({}));
      const rows = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.data)
          ? payload.data
          : [];

      if (rows.length > 0) {
        setQuoteMap((prev) => mergeQuotesFromPayload(rows, prev));
      }
    } catch {
      // keep websocket data if cache bootstrap fails
    }
  }, []);

  useEffect(() => {
    if (trackedSymbols.length === 0) return;

    const previousSymbols = previousTrackedSymbolsRef.current;
    const previousSet = new Set(previousSymbols);
    const addedSymbols = trackedSymbols.filter((symbol) => !previousSet.has(symbol));
    const symbolsToBootstrap = previousSymbols.length === 0
      ? trackedSymbols
      : (addedSymbols.length > 0 ? addedSymbols : trackedSymbols);

    previousTrackedSymbolsRef.current = trackedSymbols;
    void refreshQuotesFromCache(symbolsToBootstrap);
  }, [trackedSymbols, refreshQuotesFromCache]);

  useEffect(() => {
    if (trackedSymbols.length === 0) return undefined;
    console.log('[CommunityPage] Subscribing Twelve Data symbols:', trackedSymbols);

    const unsubscribeQuotes = subscribeTwelveDataQuotes(trackedSymbols, (update) => {
      const symbol = normalizeSymbolKey(update?.symbol);
      if (!symbol) return;
      console.log('[CommunityPage] WS price update received:', {
        symbol,
        price: update?.price,
        dayChangePercent: update?.dayChangePercent ?? update?.percentChange ?? null,
      });

      setQuoteMap((prev) => {
        return {
          ...prev,
          [symbol]: mergeStreamQuote(prev[symbol] || {}, update, symbol),
        };
      });
    });

    const unsubscribeStatus = subscribeTwelveDataStatus((status) => {
      console.log('[CommunityPage] Twelve Data stream status:', status);
      setStreamStatus(status || BASE_STREAM_STATUS);
    });

    return () => {
      console.log('[CommunityPage] Unsubscribing Twelve Data symbols:', trackedSymbols);
      unsubscribeQuotes?.();
      unsubscribeStatus?.();
    };
  }, [trackedSymbols]);

  useEffect(() => {
    if (!quoteMap || Object.keys(quoteMap).length === 0) return;

    const triggeredAlerts = [];
    setPriceAlerts((prev) => {
      let changed = false;
      const next = prev.map((alert) => {
        if (!alert?.active || alert?.triggered) return alert;

        const symbol = normalizeSymbolKey(String(alert?.ticker || '').replace(/^\$+/, ''));
        const targetPrice = toMaybeFiniteNumber(alert?.targetPrice);
        if (!symbol || !Number.isFinite(targetPrice)) return alert;

        const quote = quoteMap?.[symbol];
        const currentPrice = toMaybeFiniteNumber(quote?.price ?? quote?.last ?? quote?.close);
        if (!Number.isFinite(currentPrice)) return alert;

        const direction = alert.direction === 'below' ? 'below' : 'above';
        const isTriggered = direction === 'above'
          ? currentPrice >= targetPrice
          : currentPrice <= targetPrice;

        if (!isTriggered) return alert;

        changed = true;
        const triggeredAlert = {
          ...alert,
          active: false,
          triggered: true,
          triggeredAt: new Date().toISOString(),
        };
        triggeredAlerts.push({ alert: triggeredAlert, currentPrice });
        return triggeredAlert;
      });

      return changed ? next : prev;
    });

    if (triggeredAlerts.length > 0) {
      playAlertSound();
      triggeredAlerts.forEach(({ alert, currentPrice }) => {
        pushAlertToast(alert, currentPrice);
      });
    }
  }, [quoteMap, playAlertSound, pushAlertToast]);

  const createPost = useCallback(async ({ content, postType, metadata = {}, imageFile = null }) => {
    const trimmed = String(content || '').trim();
    if (!trimmed && !imageFile) return false;

    const safeType = sanitizePostType(postType);
    const nowIso = new Date().toISOString();

    if (!currentUser?.id) {
      const localPost = {
        id: `local-post-${Date.now()}`,
        user_id: 'local-user',
        author_name: 'Guest Trader',
        content: trimmed,
        image_url: null,
        ticker_mentions: extractTickers(trimmed),
        post_type: safeType,
        metadata,
        created_at: nowIso,
        likes_count: 0,
        replies_count: 0,
        community_reactions: [],
        reaction_summary: [],
        profiles: {
          id: 'local-user',
          display_name: 'Guest Trader',
          avatar_url: activeAvatarUrl,
          avatar_color: null,
          email: null,
        },
        is_mock: true,
      };
      prependPost(localPost);
      return true;
    }

    setComposerSubmitting(true);

    try {
      let imageUrl = null;

      if (imageFile) {
        const extension = String(imageFile.name || 'png').split('.').pop();
        const fileName = `${currentUser.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from('community-images')
          .upload(fileName, imageFile);

        if (!uploadError) {
          const {
            data: { publicUrl },
          } = supabase.storage.from('community-images').getPublicUrl(fileName);
          imageUrl = publicUrl;
        }
      }

      const { data: inserted, error: insertError } = await supabase
        .from('community_posts')
        .insert({
          user_id: currentUser.id,
          author_name: activeDisplayName,
          content: trimmed,
          image_url: imageUrl,
          ticker_mentions: extractTickers(trimmed),
          post_type: safeType,
          metadata,
        })
        .select('*')
        .single();

      if (insertError) throw insertError;

      prependPost({
        ...inserted,
        community_reactions: [],
        reaction_summary: [],
        profiles: {
          id: currentUser.id,
          display_name: activeDisplayName,
          avatar_url: activeAvatarUrl,
          avatar_color: currentUser.avatar_color || null,
          email: currentUser.email,
        },
        is_mock: false,
      });

      return true;
    } catch {
      const fallbackLocal = {
        id: `local-post-${Date.now()}`,
        user_id: currentUser.id,
        author_name: activeDisplayName,
        content: trimmed,
        image_url: null,
        ticker_mentions: extractTickers(trimmed),
        post_type: safeType,
        metadata,
        created_at: nowIso,
        likes_count: 0,
        replies_count: 0,
        community_reactions: [],
        reaction_summary: [],
        profiles: {
          id: currentUser.id,
          display_name: activeDisplayName,
          avatar_url: activeAvatarUrl,
          avatar_color: currentUser.avatar_color || null,
          email: currentUser.email,
        },
        is_mock: true,
      };
      prependPost(fallbackLocal);
      setError('Post saved locally. Supabase insert failed.');
      return true;
    } finally {
      setComposerSubmitting(false);
    }
  }, [activeAvatarUrl, activeDisplayName, currentUser, prependPost]);

  const handleDeletePost = async (postId, isMock) => {
    const confirmed = window.confirm('Delete this post?');
    if (!confirmed) return;

    setPosts((prev) => prev.filter((post) => post.id !== postId));

    if (isMock) return;

    try {
      await supabase.from('community_posts').delete().eq('id', postId);
    } catch {
      // no-op: optimistic local delete already applied
    }
  };

  const runAiSearch = useCallback(async (queryText) => {
    const trimmedQuery = normalizeAiSearchQuery(queryText);
    if (!trimmedQuery) return false;

    const queryKey = trimmedQuery.toLowerCase();
    const cached = getClientAiSearchCached(queryKey);
    if (cached) {
      setAiSearchResults((prev) => [{
        ...cached,
        id: `ai-search-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        query: trimmedQuery,
        createdAt: new Date().toISOString(),
      }, ...prev]);
      return true;
    }

    setAiSearchPending((prev) => (
      prev.some((row) => row.key === queryKey)
        ? prev
        : [{ key: queryKey, query: trimmedQuery }, ...prev]
    ));

    let request = AI_SEARCH_INFLIGHT.get(queryKey);
    if (!request) {
      request = fetch('/api/community/ai-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: trimmedQuery,
          interests: {
            trackedSymbols: trackedSymbols.slice(0, 12),
            filter: filter || 'all',
            signedIn: Boolean(currentUser?.id),
          },
        }),
      })
        .then(async (response) => {
          if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            const errorText = String(payload?.error || `AI search failed (${response.status})`).trim();
            throw new Error(errorText);
          }
          return response.json();
        })
        .finally(() => {
          AI_SEARCH_INFLIGHT.delete(queryKey);
        });

      AI_SEARCH_INFLIGHT.set(queryKey, request);
    }

    try {
      const payload = await request;
      const cleaned = sanitizeAiSearchData(payload?.data || payload, trimmedQuery);
      setClientAiSearchCached(queryKey, cleaned);

      setAiSearchResults((prev) => [{
        ...cleaned,
        id: `ai-search-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        query: trimmedQuery,
        createdAt: new Date().toISOString(),
      }, ...prev]);

      return true;
    } catch (searchError) {
      setError(String(searchError?.message || 'AI search is temporarily unavailable.'));
      return false;
    } finally {
      setAiSearchPending((prev) => prev.filter((row) => row.key !== queryKey));
    }
  }, [currentUser?.id, filter, trackedSymbols]);

  const clearAiSearchResult = useCallback((id) => {
    setAiSearchResults((prev) => prev.filter((row) => row.id !== id));
  }, []);

  const handleSetPriceAlert = useCallback(async () => {
    const ticker = normalizePriceAlertTicker(priceAlertTickerInput);
    const targetPrice = toMaybeFiniteNumber(priceAlertTargetInput);
    const direction = priceAlertDirection === 'below' ? 'below' : 'above';

    if (!ticker || !Number.isFinite(targetPrice) || targetPrice <= 0) return;

    const alert = {
      id: Date.now(),
      ticker,
      targetPrice: Number(targetPrice.toFixed(2)),
      direction,
      active: true,
      triggered: false,
      createdAt: new Date().toISOString(),
    };

    setPriceAlerts((prev) => [alert, ...prev]);
    setPriceAlertPopoverOpen(false);
    setPriceAlertTickerInput('');
    setPriceAlertTargetInput('');
    setPriceAlertDirection('above');

    try {
      await supabase.from('price_alerts').insert(alert);
    } catch {
      // fall back to local state + localStorage only
    }
  }, [priceAlertDirection, priceAlertTargetInput, priceAlertTickerInput]);

  const togglePriceAlert = useCallback((alertId) => {
    setPriceAlerts((prev) => prev.map((alert) => {
      if (alert.id !== alertId) return alert;
      if (alert.triggered || !alert.active) {
        return { ...alert, active: true, triggered: false };
      }
      return { ...alert, active: false };
    }));
  }, []);

  const deletePriceAlert = useCallback((alertId) => {
    setPriceAlerts((prev) => prev.filter((alert) => alert.id !== alertId));
  }, []);

  const clearCenterFeedSearchResults = useCallback(() => {
    setAiSearchPending([]);
    setAiSearchResults([]);
    setHashtagWebTag('');
    setHashtagWebResults([]);
    setHashtagWebLoading(false);
    setHashtagWebError('');
  }, []);

  const shouldUseWebFallbackForFilter = useCallback((nextFilter) => {
    if (!nextFilter) return false;
    const matchedCount = posts.reduce(
      (count, post) => (postMatchesFeedFilter(post, nextFilter) ? count + 1 : count),
      0,
    );
    return matchedCount < HASHTAG_WEB_MIN_VISIBLE_POSTS;
  }, [posts]);

  const handleSearchModeChange = useCallback((nextMode) => {
    if (nextMode) {
      setSearchMode(true);
      return;
    }

    setSearchMode(false);
    setFilter(null);
    clearCenterFeedSearchResults();
  }, [clearCenterFeedSearchResults]);

  const handleFeedFilterChange = useCallback((nextFilter) => {
    const normalizedFilter = typeof nextFilter === 'string' && String(nextFilter).trim()
      ? String(nextFilter).trim()
      : null;

    setFilter(normalizedFilter);

    if (!normalizedFilter) {
      setSearchMode(false);
      clearCenterFeedSearchResults();
      return;
    }

    if (shouldUseWebFallbackForFilter(normalizedFilter)) {
      setSearchMode(true);
    }
  }, [clearCenterFeedSearchResults, shouldUseWebFallbackForFilter]);

  const activeFeedFilter = filter;
  const activeFeedTag = normalizeFeedHashtag(activeFeedFilter);

  const filteredPosts = useMemo(() => (
    activeFeedFilter
      ? posts.filter((post) => postMatchesFeedFilter(post, activeFeedFilter))
      : posts
  ), [activeFeedFilter, posts]);

  const shouldShowWebFallback = Boolean(activeFeedFilter) && filteredPosts.length < HASHTAG_WEB_MIN_VISIBLE_POSTS;
  const activeHashtagCacheEntry = activeFeedTag ? hashtagWebCache[activeFeedTag] : null;
  const hasCachedHashtagWebEntry = Boolean(activeHashtagCacheEntry);
  const hasActiveHashtagWebResults = shouldShowWebFallback
    && Boolean(activeFeedTag)
    && hashtagWebTag === activeFeedTag
    && hashtagWebResults.length > 0;
  const activeHashtagWebResults = hasActiveHashtagWebResults ? hashtagWebResults : [];
  const activeHashtagWebError = hashtagWebTag === activeFeedTag ? hashtagWebError : '';
  const isHashtagWebPending = shouldShowWebFallback
    && Boolean(activeFeedTag)
    && hashtagWebLoading
    && hashtagWebTag === activeFeedTag
    && !hasCachedHashtagWebEntry;
  const shouldShowSearchingWebMessage = shouldShowWebFallback
    && isHashtagWebPending
    && !hasCachedHashtagWebEntry;
  const shouldShowNoPostsMessage = filteredPosts.length === 0
    && (!shouldShowWebFallback || (!isHashtagWebPending && !hasActiveHashtagWebResults));

  useEffect(() => {
    let cancelled = false;
    const tag = activeFeedTag;

    if (!tag || filteredPosts.length >= HASHTAG_WEB_MIN_VISIBLE_POSTS) {
      setHashtagWebTag(tag);
      setHashtagWebResults([]);
      setHashtagWebLoading(false);
      setHashtagWebError('');
      return undefined;
    }

    setHashtagWebTag(tag);
    setHashtagWebError('');

    const cachedTimestamp = Number(activeHashtagCacheEntry?.timestamp);
    const isCachedFresh = Number.isFinite(cachedTimestamp)
      && (Date.now() - cachedTimestamp < HASHTAG_WEB_CACHE_TTL_MS);
    if (isCachedFresh) {
      setHashtagWebResults(normalizeHashtagWebResults(activeHashtagCacheEntry?.data || []));
      setHashtagWebLoading(false);
      return undefined;
    }

    if (activeHashtagCacheEntry && !isCachedFresh) {
      setHashtagWebCache((prev) => {
        if (!prev?.[tag]) return prev;
        const next = { ...prev };
        delete next[tag];
        persistHashtagWebCache(next);
        return next;
      });
    }

    setHashtagWebResults([]);
    setHashtagWebLoading(true);

    const runHashtagWebSearch = async () => {
      try {
        const requestOptions = {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hashtag: `#${tag}` }),
        };

        let response = await fetch('/api/community/hashtag-search.js', requestOptions);
        if (response.status === 404) {
          response = await fetch('/api/community/hashtag-search', requestOptions);
        }

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(String(payload?.error || `Hashtag search failed (${response.status})`).trim());
        }

        const payload = await response.json().catch(() => ({}));
        const rows = normalizeHashtagWebResults(payload?.items || payload?.data || payload);
        if (cancelled) return;

        setHashtagWebResults(rows);
        setHashtagWebCache((prev) => {
          const updated = { ...prev, [tag]: { data: rows, timestamp: Date.now() } };
          persistHashtagWebCache(updated);
          return updated;
        });
      } catch (fetchError) {
        if (cancelled) return;
        setHashtagWebResults([]);
        setHashtagWebError(String(fetchError?.message || 'Unable to load web search results right now.'));
      } finally {
        if (!cancelled) setHashtagWebLoading(false);
      }
    };

    void runHashtagWebSearch();

    return () => {
      cancelled = true;
    };
  }, [activeFeedTag, activeHashtagCacheEntry, filteredPosts.length]);

  const consumeComposerPrefill = useCallback(() => {
    setComposerPrefilledText('');
    setComposerOpenRewritePanel(false);
  }, []);

  const closeComposer = useCallback(() => {
    setComposerOpen(false);
    consumeComposerPrefill();
  }, [consumeComposerPrefill]);

  const openComposer = (type = 'general', options = {}) => {
    const draftPrefill = String(options?.prefilledText || '');
    const shouldOpenRewritePanel = Boolean(
      options?.openAiRewritePanel && draftPrefill.trim(),
    );
    setComposerInitialType(type);
    setComposerPrefilledText(draftPrefill);
    setComposerOpenRewritePanel(shouldOpenRewritePanel);
    setComposerOpen(true);
  };
  const hasAiSearchCards = aiSearchPending.length > 0 || aiSearchResults.length > 0;

  return (
    <div className="relative h-full w-full overflow-hidden" style={{ backgroundColor: T.bg, color: T.text }}>
      <style>{COMMUNITY_PAGE_STYLES}</style>

      <div className="pointer-events-none absolute inset-0" style={{
        backgroundImage: 'radial-gradient(circle at 8% 2%, rgba(88,166,255,0.16), transparent 38%), radial-gradient(circle at 92% 96%, rgba(63,185,80,0.14), transparent 42%), radial-gradient(circle at 44% 46%, rgba(248,81,73,0.08), transparent 52%)',
      }} />

      <motion.div className="relative z-10 h-full flex flex-col" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        {error ? (
          <div className="px-4 pt-2">
            <div className="rounded-lg border px-3 py-2 text-xs" style={{ borderColor: 'rgba(248,81,73,0.35)', color: T.red, backgroundColor: 'rgba(248,81,73,0.08)' }}>
              {error}
            </div>
          </div>
        ) : null}

        <div className="flex-1 min-h-0 py-0 pr-0 pl-0">
          <div className="h-full flex min-h-0">
            <LeftRail
              collapsed={leftCollapsed}
              onToggleCollapse={() => setLeftCollapsed((prev) => !prev)}
              filter={filter}
              onFilter={handleFeedFilterChange}
              priceAlerts={priceAlerts}
              onTogglePriceAlert={togglePriceAlert}
              onDeletePriceAlert={deletePriceAlert}
              currentUser={currentUser}
              avatarUrl={activeAvatarUrl}
              displayName={activeDisplayName}
              isEditingName={isEditingName}
              editName={editName}
              setEditName={setEditName}
              setIsEditingName={setIsEditingName}
              handleSaveName={handleSaveName}
              enabledFeeds={enabledFeeds}
              onOpenFeedCustomizer={() => setFeedCustomizerOpen(true)}
              activeExploreTab={activeExploreTab}
              onExploreTabChange={setActiveExploreTab}
            />

            <div className="flex-1 min-w-0 min-h-0 overflow-y-hidden overflow-x-visible flex flex-col">
              <div className="flex-1 min-h-0 flex gap-3 pt-3 pr-4">
                <div className="w-[92px] flex-shrink-0" aria-hidden />

                <div className="flex-1 min-w-0 min-h-0 overflow-hidden">
                  <div className={`mx-auto flex h-full w-full min-w-0 flex-col transition-all duration-200${filter ? '' : ' max-w-[750px]'}`}>
                    {!filter && !activeExploreTab && (
                    <div className="px-3 pb-2">
                      <div className="flex items-center justify-end">
                        <div className="relative" ref={priceAlertPopoverRef}>
                          <button
                            type="button"
                            onClick={() => setPriceAlertPopoverOpen((prev) => !prev)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-[#e6edf3] hover:bg-white/10 transition"
                          >
                            <Bell className="h-3.5 w-3.5 text-[#58a6ff]" strokeWidth={1.5} />
                            <span>Price Alert</span>
                          </button>

                          <AnimatePresence initial={false}>
                            {priceAlertPopoverOpen && (
                              <motion.div
                                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                                transition={{ duration: 0.16, ease: 'easeOut' }}
                                className="absolute top-full right-0 mt-2 z-50 bg-[#0d1117] border border-white/10 rounded-xl p-4 shadow-2xl shadow-black/50 w-[300px]"
                              >
                                <div className="relative">
                                  <div className="text-sm font-semibold text-[#e6edf3]">Set Price Alert</div>
                                  <button
                                    type="button"
                                    onClick={() => setPriceAlertPopoverOpen(false)}
                                    className="absolute -top-1 -right-1 inline-flex items-center justify-center text-[#7d8590] hover:text-[#e6edf3] transition-colors"
                                    aria-label="Close price alert"
                                  >
                                    <X className="w-3.5 h-3.5" strokeWidth={1.5} />
                                  </button>
                                </div>

                                <div className="mt-3 space-y-2.5">
                                  <input
                                    type="text"
                                    value={priceAlertTickerInput}
                                    onChange={(event) => setPriceAlertTickerInput(normalizePriceAlertTicker(event.target.value))}
                                    placeholder="$AAPL"
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-[#e6edf3] outline-none"
                                  />

                                  <input
                                    type="number"
                                    value={priceAlertTargetInput}
                                    onChange={(event) => setPriceAlertTargetInput(event.target.value)}
                                    onKeyDown={(event) => {
                                      if (event.key === 'Enter') {
                                        event.preventDefault();
                                        void handleSetPriceAlert();
                                      }
                                    }}
                                    placeholder="250.00"
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-[#e6edf3] outline-none"
                                  />

                                  <div className="grid grid-cols-2 gap-2">
                                    {['above', 'below'].map((direction) => {
                                      const active = priceAlertDirection === direction;
                                      return (
                                        <button
                                          key={direction}
                                          type="button"
                                          onClick={() => setPriceAlertDirection(direction)}
                                          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${active ? 'bg-[#58a6ff] text-black' : 'bg-white/5 text-[#7d8590]'}`.trim()}
                                        >
                                          {direction === 'above' ? 'Above' : 'Below'}
                                        </button>
                                      );
                                    })}
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => void handleSetPriceAlert()}
                                    className="bg-[#58a6ff] text-black font-semibold rounded-lg px-4 py-2 text-sm w-full mt-3 hover:bg-[#79b8ff] transition"
                                  >
                                    Set Alert
                                  </button>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </div>
                    )}

                    {sidebarArticle ? (
                      <AnimatePresence mode="wait" initial={false}>
                        <ArticleReader
                          key={sidebarArticle.url || sidebarArticle.title}
                          item={sidebarArticle}
                          onBack={() => setSidebarArticle(null)}
                        />
                      </AnimatePresence>
                    ) : activeExploreTab === 'history' ? (
                      <div className="flex-1 min-h-0 overflow-y-auto">
                        <HistoryView history={clickHistory} loading={clickHistoryLoading} onClear={clearClickHistory} />
                      </div>
                    ) : activeExploreTab === 'discover' ? (
                      <div className="flex-1 min-h-0 overflow-y-auto">
                        <DiscoverView data={discoverData} loading={discoverLoading} />
                      </div>
                    ) : activeExploreTab === 'spaces' ? (
                      <div className="flex-1 min-h-0 overflow-y-auto">
                        <SpacesView />
                      </div>
                    ) : activeExploreTab === 'finance' ? (
                      <div className="flex-1 min-h-0 overflow-y-auto">
                        <FinanceView data={financeData} loading={financeLoading} />
                      </div>
                    ) : filter ? (
                      <div className="flex-1 min-h-0 overflow-y-auto">
                        <FeedView feedName={filter} onClose={() => handleFeedFilterChange(null)} />
                      </div>
                    ) : (
                    <div className="flex-1 min-h-0 overflow-y-auto px-3">
                      <div className="w-full space-y-2">
                        {aiSearchPending.map((pending) => (
                          <AiSearchLoadingCard key={`ai-search-pending-${pending.key}`} query={pending.query} />
                        ))}

                        {aiSearchResults.map((result) => (
                          <AiSearchResultCard
                            key={result.id}
                            result={result}
                            onClear={() => clearAiSearchResult(result.id)}
                            onTickerClick={(ticker) => {
                              void runAiSearch(`What is happening with ${ticker} today?`);
                            }}
                          />
                        ))}

                        {loading ? (
                          <>
                            {Array.from({ length: 6 }).map((_, index) => (
                              <div
                                key={`loading-${index}`}
                                className="rounded-lg border p-3"
                                style={{ borderColor: T.border, backgroundColor: T.card }}
                              >
                                <div className="flex gap-2">
                                  <ShimmerLine w={32} h={32} rounded={999} />
                                  <div className="flex-1 space-y-2">
                                    <ShimmerLine w="35%" h={11} />
                                    <ShimmerBlock lines={3} />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </>
                        ) : (
                          <>
                            {shouldShowNoPostsMessage ? (
                              <div
                                className={activeFeedFilter ? 'h-full flex items-center justify-center text-sm' : (hasAiSearchCards ? 'rounded-lg border p-3 text-sm' : 'h-full flex items-center justify-center text-sm')}
                                style={{ color: T.muted, borderColor: !activeFeedFilter && hasAiSearchCards ? T.border : 'transparent', backgroundColor: !activeFeedFilter && hasAiSearchCards ? T.card : 'transparent' }}
                              >
                                No posts match this filter.
                              </div>
                            ) : (
                              <motion.div variants={FEED_VARIANTS} initial="hidden" animate="show" className="space-y-2">
                                {filteredPosts.map((post) => (
                                  <PostCard
                                    key={post.id}
                                    post={post}
                                    currentUser={currentUser}
                                    currentUserAvatarUrl={activeAvatarUrl}
                                    onDelete={handleDeletePost}
                                    displayName={activeDisplayName}
                                  />
                                ))}
                              </motion.div>
                            )}

                            {shouldShowWebFallback ? (
                              <div className="mt-3 border-t border-white/6 pt-3 space-y-2">
                                {shouldShowSearchingWebMessage ? (
                                  <div className="text-xs text-[#7d8590]">
                                    Searching the web for more...
                                  </div>
                                ) : null}
                                <div className="text-xs text-[#7d8590] uppercase tracking-wider">
                                  Trending on the web
                                </div>

                                {isHashtagWebPending ? (
                                  <div className="space-y-2">
                                    {Array.from({ length: 3 }).map((_, idx) => (
                                      <div
                                        key={`hashtag-web-loading-${idx}`}
                                        className="relative h-16 overflow-hidden rounded-lg bg-white/3"
                                      >
                                        <div
                                          className="absolute inset-0"
                                          style={{
                                            background: 'linear-gradient(90deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.02) 100%)',
                                            backgroundSize: '200% 100%',
                                            animation: 'shimmer 1.2s linear infinite',
                                          }}
                                        />
                                      </div>
                                    ))}
                                  </div>
                                ) : hasActiveHashtagWebResults ? (
                                  <div className="space-y-2">
                                    {activeHashtagWebResults.map((result, idx) => (
                                      <div
                                        key={`hashtag-web-result-${idx}-${result.headline.slice(0, 24)}`}
                                        className="rounded-xl border border-white/6 bg-white/3 p-3"
                                      >
                                        <div className="text-sm font-medium text-[#e6edf3]">
                                          {result.headline}
                                        </div>
                                        <div className="mt-1 text-xs text-[#7d8590]">
                                          {result.summary}
                                        </div>
                                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[#7d8590]">
                                          <span className="uppercase tracking-wide">{result.source}</span>
                                          {result.relatedTickers.length > 0 ? (
                                            <span>{result.relatedTickers.map((ticker) => `$${ticker}`).join(' • ')}</span>
                                          ) : null}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="rounded-lg border border-white/6 bg-white/3 px-3 py-2 text-xs text-[#7d8590]">
                                    {activeHashtagWebError || `No additional web discussions found for #${hashtagWebTag || activeFeedTag}.`}
                                  </div>
                                )}
                              </div>
                            ) : null}
                          </>
                        )}
                      </div>
                    </div>
                    )}

                    <div className="px-3 pb-3 pt-3">
                      <ChatInputBar
                        currentUser={currentUser}
                        currentUserAvatarUrl={activeAvatarUrl}
                        trackedSymbols={trackedSymbols}
                        quoteMap={quoteMap}
                        streamStatus={streamStatus}
                        searchMode={searchMode}
                        onModeChange={handleSearchModeChange}
                        onOpenComposer={openComposer}
                        onSend={(content, postType) => createPost({ content, postType, metadata: {} })}
                        onSearch={runAiSearch}
                        onFeedSelect={handleFeedFilterChange}
                        activeFeed={filter}
                        enabledFeeds={enabledFeeds}
                      />
                    </div>
                  </div>
                </div>

                <RightSidebar onArticleClick={(article) => {
                  setSidebarArticle(article);
                  // Clear active filter/explore so the center panel is unobstructed
                  setFilter(null);
                  setActiveExploreTab(null);
                }} />
              </div>
            </div>
          </div>
        </div>

      </motion.div>

      <PostComposerModal
        open={composerOpen}
        onClose={closeComposer}
        currentUser={currentUser}
        currentUserAvatarUrl={activeAvatarUrl}
        displayName={activeDisplayName}
        closedTrades={closedTrades}
        submitting={composerSubmitting}
        initialPostType={composerInitialType}
        prefilledText={composerPrefilledText}
        openAiRewritePanelOnOpen={composerOpenRewritePanel}
        onConsumePrefilledText={consumeComposerPrefill}
        onSubmit={createPost}
      />

      <FeedCustomizerModal
        open={feedCustomizerOpen}
        onClose={() => setFeedCustomizerOpen(false)}
        enabledFeeds={enabledFeeds}
        onToggle={toggleFeedEnabled}
      />

      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence initial={false}>
          {alertToasts.map((toast) => (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0, transition: { type: 'spring', stiffness: 280, damping: 24 } }}
              exit={{ opacity: 0, x: 50, transition: { duration: 0.3 } }}
              className="bg-[#0d1117] border border-[#58a6ff]/30 rounded-xl px-4 py-3 shadow-2xl shadow-[#58a6ff]/10 flex items-center gap-3 min-w-[280px] pointer-events-auto"
            >
              <Bell className="w-5 h-5 text-[#58a6ff] alert-toast-bell" strokeWidth={1.5} />
              <div className="min-w-0">
                <div className="text-sm font-medium text-[#e6edf3] truncate">
                  {toast.ticker} hit ${Number.isFinite(toMaybeFiniteNumber(toast.price)) ? Number(toMaybeFiniteNumber(toast.price)).toFixed(2) : '--'}!
                </div>
                <div className="text-xs">
                  <span className={toast.direction === 'above' ? 'text-[#3fb950]' : 'text-[#f85149]'}>
                    {toast.direction === 'above' ? '↑ Above' : '↓ Below'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => dismissAlertToast(toast.id)}
                className="ml-auto text-[#7d8590] hover:text-[#e6edf3] transition"
                aria-label="Close alert notification"
              >
                <X className="w-3.5 h-3.5" strokeWidth={1.5} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default CommunityPage;
