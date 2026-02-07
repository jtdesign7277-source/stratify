import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'stratify-strategies-store';
const VALID_STATUSES = new Set(['draft', 'backtested', 'deployed']);

const normalizeId = (value) => {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized ? normalized : null;
};

const normalizeString = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

const normalizeStatus = (value) => {
  const normalized = String(value ?? '').trim().toLowerCase();
  return VALID_STATUSES.has(normalized) ? normalized : 'draft';
};

const normalizeTimestamp = (value) => {
  if (Number.isFinite(value)) return value;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `strategy_${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

const normalizeStrategy = (strategy, { preserveMeta = false, now = Date.now() } = {}) => {
  if (!strategy || typeof strategy !== 'object') return null;

  const id = preserveMeta ? (normalizeId(strategy.id) ?? generateId()) : generateId();
  const name = normalizeString(strategy.name) || 'Untitled Strategy';
  const type = normalizeString(strategy.type) || 'Custom';
  const ticker = normalizeString(strategy.ticker ?? strategy.symbol ?? strategy.asset).toUpperCase();
  const indicator = normalizeString(strategy.indicator ?? strategy.signal ?? strategy.rule);
  const timeframe = normalizeString(strategy.timeframe ?? strategy.interval ?? strategy.period);
  const status = normalizeStatus(strategy.status);

  const createdAt = preserveMeta
    ? (normalizeTimestamp(strategy.createdAt ?? strategy.created_at ?? strategy.created ?? strategy.timestamp) ?? now)
    : now;
  const updatedAt = preserveMeta
    ? (normalizeTimestamp(strategy.updatedAt ?? strategy.updated_at ?? strategy.modifiedAt ?? strategy.lastUpdated) ?? createdAt)
    : now;

  let backtestedAt = preserveMeta
    ? normalizeTimestamp(strategy.backtestedAt ?? strategy.backtestAt ?? strategy.backtested_at)
    : null;
  let deployedAt = preserveMeta
    ? normalizeTimestamp(strategy.deployedAt ?? strategy.deployed_at ?? strategy.deployed)
    : null;

  if (status === 'backtested' && !backtestedAt) {
    backtestedAt = now;
  }
  if (status === 'deployed' && !deployedAt) {
    deployedAt = now;
  }

  const normalized = {
    id,
    name,
    type,
    ticker,
    indicator,
    timeframe,
    status,
    createdAt,
    updatedAt,
  };

  if (backtestedAt) normalized.backtestedAt = backtestedAt;
  if (deployedAt) normalized.deployedAt = deployedAt;

  if (strategy.results !== undefined) {
    normalized.results = strategy.results;
  } else if (strategy.backtestResults !== undefined) {
    normalized.results = strategy.backtestResults;
  }

  if (strategy.code !== undefined) {
    normalized.code = strategy.code;
  } else if (strategy.source !== undefined) {
    normalized.code = strategy.source;
  }

  return normalized;
};

const sanitizeStrategies = (list) => {
  if (!Array.isArray(list)) return [];
  const byId = new Map();

  list.forEach((item) => {
    const normalized = normalizeStrategy(item, { preserveMeta: true });
    if (!normalized) return;
    const existing = byId.get(normalized.id);
    if (!existing) {
      byId.set(normalized.id, normalized);
      return;
    }

    const existingUpdated = normalizeTimestamp(existing.updatedAt) ?? 0;
    const nextUpdated = normalizeTimestamp(normalized.updatedAt) ?? 0;
    if (nextUpdated >= existingUpdated) {
      byId.set(normalized.id, { ...existing, ...normalized, updatedAt: nextUpdated || existingUpdated });
    }
  });

  return Array.from(byId.values());
};

export const useStrategies = (initialStrategies = []) => {
  const [strategies, setStrategies] = useState(() => {
    const fallback = sanitizeStrategies(initialStrategies);
    if (typeof window === 'undefined') return fallback;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return fallback;
      const parsed = JSON.parse(stored);
      const list = Array.isArray(parsed) ? parsed : (parsed?.strategies ?? parsed?.items ?? []);
      const sanitized = sanitizeStrategies(list);
      return sanitized.length > 0 ? sanitized : fallback;
    } catch {
      return fallback;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(strategies));
    } catch {
      // Ignore storage write errors (private mode, quota, SSR).
    }
  }, [strategies]);

  const addStrategy = useCallback((strategy) => {
    const normalized = normalizeStrategy(strategy);
    if (!normalized) return null;
    setStrategies((prev) => [...prev, normalized]);
    return normalized;
  }, []);

  const updateStrategy = useCallback((id, updates = {}) => {
    const normalizedId = normalizeId(id ?? updates?.id);
    if (!normalizedId) return null;
    let updated = null;

    setStrategies((prev) => {
      let didUpdate = false;
      const now = Date.now();
      const next = prev.map((item) => {
        if (item.id !== normalizedId) return item;
        const merged = normalizeStrategy(
          { ...item, ...updates, id: item.id, createdAt: item.createdAt },
          { preserveMeta: true, now },
        );
        if (!merged) return item;

        const nextItem = {
          ...item,
          ...merged,
          updatedAt: now,
        };

        if (nextItem.status === 'backtested' && !nextItem.backtestedAt) {
          nextItem.backtestedAt = now;
        }
        if (nextItem.status === 'deployed' && !nextItem.deployedAt) {
          nextItem.deployedAt = now;
        }

        updated = nextItem;
        didUpdate = true;
        return nextItem;
      });

      return didUpdate ? next : prev;
    });

    return updated;
  }, []);

  const deployStrategy = useCallback(
    (id, payload = {}) => updateStrategy(id, { ...payload, status: 'deployed' }),
    [updateStrategy],
  );

  return {
    strategies,
    addStrategy,
    updateStrategy,
    deployStrategy,
  };
};

