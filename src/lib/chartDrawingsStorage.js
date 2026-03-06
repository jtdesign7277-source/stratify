/**
 * Persist TradingView Lightweight Chart drawings (horizontal lines, trend lines, rectangles)
 * per chart and per symbol so they survive navigation. Keyed by chartId ('trader' | 'radar') and symbol.
 */

const STORAGE_KEY = 'stratify-chart-drawings-v1';

function normalizeSymbol(symbol) {
  if (symbol == null || typeof symbol !== 'string') return '';
  return String(symbol).replace(/^\$/, '').trim().toUpperCase() || '';
}

function loadAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveAll(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (_) {}
}

const EMPTY = { horizontal: [], trends: [], rectangles: [] };

/**
 * @param {'trader'|'radar'} chartId
 * @param {string} symbol
 * @returns {{ horizontal: number[], trends: Array<{ points: Array<{ time: unknown, value: number }> }>, rectangles: Array<{ t1: unknown, t2: unknown, p1: number, p2: number }> }}
 */
export function getStoredDrawings(chartId, symbol) {
  const key = normalizeSymbol(symbol);
  if (!chartId || !key) return { ...EMPTY };
  const all = loadAll();
  const byChart = all[chartId];
  if (!byChart) return { ...EMPTY };
  const data = byChart[key];
  if (!data) return { ...EMPTY };
  return {
    horizontal: Array.isArray(data.horizontal) ? data.horizontal : [],
    trends: Array.isArray(data.trends) ? data.trends : [],
    rectangles: Array.isArray(data.rectangles) ? data.rectangles : [],
  };
}

/**
 * @param {'trader'|'radar'} chartId
 * @param {string} symbol
 * @param {{ horizontal?: number[], trends?: Array<{ points: Array<{ time: unknown, value: number }> }>, rectangles?: Array<{ t1: unknown, t2: unknown, p1: number, p2: number }> }} data
 */
export function saveDrawings(chartId, symbol, data) {
  const key = normalizeSymbol(symbol);
  if (!chartId || !key) return;
  const all = loadAll();
  if (!all[chartId]) all[chartId] = {};
  all[chartId][key] = {
    horizontal: Array.isArray(data.horizontal) ? data.horizontal : [],
    trends: Array.isArray(data.trends) ? data.trends : [],
    rectangles: Array.isArray(data.rectangles) ? data.rectangles : [],
  };
  saveAll(all);
}
