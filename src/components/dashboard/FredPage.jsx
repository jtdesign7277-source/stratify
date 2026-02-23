import React, { memo, useEffect, useMemo, useRef } from 'react';
import { Calendar, LineChart } from 'lucide-react';

const ADVANCED_CHART_SRC = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
const ECON_CALENDAR_SRC = 'https://s3.tradingview.com/external-embedding/embed-widget-events.js';

const TradingViewWidget = memo(function TradingViewWidget({ scriptSrc, config }) {
  const containerRef = useRef(null);
  const configJson = useMemo(() => JSON.stringify(config), [config]);

  useEffect(() => {
    if (!containerRef.current) return undefined;

    containerRef.current.innerHTML = '';

    const widgetDiv = document.createElement('div');
    widgetDiv.className = 'tradingview-widget-container__widget';
    widgetDiv.style.height = '100%';
    widgetDiv.style.width = '100%';
    containerRef.current.appendChild(widgetDiv);

    const script = document.createElement('script');
    script.src = scriptSrc;
    script.async = true;
    script.type = 'text/javascript';
    script.innerHTML = configJson;
    containerRef.current.appendChild(script);

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [scriptSrc, configJson]);

  return (
    <div
      className="tradingview-widget-container h-full w-full"
      ref={containerRef}
    />
  );
});

class FredErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full w-full flex items-center justify-center text-sm text-gray-400">
          FRED page failed to load.
        </div>
      );
    }

    return this.props.children;
  }
}

const SmallMacroChart = () => {
  const config = useMemo(
    () => ({
      autosize: true,
      symbol: 'TVC:US10Y',
      interval: 'D',
      timezone: 'America/New_York',
      theme: 'dark',
      style: '3',
      locale: 'en',
      backgroundColor: 'rgba(6,13,24,0)',
      gridColor: 'rgba(31, 41, 55, 0.25)',
      hide_top_toolbar: false,
      hide_legend: true,
      withdateranges: true,
      hide_volume: true,
      allow_symbol_change: true,
      support_host: 'https://www.tradingview.com',
      isTransparent: true,
    }),
    [],
  );

  return <TradingViewWidget scriptSrc={ADVANCED_CHART_SRC} config={config} />;
};

const EconCalendar = () => {
  const config = useMemo(
    () => ({
      colorTheme: 'dark',
      isTransparent: true,
      width: '100%',
      height: '100%',
      locale: 'en',
      importanceFilter: '-1,0,1',
      countryFilter: 'us',
    }),
    [],
  );

  return <TradingViewWidget scriptSrc={ECON_CALENDAR_SRC} config={config} />;
};

export default function FredPage() {
  return (
    <FredErrorBoundary>
      <div className="h-full w-full bg-transparent text-white overflow-hidden relative p-4">
        <div
          className="pointer-events-none absolute inset-0 opacity-35"
          style={{
            backgroundImage:
              'linear-gradient(rgba(148,163,184,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.07) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />

        <div className="relative z-10 h-full grid grid-rows-[220px_minmax(0,1fr)] gap-3">
          <section className="rounded-2xl border border-blue-500/25 bg-[rgba(6,13,24,0.34)] backdrop-blur-md p-3 flex flex-col min-h-0">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
              <LineChart className="h-4 w-4 text-blue-400" strokeWidth={1.5} fill="none" />
              <span>Macro Chart</span>
            </div>
            <div className="flex-1 min-h-0 rounded-xl border border-blue-500/20 bg-[rgba(8,20,38,0.18)] overflow-hidden">
              <SmallMacroChart />
            </div>
          </section>

          <section className="rounded-2xl border border-blue-500/25 bg-[rgba(6,13,24,0.34)] backdrop-blur-md p-3 flex flex-col min-h-0">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
              <Calendar className="h-4 w-4 text-blue-400" strokeWidth={1.5} fill="none" />
              <span>Economic Calendar</span>
            </div>
            <div className="flex-1 min-h-0 rounded-xl border border-blue-500/20 bg-[rgba(8,20,38,0.18)] overflow-hidden">
              <EconCalendar />
            </div>
          </section>
        </div>
      </div>
    </FredErrorBoundary>
  );
}
