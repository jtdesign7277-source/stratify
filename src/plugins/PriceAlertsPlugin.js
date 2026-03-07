/**
 * Price Alerts pane primitive for Lightweight Charts v5.
 * Renders dashed horizontal lines at user-set price levels; emerald for above, red for below.
 * Labels show price + time remaining; auto-expires after 24h; flashes and removes on cross.
 * Persists to localStorage keyed by ticker.
 */

const STORAGE_KEY_PREFIX = 'stratify-price-alerts-';
const EMERALD = 'rgba(16, 185, 129, 0.9)';
const RED = 'rgba(248, 113, 113, 0.9)';
const LABEL_FONT = '11px sans-serif';

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
              const expiresAt = a.expiresAt ?? now + 86400000;
              if (now >= expiresAt) {
                toRemove.push(a);
                return;
              }
              const y = priceToY(a.price);
              if (y == null || !Number.isFinite(y)) return;
              const color = a.direction === 'above' ? EMERALD : RED;
              ctx.save();
              ctx.strokeStyle = color;
              ctx.setLineDash([6, 4]);
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(0, Math.round(y));
              ctx.lineTo(width, Math.round(y));
              ctx.stroke();
              ctx.setLineDash([]);
              const label = `${a.price.toFixed(2)} · ${Math.max(0, Math.ceil((expiresAt - now) / 3600000))}h`;
              ctx.font = LABEL_FONT;
              ctx.fillStyle = color;
              ctx.textAlign = 'right';
              ctx.fillText(label, width - 4, Math.round(y) - 4);
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
      if (Array.isArray(arr)) this._alerts = arr.filter((a) => a && Number.isFinite(a.price) && (a.expiresAt == null || a.expiresAt > Date.now()));
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
      const crossed = a.direction === 'above' ? price >= a.price : price <= a.price;
      if (crossed) toTrigger.push(a);
    });
    toTrigger.forEach((a) => {
      this._onTriggered({ price: a.price, direction: a.direction });
      this._removeAlert(a);
    });
    this._requestUpdate?.();
  }

  addAlert(price, direction, hoursOrEod = 24) {
    if (!Number.isFinite(price)) return;
    let expiresAt;
    if (hoursOrEod === 'eod' || hoursOrEod === 0) {
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);
      expiresAt = endOfDay.getTime();
    } else {
      expiresAt = Date.now() + (hoursOrEod || 24) * 3600000;
    }
    this._alerts.push({ price, direction: direction || 'above', expiresAt });
    this._save();
    this._requestUpdate?.();
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
