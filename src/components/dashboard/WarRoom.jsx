import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bookmark,
  Check,
  FolderInput,
  Link2,
  Loader2,
  Pencil,
  Plus,
  Search,
  Share,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
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

const PREFETCH_SCANS = QUICK_SCANS.slice(0, 3); // Market Movers, Earnings Intel, $SPY Analysis
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const FEED_TIMESTAMP_KEY = 'stratify-war-room-feed-ts';

const getFeedTimestamp = () => {
  try { return Number(localStorage.getItem(FEED_TIMESTAMP_KEY)) || 0; } catch { return 0; }
};
const setFeedTimestamp = () => {
  try { localStorage.setItem(FEED_TIMESTAMP_KEY, String(Date.now())); } catch {}
};
const isFeedFresh = () => Date.now() - getFeedTimestamp() < CACHE_TTL_MS;

const fetchCachedScan = async (label) => {
  try {
    const res = await fetch(`/api/warroom?label=${encodeURIComponent(label)}`, {
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const payload = await res.json().catch(() => null);
    if (!payload?.content) return null;
    return normalizeIntelItem({
      id: `warroom-cached-${label.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
      title: label,
      query: '',
      content: String(payload.content || ''),
      sources: payload.sources || [],
      sourceLabel: payload.fromCache ? 'Cached Intel' : 'Claude Intel',
      createdAt: new Date().toISOString(),
    });
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
    sourceLabel: payload?.fromCache ? 'Cached Intel' : 'Claude Intel',
    createdAt: new Date().toISOString(),
  });
};

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
  if (/^\$[A-Z]{1,5}$/.test(token)) return 'text-emerald-400 font-semibold';
  if (/^\+[\$]?\d/.test(token)) return 'text-emerald-400 font-semibold';
  if (/^-[$]?\d/.test(token)) return 'text-red-400 font-semibold';
  if (/\d/.test(token)) return 'text-amber-400';
  return 'text-gray-300';
};

const renderInlineText = (text, keyPrefix) => {
  const source = String(text || '');
  if (!source) return null;

  const parts = source.split(INLINE_TOKEN_REGEX).filter((part) => part !== '');
  if (!parts.length) return <span className="text-gray-300">{source}</span>;

  return parts.map((part, index) => {
    const isToken = /^\$[A-Z]{1,5}$/.test(part) || /^[-+]?[$]?\d/.test(part);
    const className = isToken ? tokenClassName(part) : 'text-gray-300';
    return (
      <span key={`${keyPrefix}-${index}`} className={className}>
        {part}
      </span>
    );
  });
};

const renderLine = (line, index, keyPrefix) => {
  const trimmed = line.trim();
  if (!trimmed) return <div key={`${keyPrefix}-space-${index}`} className="h-3" />;

  if (/^#{1,2}\s+/.test(trimmed)) {
    const heading = trimmed.replace(/^#{1,2}\s+/, '');
    return (
      <h3 key={`${keyPrefix}-heading-${index}`} className="text-white font-bold text-lg leading-relaxed mt-3 mb-1">
        {renderInlineText(heading, `${keyPrefix}-heading-text-${index}`)}
      </h3>
    );
  }

  if (/^#{3,6}\s+/.test(trimmed)) {
    const heading = trimmed.replace(/^#{3,6}\s+/, '');
    return (
      <h4 key={`${keyPrefix}-heading-${index}`} className="text-white font-semibold text-base leading-relaxed mt-2 mb-0.5">
        {renderInlineText(heading, `${keyPrefix}-heading-text-${index}`)}
      </h4>
    );
  }

  if (/^[-*•]\s+/.test(trimmed)) {
    const bulletText = trimmed.replace(/^[-*•]\s+/, '');
    return (
      <div key={`${keyPrefix}-bullet-${index}`} className="flex items-start gap-2 text-[15px] text-gray-300 leading-relaxed">
        <span className="text-gray-500 mt-0.5">•</span>
        <span>{renderInlineText(bulletText, `${keyPrefix}-bullet-text-${index}`)}</span>
      </div>
    );
  }

  if (/^\d+\.\s+/.test(trimmed)) {
    return (
      <div key={`${keyPrefix}-numbered-${index}`} className="text-[15px] text-gray-300 leading-relaxed">
        {renderInlineText(trimmed, `${keyPrefix}-numbered-text-${index}`)}
      </div>
    );
  }

  return (
    <p key={`${keyPrefix}-line-${index}`} className="text-[15px] text-gray-300 leading-relaxed">
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
  const [selectedFolderId, setSelectedFolderId] = useState(() => getSavedIntelState().folders?.[0]?.id || null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isGlitching, setIsGlitching] = useState(true);
  const [transcriptSymbol, setTranscriptSymbol] = useState('');
  const [transcriptData, setTranscriptData] = useState(null);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const [transcriptError, setTranscriptError] = useState('');
  const [secFilings, setSecFilings] = useState(null);
  const [secLoading, setSecLoading] = useState(false);
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

  const [prefetching, setPrefetching] = useState(false);

  const [sectionSaveMenu, setSectionSaveMenu] = useState(null);
  const [editingItem, setEditingItem] = useState(null); // { id, folderId, content }

  const DEFAULT_FOLDER_NAMES = ['Market Movers', 'Earnings Intel', '$SPY Analysis', 'Fed & Macro', 'Sector Rotation', 'Crypto Pulse'];

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

  const postToX = (content) => {
    const text = String(content || '').slice(0, 280);
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer,width=550,height=420');
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

  const runScan = async (inputQuery, titleOverride = '') => {
    const trimmedQuery = String(inputQuery || '').trim();
    if (!trimmedQuery || isLoading) return;

    setError('');
    setIsLoading(true);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 65000); // 65s timeout

    try {
      const response = await fetch('/api/warroom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: trimmedQuery, cacheLabel: titleOverride || '' }),
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
        sourceLabel: payload?.fromCache ? 'Cached Intel' : 'Claude Intel',
        createdAt: new Date().toISOString(),
      });

      setIntelFeed((prev) => [intelCard, ...prev].slice(0, 50));
      setFeedTimestamp();
      setQuery('');
      setActiveView('live');
    } catch (scanError) {
      const msg = scanError?.name === 'AbortError'
        ? 'Scan timed out. Try again — cached results load faster.'
        : (scanError?.message || 'Scan failed. Try again.');
      setError(msg);
    } finally {
      clearTimeout(timeout);
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
          <div className="space-y-1">
            {section.lines.map((line, li) => renderLine(line, li, `${sectionKey}-l`))}
          </div>
          {/* Purple divider + save button */}
          <div className="relative flex items-center gap-2 my-3">
            <div className="flex-1 h-px bg-purple-500/30" />
            <div className="relative" data-section-save>
              <button
                type="button"
                onClick={() => setSectionSaveMenu(menuOpen ? null : sectionKey)}
                className="text-[10px] uppercase tracking-wider text-purple-400 hover:text-purple-300 bg-purple-500/10 border border-purple-500/25 rounded px-2 py-0.5 transition-colors"
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
                      className="w-full text-left rounded px-2 py-1.5 text-xs text-gray-300 hover:bg-purple-500/10 hover:text-white transition-colors"
                    >
                      {f.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex-1 h-px bg-purple-500/30" />
          </div>
        </div>
      );
    });
  };

  const fetchTranscript = async (symbol) => {
    const trimmed = String(symbol || '').trim().toUpperCase().replace(/^\$/, '');
    if (!trimmed || transcriptLoading) return;
    setTranscriptError('');
    setTranscriptData(null);
    setSecFilings(null);
    setTranscriptLoading(true);
    setSecLoading(true);

    // Fetch transcript and SEC filings in parallel
    const transcriptPromise = fetch(`/api/earnings-transcript?symbol=${encodeURIComponent(trimmed)}`)
      .then(async (res) => {
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload?.error || `Request failed (${res.status})`);
        setTranscriptData({ symbol: trimmed, content: payload.content, sources: payload.sources || [], fromCache: payload.fromCache });
      })
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

    await Promise.allSettled([transcriptPromise, secPromise]);
  };

  const allSavedCount = useMemo(
    () => folders.reduce((count, folder) => count + folder.items.length, 0),
    [folders]
  );

  return (
    <div className={`h-full w-full bg-transparent relative overflow-hidden ${isGlitching ? 'warroom-glitch' : ''}`}>
      <style>{warRoomStyles}</style>

      <div className="relative z-10 h-full flex flex-col gap-2 px-5 py-3 overflow-hidden">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-white font-bold text-base tracking-[0.2em] uppercase">Deep Market Intelligence</h1>
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          </div>

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
        </header>

        <div className="flex flex-wrap gap-1.5">
          {QUICK_SCANS.map((scan) => (
            <button
              key={scan.label}
              type="button"
              onClick={() => runScan(scan.query, scan.label)}
              disabled={isLoading}
              className="bg-black/40 backdrop-blur border border-gray-800 hover:border-amber-500/50 rounded-lg px-3 py-1.5 text-sm text-gray-400 hover:text-amber-400 transition-all hover:shadow-[0_0_10px_rgba(245,158,11,0.15)] disabled:opacity-40"
            >
              {scan.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          {['live', 'saved', 'folders', 'transcripts'].map((view) => {
            const labels = { live: 'Live Feed', saved: 'Saved Intel', folders: `Folders (${folders.length})`, transcripts: 'Transcripts' };
            return (
              <button
                key={view}
                type="button"
                onClick={() => setActiveView(view)}
                className={`rounded-lg px-2.5 py-1 text-xs transition-colors ${
                  activeView === view
                    ? 'bg-amber-500/15 border border-amber-500/35 text-amber-300'
                    : 'border border-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                {labels[view]}
              </button>
            );
          })}
        </div>

        <div className="flex-1 min-h-0 overflow-hidden">
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
                    className="w-28 rounded-lg border border-gray-700 bg-black/40 px-3 py-1.5 text-sm text-white placeholder-gray-500 outline-none focus:border-amber-500/50"
                  />
                  <button
                    type="submit"
                    disabled={transcriptLoading || !transcriptSymbol.trim()}
                    className="bg-amber-500/10 border border-amber-500/40 text-amber-400 hover:bg-amber-500/20 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all disabled:opacity-45"
                  >
                    {transcriptLoading ? 'Loading...' : 'Search'}
                  </button>
                </form>
                <div className="h-4 w-px bg-gray-800" />
                {['AAPL', 'NVDA', 'TSLA', 'AMZN', 'GOOGL', 'META', 'MSFT', 'JPM', 'NFLX'].map((sym) => (
                  <button
                    key={sym}
                    type="button"
                    onClick={() => { setTranscriptSymbol(sym); fetchTranscript(sym); }}
                    disabled={transcriptLoading}
                    className="rounded border border-gray-800 px-2 py-1 text-xs text-gray-400 hover:text-amber-300 hover:border-amber-500/30 transition-colors disabled:opacity-45"
                  >
                    ${sym}
                  </button>
                ))}
              </div>

              {transcriptError && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{transcriptError}</div>
              )}

              {transcriptLoading && !transcriptData && (
                <div className="bg-black/40 backdrop-blur-sm border border-amber-500/20 rounded-lg px-3 py-2 flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 text-amber-400 animate-spin" strokeWidth={1.5} />
                  <span className="text-amber-300 text-xs animate-pulse">Fetching earnings transcript...</span>
                </div>
              )}

              {!transcriptData && !transcriptLoading && !transcriptError && (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <Search className="h-5 w-5 text-amber-400/60 mx-auto mb-2" strokeWidth={1.5} />
                    <p className="text-xs text-gray-500">Select a ticker above to view earnings call & SEC filings</p>
                  </div>
                </div>
              )}

              {/* Split screen: Transcript left, SEC filings / viewer right */}
              {(transcriptData || secFilings) && (
                <div className="flex-1 min-h-0 grid grid-cols-2 gap-3">
                  {/* Left: Earnings Transcript */}
                  <div className="min-h-0 overflow-y-auto scrollbar-hide rounded-xl border border-gray-800/50 bg-black/40 backdrop-blur-sm p-5">
                    {transcriptData ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold text-white">${transcriptData.symbol} Earnings Call</h3>
                          <span className="text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
                            {transcriptData.fromCache ? 'Cached' : 'Transcript'}
                          </span>
                        </div>
                        <div className="text-[15px] text-gray-300 leading-relaxed whitespace-pre-wrap"
                          dangerouslySetInnerHTML={{ __html: transcriptData.content
                            .replace(/^## (.+)$/gm, '<h2 class="text-amber-300 text-xl font-bold mt-5 mb-2">$1</h2>')
                            .replace(/^### (.+)$/gm, '<h3 class="text-white text-lg font-semibold mt-4 mb-1">$1</h3>')
                            .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
                            .replace(/^- (.+)$/gm, '<div class="flex gap-2 ml-2 my-1.5"><span class="text-amber-500/60 mt-0.5">•</span><span>$1</span></div>')
                            .replace(/(\$[A-Z]{1,5})/g, '<span class="text-amber-400 font-semibold">$1</span>')
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
                                  className="inline-flex items-center gap-1 text-sm text-amber-400/80 hover:text-amber-300 transition-colors"
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
                      <div className="flex items-center justify-center h-full">
                        <Loader2 className="h-5 w-5 text-amber-400 animate-spin" strokeWidth={1.5} />
                      </div>
                    )}
                  </div>

                  {/* Right: SEC Filings list */}
                  <div className="min-h-0 overflow-hidden rounded-xl border border-gray-800/50 bg-black/40 backdrop-blur-sm flex flex-col">
                      <div className="flex-1 overflow-y-auto scrollbar-hide p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold text-white">
                            SEC Filings{secFilings?.companyName ? ` — ${secFilings.companyName}` : ''}
                          </h3>
                          <span className="text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30">EDGAR</span>
                        </div>

                        {secLoading && (
                          <div className="flex items-center gap-3 py-4">
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
                                className="w-full flex items-center justify-between gap-3 rounded-lg border border-gray-800/60 bg-black/30 px-4 py-3 hover:border-blue-500/30 hover:bg-blue-500/5 transition-all group"
                              >
                                <div className="flex items-center gap-3">
                                  <span className={`text-sm font-bold font-mono px-2 py-0.5 rounded ${
                                    filing.form === '10-K' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' :
                                    filing.form === '10-Q' ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30' :
                                    'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                  }`}>
                                    {filing.form}
                                  </span>
                                  <div>
                                    <p className="text-[15px] text-white group-hover:text-blue-300 transition-colors">{filing.description || filing.form}</p>
                                    <p className="text-sm text-gray-500">Filed {filing.filingDate}{filing.reportDate ? ` · Period ending ${filing.reportDate}` : ''}</p>
                                  </div>
                                </div>
                                <Link2 className="h-4 w-4 text-gray-600 group-hover:text-blue-400 transition-colors shrink-0" strokeWidth={1.5} />
                              </a>
                            ))}
                          </div>
                        )}

                        {secFilings && secFilings.filings.length === 0 && !secLoading && (
                          <p className="text-sm text-gray-500 py-4">No recent 10-K, 10-Q, or 8-K filings found.</p>
                        )}

                        {!secFilings && !secLoading && (
                          <p className="text-sm text-gray-500 py-4">SEC filings will appear here when you search a ticker.</p>
                        )}
                      </div>
                  </div>
                </div>
              )}
            </div>
          ) : activeView === 'saved' ? (
            <div className="h-full min-h-0 flex flex-col gap-2">
              <p className="text-xs text-gray-500">Highlight text on any intel card, then click "Save Selection" to clip it.</p>
              <button
                type="button"
                onClick={handleSaveSelection}
                className="self-start rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-400 hover:bg-amber-500/20 transition-colors"
              >
                Save Selection
              </button>

              {showClipSave && (
                <div className="rounded-lg border border-amber-500/30 bg-black/60 p-3 space-y-2">
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
                      className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-400 hover:bg-amber-500/20"
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
                      <div key={card.id} className="rounded-lg border border-gray-800/50 border-l-2 border-l-amber-500/30 bg-black/30 px-3 py-2.5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-amber-400/60 mb-1">
                              {folder.name} · {formatTimestamp(card.savedAt || card.createdAt)}
                              {card.editedAt && <span className="text-gray-600 ml-1">(edited)</span>}
                            </p>
                            {isEditing ? (
                              <textarea
                                value={editingItem.content}
                                onChange={(e) => setEditingItem(prev => ({ ...prev, content: e.target.value }))}
                                className="w-full rounded border border-amber-500/30 bg-black/50 px-2 py-1.5 text-sm text-white/90 outline-none focus:border-amber-500/50 resize-y min-h-[80px]"
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
                                <button type="button" onClick={saveEdit} className="p-1 rounded text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors" title="Save">
                                  <Check className="h-5 w-5" strokeWidth={2} />
                                </button>
                                <button type="button" onClick={cancelEdit} className="p-1 rounded text-gray-400 hover:text-white hover:bg-white/5 transition-colors" title="Cancel">
                                  <X className="h-5 w-5" strokeWidth={1.5} />
                                </button>
                              </>
                            ) : (
                              <>
                                <button type="button" onClick={() => startEditing(card, folder.id)} className="p-1 rounded text-gray-400 hover:text-amber-400 hover:bg-amber-500/10 transition-colors" title="Edit">
                                  <Pencil className="h-5 w-5" strokeWidth={1.5} />
                                </button>
                                <button type="button" onClick={() => postToX(card.content || card.title)} className="p-1 rounded text-gray-400 hover:text-white hover:bg-white/5 transition-colors" title="Post to X">
                                  <Share className="h-5 w-5" strokeWidth={1.5} />
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
                  className="w-56 rounded-lg border border-gray-700 bg-black/40 px-3 py-1.5 text-xs text-white placeholder:text-gray-600 outline-none focus:border-amber-500/40"
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
                  className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-400 hover:bg-amber-500/15 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5 inline -mt-0.5 mr-1" strokeWidth={2} />
                  Create
                </button>
              </div>

              {/* Multi-column folder grid */}
              <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
                <div className="grid grid-cols-3 gap-3">
                  {folders.map((folder) => (
                    <div key={folder.id} className="rounded-xl border border-gray-800/60 bg-black/30 p-3 flex flex-col min-h-0">
                      {/* Folder header */}
                      <div className="flex items-center justify-between mb-2 shrink-0">
                        <h3 className="text-sm font-semibold text-white truncate">{folder.name}</h3>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-gray-500">{folder.items.length}</span>
                          <button
                            type="button"
                            onClick={() => handleDeleteFolder(folder.id)}
                            className="p-0.5 text-gray-500 hover:text-red-400 transition-colors"
                            title={`Delete ${folder.name}`}
                          >
                            <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                          </button>
                        </div>
                      </div>

                      {/* Folder items */}
                      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide space-y-2">
                        {folder.items.length === 0 ? (
                          <p className="text-xs text-gray-600 py-2">Empty</p>
                        ) : (
                          folder.items.map((card) => {
                            const isEditing = editingItem?.id === card.id && editingItem?.folderId === folder.id;
                            return (
                              <div key={`folder-${card.id}`} className="rounded-lg border border-gray-800/50 border-l-2 border-l-amber-500/30 bg-black/30 px-3 py-2.5">
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
                                        className="w-full rounded border border-amber-500/30 bg-black/50 px-2 py-1.5 text-sm text-white/90 outline-none focus:border-amber-500/50 resize-y min-h-[80px]"
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
                                        <button type="button" onClick={saveEdit} className="p-1 rounded text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors" title="Save changes">
                                          <Check className="h-5 w-5" strokeWidth={2} />
                                        </button>
                                        <button type="button" onClick={cancelEdit} className="p-1 rounded text-gray-400 hover:text-white hover:bg-white/5 transition-colors" title="Cancel">
                                          <X className="h-5 w-5" strokeWidth={1.5} />
                                        </button>
                                      </>
                                    ) : (
                                      <>
                                        <button type="button" onClick={() => startEditing(card, folder.id)} className="p-1 rounded text-gray-400 hover:text-amber-400 hover:bg-amber-500/10 transition-colors" title="Edit">
                                          <Pencil className="h-5 w-5" strokeWidth={1.5} />
                                        </button>
                                        <button type="button" onClick={() => postToX(card.content || card.title)} className="p-1 rounded text-gray-400 hover:text-white hover:bg-white/5 transition-colors" title="Post to X">
                                          <Share className="h-5 w-5" strokeWidth={1.5} />
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
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full overflow-y-auto scrollbar-hide space-y-4 pr-1">
              {error ? (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>
              ) : null}

              {(isLoading || prefetching) ? (
                <div className="bg-black/40 backdrop-blur-sm border border-amber-500/20 rounded-xl p-5 flex items-center gap-3">
                  <Loader2 className="h-4 w-4 text-amber-400 animate-spin" strokeWidth={1.5} />
                  <span className="text-amber-300 text-sm animate-pulse">{prefetching && !isLoading ? 'Loading latest intel...' : 'Scanning...'}</span>
                  <span className="inline-flex items-center gap-1 text-amber-500/80 text-xs">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400/80 animate-pulse [animation-delay:180ms]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400/60 animate-pulse [animation-delay:360ms]" />
                  </span>
                </div>
              ) : null}

              {intelFeed.length === 0 && !isLoading && !prefetching ? (
                <div className="bg-black/40 backdrop-blur-sm border border-gray-800/50 rounded-xl p-7 text-center">
                  <Sparkles className="h-7 w-7 text-amber-400/80 mx-auto mb-3" strokeWidth={1.5} />
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
                    className="relative bg-black/40 backdrop-blur-sm border border-gray-800/50 rounded-xl p-5 hover:border-purple-500/30 hover:shadow-[0_0_20px_rgba(147,51,234,0.1)] transition-all"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-white font-semibold text-lg">{card.title}</h3>
                        <p className="text-gray-600 text-sm mt-1">{formatTimestamp(card.createdAt)}</p>
                      </div>

                      <span className="text-amber-400 text-sm bg-amber-500/10 border border-amber-500/20 rounded-full px-2.5 py-0.5">
                        {card.sourceLabel || 'Claude Intel'}
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
                        className="text-gray-600 hover:text-amber-400 transition-colors"
                        title="Save Intel"
                        aria-label="Save Intel"
                      >
                        <Bookmark
                          className={`h-4 w-4 ${isSaved ? 'text-amber-400 fill-amber-400' : 'text-gray-600 hover:text-amber-400'}`}
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
                                className="w-full text-left rounded px-2 py-1.5 text-sm text-amber-300 hover:bg-amber-500/10 transition-colors"
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
                                  className="w-full rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-sm text-amber-300 hover:bg-amber-500/15"
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
                            ? 'border-amber-500/35 bg-amber-500/15 text-amber-300'
                            : 'border-amber-500/35 bg-amber-500/10 text-amber-300 hover:bg-amber-500/15'
                        }`}
                      >
                        <Bookmark className={`h-4 w-4 ${isSaved ? 'fill-amber-400' : ''}`} strokeWidth={1.5} />
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

      <div
        className={`pointer-events-none absolute top-4 right-6 z-40 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-sm text-amber-300 transition-opacity duration-300 ${
          toast ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {toast || 'Intel saved'}
      </div>
    </div>
  );
}
