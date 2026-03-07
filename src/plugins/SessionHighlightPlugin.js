/**
 * Session Highlighting pane primitive for Lightweight Charts v5.
 * Renders subtle background bands on the chart canvas (ET):
 *   Pre-Market   4:00 AM – 9:30 AM ET  → amber tint
 *   Regular      9:30 AM – 4:00 PM ET  → emerald tint
 *   After-Hours  4:00 PM – 8:00 PM ET  → amber tint
 *   Overnight    8:00 PM – 4:00 AM ET  → no highlight
 */

// ET offset: EST = UTC-5 (we use fixed -5 for simplicity; DST would be -4)
const ET_OFFSET_SEC = 5 * 3600;

function unixToETDate(unixSec) {
  const d = new Date((unixSec + ET_OFFSET_SEC) * 1000);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate() };
}

function midnightETUnix(y, m, d) {
  return Math.floor(Date.UTC(y, m, d) / 1000) - ET_OFFSET_SEC;
}

function clamp(t, from, to) {
  return Math.max(from, Math.min(to, t));
}

/**
 * Yield session segments { startUnix, endUnix, type } for a given day (by date in ET).
 */
function* sessionSegmentsForDay(dayStartUnix) {
  const preStart = dayStartUnix + 4 * 3600;
  const preEnd = dayStartUnix + 9.5 * 3600;      // 9:30 AM
  const regStart = preEnd;
  const regEnd = dayStartUnix + 16 * 3600;       // 4:00 PM
  const ahStart = regEnd;
  const ahEnd = dayStartUnix + 20 * 3600;        // 8:00 PM
  const overnightStart = ahEnd;
  const overnightEnd = dayStartUnix + 24 * 3600; // next midnight

  yield { startUnix: preStart, endUnix: preEnd, type: 'premarket' };
  yield { startUnix: regStart, endUnix: regEnd, type: 'regular' };
  yield { startUnix: ahStart, endUnix: ahEnd, type: 'afterhours' };
  yield { startUnix: overnightStart, endUnix: overnightEnd, type: 'overnight' };
}

/**
 * Collect all session segments that intersect [visibleFrom, visibleTo] (Unix seconds).
 */
function getVisibleSessionSegments(visibleFrom, visibleTo) {
  const segments = [];
  const oneDay = 24 * 3600;
  let dayStart = midnightETUnix(
    unixToETDate(visibleFrom).y,
    unixToETDate(visibleFrom).m,
    unixToETDate(visibleFrom).d
  );
  while (dayStart < visibleTo) {
    for (const seg of sessionSegmentsForDay(dayStart)) {
      const start = clamp(seg.startUnix, visibleFrom, visibleTo);
      const end = clamp(seg.endUnix, visibleFrom, visibleTo);
      if (start < end) segments.push({ startUnix: start, endUnix: end, type: seg.type });
    }
    dayStart += oneDay;
  }
  return segments;
}

const SESSION_COLORS = {
  premarket: 'rgba(245, 158, 11, 0.08)',   // amber
  regular: 'rgba(16, 185, 129, 0.08)',     // emerald
  afterhours: 'rgba(245, 158, 11, 0.08)',  // amber
  overnight: null,
};

export class SessionHighlightPlugin {
  constructor(options = {}) {
    this._showLabels = options.showLabels !== false;
    this._visible = true;
    this._requestUpdate = null;
    this._chart = null;
    const self = this;
    this._paneView = {
      renderer: () => ({
        draw: () => {},
        drawBackground: (target, _utils) => {
          if (!self._visible || !self._chart) return;
          const ts = self._chart.timeScale();
          const visible = ts.getVisibleRange();
          if (!visible || visible.from == null || visible.to == null) return;

          let fromSec = visible.from;
          let toSec = visible.to;
          if (typeof fromSec === 'string' || typeof toSec === 'string') {
            fromSec = typeof fromSec === 'string' ? new Date(fromSec).getTime() / 1000 : fromSec;
            toSec = typeof toSec === 'string' ? new Date(toSec).getTime() / 1000 : toSec;
          }
          if (typeof fromSec !== 'number' || typeof toSec !== 'number' || fromSec >= toSec) return;

          const segments = getVisibleSessionSegments(fromSec, toSec);
          target.useMediaCoordinateSpace((scope) => {
            const ctx = scope.context;
            const height = scope.mediaSize.height;
            const width = scope.mediaSize.width;
            ctx.save();
            try {
              for (const seg of segments) {
                if (SESSION_COLORS[seg.type] == null) continue;
                const x1 = ts.timeToCoordinate(seg.startUnix);
                const x2 = ts.timeToCoordinate(seg.endUnix);
                if (x1 == null || x2 == null) continue;
                const left = Math.round(Math.min(x1, x2));
                const right = Math.round(Math.max(x1, x2));
                const w = Math.max(1, right - left);
                ctx.fillStyle = SESSION_COLORS[seg.type];
                ctx.fillRect(left, 0, w, height);
              }
            } finally {
              ctx.restore();
            }
          });
        },
      }),
      zOrder: () => 'bottom',
    };
  }

  paneViews() {
    if (!this._visible) return [];
    return [this._paneView];
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
