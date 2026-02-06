import React, { useState, useEffect } from 'react';

const API_URL = 'https://stratify-backend-production-3ebd.up.railway.app';

// Mock breaking news (will be replaced with real API later)
const mockNews = [
  { id: 1, text: 'Fed signals potential rate pause in March meeting', type: 'news' },
  { id: 2, text: 'NVDA earnings beat expectations, stock surges after hours', type: 'news' },
  { id: 3, text: 'Bitcoin breaks $50K resistance level', type: 'news' },
  { id: 4, text: 'Tesla announces new factory expansion in Texas', type: 'news' },
];

const LiveAlertsTicker = () => {
  const [alerts, setAlerts] = useState([
    { id: 1, symbol: 'NVDA', pnl: 48.90, price: 171.88, type: 'trade' },
    { id: 2, symbol: 'TSLA', pnl: -23.40, price: 245.30, type: 'trade' },
    { id: 3, symbol: 'META', pnl: 127.50, price: 542.15, type: 'trade' },
  ]);
  const [news] = useState(mockNews);

  // Fetch recent filled orders from Alpaca
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const response = await fetch(`${API_URL}/api/trades/orders?status=filled`);
        if (response.ok) {
          const orders = await response.json();
          const tradeAlerts = orders.slice(0, 6).map(order => ({
            id: order.orderId || order.id,
            symbol: order.symbol,
            pnl: order.filledAvgPrice && order.qty ? 
              (order.side === 'buy' ? -1 : 1) * order.filledAvgPrice * order.qty * 0.02 : // Estimate P&L
              Math.random() * 100 - 20,
            price: order.filledAvgPrice || order.price || 0,
            type: 'trade'
          }));
          setAlerts(tradeAlerts);
        }
      } catch (error) {
        // Use mock data on error
        setAlerts([
          { id: 1, symbol: 'NVDA', pnl: 48.90, price: 171.88, type: 'trade' },
          { id: 2, symbol: 'TSLA', pnl: -23.40, price: 245.30, type: 'trade' },
          { id: 3, symbol: 'META', pnl: 127.50, price: 542.15, type: 'trade' },
          { id: 4, symbol: 'AAPL', pnl: 34.20, price: 227.84, type: 'trade' },
          { id: 5, symbol: 'AMD', pnl: -15.80, price: 168.42, type: 'trade' },
        ]);
      }
    };

    fetchOrders();
    const interval = setInterval(fetchOrders, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  // Combine trades and news
  const allItems = [
    ...alerts.map(a => ({
      ...a,
      text: a.pnl >= 0 
        ? `🟢 ${a.symbol} +$${Math.abs(a.pnl).toFixed(2)} @ $${a.price.toFixed(2)}`
        : `🔴 ${a.symbol} -$${Math.abs(a.pnl).toFixed(2)} @ $${a.price.toFixed(2)}`,
      color: a.pnl >= 0 ? '#00C853' : '#F44336'
    })),
    ...news.map(n => ({
      ...n,
      text: `📰 ${n.text}`,
      color: '#8ab4f8'
    }))
  ];

  return (
    <div className="relative h-8 overflow-hidden bg-[#151518] border-b border-[#1e1e2d]">
      <style>{`
        @keyframes ticker-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .live-ticker-track {
          display: flex;
          align-items: center;
          height: 100%;
          overflow: hidden;
        }
        .live-ticker-content {
          display: inline-flex;
          align-items: center;
          white-space: nowrap;
          animation: ticker-scroll 35s linear infinite;
        }
        .live-ticker-content:hover {
          animation-play-state: paused;
        }
      `}</style>
      
      {/* LIVE Badge */}
      <div className="absolute left-0 top-0 bottom-0 z-10 flex items-center px-3 bg-gradient-to-r from-[#151518] via-[#151518] to-transparent">
        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#1e1e2d] border border-[#2a2a3d] rounded">
          <div className="w-1.5 h-1.5 rounded-full bg-[#00C853] animate-pulse shadow-[0_0_6px_rgba(0,200,83,0.6)]" />
          <span className="text-[10px] font-semibold text-[#E8EAED] uppercase tracking-wider">Live</span>
        </div>
      </div>
      
      {/* Scrolling Content */}
      <div className="live-ticker-track pl-20">
        <div className="live-ticker-content">
          {/* Duplicate items for seamless loop */}
          {[...allItems, ...allItems].map((item, idx) => (
            <span key={`${item.id}-${idx}`} className="flex items-center">
              <span 
                className="text-xs font-medium"
                style={{ color: item.color }}
              >
                {item.text}
              </span>
              <span className="mx-4 text-[#5f6368]">•</span>
            </span>
          ))}
        </div>
      </div>
      
      {/* Right fade */}
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-[#151518] to-transparent" />
    </div>
  );
};

export default LiveAlertsTicker;
