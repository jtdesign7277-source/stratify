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
        let data = null;

        if (activePreset.dataUrl) {
          const response = await fetch(activePreset.dataUrl, { cache: 'no-store' });
          data = await response.json();
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

          <div ref={containerRef} id="v2-trade-container" className="h-[calc(100%-36px)] min-h-[500px] w-full" />
        </div>
      </div>
      <style>{`
        #v2-trade-container .highcharts-background {
          fill: #0a0a0a;
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
      `}</style>
    </div>
  );
}
