import { memo, useEffect, useMemo, useRef, useState } from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import TreemapModule from 'highcharts/modules/treemap';
import { subscribeTwelveDataQuotes } from '../../services/twelveDataWebSocket';

try {
  TreemapModule(Highcharts);
} catch (error) {
  console.warn('[MarketMoversPage] Highcharts module init warning:', error);
}

const POSITIVE_COLOR = '#2ecc59';
const NEGATIVE_COLOR = '#f73539';
const QUOTE_CHUNK_SIZE = 80;

const INDUSTRIES = [
  'Technology',
  'Financial',
  'Consumer Cyclical',
  'Communication Services',
  'Healthcare',
  'Consumer Defensive',
  'Industrials',
  'Real Estate',
  'Energy',
  'Utilities',
  'Basic Materials',
];

const FALLBACK_HEATMAP = [
  { id: 'Technology', name: 'Technology', custom: { fullName: 'Technology' } },
  { id: 'Financial', name: 'Financial', custom: { fullName: 'Financial' } },
  { id: 'Communication Services', name: 'Communication Services', custom: { fullName: 'Communication Services' } },
  { id: 'AAPL', name: 'AAPL', value: 2900000000000, parent: 'Technology', colorValue: 1.2, color: POSITIVE_COLOR, custom: { fullName: 'Apple Inc.', performance: '+1.20%' } },
  { id: 'MSFT', name: 'MSFT', value: 3200000000000, parent: 'Technology', colorValue: -0.8, color: NEGATIVE_COLOR, custom: { fullName: 'Microsoft Corp.', performance: '-0.80%' } },
  { id: 'NVDA', name: 'NVDA', value: 2800000000000, parent: 'Technology', colorValue: 0.7, color: POSITIVE_COLOR, custom: { fullName: 'NVIDIA Corp.', performance: '+0.70%' } },
  { id: 'META', name: 'META', value: 1500000000000, parent: 'Communication Services', colorValue: -1.1, color: NEGATIVE_COLOR, custom: { fullName: 'Meta Platforms Inc.', performance: '-1.10%' } },
  { id: 'GOOGL', name: 'GOOGL', value: 2200000000000, parent: 'Communication Services', colorValue: 0.5, color: POSITIVE_COLOR, custom: { fullName: 'Alphabet Inc.', performance: '+0.50%' } },
  { id: 'JPM', name: 'JPM', value: 550000000000, parent: 'Financial', colorValue: -0.3, color: NEGATIVE_COLOR, custom: { fullName: 'JPMorgan Chase & Co.', performance: '-0.30%' } },
];

const sectorToIndustry = {
  'Industrial Conglomerates': 'Industrials',
  'Building Products': 'Industrials',
  'Health Care Equipment': 'Healthcare',
  Biotechnology: 'Healthcare',
  'IT Consulting & Other Services': 'Technology',
  'Application Software': 'Technology',
  Semiconductors: 'Technology',
  'Independent Power Producers & Energy Traders': 'Energy',
  'Life & Health Insurance': 'Financial',
  'Life Sciences Tools & Services': 'Healthcare',
  'Industrial Gases': 'Basic Materials',
  'Hotels, Resorts & Cruise Lines': 'Consumer Cyclical',
  'Internet Services & Infrastructure': 'Technology',
  'Specialty Chemicals': 'Basic Materials',
  'Office REITs': 'Real Estate',
  'Health Care Supplies': 'Healthcare',
  'Electric Utilities': 'Utilities',
  'Property & Casualty Insurance': 'Financial',
  'Interactive Media & Services': 'Communication Services',
  Tobacco: 'Consumer Defensive',
  'Broadline Retail': 'Consumer Cyclical',
  'Paper & Plastic Packaging Products & Materials': 'Basic Materials',
  'Diversified Support Services': 'Industrials',
  'Multi-Utilities': 'Utilities',
  'Consumer Finance': 'Financial',
  'Multi-line Insurance': 'Financial',
  'Telecom Tower REITs': 'Real Estate',
  'Water Utilities': 'Utilities',
  'Asset Management & Custody Banks': 'Financial',
  'Electrical Components & Equipment': 'Industrials',
  'Electronic Components': 'Technology',
  'Insurance Brokers': 'Financial',
  'Oil & Gas Exploration & Production': 'Energy',
  'Technology Hardware, Storage & Peripherals': 'Technology',
  'Semiconductor Materials & Equipment': 'Technology',
  'Automotive Parts & Equipment': 'Consumer Cyclical',
  'Agricultural Products & Services': 'Consumer Defensive',
  'Communications Equipment': 'Technology',
  'Integrated Telecommunication Services': 'Communication Services',
  'Gas Utilities': 'Utilities',
  'Human Resource & Employment Services': 'Industrials',
  'Automotive Retail': 'Consumer Cyclical',
  'Multi-Family Residential REITs': 'Real Estate',
  'Aerospace & Defense': 'Industrials',
  'Oil & Gas Equipment & Services': 'Energy',
  'Metal, Glass & Plastic Containers': 'Basic Materials',
  'Diversified Banks': 'Financial',
  'Multi-Sector Holdings': 'Financial',
  'Computer & Electronics Retail': 'Consumer Cyclical',
  Pharmaceuticals: 'Healthcare',
  'Data Processing & Outsourced Services': 'Technology',
  'Distillers & Vintners': 'Consumer Defensive',
  'Air Freight & Logistics': 'Industrials',
  'Casinos & Gaming': 'Consumer Cyclical',
  'Packaged Foods & Meats': 'Consumer Defensive',
  'Health Care Distributors': 'Healthcare',
  'Construction Machinery & Heavy Transportation Equipment': 'Industrials',
  'Financial Exchanges & Data': 'Financial',
  'Real Estate Services': 'Real Estate',
  'Technology Distributors': 'Technology',
  'Managed Health Care': 'Healthcare',
  'Fertilizers & Agricultural Chemicals': 'Basic Materials',
  'Investment Banking & Brokerage': 'Financial',
  'Cable & Satellite': 'Communication Services',
  'Integrated Oil & Gas': 'Energy',
  Restaurants: 'Consumer Cyclical',
  'Household Products': 'Consumer Defensive',
  'Health Care Services': 'Healthcare',
  'Regional Banks': 'Financial',
  'Soft Drinks & Non-alcoholic Beverages': 'Consumer Defensive',
  'Transaction & Payment Processing Services': 'Technology',
  'Consumer Staples Merchandise Retail': 'Consumer Defensive',
  'Systems Software': 'Technology',
  'Rail Transportation': 'Industrials',
  Homebuilding: 'Consumer Cyclical',
  Footwear: 'Consumer Cyclical',
  'Agricultural & Farm Machinery': 'Consumer Cyclical',
  'Passenger Airlines': 'Industrials',
  'Data Center REITs': 'Real Estate',
  'Industrial Machinery & Supplies & Components': 'Industrials',
  'Commodity Chemicals': 'Basic Materials',
  'Interactive Home Entertainment': 'Communication Services',
  'Research & Consulting Services': 'Industrials',
  'Personal Care Products': 'Consumer Defensive',
  Reinsurance: 'Financial',
  'Self-Storage REITs': 'Real Estate',
  'Trading Companies & Distributors': 'Industrials',
  'Retail REITs': 'Real Estate',
  'Automobile Manufacturers': 'Consumer Cyclical',
  Broadcasting: 'Communication Services',
  Copper: 'Basic Materials',
  'Consumer Electronics': 'Technology',
  'Heavy Electrical Equipment': 'Industrials',
  Distributors: 'Industrials',
  'Leisure Products': 'Consumer Cyclical',
  'Health Care Facilities': 'Healthcare',
  'Health Care REITs': 'Real Estate',
  'Home Improvement Retail': 'Consumer Cyclical',
  'Hotel & Resort REITs': 'Real Estate',
  Advertising: 'Communication Services',
  'Single-Family Residential REITs': 'Real Estate',
  'Other Specialized REITs': 'Real Estate',
  'Cargo Ground Transportation': 'Industrials',
  'Electronic Manufacturing Services': 'Technology',
  'Construction & Engineering': 'Industrials',
  'Electronic Equipment & Instruments': 'Technology',
  'Oil & Gas Storage & Transportation': 'Energy',
  'Food Retail': 'Consumer Defensive',
  'Movies & Entertainment': 'Communication Services',
  'Apparel, Accessories & Luxury Goods': 'Consumer Cyclical',
  'Oil & Gas Refining & Marketing': 'Energy',
  'Construction Materials': 'Basic Materials',
  'Home Furnishings': 'Consumer Cyclical',
  Brewers: 'Consumer Defensive',
  Gold: 'Basic Materials',
  Publishing: 'Communication Services',
  Steel: 'Basic Materials',
  'Industrial REITs': 'Real Estate',
  'Environmental & Facilities Services': 'Industrials',
  'Apparel Retail': 'Consumer Cyclical',
  'Health Care Technology': 'Healthcare',
  'Food Distributors': 'Consumer Defensive',
  'Wireless Telecommunication Services': 'Communication Services',
  'Other Specialty Retail': 'Consumer Cyclical',
  'Passenger Ground Transportation': 'Industrials',
  'Drug Retail': 'Consumer Cyclical',
  'Timber REITs': 'Real Estate'
};

const normalizeSymbol = (value = '') => String(value || '').trim().toUpperCase().replace(/[^A-Z0-9/]/g, '');

const parseCsvLine = (line = '') => {
  const result = [];
  let current = '';
  let insideQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      const nextChar = line[i + 1];
      if (insideQuotes && nextChar === '"') {
        current += '"';
        i += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (char === ',' && !insideQuotes) {
      result.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  result.push(current);
  return result.map((item) => item.trim());
};

const parseCsv = (csvText = '') => {
  const lines = String(csvText || '').split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (!lines.length) return [];

  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    return headers.reduce((row, header, index) => {
      row[header] = cells[index] ?? '';
      return row;
    }, {});
  });
};

const toNumber = (value, fallback = null) => {
  if (value === null || value === undefined) return fallback;
  const normalized = typeof value === 'string'
    ? value.replace(/[^0-9.,-]/g, '').replace(/,/g, '')
    : value;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const performanceText = (perf) => {
  const numeric = toNumber(perf, 0);
  return `${numeric >= 0 ? '+' : ''}${numeric.toFixed(2)}%`;
};

const buildTreemapData = (csvData = [], oldData = []) => {
  const data = INDUSTRIES.map((id) => ({ id, color: '#252931' }));

  const oldBySymbol = new Map();
  oldData.forEach((row) => {
    const symbol = normalizeSymbol(row?.Symbol);
    if (!symbol) return;
    oldBySymbol.set(symbol, row);
  });

  csvData.forEach((row) => {
    const sector = String(row?.Sector || '').trim();
    if (!sector) return;
    if (!data.find((point) => point.id === sector)) {
      data.push({
        id: sector,
        parent: sectorToIndustry[sector] || 'Industrials',
        color: '#252931'
      });
    }
  });

  data.forEach((point) => {
    point.name = point.id;
    point.custom = {
      fullName: point.id
    };
  });

  csvData
    .filter((row) => row.Symbol !== 'GOOG' && row.Price && row['Market Cap'])
    .forEach((row) => {
      const symbol = normalizeSymbol(row.Symbol);
      if (!symbol) return;

      const old = oldBySymbol.get(symbol);
      let perf = 0;

      if (old?.Price) {
        const oldPrice = toNumber(old.Price, 0);
        const newPrice = toNumber(row.Price, 0);
        if (oldPrice > 0 && newPrice > 0) {
          perf = (100 * (newPrice - oldPrice)) / oldPrice;
        }
      }

      data.push({
        name: symbol,
        id: symbol,
        value: toNumber(row['Market Cap'], 0),
        parent: row.Sector,
        colorValue: perf,
        color: perf >= 0 ? POSITIVE_COLOR : NEGATIVE_COLOR,
        custom: {
          fullName: row.Name,
          performance: performanceText(perf)
        }
      });
    });

  return data;
};

const chartBaseOptions = {
  chart: {
    backgroundColor: 'transparent',
    reflow: true,
    spacing: [0, 0, 0, 0]
  },
  title: {
    text: null
  },
  subtitle: {
    text: null
  },
  tooltip: {
    followPointer: true,
    outside: true,
    headerFormat: '<span style="font-size: 0.9em">{point.custom.fullName}</span><br/>',
    pointFormat: '<b>Market Cap:</b> USD {(divide point.value 1000000000):.1f} bln<br/>{#if point.custom.performance}<b>1 month performance:</b> {point.custom.performance}{/if}'
  },
  colorAxis: {
    dataClasses: [
      {
        to: 0,
        color: NEGATIVE_COLOR,
        name: 'Negative'
      },
      {
        from: 0,
        color: POSITIVE_COLOR,
        name: 'Positive'
      }
    ],
    gridLineWidth: 0,
    visible: false,
    labels: {
      enabled: false,
      overflow: 'allow',
      format: '{#gt value 0}+{value}{else}{value}{/gt}%',
      style: {
        color: 'white'
      }
    }
  },
  legend: {
    enabled: false,
    itemStyle: {
      color: 'white'
    }
  },
  exporting: {
    enabled: false
  }
};

// TradingViewWidget.jsx
function TradingViewWidget() {
  const container = useRef();

  useEffect(
    () => {
      if (!container.current) return undefined;
      container.current.innerHTML = '';
      const script = document.createElement("script");
      script.src = "https://s3.tradingview.com/external-embedding/embed-widget-crypto-coins-heatmap.js";
      script.type = "text/javascript";
      script.async = true;
      script.innerHTML = `
        {
          "dataSource": "Crypto",
          "blockSize": "market_cap_calc",
          "blockColor": "24h_close_change|5",
          "locale": "en",
          "symbolUrl": "",
          "colorTheme": "dark",
          "hasTopBar": false,
          "isDataSetEnabled": false,
          "isZoomEnabled": true,
          "hasSymbolTooltip": true,
          "isMonoSize": false,
          "width": "100%",
          "height": "100%"
        }`;
      container.current.appendChild(script);
      return () => {
        if (container.current) {
          container.current.innerHTML = '';
        }
      };
    },
    []
  );

  return (
    <div className="tradingview-widget-container h-full w-full overflow-hidden" ref={container}>
      <div className="tradingview-widget-container__widget h-full w-full"></div>
    </div>
  );
}

const MemoizedTradingViewWidget = memo(TradingViewWidget);

export default function MarketMoversPage() {
  const [activeHeatmapTab, setActiveHeatmapTab] = useState('stocks');
  const [heatmapData, setHeatmapData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stockChartHeight, setStockChartHeight] = useState(null);
  const stocksPanelRef = useRef(null);
  const stockChartRef = useRef(null);

  useEffect(() => {
    const removeEvent = Highcharts.addEvent(Highcharts.Series, 'drawDataLabels', function () {
      if (this.type !== 'treemap') return;

      this.points.forEach((point) => {
        if (point.node?.level === 2 && Number.isFinite(point.value)) {
          const previousValue = point.node.children.reduce(
            (acc, child) => acc + (child.point?.value || 0) - (child.point?.value || 0) * (child.point?.colorValue || 0) / 100,
            0
          );

          const perf = 100 * (point.value - previousValue) / (previousValue || 1);

          point.custom = {
            ...(point.custom || {}),
            performance: performanceText(perf)
          };

          if (point.dlOptions) {
            point.dlOptions.backgroundColor = perf >= 0 ? POSITIVE_COLOR : NEGATIVE_COLOR;
          }
        }

        if (point.node?.level === 3 && point.shapeArgs && point.dlOptions) {
          const area = point.shapeArgs.width * point.shapeArgs.height;
          point.dlOptions.style = {
            ...(point.dlOptions.style || {}),
            fontSize: `${Math.min(32, 7 + Math.round(area * 0.0008))}px`
          };
        }
      });
    });

    return () => {
      if (typeof removeEvent === 'function') {
        removeEvent();
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError('');

      try {
        const [csvText, oldCsvText] = await Promise.all([
          fetch('https://cdn.jsdelivr.net/gh/datasets/s-and-p-500-companies-financials@67dd99e/data/constituents-financials.csv').then((r) => r.text()),
          fetch('https://cdn.jsdelivr.net/gh/datasets/s-and-p-500-companies-financials@9f63bc5/data/constituents-financials.csv').then((r) => r.text())
        ]);

        if (cancelled) return;

        const csvData = parseCsv(csvText);
        const oldData = parseCsv(oldCsvText);
        const nextData = buildTreemapData(csvData, oldData);

        if (!nextData.length) {
          throw new Error('No heatmap data available.');
        }

        setHeatmapData(nextData);
      } catch (loadError) {
        if (cancelled) return;
        console.error('[MarketMoversPage] Heatmap load failed:', loadError);
        setError('Live dataset unavailable. Showing fallback heatmap.');
        setHeatmapData(FALLBACK_HEATMAP);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const streamSymbolsKey = useMemo(() => {
    const symbols = heatmapData
      .filter((point) => point?.parent && Number.isFinite(Number(point?.value)) && point?.id)
      .map((point) => normalizeSymbol(point.id))
      .filter(Boolean);

    return [...new Set(symbols)].join(',');
  }, [heatmapData]);

  useEffect(() => {
    if (!streamSymbolsKey) return undefined;

    const symbols = streamSymbolsKey.split(',').filter(Boolean);
    if (!symbols.length) return undefined;

    const unsubscribe = subscribeTwelveDataQuotes(symbols, (update) => {
      const symbol = normalizeSymbol(update?.symbol);
      const pct = Number(update?.percentChange ?? update?.dayChangePercent ?? update?.percent_change);
      if (!symbol || !Number.isFinite(pct)) return;

      setHeatmapData((prev) => {
        let changed = false;
        const next = prev.map((point) => {
          if (normalizeSymbol(point?.id) !== symbol) return point;
          changed = true;
          return {
            ...point,
            colorValue: pct,
            color: pct >= 0 ? POSITIVE_COLOR : NEGATIVE_COLOR,
            custom: {
              ...(point.custom || {}),
              performance: performanceText(pct)
            }
          };
        });
        return changed ? next : prev;
      });
    });

    return () => unsubscribe?.();
  }, [streamSymbolsKey]);

  useEffect(() => {
    if (!streamSymbolsKey) return undefined;

    let cancelled = false;
    const symbols = streamSymbolsKey.split(',').filter(Boolean);
    if (symbols.length === 0) return undefined;

    const chunks = [];
    for (let i = 0; i < symbols.length; i += QUOTE_CHUNK_SIZE) {
      chunks.push(symbols.slice(i, i + QUOTE_CHUNK_SIZE));
    }

    const loadLiveCaps = async () => {
      try {
        const responses = await Promise.all(
          chunks.map(async (chunk) => {
            const params = new URLSearchParams({ symbols: chunk.join(',') });
            const response = await fetch(`/api/community/market-data?${params.toString()}`, {
              cache: 'no-store'
            });

            if (!response.ok) return [];
            const payload = await response.json().catch(() => ({}));
            return Array.isArray(payload?.data) ? payload.data : [];
          })
        );

        if (cancelled) return;

        const bySymbol = new Map();
        responses.flat().forEach((row) => {
          const symbol = normalizeSymbol(row?.symbol);
          if (!symbol) return;

          bySymbol.set(symbol, {
            marketCap: toNumber(row?.marketCap ?? row?.market_cap),
            pct: toNumber(row?.percentChange ?? row?.percent_change)
          });
        });

        if (bySymbol.size === 0) return;

        setHeatmapData((prev) => prev.map((point) => {
          if (!point?.parent || !point?.id) return point;

          const live = bySymbol.get(normalizeSymbol(point.id));
          if (!live) return point;

          const hasMarketCap = Number.isFinite(live.marketCap) && live.marketCap > 0;
          const hasPct = Number.isFinite(live.pct);
          if (!hasMarketCap && !hasPct) return point;

          const nextPct = hasPct ? live.pct : toNumber(point.colorValue, 0);

          return {
            ...point,
            value: hasMarketCap ? live.marketCap : point.value,
            colorValue: nextPct,
            color: nextPct >= 0 ? POSITIVE_COLOR : NEGATIVE_COLOR,
            custom: {
              ...(point.custom || {}),
              performance: performanceText(nextPct)
            }
          };
        }));
      } catch (loadError) {
        console.warn('[MarketMoversPage] Live market-cap hydrate failed:', loadError);
      }
    };

    loadLiveCaps();

    return () => {
      cancelled = true;
    };
  }, [streamSymbolsKey]);

  useEffect(() => {
    const panel = stocksPanelRef.current;
    if (!panel || typeof ResizeObserver === 'undefined') return undefined;

    const resize = () => {
      // Keep a small safety gap so the treemap never clips at the bottom edge.
      const nextHeight = Math.max(280, Math.floor(panel.clientHeight - 24));
      setStockChartHeight((previous) => (previous === nextHeight ? previous : nextHeight));
    };

    resize();

    const observer = new ResizeObserver(() => {
      resize();
    });

    observer.observe(panel);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (activeHeatmapTab !== 'stocks') return;
    if (!stockChartRef.current?.chart || !stockChartHeight) return;
    stockChartRef.current.chart.setSize(null, stockChartHeight, false);
  }, [activeHeatmapTab, stockChartHeight]);

  const chartOptions = useMemo(() => ({
    ...chartBaseOptions,
    chart: {
      ...chartBaseOptions.chart,
      height: stockChartHeight || undefined
    },
    series: [{
      name: 'All',
      type: 'treemap',
      colorKey: 'colorValue',
      colorByPoint: false,
      layoutAlgorithm: 'squarified',
      allowDrillToNode: true,
      animationLimit: 1000,
      borderColor: '#252931',
      nodeSizeBy: 'leaf',
      dataLabels: {
        enabled: false,
        allowOverlap: true,
        style: {
          fontSize: '0.9em',
          textOutline: 'none'
        }
      },
      levels: [{
        level: 1,
        dataLabels: {
          enabled: true,
          headers: true,
          align: 'left',
          style: {
            fontWeight: 'bold',
            fontSize: '0.7em',
            lineClamp: 1,
            textTransform: 'uppercase'
          },
          padding: 3
        },
        borderWidth: 3,
        levelIsConstant: false
      }, {
        level: 2,
        dataLabels: {
          enabled: true,
          headers: true,
          align: 'center',
          shape: 'callout',
          backgroundColor: 'gray',
          borderWidth: 1,
          borderColor: '#252931',
          padding: 0,
          style: {
            color: 'white',
            fontWeight: 'normal',
            fontSize: '0.6em',
            lineClamp: 1,
            textOutline: 'none',
            textTransform: 'uppercase'
          }
        },
        groupPadding: 1
      }, {
        level: 3,
        dataLabels: {
          enabled: true,
          align: 'center',
          format: '{point.name}<br><span style="font-size: 0.7em">{point.custom.performance}</span>',
          style: {
            color: 'white'
          }
        }
      }],
      accessibility: {
        exposeAsGroupOnly: true
      },
      breadcrumbs: {
        buttonTheme: {
          style: {
            color: 'silver'
          },
          states: {
            hover: {
              fill: '#333'
            },
            select: {
              style: {
                color: 'white'
              }
            }
          }
        }
      },
      data: heatmapData
    }]
  }), [heatmapData, stockChartHeight]);

  return (
    <div className="h-full min-h-0 w-full bg-transparent p-3 flex flex-col">
      <div className="mb-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveHeatmapTab('stocks')}
          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
            activeHeatmapTab === 'stocks'
              ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-300'
              : 'border-white/10 bg-black/35 text-slate-300 hover:border-white/20 hover:text-white'
          }`}
        >
          Stocks
        </button>
        <button
          type="button"
          onClick={() => setActiveHeatmapTab('crypto')}
          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
            activeHeatmapTab === 'crypto'
              ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-300'
              : 'border-white/10 bg-black/35 text-slate-300 hover:border-white/20 hover:text-white'
          }`}
        >
          Crypto
        </button>
      </div>
      <div className="flex-1 min-h-0">
        {activeHeatmapTab === 'stocks' ? (
          <div ref={stocksPanelRef} className="h-full w-full min-h-0 overflow-hidden">
            {heatmapData.length > 0 ? (
              <HighchartsReact
                ref={stockChartRef}
                highcharts={Highcharts}
                options={chartOptions}
                containerProps={{ style: { width: '100%', height: '100%' } }}
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-sm text-slate-300">
                {loading ? 'Loading market heatmap...' : 'No heatmap data available.'}
              </div>
            )}
          </div>
        ) : (
          <div className="h-full w-full overflow-hidden rounded-xl border border-white/10 bg-black/35 p-1">
            <MemoizedTradingViewWidget />
          </div>
        )}
      </div>
      {error ? (
        <div className="mt-2 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      ) : null}
    </div>
  );
}
