import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronsLeft,
  ChevronsRight,
  ChevronRight,
  Folder,
  FolderPlus,
  Play,
  Star,
  Trash2,
  Zap,
} from 'lucide-react';
import StrategyOutput from './StrategyOutput';
import { supabase } from '../../lib/supabaseClient';
import { normalizeTickerSymbol, tokenizeTickerText } from '../../lib/tickerStyling';
import { useAuth } from '../../context/AuthContext';

const STORAGE_KEY = 'stratify-strategies-folders';
const SAVED_STRATEGIES_FALLBACK_KEY = 'stratify-saved-strategies-fallback';
const ONE_TIME_RESET_FLAG = 'stratify-strategies-reset-20260217-complete';
const USER_STATE_FOLDERS_KEY = 'terminal_strategy_folders';

const DEFAULT_FOLDERS = [
  { id: 'stratify', name: 'STRATIFY', isExpanded: true, strategies: [] },
  { id: 'active-strategies', name: 'Active Strategies', isExpanded: true, strategies: [] },
  { id: 'favorites', name: 'Favorites', isExpanded: true, strategies: [] },
  { id: 'sophia-strategies', name: 'Sophia Strategies', isExpanded: true, strategies: [] },
  { id: 'archive', name: 'Archive', isExpanded: false, strategies: [] },
];

const LIVE_STATUSES = new Set(['active', 'live', 'running', 'deployed']);

const buildDefaultFolders = () =>
  DEFAULT_FOLDERS.map((folder) => ({
    ...folder,
    strategies: [],
  }));

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toNumericValue = (value) => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^0-9.-]/g, '');
    return Number(cleaned);
  }
  return NaN;
};

const normalizeReturnPercent = (value) => {
  let number = toNumericValue(value);
  if (!Number.isFinite(number)) return NaN;

  const hasPercentSign = typeof value === 'string' && value.includes('%');
  if (!hasPercentSign && Math.abs(number) > 0 && Math.abs(number) <= 1) {
    number *= 100;
  }

  while (Math.abs(number) > 500) {
    number /= 10;
  }

  return number;
};

const formatProfit = (value) => {
  const number = normalizeReturnPercent(value);
  if (!Number.isFinite(number)) return null;
  return `${number >= 0 ? '+' : ''}${number.toFixed(1)}%`;
};

const formatDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString();
};

const renderTickerText = (text, keyPrefix = 'ticker') =>
  tokenizeTickerText(text).map((token, index) =>
    token.type === 'ticker' ? (
      <span key={`${keyPrefix}-${index}`} className="text-emerald-400 font-semibold">
        {token.value}
      </span>
    ) : (
      <React.Fragment key={`${keyPrefix}-${index}`}>{token.value}</React.Fragment>
    )
  );

const slugify = (value) =>
  String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const deriveTicker = (strategy) => {
  if (!strategy || typeof strategy !== 'object') return '';
  const rawTicker =
    strategy.ticker ||
    strategy.symbol ||
    strategy.summary?.ticker ||
    strategy.symbols?.[0] ||
    strategy.tickers?.[0] ||
    '';
  return String(rawTicker || '').replace(/^\$/, '').trim().toUpperCase();
};

const deriveProfit = (strategy, fallback = 0) => {
  if (!strategy || typeof strategy !== 'object') return toNumber(fallback, 0);

  const candidates = [
    strategy.pnlPct,
    strategy.returnPct,
    strategy.returnPercent,
    strategy.totalReturn,
    strategy.metrics?.returnPct,
    strategy.metrics?.returnPercent,
    strategy.metrics?.totalReturn,
    strategy.summary?.returnPct,
    strategy.summary?.returnPercent,
    strategy.summary?.totalReturn,
    strategy.summary?.roi,
    strategy.profit,
    strategy.pnl,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeReturnPercent(candidate);
    if (Number.isFinite(normalized)) return normalized;
  }

  const normalizedFallback = normalizeReturnPercent(fallback);
  return Number.isFinite(normalizedFallback) ? normalizedFallback : toNumber(fallback, 0);
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
    ticker: deriveTicker(strategy),
    createdAt: deriveCreatedAt(strategy),
    profit: deriveProfit(strategy),
    isStarred: Boolean(strategy.isStarred),
    status: String(strategy.status || strategy.runStatus || 'saved').toLowerCase(),
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
    const candidate = Array.isArray(parsed?.folders)
      ? parsed.folders
      : Array.isArray(parsed)
      ? parsed
      : [];
    return ensureDefaultFolders(candidate);
  } catch {
    return buildDefaultFolders();
  }
};

const hasFolderData = (folders) => (
  Array.isArray(folders) && folders.some((folder) => Array.isArray(folder?.strategies) && folder.strategies.length > 0)
);

const isMissingColumnError = (error, columnName) => {
  const message = String(error?.message || '').toLowerCase();
  return message.includes(columnName.toLowerCase()) && message.includes('column');
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

const firstNonEmpty = (...values) => {
  for (const value of values) {
    if (value == null) continue;
    const next = String(value).trim();
    if (next) return next;
  }
  return '';
};

const buildFallbackMarkdown = (strategy) => {
  const ticker = deriveTicker(strategy);
  const summary = strategy?.summary || {};
  const entry = firstNonEmpty(strategy.entry, summary.entry, strategy.keyTradeSetups?.entry, '—');
  const volume = firstNonEmpty(strategy.volume, summary.volume, strategy.keyTradeSetups?.volume, '—');
  const trend = firstNonEmpty(strategy.trend, summary.trend, strategy.keyTradeSetups?.trend, '—');
  const riskReward = firstNonEmpty(strategy.riskReward, summary.riskReward, strategy.keyTradeSetups?.riskReward, '—');
  const stopLoss = firstNonEmpty(strategy.stopLoss, summary.stopLoss, strategy.keyTradeSetups?.stopLoss, '—');

  return [
    `## Strategy Overview`,
    strategy.description || summary.description || 'Backtest results loaded from saved strategy state.',
    '',
    '## Performance Overview',
    `- Return: ${formatProfit(deriveProfit(strategy)) || '—'}`,
    '',
    '## Key Findings',
    `- Ticker: ${ticker ? `$${ticker}` : '—'}`,
    `- Status: ${String(strategy.status || strategy.runStatus || 'saved')}`,
    '',
    '🔥 Key Trade Setups',
    `● Entry Signal: ${entry}`,
    `● Volume: ${volume}`,
    `● Trend: ${trend}`,
    `● Risk/Reward: ${riskReward}`,
    `● Stop Loss: ${stopLoss}`,
  ].join('\n');
};

const toOutputStrategy = (strategy) => {
  if (!strategy) return null;

  const summary = strategy?.summary && typeof strategy.summary === 'object' ? strategy.summary : {};
  const ticker = firstNonEmpty(
    strategy.ticker,
    strategy.symbol,
    summary.ticker,
    strategy.symbols?.[0],
    strategy.tickers?.[0]
  );

  const rawContent = firstNonEmpty(
    strategy.raw,
    strategy.content,
    summary.raw,
    summary.content,
    strategy.analysis,
    summary.analysis,
    strategy.code
  );

  const keyTradeSetups = strategy.keyTradeSetups || summary.keyTradeSetups || {};

  return {
    ...strategy,
    name: firstNonEmpty(strategy.name, summary.name, 'Untitled Strategy'),
    ticker: String(ticker || '').replace(/^\$/, '').toUpperCase(),
    raw: rawContent || buildFallbackMarkdown(strategy),
    value: firstNonEmpty(strategy.value, summary.value, formatProfit(deriveProfit(strategy))),
    entry: firstNonEmpty(strategy.entry, summary.entry, keyTradeSetups.entry),
    volume: firstNonEmpty(strategy.volume, summary.volume, keyTradeSetups.volume),
    trend: firstNonEmpty(strategy.trend, summary.trend, keyTradeSetups.trend),
    riskReward: firstNonEmpty(strategy.riskReward, summary.riskReward, keyTradeSetups.riskReward),
    stopLoss: firstNonEmpty(strategy.stopLoss, summary.stopLoss, keyTradeSetups.stopLoss),
    allocation: firstNonEmpty(
      strategy.allocation,
      summary.allocation,
      strategy.positionSize,
      keyTradeSetups.allocation
    ),
  };
};

const upsertStrategy = (prev, strategy) => {
  const nextStrategy = {
    ...strategy,
    id: strategy.id || `strategy-${Date.now()}`,
    savedAt: strategy.savedAt || Date.now(),
  };

  const nextId = String(nextStrategy.id || '');
  const existingIndex = prev.findIndex((item) => {
    const itemId = String(item?.id || '');
    if (nextId && itemId && nextId === itemId) return true;

    const itemName = String(item?.name || '').trim().toLowerCase();
    const nextName = String(nextStrategy.name || '').trim().toLowerCase();
    const itemTicker = deriveTicker(item).toLowerCase();
    const nextTicker = deriveTicker(nextStrategy).toLowerCase();

    if (!itemName || !nextName) return false;
    return itemName === nextName && itemTicker === nextTicker;
  });

  if (existingIndex >= 0) {
    const updated = [...prev];
    updated[existingIndex] = {
      ...updated[existingIndex],
      ...nextStrategy,
      savedAt: Date.now(),
    };
    return updated;
  }

  return [nextStrategy, ...prev];
};

const TerminalStrategyWorkspace = ({
  savedStrategies = [],
  deployedStrategies = [],
  onSaveStrategy,
  onDeleteStrategy,
  onClearStrategies,
  onDeployStrategy,
  onRetestStrategy,
  onOpenBuilder,
}) => {
  const { user } = useAuth();
  const [folders, setFolders] = useState(() => loadFoldersFromStorage());
  const [selectedStrategyId, setSelectedStrategyId] = useState(null);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [deletingStrategyId, setDeletingStrategyId] = useState(null);
  const [foldersCollapsed, setFoldersCollapsed] = useState(false);
  const [foldersLoaded, setFoldersLoaded] = useState(false);

  const folderSaveTimerRef = useRef(null);
  const lastSavedFoldersRef = useRef('');
  const missingSelectionTimerRef = useRef(null);

  const safeSaved = Array.isArray(savedStrategies) ? savedStrategies : [];
  const safeDeployed = Array.isArray(deployedStrategies) ? deployedStrategies : [];

  const sourceStrategies = useMemo(() => {
    const merged = [...safeSaved, ...safeDeployed];
    const seen = new Set();
    const unique = [];

    merged.forEach((strategy) => {
      const id = String(strategy?.id || '').trim();
      if (!id || seen.has(id)) return;
      seen.add(id);
      unique.push(strategy);
    });

    return unique;
  }, [safeSaved, safeDeployed]);

  const strategySourceMap = useMemo(() => {
    const map = new Map();
    sourceStrategies.forEach((strategy) => {
      const id = String(strategy?.id || '').trim();
      if (!id) return;
      map.set(id, strategy);
    });
    return map;
  }, [sourceStrategies]);

  useEffect(() => {
    setFolders((prev) => {
      const merged = mergeFoldersWithStrategies(prev, sourceStrategies, safeDeployed);
      return JSON.stringify(merged) === JSON.stringify(prev) ? prev : merged;
    });
  }, [sourceStrategies, safeDeployed]);

  const saveFoldersToSupabase = useCallback(async (userId, nextFolders, serializedPayload) => {
    if (!userId || !supabase) return false;

    try {
      const lookup = await supabase
        .from('profiles')
        .select('user_state')
        .eq('id', userId)
        .maybeSingle();

      if (lookup.error) {
        if (!isMissingColumnError(lookup.error, 'user_state')) {
          console.warn('[TerminalStrategyWorkspace] Folders save error:', lookup.error.message);
        }
        return false;
      }

      const existingState = lookup.data?.user_state && typeof lookup.data.user_state === 'object'
        ? lookup.data.user_state
        : {};

      const nextUserState = {
        ...existingState,
        [USER_STATE_FOLDERS_KEY]: toStoragePayload(nextFolders).folders,
      };

      const { error } = await supabase
        .from('profiles')
        .update({
          user_state: nextUserState,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (error) {
        console.warn('[TerminalStrategyWorkspace] Folders save error:', error.message);
        return false;
      }

      if (serializedPayload) {
        lastSavedFoldersRef.current = serializedPayload;
      }
      return true;
    } catch (error) {
      console.warn('[TerminalStrategyWorkspace] Folders save failed:', error);
      return false;
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!user?.id || !supabase) {
      const localFolders = loadFoldersFromStorage();
      setFolders(localFolders);
      const serializedLocal = JSON.stringify(toStoragePayload(localFolders));
      lastSavedFoldersRef.current = serializedLocal;
      setFoldersLoaded(true);
      return;
    }

    let cancelled = false;

    const loadFromSupabase = async () => {
      setFoldersLoaded(false);
      const localFolders = loadFoldersFromStorage();

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('user_state')
          .eq('id', user.id)
          .maybeSingle();

        if (error) {
          if (!isMissingColumnError(error, 'user_state')) {
            console.warn('[TerminalStrategyWorkspace] Folders load error:', error.message);
          }
          if (!cancelled) {
            setFolders(localFolders);
            const serializedLocal = JSON.stringify(toStoragePayload(localFolders));
            lastSavedFoldersRef.current = serializedLocal;
            setFoldersLoaded(true);
          }
          return;
        }

        const remoteFoldersRaw = Array.isArray(data?.user_state?.[USER_STATE_FOLDERS_KEY])
          ? data.user_state[USER_STATE_FOLDERS_KEY]
          : [];
        const remoteFolders = ensureDefaultFolders(remoteFoldersRaw);
        const useLocal = !hasFolderData(remoteFolders) && hasFolderData(localFolders);
        const resolved = useLocal ? localFolders : remoteFolders;
        const serializedResolved = JSON.stringify(toStoragePayload(resolved));

        if (cancelled) return;

        setFolders(resolved);
        localStorage.setItem(STORAGE_KEY, serializedResolved);
        lastSavedFoldersRef.current = serializedResolved;
        setFoldersLoaded(true);

        if (useLocal) {
          saveFoldersToSupabase(user.id, resolved, serializedResolved);
        }
      } catch (error) {
        if (cancelled) return;
        console.warn('[TerminalStrategyWorkspace] Folders load failed:', error);
        setFolders(localFolders);
        const serializedLocal = JSON.stringify(toStoragePayload(localFolders));
        localStorage.setItem(STORAGE_KEY, serializedLocal);
        lastSavedFoldersRef.current = serializedLocal;
        setFoldersLoaded(true);
      }
    };

    loadFromSupabase();

    return () => {
      cancelled = true;
    };
  }, [user?.id, saveFoldersToSupabase]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const serializedFolders = JSON.stringify(toStoragePayload(folders));
    localStorage.setItem(STORAGE_KEY, serializedFolders);
    if (!foldersLoaded) return;
    if (serializedFolders === lastSavedFoldersRef.current) return;

    if (folderSaveTimerRef.current) clearTimeout(folderSaveTimerRef.current);
    folderSaveTimerRef.current = setTimeout(() => {
      if (!user?.id || !supabase) {
        lastSavedFoldersRef.current = serializedFolders;
        return;
      }
      saveFoldersToSupabase(user.id, folders, serializedFolders);
    }, 1500);

    return () => {
      if (folderSaveTimerRef.current) clearTimeout(folderSaveTimerRef.current);
    };
  }, [folders, foldersLoaded, user?.id, saveFoldersToSupabase]);

  useEffect(() => {
    let cancelled = false;

    const runOneTimeReset = async () => {
      if (typeof window === 'undefined') return;
      if (localStorage.getItem(ONE_TIME_RESET_FLAG) === 'done') return;

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token;
        if (!accessToken) return;

        const response = await fetch('/api/delete-all-strategies', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
            'x-stratify-reset': '2026-02-17-reset',
          },
          body: JSON.stringify({ confirm: 'DELETE_ALL_STRATEGIES' }),
        });

        if (!response.ok) {
          if (response.status === 410) {
            localStorage.setItem(ONE_TIME_RESET_FLAG, 'done');
          }
          return;
        }
        if (cancelled) return;

        onClearStrategies?.();
        setFolders(buildDefaultFolders());
        setSelectedStrategyId(null);
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem('stratify-strategy-sync');
        localStorage.removeItem(SAVED_STRATEGIES_FALLBACK_KEY);
        localStorage.setItem(ONE_TIME_RESET_FLAG, 'done');
      } catch (error) {
        console.warn('[TerminalStrategyWorkspace] One-time strategy reset failed:', error);
      }
    };

    runOneTimeReset();

    return () => {
      cancelled = true;
    };
  }, [onClearStrategies]);

  const allStrategies = useMemo(() => uniqueStrategiesFromFolders(folders), [folders]);

  useEffect(() => {
    if (!selectedStrategyId) {
      if (missingSelectionTimerRef.current) {
        clearTimeout(missingSelectionTimerRef.current);
        missingSelectionTimerRef.current = null;
      }
      return;
    }

    const targetId = String(selectedStrategyId);
    const existsInFolders = allStrategies.some((strategy) => String(strategy.id) === targetId);
    const existsInSource = strategySourceMap.has(targetId);

    if (existsInFolders || existsInSource) {
      if (missingSelectionTimerRef.current) {
        clearTimeout(missingSelectionTimerRef.current);
        missingSelectionTimerRef.current = null;
      }
      return;
    }

    if (missingSelectionTimerRef.current) {
      clearTimeout(missingSelectionTimerRef.current);
    }

    // Guard against brief sync windows where strategy maps are rebuilding.
    missingSelectionTimerRef.current = setTimeout(() => {
      setSelectedStrategyId((prev) => (String(prev || '') === targetId ? null : prev));
      missingSelectionTimerRef.current = null;
    }, 900);

    return () => {
      if (missingSelectionTimerRef.current) {
        clearTimeout(missingSelectionTimerRef.current);
        missingSelectionTimerRef.current = null;
      }
    };
  }, [allStrategies, selectedStrategyId, strategySourceMap]);

  useEffect(() => () => {
    if (missingSelectionTimerRef.current) {
      clearTimeout(missingSelectionTimerRef.current);
      missingSelectionTimerRef.current = null;
    }
  }, []);

  const selectedStrategy = useMemo(() => {
    if (!selectedStrategyId) return null;
    const source = strategySourceMap.get(String(selectedStrategyId));
    if (source) return toOutputStrategy(source);

    const fallback = allStrategies.find((strategy) => String(strategy.id) === String(selectedStrategyId));
    return toOutputStrategy(fallback || null);
  }, [allStrategies, selectedStrategyId, strategySourceMap]);

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

  const removeStrategyFromFolders = (strategyId) => {
    const targetId = String(strategyId || '').trim();
    if (!targetId) return;

    setFolders((prev) =>
      prev.map((folder) => ({
        ...folder,
        strategies: folder.strategies.filter((strategy) => String(strategy.id) !== targetId),
      }))
    );
  };

  const handleDeleteStrategy = async (strategyId) => {
    const targetId = String(strategyId || '').trim();
    if (!targetId || deletingStrategyId === targetId) return;

    const strategyRef =
      strategySourceMap.get(targetId) ||
      allStrategies.find((strategy) => String(strategy.id) === targetId) ||
      null;

    const confirmed =
      typeof window === 'undefined' ? true : window.confirm('Delete this strategy?');
    if (!confirmed) return;

    setDeletingStrategyId(targetId);

    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;

      if (userId) {
        const strategyName = String(strategyRef?.name || '').trim();
        const strategyTicker = deriveTicker(strategyRef);

        // Delete by explicit row id when available.
        const dbRowId = strategyRef?.dbId || strategyRef?.supabaseId || strategyRef?.supabase_id;
        if (dbRowId) {
          await supabase
            .from('strategies')
            .delete()
            .eq('user_id', userId)
            .eq('id', dbRowId);
        }

        // Fallback delete by strategy identity used across app state.
        if (strategyName || strategyTicker) {
          let query = supabase
            .from('strategies')
            .delete()
            .eq('user_id', userId);

          if (strategyName) query = query.eq('name', strategyName);
          if (strategyTicker) query = query.eq('ticker', strategyTicker);

          await query;
        }
      }
    } catch (error) {
      console.warn('[TerminalStrategyWorkspace] Failed to delete strategy from Supabase:', error);
    } finally {
      removeStrategyFromFolders(targetId);
      if (String(selectedStrategyId || '') === targetId) {
        setSelectedStrategyId(null);
      }

      try {
        const fallbackRaw = JSON.parse(localStorage.getItem(SAVED_STRATEGIES_FALLBACK_KEY) || '[]');
        if (Array.isArray(fallbackRaw)) {
          const strategyName = String(strategyRef?.name || '').trim().toLowerCase();
          const strategyTicker = deriveTicker(strategyRef).toLowerCase();
          const nextFallback = fallbackRaw.filter((item) => {
            const itemId = String(item?.id || '').trim();
            if (itemId && itemId === targetId) return false;

            const itemName = String(item?.name || '').trim().toLowerCase();
            const itemTicker = deriveTicker(item).toLowerCase();
            if (strategyName && itemName !== strategyName) return true;
            if (strategyTicker && itemTicker !== strategyTicker) return true;
            return !(strategyName || strategyTicker);
          });
          localStorage.setItem(SAVED_STRATEGIES_FALLBACK_KEY, JSON.stringify(nextFallback));
        }
      } catch {}

      onDeleteStrategy?.(targetId);
      setDeletingStrategyId(null);
    }
  };

  return (
    <div className="h-full w-full bg-transparent flex overflow-hidden">
      <aside className={`${foldersCollapsed ? 'w-10' : 'w-[250px]'} shrink-0 border-r border-[#1f1f1f] bg-[#0b0b0b] flex flex-col transition-all duration-200`}>
        {foldersCollapsed ? (
          <div className="h-full flex flex-col items-center py-3">
            <button
              type="button"
              onClick={() => setFoldersCollapsed(false)}
              className="inline-flex items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900/50 p-1.5 text-zinc-400 transition-colors hover:text-white hover:border-zinc-500"
              title="Expand strategy folders"
              aria-label="Expand strategy folders"
            >
              <ChevronsRight className="h-4 w-4" strokeWidth={1.8} />
            </button>
          </div>
        ) : (
          <>
            <div className="px-4 py-4 border-b border-[#1f1f1f]">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold tracking-wide text-white">Strategy Folders</h2>
                  <p className="text-[11px] text-white/45 mt-0.5">{allStrategies.length} strategies</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShowNewFolder((prev) => !prev)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-2 py-1.5 text-[11px] font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/15"
                  >
                    <FolderPlus className="h-3.5 w-3.5" strokeWidth={1.8} />
                    New Folder
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewFolder(false);
                      setFoldersCollapsed(true);
                    }}
                    className="inline-flex items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900/50 p-1.5 text-zinc-400 transition-colors hover:text-white hover:border-zinc-500"
                    title="Collapse strategy folders"
                    aria-label="Collapse strategy folders"
                  >
                    <ChevronsLeft className="h-4 w-4" strokeWidth={1.8} />
                  </button>
                </div>
              </div>

              {showNewFolder && (
                <div className="mt-3 flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900/50 px-2 py-2">
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
                    className="flex-1 bg-transparent text-sm text-white placeholder:text-white/35 outline-none"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={createFolder}
                    disabled={!newFolderName.trim()}
                    className="rounded-md border border-emerald-500/35 bg-emerald-500/15 px-2 py-1 text-[11px] font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/20 disabled:opacity-40"
                  >
                    Add
                  </button>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-3" style={{ scrollbarWidth: 'none' }}>
              {folders.map((folder) => {
                const hasStrategies = folder.strategies.length > 0;

                return (
                  <div key={folder.id} className="mb-2">
                    <button
                      type="button"
                      onClick={() => toggleFolderExpanded(folder.id)}
                      className="w-full flex items-center gap-2 rounded-lg px-2 py-2 border border-transparent hover:border-zinc-700 hover:bg-zinc-900/40 transition-colors"
                    >
                      <ChevronRight
                        className={`h-3.5 w-3.5 text-white/50 transition-transform ${folder.isExpanded ? 'rotate-90' : ''}`}
                        strokeWidth={2}
                      />
                      {renderFolderIcon(folder.id)}
                      <span className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-white/90">
                        {folder.name}
                      </span>
                      <span className="rounded-md border border-zinc-700 bg-zinc-900/70 px-1.5 py-0.5 text-[10px] font-semibold text-white/55">
                        {folder.strategies.length}
                      </span>
                    </button>

                    {folder.isExpanded && (
                      <div className="ml-6 border-l border-zinc-800 pl-2">
                        {hasStrategies ? (
                          folder.strategies.map((strategy) => {
                            const id = String(strategy.id);
                            const isSelected = id === String(selectedStrategyId || '');
                            const profitText = formatProfit(strategy.profit);
                            const isLive = LIVE_STATUSES.has(String(strategy.status || '').toLowerCase());
                            const isDeleting = deletingStrategyId === id;
                            const displayTicker = normalizeTickerSymbol(strategy.ticker);

                            return (
                              <div key={id} className="group relative my-1">
                                <button
                                  type="button"
                                  onClick={() => setSelectedStrategyId(id)}
                                  className={`w-full text-left rounded-lg border px-2.5 py-2 pr-9 transition-colors ${
                                    isSelected
                                      ? 'border-emerald-500/45 bg-emerald-500/12'
                                      : 'border-transparent hover:border-zinc-700 hover:bg-zinc-900/40'
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                      <div className="truncate text-sm font-semibold text-white/95">
                                        {renderTickerText(strategy.name, `strategy-list-name-${id}`)}
                                      </div>
                                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                        {displayTicker && (
                                          <span className="rounded-md border border-emerald-500/35 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-400 font-semibold">
                                            ${displayTicker}
                                          </span>
                                        )}
                                        <span className="text-[10px] text-white/45">{formatDate(strategy.createdAt)}</span>
                                        {profitText && (
                                          <span
                                            className={`text-[11px] font-semibold ${
                                              strategy.profit >= 0 ? 'text-emerald-300' : 'text-rose-300'
                                            }`}
                                          >
                                            {profitText}
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    {isLive && <Play className="h-3.5 w-3.5 text-emerald-300 mt-0.5" strokeWidth={1.7} />}
                                  </div>
                                </button>

                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleDeleteStrategy(id);
                                  }}
                                  disabled={isDeleting}
                                  className="absolute right-2 top-2 inline-flex items-center justify-center rounded p-1 text-gray-600 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto hover:text-rose-300 transition-opacity disabled:opacity-60"
                                  aria-label={`Delete ${strategy.name}`}
                                  title="Delete strategy"
                                >
                                  <Trash2 className="h-3.5 w-3.5" strokeWidth={1.7} />
                                </button>
                              </div>
                            );
                          })
                        ) : (
                          <div className="py-2 text-[11px] italic text-white/35">No strategies yet</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </aside>

      <div className="flex-1 min-w-0 overflow-hidden">
        {selectedStrategy ? (
          <StrategyOutput
            strategy={selectedStrategy}
            onBack={() => setSelectedStrategyId(null)}
            onSave={(strategy) => {
              onSaveStrategy?.((prev) => upsertStrategy(prev, strategy));
            }}
            onContentSave={(strategy) => {
              onSaveStrategy?.((prev) => upsertStrategy(prev, strategy));
            }}
            onDeploy={(activation) => {
              onDeployStrategy?.({
                ...selectedStrategy,
                ...activation,
                id: selectedStrategy.id || `terminal-${Date.now()}`,
                name: selectedStrategy.name || 'Terminal Strategy',
                ticker: selectedStrategy.ticker || String(activation?.symbol || '').replace(/^\$/, ''),
                symbol: selectedStrategy.ticker || String(activation?.symbol || '').replace(/^\$/, ''),
                content: selectedStrategy.content || selectedStrategy.raw || '',
                summary: selectedStrategy.summary || {},
              });
            }}
            onRetest={(prompt) => {
              onRetestStrategy?.(prompt);
            }}
          />
        ) : (
          <div className="h-full flex items-center justify-center px-8 bg-transparent">
            <div className="text-center max-w-lg">
              <h2 className="text-2xl font-semibold text-white">Select a strategy or ask Sophia to build one</h2>
              <p className="mt-2 text-sm text-white/55">
                Choose a strategy from the folder list to review analysis, key trade setups, and activation details.
              </p>
              <button
                type="button"
                onClick={() => onOpenBuilder?.()}
                className="mt-5 rounded-xl border border-emerald-500/35 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/20"
              >
                Build Strategy
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TerminalStrategyWorkspace;
