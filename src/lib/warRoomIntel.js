const FEED_STORAGE_KEY = 'stratify-war-room-feed';
const SAVED_STORAGE_KEY = 'warroom_saved_intel';
const LEGACY_SAVED_LIST_KEY = 'stratify-war-room-saved';
const SAVED_EVENT = 'warroom-saved-intel-updated';

const DEFAULT_FOLDER_NAMES = ['Watchlist Intel', 'Earnings', 'Macro', 'Crypto', 'Custom'];

const toSafeString = (value, fallback = '') => String(value == null ? fallback : value).trim();

const slugify = (value = '') =>
  String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const makeFolderId = (name) => `${slugify(name) || 'folder'}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

const readJson = (key) => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const writeJson = (key, value) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
};

const normalizeSources = (sources) => {
  if (!Array.isArray(sources)) return [];

  return sources
    .map((source) => {
      if (typeof source === 'string') {
        const url = source.trim();
        if (!url) return null;
        return { url, title: url };
      }

      if (!source || typeof source !== 'object') return null;
      const url = toSafeString(source.url || source.href || source.link || '');
      if (!url) return null;
      const title = toSafeString(source.title || source.name || url, url);
      return { url, title };
    })
    .filter(Boolean);
};

export const normalizeIntelItem = (item = {}) => {
  const id = toSafeString(item.id) || `intel-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    title: toSafeString(item.title, 'Market Intel') || 'Market Intel',
    query: toSafeString(item.query),
    content: toSafeString(item.content),
    sources: normalizeSources(item.sources || item.citations),
    createdAt: item.createdAt || new Date().toISOString(),
    savedAt: item.savedAt || null,
    sourceLabel: toSafeString(item.sourceLabel || item.provider, 'Claude Intel') || 'Claude Intel',
  };
};

const normalizeFolder = (folder, index = 0) => {
  const name = toSafeString(folder?.name, `Folder ${index + 1}`) || `Folder ${index + 1}`;
  const id = toSafeString(folder?.id) || makeFolderId(name);
  const items = Array.isArray(folder?.items)
    ? folder.items.map(normalizeIntelItem).filter((item) => item.content)
    : [];

  const seen = new Set();
  const dedupedItems = items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });

  return {
    id,
    name,
    items: dedupedItems,
  };
};

const normalizeSavedPayload = (payload) => {
  const folders = Array.isArray(payload?.folders)
    ? payload.folders.map((folder, index) => normalizeFolder(folder, index))
    : [];

  if (folders.length > 0) {
    return { folders };
  }

  return {
    folders: DEFAULT_FOLDER_NAMES.map((name, index) => normalizeFolder({ name }, index)),
  };
};

const dispatchSavedEvent = () => {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(SAVED_EVENT));
  } catch {}
};

const writeSavedPayload = (payload) => {
  const normalized = normalizeSavedPayload(payload);
  writeJson(SAVED_STORAGE_KEY, normalized);
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(LEGACY_SAVED_LIST_KEY);
    } catch {}
  }
  dispatchSavedEvent();
  return normalized;
};

const migrateLegacySavedList = () => {
  const legacy = readJson(LEGACY_SAVED_LIST_KEY);
  if (!Array.isArray(legacy) || legacy.length === 0) return null;

  const customFolder = {
    id: slugify('Custom') || 'custom',
    name: 'Custom',
    items: legacy.map((item) => normalizeIntelItem({ ...item, savedAt: item.savedAt || new Date().toISOString() })),
  };

  const defaults = DEFAULT_FOLDER_NAMES
    .filter((name) => name !== 'Custom')
    .map((name, index) => normalizeFolder({ name }, index));

  return writeSavedPayload({
    folders: [...defaults, normalizeFolder(customFolder, defaults.length)],
  });
};

export const getSavedIntelState = () => {
  const saved = readJson(SAVED_STORAGE_KEY);
  if (saved && typeof saved === 'object' && Array.isArray(saved.folders)) {
    return normalizeSavedPayload(saved);
  }

  const migrated = migrateLegacySavedList();
  if (migrated) return migrated;

  return writeSavedPayload({ folders: [] });
};

export const setSavedIntelState = (payload) => writeSavedPayload(payload);

const findFolderIndex = (payload, folderRef) => {
  if (!payload || !Array.isArray(payload.folders)) return -1;
  const ref = toSafeString(folderRef);
  if (!ref) return -1;

  const byId = payload.folders.findIndex((folder) => folder.id === ref);
  if (byId >= 0) return byId;

  const lowered = ref.toLowerCase();
  return payload.folders.findIndex((folder) => folder.name.toLowerCase() === lowered);
};

const ensureFolder = (payload, folderRef = 'Custom') => {
  const current = normalizeSavedPayload(payload);
  const existingIndex = findFolderIndex(current, folderRef);
  if (existingIndex >= 0) {
    return { state: current, folder: current.folders[existingIndex], index: existingIndex };
  }

  const name = toSafeString(folderRef, 'Custom') || 'Custom';
  const newFolder = normalizeFolder({ id: makeFolderId(name), name, items: [] }, current.folders.length);
  const nextState = {
    ...current,
    folders: [...current.folders, newFolder],
  };

  return { state: nextState, folder: newFolder, index: nextState.folders.length - 1 };
};

export const createSavedIntelFolder = (name) => {
  const folderName = toSafeString(name);
  const current = getSavedIntelState();
  if (!folderName) {
    return { state: current, folder: null };
  }

  const existingIndex = findFolderIndex(current, folderName);
  if (existingIndex >= 0) {
    return { state: current, folder: current.folders[existingIndex] };
  }

  const folder = normalizeFolder({ id: makeFolderId(folderName), name: folderName, items: [] }, current.folders.length);
  const nextState = writeSavedPayload({
    ...current,
    folders: [...current.folders, folder],
  });

  return { state: nextState, folder };
};

export const renameSavedIntelFolder = (folderId, nextName) => {
  const current = getSavedIntelState();
  const targetId = toSafeString(folderId);
  const name = toSafeString(nextName);

  if (!targetId || !name) {
    return { state: current, folder: null };
  }

  const existingNameIndex = current.folders.findIndex(
    (folder) => folder.name.toLowerCase() === name.toLowerCase() && folder.id !== targetId
  );
  if (existingNameIndex >= 0) {
    return { state: current, folder: null, error: 'Folder name already exists' };
  }

  let updatedFolder = null;
  const nextState = writeSavedPayload({
    ...current,
    folders: current.folders.map((folder) => {
      if (folder.id !== targetId) return folder;
      updatedFolder = { ...folder, name };
      return updatedFolder;
    }),
  });

  return { state: nextState, folder: updatedFolder };
};

export const deleteSavedIntelFolder = (folderId) => {
  const current = getSavedIntelState();
  const targetId = toSafeString(folderId);
  if (!targetId) return { state: current, deleted: null };

  const targetFolder = current.folders.find((folder) => folder.id === targetId);
  if (!targetFolder) return { state: current, deleted: null };

  let nextFolders = current.folders.filter((folder) => folder.id !== targetId);
  if (nextFolders.length === 0) {
    nextFolders = DEFAULT_FOLDER_NAMES.map((name, index) => normalizeFolder({ name }, index));
  }

  if (targetFolder.items.length > 0) {
    const customIndex = nextFolders.findIndex((folder) => folder.name.toLowerCase() === 'custom');
    if (customIndex >= 0) {
      const existingIds = new Set(nextFolders[customIndex].items.map((item) => item.id));
      const mergedItems = [
        ...targetFolder.items.filter((item) => !existingIds.has(item.id)),
        ...nextFolders[customIndex].items,
      ];
      nextFolders = nextFolders.map((folder, index) =>
        index === customIndex ? { ...folder, items: mergedItems } : folder
      );
    } else {
      nextFolders = [...nextFolders, normalizeFolder({ name: 'Custom', items: targetFolder.items }, nextFolders.length)];
    }
  }

  const nextState = writeSavedPayload({ folders: nextFolders });
  return { state: nextState, deleted: targetFolder };
};

export const saveWarRoomIntel = (item, folderRef = 'Custom') => {
  const normalizedItem = normalizeIntelItem({
    ...item,
    savedAt: new Date().toISOString(),
  });

  const current = getSavedIntelState();
  const withoutDuplicates = {
    ...current,
    folders: current.folders.map((folder) => ({
      ...folder,
      items: folder.items.filter((entry) => entry.id !== normalizedItem.id),
    })),
  };

  const ensured = ensureFolder(withoutDuplicates, folderRef);
  const nextFolders = ensured.state.folders.map((folder) =>
    folder.id === ensured.folder.id
      ? { ...folder, items: [normalizedItem, ...folder.items].slice(0, 200) }
      : folder
  );

  const nextState = writeSavedPayload({ folders: nextFolders });
  const targetFolder = nextState.folders.find((folder) => folder.id === ensured.folder.id) || ensured.folder;

  return {
    state: nextState,
    folder: targetFolder,
    item: normalizedItem,
  };
};

export const moveSavedWarRoomIntel = (item, fromFolderId, toFolderRef) => {
  const current = getSavedIntelState();
  const sourceFolderId = toSafeString(fromFolderId);
  const targetRef = toSafeString(toFolderRef);
  if (!sourceFolderId || !targetRef) {
    return { state: current, folder: null, item: null };
  }

  const sourceFolder = current.folders.find((folder) => folder.id === sourceFolderId);
  if (!sourceFolder) {
    return { state: current, folder: null, item: null };
  }

  const sourceItem =
    sourceFolder.items.find((entry) => entry.id === toSafeString(item?.id)) ||
    (item ? normalizeIntelItem(item) : null);
  if (!sourceItem) {
    return { state: current, folder: null, item: null };
  }

  return saveWarRoomIntel(sourceItem, targetRef);
};

export const removeSavedWarRoomIntel = (itemId, folderId = null) => {
  const current = getSavedIntelState();
  const targetItemId = toSafeString(itemId);
  if (!targetItemId) return { state: current };

  const targetFolderId = toSafeString(folderId);
  const nextFolders = current.folders.map((folder) => {
    if (targetFolderId && folder.id !== targetFolderId) return folder;
    return {
      ...folder,
      items: folder.items.filter((item) => item.id !== targetItemId),
    };
  });

  const nextState = writeSavedPayload({ folders: nextFolders });
  return { state: nextState };
};

export const getSavedWarRoomIntel = () => {
  const state = getSavedIntelState();
  const seen = new Set();
  const flattened = [];

  state.folders.forEach((folder) => {
    folder.items.forEach((item) => {
      if (seen.has(item.id)) return;
      seen.add(item.id);
      flattened.push({ ...item, folderId: folder.id, folderName: folder.name });
    });
  });

  return flattened;
};

export const getWarRoomFeed = () => {
  const parsed = readJson(FEED_STORAGE_KEY);
  if (!Array.isArray(parsed)) return [];
  return parsed.map(normalizeIntelItem).filter((item) => item.content);
};

export const setWarRoomFeed = (items) => {
  const normalized = Array.isArray(items)
    ? items.map(normalizeIntelItem).filter((item) => item.content)
    : [];
  writeJson(FEED_STORAGE_KEY, normalized);
  return normalized;
};

export const WAR_ROOM_STORAGE_KEYS = {
  feed: FEED_STORAGE_KEY,
  saved: SAVED_STORAGE_KEY,
  legacySaved: LEGACY_SAVED_LIST_KEY,
};

export const WAR_ROOM_SAVED_EVENT = SAVED_EVENT;
