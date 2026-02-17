import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ChevronsLeft, Check, Target, AlertTriangle, Play, TrendingUp, BarChart3, Zap, Shield, DollarSign, Pencil, Save as SaveIcon } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { formatTickersAsHtml, normalizeTickerSymbol, tokenizeTickerText, withDollarTickers } from '../../lib/tickerStyling';

const CHECKLIST_ITEMS = [
  { id: 'entry-signal', label: 'Entry Signal Confirmed', icon: TrendingUp },
  { id: 'volume-check', label: 'Volume Above Average', icon: BarChart3 },
  { id: 'trend-alignment', label: 'Trend Alignment', icon: Zap },
  { id: 'risk-reward', label: 'Risk/Reward ≥ 2:1', icon: Target },
  { id: 'stop-loss-set', label: 'Stop Loss Defined', icon: Shield },
  { id: 'position-sized', label: 'Position Size OK', icon: DollarSign },
];

const FIELD_LABELS = ['Entry Signal', 'Volume', 'Trend', 'Risk/Reward', 'Stop Loss', '$ Allocation'];
const FIELD_KEYS = ['entry', 'volume', 'trend', 'riskReward', 'stopLoss', 'allocation'];
const CENTER_SETUP_LABELS = ['Entry Signal', 'Volume', 'Trend', 'Risk/Reward', 'Stop Loss', '$ Allocation'];
const CENTER_SETUP_FIELD_INDEXES = [0, 1, 2, 3, 4, 5];
const SAVED_STRATEGIES_FALLBACK_KEY = 'stratify-saved-strategies-fallback';
const EDIT_MODE_VALUE_REGEX = /([+-]?\$[\d,]+(?:\.\d+)?|[+-]?\d+(?:\.\d+)?%|\b\d+:\d+\b|\b\d{4}-\d{2}-\d{2}\b|\b\d+(?:\.\d+)?\b)/g;
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

const renderEditModeLine = (lineText = '', keyPrefix = 'edit-line') => {
  const text = String(lineText ?? '');
  if (!text.length) return <span className="text-pink-300">&nbsp;</span>;

  const trimmed = text.trim();
  const isBlueHeader =
    /^#{1,6}\s+/.test(trimmed)
    || /^🔥\s*/.test(trimmed)
    || (/^\*\*.+\*\*$/.test(trimmed) && !trimmed.includes(':'));

  if (isBlueHeader) {
    return <span className="text-blue-400 font-semibold">{text}</span>;
  }

  const parts = text.split(EDIT_MODE_VALUE_REGEX).filter((part) => part !== '');
  return parts.map((part, index) => {
    const isNumericValue = /^([+-]?\$[\d,]+(?:\.\d+)?|[+-]?\d+(?:\.\d+)?%|\d+:\d+|\d{4}-\d{2}-\d{2}|\d+(?:\.\d+)?)$/.test(String(part).trim());
    return (
      <span
        key={`${keyPrefix}-${index}`}
        className={isNumericValue ? 'text-emerald-400 font-semibold' : 'text-pink-300'}
      >
        {part}
      </span>
    );
  });
};

const formatTickerWithDollar = (ticker) => {
  const clean = normalizeTickerSymbol(ticker);
  return clean ? `$${clean}` : '';
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
  onRetest,
  onContentSave,
  showSaveToSophiaButton = false,
}) {
  const s = strategy || {};
  const storageKey = `stratify-activation-${s.id || s.generatedAt || s.name || 'default'}`;
  const defaultFieldValues = useMemo(
    () => FIELD_KEYS.map((key) => (s?.[key] != null ? String(s[key]) : '')),
    [s.entry, s.volume, s.trend, s.riskReward, s.stopLoss, s.allocation],
  );

  // Key Trade Setups checkboxes
  const [checks, setChecks] = useState(Array(6).fill(false));
  const [fieldValues, setFieldValues] = useState(defaultFieldValues);
  const [saved, setSaved] = useState(false);
  const [saveStatus, setSaveStatus] = useState('idle');

  // Activation fields
  const [size, setSize] = useState('');
  const [maxDay, setMaxDay] = useState('');
  const [stopPct, setStopPct] = useState('');
  const [takePct, setTakePct] = useState('');
  const [preChecks, setPreChecks] = useState(Array(6).fill(false));
  const [active, setActive] = useState(false);
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
  const editorTextareaRef = useRef(null);
  const editorHighlightRef = useRef(null);
  const editorSavedNoticeTimeoutRef = useRef(null);

  // Load from localStorage
  useEffect(() => {
    const fallbackChecks = Array(6).fill(false);
    const fallbackPreChecks = Array(6).fill(false);
    let nextFieldValues = defaultFieldValues;
    let nextChecks = fallbackChecks;
    let nextPreChecks = fallbackPreChecks;
    let nextActive = false;
    let nextSaved = false;
    let nextSize = '';
    let nextMaxDay = '';
    let nextStopPct = '';
    let nextTakePct = '';
    let nextStrategyRaw = String(s.raw || '');

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
        if (stored.preChecks) nextPreChecks = stored.preChecks;
        if (stored.active) nextActive = stored.active;
        if (stored.saved) nextSaved = stored.saved;
        if (stored.size) nextSize = stored.size;
        if (stored.maxDay) nextMaxDay = stored.maxDay;
        if (stored.stopPct) nextStopPct = stored.stopPct;
        if (stored.takePct) nextTakePct = stored.takePct;
        if (typeof stored.editedRaw === 'string') nextStrategyRaw = stored.editedRaw;
      }
    } catch {}

    const ensured = ensureKeyTradeSetupsSection(nextStrategyRaw, nextFieldValues);
    nextStrategyRaw = normalizeEditorContent(ensured.raw);
    nextFieldValues = mergeCenterValuesIntoFieldValues(nextFieldValues, ensured.values);

    if (!nextSaved) nextActive = false;

    setFieldValues(nextFieldValues);
    setChecks(nextChecks);
    setPreChecks(nextPreChecks);
    setActive(nextActive);
    setSaved(nextSaved);
    setSaveStatus(nextSaved ? 'saved' : 'idle');
    setSize(nextSize);
    setMaxDay(nextMaxDay);
    setStopPct(nextStopPct);
    setTakePct(nextTakePct);
    setStrategyRaw(nextStrategyRaw);
    setEditorValue(nextStrategyRaw);
    setIsEditorModified(false);
    setShowEditorSavedNotice(false);
    setIsEditingStrategyText(false);
    setIsSavingEditor(false);
    setIsSavingToSophia(false);
    setSavedToSophia(Boolean(s.savedToSophia));
    setEditing(null);
    setEditValue('');
  }, [storageKey, defaultFieldValues, s.raw, s.savedToSophia]);

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify({
      checks,
      fieldValues,
      allocation: fieldValues[5],
      size,
      maxDay,
      stopPct,
      takePct,
      preChecks,
      active,
      saved,
      editedRaw: strategyRaw,
    }));
  }, [checks, fieldValues, size, maxDay, stopPct, takePct, preChecks, active, saved, strategyRaw, storageKey]);

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
      if (editorHighlightRef.current) {
        editorHighlightRef.current.scrollTop = 0;
        editorHighlightRef.current.scrollLeft = 0;
      }
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [isEditingStrategyText]);

  const allChecked = checks.every(Boolean);
  const allPreChecked = preChecks.every(Boolean);
  const checkedCount = checks.filter(Boolean).length;
  const activationLocked = !saved;
  const canActivate = saved && allPreChecked;

  const [editing, setEditing] = useState(null);
  const [editValue, setEditValue] = useState('');

  const toggleCheck = (i) => setChecks((p) => p.map((v, j) => (j === i ? !v : v)));
  const togglePre = (i) => setPreChecks((p) => p.map((v, j) => (j === i ? !v : v)));

  const updateFieldValue = (index, value) => {
    const normalizedValue = withDollarTickers(String(value ?? '').trim());
    setFieldValues((prev) => {
      const next = [...prev];
      next[index] = normalizedValue;
      setStrategyRaw((currentRaw) => applyKeyTradeSetupsSection(currentRaw || s.raw || '', next));
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
  const editorLines = useMemo(
    () => String(editorValue || '').split('\n'),
    [editorValue],
  );
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
      if (editorHighlightRef.current) {
        editorHighlightRef.current.scrollTop = 0;
        editorHighlightRef.current.scrollLeft = 0;
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

    try {
      await onContentSave?.({
        ...s,
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
        updatedAt: Date.now(),
      });
    } catch (error) {
      console.warn('[StrategyOutput] Content save failed, local copy kept:', error);
    } finally {
      setIsSavingEditor(false);
    }
  };

  const handleEditorScroll = (event) => {
    if (!editorHighlightRef.current) return;
    editorHighlightRef.current.scrollTop = event.target.scrollTop;
    editorHighlightRef.current.scrollLeft = event.target.scrollLeft;
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

  const handleActivate = () => {
    if (!canActivate) return;
    setActive(true);
    onDeploy?.({
      symbol: s.ticker,
      size,
      maxDay,
      stopPct,
      takePct,
      status: 'active',
      runStatus: 'running',
    });
  };

  const handleSave = async () => {
    if (!allChecked) return;

    const rawWithSetups = applyKeyTradeSetupsSection(strategyRaw || s.raw || '', activeFieldValues);
    const normalizedRaw = normalizeEditorContent(ensureRealTradeAnalysisSection(rawWithSetups, activeFieldValues));
    setStrategyRaw(normalizedRaw);
    setSaveStatus('saving');
    const payload = {
      ...s,
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

    onSave?.(payload);
    setSaved(true);
    setSaveStatus('saved');
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
      name: s.name || 'Sophia Strategy',
      ticker: normalizedTicker,
      type: 'sophia',
      source: 'sophia',
      folder: 'sophia',
      folderId: 'sophia-strategies',
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
            folder: 'sophia',
            folder_id: 'sophia-strategies',
            source: 'sophia',
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
                  folder: 'sophia',
                  folder_id: 'sophia-strategies',
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

    try {
      onSaveToSophia?.(payload);
      setSavedToSophia(true);
    } catch (error) {
      console.warn('[StrategyOutput] Save to Sophia state callback failed:', error);
    } finally {
      setIsSavingToSophia(false);
    }
  };

  return (
    <div className="flex h-full text-zinc-300 text-sm overflow-hidden">
      {/* LEFT SIDE */}
      <div className="flex-1 overflow-y-auto px-8 py-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="inline-flex items-center gap-1 text-gray-400 hover:text-white transition-colors text-sm"
            >
              <span aria-hidden="true">←</span>
              <span>Back</span>
            </button>
            <h1 className="text-white text-xl font-bold">{renderTickerText(s.name || 'Strategy', 'strategy-title')}</h1>
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
            <div className="rounded-xl border border-fuchsia-500/20 bg-[#0d1117]/30 overflow-hidden">
              <div className="relative h-[56vh] min-h-[320px]">
                <pre
                  ref={editorHighlightRef}
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 overflow-hidden px-4 py-4 font-mono text-sm leading-7 whitespace-pre-wrap break-words"
                >
                  {editorLines.map((line, index) => (
                    <div key={`edit-line-${index}`} className="min-h-[28px]">
                      {renderEditModeLine(line, `edit-line-${index}`)}
                    </div>
                  ))}
                </pre>
                <textarea
                  ref={editorTextareaRef}
                  value={editorValue}
                  onChange={(event) => updateEditorValue(event.target.value)}
                  onScroll={handleEditorScroll}
                  className="relative z-10 h-[56vh] min-h-[320px] w-full bg-transparent px-4 py-4 font-mono text-sm leading-7 text-transparent caret-pink-300 selection:bg-fuchsia-500/30 resize-none outline-none"
                  spellCheck={false}
                />
              </div>
            </div>
            <div className="mt-2 text-xs text-pink-300/90">
              Edit Mode: headers are blue, body text is pink, editable values are green.
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
                    ? '✓ Saved to Sophia Strategies'
                    : isSavingToSophia
                      ? 'Saving to Sophia Strategies...'
                      : '💾 Save to Sophia Strategies'}
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
        <div className="w-[480px] xl:w-[520px] flex-shrink-0 h-full border-l border-[#1f1f1f] bg-[#060d18] p-3 overflow-hidden">
          <div className="h-full min-h-0 grid grid-rows-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
            {/* Card 1: Key Trade Setups */}
            <div className="bg-[#0a1628] rounded-xl border border-gray-700/50 p-2.5 min-h-0 flex flex-col overflow-hidden">
              <div className="bg-gradient-to-b from-[#1a1a2e] to-[#16213e] rounded-xl border border-white/10 p-2.5 h-full min-h-0 flex flex-col">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span role="img" aria-label="Fire">🔥</span>
                    <span className="text-white font-bold text-[15px] leading-5">KEY TRADE SETUPS IDENTIFIED</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-gray-400 text-[15px]">{checkedCount}/6</span>
                    <button
                      onClick={handleSave}
                      disabled={!allChecked || saveStatus === 'saving'}
                      className={`rounded-lg px-4 py-1 border transition ${
                        saveStatus === 'saved'
                          ? 'bg-emerald-600 border-emerald-500 text-white'
                          : 'border-gray-600 text-white hover:bg-white/10'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {saveButtonLabel}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 grid-rows-3 gap-1.5 mt-2 flex-1 min-h-0">
                  {fields.map((f, i) => {
                    const isAllocation = i === 5;
                    const isEditing = editing === i;
                    const allocationValue = (f.value || '').replace(/^\s*\$/, '').trim();

                    return (
                      <div key={i} className="bg-black/30 rounded-lg p-2 min-h-0 flex items-start gap-2 border border-gray-700/50 overflow-hidden">
                        <input
                          type="checkbox"
                          checked={checks[i]}
                          onChange={() => toggleCheck(i)}
                          className="h-5 w-5 mt-1 rounded border-2 border-gray-500 bg-transparent accent-emerald-500 cursor-pointer shrink-0"
                          aria-label={`Toggle ${f.label}`}
                        />

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-amber-400 text-xs font-semibold uppercase tracking-wider">{f.label}</p>
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
                            <input
                              value={allocationValue}
                              onChange={(e) => {
                                updateFieldValue(i, e.target.value);
                              }}
                              placeholder="Enter amount..."
                              className="mt-1 bg-transparent border border-amber-400/50 rounded px-2 py-1 text-white placeholder-gray-500 w-full text-sm focus:outline-none focus:border-amber-300"
                            />
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
                              className="mt-1 w-full bg-transparent border border-white/30 rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-amber-300"
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

                <button
                  onClick={() => {
                    const params = fields.map((f) => `${f.label}: ${withDollarTickers(f.value || '—')}`).join('\n');
                    const prompt = `Retest this strategy with updated parameters:\n\nTicker: ${displayTicker === '—' ? '$UNKNOWN' : displayTicker}\nStrategy: ${s.name || 'Strategy'}\n${params}\n\nPlease regenerate the full backtest analysis with these parameters.`;
                    onRetest?.(prompt);
                  }}
                  className="w-full mt-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[15px] font-medium py-2 rounded-lg flex items-center justify-center gap-2 transition shrink-0"
                >
                  <span aria-hidden="true">🔄</span>
                  Ask Sophia to Retest
                </button>
              </div>
            </div>

            {/* Card 2: Strategy Activation */}
            <div
              className="bg-[#0a1628] rounded-xl border border-gray-700/50 p-3 flex flex-col gap-3 min-h-0 overflow-y-auto"
              style={{ opacity: activationLocked ? 0.82 : 1 }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="flex h-6 w-6 items-center justify-center rounded-md border"
                    style={{
                      background: active ? 'rgba(74,222,128,0.1)' : 'rgba(255,255,255,0.04)',
                      borderColor: active ? 'rgba(74,222,128,0.3)' : 'rgba(255,255,255,0.16)',
                    }}
                  >
                    <Target className={`h-3.5 w-3.5 ${active ? 'text-emerald-400' : 'text-zinc-500'}`} />
                  </div>
                  <div>
                    <span className="text-base font-semibold text-white block">Strategy Activation</span>
                    <span className="text-sm text-amber-300">
                      {activationLocked ? 'Save strategy to unlock activation' : 'Check conditions to activate'}
                    </span>
                  </div>
                </div>
                <span
                  className="text-xs font-mono px-2 py-1 rounded border"
                  style={{
                    background: active ? 'rgba(74,222,128,0.1)' : 'rgba(255,255,255,0.04)',
                    borderColor: active ? 'rgba(74,222,128,0.2)' : 'rgba(255,255,255,0.12)',
                    color: active ? '#4ade80' : 'rgba(255,255,255,0.5)',
                  }}
                >
                  {active ? '● Live' : activationLocked ? 'Locked' : 'Inactive'}
                </span>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs uppercase tracking-wide text-white/55">Symbol</label>
                    <div className="mt-1 rounded-md px-2 py-1.5 text-sm font-mono text-emerald-400 font-semibold border border-white/10 bg-white/5">
                      {displayTicker}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-wide text-white/55">Size ($)</label>
                    <input
                      value={size}
                      onChange={(e) => setSize(e.target.value)}
                      placeholder="10K"
                      disabled={activationLocked}
                      className="mt-1 w-full rounded-md px-2 py-1.5 text-sm text-zinc-100 focus:outline-none disabled:opacity-40 border border-white/10 bg-white/5"
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-wide text-white/55">Max/Day</label>
                    <input
                      value={maxDay}
                      onChange={(e) => setMaxDay(e.target.value)}
                      placeholder="10"
                      disabled={activationLocked}
                      className="mt-1 w-full rounded-md px-2 py-1.5 text-sm text-zinc-100 focus:outline-none disabled:opacity-40 border border-white/10 bg-white/5"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs uppercase tracking-wide text-white/55">Stop Loss %</label>
                    <input
                      value={stopPct}
                      onChange={(e) => setStopPct(e.target.value)}
                      placeholder="2.0"
                      disabled={activationLocked}
                      className="mt-1 w-full rounded-md px-2 py-1.5 text-sm text-red-400 focus:outline-none disabled:opacity-40 border border-white/10 bg-white/5"
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-wide text-white/55">Take Profit %</label>
                    <input
                      value={takePct}
                      onChange={(e) => setTakePct(e.target.value)}
                      placeholder="4.0"
                      disabled={activationLocked}
                      className="mt-1 w-full rounded-md px-2 py-1.5 text-sm text-emerald-400 focus:outline-none disabled:opacity-40 border border-white/10 bg-white/5"
                    />
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-white/60">Pre-Trade Checklist</span>
                  <span className="text-xs text-white/40">{preChecks.filter(Boolean).length}/6</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {CHECKLIST_ITEMS.map((item, i) => (
                    <button
                      key={item.id}
                      onClick={() => togglePre(i)}
                      disabled={activationLocked}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left transition"
                      style={{
                        background: preChecks[i] ? 'rgba(74,222,128,0.06)' : 'rgba(255,255,255,0.02)',
                        border: preChecks[i] ? '1px solid rgba(74,222,128,0.2)' : '1px solid rgba(255,255,255,0.08)',
                      }}
                    >
                      <div
                        className="shrink-0 flex items-center justify-center rounded transition"
                        style={{
                          width: 14,
                          height: 14,
                          background: preChecks[i] ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.04)',
                          border: preChecks[i] ? '1px solid rgba(74,222,128,0.5)' : '1px solid rgba(255,255,255,0.12)',
                        }}
                      >
                        {preChecks[i] && <Check className="h-2 w-2 text-emerald-400" />}
                      </div>
                      <span className="text-[13px]" style={{ color: preChecks[i] ? '#fff' : 'rgba(255,255,255,0.72)' }}>
                        {item.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs">
                  {!saved ? (
                    <>
                      <AlertTriangle className="h-3 w-3 text-amber-400" />
                      <span className="text-white/45">Save strategy to unlock</span>
                    </>
                  ) : !allPreChecked ? (
                    <>
                      <AlertTriangle className="h-3 w-3 text-amber-400" />
                      <span className="text-white/45">Check all to activate</span>
                    </>
                  ) : (
                    <>
                      <Check className="h-3 w-3 text-emerald-400" />
                      <span className="text-emerald-400">Ready</span>
                    </>
                  )}
                </div>
                <button
                  onClick={handleActivate}
                  disabled={!canActivate}
                  className="flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-medium transition"
                  style={{
                    background: canActivate ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.04)',
                    border: canActivate ? '1px solid rgba(74,222,128,0.3)' : '1px solid rgba(255,255,255,0.08)',
                    color: canActivate ? '#4ade80' : 'rgba(255,255,255,0.3)',
                    cursor: canActivate ? 'pointer' : 'not-allowed',
                  }}
                >
                  <Play className="h-3 w-3" />
                  Activate
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
