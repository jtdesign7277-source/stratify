/**
 * Price Alerts pane primitive for Lightweight Charts v5.
 * Renders dashed horizontal lines at user-set price levels in blue, with a bell icon above each.
 * Labels show price + time remaining; auto-expires after 24h; flashes and removes on cross.
 * Persists to localStorage keyed by ticker.
 */

export const STORAGE_KEY_PREFIX = 'stratify-price-alerts-';
const BLUE = 'rgba(59, 130, 246, 0.9)';
const LABEL_FONT = '11px sans-serif';
const BELL_SIZE = 12;
const BELL_OFFSET_Y = 18;

export class PriceAlertsPlugin {
  constructor(symbol, options = {}) {
    this._symbol = symbol || '';
    this._persist = options.persist !== false;
    this._onTriggered = options.onTriggered || (() => {});
    this._alerts = [];
    this._currentPrice = null;
    this._chart = null;
    this._requestUpdate = null;
    this._series = options.series || null;
    this._load();
    const self = this;
    this._paneView = {
      renderer: () => ({
        draw: () => {},
        drawBackground: (target) => {
          if (!self._chart || !self._series || self._alerts.length === 0) return;
          const priceToY = (p) => (typeof self._series.priceToCoordinate === 'function' ? self._series.priceToCoordinate(p) : null);
          target.useMediaCoordinateSpace((scope) => {
            const ctx = scope.context;
            const width = scope.mediaSize.width;
            const now = Date.now();
            const toRemove = [];
            self._alerts.forEach((a) => {
              if (a.enabled === false) return;
              const expiresAt = a.expiresAt ?? now + 86400000;
              if (now >= expiresAt) {
                toRemove.push(a);
                return;
              }
              const y = priceToY(a.price);
              if (y == null || !Number.isFinite(y)) return;
              const ry = Math.round(y);
              ctx.save();
              ctx.strokeStyle = BLUE;
              ctx.fillStyle = BLUE;
              ctx.setLineDash([6, 4]);
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(0, ry);
              ctx.lineTo(width, ry);
              ctx.stroke();
              ctx.setLineDash([]);
              const label = `${a.price.toFixed(2)} · ${Math.max(0, Math.ceil((expiresAt - now) / 3600000))}h`;
              ctx.font = LABEL_FONT;
              ctx.textAlign = 'right';
              ctx.fillText(label, width - 4, ry - 4);
              const cx = 4 + BELL_SIZE;
              const cy = ry - BELL_OFFSET_Y;
              const s = BELL_SIZE / 12;
              ctx.strokeStyle = BLUE;
              ctx.fillStyle = 'transparent';
              ctx.lineWidth = 1.25;
              ctx.lineCap = 'round';
              ctx.lineJoin = 'round';
              ctx.beginPath();
              ctx.moveTo(cx - 2.5 * s, cy - 5 * s);
              ctx.lineTo(cx + 2.5 * s, cy - 5 * s);
              ctx.quadraticCurveTo(cx + 4 * s, cy - 2 * s, cx + 3 * s, cy + 3 * s);
              ctx.quadraticCurveTo(cx + 1 * s, cy + 5 * s, cx, cy + 5 * s);
              ctx.quadraticCurveTo(cx - 1 * s, cy + 5 * s, cx - 3 * s, cy + 3 * s);
              ctx.quadraticCurveTo(cx - 4 * s, cy - 2 * s, cx - 2.5 * s, cy - 5 * s);
              ctx.stroke();
              ctx.beginPath();
              ctx.ellipse(cx, cy + 5.6 * s, 0.6 * s, 1 * s, 0, 0, Math.PI * 2);
              ctx.stroke();
              ctx.restore();
            });
            toRemove.forEach((a) => self._removeAlert(a));
          });
        },
      }),
      zOrder: () => 'normal',
    };
  }

  _load() {
    if (!this._persist || !this._symbol) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY_PREFIX + this._symbol);
      const arr = raw ? JSON.parse(raw) : [];
      if (Array.isArray(arr)) {
        this._alerts = arr.filter((a) => a && Number.isFinite(a.price) && (a.expiresAt == null || a.expiresAt > Date.now())).map((a) => ({
          ...a,
          enabled: a.enabled !== false,
        }));
      }
    } catch {}
  }

  _save() {
    if (!this._persist || !this._symbol) return;
    try {
      localStorage.setItem(STORAGE_KEY_PREFIX + this._symbol, JSON.stringify(this._alerts));
    } catch {}
  }

  _removeAlert(alert) {
    this._alerts = this._alerts.filter((a) => a !== alert);
    this._save();
    this._requestUpdate?.();
  }

  updatePrice(price) {
    if (!Number.isFinite(price)) return;
    this._currentPrice = price;
    const toTrigger = [];
    this._alerts.forEach((a) => {
      if (a.enabled === false) return;
      const crossed = a.direction === 'above' ? price >= a.price : price <= a.price;
      if (crossed) toTrigger.push(a);
    });
    toTrigger.forEach((a) => {
      this._onTriggered({ price: a.price, direction: a.direction });
      this._removeAlert(a);
    });
    this._requestUpdate?.();
  }

  addAlert(price, direction, hoursOrEod = 24, options = {}) {
    if (!Number.isFinite(price)) return;
    let expiresAt;
    if (hoursOrEod === 'eod' || hoursOrEod === 0) {
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);
      expiresAt = endOfDay.getTime();
    } else {
      expiresAt = Date.now() + (hoursOrEod || 24) * 3600000;
    }
    const enabled = options.enabled !== false;
    const message = options.message != null ? String(options.message) : '';
    this._alerts.push({ price, direction: direction || 'above', expiresAt, enabled, message });
    this._save();
    this._requestUpdate?.();
  }

  getAlerts() {
    return this._alerts.map((a) => ({ ...a }));
  }

  loadFromStorage() {
    this._load();
    this._requestUpdate?.();
  }

  setSymbol(symbol) {
    const next = symbol || '';
    if (this._symbol === next) return;
    this._symbol = next;
    this._load();
    this._requestUpdate?.();
  }

  removeAlert(price, direction) {
    const idx = this._alerts.findIndex((a) => Number(a.price) === Number(price) && (a.direction || 'above') === (direction || 'above'));
    if (idx === -1) return;
    this._alerts.splice(idx, 1);
    this._save();
    this._requestUpdate?.();
  }

  setAlertEnabled(price, direction, enabled) {
    const a = this._alerts.find((x) => Number(x.price) === Number(price) && (x.direction || 'above') === (direction || 'above'));
    if (a) {
      a.enabled = !!enabled;
      this._save();
      this._requestUpdate?.();
    }
  }

  /** Get all alerts from every symbol in localStorage (for Folder tab). Each item includes symbol. */
  static getAllAlertsFromStorage() {
    const now = Date.now();
    const out = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith(STORAGE_KEY_PREFIX)) continue;
        const symbol = key.slice(STORAGE_KEY_PREFIX.length);
        const raw = localStorage.getItem(key);
        const arr = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(arr)) continue;
        arr.forEach((a) => {
          if (!a || !Number.isFinite(a.price)) return;
          if (a.expiresAt != null && a.expiresAt <= now) return;
          out.push({ ...a, symbol });
        });
      }
    } catch {}
    return out.sort((a, b) => (a.symbol || '').localeCompare(b.symbol || '') || Number(a.price) - Number(b.price));
  }

  /** Update enabled state for an alert in localStorage by symbol (for Folder tab toggle). */
  static setAlertEnabledInStorage(symbol, price, direction, enabled) {
    if (!symbol) return;
    try {
      const key = STORAGE_KEY_PREFIX + symbol;
      const raw = localStorage.getItem(key);
      const arr = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(arr)) return;
      const a = arr.find((x) => Number(x.price) === Number(price) && (x.direction || 'above') === (direction || 'above'));
      if (a) {
        a.enabled = !!enabled;
        localStorage.setItem(key, JSON.stringify(arr));
      }
    } catch {}
  }

  getAlertCount() {
    return this._alerts.length;
  }

  clearAlerts() {
    this._alerts = [];
    this._save();
    this._requestUpdate?.();
  }

  paneViews() {
    return [this._paneView];
  }

  attached(param) {
    if (param?.chart) this._chart = param.chart;
    if (param?.requestUpdate) this._requestUpdate = param.requestUpdate;
    if (!this._series && this._chart) {
      const list = this._chart?.series?.();
      if (Array.isArray(list) && list.length > 0) this._series = list[0];
    }
  }

  detached() {
    this._chart = null;
    this._requestUpdate = null;
    this._series = null;
  }
}
