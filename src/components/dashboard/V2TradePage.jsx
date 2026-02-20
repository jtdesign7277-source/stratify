import { useEffect, useMemo, useRef, useState } from 'react';
import Highcharts from 'highcharts/highstock';
import DataModule from 'highcharts/modules/data';
import ExportingModule from 'highcharts/modules/exporting';
import ExportDataModule from 'highcharts/modules/export-data';
import AccessibilityModule from 'highcharts/modules/accessibility';
import AnnotationsAdvancedModule from 'highcharts/modules/annotations-advanced';
import StockToolsModule from 'highcharts/modules/stock-tools';
import HollowCandlestickModule from 'highcharts/modules/hollowcandlestick';
import IndicatorsModule from 'highcharts/indicators/indicators';
import IchimokuModule from 'highcharts/indicators/ichimoku-kinko-hyo';
import { CHART_PRESETS, buildChartOptions } from './charts/chartPresets';

const initModule = (moduleFactory) => {
  try {
    const fn = moduleFactory?.default || moduleFactory;
    if (typeof fn === 'function') fn(Highcharts);
  } catch (error) {
    console.warn('[V.2_Trade] Highcharts module init failed:', error);
  }
};

initModule(DataModule);
initModule(ExportingModule);
initModule(ExportDataModule);
initModule(AccessibilityModule);
initModule(AnnotationsAdvancedModule);
initModule(StockToolsModule);
initModule(HollowCandlestickModule);
initModule(IndicatorsModule);
initModule(IchimokuModule);

const generateFallbackData = (points = 320) => {
  const data = [];
  const day = 24 * 60 * 60 * 1000;
  let close = 182;

  for (let i = points; i > 0; i -= 1) {
    const ts = Date.now() - i * day;
    const open = close + (Math.random() - 0.5) * 2.2;
    const high = Math.max(open, close) + Math.random() * 2.6;
    const low = Math.min(open, close) - Math.random() * 2.6;
    close = low + Math.random() * (high - low);
    const volume = Math.round(250000 + Math.random() * 1600000);
    data.push([ts, Number(open.toFixed(2)), Number(high.toFixed(2)), Number(low.toFixed(2)), Number(close.toFixed(2)), volume]);
  }

  return data;
};

const getFallbackDataForPreset = (presetId) => {
  const full = generateFallbackData();
  if (presetId === 'aapl-basic-exact' || presetId === 'candlestick-basic' || presetId === 'technical-annotations') {
    return full.map((row) => row.slice(0, 5));
  }
  return full;
};

if (!Highcharts.__stratifyVolumeWidthPluginInstalled) {
  Highcharts.addEvent(
    Highcharts.seriesTypes.column,
    'afterColumnTranslate',
    function applyVolumeWidthVariation() {
      const series = this;

      if (!series.options.baseVolume || !series.is('column') || !series.points) return;

      const volumeSeries = series.chart.get(series.options.baseVolume);
      const processedYData = volumeSeries?.getColumn('y', true);
      if (!volumeSeries || !processedYData) return;

      const maxVolume = volumeSeries.dataMax;
      const metrics = series.getColumnMetrics();
      const baseWidth = metrics?.width || 0;
      if (!maxVolume || !baseWidth) return;

      series.points.forEach((point, i) => {
        const volume = Number(processedYData[i] ?? 0);
        if (!Number.isFinite(volume) || !point.shapeArgs) return;

        const scale = Math.max(0.08, volume / maxVolume);
        const width = baseWidth * scale;

        point.shapeArgs.x = point.shapeArgs.x - (width / 2) + (point.shapeArgs.width / 2);
        point.shapeArgs.width = width;
      });
    },
  );

  Highcharts.__stratifyVolumeWidthPluginInstalled = true;
}

export default function V2TradePage() {
  const containerRef = useRef(null);
  const chartRef = useRef(null);

  const [activePresetId, setActivePresetId] = useState(CHART_PRESETS[0].id);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const activePreset = useMemo(
    () => CHART_PRESETS.find((preset) => preset.id === activePresetId) || CHART_PRESETS[0],
    [activePresetId],
  );

  useEffect(() => {
    let mounted = true;

    const loadChart = async () => {
      setLoading(true);
      setError('');

      try {
        if (chartRef.current) {
          chartRef.current.destroy();
          chartRef.current = null;
        }
        if (containerRef.current) {
          containerRef.current.innerHTML = '';
        }

        let data = null;
        let usingFallback = false;

        if (activePreset.dataUrl) {
          try {
            const response = await fetch(activePreset.dataUrl, { cache: 'no-store' });
            if (!response.ok) {
              throw new Error(`fetch failed (${response.status})`);
            }
            data = await response.json();
          } catch (fetchError) {
            console.warn('[V.2_Trade] Preset fetch failed, using fallback data:', fetchError);
            data = getFallbackDataForPreset(activePreset.id);
            usingFallback = true;
          }
        }

        if (!mounted || !containerRef.current) return;

        const options = buildChartOptions({
          presetId: activePreset.id,
          data,
        });

        if (chartRef.current) {
          chartRef.current.destroy();
        }

        chartRef.current =
          activePreset.engine === 'chart'
            ? Highcharts.chart(containerRef.current, options)
            : Highcharts.stockChart(containerRef.current, options);

        if (usingFallback && mounted) {
          setError('Live demo feed unavailable. Showing local fallback dataset.');
        }
      } catch (loadError) {
        console.error('[V.2_Trade] Failed to load chart:', loadError);
        if (mounted) setError('Failed to load chart data.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadChart();

    return () => {
      mounted = false;
    };
  }, [activePreset]);

  useEffect(() => {
    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, []);

  return (
    <div className="h-full w-full bg-transparent p-4">
      <div className="flex h-full w-full gap-4 rounded-xl border border-white/10 bg-black/30 p-3">
        <div className="w-[280px] shrink-0 rounded-lg border border-white/10 bg-[#0a1628]/70 p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Chart Folder</div>
          <div className="space-y-2">
            {CHART_PRESETS.map((preset) => {
              const active = preset.id === activePresetId;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setActivePresetId(preset.id)}
                  className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                    active
                      ? 'border-cyan-400/70 bg-cyan-500/15 text-cyan-200'
                      : 'border-white/10 bg-black/20 text-gray-300 hover:border-cyan-500/40 hover:text-white'
                  }`}
                >
                  <div className="text-sm font-semibold">{preset.name}</div>
                  <div className="mt-0.5 text-xs text-gray-400">{preset.description}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#060d18]/70 p-3">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">{activePreset.name}</h2>
            <div className="flex items-center gap-2">
              {activePreset.id === 'order-book-live' ? (
                <button
                  id="animation-toggle"
                  type="button"
                  className="rounded border border-cyan-500/50 bg-cyan-500/10 px-2 py-1 text-xs font-medium text-cyan-200 hover:bg-cyan-500/20"
                >
                  Start animation
                </button>
              ) : null}
              {loading ? <span className="text-xs text-cyan-300">Loading...</span> : null}
            </div>
          </div>

          {error ? (
            <div className="mb-2 rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>
          ) : null}

          {activePreset.id === 'stock-tools-popup-events' ? (
            <>
              <div className="highcharts-popup-indicators hidden">
                <div className="popup-title">Indicators</div>
                <label className="popup-row">
                  <span>Type</span>
                  <select defaultValue="sma">
                    <option value="sma">SMA</option>
                    <option value="ema">EMA</option>
                    <option value="rsi">RSI</option>
                    <option value="macd">MACD</option>
                  </select>
                </label>
                <label className="popup-row">
                  <span>Period</span>
                  <input type="number" min="1" defaultValue="14" />
                </label>
                <div className="popup-actions">
                  <button type="button">Add indicator</button>
                  <button type="button" className="highcharts-close-popup">Close</button>
                </div>
              </div>
              <div className="highcharts-popup-annotations hidden">
                <div className="popup-title">Annotation</div>
                <label className="popup-row">
                  <span>Stroke width</span>
                  <input type="number" name="stroke-width" min="1" max="8" defaultValue="2" />
                </label>
                <label className="popup-row">
                  <span>Stroke color</span>
                  <input type="color" name="stroke" defaultValue="#3b82f6" />
                </label>
                <div className="popup-actions">
                  <button type="button">Update annotation</button>
                  <button type="button" className="highcharts-close-popup">Close</button>
                </div>
              </div>
            </>
          ) : null}

          <div ref={containerRef} id="v2-trade-container" className="h-[calc(100%-36px)] min-h-[500px] w-full" />
        </div>
      </div>
      <style>{`
        #v2-trade-container .highcharts-background {
          fill: transparent;
        }
        #v2-trade-container .highcharts-title,
        #v2-trade-container .highcharts-axis-title,
        #v2-trade-container .highcharts-axis-labels text,
        #v2-trade-container .highcharts-range-selector text {
          fill: #9d9da2 !important;
          color: #9d9da2 !important;
        }
        #v2-trade-container .highcharts-grid-line {
          stroke: #181816;
        }
        #v2-trade-container .highcharts-candlestick-series .highcharts-point-up {
          fill: #51af7b;
          stroke: #51af7b;
        }
        #v2-trade-container .highcharts-candlestick-series .highcharts-point-down {
          fill: #ff6e6e;
          stroke: #ff6e6e;
        }
        #v2-trade-container .highcharts-series.highcharts-column-series .highcharts-point-up {
          fill: #51af7b;
          stroke: #51af7b;
        }
        #v2-trade-container .highcharts-series.highcharts-column-series .highcharts-point-down {
          fill: #ff6e6e;
          stroke: #ff6e6e;
        }
        #v2-trade-container .highcharts-crosshair-custom {
          stroke: #4f86ff !important;
          stroke-width: 1px !important;
          stroke-dasharray: 3 3;
        }
        #v2-trade-container .highcharts-crosshair-custom-label text {
          fill: #d4d4d8 !important;
        }
        #v2-trade-container .highcharts-crosshair-custom-label rect {
          fill: rgba(0, 0, 0, 0.7);
          stroke: #34343a;
          stroke-width: 1px;
        }
        .highcharts-popup-indicators,
        .highcharts-popup-annotations {
          position: absolute;
          top: 56px;
          right: 18px;
          z-index: 40;
          width: 220px;
          border-radius: 8px;
          border: 1px solid rgba(148, 163, 184, 0.35);
          background: rgba(6, 13, 24, 0.96);
          padding: 10px;
          color: #e2e8f0;
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.45);
        }
        .highcharts-popup-indicators.hidden,
        .highcharts-popup-annotations.hidden {
          display: none;
        }
        .popup-title {
          margin-bottom: 8px;
          font-size: 12px;
          font-weight: 600;
          color: #bae6fd;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .popup-row {
          display: grid;
          grid-template-columns: 1fr;
          gap: 4px;
          margin-bottom: 8px;
        }
        .popup-row span {
          font-size: 11px;
          color: #94a3b8;
        }
        .popup-row input,
        .popup-row select {
          border: 1px solid rgba(148, 163, 184, 0.35);
          border-radius: 6px;
          background: #0a1628;
          color: #e2e8f0;
          font-size: 12px;
          padding: 6px 8px;
        }
        .popup-actions {
          display: flex;
          gap: 8px;
        }
        .popup-actions button {
          border: 1px solid rgba(56, 189, 248, 0.45);
          border-radius: 6px;
          background: rgba(56, 189, 248, 0.12);
          color: #e0f2fe;
          font-size: 11px;
          font-weight: 600;
          padding: 6px 8px;
          cursor: pointer;
        }
        .popup-actions .highcharts-close-popup {
          border-color: rgba(239, 68, 68, 0.45);
          background: rgba(239, 68, 68, 0.12);
          color: #fecaca;
        }
      `}</style>
    </div>
  );
}
