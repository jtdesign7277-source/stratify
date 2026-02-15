import { useRef, useEffect, useState } from 'react';
import { createChart, AreaSeries } from 'lightweight-charts';
import { supabase } from '../../lib/supabaseClient';

const API_URL = 'https://stratify-backend-production-3ebd.up.railway.app';

const PortfolioChart = ({ initialValue = 0, onSaveSnapshot, className = '' }) => {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const [selectedTimeframe, setSelectedTimeframe] = useState('1M');
  const [currentValue, setCurrentValue] = useState(initialValue);
  const [changeAmount, setChangeAmount] = useState(0);
  const [changePercent, setChangePercent] = useState(0);
  const [historyData, setHistoryData] = useState([]);
  const [loading, setLoading] = useState(true);

  const timeframes = ['1D', '1W', '1M', '3M', '6M', '1Y', 'All'];

  const getDaysForTimeframe = (tf) => {
    switch (tf) {
      case '1W': return 7;
      case '1M': return 30;
      case '3M': return 90;
      case '6M': return 180;
      case '1Y': return 365;
      case 'All': return 9999;
      default: return 30;
    }
  };

  const getAccessToken = async () => {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.error('Error loading Supabase session:', error);
        return null;
      }
      return data?.session?.access_token || null;
    } catch (error) {
      console.error('Error loading Supabase session:', error);
      return null;
    }
  };

  // Fetch history from API
  const fetchHistory = async () => {
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        return [];
      }

      const res = await fetch(`${API_URL}/api/portfolio/history?days=730`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch history: ${res.status}`);
      }
      const data = await res.json();
      if (data.history && data.history.length > 0) {
        setHistoryData(data.history);
        return data.history;
      }
    } catch (err) {
      console.error('Error fetching portfolio history:', err);
    }
    return [];
  };

  // Save snapshot on load (once per day)
  useEffect(() => {
    const saveSnapshot = async () => {
      const lastSave = localStorage.getItem('lastPortfolioSnapshot');
      const today = new Date().toISOString().split('T')[0];
      
      if (lastSave !== today && initialValue > 0) {
        try {
          const accessToken = await getAccessToken();
          if (!accessToken) return;

          await fetch(`${API_URL}/api/portfolio/snapshot`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              totalValue: initialValue,
              dailyPnL: 0,
              accounts: ['alpaca'],
            }),
          });
          localStorage.setItem('lastPortfolioSnapshot', today);
          console.log('Portfolio snapshot saved');
        } catch (err) {
          console.error('Error saving snapshot:', err);
        }
      }
    };

    if (initialValue > 0) {
      saveSnapshot();
    }
  }, [initialValue]);

  // Load data on mount
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const history = await fetchHistory();
      setLoading(false);

      if (history.length === 0) {
        setCurrentValue(initialValue > 0 ? initialValue : 0);
        setChangeAmount(0);
        setChangePercent(0);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    if (historyData.length === 0) {
      setCurrentValue(initialValue > 0 ? initialValue : 0);
    }
  }, [historyData.length, initialValue]);

  // Build chart
  useEffect(() => {
    if (!chartContainerRef.current || historyData.length === 0) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: 'solid', color: 'transparent' },
        textColor: '#9ca3af',
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 220,
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderVisible: false,
        timeVisible: false,
      },
      crosshair: {
        vertLine: { color: 'rgba(139, 92, 246, 0.5)', width: 1, style: 2 },
        horzLine: { color: 'rgba(139, 92, 246, 0.5)', width: 1, style: 2 },
      },
      handleScroll: false,
      handleScale: false,
    });

    const areaSeries = chart.addSeries(AreaSeries, {
      lineColor: '#8B5CF6',
      topColor: 'rgba(139, 92, 246, 0.4)',
      bottomColor: 'rgba(139, 92, 246, 0.0)',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,
    });

    chartRef.current = chart;
    seriesRef.current = areaSeries;

    // Filter data by timeframe
    const days = getDaysForTimeframe(selectedTimeframe);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const filteredData = historyData
      .filter(h => new Date(h.date) >= cutoff)
      .map(h => ({ time: h.date, value: h.totalValue }));

    areaSeries.setData(filteredData);
    chart.timeScale().fitContent();

    if (filteredData.length > 0) {
      const lastValue = filteredData[filteredData.length - 1].value;
      const firstValue = filteredData[0].value;
      setCurrentValue(lastValue);
      setChangeAmount(lastValue - firstValue);
      setChangePercent(firstValue !== 0 ? ((lastValue - firstValue) / firstValue) * 100 : 0);
    } else {
      setCurrentValue(initialValue > 0 ? initialValue : 0);
      setChangeAmount(0);
      setChangePercent(0);
    }

    chart.subscribeCrosshairMove((param) => {
      if (param.time && param.seriesData.size > 0) {
        const value = param.seriesData.get(areaSeries);
        if (value) {
          setCurrentValue(value.value);
        }
      } else if (filteredData.length > 0) {
        setCurrentValue(filteredData[filteredData.length - 1].value);
      }
    });

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [selectedTimeframe, historyData, initialValue]);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const hasHistoryData = historyData.length > 0;
  const totalValueDisplay = hasHistoryData ? formatCurrency(currentValue) : '-$0.00';

  return (
    <div className={className}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="text-sm text-gray-400 mb-1">Total value</div>
          <div className="text-3xl font-bold text-white">{totalValueDisplay}</div>
          {hasHistoryData ? (
            <div className={`text-sm ${changeAmount >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {changeAmount >= 0 ? '+' : ''}{formatCurrency(changeAmount)} ({changePercent >= 0 ? '+' : ''}{changePercent.toFixed(2)}%)
              <span className="text-white/50 ml-1">
                {historyData.length > 1 ? `· ${historyData.length} days tracked` : '· 1 day tracked'}
              </span>
            </div>
          ) : (
            <div className="text-sm text-white/50">-$0.00 - Connect a broker to get started</div>
          )}
        </div>
        <div className="flex items-center gap-1">
          {timeframes.map((tf) => (
            <button
              key={tf}
              onClick={() => setSelectedTimeframe(tf)}
              className={`px-3 py-1 rounded text-sm font-medium transition-all ${
                selectedTimeframe === tf
                  ? 'bg-purple-500/20 text-purple-400'
                  : 'text-white/50 hover:text-gray-300'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>
      {loading ? (
        <div className="h-[220px] w-full flex items-center justify-center text-sm text-white/40">
          Loading portfolio history...
        </div>
      ) : hasHistoryData ? (
        <div ref={chartContainerRef} className="w-full" />
      ) : (
        <div className="h-[220px] w-full rounded-lg border border-dashed border-white/10 bg-white/[0.02] flex items-center justify-center text-center text-sm text-white/55 px-6">
          Connect a broker to get started
        </div>
      )}
    </div>
  );
};

export default PortfolioChart;
