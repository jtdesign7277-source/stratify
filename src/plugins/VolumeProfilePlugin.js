/**
 * Volume Profile pane primitive for Lightweight Charts v5.
 * Renders horizontal volume bars on the right edge (bull/bear, POC, VAH, VAL).
 * Styled in Stratify's emerald/red theme.
 */

const NUM_BINS = 80;
const VALUE_AREA_PCT = 0.7;
const MAX_BAR_WIDTH_PX = 200;
const BAR_HEIGHT_PX = 5;
const DOTTED_LINE_WIDTH = 1;
const EMERALD = 'rgba(16, 185, 129, 0.75)';
const RED = 'rgba(248, 113, 113, 0.75)';
const POC_COLOR = 'rgba(16, 185, 129, 0.95)'; // green for POC
const VAH_VAL_COLOR = 'rgba(59, 130, 246, 0.9)'; // blue for value area lines
const LABEL_LEFT_PX = 6;
const LINE_GAP_AFTER_LABEL_PX = 8; // gap between label and start of dotted line
const LABEL_FONT = '14px monospace';

function buildProfile(bars) {
  if (!bars || bars.length === 0) return { bins: [], poc: null, vah: null, val: null, maxVol: 0 };
  let minP = Infinity;
  let maxP = -Infinity;
  for (const b of bars) {
    const lo = Number(b.low);
    const hi = Number(b.high);
    if (Number.isFinite(lo)) minP = Math.min(minP, lo);
    if (Number.isFinite(hi)) maxP = Math.max(maxP, hi);
  }
  if (minP >= maxP) return { bins: [], poc: null, vah: null, val: null, maxVol: 0 };
  const step = (maxP - minP) / NUM_BINS || 1;
  const bins = Array.from({ length: NUM_BINS }, (_, i) => ({
    price: minP + (i + 0.5) * step,
    upVolume: 0,
    downVolume: 0,
  }));

  for (const b of bars) {
    const low = Number(b.low);
    const high = Number(b.high);
    const vol = Number.isFinite(b.volume) ? b.volume : 0;
    if (vol <= 0 || !Number.isFinite(low) || !Number.isFinite(high) || low >= high) continue;
    const isUp = Number(b.close) >= Number(b.open);
    const i0 = Math.max(0, Math.floor((low - minP) / step));
    const i1 = Math.min(NUM_BINS - 1, Math.floor((high - minP) / step));
    const count = i1 - i0 + 1;
    const vEach = vol / count;
    for (let i = i0; i <= i1; i++) {
      if (isUp) bins[i].upVolume += vEach;
      else bins[i].downVolume += vEach;
    }
  }

  let totalVol = 0;
  let maxVol = 0;
  let pocPrice = null;
  for (const bin of bins) {
    const t = bin.upVolume + bin.downVolume;
    totalVol += t;
    if (t > maxVol) {
      maxVol = t;
      pocPrice = bin.price;
    }
  }

  const sorted = [...bins].filter((b) => b.upVolume + b.downVolume > 0).sort((a, b) => (b.upVolume + b.downVolume) - (a.upVolume + a.downVolume));
  let cum = 0;
  const target = totalVol * VALUE_AREA_PCT;
  let val = null;
  let vah = null;
  for (const b of sorted) {
    cum += b.upVolume + b.downVolume;
    if (val == null || b.price < val) val = b.price;
    if (vah == null || b.price > vah) vah = b.price;
    if (cum >= target) break;
  }

  return { bins, poc: pocPrice, vah, val, maxVol };
}

export class VolumeProfilePlugin {
  constructor(series, initialData = []) {
    this.series = series;
    this._data = Array.isArray(initialData) ? initialData : [];
    this._visible = true;
    this._chart = null;
    this._requestUpdate = null;
    const self = this;
    this._paneView = {
      renderer: () => ({
        draw: () => {},
        drawBackground: (target, _utils) => {
          if (!self._visible || !self.series || !self._chart) return;
          const bars = self._data;
          if (!bars.length) return;

          const ts = self._chart.timeScale();
          const visible = ts.getVisibleRange();
          if (!visible) return;
          let from = visible.from;
          let to = visible.to;
          if (typeof from === 'string') from = new Date(from).getTime() / 1000;
          if (typeof to === 'string') to = new Date(to).getTime() / 1000;
          const visibleBars = bars.filter((b) => {
            const t = typeof b.time === 'string' ? new Date(b.time).getTime() / 1000 : b.time;
            return t >= from && t <= to;
          });
          const { bins, poc, vah, val, maxVol } = buildProfile(visibleBars.length ? visibleBars : bars);
          if (maxVol <= 0) return;

          if (typeof self.series.priceToCoordinate !== 'function') return;

          target.useMediaCoordinateSpace((scope) => {
            const ctx = scope.context;
            const width = scope.mediaSize.width;
            ctx.save();
            try {
              const right = width - 2;
              for (const bin of bins) {
                const total = bin.upVolume + bin.downVolume;
                if (total <= 0) continue;
                const barW = (total / maxVol) * MAX_BAR_WIDTH_PX;
                const xLeft = right - barW;
                const y = self.series.priceToCoordinate(bin.price);
                if (y == null || !Number.isFinite(y)) continue;
                const yTop = Math.round(y) - BAR_HEIGHT_PX / 2;
                const yBot = Math.round(y) + BAR_HEIGHT_PX / 2;
                const upRatio = bin.upVolume / total;
                const upW = barW * upRatio;
                if (upW >= 0.5) {
                  ctx.fillStyle = EMERALD;
                  ctx.fillRect(xLeft, yTop, upW, BAR_HEIGHT_PX);
                }
                if (barW - upW >= 0.5) {
                  ctx.fillStyle = RED;
                  ctx.fillRect(xLeft + upW, yTop, barW - upW, BAR_HEIGHT_PX);
                }
              }

              ctx.font = LABEL_FONT;
              ctx.textBaseline = 'middle';
              ctx.textAlign = 'left';
              const drawLineWithLabel = (price, tag) => {
                const y = self.series.priceToCoordinate(price);
                if (y == null || !Number.isFinite(y)) return;
                const yy = Math.round(y);
                const priceStr = Number(price).toFixed(2);
                const labelStr = tag ? `${tag} ${priceStr}` : priceStr;
                const isPoc = tag === 'POC';
                ctx.fillStyle = isPoc ? POC_COLOR : VAH_VAL_COLOR;
                ctx.fillText(labelStr, LABEL_LEFT_PX, yy);
                const labelWidth = ctx.measureText(labelStr).width;
                const lineStartX = LABEL_LEFT_PX + labelWidth + LINE_GAP_AFTER_LABEL_PX;
                if (lineStartX < right) {
                  ctx.strokeStyle = isPoc ? POC_COLOR : VAH_VAL_COLOR;
                  ctx.lineWidth = DOTTED_LINE_WIDTH;
                  ctx.setLineDash([6, 3]);
                  ctx.beginPath();
                  ctx.moveTo(lineStartX, yy);
                  ctx.lineTo(right + 10, yy);
                  ctx.stroke();
                  ctx.setLineDash([]);
                }
              };
              if (poc != null && Number.isFinite(poc)) {
                drawLineWithLabel(poc, 'POC');
              }
              if (vah != null && Number.isFinite(vah)) {
                drawLineWithLabel(vah, 'VAH');
              }
              if (val != null && Number.isFinite(val)) {
                drawLineWithLabel(val, 'VAL');
              }
            } finally {
              ctx.restore();
            }
          });
        },
      }),
      zOrder: () => 'normal',
    };
  }

  paneViews() {
    if (!this._visible) return [];
    return [this._paneView];
  }

  updateData(data) {
    this._data = Array.isArray(data) ? data : [];
    this._requestUpdate?.();
  }

  setVisible(visible) {
    this._visible = !!visible;
    this._requestUpdate?.();
  }

  attached(param) {
    if (param && param.chart) this._chart = param.chart;
    if (param && param.requestUpdate) this._requestUpdate = param.requestUpdate;
  }

  detached() {
    this._chart = null;
    this._requestUpdate = null;
  }
}
