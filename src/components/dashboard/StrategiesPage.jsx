import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRightLeft,
  ChevronRight,
  Edit3,
  Folder,
  FolderPlus,
  MoreVertical,
  Play,
  Search,
  Star,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import StrategyTemplateFlow from './StrategyTemplateFlow';

const STORAGE_KEY = 'stratify-strategies-folders';

const DEFAULT_FOLDERS = [
  { id: 'stratify', name: 'STRATIFY', isExpanded: true, strategies: [] },
  { id: 'active-strategies', name: 'Active Strategies', isExpanded: true, strategies: [] },
  { id: 'favorites', name: 'Favorites', isExpanded: true, strategies: [] },
  { id: 'sophia-strategies', name: 'Sophia Strategies', isExpanded: true, strategies: [] },
  { id: 'archive', name: 'Archive', isExpanded: false, strategies: [] },
];

const SYSTEM_FOLDER_IDS = new Set(DEFAULT_FOLDERS.map((folder) => folder.id));

const STATUS_CLASSNAMES = {
  active: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/35',
  live: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/35',
  running: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/35',
  deployed: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/35',
  paused: 'bg-amber-500/15 text-amber-300 border border-amber-500/35',
  draft: 'bg-white/10 text-white/60 border border-white/15',
  inactive: 'bg-white/10 text-white/60 border border-white/15',
  saved: 'bg-white/10 text-white/60 border border-white/15',
};

const LIVE_STATUSES = new Set(['active', 'live', 'running', 'deployed']);
const PAUSED_STATUSES = new Set(['paused']);

const buildDefaultFolders = () =>
  DEFAULT_FOLDERS.map((folder) => ({
    ...folder,
    strategies: [],
  }));

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const slugify = (value) =>
  String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const deriveTicker = (strategy) => {
  if (!strategy || typeof strategy !== 'object') return '';
  const rawTicker =
    strategy.ticker ||
    strategy.symbol ||
    strategy.summary?.ticker ||
    strategy.symbols?.[0] ||
    strategy.tickers?.[0] ||
    '';
  return String(rawTicker || '').replace(/^\$/, '').trim();
};

const deriveProfit = (strategy, fallback = 0) => {
  if (!strategy || typeof strategy !== 'object') return toNumber(fallback, 0);
  const raw = strategy.pnl ?? strategy.profit ?? strategy.summary?.value;
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string') {
    const cleaned = raw.replace(/[^0-9.-]/g, '');
    return toNumber(cleaned, toNumber(fallback, 0));
  }
  return toNumber(fallback, 0);
};

const deriveCreatedAt = (strategy, fallback = Date.now()) => {
  if (!strategy || typeof strategy !== 'object') return fallback;
  return strategy.createdAt || strategy.savedAt || strategy.updatedAt || fallback;
};

const deriveStatus = (strategy, deployedIds) => {
  const status = String(strategy?.runStatus || strategy?.status || '').toLowerCase().trim();
  if (status) return status;
  if (deployedIds.has(String(strategy?.id))) return 'active';
  return 'saved';
};

const isSophiaStrategy = (strategy) => {
  if (!strategy || typeof strategy !== 'object') return false;
  return Boolean(
    strategy.code ||
      String(strategy.id || '').toLowerCase().startsWith('sophia-') ||
      String(strategy.type || '').toLowerCase().includes('sophia')
  );
};

const normalizeStrategyEntry = (strategy) => {
  if (!strategy) return null;
  const id = String(strategy.id || '').trim();
  if (!id) return null;
  return {
    id,
    name: String(strategy.name || 'Untitled Strategy'),
    ticker: String(strategy.ticker || '').replace(/^\$/, '').trim(),
    createdAt: strategy.createdAt || Date.now(),
    profit: toNumber(strategy.profit, 0),
    isStarred: Boolean(strategy.isStarred),
    status: String(strategy.status || 'saved').toLowerCase(),
  };
};

const normalizeFolder = (folder, fallbackIndex = 0) => ({
  id: String(folder?.id || `folder-${fallbackIndex}`),
  name: String(folder?.name || `Folder ${fallbackIndex + 1}`),
  isExpanded: folder?.isExpanded !== false,
  strategies: Array.isArray(folder?.strategies)
    ? folder.strategies.map(normalizeStrategyEntry).filter(Boolean)
    : [],
});

const ensureDefaultFolders = (folders) => {
  const normalizedIncoming = Array.isArray(folders) ? folders.map(normalizeFolder) : [];
  const byId = new Map();

  normalizedIncoming.forEach((folder) => {
    if (!byId.has(folder.id)) byId.set(folder.id, folder);
  });

  const merged = buildDefaultFolders().map((defaultFolder) => {
    const existing = byId.get(defaultFolder.id);
    if (!existing) return defaultFolder;
    byId.delete(defaultFolder.id);
    return {
      ...defaultFolder,
      name: existing.name || defaultFolder.name,
      isExpanded: existing.isExpanded,
      strategies: existing.strategies,
    };
  });

  byId.forEach((folder) => merged.push(folder));

  const seenStrategyIds = new Set();
  return merged.map((folder) => ({
    ...folder,
    strategies: folder.strategies.filter((strategy) => {
      const strategyId = String(strategy.id);
      if (!strategyId || seenStrategyIds.has(strategyId)) return false;
      seenStrategyIds.add(strategyId);
      return true;
    }),
  }));
};

const loadFoldersFromStorage = () => {
  if (typeof window === 'undefined') return buildDefaultFolders();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return buildDefaultFolders();
    const parsed = JSON.parse(raw);
    const candidate = Array.isArray(parsed?.folders) ? parsed.folders : Array.isArray(parsed) ? parsed : [];
    return ensureDefaultFolders(candidate);
  } catch (error) {
    console.warn('Failed to load strategy folders from storage:', error);
    return buildDefaultFolders();
  }
};

const toStoragePayload = (folders) => ({
  folders: folders.map((folder) => ({
    id: folder.id,
    name: folder.name,
    isExpanded: folder.isExpanded !== false,
    strategies: folder.strategies.map((strategy) => ({
      id: strategy.id,
      name: strategy.name,
      ticker: strategy.ticker,
      createdAt: strategy.createdAt,
      profit: toNumber(strategy.profit, 0),
      isStarred: Boolean(strategy.isStarred),
      status: strategy.status || 'saved',
    })),
  })),
});

const mergeFoldersWithStrategies = (prevFolders, strategies, deployedStrategies) => {
  const safeStrategies = Array.isArray(strategies) ? strategies : [];
  const safeDeployed = Array.isArray(deployedStrategies) ? deployedStrategies : [];
  const deployedIds = new Set(safeDeployed.map((strategy) => String(strategy?.id)));

  const normalized = ensureDefaultFolders(prevFolders);
  const strategyMap = new Map(
    safeStrategies
      .map((strategy) => [String(strategy?.id), strategy])
      .filter(([id]) => id)
  );

  const seen = new Set();
  const mergedFolders = normalized.map((folder) => ({
    ...folder,
    strategies: folder.strategies
      .map((entry) => {
        const source = strategyMap.get(String(entry.id));
        if (!source) return null;
        seen.add(String(entry.id));
        return {
          id: String(entry.id),
          name: entry.name || source.name || 'Untitled Strategy',
          ticker: entry.ticker || deriveTicker(source),
          createdAt: entry.createdAt || deriveCreatedAt(source),
          profit: deriveProfit(source, entry.profit),
          isStarred: Boolean(
            Object.prototype.hasOwnProperty.call(entry, 'isStarred')
              ? entry.isStarred
              : source.isStarred
          ),
          status: deriveStatus(source, deployedIds),
        };
      })
      .filter(Boolean),
  }));

  const folderIndexById = new Map(mergedFolders.map((folder, index) => [folder.id, index]));

  const resolveFolderId = (strategy) => {
    const status = deriveStatus(strategy, deployedIds);
    if (LIVE_STATUSES.has(status)) return 'active-strategies';
    if (isSophiaStrategy(strategy)) return 'sophia-strategies';
    if (strategy?.isStarred) return 'favorites';
    if (strategy?.archived) return 'archive';
    return 'stratify';
  };

  strategyMap.forEach((strategy, strategyId) => {
    if (seen.has(strategyId)) return;
    const nextEntry = normalizeStrategyEntry({
      id: strategyId,
      name: strategy.name,
      ticker: deriveTicker(strategy),
      createdAt: deriveCreatedAt(strategy),
      profit: deriveProfit(strategy),
      isStarred: Boolean(strategy.isStarred),
      status: deriveStatus(strategy, deployedIds),
    });
    if (!nextEntry) return;

    const targetFolderId = resolveFolderId(strategy);
    const targetFolderIndex = folderIndexById.has(targetFolderId)
      ? folderIndexById.get(targetFolderId)
      : folderIndexById.get('stratify');

    if (typeof targetFolderIndex === 'number') {
      mergedFolders[targetFolderIndex] = {
        ...mergedFolders[targetFolderIndex],
        strategies: [...mergedFolders[targetFolderIndex].strategies, nextEntry],
      };
    }
  });

  return ensureDefaultFolders(mergedFolders);
};

const uniqueStrategiesFromFolders = (folders) => {
  const seen = new Set();
  const items = [];
  folders.forEach((folder) => {
    folder.strategies.forEach((strategy) => {
      const id = String(strategy.id);
      if (seen.has(id)) return;
      seen.add(id);
      items.push(strategy);
    });
  });
  return items;
};

const formatDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString();
};

const formatProfit = (value) => {
  const number = toNumber(value, NaN);
  if (!Number.isFinite(number)) return null;
  return `${number >= 0 ? '+' : ''}${number.toFixed(2)}%`;
};

const getStatusClassName = (status) => {
  const normalized = String(status || 'saved').toLowerCase();
  return STATUS_CLASSNAMES[normalized] || STATUS_CLASSNAMES.saved;
};

const folderIconClass = (folderId) => {
  if (folderId === 'favorites') return 'text-amber-300';
  if (folderId === 'active-strategies') return 'text-emerald-300';
  if (folderId === 'sophia-strategies') return 'text-emerald-400';
  if (folderId === 'archive') return 'text-zinc-400';
  if (folderId === 'stratify') return 'text-emerald-400';
  return 'text-zinc-300';
};

const renderFolderIcon = (folderId) => {
  if (folderId === 'favorites') {
    return <Star className={`h-4 w-4 ${folderIconClass(folderId)}`} strokeWidth={1.8} />;
  }
  if (folderId === 'stratify' || folderId === 'sophia-strategies') {
    return <Zap className={`h-4 w-4 ${folderIconClass(folderId)}`} strokeWidth={1.8} />;
  }
  return <Folder className={`h-4 w-4 ${folderIconClass(folderId)}`} strokeWidth={1.8} />;
};

const StrategiesPage = ({
  savedStrategies = [],
  deployedStrategies = [],
  onDeployStrategy,
  onActivateTemplate,
  onEditStrategy,
  onRemoveSavedStrategy,
  setActiveTab,
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [folders, setFolders] = useState(() => loadFoldersFromStorage());
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [selectedStrategyId, setSelectedStrategyId] = useState(null);
  const [draggedStrategyId, setDraggedStrategyId] = useState(null);
  const [dropFolderId, setDropFolderId] = useState(null);
  const [editing, setEditing] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [movePicker, setMovePicker] = useState(null);

  const contextMenuRef = useRef(null);
  const movePickerRef = useRef(null);
  const renameInputRef = useRef(null);

  const strategies = Array.isArray(savedStrategies) ? savedStrategies : [];
  const deployed = Array.isArray(deployedStrategies) ? deployedStrategies : [];
  const deployedIds = useMemo(
    () => new Set(deployed.map((strategy) => String(strategy?.id))),
    [deployed]
  );

  const strategySourceMap = useMemo(() => {
    const map = new Map();
    strategies.forEach((strategy) => {
      if (strategy?.id == null) return;
      map.set(String(strategy.id), strategy);
    });
    return map;
  }, [strategies]);

  useEffect(() => {
    setFolders((prev) => {
      const merged = mergeFoldersWithStrategies(prev, strategies, deployed);
      return JSON.stringify(merged) === JSON.stringify(prev) ? prev : merged;
    });
  }, [strategies, deployed]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toStoragePayload(folders)));
  }, [folders]);

  useEffect(() => {
    if (!editing || !renameInputRef.current) return;
    renameInputRef.current.focus();
    renameInputRef.current.select();
  }, [editing]);

  useEffect(() => {
    if (!contextMenu && !movePicker) return undefined;

    const handleOutsideClick = (event) => {
      const target = event.target;
      if (contextMenuRef.current?.contains(target)) return;
      if (movePickerRef.current?.contains(target)) return;
      setContextMenu(null);
      setMovePicker(null);
    };

    const handleEscape = (event) => {
      if (event.key !== 'Escape') return;
      setContextMenu(null);
      setMovePicker(null);
      setEditing(null);
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [contextMenu, movePicker]);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const folderViews = useMemo(
    () =>
      folders.map((folder) => ({
        ...folder,
        filteredStrategies: folder.strategies.filter((strategy) => {
          if (!normalizedQuery) return true;
          return [
            strategy.name,
            strategy.ticker,
            strategy.status,
            String(formatProfit(strategy.profit) || ''),
          ]
            .join(' ')
            .toLowerCase()
            .includes(normalizedQuery);
        }),
      })),
    [folders, normalizedQuery]
  );

  const allStrategies = useMemo(() => uniqueStrategiesFromFolders(folders), [folders]);
  const liveCount = allStrategies.filter((strategy) =>
    LIVE_STATUSES.has(String(strategy.status || '').toLowerCase())
  ).length;
  const pausedCount = allStrategies.filter((strategy) =>
    PAUSED_STATUSES.has(String(strategy.status || '').toLowerCase())
  ).length;
  const draftCount = Math.max(allStrategies.length - liveCount - pausedCount, 0);

  const toStrategyPayload = (entry) => {
    const source = strategySourceMap.get(String(entry.id));
    if (!source) {
      return {
        ...entry,
        pnl: entry.profit,
      };
    }

    return {
      ...source,
      id: source.id ?? entry.id,
      name: entry.name,
      ticker: entry.ticker || deriveTicker(source),
      savedAt: source.savedAt || entry.createdAt,
      createdAt: source.createdAt || entry.createdAt,
      pnl: Number.isFinite(source.pnl) ? source.pnl : entry.profit,
      profit: entry.profit,
      status: entry.status || deriveStatus(source, deployedIds),
      isStarred: entry.isStarred,
    };
  };

  const toggleFolderExpanded = (folderId) => {
    setFolders((prev) =>
      prev.map((folder) =>
        folder.id === folderId ? { ...folder, isExpanded: !folder.isExpanded } : folder
      )
    );
  };

  const createFolder = () => {
    const name = newFolderName.trim();
    if (!name) return;

    const existingIds = new Set(folders.map((folder) => folder.id));
    const base = slugify(name) || 'folder';
    let candidate = base;
    let suffix = 1;
    while (existingIds.has(candidate)) {
      candidate = `${base}-${suffix}`;
      suffix += 1;
    }

    setFolders((prev) => [
      ...prev,
      {
        id: candidate,
        name,
        isExpanded: true,
        strategies: [],
      },
    ]);
    setNewFolderName('');
    setShowNewFolder(false);
  };

  const moveStrategyToFolder = (strategyId, targetFolderId) => {
    setFolders((prev) => {
      let movedStrategy = null;

      const withoutStrategy = prev.map((folder) => {
        const nextStrategies = folder.strategies.filter((strategy) => {
          if (String(strategy.id) !== String(strategyId)) return true;
          movedStrategy = strategy;
          return false;
        });
        return nextStrategies.length === folder.strategies.length
          ? folder
          : { ...folder, strategies: nextStrategies };
      });

      if (!movedStrategy) return prev;

      return withoutStrategy.map((folder) => {
        if (folder.id !== targetFolderId) return folder;
        const alreadyExists = folder.strategies.some(
          (strategy) => String(strategy.id) === String(strategyId)
        );
        if (alreadyExists) return { ...folder, isExpanded: true };
        return {
          ...folder,
          isExpanded: true,
          strategies: [...folder.strategies, movedStrategy],
        };
      });
    });
  };

  const moveFolderStrategies = (sourceFolderId, targetFolderId) => {
    if (sourceFolderId === targetFolderId) return;
    setFolders((prev) => {
      const sourceFolder = prev.find((folder) => folder.id === sourceFolderId);
      if (!sourceFolder || sourceFolder.strategies.length === 0) return prev;

      const moving = [...sourceFolder.strategies];

      return prev.map((folder) => {
        if (folder.id === sourceFolderId) {
          return { ...folder, strategies: [] };
        }
        if (folder.id !== targetFolderId) return folder;
        const existing = new Set(folder.strategies.map((strategy) => String(strategy.id)));
        const merged = [...folder.strategies];
        moving.forEach((strategy) => {
          if (existing.has(String(strategy.id))) return;
          merged.push(strategy);
        });
        return { ...folder, isExpanded: true, strategies: merged };
      });
    });
  };

  const toggleStrategyStar = (folderId, strategyId) => {
    setFolders((prev) =>
      prev.map((folder) => {
        if (folder.id !== folderId) return folder;
        return {
          ...folder,
          strategies: folder.strategies.map((strategy) =>
            String(strategy.id) === String(strategyId)
              ? { ...strategy, isStarred: !strategy.isStarred }
              : strategy
          ),
        };
      })
    );
  };

  const toggleFolderStarred = (folderId) => {
    setFolders((prev) =>
      prev.map((folder) => {
        if (folder.id !== folderId) return folder;
        const shouldStarAll = folder.strategies.some((strategy) => !strategy.isStarred);
        return {
          ...folder,
          strategies: folder.strategies.map((strategy) => ({
            ...strategy,
            isStarred: shouldStarAll,
          })),
        };
      })
    );
  };

  const startRenameFolder = (folderId) => {
    const folder = folders.find((item) => item.id === folderId);
    if (!folder) return;
    setEditing({
      type: 'folder',
      folderId,
      value: folder.name,
    });
  };

  const startRenameStrategy = (folderId, strategyId) => {
    const folder = folders.find((item) => item.id === folderId);
    const strategy = folder?.strategies.find((item) => String(item.id) === String(strategyId));
    if (!strategy) return;
    setEditing({
      type: 'strategy',
      folderId,
      strategyId: String(strategy.id),
      value: strategy.name,
    });
  };

  const applyRename = () => {
    if (!editing) return;
    const nextName = String(editing.value || '').trim();
    if (!nextName) {
      setEditing(null);
      return;
    }

    setFolders((prev) =>
      prev.map((folder) => {
        if (editing.type === 'folder') {
          if (folder.id !== editing.folderId) return folder;
          return { ...folder, name: nextName };
        }

        if (editing.type === 'strategy') {
          if (folder.id !== editing.folderId) return folder;
          return {
            ...folder,
            strategies: folder.strategies.map((strategy) =>
              String(strategy.id) === String(editing.strategyId)
                ? { ...strategy, name: nextName }
                : strategy
            ),
          };
        }

        return folder;
      })
    );
    setEditing(null);
  };

  const deleteStrategy = (folderId, strategyId) => {
    const folder = folders.find((item) => item.id === folderId);
    const strategy = folder?.strategies.find((item) => String(item.id) === String(strategyId));
    if (!strategy) return;

    const confirmed = window.confirm(`Delete strategy "${strategy.name}"?`);
    if (!confirmed) return;

    setFolders((prev) =>
      prev.map((item) =>
        item.id === folderId
          ? {
              ...item,
              strategies: item.strategies.filter(
                (entry) => String(entry.id) !== String(strategyId)
              ),
            }
          : item
      )
    );

    if (selectedStrategyId === String(strategyId)) setSelectedStrategyId(null);
    onRemoveSavedStrategy?.(strategy.id);
  };

  const deleteFolder = (folderId) => {
    if (SYSTEM_FOLDER_IDS.has(folderId)) return;
    const folder = folders.find((item) => item.id === folderId);
    if (!folder) return;

    const strategyCount = folder.strategies.length;
    const message = strategyCount > 0
      ? `Delete folder "${folder.name}"? ${strategyCount} strateg${
          strategyCount === 1 ? 'y will' : 'ies will'
        } move to Archive.`
      : `Delete folder "${folder.name}"?`;
    if (!window.confirm(message)) return;

    setFolders((prev) => {
      const source = prev.find((item) => item.id === folderId);
      const sourceStrategies = source?.strategies || [];

      const next = prev.filter((item) => item.id !== folderId);
      if (sourceStrategies.length === 0) return next;

      return next.map((item) => {
        if (item.id !== 'archive') return item;
        const existing = new Set(item.strategies.map((strategy) => String(strategy.id)));
        const merged = [...item.strategies];
        sourceStrategies.forEach((strategy) => {
          if (!existing.has(String(strategy.id))) merged.push(strategy);
        });
        return {
          ...item,
          isExpanded: true,
          strategies: merged,
        };
      });
    });
  };

  const openContextMenuAt = (x, y, payload) => {
    const menuWidth = 230;
    const menuHeight = payload.type === 'folder' ? 210 : 220;
    const maxX = typeof window !== 'undefined' ? window.innerWidth - menuWidth - 8 : x;
    const maxY = typeof window !== 'undefined' ? window.innerHeight - menuHeight - 8 : y;

    setContextMenu({
      ...payload,
      x: clamp(x, 8, Math.max(maxX, 8)),
      y: clamp(y, 8, Math.max(maxY, 8)),
    });
    setMovePicker(null);
  };

  const openContextMenu = (event, payload) => {
    event.preventDefault();
    event.stopPropagation();
    openContextMenuAt(event.clientX, event.clientY, payload);
  };

  const openContextMenuFromButton = (event, payload) => {
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    openContextMenuAt(rect.left + rect.width - 8, rect.bottom + 6, payload);
  };

  const openMovePicker = () => {
    if (!contextMenu) return;
    const pickerWidth = 220;
    const pickerHeight = 260;
    const maxX = typeof window !== 'undefined' ? window.innerWidth - pickerWidth - 8 : contextMenu.x;
    const maxY = typeof window !== 'undefined' ? window.innerHeight - pickerHeight - 8 : contextMenu.y;

    if (contextMenu.type === 'strategy') {
      setMovePicker({
        mode: 'strategy',
        strategyId: contextMenu.strategyId,
        sourceFolderId: contextMenu.folderId,
        x: clamp(contextMenu.x + 190, 8, Math.max(maxX, 8)),
        y: clamp(contextMenu.y + 10, 8, Math.max(maxY, 8)),
      });
    } else {
      setMovePicker({
        mode: 'folder',
        sourceFolderId: contextMenu.folderId,
        x: clamp(contextMenu.x + 190, 8, Math.max(maxX, 8)),
        y: clamp(contextMenu.y + 10, 8, Math.max(maxY, 8)),
      });
    }

    setContextMenu(null);
  };

  const handleContextAction = (action) => {
    if (!contextMenu) return;

    if (contextMenu.type === 'folder') {
      const folder = folders.find((item) => item.id === contextMenu.folderId);
      if (!folder) return;

      if (action === 'rename') {
        startRenameFolder(folder.id);
      }
      if (action === 'move') {
        openMovePicker();
        return;
      }
      if (action === 'star') {
        toggleFolderStarred(folder.id);
      }
      if (action === 'delete') {
        deleteFolder(folder.id);
      }

      setContextMenu(null);
      return;
    }

    if (contextMenu.type === 'strategy') {
      if (action === 'rename') startRenameStrategy(contextMenu.folderId, contextMenu.strategyId);
      if (action === 'move') {
        openMovePicker();
        return;
      }
      if (action === 'star') toggleStrategyStar(contextMenu.folderId, contextMenu.strategyId);
      if (action === 'delete') deleteStrategy(contextMenu.folderId, contextMenu.strategyId);

      setContextMenu(null);
    }
  };

  const contextMenuItems = useMemo(() => {
    if (!contextMenu) return [];

    if (contextMenu.type === 'folder') {
      const folder = folders.find((item) => item.id === contextMenu.folderId);
      const hasStrategies = Boolean(folder?.strategies.length);
      const allStarred = hasStrategies && folder.strategies.every((strategy) => strategy.isStarred);
      return [
        { key: 'rename', label: 'Rename', icon: Edit3, disabled: false, danger: false },
        { key: 'move', label: 'Move to folder...', icon: ArrowRightLeft, disabled: !hasStrategies, danger: false },
        { key: 'star', label: allStarred ? 'Unstar all' : 'Star all', icon: Star, disabled: !hasStrategies, danger: false },
        { key: 'delete', label: 'Delete', icon: Trash2, disabled: SYSTEM_FOLDER_IDS.has(contextMenu.folderId), danger: true },
      ];
    }

    const folder = folders.find((item) => item.id === contextMenu.folderId);
    const strategy = folder?.strategies.find(
      (item) => String(item.id) === String(contextMenu.strategyId)
    );
    return [
      { key: 'rename', label: 'Rename', icon: Edit3, disabled: false, danger: false },
      { key: 'move', label: 'Move to folder...', icon: ArrowRightLeft, disabled: false, danger: false },
      {
        key: 'star',
        label: strategy?.isStarred ? 'Remove favorite' : 'Star / Favorite',
        icon: Star,
        disabled: false,
        danger: false,
      },
      { key: 'delete', label: 'Delete', icon: Trash2, disabled: false, danger: true },
    ];
  }, [contextMenu, folders]);

  const submitMovePicker = (targetFolderId) => {
    if (!movePicker) return;
    if (movePicker.mode === 'strategy') {
      moveStrategyToFolder(movePicker.strategyId, targetFolderId);
    } else {
      moveFolderStrategies(movePicker.sourceFolderId, targetFolderId);
    }
    setMovePicker(null);
  };

  if (selectedTemplate) {
    return (
      <div className="flex h-full flex-1 flex-col overflow-hidden bg-[#0b0b0b]">
        <StrategyTemplateFlow
          initialTemplate={selectedTemplate}
          onBack={() => setSelectedTemplate(null)}
          onActivateStrategy={onActivateTemplate}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden bg-[#0b0b0b]">
      <div className="shrink-0 border-b border-zinc-800 px-6 pb-5 pt-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">My Strategies</h1>
            <p className="mt-1 text-base text-white/45">
              File-style strategy manager with folders, favorites, and drag-to-move.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35"
                strokeWidth={1.8}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search strategies..."
                className="w-64 rounded-xl border border-zinc-700 bg-zinc-900/60 py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-white/30 focus:border-emerald-500/50 focus:outline-none"
              />
            </div>

            <button
              type="button"
              onClick={() => setShowNewFolder((prev) => !prev)}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-3 py-2.5 text-sm font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/15"
            >
              <FolderPlus className="h-4 w-4" strokeWidth={1.8} />
              New Folder
            </button>
          </div>
        </div>

        {showNewFolder && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900/50 px-3 py-3">
            <Folder className="h-5 w-5 text-emerald-300" strokeWidth={1.8} />
            <input
              type="text"
              value={newFolderName}
              onChange={(event) => setNewFolderName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') createFolder();
                if (event.key === 'Escape') {
                  setShowNewFolder(false);
                  setNewFolderName('');
                }
              }}
              placeholder="Folder name..."
              className="flex-1 bg-transparent text-base text-white placeholder:text-white/35 outline-none"
              autoFocus
            />
            <button
              type="button"
              onClick={createFolder}
              disabled={!newFolderName.trim()}
              className="rounded-lg border border-emerald-500/35 bg-emerald-500/15 px-3 py-1.5 text-sm font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => {
                setShowNewFolder(false);
                setNewFolderName('');
              }}
              className="rounded-md p-1 text-white/40 transition-colors hover:text-white/70"
            >
              <X className="h-4 w-4" strokeWidth={1.8} />
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4" style={{ scrollbarWidth: 'thin' }}>
        {allStrategies.length === 0 && (
          <div className="mb-5 flex items-center justify-between gap-4 rounded-xl border border-zinc-700 bg-zinc-900/45 px-5 py-4">
            <div className="text-base text-white/75">
              No strategies yet. Create your first strategy to get started.
            </div>
            <button
              type="button"
              onClick={() => setActiveTab?.('builder')}
              className="rounded-xl border border-emerald-500/35 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/20"
            >
              Strategy Builder
            </button>
          </div>
        )}

        <div className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-white/35">
          Folders
        </div>

        {folderViews.map((folder) => {
          const isFolderEditing =
            editing?.type === 'folder' && editing.folderId === folder.id;
          const isDropTarget = dropFolderId === folder.id;
          const hasMatches = folder.filteredStrategies.length > 0;

          return (
            <div
              key={folder.id}
              className="mb-2"
              onDragOver={(event) => {
                event.preventDefault();
                if (!draggedStrategyId) return;
                setDropFolderId(folder.id);
              }}
              onDragLeave={() => setDropFolderId(null)}
              onDrop={(event) => {
                event.preventDefault();
                if (draggedStrategyId) moveStrategyToFolder(draggedStrategyId, folder.id);
                setDraggedStrategyId(null);
                setDropFolderId(null);
              }}
            >
              <div
                className={`group flex items-center gap-2 rounded-xl border px-3 py-2 transition-colors ${
                  isDropTarget
                    ? 'border-emerald-500/45 bg-emerald-500/10'
                    : 'border-transparent hover:border-zinc-700 hover:bg-zinc-900/40'
                }`}
                onContextMenu={(event) =>
                  openContextMenu(event, { type: 'folder', folderId: folder.id })
                }
              >
                <button
                  type="button"
                  onClick={() => toggleFolderExpanded(folder.id)}
                  className="flex min-w-0 flex-1 items-center gap-2"
                >
                  <ChevronRight
                    className={`h-4 w-4 text-white/50 transition-transform duration-200 ${
                      folder.isExpanded ? 'rotate-90' : ''
                    }`}
                    strokeWidth={2}
                  />
                  {renderFolderIcon(folder.id)}

                  {isFolderEditing ? (
                    <input
                      ref={renameInputRef}
                      value={editing.value}
                      onChange={(event) =>
                        setEditing((prev) => (prev ? { ...prev, value: event.target.value } : prev))
                      }
                      onBlur={applyRename}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') applyRename();
                        if (event.key === 'Escape') setEditing(null);
                      }}
                      onClick={(event) => event.stopPropagation()}
                      className="min-w-0 flex-1 rounded border border-emerald-500/40 bg-[#0b0b0b] px-2 py-1 text-lg font-semibold text-white outline-none"
                    />
                  ) : (
                    <span
                      className="truncate text-left text-lg font-semibold text-white/90"
                      onDoubleClick={(event) => {
                        event.stopPropagation();
                        startRenameFolder(folder.id);
                      }}
                    >
                      {folder.name}
                    </span>
                  )}
                </button>

                <span className="rounded-md border border-zinc-700 bg-zinc-900/70 px-2 py-0.5 text-xs font-semibold text-white/55">
                  {folder.strategies.length}
                </span>

                <button
                  type="button"
                  onClick={(event) =>
                    openContextMenuFromButton(event, { type: 'folder', folderId: folder.id })
                  }
                  className="rounded-md p-1 text-white/0 transition-colors group-hover:text-white/55 hover:text-white"
                >
                  <MoreVertical className="h-4 w-4" strokeWidth={1.8} />
                </button>
              </div>

              <div
                className={`grid transition-all duration-300 ease-out ${
                  folder.isExpanded ? 'mt-1 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                } ${folder.isExpanded ? '' : 'pointer-events-none'}`}
              >
                <div className="overflow-hidden">
                  <div className="ml-8 border-l border-zinc-800 pl-3">
                    {hasMatches &&
                      folder.filteredStrategies.map((strategy) => {
                        const isSelected = selectedStrategyId === String(strategy.id);
                        const isStrategyEditing =
                          editing?.type === 'strategy' &&
                          editing.folderId === folder.id &&
                          String(editing.strategyId) === String(strategy.id);
                        const profitText = formatProfit(strategy.profit);
                        const isLive = LIVE_STATUSES.has(String(strategy.status || '').toLowerCase());

                        return (
                          <div
                            key={strategy.id}
                            draggable
                            onDragStart={(event) => {
                              setDraggedStrategyId(String(strategy.id));
                              event.dataTransfer.effectAllowed = 'move';
                            }}
                            onDragEnd={() => {
                              setDraggedStrategyId(null);
                              setDropFolderId(null);
                            }}
                            onClick={() => setSelectedStrategyId(String(strategy.id))}
                            onContextMenu={(event) =>
                              openContextMenu(event, {
                                type: 'strategy',
                                folderId: folder.id,
                                strategyId: String(strategy.id),
                              })
                            }
                            className={`group/item my-1 rounded-xl border px-3 py-2.5 transition-colors ${
                              isSelected
                                ? 'border-emerald-500/45 bg-emerald-500/12'
                                : 'border-transparent hover:border-zinc-700 hover:bg-zinc-900/40'
                            }`}
                          >
                            <div className="flex items-start gap-2">
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  toggleStrategyStar(folder.id, strategy.id);
                                }}
                                className="mt-0.5 rounded-md p-1 text-white/30 transition-colors hover:text-amber-300"
                              >
                                <Star
                                  className={`h-4 w-4 ${
                                    strategy.isStarred
                                      ? 'fill-amber-300 text-amber-300'
                                      : 'text-white/35'
                                  }`}
                                  strokeWidth={1.8}
                                />
                              </button>

                              <div className="min-w-0 flex-1">
                                {isStrategyEditing ? (
                                  <input
                                    ref={renameInputRef}
                                    value={editing.value}
                                    onChange={(event) =>
                                      setEditing((prev) =>
                                        prev ? { ...prev, value: event.target.value } : prev
                                      )
                                    }
                                    onBlur={applyRename}
                                    onKeyDown={(event) => {
                                      if (event.key === 'Enter') applyRename();
                                      if (event.key === 'Escape') setEditing(null);
                                    }}
                                    onClick={(event) => event.stopPropagation()}
                                    className="w-full rounded border border-emerald-500/40 bg-[#0b0b0b] px-2 py-1 text-base font-semibold text-white outline-none"
                                  />
                                ) : (
                                  <div
                                    className="truncate text-base font-semibold text-white/95"
                                    onDoubleClick={(event) => {
                                      event.stopPropagation();
                                      startRenameStrategy(folder.id, strategy.id);
                                    }}
                                  >
                                    {strategy.name}
                                  </div>
                                )}

                                <div className="mt-1 flex flex-wrap items-center gap-2">
                                  {strategy.ticker && (
                                    <span className="rounded-md border border-amber-500/35 bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-300">
                                      ${strategy.ticker}
                                    </span>
                                  )}

                                  <span className="text-xs text-white/45">
                                    {formatDate(strategy.createdAt)}
                                  </span>

                                  {profitText && (
                                    <span
                                      className={`text-sm font-semibold ${
                                        strategy.profit >= 0 ? 'text-emerald-300' : 'text-rose-300'
                                      }`}
                                    >
                                      {profitText}
                                    </span>
                                  )}

                                  <span
                                    className={`rounded-md px-2 py-0.5 text-xs font-semibold ${getStatusClassName(
                                      strategy.status
                                    )}`}
                                  >
                                    {strategy.status || 'saved'}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover/item:opacity-100">
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    onEditStrategy?.(toStrategyPayload(strategy));
                                  }}
                                  className="rounded-md p-1 text-white/40 transition-colors hover:text-emerald-300"
                                  title="Edit"
                                >
                                  <Edit3 className="h-4 w-4" strokeWidth={1.8} />
                                </button>

                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    onDeployStrategy?.(toStrategyPayload(strategy), true);
                                  }}
                                  className={`rounded-md p-1 transition-colors ${
                                    isLive
                                      ? 'text-emerald-300'
                                      : 'text-white/40 hover:text-emerald-300'
                                  }`}
                                  title="Activate"
                                >
                                  <Play className="h-4 w-4" strokeWidth={1.8} />
                                </button>

                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    deleteStrategy(folder.id, strategy.id);
                                  }}
                                  className="rounded-md p-1 text-white/40 transition-colors hover:text-rose-300"
                                  title="Delete"
                                >
                                  <Trash2 className="h-4 w-4" strokeWidth={1.8} />
                                </button>

                                <button
                                  type="button"
                                  onClick={(event) =>
                                    openContextMenuFromButton(event, {
                                      type: 'strategy',
                                      folderId: folder.id,
                                      strategyId: String(strategy.id),
                                    })
                                  }
                                  className="rounded-md p-1 text-white/45 transition-colors hover:text-white/90"
                                  title="More"
                                >
                                  <MoreVertical className="h-4 w-4" strokeWidth={1.8} />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                    {folder.filteredStrategies.length === 0 && (
                      <div className="py-3 text-sm italic text-white/35">
                        {normalizedQuery ? 'No matches' : 'No strategies yet'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="shrink-0 border-t border-zinc-800 px-6 py-3">
        <div className="flex flex-wrap items-center justify-between gap-4 text-sm">
          <span className="text-white/45">{allStrategies.length} strategies</span>
          <div className="flex items-center gap-4 text-white/45">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              {liveCount} live
            </span>
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              {pausedCount} paused
            </span>
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-zinc-400" />
              {draftCount} drafts
            </span>
          </div>
        </div>
      </div>

      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-[120] min-w-[230px] rounded-xl border border-zinc-700 bg-[#121212]/95 p-1.5 shadow-2xl backdrop-blur"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {contextMenuItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => handleContextAction(item.key)}
                disabled={item.disabled}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  item.disabled
                    ? 'cursor-not-allowed text-white/25'
                    : item.danger
                    ? 'text-rose-300 hover:bg-rose-500/10'
                    : 'text-white/80 hover:bg-white/5'
                }`}
              >
                <Icon className="h-4 w-4" strokeWidth={1.8} />
                {item.label}
              </button>
            );
          })}
        </div>
      )}

      {movePicker && (
        <div
          ref={movePickerRef}
          className="fixed z-[125] min-w-[220px] rounded-xl border border-zinc-700 bg-[#121212]/95 p-1.5 shadow-2xl backdrop-blur"
          style={{ left: movePicker.x, top: movePicker.y }}
        >
          <div className="px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white/35">
            Move to folder
          </div>
          {folders.map((folder) => {
            const isSameFolder = movePicker.sourceFolderId === folder.id;
            return (
              <button
                key={folder.id}
                type="button"
                disabled={isSameFolder}
                onClick={() => submitMovePicker(folder.id)}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  isSameFolder
                    ? 'cursor-not-allowed text-white/25'
                    : 'text-white/80 hover:bg-white/5'
                }`}
              >
                {renderFolderIcon(folder.id)}
                <span className="truncate">{folder.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StrategiesPage;
