import { useRef, useEffect, useState } from 'react';
import { createChart, AreaSeries } from 'lightweight-charts';

const API_URL = 'https://atlas-api-production-5944.up.railway.app';

const PortfolioChart = ({ initialValue = 126093, onSaveSnapshot, className = '' }) => {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const [selectedTimeframe, setSelectedTimeframe] = useState('1M');
  const [currentValue, setCurrentValue] = useState(initialValue);
  const [changeAmount, setChangeAmount] = useState(0);
  const [changePercent, setChangePercent] = useState(0);
  const [historyData, setHistoryData] = useState([]);
  const [loading, setLoading] = useState(true);

  const timeframes = ['1W', '1M', '3M', '6M', '1Y', 'All'];

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

  // Fetch history from API
  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API_URL}/api/portfolio/history?days=730`);
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
          await fetch(`${API_URL}/api/portfolio/snapshot`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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

  // Generate mock data if no history
  const generateMockData = (days) => {
    const data = [];
    let value = initialValue * 0.85;
    const now = new Date();
    
    for (let i = days; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const change = (Math.random() - 0.45) * (value * 0.02);
      value = Math.max(value + change, initialValue * 0.5);
      data.push({
        time: date.toISOString().split('T')[0],
        value: value,
      });
    }
    return data;
  };

  // Load data on mount
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const history = await fetchHistory();
      setLoading(false);
      
      if (history.length === 0) {
        // Use mock data if no history yet
        const mockData = generateMockData(getDaysForTimeframe(selectedTimeframe));
        setHistoryData(mockData.map(d => ({ date: d.time, totalValue: d.value })));
      }
    };
    loadData();
  }, []);

  // Build chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

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

    let filteredData = historyData
      .filter(h => new Date(h.date) >= cutoff)
      .map(h => ({ time: h.date, value: h.totalValue }));

    // If no real data, generate mock
    if (filteredData.length === 0) {
      filteredData = generateMockData(days);
    }

    areaSeries.setData(filteredData);
    chart.timeScale().fitContent();

    if (filteredData.length > 0) {
      const lastValue = filteredData[filteredData.length - 1].value;
      const firstValue = filteredData[0].value;
      setCurrentValue(lastValue);
      setChangeAmount(lastValue - firstValue);
      setChangePercent(((lastValue - firstValue) / firstValue) * 100);
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

  return (
    <div className={className}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="text-sm text-gray-400 mb-1">Total value</div>
          <div className="text-3xl font-bold text-white">{formatCurrency(currentValue)}</div>
          <div className={`text-sm ${changeAmount >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {changeAmount >= 0 ? '+' : ''}{formatCurrency(changeAmount)} ({changePercent >= 0 ? '+' : ''}{changePercent.toFixed(2)}%)
            <span className="text-gray-500 ml-1">
              {historyData.length > 1 ? `· ${historyData.length} days tracked` : '· Demo data'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {timeframes.map((tf) => (
            <button
              key={tf}
              onClick={() => setSelectedTimeframe(tf)}
              className={`px-3 py-1 rounded text-sm font-medium transition-all ${
                selectedTimeframe === tf
                  ? 'bg-purple-500/20 text-purple-400'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>
      <div ref={chartContainerRef} className="w-full" />
    </div>
  );
};

export default PortfolioChart;
