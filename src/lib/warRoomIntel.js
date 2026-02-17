const FEED_STORAGE_KEY = 'stratify-war-room-feed';
const SAVED_STORAGE_KEY = 'stratify-war-room-saved';

const readJsonArray = (key) => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeJsonArray = (key, value) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(Array.isArray(value) ? value : []));
  } catch {}
};

const normalizeSources = (sources) => {
  if (!Array.isArray(sources)) return [];
  return sources
    .map((source) => {
      if (typeof source === 'string') return { url: source, title: source };
      if (!source || typeof source !== 'object') return null;
      const url = String(source.url || source.link || source.href || '').trim();
      const title = String(source.title || source.name || url || '').trim();
      if (!url) return null;
      return { url, title: title || url };
    })
    .filter(Boolean);
};

export const normalizeIntelItem = (item = {}) => {
  const id = String(item.id || `intel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  return {
    id,
    title: String(item.title || 'Market Intel').trim() || 'Market Intel',
    query: String(item.query || '').trim(),
    content: String(item.content || '').trim(),
    createdAt: item.createdAt || new Date().toISOString(),
    sourceLabel: String(item.sourceLabel || item.provider || 'Claude Intel'),
    sources: normalizeSources(item.sources || item.citations),
    savedAt: item.savedAt || null,
  };
};

export const getWarRoomFeed = () =>
  readJsonArray(FEED_STORAGE_KEY)
    .map(normalizeIntelItem)
    .filter((item) => item.content);

export const setWarRoomFeed = (items) => {
  const normalized = Array.isArray(items)
    ? items.map(normalizeIntelItem).filter((item) => item.content)
    : [];
  writeJsonArray(FEED_STORAGE_KEY, normalized);
  return normalized;
};

export const getSavedWarRoomIntel = () =>
  readJsonArray(SAVED_STORAGE_KEY)
    .map(normalizeIntelItem)
    .filter((item) => item.content);

export const saveWarRoomIntel = (item) => {
  const normalized = normalizeIntelItem({ ...item, savedAt: new Date().toISOString() });
  const existing = getSavedWarRoomIntel();
  const deduped = [normalized, ...existing.filter((entry) => entry.id !== normalized.id)].slice(0, 80);
  writeJsonArray(SAVED_STORAGE_KEY, deduped);
  return deduped;
};

export const removeSavedWarRoomIntel = (itemId) => {
  const targetId = String(itemId || '').trim();
  if (!targetId) return getSavedWarRoomIntel();
  const next = getSavedWarRoomIntel().filter((item) => item.id !== targetId);
  writeJsonArray(SAVED_STORAGE_KEY, next);
  return next;
};

export const WAR_ROOM_STORAGE_KEYS = {
  feed: FEED_STORAGE_KEY,
  saved: SAVED_STORAGE_KEY,
};
