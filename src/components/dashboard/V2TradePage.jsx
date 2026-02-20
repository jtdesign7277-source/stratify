import { useEffect, useRef } from 'react';
import Highcharts from 'highcharts/highstock';
import DataModule from 'highcharts/modules/data';
import ExportingModule from 'highcharts/modules/exporting';
import ExportDataModule from 'highcharts/modules/export-data';
import AccessibilityModule from 'highcharts/modules/accessibility';

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

export default function V2TradePage() {
  const containerRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    let chart;

    const loadChart = async () => {
      try {
        const response = await fetch('https://demo-live-data.highcharts.com/aapl-ohlc.json', {
          cache: 'no-store',
        });
        const data = await response.json();

        if (!mounted || !containerRef.current) return;

        chart = Highcharts.stockChart(containerRef.current, {
          rangeSelector: {
            selected: 1,
          },
          title: {
            text: 'AAPL Stock Price',
          },
          series: [
            {
              type: 'candlestick',
              name: 'AAPL Stock Price',
              data,
              dataGrouping: {
                units: [
                  ['week', [1]],
                  ['month', [1, 2, 3, 4, 6]],
                ],
              },
            },
          ],
        });
      } catch (error) {
        console.error('[V.2_Trade] Failed to load chart:', error);
      }
    };

    loadChart();

    return () => {
      mounted = false;
      if (chart) chart.destroy();
    };
  }, []);

  return (
    <div className="h-full w-full bg-transparent p-4">
      <div className="h-full w-full rounded-xl border border-white/10 bg-black/30 p-3">
        <div ref={containerRef} id="v2-trade-container" className="h-full min-h-[500px] w-full" />
      </div>
    </div>
  );
}
