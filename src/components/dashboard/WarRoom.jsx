import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bookmark,
  FolderInput,
  Link2,
  Loader2,
  Plus,
  Search,
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

  .warroom-star {
    position: absolute;
    border-radius: 9999px;
    background: rgba(255, 255, 255, 0.9);
    animation: warroomStarDrift linear infinite;
  }

  @keyframes warroomStarDrift {
    0% {
      opacity: 0.2;
      transform: translate3d(0, 0, 0);
    }
    50% {
      opacity: 0.75;
    }
    100% {
      opacity: 0.15;
      transform: translate3d(var(--drift-x, 0px), -80px, 0);
    }
  }

  .shooting-star {
    position: absolute;
    width: 180px;
    height: 1px;
    background: linear-gradient(90deg, rgba(255, 255, 255, 0), rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0));
    filter: drop-shadow(0 0 6px rgba(255, 255, 255, 0.38));
    opacity: 0;
    transform: rotate(-28deg);
  }

  .shooting-star-a {
    top: 16%;
    left: 8%;
    animation: warroomShootingA 18s linear infinite;
  }

  .shooting-star-b {
    top: 48%;
    left: 30%;
    animation: warroomShootingB 20s linear infinite 8s;
  }

  @keyframes warroomShootingA {
    0%, 82% {
      opacity: 0;
      transform: translate3d(0, 0, 0) rotate(-28deg);
    }
    84% {
      opacity: 1;
    }
    100% {
      opacity: 0;
      transform: translate3d(460px, 250px, 0) rotate(-28deg);
    }
  }

  @keyframes warroomShootingB {
    0%, 85% {
      opacity: 0;
      transform: translate3d(0, 0, 0) rotate(-28deg);
    }
    87% {
      opacity: 1;
    }
    100% {
      opacity: 0;
      transform: translate3d(420px, 235px, 0) rotate(-28deg);
    }
  }

  .warroom-scanlines {
    background: repeating-linear-gradient(
      to bottom,
      transparent 0px,
      transparent 2px,
      rgba(255, 255, 255, 0.02) 2px,
      rgba(255, 255, 255, 0.02) 3px
    );
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

const renderIntelBody = (content, keyPrefix) => {
  const lines = String(content || '').split('\n');
  return lines.map((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return <div key={`${keyPrefix}-space-${index}`} className="h-2" />;
    }

    if (/^#{1,6}\s+/.test(trimmed)) {
      const heading = trimmed.replace(/^#{1,6}\s+/, '');
      return (
        <h4 key={`${keyPrefix}-heading-${index}`} className="text-white font-semibold leading-relaxed mt-1">
          {renderInlineText(heading, `${keyPrefix}-heading-text-${index}`)}
        </h4>
      );
    }

    if (/^[-*•]\s+/.test(trimmed)) {
      const bulletText = trimmed.replace(/^[-*•]\s+/, '');
      return (
        <div key={`${keyPrefix}-bullet-${index}`} className="flex items-start gap-2 text-gray-300 leading-relaxed">
          <span className="text-gray-500">•</span>
          <span>{renderInlineText(bulletText, `${keyPrefix}-bullet-text-${index}`)}</span>
        </div>
      );
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      return (
        <div key={`${keyPrefix}-numbered-${index}`} className="text-gray-300 leading-relaxed">
          {renderInlineText(trimmed, `${keyPrefix}-numbered-text-${index}`)}
        </div>
      );
    }

    return (
      <p key={`${keyPrefix}-line-${index}`} className="text-gray-300 leading-relaxed">
        {renderInlineText(trimmed, `${keyPrefix}-line-text-${index}`)}
      </p>
    );
  });
};

const createStars = (count = 80) =>
  Array.from({ length: count }, (_, index) => ({
    id: `star-${index}`,
    left: Math.random() * 100,
    top: Math.random() * 100,
    size: Math.random() > 0.7 ? 2 : 1,
    opacity: 0.25 + Math.random() * 0.75,
    duration: 60 + Math.random() * 60,
    delay: -Math.random() * 120,
    driftX: (Math.random() - 0.5) * 40,
  }));

export default function WarRoom({ onClose }) {
  const [query, setQuery] = useState('');
  const [intelFeed, setIntelFeed] = useState(() => getWarRoomFeed());
  const [savedState, setSavedState] = useState(() => getSavedIntelState());
  const [activeView, setActiveView] = useState('live');
  const [selectedFolderId, setSelectedFolderId] = useState(() => getSavedIntelState().folders?.[0]?.id || null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isGlitching, setIsGlitching] = useState(true);
  const [toast, setToast] = useState('');

  const [saveMenu, setSaveMenu] = useState({ cardId: null, showNewFolder: false, newFolderName: '' });
  const [moveMenu, setMoveMenu] = useState({ cardId: null, folderId: null, showNewFolder: false, newFolderName: '' });
  const [folderContextMenu, setFolderContextMenu] = useState(null);

  const toastTimerRef = useRef(null);
  const longPressRef = useRef({ timer: null, opened: false });

  const stars = useMemo(() => createStars(80), []);

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

  useEffect(() => {
    const timer = setTimeout(() => setIsGlitching(false), 200);
    return () => clearTimeout(timer);
  }, []);

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
    showToast('Intel removed');
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

    try {
      const response = await fetch('/api/warroom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: trimmedQuery }),
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
      setQuery('');
      setActiveView('live');
    } catch (scanError) {
      setError(scanError?.message || 'Scan failed. Try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    runScan(query);
  };

  const allSavedCount = useMemo(
    () => folders.reduce((count, folder) => count + folder.items.length, 0),
    [folders]
  );

  return (
    <div className={`h-full w-full bg-[#030608] relative overflow-hidden ${isGlitching ? 'warroom-glitch' : ''}`}>
      <style>{warRoomStyles}</style>

      <div className="absolute inset-0 pointer-events-none">
        {stars.map((star) => (
          <span
            key={star.id}
            className="warroom-star"
            style={{
              width: `${star.size}px`,
              height: `${star.size}px`,
              left: `${star.left}%`,
              top: `${star.top}%`,
              opacity: star.opacity,
              animationDuration: `${star.duration}s`,
              animationDelay: `${star.delay}s`,
              '--drift-x': `${star.driftX}px`,
            }}
          />
        ))}
        <span className="shooting-star shooting-star-a" />
        <span className="shooting-star shooting-star-b" />
      </div>

      <div className="absolute inset-0 pointer-events-none warroom-scanlines" />

      <div className="relative z-10 h-full flex flex-col gap-4 px-5 py-4 overflow-hidden">
        <header className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-white font-bold text-xl tracking-[0.2em] uppercase">War Room</h1>
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            </div>
            <p className="text-gray-500 text-xs uppercase tracking-wide mt-1">Deep Market Intelligence</p>
          </div>

          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-800 bg-black/40 px-2 py-1 text-gray-400 hover:text-white hover:border-gray-700 transition-colors"
              aria-label="Close War Room"
            >
              <X className="h-4 w-4" strokeWidth={1.5} />
            </button>
          ) : null}
        </header>

        <div className="flex flex-wrap gap-2">
          {QUICK_SCANS.map((scan) => (
            <button
              key={scan.label}
              type="button"
              onClick={() => runScan(scan.query, scan.label)}
              disabled={isLoading}
              className="bg-black/40 backdrop-blur border border-gray-800 hover:border-amber-500/50 rounded-lg px-3 py-2 text-sm text-gray-400 hover:text-amber-400 transition-all hover:shadow-[0_0_10px_rgba(245,158,11,0.15)] disabled:opacity-40"
            >
              {scan.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-600" strokeWidth={1.5} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Initiate deep scan..."
              className="w-full bg-black/60 border border-gray-800 focus:border-amber-500/50 rounded-xl pl-10 pr-4 py-3 text-white placeholder-gray-600 outline-none transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !query.trim()}
            className="scan-button-pulse bg-amber-500/10 border border-amber-500/40 text-amber-400 hover:bg-amber-500/20 rounded-xl px-5 py-3 text-sm font-semibold tracking-wide uppercase transition-all disabled:opacity-45"
          >
            {isLoading ? 'Scanning...' : 'Scan'}
          </button>
        </form>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveView('live')}
            className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
              activeView === 'live'
                ? 'bg-amber-500/15 border border-amber-500/35 text-amber-300'
                : 'border border-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            Live Feed
          </button>
          <button
            type="button"
            onClick={() => setActiveView('saved')}
            className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
              activeView === 'saved'
                ? 'bg-amber-500/15 border border-amber-500/35 text-amber-300'
                : 'border border-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            Saved Intel ({allSavedCount})
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden">
          {activeView === 'saved' ? (
            <div className="h-full min-h-0 grid grid-cols-[220px_minmax(0,1fr)] gap-3">
              <div className="rounded-xl border border-gray-800/60 bg-black/30 p-3 min-h-0 overflow-y-auto scrollbar-hide">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-white">Saved Intel</h3>
                  <button
                    type="button"
                    onClick={() => {
                      const name = window.prompt('New folder name');
                      if (!name) return;
                      const folder = handleCreateFolderOnly(name);
                      if (folder?.name) showToast(`Folder created: ${folder.name}`);
                    }}
                    className="inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
                    New Folder
                  </button>
                </div>

                <div className="space-y-1">
                  {folders.map((folder) => {
                    const isSelected = folder.id === selectedFolder?.id;
                    return (
                      <button
                        key={folder.id}
                        type="button"
                        data-folder-context-trigger
                        onClick={() => {
                          if (longPressRef.current.opened) {
                            longPressRef.current.opened = false;
                            return;
                          }
                          setSelectedFolderId(folder.id);
                        }}
                        onContextMenu={(event) => {
                          event.preventDefault();
                          openFolderContextMenu(folder.id, event.clientX, event.clientY);
                        }}
                        onTouchStart={(event) => handleFolderTouchStart(event, folder.id)}
                        onTouchEnd={clearFolderLongPress}
                        onTouchCancel={clearFolderLongPress}
                        className={`w-full text-gray-400 text-sm py-1.5 px-2 cursor-pointer hover:text-white transition-colors text-left flex items-center justify-between ${
                          isSelected ? 'text-white' : ''
                        }`}
                      >
                        <span className="truncate">{folder.name}</span>
                        <span className="text-xs text-gray-600">{folder.items.length}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-xl border border-gray-800/60 bg-black/25 p-3 min-h-0 overflow-y-auto scrollbar-hide space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-white font-semibold text-sm">{selectedFolder?.name || 'Folder'}</h3>
                    <p className="text-xs text-gray-600">{savedItems.length} saved items</p>
                  </div>
                </div>

                {savedItems.length === 0 ? (
                  <div className="rounded-lg border border-gray-800/70 bg-black/40 px-3 py-3 text-sm text-gray-500">
                    No intel saved in this folder yet.
                  </div>
                ) : (
                  savedItems.map((card) => {
                    const sources = toSourceLinks(card.sources || []);
                    const moveMenuOpen = moveMenu.cardId === card.id && moveMenu.folderId === selectedFolder?.id;

                    return (
                      <article
                        key={`saved-${card.id}`}
                        className="relative bg-black/40 backdrop-blur-sm border border-gray-800/50 border-l-2 border-l-amber-500/30 rounded-xl p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="text-white font-semibold">{card.title}</h3>
                            <p className="text-gray-600 text-xs mt-1">
                              Saved {formatTimestamp(card.savedAt || card.createdAt)}
                            </p>
                          </div>

                          <div className="relative flex items-center gap-2">
                            <button
                              type="button"
                              data-move-trigger
                              onClick={() =>
                                setMoveMenu((prev) =>
                                  prev.cardId === card.id && prev.folderId === selectedFolder?.id
                                    ? { cardId: null, folderId: null, showNewFolder: false, newFolderName: '' }
                                    : {
                                        cardId: card.id,
                                        folderId: selectedFolder?.id || null,
                                        showNewFolder: false,
                                        newFolderName: '',
                                      }
                                )
                              }
                              className="text-gray-600 hover:text-amber-400 transition-colors"
                              title="Move to folder"
                            >
                              <FolderInput className="h-4 w-4" strokeWidth={1.5} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveSavedIntel(selectedFolder?.id, card.id)}
                              className="text-gray-600 hover:text-red-400 transition-colors"
                              title="Remove"
                            >
                              <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                            </button>

                            {moveMenuOpen ? (
                              <div
                                data-move-popover
                                className="absolute right-0 top-6 z-30 w-56 rounded-lg border border-gray-700 bg-[#0a0f14] shadow-xl p-2"
                              >
                                <div className="text-[11px] uppercase tracking-wide text-gray-500 px-2 py-1">Move to folder</div>
                                <div className="max-h-44 overflow-y-auto scrollbar-hide">
                                  {folders.map((folder) => (
                                    <button
                                      key={`move-${card.id}-${folder.id}`}
                                      type="button"
                                      onClick={() => handleMoveToFolder(card, selectedFolder?.id, folder.id)}
                                      className="w-full text-left rounded px-2 py-1.5 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
                                    >
                                      {folder.name}
                                    </button>
                                  ))}
                                </div>

                                <div className="mt-1 border-t border-gray-700/60 pt-1">
                                  {!moveMenu.showNewFolder ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setMoveMenu((prev) => ({ ...prev, showNewFolder: true, newFolderName: '' }))
                                      }
                                      className="w-full text-left rounded px-2 py-1.5 text-sm text-amber-300 hover:bg-amber-500/10 transition-colors"
                                    >
                                      + New Folder
                                    </button>
                                  ) : (
                                    <div className="px-2 py-1.5 space-y-1.5">
                                      <input
                                        value={moveMenu.newFolderName}
                                        onChange={(event) =>
                                          setMoveMenu((prev) => ({ ...prev, newFolderName: event.target.value }))
                                        }
                                        placeholder="Folder name"
                                        className="w-full rounded border border-gray-700 bg-black/40 px-2 py-1.5 text-sm text-white placeholder:text-gray-600 outline-none"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const created = handleCreateFolderOnly(moveMenu.newFolderName);
                                          if (created?.id) {
                                            handleMoveToFolder(card, selectedFolder?.id, created.id);
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
                        </div>

                        <div className="mt-3 space-y-1">{renderIntelBody(card.content, `saved-${card.id}`)}</div>

                        {sources.length > 0 ? (
                          <div className="mt-4 pt-3 border-t border-gray-800/70">
                            <div className="flex items-center gap-1.5 text-blue-400/60 text-xs mb-2">
                              <Link2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                              <span>Sources</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {sources.map((source, index) => (
                                <a
                                  key={`${card.id}-saved-source-${index}`}
                                  href={source.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-blue-400/60 text-xs hover:text-blue-300 underline decoration-blue-400/30"
                                >
                                  {source.title || `Source ${index + 1}`}
                                </a>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </article>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            <div className="h-full overflow-y-auto scrollbar-hide space-y-4 pr-1">
              {error ? (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>
              ) : null}

              {isLoading ? (
                <div className="bg-black/40 backdrop-blur-sm border border-amber-500/20 rounded-xl p-5 flex items-center gap-3">
                  <Loader2 className="h-4 w-4 text-amber-400 animate-spin" strokeWidth={1.5} />
                  <span className="text-amber-300 text-sm animate-pulse">Scanning...</span>
                  <span className="inline-flex items-center gap-1 text-amber-500/80 text-xs">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400/80 animate-pulse [animation-delay:180ms]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400/60 animate-pulse [animation-delay:360ms]" />
                  </span>
                </div>
              ) : null}

              {intelFeed.length === 0 && !isLoading ? (
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
                        <h3 className="text-white font-semibold">{card.title}</h3>
                        <p className="text-gray-600 text-xs mt-1">{formatTimestamp(card.createdAt)}</p>
                      </div>

                      <span className="text-amber-400 text-xs bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-0.5">
                        Claude Intel
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

                    <div className="mt-3 space-y-1">{renderIntelBody(card.content, `feed-${card.id}`)}</div>

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
                              className="text-blue-400/60 text-xs hover:text-blue-300 underline decoration-blue-400/30"
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
