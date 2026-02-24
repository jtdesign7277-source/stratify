import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ChevronsLeft, ChevronsRight, Pencil, Save as SaveIcon } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { formatTickersAsHtml, normalizeTickerSymbol, tokenizeTickerText, withDollarTickers } from '../../lib/tickerStyling';

const FIELD_LABELS = ['Entry Signal', 'Volume', 'Trend', 'Risk/Reward', 'Stop Loss', '$ Allocation'];
const FIELD_KEYS = ['entry', 'volume', 'trend', 'riskReward', 'stopLoss', 'allocation'];
const CENTER_SETUP_LABELS = ['Entry Signal', 'Volume', 'Trend', 'Risk/Reward', 'Stop Loss', '$ Allocation'];
const CENTER_SETUP_FIELD_INDEXES = [0, 1, 2, 3, 4, 5];
const SAVED_STRATEGIES_FALLBACK_KEY = 'stratify-saved-strategies-fallback';
const STRATEGY_FOLDERS_STORAGE_KEY = 'stratify-strategies-folders';
const TERMINAL_STRATEGY_SAVE_EVENT = 'stratify:terminal-strategy-saved';
const DEFAULT_SAVE_FOLDERS = [
  { id: 'stratify', name: 'STRATIFY' },
  { id: 'active-strategies', name: 'Active Strategies' },
  { id: 'favorites', name: 'Favorites' },
  { id: 'sophia-strategies', name: 'Sophia Strategies' },
  { id: 'archive', name: 'Archive' },
];
const DEFAULT_STORAGE_FOLDERS = DEFAULT_SAVE_FOLDERS.map((folder) => ({
  ...folder,
  isExpanded: folder.id !== 'archive',
  strategies: [],
}));
const REAL_TRADE_ANALYSIS_REGEX = /real\s+trade\s+analysis/i;
const KEY_SETUPS_IDENTIFIED_REGEX = /key[\w\s\[\]-]*setups\s+identified/i;
const REAL_TRADE_ANALYSIS_TEMPLATE = [
  '## ⚡ Real Trade Analysis (1M Lookbook)',
  '',
  '**Key Setups Identified:**',
  '',
  '**🏆 Winner - [Date] [Setup]:**',
  '- **Entry:** $[price] at [time] ([reason])',
  '- **Exit:** $[price] ([result])',
  '- **Shares:** [count] shares',
  '- **Profit:** +$[amount] ✅',
].join('\n');

const formatTickerWithDollar = (ticker) => {
  const clean = normalizeTickerSymbol(ticker);
  return clean ? `$${clean}` : '';
};

const normalizeFolderOptions = (rawFolders = []) => {
  if (!Array.isArray(rawFolders)) return DEFAULT_SAVE_FOLDERS;

  const options = rawFolders
    .map((folder, index) => {
      const id = String(folder?.id || '').trim();
      const name = String(folder?.name || '').trim();
      if (!id || !name) return null;
      return { id, name, sort: index };
    })
    .filter(Boolean);

  if (options.length === 0) return DEFAULT_SAVE_FOLDERS;

  options.sort((a, b) => a.sort - b.sort);
  return options.map(({ id, name }) => ({ id, name }));
};

const loadStrategyFolderOptions = () => {
  if (typeof window === 'undefined') return DEFAULT_SAVE_FOLDERS;

  try {
    const raw = localStorage.getItem(STRATEGY_FOLDERS_STORAGE_KEY);
    if (!raw) return DEFAULT_SAVE_FOLDERS;
    const parsed = JSON.parse(raw);
    const source = Array.isArray(parsed?.folders) ? parsed.folders : Array.isArray(parsed) ? parsed : [];
    return normalizeFolderOptions(source);
  } catch {
    return DEFAULT_SAVE_FOLDERS;
  }
};

const sanitizeStrategyId = (value) => {
  const id = String(value ?? '').trim();
  if (!id || id === 'undefined' || id === 'null' || id === 'NaN') return '';
  return id;
};

const normalizeFolderStorage = (raw) => {
  const source = Array.isArray(raw?.folders)
    ? raw.folders
    : Array.isArray(raw)
      ? raw
      : [];

  const byId = new Map();
  source.forEach((folder) => {
    const id = String(folder?.id || '').trim();
    const name = String(folder?.name || '').trim();
    if (!id || !name) return;
    byId.set(id, {
      id,
      name,
      isExpanded: folder?.isExpanded !== false,
      strategies: Array.isArray(folder?.strategies) ? folder.strategies.filter(Boolean) : [],
    });
  });

  const folders = DEFAULT_STORAGE_FOLDERS.map((defaultFolder) => {
    const existing = byId.get(defaultFolder.id);
    if (!existing) return { ...defaultFolder, strategies: [] };
    byId.delete(defaultFolder.id);
    return {
      ...defaultFolder,
      name: existing.name || defaultFolder.name,
      isExpanded: existing.isExpanded,
      strategies: existing.strategies,
    };
  });
  byId.forEach((folder) => folders.push(folder));

  const seen = new Set();
  return {
    folders: folders.map((folder) => ({
      ...folder,
      strategies: folder.strategies.filter((item) => {
        const id = sanitizeStrategyId(item?.id);
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
      }),
    })),
  };
};

const upsertStrategyIntoFolderStorage = (strategyPayload, fallbackFolderId = 'stratify') => {
  if (typeof window === 'undefined' || !strategyPayload || typeof strategyPayload !== 'object') return;

  const strategyId = sanitizeStrategyId(strategyPayload.id);
  if (!strategyId) return;

  const folderId = String(
    strategyPayload.folderId || strategyPayload.folder_id || fallbackFolderId || 'stratify'
  ).trim() || 'stratify';

  const ticker = String(
    strategyPayload.ticker ||
      strategyPayload.symbol ||
      strategyPayload.summary?.ticker ||
      strategyPayload.symbols?.[0] ||
      ''
  )
    .replace(/^\$/, '')
    .trim()
    .toUpperCase();

  const nextEntry = {
    id: strategyId,
    name: String(strategyPayload.name || 'Untitled Strategy'),
    ticker,
    createdAt: strategyPayload.savedAt || strategyPayload.createdAt || Date.now(),
    profit: Number(
      strategyPayload.profit ??
      strategyPayload.returnPercent ??
      strategyPayload.returnPct ??
      strategyPayload.summary?.returnPercent ??
      strategyPayload.summary?.returnPct ??
      0
    ) || 0,
    isStarred: Boolean(strategyPayload.isStarred),
    status: String(strategyPayload.status || strategyPayload.runStatus || 'saved').toLowerCase(),
  };

  try {
    const currentRaw = localStorage.getItem(STRATEGY_FOLDERS_STORAGE_KEY);
    const currentParsed = currentRaw ? JSON.parse(currentRaw) : { folders: [] };
    const normalized = normalizeFolderStorage(currentParsed);

    const folders = normalized.folders.map((folder) => ({
      ...folder,
      strategies: folder.strategies.filter((strategy) => sanitizeStrategyId(strategy?.id) !== strategyId),
    }));

    const targetFolder = folders.find((folder) => folder.id === folderId)
      || folders.find((folder) => folder.id === 'stratify')
      || folders[0];
    if (!targetFolder) return;

    targetFolder.strategies.unshift(nextEntry);
    localStorage.setItem(STRATEGY_FOLDERS_STORAGE_KEY, JSON.stringify({ folders }));
  } catch (error) {
    console.warn('[StrategyOutput] Failed to update folder storage:', error);
  }
};

const emitTerminalStrategySave = (strategyPayload) => {
  if (typeof window === 'undefined' || !strategyPayload) return;
  try {
    window.dispatchEvent(new CustomEvent(TERMINAL_STRATEGY_SAVE_EVENT, { detail: strategyPayload }));
  } catch {}
};

const normalizeSetupHeading = (line = '') =>
  String(line)
    .replace(/^#{1,6}\s*/, '')
    .replace(/^[\-\*•●]\s*/, '')
    .replace(/\*\*/g, '')
    .trim()
    .toLowerCase();

const isKeyTradeSetupsHeading = (line = '') => {
  const normalized = normalizeSetupHeading(line).replace(/^🔥\s*/, '').trim();
  return normalized === 'key trade setups' || normalized === 'key trade setups identified';
};

function splitKeyTradeSetupsSection(raw) {
  const text = String(raw || '');
  const lines = text.split('\n');
  let sectionStart = -1;

  for (let i = 0; i < lines.length; i += 1) {
    if (isKeyTradeSetupsHeading(lines[i])) sectionStart = i;
  }

  if (sectionStart < 0) {
    return {
      body: text.trimEnd(),
      sectionLines: [],
      hasSection: false,
    };
  }

  let sectionEnd = lines.length;
  for (let i = sectionStart + 1; i < lines.length; i += 1) {
    if (/^\s*#{1,6}\s+/.test(lines[i]) && !isKeyTradeSetupsHeading(lines[i])) {
      sectionEnd = i;
      break;
    }
  }

  return {
    body: [...lines.slice(0, sectionStart), ...lines.slice(sectionEnd)].join('\n').trimEnd(),
    sectionLines: lines.slice(sectionStart + 1, sectionEnd),
    hasSection: true,
  };
}

const stripSetupBulletPrefix = (line = '') => String(line).replace(/^\s*[\-\*•●]\s*/, '').trim();

function extractCenterSetupValues(values = []) {
  return CENTER_SETUP_FIELD_INDEXES.map((fieldIndex) => String(values[fieldIndex] ?? '').trim());
}

function mergeCenterValuesIntoFieldValues(fieldValues = [], centerValues = []) {
  const next = [...fieldValues];
  CENTER_SETUP_FIELD_INDEXES.forEach((fieldIndex, centerIndex) => {
    const value = String(centerValues[centerIndex] ?? '').trim();
    if (value) next[fieldIndex] = value;
  });
  return next;
}

function parseKeyTradeSetupValuesFromLines(lines = []) {
  const valuesByLabel = new Map();
  const normalizeLabel = (label = '') => String(label).toLowerCase().replace(/[^a-z]/g, '');
  const resolveLabelKey = (label = '') => {
    const normalized = normalizeLabel(label);
    if (normalized.includes('entry')) return 'entrysignal';
    if (normalized.includes('volume')) return 'volume';
    if (normalized.includes('trend')) return 'trend';
    if (normalized.includes('risk') && normalized.includes('reward')) return 'riskreward';
    if (normalized.includes('stop') && normalized.includes('loss')) return 'stoploss';
    if (normalized.includes('allocation') || normalized === 'amount' || normalized.includes('positionsize')) return 'allocation';
    return normalized;
  };

  lines.forEach((line) => {
    const normalized = stripSetupBulletPrefix(line).replace(/\*\*/g, '');
    const separatorIndex = normalized.indexOf(':');
    if (separatorIndex < 0) return;

    const rawLabel = normalized.slice(0, separatorIndex).trim().toLowerCase();
    const rawValue = normalized.slice(separatorIndex + 1).replace(/\*\*/g, '').trim();
    if (!rawLabel) return;

    valuesByLabel.set(resolveLabelKey(rawLabel), rawValue);
  });

  return CENTER_SETUP_LABELS.map((label) => valuesByLabel.get(resolveLabelKey(label)) || '');
}

function buildKeyTradeSetupsSection(values = []) {
  const lines = ['🔥 Key Trade Setups Identified'];

  CENTER_SETUP_LABELS.forEach((label, index) => {
    const value = withDollarTickers(String(values[index] ?? '').trim()) || '—';
    lines.push(`● ${label}: ${value}`);
  });

  return lines.join('\n');
}

function ensureRealTradeAnalysisSection(raw, fallbackValues = []) {
  const normalizedRaw = String(raw || '').trimEnd();
  const { body, sectionLines, hasSection } = splitKeyTradeSetupsSection(normalizedRaw);
  const bodyText = String(body || '').trimEnd();
  const hasAnalysisSection =
    REAL_TRADE_ANALYSIS_REGEX.test(bodyText) || KEY_SETUPS_IDENTIFIED_REGEX.test(bodyText);
  const nextBody = hasAnalysisSection
    ? bodyText
    : bodyText
      ? `${bodyText}\n\n${REAL_TRADE_ANALYSIS_TEMPLATE}`
      : REAL_TRADE_ANALYSIS_TEMPLATE;

  if (!hasSection) return nextBody;

  const parsedValues = parseKeyTradeSetupValuesFromLines(sectionLines);
  const fallbackCenterValues = extractCenterSetupValues(fallbackValues);
  const mergedValues = CENTER_SETUP_LABELS.map((_, index) => {
    const parsed = String(parsedValues[index] ?? '').trim();
    if (parsed) return parsed;
    const fallback = String(fallbackCenterValues[index] ?? '').trim();
    return fallback || '—';
  });

  return `${nextBody}\n\n${buildKeyTradeSetupsSection(mergedValues)}`.trim();
}

function ensureKeyTradeSetupsSection(raw, fallbackValues = []) {
  const { body, sectionLines } = splitKeyTradeSetupsSection(raw);
  const parsedValues = parseKeyTradeSetupValuesFromLines(sectionLines);
  const fallbackCenterValues = extractCenterSetupValues(fallbackValues);
  const mergedValues = CENTER_SETUP_LABELS.map((_, index) => {
    const parsed = String(parsedValues[index] ?? '').trim();
    if (parsed) return parsed;
    const fallback = String(fallbackCenterValues[index] ?? '').trim();
    return fallback || '—';
  });

  const section = buildKeyTradeSetupsSection(mergedValues);
  const trimmedBody = String(body || '').trimEnd();

  return {
    raw: trimmedBody ? `${trimmedBody}\n\n${section}` : section,
    values: mergedValues,
  };
}

function applyKeyTradeSetupsSection(raw, values = []) {
  const { body } = splitKeyTradeSetupsSection(raw);
  const sourceValues = values.length === CENTER_SETUP_LABELS.length ? values : extractCenterSetupValues(values);
  const mergedValues = CENTER_SETUP_LABELS.map((_, index) => withDollarTickers(String(sourceValues[index] ?? '').trim()) || '—');
  const section = buildKeyTradeSetupsSection(mergedValues);
  const trimmedBody = String(body || '').trimEnd();
  return trimmedBody ? `${trimmedBody}\n\n${section}` : section;
}

function normalizeEditorContent(raw) {
  const normalizeInvisible = (value = '') =>
    String(value)
      .replace(/\u00A0/g, ' ')
      .replace(/[\u200B-\u200D\uFEFF]/g, '');

  const text = normalizeInvisible(String(raw ?? '')).replace(/\r\n/g, '\n');
  const lines = text.split('\n').map((line) => normalizeInvisible(line));
  const compact = [];
  let blankRun = 0;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.trim()) {
      blankRun += 1;
      if (blankRun <= 1) compact.push('');
    } else {
      blankRun = 0;
      compact.push(line);
    }
  }

  while (compact.length > 1 && !String(compact[compact.length - 1] || '').trim()) {
    compact.pop();
  }

  return compact.join('\n').trimEnd();
}

function extractPerformanceData(strategy = {}) {
  const raw = String(strategy.raw || '');
  const findMetric = (pattern) => raw.match(pattern)?.[1]?.trim() || '';

  return {
    backtestValue: strategy.value || '',
    totalReturn: findMetric(/(?:total\s+return|return|roi)\s*[:\-]\s*([^\n]+)/i),
    netProfit: findMetric(/(?:net\s+profit|profit|p\/l)\s*[:\-]\s*([^\n]+)/i),
    winRate: findMetric(/(?:win\s+rate)\s*[:\-]\s*([^\n]+)/i),
  };
}

function parseMarkdown(raw) {
  if (!raw) return '';
  const lines = raw.split('\n');
  const html = [];
  let inKeyTradeSetups = false;

  lines.forEach((line) => {
    const trimmed = line.trim();

    // Horizontal rules
    if (/^[-*_]{3,}$/.test(trimmed)) {
      inKeyTradeSetups = false;
      html.push('<hr class="border-[#1f1f1f] my-4" />');
      return;
    }

    // H2
    if (line.startsWith('## ')) {
      const heading = line.slice(3).trim();
      if (isKeyTradeSetupsHeading(heading)) {
        inKeyTradeSetups = true;
        html.push('<h2 class="text-emerald-400 text-lg font-bold mt-8 mb-4">🔥 Key Trade Setups Identified</h2>');
      } else {
        inKeyTradeSetups = false;
        html.push(`<h2 class="text-emerald-400 text-lg font-bold mt-6 mb-2">${formatInline(heading)}</h2>`);
      }
      return;
    }

    // H3
    if (line.startsWith('### ')) {
      inKeyTradeSetups = false;
      html.push(`<h3 class="text-emerald-400 text-base font-semibold mt-4 mb-1">${formatInline(line.slice(4))}</h3>`);
      return;
    }

    // Plain heading without markdown marker
    if (isKeyTradeSetupsHeading(line)) {
      inKeyTradeSetups = true;
      html.push('<h2 class="text-emerald-400 text-lg font-bold mt-8 mb-4">🔥 Key Trade Setups Identified</h2>');
      return;
    }

    // Code blocks (simple single-line)
    if (line.startsWith('```')) return;

    // Empty line
    if (!trimmed) {
      html.push('<div class="h-2"></div>');
      return;
    }

    // Key setup section lines with larger spacing and bold labels
    if (inKeyTradeSetups) {
      const content = stripSetupBulletPrefix(trimmed).replace(/\*\*/g, '');
      const separatorIndex = content.indexOf(':');
      if (separatorIndex >= 0) {
        const label = content.slice(0, separatorIndex).trim();
        const value = content.slice(separatorIndex + 1).trim() || '—';
        html.push(
          `<div class="mb-6 flex gap-2 ml-2"><span class="text-emerald-400 mt-0.5">●</span><p class="text-sm leading-relaxed whitespace-normal break-words"><strong class="text-white font-semibold">${formatInline(label)}:</strong> <span class="text-emerald-400">${formatInline(value)}</span></p></div>`
        );
        return;
      }
    }

    // Bullet points
    if (/^\s*[-*]\s/.test(line)) {
      const content = line.replace(/^\s*[-*]\s/, '');
      html.push(`<div class="flex gap-2 ml-2 my-0.5"><span class="text-zinc-500">•</span><span>${formatInline(content)}</span></div>`);
      return;
    }

    // Color coding
    let extraClass = '';
    const lower = line.toLowerCase();
    if (lower.includes('profit') || /\+\d/.test(line)) extraClass = ' text-emerald-400';
    else if (lower.includes('loss') || /(?<!\w)-\d/.test(line)) extraClass = ' text-red-400';

    html.push(`<p class="my-0.5${extraClass}">${formatInline(line)}</p>`);
  });

  return html.join('');
}

function formatInline(text) {
  text = String(text ?? '');
  // Bold
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>');
  // Inline code
  text = text.replace(/`([^`]+)`/g, '<code class="bg-[#1a1a1a] px-1.5 py-0.5 rounded text-emerald-300 text-sm">$1</code>');
  return formatTickersAsHtml(text);
}

function renderTickerText(text, keyPrefix = 'ticker') {
  return tokenizeTickerText(text).map((token, index) =>
    token.type === 'ticker' ? (
      <span key={`${keyPrefix}-${index}`} className="text-emerald-400 font-semibold">
        {token.value}
      </span>
    ) : (
      <React.Fragment key={`${keyPrefix}-${index}`}>{token.value}</React.Fragment>
    )
  );
}

export default function StrategyOutput({
  strategy,
  onSave,
  onSaveToSophia,
  onDeploy,
  onBack,
  onOpenFolders,
  onRetest,
  onContentSave,
  showSaveToSophiaButton = false,
  availableFolders = null,
  currentFolderId = '',
}) {
  const s = strategy || {};
  const storageKey = `stratify-activation-${s.id || s.generatedAt || s.name || 'default'}`;
  const defaultFieldValues = useMemo(
    () => FIELD_KEYS.map((key) => (s?.[key] != null ? String(s[key]) : '')),
    [s.entry, s.volume, s.trend, s.riskReward, s.stopLoss, s.allocation],
  );
  const fallbackStrategyName = useMemo(() => {
    const rawName = String(s.name || '').trim();
    return rawName || 'Strategy';
  }, [s.name]);

  const resolvePreferredFolderId = (folders) => {
    const folderIds = new Set((folders || []).map((folder) => String(folder.id || '').trim()).filter(Boolean));
    const candidates = [
      String(currentFolderId || '').trim(),
      String(s.folderId || s.folder_id || '').trim(),
    ].filter(Boolean);

    if (String(s.folder || '').trim().toLowerCase() === 'sophia') {
      candidates.push('sophia-strategies');
    }

    candidates.push('stratify');

    for (const candidate of candidates) {
      if (folderIds.has(candidate)) return candidate;
    }
    return (folders || [])[0]?.id || 'stratify';
  };

  const [saveFolderOptions, setSaveFolderOptions] = useState(() => {
    const fromProps = normalizeFolderOptions(availableFolders);
    if (Array.isArray(availableFolders) && availableFolders.length > 0) {
      return fromProps;
    }
    return loadStrategyFolderOptions();
  });
  const [saveFolderId, setSaveFolderId] = useState(() => {
    const fromProps = normalizeFolderOptions(availableFolders);
    const baseFolders = Array.isArray(availableFolders) && availableFolders.length > 0
      ? fromProps
      : loadStrategyFolderOptions();
    return resolvePreferredFolderId(baseFolders);
  });
  const [strategyName, setStrategyName] = useState(fallbackStrategyName);
  const [isEditingName, setIsEditingName] = useState(false);
  const [strategyNameDraft, setStrategyNameDraft] = useState(fallbackStrategyName);

  // Key Trade Setups checkboxes
  const [checks, setChecks] = useState(Array(6).fill(false));
  const [fieldValues, setFieldValues] = useState(defaultFieldValues);
  const [saved, setSaved] = useState(false);
  const [saveStatus, setSaveStatus] = useState('idle');

  const [cardsCollapsed, setCardsCollapsed] = useState(false);
  const [strategyRaw, setStrategyRaw] = useState(() =>
    normalizeEditorContent(ensureKeyTradeSetupsSection(String(s.raw || ''), defaultFieldValues).raw)
  );
  const [isEditingStrategyText, setIsEditingStrategyText] = useState(false);
  const [editorValue, setEditorValue] = useState(() =>
    normalizeEditorContent(ensureKeyTradeSetupsSection(String(s.raw || ''), defaultFieldValues).raw)
  );
  const [isSavingEditor, setIsSavingEditor] = useState(false);
  const [isEditorModified, setIsEditorModified] = useState(false);
  const [showEditorSavedNotice, setShowEditorSavedNotice] = useState(false);
  const [isSavingToSophia, setIsSavingToSophia] = useState(false);
  const [savedToSophia, setSavedToSophia] = useState(Boolean(s.savedToSophia));
  const strategyNameInputRef = useRef(null);
  const editorTextareaRef = useRef(null);
  const editorSavedNoticeTimeoutRef = useRef(null);

  useEffect(() => {
    const nextOptions = Array.isArray(availableFolders) && availableFolders.length > 0
      ? normalizeFolderOptions(availableFolders)
      : loadStrategyFolderOptions();

    setSaveFolderOptions(nextOptions);
    setSaveFolderId((prev) => {
      const current = String(prev || '').trim();
      if (nextOptions.some((folder) => folder.id === current)) return current;
      return resolvePreferredFolderId(nextOptions);
    });
  }, [availableFolders, currentFolderId, s.folderId, s.folder_id, s.folder]);

  useEffect(() => {
    if (Array.isArray(availableFolders) && availableFolders.length > 0) return undefined;
    if (typeof window === 'undefined') return undefined;

    const syncFromStorage = () => {
      const nextOptions = loadStrategyFolderOptions();
      setSaveFolderOptions(nextOptions);
      setSaveFolderId((prev) => {
        const current = String(prev || '').trim();
        if (nextOptions.some((folder) => folder.id === current)) return current;
        return resolvePreferredFolderId(nextOptions);
      });
    };

    const handleStorage = (event) => {
      if (event?.key && event.key !== STRATEGY_FOLDERS_STORAGE_KEY) return;
      syncFromStorage();
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('focus', syncFromStorage);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('focus', syncFromStorage);
    };
  }, [availableFolders, currentFolderId, s.folderId, s.folder_id, s.folder]);

  useEffect(() => {
    if (!isEditingName) return;
    const timeoutId = setTimeout(() => {
      strategyNameInputRef.current?.focus();
      strategyNameInputRef.current?.select();
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [isEditingName]);

  // Load from localStorage
  useEffect(() => {
    const fallbackChecks = Array(6).fill(false);
    let nextFieldValues = defaultFieldValues;
    let nextChecks = fallbackChecks;
    let nextSaved = false;
    let nextStrategyRaw = String(s.raw || '');
    let nextStrategyName = fallbackStrategyName;
    let nextFolderId = resolvePreferredFolderId(saveFolderOptions);

    try {
      const stored = JSON.parse(localStorage.getItem(storageKey));
      if (stored) {
        if (Array.isArray(stored.fieldValues) && stored.fieldValues.length === FIELD_LABELS.length) {
          nextFieldValues = stored.fieldValues;
        } else if (stored.allocation) {
          nextFieldValues = [...defaultFieldValues];
          nextFieldValues[5] = String(stored.allocation);
        }
        if (stored.checks) nextChecks = stored.checks;
        if (stored.saved) nextSaved = stored.saved;
        if (typeof stored.editedRaw === 'string') nextStrategyRaw = stored.editedRaw;
        if (typeof stored.strategyName === 'string' && stored.strategyName.trim()) {
          nextStrategyName = stored.strategyName.trim();
        }
        if (typeof stored.folderId === 'string' && stored.folderId.trim()) {
          nextFolderId = stored.folderId.trim();
        }
      }
    } catch {}

    const ensured = ensureKeyTradeSetupsSection(nextStrategyRaw, nextFieldValues);
    nextStrategyRaw = normalizeEditorContent(ensured.raw);
    nextFieldValues = mergeCenterValuesIntoFieldValues(nextFieldValues, ensured.values);

    setFieldValues(nextFieldValues);
    setChecks(nextChecks);
    setSaved(nextSaved);
    setSaveStatus(nextSaved ? 'saved' : 'idle');
    setStrategyRaw(nextStrategyRaw);
    setEditorValue(nextStrategyRaw);
    setIsEditorModified(false);
    setShowEditorSavedNotice(false);
    setIsEditingStrategyText(false);
    setIsSavingEditor(false);
    setIsSavingToSophia(false);
    setSavedToSophia(Boolean(s.savedToSophia));
    setStrategyName(nextStrategyName);
    setStrategyNameDraft(nextStrategyName);
    setIsEditingName(false);
    setSaveFolderId(
      saveFolderOptions.some((folder) => folder.id === nextFolderId)
        ? nextFolderId
        : resolvePreferredFolderId(saveFolderOptions)
    );
    setEditing(null);
    setEditValue('');
  }, [storageKey, defaultFieldValues, fallbackStrategyName, s.raw, s.savedToSophia, saveFolderOptions]);

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify({
      checks,
      fieldValues,
      allocation: fieldValues[5],
      saved,
      editedRaw: strategyRaw,
      strategyName,
      folderId: saveFolderId,
    }));
  }, [checks, fieldValues, saved, strategyRaw, strategyName, saveFolderId, storageKey]);

  useEffect(() => () => {
    if (editorSavedNoticeTimeoutRef.current) {
      clearTimeout(editorSavedNoticeTimeoutRef.current);
    }
  }, []);

  useEffect(() => {
    if (!isEditingStrategyText) return;
    const timeoutId = setTimeout(() => {
      if (editorTextareaRef.current) {
        editorTextareaRef.current.scrollTop = 0;
        editorTextareaRef.current.scrollLeft = 0;
      }
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [isEditingStrategyText]);

  const checkedCount = checks.filter(Boolean).length;
  const deployReady = checks.every(Boolean);

  const [editing, setEditing] = useState(null);
  const [editValue, setEditValue] = useState('');

  const toggleCheck = (i) => setChecks((p) => p.map((v, j) => (j === i ? !v : v)));

  const updateFieldValue = (index, value, options = {}) => {
    const { syncEditor = false } = options;
    const normalizedValue = withDollarTickers(String(value ?? '').trim());
    setFieldValues((prev) => {
      const next = [...prev];
      next[index] = normalizedValue;
      if (isEditingStrategyText || syncEditor) {
        setEditorValue((currentEditorRaw) => {
          const sourceRaw = normalizeEditorContent(currentEditorRaw || strategyRaw || s.raw || '');
          const updatedRaw = normalizeEditorContent(applyKeyTradeSetupsSection(sourceRaw, next));
          setIsEditorModified(updatedRaw !== String(strategyRaw || ''));
          return updatedRaw;
        });
      } else {
        setStrategyRaw((currentRaw) => normalizeEditorContent(applyKeyTradeSetupsSection(currentRaw || s.raw || '', next)));
      }
      return next;
    });
  };

  const startEdit = (i, val) => {
    setEditing(i);
    setEditValue(val || '');
  };
  const commitEdit = (i) => {
    updateFieldValue(i, editValue);
    setEditing(null);
    setEditValue('');
  };

  const renderedMarkdown = useMemo(
    () => parseMarkdown(strategyRaw || s.raw),
    [strategyRaw, s.raw],
  );
  const displayTicker = formatTickerWithDollar(s.ticker) || '—';
  const saveButtonLabel = saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved ✓' : 'Save';
  const editorSetupValues = useMemo(
    () => ensureKeyTradeSetupsSection(editorValue, fieldValues).values,
    [editorValue, fieldValues],
  );
  const activeFieldValues = useMemo(
    () => (
      isEditingStrategyText
        ? mergeCenterValuesIntoFieldValues(fieldValues, editorSetupValues)
        : fieldValues
    ),
    [isEditingStrategyText, fieldValues, editorSetupValues],
  );
  const fields = FIELD_LABELS.map((label, i) => ({
    label,
    value: activeFieldValues[i] || '',
  }));
  const normalizedStrategyName = String(strategyName || '').trim() || 'Strategy';
  const resolvedFolderId = saveFolderOptions.some((folder) => folder.id === saveFolderId)
    ? saveFolderId
    : resolvePreferredFolderId(saveFolderOptions);
  const selectedFolderName =
    saveFolderOptions.find((folder) => folder.id === resolvedFolderId)?.name || 'STRATIFY';
  const payloadFolderName =
    resolvedFolderId === 'sophia-strategies' ? 'sophia' : selectedFolderName;
  const payloadSource =
    resolvedFolderId === 'sophia-strategies'
      ? 'sophia'
      : (String(s.source || '').trim() || 'terminal');

  const startNameEdit = () => {
    setStrategyNameDraft(normalizedStrategyName);
    setIsEditingName(true);
  };

  const cancelNameEdit = () => {
    setStrategyNameDraft(normalizedStrategyName);
    setIsEditingName(false);
  };

  const commitNameEdit = () => {
    const nextName = String(strategyNameDraft || '').trim() || 'Strategy';
    setStrategyName(nextName);
    setStrategyNameDraft(nextName);
    setIsEditingName(false);
  };

  const updateEditorValue = (nextValue) => {
    const normalized = String(nextValue ?? '');
    setEditorValue(normalized);
    setIsEditorModified(normalized !== String(strategyRaw || ''));
    setShowEditorSavedNotice(false);
  };

  const resetEditorScroll = () => {
    requestAnimationFrame(() => {
      if (editorTextareaRef.current) {
        editorTextareaRef.current.scrollTop = 0;
        editorTextareaRef.current.scrollLeft = 0;
      }
    });
  };

  const openEditor = () => {
    const nextRaw = normalizeEditorContent(strategyRaw || s.raw || '');
    setEditorValue(nextRaw);
    setIsEditorModified(false);
    setShowEditorSavedNotice(false);
    setIsEditingStrategyText(true);
    resetEditorScroll();
  };

  const cancelEditor = () => {
    const nextRaw = normalizeEditorContent(strategyRaw || s.raw || '');
    setEditorValue(nextRaw);
    setIsEditorModified(false);
    setShowEditorSavedNotice(false);
    setIsEditingStrategyText(false);
    resetEditorScroll();
  };

  const saveEditor = async () => {
    if (isSavingEditor || !isEditorModified) return;
    const nextRaw = normalizeEditorContent(editorValue || '');
    const ensured = ensureKeyTradeSetupsSection(nextRaw, fieldValues);
    const finalizedRaw = normalizeEditorContent(ensured.raw);
    const nextValues = mergeCenterValuesIntoFieldValues(fieldValues, ensured.values);

    setIsSavingEditor(true);
    setFieldValues(nextValues);
    setStrategyRaw(finalizedRaw);
    setEditorValue(finalizedRaw);
    setIsEditorModified(false);
    setShowEditorSavedNotice(true);
    setIsEditingStrategyText(false);

    if (editorSavedNoticeTimeoutRef.current) {
      clearTimeout(editorSavedNoticeTimeoutRef.current);
    }
    editorSavedNoticeTimeoutRef.current = setTimeout(() => {
      setShowEditorSavedNotice(false);
    }, 1500);

    const contentPayload = {
        ...s,
        name: normalizedStrategyName,
        raw: finalizedRaw,
        content: finalizedRaw,
        entry: nextValues[0],
        volume: nextValues[1],
        trend: nextValues[2],
        riskReward: nextValues[3],
        stopLoss: nextValues[4],
        allocation: nextValues[5],
        keyTradeSetups: {
          entry: nextValues[0],
          volume: nextValues[1],
          trend: nextValues[2],
          riskReward: nextValues[3],
          stopLoss: nextValues[4],
          allocation: nextValues[5] || '',
        },
        folder: payloadFolderName,
        folderId: resolvedFolderId,
        source: payloadSource,
        updatedAt: Date.now(),
      };

    upsertStrategyIntoFolderStorage(contentPayload, resolvedFolderId);
    emitTerminalStrategySave(contentPayload);

    try {
      await onContentSave?.(contentPayload);
    } catch (error) {
      console.warn('[StrategyOutput] Content save failed, local copy kept:', error);
    } finally {
      setIsSavingEditor(false);
    }
  };

  const handleBacktestEditedStrategy = () => {
    const nextRaw = normalizeEditorContent(editorValue || strategyRaw || s.raw || '');
    const ensured = ensureKeyTradeSetupsSection(nextRaw, fieldValues);
    const normalizedRaw = normalizeEditorContent(ensured.raw);
    const nextValues = mergeCenterValuesIntoFieldValues(fieldValues, ensured.values);

    setFieldValues(nextValues);
    setEditorValue(normalizedRaw);
    setIsEditorModified(normalizedRaw !== String(strategyRaw || ''));

    const setupParams = FIELD_LABELS.map((label, index) => `${label}: ${withDollarTickers(nextValues[index] || '—')}`).join('\n');
    const prompt = [
      `Backtest this edited strategy exactly as written below:`,
      '',
      normalizedRaw,
      '',
      'Use these key trade setup values:',
      setupParams,
      '',
      'Return full backtest results and updated Key Trade Setups Identified.',
    ].join('\n');

    onRetest?.(prompt);
  };

  const handleDeployFromSetups = () => {
    if (!deployReady) return;
    const rawWithSetups = applyKeyTradeSetupsSection(strategyRaw || s.raw || '', activeFieldValues);
    const normalizedRaw = normalizeEditorContent(ensureRealTradeAnalysisSection(rawWithSetups, activeFieldValues));
    const savedAt = Date.now();
    const payload = {
      ...s,
      name: normalizedStrategyName,
      raw: normalizedRaw,
      content: normalizedRaw,
      entry: activeFieldValues[0] || '',
      volume: activeFieldValues[1] || '',
      trend: activeFieldValues[2] || '',
      riskReward: activeFieldValues[3] || '',
      stopLoss: activeFieldValues[4] || '',
      allocation: activeFieldValues[5] || '',
      keyTradeSetups: {
        entry: activeFieldValues[0] || '',
        volume: activeFieldValues[1] || '',
        trend: activeFieldValues[2] || '',
        riskReward: activeFieldValues[3] || '',
        stopLoss: activeFieldValues[4] || '',
        allocation: activeFieldValues[5] || '',
      },
      folder: payloadFolderName,
      folderId: resolvedFolderId,
      source: payloadSource,
      checks,
      savedAt,
    };

    setSaved(true);
    setSaveStatus('saved');
    setStrategyRaw(normalizedRaw);
    upsertStrategyIntoFolderStorage(payload, resolvedFolderId);
    emitTerminalStrategySave(payload);
    onSave?.(payload);

    onDeploy?.({
      ...payload,
      status: 'active',
      runStatus: 'running',
      deployedAt: savedAt,
    });
  };

  const handleSave = async () => {
    const rawWithSetups = applyKeyTradeSetupsSection(strategyRaw || s.raw || '', activeFieldValues);
    const normalizedRaw = normalizeEditorContent(ensureRealTradeAnalysisSection(rawWithSetups, activeFieldValues));
    setStrategyRaw(normalizedRaw);
    setSaveStatus('saving');
    const payload = {
      ...s,
      name: normalizedStrategyName,
      raw: normalizedRaw,
      content: normalizedRaw,
      entry: activeFieldValues[0],
      volume: activeFieldValues[1],
      trend: activeFieldValues[2],
      riskReward: activeFieldValues[3],
      stopLoss: activeFieldValues[4],
      allocation: activeFieldValues[5],
      keyTradeSetups: {
        entry: activeFieldValues[0],
        volume: activeFieldValues[1],
        trend: activeFieldValues[2],
        riskReward: activeFieldValues[3],
        stopLoss: activeFieldValues[4],
        allocation: activeFieldValues[5],
      },
      folder: payloadFolderName,
      folderId: resolvedFolderId,
      source: payloadSource,
      checks,
      savedAt: Date.now(),
    };

    const performanceData = extractPerformanceData(payload);
    const normalizedTicker = String(s.ticker || '').trim().replace(/^\$/, '').toUpperCase();
    const savedAtIso = new Date(payload.savedAt).toISOString();
    const localRecord = {
      ...payload,
      user_id: null,
      ticker: normalizedTicker,
      date: savedAtIso,
      status: 'saved',
      profit_return_data: performanceData,
      key_trade_setups: payload.keyTradeSetups,
    };

    // Optimistic UI update so strategy appears in folders immediately.
    upsertStrategyIntoFolderStorage(payload, resolvedFolderId);
    emitTerminalStrategySave(payload);
    onSave?.(payload);
    setSaved(true);
    setSaveStatus('saved');

    try {
      const existing = JSON.parse(localStorage.getItem(SAVED_STRATEGIES_FALLBACK_KEY) || '[]');
      const next = Array.isArray(existing) ? existing : [];
      next.unshift(localRecord);
      localStorage.setItem(SAVED_STRATEGIES_FALLBACK_KEY, JSON.stringify(next.slice(0, 100)));
    } catch {}

    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;

      if (userId) {
        localRecord.user_id = userId;

        const insertRequestedShape = await supabase
          .from('strategies')
          .insert({
            user_id: userId,
            name: payload.name || 'Sophia Strategy',
            ticker: normalizedTicker || null,
            date: savedAtIso,
            entry_signal: payload.entry || '',
            volume: payload.volume || '',
            trend: payload.trend || '',
            risk_reward: payload.riskReward || '',
            stop_loss: payload.stopLoss || '',
            allocation: payload.allocation || '',
            profit_return_data: performanceData,
            status: 'saved',
          });

        if (insertRequestedShape.error) {
          const insertFallback = await supabase
            .from('strategies')
            .insert({
              user_id: userId,
              name: payload.name || 'Sophia Strategy',
              description: payload.raw || null,
              type: 'custom',
              symbols: normalizedTicker ? [normalizedTicker] : [],
              is_active: false,
              rules: {
                date: savedAtIso,
                status: 'saved',
                key_trade_setups: payload.keyTradeSetups,
              },
              backtest_results: performanceData,
            });

          if (insertFallback.error) {
            throw insertFallback.error;
          }
        }
      }
    } catch (error) {
      console.warn('[StrategyOutput] Save to Supabase failed, local fallback kept:', error);
    }
  };

  const handleSaveToSophia = async () => {
    if (isSavingToSophia || savedToSophia) return;

    const rawWithSetups = applyKeyTradeSetupsSection(strategyRaw || s.raw || '', activeFieldValues);
    const normalizedRaw = normalizeEditorContent(ensureRealTradeAnalysisSection(rawWithSetups, activeFieldValues));
    const normalizedTicker = String(s.ticker || '').trim().replace(/^\$/, '').toUpperCase();
    const savedAt = Date.now();
    const savedAtIso = new Date(savedAt).toISOString();
    const performanceData = extractPerformanceData({ ...s, raw: normalizedRaw });
    const sophiaId = String(s.id || `sophia-${savedAt}`);
    const payload = {
      ...s,
      id: sophiaId,
      name: normalizedStrategyName,
      ticker: normalizedTicker,
      type: 'sophia',
      source: payloadSource,
      folder: payloadFolderName,
      folderId: resolvedFolderId,
      status: 'saved',
      savedAt,
      savedToSophia: true,
      raw: normalizedRaw,
      content: normalizedRaw,
      entry: activeFieldValues[0] || '',
      volume: activeFieldValues[1] || '',
      trend: activeFieldValues[2] || '',
      riskReward: activeFieldValues[3] || '',
      stopLoss: activeFieldValues[4] || '',
      allocation: activeFieldValues[5] || '',
      keyTradeSetups: {
        entry: activeFieldValues[0] || '',
        volume: activeFieldValues[1] || '',
        trend: activeFieldValues[2] || '',
        riskReward: activeFieldValues[3] || '',
        stopLoss: activeFieldValues[4] || '',
        allocation: activeFieldValues[5] || '',
      },
      profit_return_data: performanceData,
      date: savedAtIso,
    };

    setIsSavingToSophia(true);
    setStrategyRaw(normalizedRaw);

    // Optimistic UI update so strategy lands in selected folder immediately.
    try {
      upsertStrategyIntoFolderStorage(payload, resolvedFolderId);
      emitTerminalStrategySave(payload);
      if (typeof onSaveToSophia === 'function') {
        onSaveToSophia(payload);
      } else if (typeof onSave === 'function') {
        onSave(payload);
      }
      setSaved(true);
      setSaveStatus('saved');
      setSavedToSophia(true);
    } catch (error) {
      console.warn('[StrategyOutput] Save to Sophia state callback failed:', error);
    }

    try {
      const existing = JSON.parse(localStorage.getItem(SAVED_STRATEGIES_FALLBACK_KEY) || '[]');
      const next = Array.isArray(existing) ? existing : [];
      next.unshift(payload);
      localStorage.setItem(SAVED_STRATEGIES_FALLBACK_KEY, JSON.stringify(next.slice(0, 100)));
    } catch {}

    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;

      if (userId) {
        const baseInsert = {
          user_id: userId,
          name: payload.name,
          ticker: normalizedTicker || null,
          date: savedAtIso,
          entry_signal: payload.entry,
          volume: payload.volume,
          trend: payload.trend,
          risk_reward: payload.riskReward,
          stop_loss: payload.stopLoss,
          allocation: payload.allocation,
          profit_return_data: performanceData,
          status: 'saved',
        };

        const withFolderAttempt = await supabase
          .from('strategies')
          .insert({
            ...baseInsert,
            folder: payload.folder,
            folder_id: payload.folderId,
            source: payload.source,
          });

        if (withFolderAttempt.error) {
          const withoutFolderAttempt = await supabase
            .from('strategies')
            .insert(baseInsert);

          if (withoutFolderAttempt.error) {
            const insertFallback = await supabase
              .from('strategies')
              .insert({
                user_id: userId,
                name: payload.name,
                description: payload.raw || null,
                type: 'sophia',
                symbols: normalizedTicker ? [normalizedTicker] : [],
                is_active: false,
                rules: {
                  date: savedAtIso,
                  status: 'saved',
                  folder: payload.folder,
                  folder_id: payload.folderId,
                  key_trade_setups: payload.keyTradeSetups,
                },
                backtest_results: performanceData,
              });

            if (insertFallback.error) {
              throw insertFallback.error;
            }
          }
        }
      }
    } catch (error) {
      console.warn('[StrategyOutput] Save to Sophia/Supabase failed, local fallback kept:', error);
    }
    setIsSavingToSophia(false);
  };

  return (
    <div className="flex h-full min-h-0 text-zinc-300 text-sm overflow-hidden">
      {/* LEFT SIDE */}
      <div className="flex-1 min-h-0 overflow-y-auto px-8 py-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onBack}
              className="inline-flex items-center gap-1 text-gray-400 hover:text-white transition-colors text-sm"
            >
              <span aria-hidden="true">←</span>
              <span>Back</span>
            </button>
            {typeof onOpenFolders === 'function' && (
              <button
                type="button"
                onClick={onOpenFolders}
                className="inline-flex items-center justify-center rounded-md border border-zinc-700/80 bg-zinc-900/40 p-1.5 text-zinc-400 transition-colors hover:text-cyan-300 hover:border-cyan-400/60"
                title="Open strategy folders"
                aria-label="Open strategy folders"
              >
                <ChevronsRight className="h-4 w-4" strokeWidth={1.8} />
              </button>
            )}
            <div className="flex items-center gap-2 min-w-0">
              {isEditingName ? (
                <>
                  <input
                    ref={strategyNameInputRef}
                    value={strategyNameDraft}
                    onChange={(event) => setStrategyNameDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') commitNameEdit();
                      if (event.key === 'Escape') cancelNameEdit();
                    }}
                    onBlur={commitNameEdit}
                    className="min-w-[220px] max-w-[420px] rounded-md border border-cyan-400/50 bg-black/40 px-2.5 py-1.5 text-white text-lg font-semibold outline-none focus:border-cyan-300"
                    aria-label="Edit strategy name"
                  />
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={cancelNameEdit}
                    className="text-xs text-zinc-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={startNameEdit}
                    className="min-w-0 text-left"
                    title="Rename strategy"
                  >
                    <h1 className="truncate text-white text-xl font-bold">{renderTickerText(normalizedStrategyName, 'strategy-title')}</h1>
                  </button>
                  <button
                    type="button"
                    onClick={startNameEdit}
                    className="text-zinc-500 hover:text-cyan-300 transition-colors"
                    aria-label="Rename strategy"
                  >
                    <Pencil className="h-3.5 w-3.5" strokeWidth={1.7} />
                  </button>
                </>
              )}
            </div>
            {s.ticker && (
              <span className="text-xs font-mono px-2 py-0.5 border border-emerald-500/40 text-emerald-400 rounded">
                {displayTicker}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-zinc-500 text-xs">
            <span>{new Date().toLocaleDateString()}</span>
            {isEditingStrategyText ? (
              <>
                <button
                  type="button"
                  onClick={cancelEditor}
                  className="border border-gray-600 text-gray-400 hover:text-white hover:border-gray-400 transition-colors rounded-lg px-3 py-1.5 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveEditor}
                  disabled={isSavingEditor || !isEditorModified}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium text-xs transition-colors disabled:cursor-not-allowed ${
                    isEditorModified
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-blue-900/40 text-white/60'
                  }`}
                >
                  <SaveIcon className="h-3.5 w-3.5" strokeWidth={1.6} />
                  {isSavingEditor ? 'Saving...' : 'Save'}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={openEditor}
                className="inline-flex items-center gap-1 text-gray-400 hover:text-white transition-colors"
              >
                <span aria-hidden="true">✏️</span>
                <span>Edit</span>
              </button>
            )}
          </div>
        </div>

        {showEditorSavedNotice && !isEditingStrategyText && (
          <div className="mb-3 text-sm font-medium text-emerald-400">Saved!</div>
        )}

        {isEditingStrategyText ? (
          <>
            <div className="mb-3 rounded-xl border border-blue-400/25 bg-blue-500/5 p-3">
              <div className="mt-3 grid grid-cols-2 gap-2">
                {fields.map((field, index) => (
                  <label key={`edit-control-${index}`} className="block rounded-lg border border-blue-400/20 bg-[#0b1220]/70 p-2">
                    <span className="text-[10px] uppercase tracking-wider text-blue-300/90">{field.label}</span>
                    <input
                      value={activeFieldValues[index] || ''}
                      onChange={(event) => updateFieldValue(index, event.target.value, { syncEditor: true })}
                      className="mt-1 w-full rounded-md border border-blue-400/40 bg-black/35 px-2.5 py-2 text-[16px] leading-5 font-semibold text-blue-300 focus:border-blue-300 focus:outline-none"
                    />
                  </label>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-[#0d1117]/40 overflow-hidden">
              <textarea
                ref={editorTextareaRef}
                value={editorValue}
                onChange={(event) => updateEditorValue(event.target.value)}
                className="h-[56vh] min-h-[320px] w-full bg-transparent px-4 py-4 font-mono text-sm leading-7 text-zinc-100 caret-emerald-400 selection:bg-emerald-500/25 resize-none outline-none"
                spellCheck={false}
              />
            </div>
            <div className="mt-2 text-xs text-zinc-400">
              Edit Mode: update strategy text directly, then save.
            </div>
            <button
              type="button"
              onClick={handleBacktestEditedStrategy}
              className="mt-3 w-full rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2.5 transition"
            >
              Backtest Edited Strategy
            </button>
          </>
        ) : (
          <>
            <div
              className="leading-relaxed text-zinc-300"
              dangerouslySetInnerHTML={{ __html: renderedMarkdown }}
            />
            {showSaveToSophiaButton && (
              <button
                type="button"
                onClick={handleSaveToSophia}
                disabled={savedToSophia || isSavingToSophia}
                className={`mt-6 w-full py-3 px-6 rounded-lg font-medium text-white transition flex items-center justify-center gap-2 ${
                  savedToSophia
                    ? 'bg-emerald-800 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-500'
                } disabled:opacity-90`}
              >
                <SaveIcon className="h-4 w-4" strokeWidth={1.6} />
                <span>
                  {savedToSophia
                    ? `✓ Saved to ${selectedFolderName}`
                    : isSavingToSophia
                      ? `Saving to ${selectedFolderName}...`
                      : `💾 Save to ${selectedFolderName}`}
                </span>
              </button>
            )}
          </>
        )}
      </div>

      {/* RIGHT SIDE */}
      {cardsCollapsed ? (
        <div className="w-[40px] flex-shrink-0 h-full bg-[#0b0b0b] border-l border-[#1f1f1f] flex flex-col items-center py-3">
          <button onClick={() => setCardsCollapsed(false)} className="p-1 text-emerald-400 hover:text-emerald-300 transition-colors" title="Expand">
            <ChevronsLeft className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="w-[420px] xl:w-[448px] flex-shrink-0 h-full border-l border-white/10 bg-black/20 p-2.5 overflow-y-auto">
          <div className="mx-auto w-full max-w-[430px]">
            <div className="rounded-xl bg-transparent p-0">
              <div className="rounded-xl border border-white/12 bg-[linear-gradient(180deg,rgba(7,9,14,0.62),rgba(4,6,10,0.48))] p-2.5 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span role="img" aria-label="Fire">🔥</span>
                    <span className="text-white font-bold text-[13px] leading-5 tracking-[0.02em]">KEY TRADE SETUPS IDENTIFIED</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-gray-400 text-[13px]">{checkedCount}/6</span>
                    <select
                      value={resolvedFolderId}
                      onChange={(event) => setSaveFolderId(event.target.value)}
                      className="max-w-[160px] rounded-lg border border-cyan-500/30 bg-[#06101b]/80 px-2 py-1 text-[12px] text-cyan-200 outline-none focus:border-cyan-400"
                      aria-label="Save strategy folder"
                      title={`Save to ${selectedFolderName}`}
                    >
                      {saveFolderOptions.map((folder) => (
                        <option key={folder.id} value={folder.id}>
                          {folder.name}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={handleSave}
                      disabled={saveStatus === 'saving'}
                      className={`rounded-lg px-3 py-1 text-sm border transition ${
                        saveStatus === 'saved'
                          ? 'bg-emerald-600/80 border-emerald-500/80 text-white'
                          : 'border-white/25 text-white hover:bg-white/10'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {saveButtonLabel}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 grid-rows-3 gap-1.5 mt-2 min-h-0">
                  {fields.map((f, i) => {
                    const isAllocation = i === 5;
                    const isEditing = editing === i;
                    const allocationValueRaw = (f.value || '').replace(/^\s*\$/, '').trim();
                    const allocationValue = ['—', '-', '–'].includes(allocationValueRaw) ? '' : allocationValueRaw;

                    return (
                      <div key={i} className="bg-black/20 rounded-lg p-2 min-h-0 flex items-start gap-2 overflow-hidden">
                        <input
                          type="checkbox"
                          checked={checks[i]}
                          onChange={() => toggleCheck(i)}
                          className="h-4 w-4 mt-1 rounded border border-gray-500 bg-transparent accent-emerald-500 cursor-pointer shrink-0"
                          aria-label={`Toggle ${f.label}`}
                        />

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-blue-400 text-xs font-semibold uppercase tracking-wider">{f.label}</p>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!isAllocation) startEdit(i, f.value);
                              }}
                              className="text-gray-500 hover:text-gray-300 transition-colors"
                              aria-label={`Edit ${f.label}`}
                            >
                              <Pencil className="w-3.5 h-3.5" strokeWidth={1.5} />
                            </button>
                          </div>

                          {isAllocation ? (
                            <div className="relative mt-1">
                              <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-blue-300 text-sm">$</span>
                              <input
                                value={allocationValue}
                                onChange={(e) => {
                                  const cleaned = String(e.target.value || '').replace(/[^0-9.,]/g, '');
                                  updateFieldValue(i, cleaned ? `$${cleaned}` : '');
                                }}
                                placeholder="Enter amount..."
                                className="bg-transparent border border-blue-400/50 rounded pl-5 pr-2 py-1 text-white placeholder-gray-500 w-full text-sm focus:outline-none focus:border-blue-300"
                              />
                            </div>
                          ) : isEditing ? (
                            <input
                              autoFocus
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={() => commitEdit(i)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') commitEdit(i);
                                if (e.key === 'Escape') setEditing(null);
                              }}
                              className="mt-1 w-full bg-transparent border border-white/30 rounded px-2 py-1 text-blue-300 text-sm focus:outline-none focus:border-blue-300"
                            />
                          ) : (
                            <p className="text-white text-[14px] mt-1 whitespace-normal break-words leading-[1.35]">
                              {renderTickerText(f.value || '—', `key-setup-${i}`)}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      const params = fields.map((f) => `${f.label}: ${withDollarTickers(f.value || '—')}`).join('\n');
                      const prompt = `Retest this strategy with updated parameters:\n\nTicker: ${displayTicker === '—' ? '$UNKNOWN' : displayTicker}\nStrategy: ${normalizedStrategyName}\n${params}\n\nPlease regenerate the full backtest analysis with these parameters.`;
                      onRetest?.(prompt);
                    }}
                    className="bg-indigo-600/90 hover:bg-indigo-500 text-white text-sm font-medium py-2 rounded-lg flex items-center justify-center gap-2 transition"
                  >
                    <span aria-hidden="true">🔄</span>
                    Ask Sophia to Retest
                  </button>

                  <button
                    onClick={handleDeployFromSetups}
                    disabled={!deployReady}
                    className={`text-sm font-medium py-2 rounded-lg border transition ${
                      deployReady
                        ? 'bg-emerald-500/30 border-emerald-400/60 text-emerald-100 hover:bg-emerald-500/40 shadow-[0_0_14px_rgba(16,185,129,0.25)]'
                        : 'bg-white/5 border-white/15 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    Deploy Strategy
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
