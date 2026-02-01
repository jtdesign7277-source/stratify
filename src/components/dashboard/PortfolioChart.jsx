import { useRef, useEffect, useState } from 'react';
import { createChart } from 'lightweight-charts';

const PortfolioChart = ({ initialValue = 126093, className = '' }) => {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const [selectedTimeframe, setSelectedTimeframe] = useState('1M');
  const [currentValue, setCurrentValue] = useState(initialValue);
  const [changeAmount, setChangeAmount] = useState(0);
  const [changePercent, setChangePercent] = useState(0);

  const timeframes = ['1W', '1M', '3M', '6M', '1Y', 'All'];

  // Generate mock portfolio data
  const generateData = (days) => {
    const data = [];
    let value = initialValue * 0.85; // Start lower so we show growth
    const now = new Date();
    
    for (let i = days; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      
      // Random daily change between -2% and +3% (slight upward bias)
      const change = (Math.random() - 0.45) * 0.04;
      value = value * (1 + change);
      
      data.push({
        time: date.toISOString().split('T')[0],
        value: Math.round(value * 100) / 100
      });
    }
    
    // Ensure last value matches current portfolio value
    if (data.length > 0) {
      data[data.length - 1].value = initialValue;
    }
    
    return data;
  };

  const getDataForTimeframe = (timeframe) => {
    switch (timeframe) {
      case '1W': return generateData(7);
      case '1M': return generateData(30);
      case '3M': return generateData(90);
      case '6M': return generateData(180);
      case '1Y': return generateData(365);
      case 'All': return generateData(730);
      default: return generateData(30);
    }
  };

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: 'solid', color: 'transparent' },
        textColor: '#9ca3af',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: 'rgba(139, 92, 246, 0.5)',
          width: 1,
          style: 2,
        },
        horzLine: {
          color: 'rgba(139, 92, 246, 0.5)',
          width: 1,
          style: 2,
        },
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: false,
      handleScale: false,
    });

    // Create area series with purple/blue gradient
    const series = chart.addAreaSeries({
      lineColor: 'rgba(139, 92, 246, 1)',
      topColor: 'rgba(139, 92, 246, 0.4)',
      bottomColor: 'rgba(139, 92, 246, 0.0)',
      lineWidth: 2,
      priceFormat: {
        type: 'custom',
        formatter: (price) => '$' + price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      },
    });

    chartRef.current = chart;
    seriesRef.current = series;

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, []);

  // Update data when timeframe changes
  useEffect(() => {
    if (!seriesRef.current) return;

    const data = getDataForTimeframe(selectedTimeframe);
    seriesRef.current.setData(data);

    // Calculate change
    if (data.length > 1) {
      const startValue = data[0].value;
      const endValue = data[data.length - 1].value;
      const change = endValue - startValue;
      const percent = ((endValue - startValue) / startValue) * 100;
      
      setCurrentValue(endValue);
      setChangeAmount(change);
      setChangePercent(percent);
    }

    // Fit content
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  }, [selectedTimeframe, initialValue]);

  const isPositive = changeAmount >= 0;

  return (
    <div className={`flex flex-col ${className}`}>
      {/* Header with value */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <p className="text-gray-400 text-sm">Total value</p>
          <p className="text-white text-3xl font-semibold">
            ${currentValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            <span className="text-gray-400 text-lg ml-1">USD</span>
          </p>
          <p className={`text-sm ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
            {isPositive ? '+' : ''}{changeAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({isPositive ? '+' : ''}{changePercent.toFixed(2)}%)
          </p>
        </div>
        
        {/* Timeframe buttons */}
        <div className="flex gap-1">
          {timeframes.map((tf) => (
            <button
              key={tf}
              onClick={() => setSelectedTimeframe(tf)}
              className={`px-3 py-1 text-sm rounded transition-all ${
                selectedTimeframe === tf
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Chart container */}
      <div 
        ref={chartContainerRef} 
        className="w-full h-64 rounded-lg"
      />
    </div>
  );
};

export default PortfolioChart;
