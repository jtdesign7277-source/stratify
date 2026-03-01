import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bookmark,
  Check,
  Folder,
  FolderInput,
  Link2,
  Loader2,
  MessageCircle,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import TickerHoverCard from '../shared/TickerHoverCard';
import {
  createSavedIntelFolder,
  deleteSavedIntelFolder,
  getSavedIntelState,
  getWarRoomFeed,
  moveSavedWarRoomIntel,
  normalizeIntelItem,
  removeSavedWarRoomIntel,
  renameSavedIntelFolder,
  saveWarRoomIntel,
  setWarRoomFeed,
  updateSavedWarRoomIntel,
  WAR_ROOM_SAVED_EVENT,
  WAR_ROOM_STORAGE_KEYS,
} from '../../lib/warRoomIntel';

const QUICK_SCANS = [
  {
    label: 'Market Movers',
    query:
      'Identify the biggest U.S. equity market movers right now with catalyst breakdown, price levels, and near-term risk factors.',
  },
  {
    label: 'Earnings Intel',
    query:
      'Scan this week\'s most important earnings reports for active traders. Include expected volatility, key levels, and bull/bear setup probabilities.',
  },
  {
    label: '$SPY Analysis',
    query:
      'Provide real-time $SPY trade intelligence with key support/resistance, options flow context, catalyst calendar, and tactical bull/bear scenarios.',
  },
  {
    label: 'Fed & Macro',
    query:
      'Summarize live Fed and macro developments affecting risk assets. Include dates, event impact map, and likely market reactions across major indices.',
  },
  {
    label: 'Sector Rotation',
    query:
      'Map current sector rotation in U.S. equities with relative strength shifts, institutional flow clues, and tradeable implications for the next 1-2 weeks.',
  },
  {
    label: 'Crypto Pulse',
    query:
      'Deliver live crypto pulse on $BTC and $ETH with key levels, catalysts, liquidity zones, and bullish vs bearish trigger points for traders.',
  },
];

const PREFETCH_SCANS = QUICK_SCANS; // Prefetch all 6 scans from Redis on mount
const CACHE_TTL_MS = 604800000; // 7 days
const FEED_TIMESTAMP_KEY = 'stratify-war-room-feed-ts';
const WARROOM_TAB_CACHE_PREFIX = 'warroom_cache_';

const getFeedTimestamp = () => {
  try { return Number(localStorage.getItem(FEED_TIMESTAMP_KEY)) || 0; } catch { return 0; }
};
const setFeedTimestamp = () => {
  try { localStorage.setItem(FEED_TIMESTAMP_KEY, String(Date.now())); } catch {}
};
const isFeedFresh = () => Date.now() - getFeedTimestamp() < CACHE_TTL_MS;

const toCacheTabName = (tabName = '') =>
  String(tabName || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/(^_+|_+$)/g, '') || 'unknown';

const getWarRoomCacheKey = (tabName) => `${WARROOM_TAB_CACHE_PREFIX}${toCacheTabName(tabName)}`;

const readWarRoomCache = (tabName) => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(getWarRoomCacheKey(tabName));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const generatedAt = Number(parsed?.generatedAt || 0);
    if (!generatedAt || Date.now() - generatedAt > CACHE_TTL_MS) {
      localStorage.removeItem(getWarRoomCacheKey(tabName));
      return null;
    }
    return parsed?.data || null;
  } catch {
    return null;
  }
};

const writeWarRoomCache = (tabName, data) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      getWarRoomCacheKey(tabName),
      JSON.stringify({ data, generatedAt: Date.now() })
    );
  } catch {}
};

const clearWarRoomCaches = () => {
  if (typeof window === 'undefined') return;
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && key.startsWith(WARROOM_TAB_CACHE_PREFIX)) {
        keys.push(key);
      }
    }
    keys.forEach((key) => localStorage.removeItem(key));
  } catch {}
};

const makeScanCard = (label, payload, query = '') =>
  normalizeIntelItem({
    id: `warroom-cached-${label.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
    title: label,
    query,
    content: String(payload?.content || ''),
    sources: payload?.sources || [],
    sourceLabel: 'Claude Intel',
    createdAt: new Date().toISOString(),
  });

const fetchCachedScan = async (label) => {
  const localCached = readWarRoomCache(label);
  if (localCached?.content) {
    return makeScanCard(label, localCached, localCached.query || '');
  }

  try {
    const res = await fetch(`/api/warroom?label=${encodeURIComponent(label)}`, {
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const payload = await res.json().catch(() => null);
    if (!payload?.content) return null;
    writeWarRoomCache(label, {
      title: label,
      query: '',
      content: String(payload.content || ''),
      sources: payload.sources || [],
    });
    return makeScanCard(label, payload, '');
  } catch { return null; }
};

const fetchSingleScan = async (query, title) => {
  const response = await fetch('/api/warroom', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, cacheLabel: title }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) return null;
  return normalizeIntelItem({
    id: `warroom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    query,
    content: String(payload?.content || ''),
    sources: payload?.sources || [],
    sourceLabel: 'Claude Intel',
    createdAt: new Date().toISOString(),
  });
};

function XLogo({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

const INLINE_TOKEN_REGEX = /(\$[A-Z]{1,5}\b|[+-]\$?\d[\d,]*(?:\.\d+)?%?|\$?\d[\d,]*(?:\.\d+)?%?)/g;

const warRoomStyles = `
  .warroom-glitch {
    animation: warroomBootGlitch 0.2s steps(2, end);
  }

  @keyframes warroomBootGlitch {
    0% { opacity: 0.4; transform: translateX(-2px); }
    20% { opacity: 0.85; transform: translateX(2px); }
    40% { opacity: 0.6; transform: translateX(-1px); }
    70% { opacity: 0.9; transform: translateX(1px); }
    100% { opacity: 1; transform: translateX(0); }
  }

  .scan-button-pulse {
    animation: scanButtonPulse 2.2s ease-in-out infinite;
  }

  @keyframes scanButtonPulse {
    0%, 100% {
      box-shadow: 0 0 0 rgba(245, 158, 11, 0);
    }
    50% {
      box-shadow: 0 0 12px rgba(245, 158, 11, 0.22);
    }
  }
`;

const fmtB = (val) => {
  const n = Number(val);
  if (!n || Number.isNaN(n)) return '—';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
};

const fmtPct = (val) => {
  const n = Number(val);
  if (!n || Number.isNaN(n)) return '—';
  return `${(n * 100).toFixed(1)}%`;
};

const formatTimestamp = (value) => {
  const parsed = new Date(value || Date.now());
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleString([], {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const toSourceLinks = (sources) => {
  if (!Array.isArray(sources)) return [];
  return sources
    .map((source, index) => {
      if (typeof source === 'string') {
        const url = source.trim();
        if (!/^https?:\/\//i.test(url)) return null;
        return { url, title: `Source ${index + 1}` };
      }

      if (!source || typeof source !== 'object') return null;
      const url = String(source.url || source.link || source.href || '').trim();
      if (!/^https?:\/\//i.test(url)) return null;
      const title = String(source.title || source.name || `Source ${index + 1}`).trim();
      return { url, title: title || `Source ${index + 1}` };
    })
    .filter(Boolean);
};

const tokenClassName = (token) => {
  if (/^\$[A-Z]{1,5}$/.test(token)) return 'text-blue-400 font-semibold';
  if (/^\+[\$]?\d/.test(token)) return 'text-blue-400 font-semibold';
  if (/^-[$]?\d/.test(token)) return 'text-red-400 font-semibold';
  if (/\d/.test(token)) return 'text-slate-200';
  return 'text-zinc-300';
};

const renderInlineText = (text, keyPrefix) => {
  const source = String(text || '');
  if (!source) return null;

  const parts = source.split(INLINE_TOKEN_REGEX).filter((part) => part !== '');
  if (!parts.length) return <span className="text-zinc-300">{source}</span>;

  return parts.map((part, index) => {
    const isToken = /^\$[A-Z]{1,5}$/.test(part) || /^[-+]?[$]?\d/.test(part);
    const className = isToken ? tokenClassName(part) : 'text-zinc-300';
    return (
      <span key={`${keyPrefix}-${index}`} className={className}>
        {part}
      </span>
    );
  });
};

const renderLine = (line, index, keyPrefix) => {
  const trimmed = line.trim();
  if (!trimmed) return <div key={`${keyPrefix}-space-${index}`} className="h-2.5" />;

  if (/^#{1,2}\s+/.test(trimmed)) {
    const heading = trimmed.replace(/^#{1,2}\s+/, '');
    return (
      <h3 key={`${keyPrefix}-heading-${index}`} className="text-white font-bold text-xl tracking-tight leading-snug mt-4 mb-1.5">
        {renderInlineText(heading, `${keyPrefix}-heading-text-${index}`)}
      </h3>
    );
  }

  if (/^#{3,6}\s+/.test(trimmed)) {
    const heading = trimmed.replace(/^#{3,6}\s+/, '');
    return (
      <h4 key={`${keyPrefix}-heading-${index}`} className="text-blue-300 font-semibold text-base leading-relaxed mt-3 mb-1">
        {renderInlineText(heading, `${keyPrefix}-heading-text-${index}`)}
      </h4>
    );
  }

  if (/^[-*•]\s+/.test(trimmed)) {
    const bulletText = trimmed.replace(/^[-*•]\s+/, '');
    return (
      <div key={`${keyPrefix}-bullet-${index}`} className="flex items-start gap-2.5 text-[15px] text-zinc-200 leading-7">
        <span className="text-blue-400/70 mt-0.5">•</span>
        <span>{renderInlineText(bulletText, `${keyPrefix}-bullet-text-${index}`)}</span>
      </div>
    );
  }

  if (/^\d+\.\s+/.test(trimmed)) {
    return (
      <div key={`${keyPrefix}-numbered-${index}`} className="text-[15px] text-zinc-200 leading-7">
        {renderInlineText(trimmed, `${keyPrefix}-numbered-text-${index}`)}
      </div>
    );
  }

  return (
    <p key={`${keyPrefix}-line-${index}`} className="text-[15px] text-zinc-200 leading-7">
      {renderInlineText(trimmed, `${keyPrefix}-line-text-${index}`)}
    </p>
  );
};

// Split content into sections at headings, no save buttons (used in saved/folders views)
const renderIntelBody = (content, keyPrefix) => {
  const lines = String(content || '').split('\n');
  return lines.map((line, index) => renderLine(line, index, keyPrefix));
};

export default function WarRoom({ onClose }) {
  const [query, setQuery] = useState('');
  const [intelFeed, setIntelFeed] = useState(() => getWarRoomFeed());
  const [savedState, setSavedState] = useState(() => getSavedIntelState());
  const [activeView, setActiveView] = useState('live');
  const [activeScanLabel, setActiveScanLabel] = useState(QUICK_SCANS[0]?.label || 'Market Movers');
  const [selectedFolderId, setSelectedFolderId] = useState(() => getSavedIntelState().folders?.[0]?.id || null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [isGlitching, setIsGlitching] = useState(true);
  const [transcriptSymbol, setTranscriptSymbol] = useState('');
  const [transcriptData, setTranscriptData] = useState(null);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const [transcriptError, setTranscriptError] = useState('');
  const [secFilings, setSecFilings] = useState(null);
  const [secLoading, setSecLoading] = useState(false);
  const [financials, setFinancials] = useState(null); // { balanceSheet, incomeStatement, cashFlow }
  const [financialsLoading, setFinancialsLoading] = useState(false);
  const [toast, setToast] = useState('');
  const [clipText, setClipText] = useState('');
  const [clipFolderId, setClipFolderId] = useState(null);
  const [showClipSave, setShowClipSave] = useState(false);
  const [newFolderInput, setNewFolderInput] = useState('');

  const [saveMenu, setSaveMenu] = useState({ cardId: null, showNewFolder: false, newFolderName: '' });
  const [moveMenu, setMoveMenu] = useState({ cardId: null, folderId: null, showNewFolder: false, newFolderName: '' });
  const [folderContextMenu, setFolderContextMenu] = useState(null);

  const toastTimerRef = useRef(null);
  const longPressRef = useRef({ timer: null, opened: false });
  const liveFeedScrollRef = useRef(null);

  const folders = useMemo(() => (Array.isArray(savedState?.folders) ? savedState.folders : []), [savedState]);

  const selectedFolder = useMemo(() => {
    if (!folders.length) return null;
    return folders.find((folder) => folder.id === selectedFolderId) || folders[0];
  }, [folders, selectedFolderId]);

  const savedItems = useMemo(() => selectedFolder?.items || [], [selectedFolder]);

  const savedIds = useMemo(() => {
    const set = new Set();
    folders.forEach((folder) => {
      folder.items.forEach((item) => {
        if (item?.id) set.add(String(item.id));
      });
    });
    return set;
  }, [folders]);

  const showToast = (message) => {
    setToast(String(message || '').trim());
  };

  const scrollLiveFeedToTop = useCallback(() => {
    const scrollNow = () => {
      const node = liveFeedScrollRef.current;
      if (!node) return false;
      node.scrollTo({ top: 0, behavior: 'auto' });
      return true;
    };

    if (scrollNow()) return;

    requestAnimationFrame(() => {
      if (scrollNow()) return;
      setTimeout(() => {
        scrollNow();
      }, 0);
    });
  }, []);

  const [prefetching, setPrefetching] = useState(false);

  const [sectionSaveMenu, setSectionSaveMenu] = useState(null);
  const [editingItem, setEditingItem] = useState(null); // { id, folderId, content }
  const [composingFolderId, setComposingFolderId] = useState(null);
  const [composeText, setComposeText] = useState('');

  // Script rewriter (Claude chat)
  const [rewriter, setRewriter] = useState(null); // { folderId, itemId, original }
  const [rewriterStyle, setRewriterStyle] = useState(null);
  const [rewriterResult, setRewriterResult] = useState('');
  const [rewriterLoading, setRewriterLoading] = useState(false);

  const DEFAULT_FOLDER_NAMES = ['AI Rewrites', 'Market Movers', 'Earnings Intel', '$SPY Analysis', 'Fed & Macro', 'Sector Rotation', 'Crypto Pulse'];

  // Ensure the 6 default folders exist on mount
  useEffect(() => {
    let state = getSavedIntelState();
    const existing = new Set((state.folders || []).map(f => f.name));
    let changed = false;
    for (const name of DEFAULT_FOLDER_NAMES) {
      if (!existing.has(name)) {
        const result = createSavedIntelFolder(name);
        state = result.state;
        changed = true;
      }
    }
    if (changed) setSavedState(state);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const timer = setTimeout(() => setIsGlitching(false), 200);
    return () => clearTimeout(timer);
  }, []);

  // Auto-load cached scans from Redis on mount for instant War Room data
  useEffect(() => {
    const cachedFeed = getWarRoomFeed();
    if (cachedFeed.length > 0 && isFeedFresh()) return; // fresh local cache, skip

    let cancelled = false;
    setPrefetching(true);

    const prefetch = async () => {
      const results = await Promise.allSettled(
        PREFETCH_SCANS.map((scan) => fetchCachedScan(scan.label))
      );
      if (cancelled) return;

      const newCards = results
        .filter((r) => r.status === 'fulfilled' && r.value?.content)
        .map((r) => r.value);

      if (newCards.length > 0) {
        setIntelFeed((prev) => {
          const existingTitles = new Set(prev.map((c) => c.title));
          const unique = newCards.filter((c) => !existingTitles.has(c.title));
          return [...unique, ...prev].slice(0, 50);
        });
        setFeedTimestamp();
      }

      // If any scans were missing from cache, warm them in background
      const missedScans = PREFETCH_SCANS.filter((scan, i) => {
        const r = results[i];
        return r.status !== 'fulfilled' || !r.value?.content;
      });
      if (missedScans.length > 0) {
        missedScans.forEach((scan) => {
          fetch('/api/warroom', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: scan.query, cacheLabel: scan.label }),
          }).catch(() => {});
        });
      }

      setPrefetching(false);
    };

    prefetch();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setWarRoomFeed(intelFeed);
  }, [intelFeed]);

  useEffect(() => {
    if (!folders.length) {
      setSelectedFolderId(null);
      return;
    }

    if (!selectedFolderId || !folders.some((folder) => folder.id === selectedFolderId)) {
      setSelectedFolderId(folders[0].id);
    }
  }, [folders, selectedFolderId]);

  useEffect(() => {
    const onStorage = (event) => {
      const key = event?.key;
      if (!key) return;

      if (key === WAR_ROOM_STORAGE_KEYS.feed) {
        setIntelFeed(getWarRoomFeed());
      }

      if (key === WAR_ROOM_STORAGE_KEYS.saved || key === WAR_ROOM_STORAGE_KEYS.legacySaved) {
        setSavedState(getSavedIntelState());
      }
    };

    const onSavedEvent = () => {
      setSavedState(getSavedIntelState());
    };

    const onOutsideClick = (event) => {
      const target = event.target;
      if (!target || typeof target.closest !== 'function') return;

      const inSaveMenu = Boolean(target.closest('[data-save-trigger]') || target.closest('[data-save-popover]'));
      const inMoveMenu = Boolean(target.closest('[data-move-trigger]') || target.closest('[data-move-popover]'));
      const inFolderContext = Boolean(
        target.closest('[data-folder-context-trigger]') || target.closest('[data-folder-context-menu]')
      );

      if (!inSaveMenu) {
        setSaveMenu((prev) => (prev.cardId ? { cardId: null, showNewFolder: false, newFolderName: '' } : prev));
      }
      if (!inMoveMenu) {
        setMoveMenu((prev) =>
          prev.cardId ? { cardId: null, folderId: null, showNewFolder: false, newFolderName: '' } : prev
        );
      }
      if (!inFolderContext) {
        setFolderContextMenu(null);
      }
      // Close section save menu on outside click
      const inSectionSave = Boolean(target.closest('[data-section-save]'));
      if (!inSectionSave) setSectionSaveMenu(null);
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener(WAR_ROOM_SAVED_EVENT, onSavedEvent);
    document.addEventListener('pointerdown', onOutsideClick);

    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(WAR_ROOM_SAVED_EVENT, onSavedEvent);
      document.removeEventListener('pointerdown', onOutsideClick);
    };
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(''), 2000);
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, [toast]);

  const syncSupabaseSave = async (item, folderName) => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;
      if (!userId) return;

      await supabase.from('warroom_intel').insert({
        user_id: userId,
        folder_name: folderName,
        content: String(item?.content || ''),
        created_at: item?.savedAt || new Date().toISOString(),
      });
    } catch (syncError) {
      console.warn('[WarRoom] Supabase warroom_intel sync failed:', syncError);
    }
  };

  const handleCreateFolderOnly = (name) => {
    const folderName = String(name || '').trim();
    if (!folderName) return null;

    const result = createSavedIntelFolder(folderName);
    setSavedState(result.state);
    if (result.folder?.id) setSelectedFolderId(result.folder.id);
    return result.folder || null;
  };

  const handleSaveToFolder = async (intelCard, folderRef) => {
    const result = saveWarRoomIntel(
      {
        ...intelCard,
        title: intelCard?.title,
        content: intelCard?.content,
        query: intelCard?.query,
        sources: toSourceLinks(intelCard?.sources || []),
      },
      folderRef
    );

    setSavedState(result.state);
    setSaveMenu({ cardId: null, showNewFolder: false, newFolderName: '' });
    setMoveMenu({ cardId: null, folderId: null, showNewFolder: false, newFolderName: '' });

    if (result.folder?.id) setSelectedFolderId(result.folder.id);
    showToast(`Intel saved to ${result.folder?.name || 'folder'}`);
    await syncSupabaseSave(result.item, result.folder?.name || 'Custom');
  };

  const handleMoveToFolder = async (item, fromFolderId, toFolderRef) => {
    const result = moveSavedWarRoomIntel(item, fromFolderId, toFolderRef);
    if (!result?.state) return;

    setSavedState(result.state);
    setMoveMenu({ cardId: null, folderId: null, showNewFolder: false, newFolderName: '' });
    if (result.folder?.id) setSelectedFolderId(result.folder.id);

    showToast(`Intel moved to ${result.folder?.name || 'folder'}`);
    if (result.item && result.folder?.name) {
      await syncSupabaseSave(result.item, result.folder.name);
    }
  };

  const handleRemoveSavedIntel = (folderId, itemId) => {
    const result = removeSavedWarRoomIntel(itemId, folderId);
    setSavedState(result.state);
    setMoveMenu({ cardId: null, folderId: null, showNewFolder: false, newFolderName: '' });
    if (editingItem?.id === itemId) setEditingItem(null);
    showToast('Intel removed');
  };

  const startEditing = (card, folderId) => {
    setEditingItem({ id: card.id, folderId, content: card.content || '' });
  };

  const saveEdit = () => {
    if (!editingItem) return;
    const result = updateSavedWarRoomIntel(editingItem.id, editingItem.folderId, { content: editingItem.content });
    setSavedState(result.state);
    setEditingItem(null);
    showToast('Intel updated');
  };

  const cancelEdit = () => setEditingItem(null);

  const startCompose = (folderId) => {
    setComposingFolderId(folderId);
    setComposeText('');
  };

  const saveCompose = () => {
    if (!composeText.trim() || !composingFolderId) return;
    const item = normalizeIntelItem({
      id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: composeText.trim().split('\n')[0].slice(0, 60) || 'Custom Note',
      content: composeText.trim(),
      sources: [],
      sourceLabel: 'Custom Note',
      createdAt: new Date().toISOString(),
    });
    const result = saveWarRoomIntel(item, composingFolderId);
    setSavedState(result.state);
    setComposingFolderId(null);
    setComposeText('');
    showToast('Note saved');
  };

  const cancelCompose = () => {
    setComposingFolderId(null);
    setComposeText('');
  };

  const postToX = (content) => {
    const text = String(content || '').slice(0, 280);
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer,width=550,height=420');
  };

  const openRewriter = (card, folderId) => {
    setRewriter({ folderId, itemId: card.id, original: card.content || card.title || '' });
    setRewriterStyle(null);
    setRewriterResult('');
    setRewriterLoading(false);
  };

  const closeRewriter = () => {
    setRewriter(null);
    setRewriterStyle(null);
    setRewriterResult('');
    setRewriterLoading(false);
  };

  const generateRewrite = async () => {
    if (!rewriter?.original || !rewriterStyle) return;
    setRewriterLoading(true);
    setRewriterResult('');
    try {
      const res = await fetch('/api/rewrite-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script: rewriter.original, style: rewriterStyle }),
        signal: AbortSignal.timeout(25000),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed');
      setRewriterResult(data.rewritten || '');
    } catch (err) {
      setRewriterResult(`Error: ${err?.message || 'Failed to generate rewrite'}`);
    } finally {
      setRewriterLoading(false);
    }
  };

  const saveRewriteToFolder = () => {
    if (!rewriter || !rewriterResult || rewriterResult.startsWith('Error:')) return false;
    const styleName = rewriterStyle ? rewriterStyle.charAt(0).toUpperCase() + rewriterStyle.slice(1) : 'Custom';
    const item = {
      id: `rewrite-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      title: `✨ ${styleName} Rewrite`,
      content: rewriterResult,
      sourceLabel: 'AI Rewrite',
    };
    // Ensure AI Rewrites folder exists
    const current = getSavedIntelState();
    const hasFolder = current.folders.some((f) => f.name === 'AI Rewrites');
    if (!hasFolder) {
      const created = createSavedIntelFolder('AI Rewrites');
      setSavedState(created.state);
    }
    const result = saveWarRoomIntel(item, 'AI Rewrites');
    setSavedState(result.state);
    return true;
  };

  const confirmRewrite = () => {
    if (saveRewriteToFolder()) {
      showToast('Saved to AI Rewrites folder');
      closeRewriter();
    }
  };

  const postRewriteToX = () => {
    if (!rewriterResult || rewriterResult.startsWith('Error:')) return;
    saveRewriteToFolder();
    showToast('Saved to AI Rewrites folder');
    postToX(rewriterResult);
  };

  const handleRenameFolder = (folderId) => {
    const folder = folders.find((entry) => entry.id === folderId);
    if (!folder) return;

    const nextName = window.prompt('Rename folder', folder.name);
    if (!nextName) {
      setFolderContextMenu(null);
      return;
    }

    const result = renameSavedIntelFolder(folderId, nextName);
    setSavedState(result.state);
    if (result.error) {
      showToast(result.error);
    } else if (result.folder?.name) {
      showToast(`Folder renamed to ${result.folder.name}`);
    }

    setFolderContextMenu(null);
  };

  const handleDeleteFolder = (folderId) => {
    const folder = folders.find((entry) => entry.id === folderId);
    if (!folder) return;
    if (folder.name === 'AI Rewrites') return; // Protected folder

    const confirmed = window.confirm(`Delete folder "${folder.name}"?`);
    if (!confirmed) {
      setFolderContextMenu(null);
      return;
    }

    const result = deleteSavedIntelFolder(folderId);
    setSavedState(result.state);

    if (selectedFolderId === folderId) {
      setSelectedFolderId(result.state?.folders?.[0]?.id || null);
    }

    showToast(`Folder deleted: ${folder.name}`);
    setFolderContextMenu(null);
  };

  const openFolderContextMenu = (folderId, clientX, clientY) => {
    setFolderContextMenu({ folderId, x: clientX, y: clientY });
  };

  const handleFolderTouchStart = (event, folderId) => {
    const touch = event.touches?.[0];
    if (!touch) return;

    longPressRef.current.opened = false;
    longPressRef.current.timer = setTimeout(() => {
      longPressRef.current.opened = true;
      openFolderContextMenu(folderId, touch.clientX, touch.clientY);
    }, 550);
  };

  const clearFolderLongPress = () => {
    if (longPressRef.current.timer) {
      clearTimeout(longPressRef.current.timer);
      longPressRef.current.timer = null;
    }
  };

  const runScan = async (inputQuery, titleOverride = '', options = {}) => {
    const trimmedQuery = String(inputQuery || '').trim();
    const forceRefresh = options?.forceRefresh === true;
    if (!trimmedQuery || isLoading) return;
    if (titleOverride) setActiveScanLabel(titleOverride);

    setError('');
    setIsLoading(true);

    try {
      // 1. Try Redis cache first (instant) — only for known quick scans
      if (titleOverride && !forceRefresh) {
        const cached = await fetchCachedScan(titleOverride);
        if (cached) {
          setIntelFeed((prev) => [cached, ...prev].slice(0, 50));
          setFeedTimestamp();
          setQuery('');
          setActiveView('live');
          setIsLoading(false);
          return;
        }
      }

      // 2. Cache miss — fall back to live Claude API call
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 65000);

      try {
        const response = await fetch('/api/warroom', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: trimmedQuery, cacheLabel: titleOverride || '', forceRefresh }),
          signal: controller.signal,
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.error || `Request failed (${response.status})`);
        }

        const intelCard = normalizeIntelItem({
          id: `warroom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          title: titleOverride || trimmedQuery,
          query: trimmedQuery,
          content: String(payload?.content || 'No market intel returned.'),
          sources: toSourceLinks(payload?.sources || []),
          sourceLabel: 'Claude Intel',
          createdAt: new Date().toISOString(),
        });

        setIntelFeed((prev) => [intelCard, ...prev].slice(0, 50));
        if (titleOverride) {
          writeWarRoomCache(titleOverride, {
            title: titleOverride,
            query: trimmedQuery,
            content: String(payload?.content || 'No market intel returned.'),
            sources: payload?.sources || [],
          });
        }
        setFeedTimestamp();
        setQuery('');
        setActiveView('live');
      } finally {
        clearTimeout(timeout);
      }
    } catch (scanError) {
      const msg = scanError?.name === 'AbortError'
        ? 'Scan timed out. Try again — cached results load faster.'
        : (scanError?.message || 'Scan failed. Try again.');
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSection = (sectionText, folderId) => {
    if (!sectionText?.trim() || !folderId) return;
    const lines = sectionText.trim().split('\n').slice(0, 10);
    const text = lines.join('\n').slice(0, 1000);
    const item = normalizeIntelItem({
      id: `clip-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: text.split('\n')[0].replace(/^#{1,6}\s+/, '').slice(0, 60) || 'Saved Intel',
      content: text,
      sources: [],
      sourceLabel: 'Saved Clip',
      createdAt: new Date().toISOString(),
    });
    const result = saveWarRoomIntel(item, folderId);
    setSavedState(result.state);
    if (result.folder?.id) setSelectedFolderId(result.folder.id);
    setSectionSaveMenu(null);
    showToast(`Saved to ${result.folder?.name || 'folder'}`);
  };

  const handleSaveSelection = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    let text = sel.toString().trim();
    if (!text) return;
    // Limit to ~10 lines
    const lines = text.split('\n').slice(0, 10);
    text = lines.join('\n');
    if (text.length > 1000) text = text.slice(0, 1000) + '...';
    setClipText(text);
    setClipFolderId(folders[0]?.id || null);
    setShowClipSave(true);
    sel.removeAllRanges();
  };

  const confirmClipSave = () => {
    if (!clipText.trim()) return;
    const targetFolderId = clipFolderId || folders[0]?.id || 'Custom';
    const item = normalizeIntelItem({
      id: `clip-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: clipText.split('\n')[0].slice(0, 60) || 'Saved Clip',
      content: clipText,
      sources: [],
      sourceLabel: 'Saved Clip',
      createdAt: new Date().toISOString(),
    });
    const result = saveWarRoomIntel(item, targetFolderId);
    setSavedState(result.state);
    if (result.folder?.id) setSelectedFolderId(result.folder.id);
    setShowClipSave(false);
    setClipText('');
    showToast(`Saved to ${result.folder?.name || 'folder'}`);
  };

  // Split intel content at headings, render save buttons between sections
  const renderIntelBodyWithSave = (content, keyPrefix) => {
    const lines = String(content || '').split('\n');
    // Split into sections at ## or ### headings
    const sections = [];
    let current = { lines: [], raw: '' };
    for (const line of lines) {
      if (/^#{1,3}\s+/.test(line.trim()) && current.lines.length > 0) {
        sections.push(current);
        current = { lines: [], raw: '' };
      }
      current.lines.push(line);
      current.raw += (current.raw ? '\n' : '') + line;
    }
    if (current.lines.length > 0) sections.push(current);

    return sections.map((section, si) => {
      const sectionKey = `${keyPrefix}-sec-${si}`;
      const menuOpen = sectionSaveMenu === sectionKey;
      return (
        <div key={sectionKey}>
          <div className="space-y-1.5">
            {section.lines.map((line, li) => renderLine(line, li, `${sectionKey}-l`))}
          </div>
          {/* Accent divider + save button */}
          <div className="relative flex items-center gap-2 my-3">
            <div className="flex-1 h-px bg-blue-500/20" />
            <div className="relative" data-section-save>
              <button
                type="button"
                onClick={() => setSectionSaveMenu(menuOpen ? null : sectionKey)}
                className="text-[10px] uppercase tracking-wider text-blue-300 hover:text-blue-200 bg-blue-500/10 border border-blue-500/25 rounded px-2 py-0.5 transition-colors"
              >
                Save to Folder
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-6 z-40 w-48 rounded-lg border border-gray-700 bg-[#0a0f14] shadow-xl p-1.5">
                  {folders.map(f => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => handleSaveSection(section.raw, f.id)}
                      className="w-full text-left rounded px-2 py-1.5 text-xs text-gray-300 hover:bg-blue-500/10 hover:text-white transition-colors"
                    >
                      {f.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex-1 h-px bg-blue-500/20" />
          </div>
        </div>
      );
    });
  };

  const fetchTranscript = async (symbol, options = {}) => {
    const trimmed = String(symbol || '').trim().toUpperCase().replace(/^\$/, '');
    const forceRefresh = options?.forceRefresh === true;
    if (!trimmed || transcriptLoading) return;
    setTranscriptError('');
    setTranscriptData(null);
    setSecFilings(null);
    setFinancials(null);
    setTranscriptLoading(true);
    setSecLoading(true);
    setFinancialsLoading(true);
    const transcriptTabName = `transcripts_${trimmed}`;
    const localTranscript = forceRefresh ? null : readWarRoomCache(transcriptTabName);

    // Fetch transcript, SEC filings, and financials in parallel
    const transcriptPromise = (localTranscript?.content
      ? Promise.resolve().then(() => {
          setTranscriptData({
            symbol: trimmed,
            content: localTranscript.content,
            sources: localTranscript.sources || [],
            fromCache: true,
          });
        })
      : fetch(`/api/earnings-transcript?symbol=${encodeURIComponent(trimmed)}${forceRefresh ? '&flush=1' : ''}`)
          .then(async (res) => {
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(payload?.error || `Request failed (${res.status})`);
            const nextData = {
              symbol: trimmed,
              content: payload.content,
              sources: payload.sources || [],
              fromCache: payload.fromCache,
            };
            setTranscriptData(nextData);
            writeWarRoomCache(transcriptTabName, {
              symbol: trimmed,
              content: payload.content,
              sources: payload.sources || [],
            });
          }))
      .catch((err) => setTranscriptError(err?.message || 'Failed to fetch transcript'))
      .finally(() => setTranscriptLoading(false));

    const secPromise = fetch(`/api/sec-filings?symbol=${encodeURIComponent(trimmed)}`)
      .then(async (res) => {
        if (!res.ok) return;
        const payload = await res.json().catch(() => null);
        if (payload?.filings) setSecFilings(payload);
      })
      .catch(() => {})
      .finally(() => setSecLoading(false));

    const extractData = (val) => {
      if (!val) return [];
      // Endpoints return { source, data: [...] } or raw array
      if (Array.isArray(val)) return val;
      if (Array.isArray(val.data)) return val.data;
      return [];
    };

    const financialsPromise = Promise.allSettled([
      fetch(`/api/xray/balance-sheet?symbol=${encodeURIComponent(trimmed)}&period=quarterly`).then(r => r.ok ? r.json() : null),
      fetch(`/api/xray/income-statement?symbol=${encodeURIComponent(trimmed)}&period=quarterly`).then(r => r.ok ? r.json() : null),
      fetch(`/api/xray/cash-flow?symbol=${encodeURIComponent(trimmed)}&period=quarterly`).then(r => r.ok ? r.json() : null),
    ]).then(([bs, is, cf]) => {
      setFinancials({
        balanceSheet: extractData(bs.status === 'fulfilled' ? bs.value : null),
        incomeStatement: extractData(is.status === 'fulfilled' ? is.value : null),
        cashFlow: extractData(cf.status === 'fulfilled' ? cf.value : null),
      });
    }).catch(() => {}).finally(() => setFinancialsLoading(false));

    await Promise.allSettled([transcriptPromise, secPromise, financialsPromise]);
  };

  const handleManualRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setError('');

    try {
      clearWarRoomCaches();
      try { localStorage.removeItem(FEED_TIMESTAMP_KEY); } catch {}

      if (activeView === 'transcripts') {
        const symbolToRefresh = String(transcriptSymbol || transcriptData?.symbol || '').trim();
        if (!symbolToRefresh) {
          setTranscriptError('Enter a ticker to refresh transcript intel.');
          return;
        }
        await fetchTranscript(symbolToRefresh, { forceRefresh: true });
        return;
      }

      const targetScan = QUICK_SCANS.find((scan) => scan.label === activeScanLabel) || QUICK_SCANS[0];
      if (!targetScan) return;
      setActiveScanLabel(targetScan.label);
      await runScan(targetScan.query, targetScan.label, { forceRefresh: true });
    } finally {
      setIsRefreshing(false);
    }
  };

  const allSavedCount = useMemo(
    () => folders.reduce((count, folder) => count + folder.items.length, 0),
    [folders]
  );

  return (
    <div className={`h-full w-full bg-transparent relative overflow-hidden ${isGlitching ? 'warroom-glitch' : ''}`}>
      <style>{warRoomStyles}</style>

      <div className="relative z-10 h-full flex flex-col gap-3 px-5 py-3 overflow-hidden">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-white font-bold text-base tracking-[0.2em] uppercase truncate">Deep Market Intelligence</h1>
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse shrink-0" />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={isRefreshing || isLoading || transcriptLoading}
              className="rounded-lg border border-[#1f1f1f] bg-black/40 px-3 py-1.5 text-xs text-[#7d8590] hover:text-blue-300 hover:border-blue-500/40 flex items-center gap-1.5 transition-colors disabled:opacity-45"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} strokeWidth={1.75} />
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </button>
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-gray-800 bg-black/40 px-2 py-1 text-gray-400 hover:text-white hover:border-gray-700 transition-colors"
                aria-label="Close"
              >
                <X className="h-4 w-4" strokeWidth={1.5} />
              </button>
            ) : null}
          </div>
        </header>

        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[190px_minmax(0,1fr)] gap-3 overflow-hidden">
          <aside className="min-h-0 overflow-y-auto scrollbar-hide rounded-xl border border-[#1f1f1f] bg-[#090909]/80 p-2.5">
            <p className="text-[10px] uppercase tracking-[0.18em] text-gray-500">War Room Tabs</p>
            <div className="mt-2 space-y-1.5">
              {[
                { key: 'live', label: 'Live Feed' },
                { key: 'transcripts', label: 'Transcripts' },
                { key: 'saved', label: `Saved Intel (${allSavedCount})` },
                { key: 'folders', label: 'Share & Connect' },
              ].map((viewTab) => {
                const isActive = activeView === viewTab.key;
                return (
                  <button
                    key={viewTab.key}
                    type="button"
                    onClick={() => setActiveView(viewTab.key)}
                    className={`w-full rounded-lg border px-3 py-2 text-left text-xs transition-colors flex items-center gap-1.5 ${
                      isActive
                        ? 'bg-blue-500/12 border-blue-500/35 text-blue-300'
                        : 'border-[#1f1f1f] text-gray-400 hover:text-white hover:border-[#2a3548]'
                    }`}
                  >
                    {viewTab.key === 'folders' ? (
                      <>
                        <Folder className="h-3.5 w-3.5" strokeWidth={1.5} />
                        <span className="flex-1">{viewTab.label}</span>
                        <XLogo className="h-3.5 w-3.5" />
                      </>
                    ) : (
                      <span>{viewTab.label}</span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 border-t border-[#1f1f1f] pt-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-gray-500">Quick Scans</p>
              <div className="mt-2 space-y-1.5">
                {QUICK_SCANS.map((scan) => {
                  const isActiveScan = activeView === 'live' && activeScanLabel === scan.label;
                  return (
                    <button
                      key={scan.label}
                      type="button"
                      onClick={() => {
                        setActiveView('live');
                        setActiveScanLabel(scan.label);
                        scrollLiveFeedToTop();
                        runScan(scan.query, scan.label);
                      }}
                      disabled={isLoading || isRefreshing}
                      className={`w-full rounded-lg border px-3 py-2 text-left text-xs transition-all ${
                        isActiveScan
                          ? 'bg-blue-500/12 border-blue-500/35 text-blue-300'
                          : 'bg-black/30 border-[#1f1f1f] text-gray-400 hover:text-blue-200 hover:border-blue-500/30'
                      } disabled:opacity-40`}
                    >
                      {scan.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>

          <div className="min-h-0 overflow-hidden rounded-xl border border-[#1f1f1f] bg-[#090909]/80 p-3">
          {activeView === 'transcripts' ? (
            <div className="h-full flex flex-col gap-2">
              {/* Search bar + ticker buttons */}
              <div className="shrink-0 flex items-center gap-2 flex-wrap">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    fetchTranscript(transcriptSymbol);
                  }}
                  className="flex items-center gap-1.5"
                >
                  <input
                    type="text"
                    value={transcriptSymbol}
                    onChange={(e) => setTranscriptSymbol(e.target.value.toUpperCase())}
                    placeholder="Ticker..."
                    className="w-28 rounded-lg border border-gray-700 bg-black/40 px-3 py-1.5 text-sm text-white placeholder-gray-500 outline-none focus:border-blue-500/50"
                  />
                  <button
                    type="submit"
                    disabled={transcriptLoading || !transcriptSymbol.trim()}
                    className="bg-blue-500/10 border border-blue-500/40 text-blue-400 hover:bg-blue-500/20 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all disabled:opacity-45"
                  >
                    {transcriptLoading ? 'Loading...' : 'Search'}
                  </button>
                </form>
                <div className="h-4 w-px bg-gray-800" />
                {['AAPL', 'NVDA', 'TSLA', 'AMZN', 'GOOGL', 'META', 'MSFT', 'JPM', 'NFLX'].map((sym) => (
                  <TickerHoverCard key={sym} symbol={sym}>
                    <button
                      type="button"
                      onClick={() => { setTranscriptSymbol(sym); fetchTranscript(sym); }}
                      disabled={transcriptLoading}
                      className="rounded border border-gray-800 px-2 py-1 text-xs text-gray-400 hover:text-blue-300 hover:border-blue-500/30 transition-colors disabled:opacity-45"
                    >
                      ${sym}
                    </button>
                  </TickerHoverCard>
                ))}
              </div>

              {transcriptError && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{transcriptError}</div>
              )}

              {transcriptLoading && !transcriptData && (
                <div className="bg-black/40 backdrop-blur-sm border border-blue-500/20 rounded-lg px-3 py-2 flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 text-blue-400 animate-spin" strokeWidth={1.5} />
                  <span className="text-blue-300 text-xs animate-pulse">Fetching earnings transcript...</span>
                </div>
              )}

              {!transcriptData && !transcriptLoading && !transcriptError && (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <Search className="h-5 w-5 text-blue-400/60 mx-auto mb-2" strokeWidth={1.5} />
                    <p className="text-xs text-gray-500">Select a ticker above to view earnings call & SEC filings</p>
                  </div>
                </div>
              )}

              {/* Top row: Financials left, SEC filings right */}
              {(transcriptData || secFilings || financials || financialsLoading) && (
                <div className="flex-1 min-h-0 flex flex-col gap-3 overflow-y-auto scrollbar-hide">
                  <div className="grid grid-cols-2 gap-3">
                    {/* Left: Financial Statements (loads fast) */}
                    <div className="min-h-0 overflow-hidden rounded-xl border border-gray-800/50 bg-black/40 backdrop-blur-sm flex flex-col">
                      <div className="flex-1 overflow-y-auto scrollbar-hide p-5 space-y-5">
                        {financialsLoading && (
                          <div className="flex items-center gap-3 py-3">
                            <Loader2 className="h-4 w-4 text-blue-400 animate-spin" strokeWidth={1.5} />
                            <span className="text-blue-300 text-base">Loading financials...</span>
                          </div>
                        )}

                        {financials && (
                          <>
                            {/* Balance Sheet */}
                            {financials.balanceSheet.length > 0 && (
                              <div className="space-y-2.5">
                                <div className="flex items-center justify-between">
                                  <h3 className="text-base font-semibold text-white uppercase tracking-wider">Balance Sheet</h3>
                                  <span className="text-xs text-blue-400/60 uppercase tracking-wider">Quarterly</span>
                                </div>
                                <div className="overflow-x-auto">
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="border-b border-gray-800/50">
                                        <th className="text-left text-gray-500 font-medium py-2 pr-3">Period</th>
                                        {financials.balanceSheet.slice(0, 4).map((q, i) => (
                                          <th key={i} className="text-right text-gray-500 font-medium py-2 px-2.5 whitespace-nowrap">{q.fiscal_date?.slice(0, 7) || `Q${i + 1}`}</th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody className="text-gray-300">
                                      {[
                                        ['Total Assets', 'total_assets'],
                                        ['Cash & Equiv', 'cash_and_equivalents'],
                                        ['Current Assets', 'current_assets'],
                                        ['Total Liabilities', 'total_liabilities'],
                                        ['Long-Term Debt', 'long_term_debt'],
                                        ['Total Equity', 'total_equity'],
                                        ['Retained Earnings', 'retained_earnings'],
                                      ].map(([label, key]) => (
                                        <tr key={key} className="border-b border-gray-800/30 hover:bg-white/[0.02]">
                                          <td className="py-2 pr-3 text-gray-400 whitespace-nowrap">{label}</td>
                                          {financials.balanceSheet.slice(0, 4).map((q, i) => (
                                            <td key={i} className={`text-right py-2 px-2.5 font-mono whitespace-nowrap ${Number(q[key]) < 0 ? 'text-red-400' : ''}`}>
                                              {fmtB(q[key])}
                                            </td>
                                          ))}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}

                            {/* Income Statement */}
                            {financials.incomeStatement.length > 0 && (
                              <div className="space-y-2.5">
                                <div className="flex items-center justify-between">
                                  <h3 className="text-base font-semibold text-white uppercase tracking-wider">Income Statement</h3>
                                  <span className="text-xs text-blue-400/60 uppercase tracking-wider">Quarterly</span>
                                </div>
                                <div className="overflow-x-auto">
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="border-b border-gray-800/50">
                                        <th className="text-left text-gray-500 font-medium py-2 pr-3">Period</th>
                                        {financials.incomeStatement.slice(0, 4).map((q, i) => (
                                          <th key={i} className="text-right text-gray-500 font-medium py-2 px-2.5 whitespace-nowrap">{q.fiscal_date?.slice(0, 7) || `Q${i + 1}`}</th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody className="text-gray-300">
                                      {[
                                        ['Revenue', 'total_revenue'],
                                        ['Gross Profit', 'gross_profit'],
                                        ['Operating Income', 'operating_income'],
                                        ['Net Income', 'net_income'],
                                        ['EPS (Diluted)', 'eps_diluted'],
                                        ['Gross Margin', 'gross_margin', true],
                                        ['Net Margin', 'net_margin', true],
                                      ].map(([label, key, isPct]) => (
                                        <tr key={key} className="border-b border-gray-800/30 hover:bg-white/[0.02]">
                                          <td className="py-2 pr-3 text-gray-400 whitespace-nowrap">{label}</td>
                                          {financials.incomeStatement.slice(0, 4).map((q, i) => (
                                            <td key={i} className={`text-right py-2 px-2.5 font-mono whitespace-nowrap ${Number(q[key]) < 0 ? 'text-red-400' : ''}`}>
                                              {isPct ? fmtPct(q[key]) : key === 'eps_diluted' ? (q[key] != null ? `$${Number(q[key]).toFixed(2)}` : '—') : fmtB(q[key])}
                                            </td>
                                          ))}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}

                            {/* Cash Flow */}
                            {financials.cashFlow.length > 0 && (
                              <div className="space-y-2.5">
                                <div className="flex items-center justify-between">
                                  <h3 className="text-base font-semibold text-white uppercase tracking-wider">Cash Flow</h3>
                                  <span className="text-xs text-blue-400/60 uppercase tracking-wider">Quarterly</span>
                                </div>
                                <div className="overflow-x-auto">
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="border-b border-gray-800/50">
                                        <th className="text-left text-gray-500 font-medium py-2 pr-3">Period</th>
                                        {financials.cashFlow.slice(0, 4).map((q, i) => (
                                          <th key={i} className="text-right text-gray-500 font-medium py-2 px-2.5 whitespace-nowrap">{q.fiscal_date?.slice(0, 7) || `Q${i + 1}`}</th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody className="text-gray-300">
                                      {[
                                        ['Operating CF', 'operating_cash_flow'],
                                        ['Capital Expenditure', 'capital_expenditure'],
                                        ['Free Cash Flow', 'free_cash_flow'],
                                        ['Dividends Paid', 'dividends_paid'],
                                        ['Share Repurchase', 'share_repurchase'],
                                        ['Net Change in Cash', 'net_change_in_cash'],
                                      ].map(([label, key]) => (
                                        <tr key={key} className="border-b border-gray-800/30 hover:bg-white/[0.02]">
                                          <td className="py-2 pr-3 text-gray-400 whitespace-nowrap">{label}</td>
                                          {financials.cashFlow.slice(0, 4).map((q, i) => (
                                            <td key={i} className={`text-right py-2 px-2.5 font-mono whitespace-nowrap ${Number(q[key]) < 0 ? 'text-red-400' : ''}`}>
                                              {fmtB(q[key])}
                                            </td>
                                          ))}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}

                            {financials.balanceSheet.length === 0 && financials.incomeStatement.length === 0 && financials.cashFlow.length === 0 && (
                              <p className="text-base text-gray-500 py-2">No financial statements available for this ticker.</p>
                            )}
                          </>
                        )}

                        {!financials && !financialsLoading && (
                          <div className="flex items-center justify-center h-full py-8">
                            <p className="text-sm text-gray-500">Select a ticker to view financials</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: SEC Filings (10-Q, 10-K, 8-K) */}
                    <div className="min-h-0 overflow-hidden rounded-xl border border-gray-800/50 bg-black/40 backdrop-blur-sm flex flex-col">
                      <div className="flex-1 overflow-y-auto scrollbar-hide p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold text-white">
                            SEC Filings{secFilings?.companyName ? ` — ${secFilings.companyName}` : ''}
                          </h3>
                          <span className="text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30">EDGAR</span>
                        </div>

                        {secLoading && (
                          <div className="flex items-center gap-3 py-3">
                            <Loader2 className="h-4 w-4 text-blue-400 animate-spin" strokeWidth={1.5} />
                            <span className="text-blue-300 text-sm">Loading SEC filings...</span>
                          </div>
                        )}

                        {secFilings && secFilings.filings.length > 0 && (
                          <div className="space-y-2">
                            {secFilings.filings.map((filing, i) => (
                              <a
                                key={i}
                                href={filing.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full flex items-center justify-between gap-3 rounded-lg border border-gray-800/60 bg-black/30 px-4 py-2.5 hover:border-blue-500/30 hover:bg-blue-500/5 transition-all group"
                              >
                                <div className="flex items-center gap-3">
                                  <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded ${
                                    filing.form === '10-K' ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30' :
                                    filing.form === '10-Q' ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30' :
                                    'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                                  }`}>
                                    {filing.form}
                                  </span>
                                  <div>
                                    <p className="text-sm text-white group-hover:text-blue-300 transition-colors">{filing.description || filing.form}</p>
                                    <p className="text-xs text-gray-500">Filed {filing.filingDate}{filing.reportDate ? ` · Period ${filing.reportDate}` : ''}</p>
                                  </div>
                                </div>
                                <Link2 className="h-3.5 w-3.5 text-gray-600 group-hover:text-blue-400 transition-colors shrink-0" strokeWidth={1.5} />
                              </a>
                            ))}
                          </div>
                        )}

                        {secFilings && secFilings.filings.length === 0 && !secLoading && (
                          <p className="text-sm text-gray-500 py-2">No recent 10-K, 10-Q, or 8-K filings found.</p>
                        )}

                        {!secFilings && !secLoading && (
                          <div className="flex items-center justify-center py-8">
                            <p className="text-sm text-gray-500">Select a ticker to view SEC filings</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Below: Earnings Transcript (full width, loads slower) */}
                  {(transcriptData || transcriptLoading) && (
                    <div className="rounded-xl border border-gray-800/50 bg-black/40 backdrop-blur-sm p-5">
                      {transcriptData ? (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-white">${transcriptData.symbol} Earnings Call</h3>
                            <span className="text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30">
                              {transcriptData.fromCache ? 'Cached' : 'Transcript'}
                            </span>
                          </div>
                          <div className="text-[15px] text-gray-300 leading-relaxed whitespace-pre-wrap"
                            dangerouslySetInnerHTML={{ __html: transcriptData.content
                              .replace(/^## (.+)$/gm, '<h2 class="text-blue-300 text-xl font-bold mt-5 mb-2">$1</h2>')
                              .replace(/^### (.+)$/gm, '<h3 class="text-white text-lg font-semibold mt-4 mb-1">$1</h3>')
                              .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
                              .replace(/^- (.+)$/gm, '<div class="flex gap-2 ml-2 my-1.5"><span class="text-blue-500/60 mt-0.5">•</span><span>$1</span></div>')
                              .replace(/(\$[A-Z]{1,5})/g, '<span class="text-blue-400 font-semibold">$1</span>')
                            }}
                          />
                          {transcriptData.sources?.length > 0 && (
                            <div className="pt-3 border-t border-gray-800/50">
                              <span className="text-[10px] uppercase tracking-wider text-gray-500 block mb-1.5">Sources</span>
                              <div className="flex flex-wrap gap-2">
                                {transcriptData.sources.map((src, i) => (
                                  <a
                                    key={i}
                                    href={src.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-sm text-blue-400/80 hover:text-blue-300 transition-colors"
                                  >
                                    <Link2 className="h-3 w-3" strokeWidth={1.5} />
                                    {(src.title || src.url).slice(0, 60)}
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 py-4">
                          <Loader2 className="h-5 w-5 text-blue-400 animate-spin" strokeWidth={1.5} />
                          <span className="text-blue-300 text-sm animate-pulse">Fetching earnings transcript...</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : activeView === 'saved' ? (
            <div className="h-full min-h-0 flex flex-col gap-2">
              <p className="text-xs text-gray-500">Highlight text on any intel card, then click "Save Selection" to clip it.</p>
              <button
                type="button"
                onClick={handleSaveSelection}
                className="self-start rounded-lg border border-blue-500/40 bg-blue-500/10 px-3 py-1.5 text-xs font-semibold text-blue-400 hover:bg-blue-500/20 transition-colors"
              >
                Save Selection
              </button>

              {showClipSave && (
                <div className="rounded-lg border border-blue-500/30 bg-black/60 p-3 space-y-2">
                  <p className="text-[10px] uppercase tracking-wider text-gray-500">Preview (max 10 lines)</p>
                  <pre className="text-sm text-white/80 whitespace-pre-wrap max-h-40 overflow-y-auto">{clipText}</pre>
                  <div className="flex items-center gap-2">
                    <select
                      value={clipFolderId || ''}
                      onChange={(e) => setClipFolderId(e.target.value)}
                      className="rounded border border-gray-700 bg-black/40 px-2 py-1.5 text-xs text-white outline-none"
                    >
                      {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                    <button
                      type="button"
                      onClick={confirmClipSave}
                      className="rounded-lg border border-blue-500/40 bg-blue-500/10 px-3 py-1.5 text-xs font-semibold text-blue-400 hover:bg-blue-500/20"
                    >
                      Save to Folder
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowClipSave(false); setClipText(''); }}
                      className="text-xs text-gray-500 hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide space-y-2 mt-1">
                {allSavedCount === 0 ? (
                  <p className="text-sm text-gray-600 py-4">No saved intel yet. Highlight text on any card and click Save Selection.</p>
                ) : (
                  folders.flatMap(folder =>
                    folder.items.map(card => {
                      const isEditing = editingItem?.id === card.id && editingItem?.folderId === folder.id;
                      return (
                      <div key={card.id} className="rounded-lg border border-gray-800/50 border-l-2 border-l-blue-500/30 bg-black/30 px-3 py-2.5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-blue-400/60 mb-1">
                              {folder.name} · {formatTimestamp(card.savedAt || card.createdAt)}
                              {card.editedAt && <span className="text-gray-600 ml-1">(edited)</span>}
                            </p>
                            {isEditing ? (
                              <textarea
                                value={editingItem.content}
                                onChange={(e) => setEditingItem(prev => ({ ...prev, content: e.target.value }))}
                                className="w-full rounded border border-blue-500/30 bg-black/50 px-2 py-1.5 text-sm text-white/90 outline-none focus:border-blue-500/50 resize-y min-h-[80px]"
                                rows={Math.min(12, (editingItem.content?.split('\n').length || 3) + 1)}
                                autoFocus
                              />
                            ) : (
                              <p className="text-sm text-white/80 whitespace-pre-wrap line-clamp-6">{card.content || card.title}</p>
                            )}
                          </div>
                          <div className="flex flex-col gap-2 shrink-0">
                            {isEditing ? (
                              <>
                                <button type="button" onClick={saveEdit} className="p-1 rounded text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 transition-colors" title="Save">
                                  <Check className="h-5 w-5" strokeWidth={2} />
                                </button>
                                <button type="button" onClick={cancelEdit} className="p-1 rounded text-gray-400 hover:text-white hover:bg-white/5 transition-colors" title="Cancel">
                                  <X className="h-5 w-5" strokeWidth={1.5} />
                                </button>
                              </>
                            ) : (
                              <>
                                <button type="button" onClick={() => startEditing(card, folder.id)} className="p-1 rounded text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors" title="Edit">
                                  <Pencil className="h-5 w-5" strokeWidth={1.5} />
                                </button>
                                <button type="button" onClick={() => postToX(card.content || card.title)} className="p-1 rounded text-gray-400 hover:text-white hover:bg-white/5 transition-colors" title="Post to X">
                                  <XLogo className="h-5 w-5" />
                                </button>
                                <button type="button" onClick={() => handleRemoveSavedIntel(folder.id, card.id)} className="p-1 rounded text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Delete">
                                  <Trash2 className="h-5 w-5" strokeWidth={1.5} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      );
                    })
                  )
                )}
              </div>
            </div>
          ) : activeView === 'folders' ? (
            <div className="h-full min-h-0 flex flex-col gap-3">
              {/* Create folder row */}
              <div className="shrink-0 flex items-center gap-2">
                <input
                  value={newFolderInput}
                  onChange={(e) => setNewFolderInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newFolderInput.trim()) {
                      const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                      const name = newFolderInput.trim().includes('/') || newFolderInput.trim().match(/^\d/)
                        ? newFolderInput.trim()
                        : `${today} — ${newFolderInput.trim()}`;
                      const folder = handleCreateFolderOnly(name);
                      if (folder?.name) { showToast(`Folder: ${folder.name}`); setNewFolderInput(''); }
                    }
                  }}
                  placeholder="New folder name..."
                  className="w-56 rounded-lg border border-gray-700 bg-black/40 px-3 py-1.5 text-xs text-white placeholder:text-gray-600 outline-none focus:border-blue-500/40"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!newFolderInput.trim()) return;
                    const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    const name = newFolderInput.trim().includes('/') || newFolderInput.trim().match(/^\d/)
                      ? newFolderInput.trim()
                      : `${today} — ${newFolderInput.trim()}`;
                    const folder = handleCreateFolderOnly(name);
                    if (folder?.name) { showToast(`Folder: ${folder.name}`); setNewFolderInput(''); }
                  }}
                  className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs text-blue-400 hover:bg-blue-500/15 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5 inline -mt-0.5 mr-1" strokeWidth={2} />
                  Create
                </button>
              </div>

              {/* Multi-column folder grid */}
              <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
                <div className="grid grid-cols-3 gap-3">
                  {[...folders].sort((a, b) => {
                    if (a.name === 'AI Rewrites') return -1;
                    if (b.name === 'AI Rewrites') return 1;
                    return 0;
                  }).map((folder) => {
                    const isAIFolder = folder.name === 'AI Rewrites';
                    return (
                    <div key={folder.id} className={`rounded-xl border p-3 flex flex-col min-h-0 ${isAIFolder ? 'border-blue-500/50 bg-blue-500/[0.06]' : 'border-gray-800/60 bg-black/30'}`}>
                      {/* Folder header */}
                      <div className="flex items-center justify-between mb-2 shrink-0">
                        <h3 className={`text-sm font-semibold truncate ${isAIFolder ? 'text-blue-300' : 'text-white'}`}>{folder.name}</h3>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] ${isAIFolder ? 'text-blue-400/60' : 'text-gray-500'}`}>{folder.items.length}</span>
                          <button
                            type="button"
                            onClick={() => startCompose(folder.id)}
                            className="p-0.5 text-blue-400/70 hover:text-blue-300 transition-colors"
                            title="Write a new note"
                          >
                            <Pencil className="h-4 w-4" strokeWidth={1.5} />
                          </button>
                          {!isAIFolder && (
                            <button
                              type="button"
                              onClick={() => handleDeleteFolder(folder.id)}
                              className="p-0.5 text-blue-400/70 hover:text-red-400 transition-colors"
                              title={`Delete ${folder.name}`}
                            >
                              <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Compose new note */}
                      {composingFolderId === folder.id && (
                        <div className="shrink-0 mb-2 rounded-lg border border-blue-500/30 bg-black/50 p-2.5">
                          <textarea
                            value={composeText}
                            onChange={(e) => setComposeText(e.target.value)}
                            placeholder="Write your note..."
                            className="w-full rounded border border-gray-700 bg-transparent px-2 py-1.5 text-sm text-white/90 placeholder:text-gray-600 outline-none focus:border-blue-500/40 resize-y min-h-[60px]"
                            rows={4}
                            autoFocus
                          />
                          <div className="flex items-center gap-2 mt-2">
                            <button
                              type="button"
                              onClick={saveCompose}
                              disabled={!composeText.trim()}
                              className="rounded-lg border border-blue-500/40 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-400 hover:bg-blue-500/20 transition-colors disabled:opacity-40"
                            >
                              Save Note
                            </button>
                            <button
                              type="button"
                              onClick={cancelCompose}
                              className="text-xs text-gray-500 hover:text-white transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Folder items */}
                      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide space-y-2">
                        {folder.items.length === 0 && composingFolderId !== folder.id ? (
                          <div className="flex items-center justify-center gap-3 py-4">
                            <button
                              type="button"
                              onClick={() => startCompose(folder.id)}
                              className="flex items-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-sm text-blue-400 hover:bg-blue-500/20 transition-colors"
                              title="Write a note"
                            >
                              <Pencil className="h-4.5 w-4.5" strokeWidth={1.5} />
                              Write
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                startCompose(folder.id);
                              }}
                              className="flex items-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/[0.05] px-3 py-2 text-sm text-blue-400 hover:text-blue-300 hover:border-blue-400/50 transition-colors"
                              title="Write and share to X"
                            >
                              <XLogo className="h-4 w-4" />
                              Share
                            </button>
                          </div>
                        ) : (
                          folder.items.map((card) => {
                            const isEditing = editingItem?.id === card.id && editingItem?.folderId === folder.id;
                            return (
                              <div key={`folder-${card.id}`} className={`rounded-lg border border-l-2 bg-black/30 px-3 py-2.5 ${isAIFolder ? 'border-blue-500/30 border-l-blue-500/50' : 'border-gray-800/50 border-l-blue-500/30'}`}>
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[11px] text-gray-500 mb-1">
                                      {formatTimestamp(card.savedAt || card.createdAt)}
                                      {card.editedAt && <span className="text-gray-600 ml-1">(edited)</span>}
                                    </p>
                                    {isEditing ? (
                                      <textarea
                                        value={editingItem.content}
                                        onChange={(e) => setEditingItem(prev => ({ ...prev, content: e.target.value }))}
                                        className="w-full rounded border border-blue-500/30 bg-black/50 px-2 py-1.5 text-sm text-white/90 outline-none focus:border-blue-500/50 resize-y min-h-[80px]"
                                        rows={Math.min(8, (editingItem.content?.split('\n').length || 3) + 1)}
                                        autoFocus
                                      />
                                    ) : (
                                      <p className="text-sm text-white/80 whitespace-pre-wrap line-clamp-5">{card.content || card.title}</p>
                                    )}
                                  </div>
                                  <div className="flex flex-col gap-2 shrink-0">
                                    {isEditing ? (
                                      <>
                                        <button type="button" onClick={saveEdit} className="p-1 rounded text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 transition-colors" title="Save changes">
                                          <Check className="h-5 w-5" strokeWidth={2} />
                                        </button>
                                        <button type="button" onClick={cancelEdit} className="p-1 rounded text-gray-400 hover:text-white hover:bg-white/5 transition-colors" title="Cancel">
                                          <X className="h-5 w-5" strokeWidth={1.5} />
                                        </button>
                                      </>
                                    ) : (
                                      <>
                                        <button type="button" onClick={() => startEditing(card, folder.id)} className="p-1 rounded text-blue-400/70 hover:text-blue-300 hover:bg-blue-500/10 transition-colors" title="Edit">
                                          <Pencil className="h-5 w-5" strokeWidth={1.5} />
                                        </button>
                                        <button type="button" onClick={() => openRewriter(card, folder.id)} className="p-1 rounded text-blue-400/70 hover:text-blue-300 hover:bg-blue-500/10 transition-colors" title="Rewrite with AI">
                                          <MessageCircle className="h-5 w-5" strokeWidth={1.5} />
                                        </button>
                                        <button type="button" onClick={() => postToX(card.content || card.title)} className="p-1 rounded text-blue-400/70 hover:text-blue-300 hover:bg-blue-500/10 transition-colors" title="Post to X">
                                          <XLogo className="h-5 w-5" />
                                        </button>
                                        <button type="button" onClick={() => handleRemoveSavedIntel(folder.id, card.id)} className="p-1 rounded text-blue-400/70 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Delete">
                                          <Trash2 className="h-5 w-5" strokeWidth={1.5} />
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div ref={liveFeedScrollRef} className="h-full overflow-y-auto scrollbar-hide space-y-4 pr-1">
              {error ? (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>
              ) : null}

              {(isLoading || prefetching) ? (
                <div className="bg-black/40 backdrop-blur-sm border border-blue-500/20 rounded-xl p-5 flex items-center gap-3">
                  <Loader2 className="h-4 w-4 text-blue-400 animate-spin" strokeWidth={1.5} />
                  <span className="text-blue-300 text-sm animate-pulse">{prefetching && !isLoading ? 'Loading latest intel...' : 'Scanning...'}</span>
                  <span className="inline-flex items-center gap-1 text-blue-500/80 text-xs">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-400/80 animate-pulse [animation-delay:180ms]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-400/60 animate-pulse [animation-delay:360ms]" />
                  </span>
                </div>
              ) : null}

              {intelFeed.length === 0 && !isLoading && !prefetching ? (
                <div className="bg-black/40 backdrop-blur-sm border border-gray-800/50 rounded-xl p-7 text-center">
                  <Sparkles className="h-7 w-7 text-blue-400/80 mx-auto mb-3" strokeWidth={1.5} />
                  <h3 className="text-white font-semibold">No intel scans yet</h3>
                  <p className="text-sm text-gray-500 mt-1">Run a quick scan or enter a custom market query.</p>
                </div>
              ) : null}

              {intelFeed.map((card) => {
                const sources = toSourceLinks(card.sources);
                const isSaved = savedIds.has(String(card.id));
                const menuOpen = saveMenu.cardId === card.id;
                const quickSaveFolderId =
                  selectedFolder?.id ||
                  folders.find((folder) => folder.name.toLowerCase() === 'custom')?.id ||
                  folders[0]?.id ||
                  'Custom';

                return (
                  <article
                    key={card.id}
                    className="relative bg-black/40 backdrop-blur-sm border border-gray-800/50 rounded-xl p-5 hover:border-[#58a6ff]/30 hover:shadow-[0_0_20px_rgba(88,166,255,0.1)] transition-all"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-white font-semibold text-lg">{card.title}</h3>
                        <p className="text-gray-600 text-sm mt-1">{formatTimestamp(card.createdAt)}</p>
                      </div>

                      <span className="text-blue-400 text-sm bg-blue-500/10 border border-blue-500/20 rounded-full px-2.5 py-0.5">
                        {String(card.sourceLabel || '').toLowerCase().includes('cache') ? 'Claude Intel' : (card.sourceLabel || 'Claude Intel')}
                      </span>
                    </div>

                    <div className="absolute top-4 right-4">
                      <button
                        type="button"
                        data-save-trigger
                        onClick={() =>
                          setSaveMenu((prev) =>
                            prev.cardId === card.id
                              ? { cardId: null, showNewFolder: false, newFolderName: '' }
                              : { cardId: card.id, showNewFolder: false, newFolderName: '' }
                          )
                        }
                        className="text-gray-600 hover:text-blue-400 transition-colors"
                        title="Save Intel"
                        aria-label="Save Intel"
                      >
                        <Bookmark
                          className={`h-4 w-4 ${isSaved ? 'text-blue-400 fill-blue-400' : 'text-gray-600 hover:text-blue-400'}`}
                          strokeWidth={1.5}
                        />
                      </button>

                      {menuOpen ? (
                        <div
                          data-save-popover
                          className="absolute right-0 top-6 z-30 w-56 rounded-lg border border-gray-700 bg-[#0a0f14] shadow-xl p-2"
                        >
                          <div className="text-[11px] uppercase tracking-wide text-gray-500 px-2 py-1">Save to folder</div>
                          <div className="max-h-44 overflow-y-auto scrollbar-hide">
                            {folders.map((folder) => (
                              <button
                                key={`save-${card.id}-${folder.id}`}
                                type="button"
                                onClick={() => handleSaveToFolder(card, folder.id)}
                                className="w-full text-left rounded px-2 py-1.5 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
                              >
                                {folder.name}
                              </button>
                            ))}
                          </div>

                          <div className="mt-1 border-t border-gray-700/60 pt-1">
                            {!saveMenu.showNewFolder ? (
                              <button
                                type="button"
                                onClick={() => setSaveMenu((prev) => ({ ...prev, showNewFolder: true, newFolderName: '' }))}
                                className="w-full text-left rounded px-2 py-1.5 text-sm text-blue-300 hover:bg-blue-500/10 transition-colors"
                              >
                                + New Folder
                              </button>
                            ) : (
                              <div className="px-2 py-1.5 space-y-1.5">
                                <input
                                  value={saveMenu.newFolderName}
                                  onChange={(event) =>
                                    setSaveMenu((prev) => ({ ...prev, newFolderName: event.target.value }))
                                  }
                                  placeholder="Folder name"
                                  className="w-full rounded border border-gray-700 bg-black/40 px-2 py-1.5 text-sm text-white placeholder:text-gray-600 outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const created = handleCreateFolderOnly(saveMenu.newFolderName);
                                    if (created?.id) {
                                      handleSaveToFolder(card, created.id);
                                    }
                                  }}
                                  className="w-full rounded border border-blue-500/40 bg-blue-500/10 px-2 py-1.5 text-sm text-blue-300 hover:bg-blue-500/15"
                                >
                                  Create Folder
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-3 space-y-1">{renderIntelBodyWithSave(card.content, `feed-${card.id}`)}</div>

                    {sources.length > 0 ? (
                      <div className="mt-4 pt-3 border-t border-gray-800/70">
                        <div className="flex items-center gap-1.5 text-blue-400/60 text-xs mb-2">
                          <Link2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                          <span>Sources</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {sources.map((source, index) => (
                            <a
                              key={`${card.id}-source-${index}`}
                              href={source.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-400/60 text-sm hover:text-blue-300 underline decoration-blue-400/30"
                            >
                              {source.title || `Source ${index + 1}`}
                            </a>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="mt-4 pt-3 border-t border-gray-800/70 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleSaveToFolder(card, quickSaveFolderId)}
                        className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
                          isSaved
                            ? 'border-blue-500/35 bg-blue-500/15 text-blue-300'
                            : 'border-blue-500/35 bg-blue-500/10 text-blue-300 hover:bg-blue-500/15'
                        }`}
                      >
                        <Bookmark className={`h-4 w-4 ${isSaved ? 'fill-blue-400' : ''}`} strokeWidth={1.5} />
                        {isSaved ? 'Saved Intel' : 'Save Intel'}
                      </button>
                      <button
                        type="button"
                        data-save-trigger
                        onClick={() =>
                          setSaveMenu((prev) =>
                            prev.cardId === card.id
                              ? { cardId: null, showNewFolder: false, newFolderName: '' }
                              : { cardId: card.id, showNewFolder: false, newFolderName: '' }
                          )
                        }
                        className="rounded-lg border border-gray-700 px-3 py-2 text-xs text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
                      >
                        Choose Folder
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
      </div>

      {folderContextMenu ? (
        <div
          data-folder-context-menu
          className="fixed z-40 w-40 rounded-lg border border-gray-700 bg-[#0a0f14] shadow-xl p-1"
          style={{ left: folderContextMenu.x, top: folderContextMenu.y }}
        >
          <button
            type="button"
            onClick={() => handleRenameFolder(folderContextMenu.folderId)}
            className="w-full text-left rounded px-2 py-1.5 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
          >
            Rename
          </button>
          <button
            type="button"
            onClick={() => handleDeleteFolder(folderContextMenu.folderId)}
            className="w-full text-left rounded px-2 py-1.5 text-sm text-gray-300 hover:bg-red-500/15 hover:text-red-300 transition-colors"
          >
            Delete
          </button>
        </div>
      ) : null}

      {/* Script Rewriter Modal */}
      {rewriter && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-[90%] max-w-5xl h-[80%] rounded-2xl border border-gray-700/60 bg-[#0a1020] shadow-2xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-gray-800/60">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-blue-400" strokeWidth={1.5} />
                <h2 className="text-white font-semibold text-base">AI Script Rewriter</h2>
              </div>
              <button type="button" onClick={closeRewriter} className="p-1 text-gray-400 hover:text-white transition-colors">
                <X className="h-5 w-5" strokeWidth={1.5} />
              </button>
            </div>

            {/* Split content */}
            <div className="flex-1 min-h-0 grid grid-cols-2 divide-x divide-gray-800/60">
              {/* Left: Original script */}
              <div className="flex flex-col overflow-hidden">
                <div className="shrink-0 px-4 py-2 border-b border-gray-800/40">
                  <span className="text-xs uppercase tracking-wider text-gray-500 font-medium">Your Script</span>
                </div>
                <div className="flex-1 overflow-y-auto scrollbar-hide p-4">
                  <p className="text-sm text-white/85 whitespace-pre-wrap leading-relaxed">{rewriter.original}</p>
                </div>
              </div>

              {/* Right: Claude rewriter */}
              <div className="flex flex-col overflow-hidden">
                <div className="shrink-0 px-4 py-2 border-b border-gray-800/40">
                  <span className="text-xs uppercase tracking-wider text-gray-500 font-medium">AI Rewrite</span>
                </div>

                {/* Style quick-links */}
                <div className="shrink-0 px-4 py-3 border-b border-gray-800/30">
                  <p className="text-xs text-gray-500 mb-2">Choose a style:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      ['funny', 'Funny'],
                      ['professional', 'Professional'],
                      ['financial', 'Financial'],
                      ['boss', 'My Boss'],
                      ['gen_z', 'Gen Z'],
                      ['motivational', 'Motivational'],
                    ].map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setRewriterStyle(key)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                          rewriterStyle === key
                            ? 'bg-blue-500/20 border border-blue-500/50 text-blue-300'
                            : 'border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Generate button */}
                <div className="shrink-0 px-4 py-2.5 border-b border-gray-800/30">
                  <button
                    type="button"
                    onClick={generateRewrite}
                    disabled={!rewriterStyle || rewriterLoading}
                    className="w-full rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold py-2 text-sm transition-colors flex items-center justify-center gap-2"
                  >
                    {rewriterLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" strokeWidth={1.5} />
                        Generate
                      </>
                    )}
                  </button>
                </div>

                {/* Result area */}
                <div className="flex-1 overflow-y-auto scrollbar-hide p-4">
                  {rewriterResult ? (
                    <div className="space-y-4">
                      <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-1">
                        <textarea
                          value={rewriterResult}
                          onChange={(e) => setRewriterResult(e.target.value)}
                          className="w-full bg-transparent text-sm text-white/90 leading-relaxed p-3 outline-none resize-y min-h-[100px]"
                          rows={Math.min(12, (rewriterResult.split('\n').length || 3) + 2)}
                        />
                      </div>
                      {!rewriterResult.startsWith('Error:') && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={confirmRewrite}
                            className="rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2 text-sm transition-colors flex items-center gap-1.5"
                          >
                            <Check className="h-4 w-4" strokeWidth={2} />
                            Confirm & Save
                          </button>
                          <button
                            type="button"
                            onClick={postRewriteToX}
                            className="rounded-lg border border-gray-700 bg-white/[0.03] text-gray-300 hover:text-white hover:border-gray-500 font-medium px-4 py-2 text-sm transition-colors flex items-center gap-1.5"
                          >
                            <XLogo className="h-4 w-4" />
                            Post to X
                          </button>
                          <button
                            type="button"
                            onClick={() => { setRewriterResult(''); setRewriterStyle(null); }}
                            className="text-xs text-gray-500 hover:text-white transition-colors ml-auto"
                          >
                            Try another style
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-sm text-gray-600">
                        {rewriterStyle ? 'Click Generate to rewrite your script' : 'Select a style above to get started'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div
        className={`pointer-events-none absolute top-4 right-6 z-40 rounded-lg border border-blue-500/35 bg-blue-500/10 px-3 py-2 text-sm text-blue-300 transition-opacity duration-300 ${
          toast ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {toast || 'Intel saved'}
      </div>
    </div>
  );
}
