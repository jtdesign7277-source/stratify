import { useState, useEffect, useRef, useMemo } from 'react';

// ═══════════════════════════════════════════════════════════════════════════════
// TRADINGVIEW WIDGET LOADER
// ═══════════════════════════════════════════════════════════════════════════════
function TradingViewWidget({ scriptSrc, config, containerId, style, className }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = '';

    const widgetContainer = document.createElement('div');
    widgetContainer.className = 'tradingview-widget-container';
    widgetContainer.style.height = '100%';
    widgetContainer.style.width = '100%';

    const widgetInner = document.createElement('div');
    widgetInner.className = 'tradingview-widget-container__widget';
    widgetInner.style.height = '100%';
    widgetInner.style.width = '100%';

    const script = document.createElement('script');
    script.src = scriptSrc;
    script.async = true;
    script.type = 'text/javascript';
    script.innerHTML = JSON.stringify(config);

    widgetContainer.appendChild(widgetInner);
    widgetContainer.appendChild(script);
    containerRef.current.appendChild(widgetContainer);

    return () => {
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
  }, [scriptSrc, JSON.stringify(config)]);

  return (
    <div
      ref={containerRef}
      id={containerId}
      className={className}
      style={{ height: '100%', width: '100%', ...style }}
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CRYPTO COINS CONFIG
// ═══════════════════════════════════════════════════════════════════════════════
const CRYPTO_COINS = [
  { symbol: 'BTC', name: 'Bitcoin', tvSymbol: 'COINBASE:BTCUSD', alpacaSymbol: 'BTC/USD', color: '#F7931A' },
  { symbol: 'ETH', name: 'Ethereum', tvSymbol: 'COINBASE:ETHUSD', alpacaSymbol: 'ETH/USD', color: '#627EEA' },
  { symbol: 'SOL', name: 'Solana', tvSymbol: 'COINBASE:SOLUSD', alpacaSymbol: 'SOL/USD', color: '#9945FF' },
  { symbol: 'XRP', name: 'XRP', tvSymbol: 'BINANCE:XRPUSDT', alpacaSymbol: 'XRP/USD', color: '#00AAE4' },
  { symbol: 'DOGE', name: 'Dogecoin', tvSymbol: 'COINBASE:DOGEUSD', alpacaSymbol: 'DOGE/USD', color: '#C3A634' },
  { symbol: 'LINK', name: 'Chainlink', tvSymbol: 'COINBASE:LINKUSD', alpacaSymbol: 'LINK/USD', color: '#2A5ADA' },
  { symbol: 'ADA', name: 'Cardano', tvSymbol: 'COINBASE:ADAUSD', alpacaSymbol: 'ADA/USD', color: '#0033AD' },
  { symbol: 'AVAX', name: 'Avalanche', tvSymbol: 'COINBASE:AVAXUSD', alpacaSymbol: 'AVAX/USD', color: '#E84142' },
  { symbol: 'DOT', name: 'Polkadot', tvSymbol: 'COINBASE:DOTUSD', alpacaSymbol: 'DOT/USD', color: '#E6007A' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// ALPACA LEVEL 2 ORDERBOOK HOOK
// ═══════════════════════════════════════════════════════════════════════════════
function useAlpacaOrderbook(alpacaSymbol) {
  const [orderbook, setOrderbook] = useState({ bids: [], asks: [] });
  const [connected, setConnected] = useState(false);
  const [trades, setTrades] = useState([]);
  const wsRef = useRef(null);
  const orderbookRef = useRef({ bids: {}, asks: {} });

  useEffect(() => {
    const ALPACA_KEY = import.meta.env.VITE_ALPACA_API_KEY;
    const ALPACA_SECRET = import.meta.env.VITE_ALPACA_SECRET_KEY;

    if (!ALPACA_KEY || !ALPACA_SECRET) {
      console.warn('Alpaca API keys not found - orderbook will use demo data');
      const cleanup = generateDemoOrderbook(alpacaSymbol);
      return () => {
        if (typeof cleanup === 'function') cleanup();
      };
    }

    const ws = new WebSocket('wss://stream.data.alpaca.markets/v1beta3/crypto/us');
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({
        action: 'auth',
        key: ALPACA_KEY,
        secret: ALPACA_SECRET,
      }));
    };

    ws.onmessage = (event) => {
      const messages = JSON.parse(event.data);

      messages.forEach((msg) => {
        if (msg.T === 'success' && msg.msg === 'authenticated') {
          setConnected(true);
          ws.send(JSON.stringify({
            action: 'subscribe',
            orderbooks: [alpacaSymbol],
            trades: [alpacaSymbol],
          }));
        }

        if (msg.T === 'o') {
          const book = orderbookRef.current;

          if (msg.b) {
            msg.b.forEach(({ p, s }) => {
              if (s === 0) delete book.bids[p];
              else book.bids[p] = s;
            });
          }

          if (msg.a) {
            msg.a.forEach(({ p, s }) => {
              if (s === 0) delete book.asks[p];
              else book.asks[p] = s;
            });
          }

          const bids = Object.entries(book.bids)
            .map(([p, s]) => ({ price: parseFloat(p), size: s }))
            .sort((a, b) => b.price - a.price)
            .slice(0, 15);

          const asks = Object.entries(book.asks)
            .map(([p, s]) => ({ price: parseFloat(p), size: s }))
            .sort((a, b) => a.price - b.price)
            .slice(0, 15);

          setOrderbook({ bids, asks });
        }

        if (msg.T === 't') {
          setTrades((prev) => [{
            price: msg.p,
            size: msg.s,
            timestamp: msg.t,
            taker: msg.tks,
          }, ...prev].slice(0, 50));
        }
      });
    };

    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          action: 'unsubscribe',
          orderbooks: [alpacaSymbol],
          trades: [alpacaSymbol],
        }));
      }
      ws.close();
    };
  }, [alpacaSymbol]);

  function generateDemoOrderbook(symbol) {
    setConnected(true);
    const basePrice = symbol === 'BTC/USD' ? 97500 : symbol === 'ETH/USD' ? 3200 : symbol === 'SOL/USD' ? 195 : 1.5;
    const spread = basePrice * 0.0002;

    const interval = setInterval(() => {
      const bids = Array.from({ length: 15 }, (_, i) => ({
        price: parseFloat((basePrice - spread * (i + 1) - Math.random() * spread).toFixed(2)),
        size: parseFloat((Math.random() * 2 + 0.01).toFixed(4)),
      }));

      const asks = Array.from({ length: 15 }, (_, i) => ({
        price: parseFloat((basePrice + spread * (i + 1) + Math.random() * spread).toFixed(2)),
        size: parseFloat((Math.random() * 2 + 0.01).toFixed(4)),
      }));

      setOrderbook({ bids, asks });

      if (Math.random() > 0.5) {
        const isBuy = Math.random() > 0.5;
        setTrades((prev) => [{
          price: isBuy ? asks[0]?.price || basePrice : bids[0]?.price || basePrice,
          size: parseFloat((Math.random() * 0.5 + 0.001).toFixed(4)),
          timestamp: new Date().toISOString(),
          taker: isBuy ? 'B' : 'S',
        }, ...prev].slice(0, 50));
      }
    }, 800);

    return () => clearInterval(interval);
  }

  return { orderbook, connected, trades };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ORDER BOOK COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
function OrderBook({ orderbook, coinSymbol }) {
  const maxBidSize = useMemo(() => Math.max(...orderbook.bids.map((b) => b.size), 0.001), [orderbook.bids]);
  const maxAskSize = useMemo(() => Math.max(...orderbook.asks.map((a) => a.size), 0.001), [orderbook.asks]);

  const formatPrice = (price) => {
    if (price >= 1000) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (price >= 1) return price.toFixed(4);
    return price.toFixed(6);
  };

  const formatSize = (size) => {
    if (size >= 1) return size.toFixed(4);
    return size.toFixed(6);
  };

  const spread = orderbook.asks[0] && orderbook.bids[0]
    ? (orderbook.asks[0].price - orderbook.bids[0].price).toFixed(2)
    : '—';

  const spreadPct = orderbook.asks[0] && orderbook.bids[0]
    ? ((orderbook.asks[0].price - orderbook.bids[0].price) / orderbook.bids[0].price * 100).toFixed(4)
    : '—';

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold tracking-wider uppercase" style={{ color: '#60a5fa' }}>
            Order Book
          </span>
          <span
            className="text-[9px] px-1.5 py-0.5 rounded"
            style={{ background: 'rgba(59, 130, 246, 0.1)', color: 'rgba(96, 165, 250, 0.7)' }}
          >
            Level 2
          </span>
        </div>
        <span className="text-[9px] font-mono" style={{ color: 'rgba(148, 163, 184, 0.4)' }}>
          ${coinSymbol}
        </span>
      </div>

      <div
        className="grid grid-cols-3 px-3 py-1.5 text-[9px] font-semibold tracking-wider uppercase border-b border-white/[0.04]"
        style={{ color: 'rgba(148, 163, 184, 0.35)' }}
      >
        <span>Price</span>
        <span className="text-right">Size</span>
        <span className="text-right">Total</span>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col justify-end">
        {[...orderbook.asks].reverse().map((ask, i) => {
          const barWidth = (ask.size / maxAskSize) * 100;
          return (
            <div
              key={`ask-${i}`}
              className="relative grid grid-cols-3 px-3 py-[3px] text-[11px] font-mono hover:bg-white/[0.02] transition-colors"
            >
              <div
                className="absolute inset-0 right-0 pointer-events-none"
                style={{
                  background: `linear-gradient(to left, rgba(239, 68, 68, 0.08) ${barWidth}%, transparent ${barWidth}%)`,
                }}
              />
              <span className="relative z-10" style={{ color: '#ef4444' }}>{formatPrice(ask.price)}</span>
              <span className="relative z-10 text-right" style={{ color: 'rgba(239, 68, 68, 0.6)' }}>{formatSize(ask.size)}</span>
              <span className="relative z-10 text-right" style={{ color: 'rgba(148, 163, 184, 0.3)' }}>
                {formatPrice(ask.price * ask.size)}
              </span>
            </div>
          );
        })}
      </div>

      <div
        className="flex items-center justify-center gap-3 py-2 border-y border-white/[0.06]"
        style={{ background: 'rgba(255, 255, 255, 0.02)' }}
      >
        <span className="text-[10px] font-mono font-semibold text-white/70">
          ${spread}
        </span>
        <span className="text-[9px] font-mono" style={{ color: 'rgba(148, 163, 184, 0.4)' }}>
          Spread ({spreadPct}%)
        </span>
      </div>

      <div className="flex-1 overflow-hidden">
        {orderbook.bids.map((bid, i) => {
          const barWidth = (bid.size / maxBidSize) * 100;
          return (
            <div
              key={`bid-${i}`}
              className="relative grid grid-cols-3 px-3 py-[3px] text-[11px] font-mono hover:bg-white/[0.02] transition-colors"
            >
              <div
                className="absolute inset-0 right-0 pointer-events-none"
                style={{
                  background: `linear-gradient(to left, rgba(34, 197, 94, 0.08) ${barWidth}%, transparent ${barWidth}%)`,
                }}
              />
              <span className="relative z-10" style={{ color: '#22c55e' }}>{formatPrice(bid.price)}</span>
              <span className="relative z-10 text-right" style={{ color: 'rgba(34, 197, 94, 0.6)' }}>{formatSize(bid.size)}</span>
              <span className="relative z-10 text-right" style={{ color: 'rgba(148, 163, 184, 0.3)' }}>
                {formatPrice(bid.price * bid.size)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// RECENT TRADES COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
function RecentTrades({ trades }) {
  const formatTime = (ts) => {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  const formatPrice = (price) => {
    if (price >= 1000) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (price >= 1) return price.toFixed(4);
    return price.toFixed(6);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06]">
        <span className="text-[10px] font-bold tracking-wider uppercase" style={{ color: '#60a5fa' }}>
          Recent Trades
        </span>
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
        </span>
      </div>

      <div
        className="grid grid-cols-3 px-3 py-1.5 text-[9px] font-semibold tracking-wider uppercase border-b border-white/[0.04]"
        style={{ color: 'rgba(148, 163, 184, 0.35)' }}
      >
        <span>Price</span>
        <span className="text-right">Size</span>
        <span className="text-right">Time</span>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        {trades.map((trade, i) => (
          <div
            key={i}
            className="grid grid-cols-3 px-3 py-[3px] text-[11px] font-mono hover:bg-white/[0.02] transition-colors"
            style={{ animation: i === 0 ? 'tradeFlash 0.5s ease-out' : 'none' }}
          >
            <span style={{ color: trade.taker === 'B' ? '#22c55e' : '#ef4444' }}>
              {formatPrice(trade.price)}
            </span>
            <span className="text-right" style={{ color: 'rgba(148, 163, 184, 0.5)' }}>
              {trade.size?.toFixed(4)}
            </span>
            <span className="text-right" style={{ color: 'rgba(148, 163, 184, 0.3)' }}>
              {formatTime(trade.timestamp)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEPTH CHART COMPONENT (Visual order book depth)
// ═══════════════════════════════════════════════════════════════════════════════
function DepthChart({ orderbook }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || orderbook.bids.length === 0) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const W = rect.width;
    const H = rect.height;

    ctx.clearRect(0, 0, W, H);

    let bidCum = 0;
    const bidData = orderbook.bids.map((b) => {
      bidCum += b.size;
      return { price: b.price, cumSize: bidCum };
    });

    let askCum = 0;
    const askData = orderbook.asks.map((a) => {
      askCum += a.size;
      return { price: a.price, cumSize: askCum };
    });

    const maxCum = Math.max(bidCum, askCum);
    if (maxCum === 0) return;

    const allPrices = [...bidData.map((b) => b.price), ...askData.map((a) => a.price)];
    const minPrice = Math.min(...allPrices);
    const maxPrice = Math.max(...allPrices);
    const priceRange = maxPrice - minPrice || 1;

    const padding = { top: 10, bottom: 20, left: 10, right: 10 };
    const chartW = W - padding.left - padding.right;
    const chartH = H - padding.top - padding.bottom;

    const priceToX = (p) => padding.left + ((p - minPrice) / priceRange) * chartW;
    const sizeToY = (s) => padding.top + chartH - (s / maxCum) * chartH;

    // Bid area (green)
    ctx.beginPath();
    ctx.moveTo(priceToX(bidData[0]?.price || minPrice), padding.top + chartH);
    bidData.forEach((d) => ctx.lineTo(priceToX(d.price), sizeToY(d.cumSize)));
    ctx.lineTo(priceToX(bidData[bidData.length - 1]?.price || minPrice), padding.top + chartH);
    ctx.closePath();
    const bidGrad = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
    bidGrad.addColorStop(0, 'rgba(34, 197, 94, 0.25)');
    bidGrad.addColorStop(1, 'rgba(34, 197, 94, 0.02)');
    ctx.fillStyle = bidGrad;
    ctx.fill();

    ctx.beginPath();
    bidData.forEach((d, i) => {
      if (i === 0) ctx.moveTo(priceToX(d.price), sizeToY(d.cumSize));
      else ctx.lineTo(priceToX(d.price), sizeToY(d.cumSize));
    });
    ctx.strokeStyle = 'rgba(34, 197, 94, 0.8)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Ask area (red)
    ctx.beginPath();
    ctx.moveTo(priceToX(askData[0]?.price || maxPrice), padding.top + chartH);
    askData.forEach((d) => ctx.lineTo(priceToX(d.price), sizeToY(d.cumSize)));
    ctx.lineTo(priceToX(askData[askData.length - 1]?.price || maxPrice), padding.top + chartH);
    ctx.closePath();
    const askGrad = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
    askGrad.addColorStop(0, 'rgba(239, 68, 68, 0.25)');
    askGrad.addColorStop(1, 'rgba(239, 68, 68, 0.02)');
    ctx.fillStyle = askGrad;
    ctx.fill();

    ctx.beginPath();
    askData.forEach((d, i) => {
      if (i === 0) ctx.moveTo(priceToX(d.price), sizeToY(d.cumSize));
      else ctx.lineTo(priceToX(d.price), sizeToY(d.cumSize));
    });
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.8)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Mid line
    const midPrice = (orderbook.bids[0]?.price + orderbook.asks[0]?.price) / 2;
    if (midPrice) {
      ctx.beginPath();
      ctx.moveTo(priceToX(midPrice), padding.top);
      ctx.lineTo(priceToX(midPrice), padding.top + chartH);
      ctx.strokeStyle = 'rgba(96, 165, 250, 0.3)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [orderbook]);

  return <canvas ref={canvasRef} className="w-full h-full" style={{ display: 'block' }} />;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COIN SELECTOR
// ═══════════════════════════════════════════════════════════════════════════════
function CoinSelector({ coins, selected, onSelect }) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto px-3 py-2" style={{ scrollbarWidth: 'none' }}>
      {coins.map((coin) => (
        <button
          key={coin.symbol}
          onClick={() => onSelect(coin)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-200"
          style={{
            background: selected.symbol === coin.symbol ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 255, 255, 0.02)',
            border: selected.symbol === coin.symbol ? '1px solid rgba(59, 130, 246, 0.25)' : '1px solid rgba(255, 255, 255, 0.04)',
            color: selected.symbol === coin.symbol ? '#60a5fa' : 'rgba(148, 163, 184, 0.6)',
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: coin.color }} />
          ${coin.symbol}
        </button>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN CRYPTO PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function CryptoPage() {
  const [selectedCoin, setSelectedCoin] = useState(CRYPTO_COINS[0]);
  const [rightPanel, setRightPanel] = useState('orderbook');
  const { orderbook, connected, trades } = useAlpacaOrderbook(selectedCoin.alpacaSymbol);

  const glassStyle = {
    background: 'rgba(6, 13, 24, 0.6)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
  };

  return (
    <div className="h-full w-full flex flex-col overflow-hidden" style={{ background: 'transparent' }}>
      <div
        className="flex items-center justify-between border-b border-white/[0.06] shrink-0"
        style={{ background: 'rgba(6, 13, 24, 0.4)' }}
      >
        <CoinSelector coins={CRYPTO_COINS} selected={selectedCoin} onSelect={setSelectedCoin} />
        <div className="flex items-center gap-3 px-3">
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5">
              {connected && (
                <span
                  className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                  style={{ backgroundColor: connected ? '#22c55e' : '#ef4444' }}
                />
              )}
              <span
                className="relative inline-flex rounded-full h-1.5 w-1.5"
                style={{ backgroundColor: connected ? '#22c55e' : '#ef4444' }}
              />
            </span>
            <span
              className="text-[9px] font-semibold tracking-wider uppercase"
              style={{ color: connected ? 'rgba(34, 197, 94, 0.7)' : 'rgba(239, 68, 68, 0.7)' }}
            >
              {connected ? 'Live' : 'Disconnected'}
            </span>
          </div>
          <span className="text-[9px]" style={{ color: 'rgba(148, 163, 184, 0.3)' }}>Alpaca L2</span>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden p-3 gap-3">
        <div className="flex-1 flex flex-col gap-3 min-w-0">
          <div className="flex-1 rounded-xl overflow-hidden" style={glassStyle}>
            <TradingViewWidget
              key={selectedCoin.tvSymbol}
              scriptSrc="https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js"
              config={{
                autosize: true,
                symbol: selectedCoin.tvSymbol,
                interval: '15',
                timezone: 'America/New_York',
                theme: 'dark',
                style: '1',
                locale: 'en',
                allow_symbol_change: true,
                calendar: false,
                support_host: 'https://www.tradingview.com',
                backgroundColor: 'rgba(6, 13, 24, 0)',
                gridColor: 'rgba(255, 255, 255, 0.03)',
                hide_volume: false,
                withdateranges: true,
                hide_side_toolbar: false,
                details: true,
                hotlist: true,
              }}
              containerId={`crypto-chart-${selectedCoin.symbol}`}
            />
          </div>

          <div className="h-[140px] rounded-xl overflow-hidden shrink-0" style={glassStyle}>
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold tracking-wider uppercase" style={{ color: '#60a5fa' }}>
                  Market Depth
                </span>
                <span className="text-[9px]" style={{ color: 'rgba(34, 197, 94, 0.6)' }}>Bids</span>
                <span className="text-[9px]" style={{ color: 'rgba(148, 163, 184, 0.3)' }}>/</span>
                <span className="text-[9px]" style={{ color: 'rgba(239, 68, 68, 0.6)' }}>Asks</span>
              </div>
            </div>
            <div style={{ height: 'calc(100% - 32px)' }}>
              <DepthChart orderbook={orderbook} />
            </div>
          </div>
        </div>

        <div className="w-[280px] shrink-0 flex flex-col rounded-xl overflow-hidden" style={glassStyle}>
          <div className="flex border-b border-white/[0.06] shrink-0">
            {[
              { id: 'orderbook', label: 'Book' },
              { id: 'trades', label: 'Trades' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setRightPanel(tab.id)}
                className="flex-1 py-2 text-[10px] font-semibold tracking-wider uppercase transition-all duration-200"
                style={{
                  color: rightPanel === tab.id ? '#60a5fa' : 'rgba(148, 163, 184, 0.4)',
                  borderBottom: rightPanel === tab.id ? '2px solid #3b82f6' : '2px solid transparent',
                  background: rightPanel === tab.id ? 'rgba(59, 130, 246, 0.05)' : 'transparent',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-hidden">
            {rightPanel === 'orderbook' && (
              <OrderBook orderbook={orderbook} coinSymbol={selectedCoin.symbol} />
            )}
            {rightPanel === 'trades' && (
              <RecentTrades trades={trades} />
            )}
          </div>
        </div>
      </div>

      <div className="h-[200px] shrink-0 mx-3 mb-3 rounded-xl overflow-hidden" style={glassStyle}>
        <TradingViewWidget
          scriptSrc="https://s3.tradingview.com/external-embedding/embed-widget-screener.js"
          config={{
            width: '100%',
            height: '100%',
            defaultColumn: 'overview',
            screener_type: 'crypto_mkt',
            displayCurrency: 'USD',
            colorTheme: 'dark',
            locale: 'en',
            isTransparent: true,
          }}
          containerId="crypto-screener"
        />
      </div>

      <style>{`
        @keyframes tradeFlash {
          0% { background-color: rgba(255, 255, 255, 0.06); }
          100% { background-color: transparent; }
        }
      `}</style>
    </div>
  );
}
