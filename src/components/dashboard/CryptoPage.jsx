import { useState, useEffect, useRef, useMemo } from 'react';

// ═══════════════════════════════════════════════════════════════════════════════
// SUPABASE CLIENT (uses existing app client)
// ═══════════════════════════════════════════════════════════════════════════════
import { supabase } from '../../lib/supabaseClient';

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
    <div ref={containerRef} id={containerId} className={className}
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
// SUPABASE HOOKS — User data persistence
// ═══════════════════════════════════════════════════════════════════════════════

// Save order to Supabase
async function saveOrder(userId, order) {
  const { data, error } = await supabase
    .from('crypto_orders')
    .insert({
      user_id: userId,
      symbol: order.symbol,
      side: order.side,
      order_type: order.orderType,
      quantity: order.quantity,
      limit_price: order.limitPrice || null,
      stop_price: order.stopPrice || null,
      time_in_force: order.timeInForce,
      status: 'submitted',
      created_at: new Date().toISOString(),
    })
    .select();
  return { data, error };
}

// Fetch user's order history
async function fetchOrderHistory(userId) {
  const { data, error } = await supabase
    .from('crypto_orders')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  return { data: data || [], error };
}

// Save user's last selected coin preference
async function saveUserPreference(userId, coinSymbol) {
  const { error } = await supabase
    .from('user_preferences')
    .upsert({
      user_id: userId,
      crypto_default_coin: coinSymbol,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
  return { error };
}

// Load user preferences
async function loadUserPreference(userId) {
  const { data, error } = await supabase
    .from('user_preferences')
    .select('crypto_default_coin')
    .eq('user_id', userId)
    .single();
  return { data, error };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ALPACA LEVEL 2 ORDERBOOK HOOK
// ═══════════════════════════════════════════════════════════════════════════════
function useAlpacaOrderbook(alpacaSymbol) {
  const [orderbook, setOrderbook] = useState({ bids: [], asks: [] });
  const [connected, setConnected] = useState(false);
  const [trades, setTrades] = useState([]);
  const [lastPrice, setLastPrice] = useState(null);
  const [priceDirection, setPriceDirection] = useState(null);
  const wsRef = useRef(null);
  const orderbookRef = useRef({ bids: {}, asks: {} });
  const lastPriceRef = useRef(null);

  useEffect(() => {
    orderbookRef.current = { bids: {}, asks: {} };
    setOrderbook({ bids: [], asks: [] });
    setTrades([]);
    setLastPrice(null);

    const ALPACA_KEY = import.meta.env.VITE_ALPACA_API_KEY;
    const ALPACA_SECRET = import.meta.env.VITE_ALPACA_SECRET_KEY;

    if (!ALPACA_KEY || !ALPACA_SECRET) {
      console.warn('Alpaca keys not found — using demo data');
      const cleanup = generateDemoOrderbook(alpacaSymbol);
      return cleanup;
    }

    const ws = new WebSocket('wss://stream.data.alpaca.markets/v1beta3/crypto/us');
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ action: 'auth', key: ALPACA_KEY, secret: ALPACA_SECRET }));
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
          if (msg.b) msg.b.forEach(({ p, s }) => { if (s === 0) delete book.bids[p]; else book.bids[p] = s; });
          if (msg.a) msg.a.forEach(({ p, s }) => { if (s === 0) delete book.asks[p]; else book.asks[p] = s; });

          const bids = Object.entries(book.bids)
            .map(([p, s]) => ({ price: parseFloat(p), size: s }))
            .sort((a, b) => b.price - a.price).slice(0, 20);
          const asks = Object.entries(book.asks)
            .map(([p, s]) => ({ price: parseFloat(p), size: s }))
            .sort((a, b) => a.price - b.price).slice(0, 20);

          setOrderbook({ bids, asks });
        }

        if (msg.T === 't') {
          const newPrice = msg.p;
          if (lastPriceRef.current !== null) {
            setPriceDirection(newPrice > lastPriceRef.current ? 'up' : newPrice < lastPriceRef.current ? 'down' : null);
          }
          lastPriceRef.current = newPrice;
          setLastPrice(newPrice);

          setTrades((prev) => [{
            price: msg.p, size: msg.s, timestamp: msg.t, taker: msg.tks,
          }, ...prev].slice(0, 100));
        }
      });
    };

    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ action: 'unsubscribe', orderbooks: [alpacaSymbol], trades: [alpacaSymbol] }));
        ws.close();
      }
    };
  }, [alpacaSymbol]);

  function generateDemoOrderbook(symbol) {
    setConnected(true);
    const basePrice = symbol === 'BTC/USD' ? 97500 : symbol === 'ETH/USD' ? 3200 : symbol === 'SOL/USD' ? 195 : symbol === 'XRP/USD' ? 2.45 : symbol === 'DOGE/USD' ? 0.32 : 1.50;
    const spread = basePrice * 0.0002;
    lastPriceRef.current = basePrice;
    setLastPrice(basePrice);

    const interval = setInterval(() => {
      const bids = Array.from({ length: 20 }, (_, i) => ({
        price: parseFloat((basePrice - spread * (i + 1) - Math.random() * spread).toFixed(2)),
        size: parseFloat((Math.random() * 3 + 0.01).toFixed(4)),
      }));
      const asks = Array.from({ length: 20 }, (_, i) => ({
        price: parseFloat((basePrice + spread * (i + 1) + Math.random() * spread).toFixed(2)),
        size: parseFloat((Math.random() * 3 + 0.01).toFixed(4)),
      }));
      setOrderbook({ bids, asks });

      if (Math.random() > 0.4) {
        const isBuy = Math.random() > 0.5;
        const newPrice = isBuy ? asks[0]?.price || basePrice : bids[0]?.price || basePrice;
        if (lastPriceRef.current !== null) {
          setPriceDirection(newPrice > lastPriceRef.current ? 'up' : newPrice < lastPriceRef.current ? 'down' : null);
        }
        lastPriceRef.current = newPrice;
        setLastPrice(newPrice);
        setTrades((prev) => [{
          price: newPrice,
          size: parseFloat((Math.random() * 0.8 + 0.001).toFixed(4)),
          timestamp: new Date().toISOString(),
          taker: isBuy ? 'B' : 'S',
        }, ...prev].slice(0, 100));
      }
    }, 600);

    return () => clearInterval(interval);
  }

  return { orderbook, connected, trades, lastPrice, priceDirection };
}

// ═══════════════════════════════════════════════════════════════════════════════
// THINKORSWIM-STYLE LEVEL 2 ORDER BOOK
// ═══════════════════════════════════════════════════════════════════════════════
function Level2Book({ orderbook, coinSymbol, lastPrice, priceDirection, onPriceClick }) {
  const maxBidSize = useMemo(() => Math.max(...orderbook.bids.map((b) => b.size), 0.001), [orderbook.bids]);
  const maxAskSize = useMemo(() => Math.max(...orderbook.asks.map((a) => a.size), 0.001), [orderbook.asks]);

  const formatPrice = (price) => {
    if (price >= 1000) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (price >= 1) return price.toFixed(4);
    return price.toFixed(6);
  };

  const formatSize = (size) => {
    if (size >= 100) return size.toFixed(2);
    if (size >= 1) return size.toFixed(4);
    return size.toFixed(6);
  };

  const spread = orderbook.asks[0] && orderbook.bids[0]
    ? (orderbook.asks[0].price - orderbook.bids[0].price)
    : 0;

  const spreadPct = orderbook.asks[0] && orderbook.bids[0]
    ? ((spread / orderbook.bids[0].price) * 100)
    : 0;

  return (
    <div className="flex flex-col h-full select-none">
      {/* Header — ToS style */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.08]"
        style={{ background: 'rgba(6, 13, 24, 0.8)' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold tracking-wider uppercase" style={{ color: '#60a5fa' }}>
            Level II
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded font-semibold"
            style={{ background: 'rgba(59, 130, 246, 0.12)', color: 'rgba(96, 165, 250, 0.8)' }}
          >
            DOM
          </span>
        </div>
        <span className="text-xs font-mono font-bold" style={{ color: 'rgba(148, 163, 184, 0.5)' }}>
          ${coinSymbol}/USD
        </span>
      </div>

      {/* Column Headers — ToS style wider */}
      <div className="grid px-4 py-2 text-[10px] font-bold tracking-widest uppercase border-b border-white/[0.06]"
        style={{ color: 'rgba(148, 163, 184, 0.4)', gridTemplateColumns: '1fr 100px 100px' }}
      >
        <span>Bid Size</span>
        <span className="text-center">Price</span>
        <span className="text-right">Ask Size</span>
      </div>

      {/* Asks — reversed (lowest at bottom near spread) */}
      <div className="flex-1 overflow-hidden flex flex-col justify-end">
        {[...orderbook.asks].reverse().slice(0, 12).map((ask, i) => {
          const barWidth = (ask.size / maxAskSize) * 100;
          return (
            <div
              key={`ask-${i}`}
              className="relative grid px-4 py-[5px] text-[13px] font-mono cursor-pointer hover:bg-white/[0.04] transition-colors"
              style={{ gridTemplateColumns: '1fr 100px 100px' }}
              onClick={() => onPriceClick(ask.price)}
            >
              {/* Ask bar from right */}
              <div className="absolute top-0 bottom-0 right-0 pointer-events-none"
                style={{
                  width: `${barWidth * 0.45}%`,
                  background: 'linear-gradient(to left, rgba(239, 68, 68, 0.15), rgba(239, 68, 68, 0.03))',
                }}
              />
              <span className="relative z-10" style={{ color: 'rgba(148, 163, 184, 0.15)' }}></span>
              <span className="relative z-10 text-center font-semibold" style={{ color: '#ef4444' }}>
                {formatPrice(ask.price)}
              </span>
              <span className="relative z-10 text-right font-semibold" style={{ color: 'rgba(239, 68, 68, 0.7)' }}>
                {formatSize(ask.size)}
              </span>
            </div>
          );
        })}
      </div>

      {/* ── Spread / Last Price Bar (ToS center strip) ──────────── */}
      <div className="flex items-center justify-between px-4 py-3 border-y border-white/[0.08]"
        style={{ background: 'rgba(6, 13, 24, 0.9)' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold tracking-wider uppercase"
            style={{ color: 'rgba(148, 163, 184, 0.4)' }}
          >
            Last
          </span>
          <span className="text-lg font-mono font-black"
            style={{
              color: priceDirection === 'up' ? '#22c55e' : priceDirection === 'down' ? '#ef4444' : '#e2e8f0',
              textShadow: priceDirection === 'up'
                ? '0 0 12px rgba(34, 197, 94, 0.3)'
                : priceDirection === 'down'
                  ? '0 0 12px rgba(239, 68, 68, 0.3)'
                  : 'none',
            }}
          >
            {lastPrice ? formatPrice(lastPrice) : '—'}
          </span>
          {priceDirection && (
            <span style={{ color: priceDirection === 'up' ? '#22c55e' : '#ef4444', fontSize: '14px' }}>
              {priceDirection === 'up' ? '▲' : '▼'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono" style={{ color: 'rgba(148, 163, 184, 0.4)' }}>
            Spread
          </span>
          <span className="text-xs font-mono font-bold" style={{ color: 'rgba(148, 163, 184, 0.6)' }}>
            ${spread.toFixed(2)} ({spreadPct.toFixed(3)}%)
          </span>
        </div>
      </div>

      {/* Bids */}
      <div className="flex-1 overflow-hidden">
        {orderbook.bids.slice(0, 12).map((bid, i) => {
          const barWidth = (bid.size / maxBidSize) * 100;
          return (
            <div
              key={`bid-${i}`}
              className="relative grid px-4 py-[5px] text-[13px] font-mono cursor-pointer hover:bg-white/[0.04] transition-colors"
              style={{ gridTemplateColumns: '1fr 100px 100px' }}
              onClick={() => onPriceClick(bid.price)}
            >
              {/* Bid bar from left */}
              <div className="absolute top-0 bottom-0 left-0 pointer-events-none"
                style={{
                  width: `${barWidth * 0.45}%`,
                  background: 'linear-gradient(to right, rgba(34, 197, 94, 0.15), rgba(34, 197, 94, 0.03))',
                }}
              />
              <span className="relative z-10 font-semibold" style={{ color: 'rgba(34, 197, 94, 0.7)' }}>
                {formatSize(bid.size)}
              </span>
              <span className="relative z-10 text-center font-semibold" style={{ color: '#22c55e' }}>
                {formatPrice(bid.price)}
              </span>
              <span className="relative z-10 text-right" style={{ color: 'rgba(148, 163, 184, 0.15)' }}></span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// THINKORSWIM-STYLE ORDER ENTRY
// ═══════════════════════════════════════════════════════════════════════════════
function OrderEntry({ selectedCoin, lastPrice, userId, onOrderPlaced }) {
  const [side, setSide] = useState('buy');
  const [orderType, setOrderType] = useState('market');
  const [quantity, setQuantity] = useState('');
  const [limitPrice, setLimitPrice] = useState('');
  const [stopPrice, setStopPrice] = useState('');
  const [timeInForce, setTimeInForce] = useState('gtc');
  const [submitting, setSubmitting] = useState(false);
  const [confirmModal, setConfirmModal] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  // Auto-fill limit price from L2 click
  useEffect(() => {
    if (window.__cryptoClickedPrice) {
      setLimitPrice(window.__cryptoClickedPrice.toString());
      setOrderType('limit');
      window.__cryptoClickedPrice = null;
    }
  });

  const estimatedTotal = useMemo(() => {
    const qty = parseFloat(quantity) || 0;
    const price = orderType === 'market' ? (lastPrice || 0) : (parseFloat(limitPrice) || 0);
    return qty * price;
  }, [quantity, limitPrice, lastPrice, orderType]);

  const handleSubmit = () => {
    if (!quantity || parseFloat(quantity) <= 0) return;
    if (orderType === 'limit' && (!limitPrice || parseFloat(limitPrice) <= 0)) return;
    if (orderType === 'stop_limit' && (!stopPrice || parseFloat(stopPrice) <= 0)) return;
    setConfirmModal(true);
  };

  const executeOrder = async () => {
    setSubmitting(true);
    setConfirmModal(false);

    const order = {
      symbol: selectedCoin.alpacaSymbol,
      side,
      orderType,
      quantity: parseFloat(quantity),
      limitPrice: orderType !== 'market' ? parseFloat(limitPrice) : null,
      stopPrice: orderType === 'stop_limit' ? parseFloat(stopPrice) : null,
      timeInForce,
    };

    // Submit to Alpaca via your backend
    try {
      const response = await fetch('/api/crypto/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order),
      });
      const result = await response.json();

      // Save to Supabase
      if (userId) {
        await saveOrder(userId, { ...order, status: result.success ? 'filled' : 'failed' });
      }

      setLastResult(result.success ? 'filled' : 'rejected');
      setTimeout(() => setLastResult(null), 3000);

      if (result.success && onOrderPlaced) onOrderPlaced();
    } catch (err) {
      // Still save to Supabase as attempted
      if (userId) {
        await saveOrder(userId, { ...order, status: 'error' });
      }
      setLastResult('error');
      setTimeout(() => setLastResult(null), 3000);
    }

    setSubmitting(false);
  };

  const inputStyle = {
    background: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    color: '#e2e8f0',
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.08]"
        style={{ background: 'rgba(6, 13, 24, 0.8)' }}
      >
        <span className="text-xs font-bold tracking-wider uppercase" style={{ color: '#60a5fa' }}>
          Order Entry
        </span>
        <span className="text-xs font-mono font-bold" style={{ color: 'rgba(148, 163, 184, 0.5)' }}>
          ${selectedCoin.symbol}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ scrollbarWidth: 'none' }}>

        {/* ── Buy / Sell Toggle ─────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-1 p-1 rounded-lg" style={{ background: 'rgba(255, 255, 255, 0.03)' }}>
          <button
            onClick={() => setSide('buy')}
            className="py-2.5 rounded-md text-sm font-bold tracking-wide transition-all duration-200"
            style={{
              background: side === 'buy' ? 'rgba(34, 197, 94, 0.2)' : 'transparent',
              color: side === 'buy' ? '#22c55e' : 'rgba(148, 163, 184, 0.4)',
              border: side === 'buy' ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid transparent',
              boxShadow: side === 'buy' ? '0 0 20px rgba(34, 197, 94, 0.1)' : 'none',
            }}
          >
            BUY
          </button>
          <button
            onClick={() => setSide('sell')}
            className="py-2.5 rounded-md text-sm font-bold tracking-wide transition-all duration-200"
            style={{
              background: side === 'sell' ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
              color: side === 'sell' ? '#ef4444' : 'rgba(148, 163, 184, 0.4)',
              border: side === 'sell' ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid transparent',
              boxShadow: side === 'sell' ? '0 0 20px rgba(239, 68, 68, 0.1)' : 'none',
            }}
          >
            SELL
          </button>
        </div>

        {/* ── Order Type ───────────────────────────────────────── */}
        <div>
          <label className="block text-[10px] font-bold tracking-widest uppercase mb-1.5"
            style={{ color: 'rgba(148, 163, 184, 0.4)' }}
          >
            Order Type
          </label>
          <div className="grid grid-cols-3 gap-1">
            {[
              { id: 'market', label: 'Market' },
              { id: 'limit', label: 'Limit' },
              { id: 'stop_limit', label: 'Stop Lmt' },
            ].map((type) => (
              <button
                key={type.id}
                onClick={() => setOrderType(type.id)}
                className="py-2 rounded-md text-[11px] font-semibold tracking-wide transition-all"
                style={{
                  background: orderType === type.id ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                  color: orderType === type.id ? '#60a5fa' : 'rgba(148, 163, 184, 0.5)',
                  border: orderType === type.id ? '1px solid rgba(59, 130, 246, 0.25)' : '1px solid rgba(255, 255, 255, 0.06)',
                }}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Quantity ─────────────────────────────────────────── */}
        <div>
          <label className="block text-[10px] font-bold tracking-widest uppercase mb-1.5"
            style={{ color: 'rgba(148, 163, 184, 0.4)' }}
          >
            Quantity ({selectedCoin.symbol})
          </label>
          <input
            type="number"
            step="any"
            min="0"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="0.00"
            className="w-full px-3 py-2.5 rounded-lg text-sm font-mono focus:outline-none focus:ring-1 focus:ring-blue-500/50"
            style={inputStyle}
          />
          {/* Quick amount buttons */}
          <div className="grid grid-cols-4 gap-1 mt-1.5">
            {['0.001', '0.01', '0.1', '1'].map((amt) => (
              <button
                key={amt}
                onClick={() => setQuantity(amt)}
                className="py-1 rounded text-[10px] font-mono transition-colors hover:bg-white/[0.06]"
                style={{ background: 'rgba(255, 255, 255, 0.03)', color: 'rgba(148, 163, 184, 0.5)', border: '1px solid rgba(255, 255, 255, 0.05)' }}
              >
                {amt}
              </button>
            ))}
          </div>
        </div>

        {/* ── Limit Price (shown for limit & stop_limit) ───────── */}
        {(orderType === 'limit' || orderType === 'stop_limit') && (
          <div>
            <label className="block text-[10px] font-bold tracking-widest uppercase mb-1.5"
              style={{ color: 'rgba(148, 163, 184, 0.4)' }}
            >
              Limit Price (USD)
            </label>
            <input
              type="number"
              step="any"
              min="0"
              value={limitPrice}
              onChange={(e) => setLimitPrice(e.target.value)}
              placeholder={lastPrice ? lastPrice.toFixed(2) : '0.00'}
              className="w-full px-3 py-2.5 rounded-lg text-sm font-mono focus:outline-none focus:ring-1 focus:ring-blue-500/50"
              style={inputStyle}
            />
          </div>
        )}

        {/* ── Stop Price (shown for stop_limit) ─────────────────── */}
        {orderType === 'stop_limit' && (
          <div>
            <label className="block text-[10px] font-bold tracking-widest uppercase mb-1.5"
              style={{ color: 'rgba(148, 163, 184, 0.4)' }}
            >
              Stop Price (USD)
            </label>
            <input
              type="number"
              step="any"
              min="0"
              value={stopPrice}
              onChange={(e) => setStopPrice(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2.5 rounded-lg text-sm font-mono focus:outline-none focus:ring-1 focus:ring-blue-500/50"
              style={inputStyle}
            />
          </div>
        )}

        {/* ── Time in Force ─────────────────────────────────────── */}
        <div>
          <label className="block text-[10px] font-bold tracking-widest uppercase mb-1.5"
            style={{ color: 'rgba(148, 163, 184, 0.4)' }}
          >
            Time in Force
          </label>
          <div className="grid grid-cols-2 gap-1">
            {[
              { id: 'gtc', label: 'GTC' },
              { id: 'ioc', label: 'IOC' },
            ].map((tif) => (
              <button
                key={tif.id}
                onClick={() => setTimeInForce(tif.id)}
                className="py-2 rounded-md text-[11px] font-semibold tracking-wide transition-all"
                style={{
                  background: timeInForce === tif.id ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                  color: timeInForce === tif.id ? '#60a5fa' : 'rgba(148, 163, 184, 0.5)',
                  border: timeInForce === tif.id ? '1px solid rgba(59, 130, 246, 0.25)' : '1px solid rgba(255, 255, 255, 0.06)',
                }}
              >
                {tif.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Order Summary ─────────────────────────────────────── */}
        <div className="rounded-lg p-3 space-y-2" style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
          <div className="flex justify-between text-[11px]">
            <span style={{ color: 'rgba(148, 163, 184, 0.4)' }}>Side</span>
            <span className="font-semibold" style={{ color: side === 'buy' ? '#22c55e' : '#ef4444' }}>
              {side.toUpperCase()}
            </span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span style={{ color: 'rgba(148, 163, 184, 0.4)' }}>Type</span>
            <span className="font-semibold" style={{ color: '#e2e8f0' }}>
              {orderType === 'stop_limit' ? 'Stop Limit' : orderType.charAt(0).toUpperCase() + orderType.slice(1)}
            </span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span style={{ color: 'rgba(148, 163, 184, 0.4)' }}>Est. Total</span>
            <span className="font-mono font-bold" style={{ color: '#e2e8f0' }}>
              ${estimatedTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* ── Submit Button ─────────────────────────────────────── */}
        <button
          onClick={handleSubmit}
          disabled={submitting || !quantity}
          className="w-full py-3 rounded-lg text-sm font-bold tracking-wide transition-all duration-200"
          style={{
            background: side === 'buy'
              ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.3), rgba(34, 197, 94, 0.15))'
              : 'linear-gradient(135deg, rgba(239, 68, 68, 0.3), rgba(239, 68, 68, 0.15))',
            color: side === 'buy' ? '#22c55e' : '#ef4444',
            border: side === 'buy' ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
            boxShadow: side === 'buy' ? '0 4px 24px rgba(34, 197, 94, 0.15)' : '0 4px 24px rgba(239, 68, 68, 0.15)',
            opacity: submitting || !quantity ? 0.4 : 1,
            cursor: submitting || !quantity ? 'not-allowed' : 'pointer',
          }}
        >
          {submitting ? 'Submitting...' : `${side.toUpperCase()} ${selectedCoin.symbol}`}
        </button>

        {/* ── Order Result Flash ────────────────────────────────── */}
        {lastResult && (
          <div className="text-center text-xs font-semibold py-2 rounded-lg animate-pulse"
            style={{
              background: lastResult === 'filled' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              color: lastResult === 'filled' ? '#22c55e' : '#ef4444',
              border: `1px solid ${lastResult === 'filled' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
            }}
          >
            {lastResult === 'filled' ? 'Order Filled ✓' : lastResult === 'rejected' ? 'Order Rejected ✗' : 'Connection Error ✗'}
          </div>
        )}
      </div>

      {/* ── Confirmation Modal ──────────────────────────────────── */}
      {confirmModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(4px)' }}
        >
          <div className="w-[280px] rounded-xl p-5 space-y-4"
            style={{ background: 'rgba(10, 22, 40, 0.98)', border: '1px solid rgba(255, 255, 255, 0.1)' }}
          >
            <div className="text-center">
              <div className="text-sm font-bold mb-1" style={{ color: '#e2e8f0' }}>Confirm Order</div>
              <div className="text-[11px]" style={{ color: 'rgba(148, 163, 184, 0.5)' }}>
                {side.toUpperCase()} {quantity} ${selectedCoin.symbol} @ {orderType === 'market' ? 'MARKET' : `$${limitPrice}`}
              </div>
            </div>
            <div className="text-center text-lg font-mono font-black" style={{ color: side === 'buy' ? '#22c55e' : '#ef4444' }}>
              ${estimatedTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setConfirmModal(false)}
                className="py-2.5 rounded-lg text-xs font-semibold transition-colors"
                style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'rgba(148, 163, 184, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)' }}
              >
                Cancel
              </button>
              <button
                onClick={executeOrder}
                className="py-2.5 rounded-lg text-xs font-bold transition-colors"
                style={{
                  background: side === 'buy' ? 'rgba(34, 197, 94, 0.25)' : 'rgba(239, 68, 68, 0.25)',
                  color: side === 'buy' ? '#22c55e' : '#ef4444',
                  border: side === 'buy' ? '1px solid rgba(34, 197, 94, 0.4)' : '1px solid rgba(239, 68, 68, 0.4)',
                }}
              >
                Confirm {side.toUpperCase()}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// RECENT TRADES TAPE
// ═══════════════════════════════════════════════════════════════════════════════
function TradesTape({ trades }) {
  const formatTime = (ts) => new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const formatPrice = (p) => p >= 1000 ? p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : p >= 1 ? p.toFixed(4) : p.toFixed(6);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.08]"
        style={{ background: 'rgba(6, 13, 24, 0.8)' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold tracking-wider uppercase" style={{ color: '#60a5fa' }}>
            Time &amp; Sales
          </span>
        </div>
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
        </span>
      </div>

      <div className="grid grid-cols-3 px-4 py-1.5 text-[10px] font-bold tracking-widest uppercase border-b border-white/[0.06]"
        style={{ color: 'rgba(148, 163, 184, 0.4)' }}
      >
        <span>Price</span>
        <span className="text-right">Size</span>
        <span className="text-right">Time</span>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        {trades.map((trade, i) => (
          <div key={i} className="grid grid-cols-3 px-4 py-[4px] text-[13px] font-mono hover:bg-white/[0.03] transition-colors"
            style={{ animation: i === 0 ? 'tradeFlash 0.6s ease-out' : 'none' }}
          >
            <span className="font-semibold" style={{ color: trade.taker === 'B' ? '#22c55e' : '#ef4444' }}>
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
// COIN SELECTOR BAR
// ═══════════════════════════════════════════════════════════════════════════════
function CoinSelector({ coins, selected, onSelect }) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto px-4 py-2.5" style={{ scrollbarWidth: 'none' }}>
      {coins.map((coin) => (
        <button
          key={coin.symbol}
          onClick={() => onSelect(coin)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all duration-200"
          style={{
            background: selected.symbol === coin.symbol ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 255, 255, 0.02)',
            border: selected.symbol === coin.symbol ? '1px solid rgba(59, 130, 246, 0.25)' : '1px solid rgba(255, 255, 255, 0.04)',
            color: selected.symbol === coin.symbol ? '#60a5fa' : 'rgba(148, 163, 184, 0.5)',
          }}
        >
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: coin.color }} />
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
  const [rightTab, setRightTab] = useState('l2'); // 'l2' | 'trades' | 'order'
  const [userId, setUserId] = useState(null);
  const [orderHistory, setOrderHistory] = useState([]);
  const { orderbook, connected, trades, lastPrice, priceDirection } = useAlpacaOrderbook(selectedCoin.alpacaSymbol);

  // Get current user from Supabase auth
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setUserId(data.user.id);
        // Load user's preferred coin
        loadUserPreference(data.user.id).then(({ data: pref }) => {
          if (pref?.crypto_default_coin) {
            const coin = CRYPTO_COINS.find((c) => c.symbol === pref.crypto_default_coin);
            if (coin) setSelectedCoin(coin);
          }
        });
        // Load order history
        fetchOrderHistory(data.user.id).then(({ data: orders }) => {
          if (orders) setOrderHistory(orders);
        });
      }
    });
  }, []);

  // Save preference when coin changes
  const handleCoinSelect = (coin) => {
    setSelectedCoin(coin);
    if (userId) saveUserPreference(userId, coin.symbol);
  };

  // Handle price click from L2 → auto-fill order entry
  const handlePriceClick = (price) => {
    window.__cryptoClickedPrice = price;
    setRightTab('order');
  };

  // Refresh order history after placing
  const handleOrderPlaced = () => {
    if (userId) {
      fetchOrderHistory(userId).then(({ data: orders }) => {
        if (orders) setOrderHistory(orders);
      });
    }
  };

  const glassStyle = {
    background: 'rgba(6, 13, 24, 0.6)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
  };

  return (
    <div className="h-full w-full flex flex-col overflow-hidden" style={{ background: 'transparent' }}>
      {/* ── Top Bar ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-white/[0.06] shrink-0"
        style={{ background: 'rgba(6, 13, 24, 0.4)' }}
      >
        <CoinSelector coins={CRYPTO_COINS} selected={selectedCoin} onSelect={handleCoinSelect} />
        <div className="flex items-center gap-3 px-4">
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              {connected && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                  style={{ backgroundColor: '#22c55e' }}
                />
              )}
              <span className="relative inline-flex rounded-full h-2 w-2"
                style={{ backgroundColor: connected ? '#22c55e' : '#ef4444' }}
              />
            </span>
            <span className="text-[10px] font-bold tracking-wider uppercase"
              style={{ color: connected ? 'rgba(34, 197, 94, 0.7)' : 'rgba(239, 68, 68, 0.7)' }}
            >
              {connected ? 'Live' : 'Offline'}
            </span>
          </div>
          <span className="text-[10px] font-mono" style={{ color: 'rgba(148, 163, 184, 0.25)' }}>
            Alpaca L2 WebSocket
          </span>
        </div>
      </div>

      {/* ── Main Content ──────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden p-3 gap-3">

        {/* ── LEFT: TradingView Chart (bigger now) ────────────────── */}
        <div className="flex-1 rounded-xl overflow-hidden min-w-0" style={glassStyle}>
          <TradingViewWidget
            key={selectedCoin.tvSymbol}
            scriptSrc="https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js"
            config={{
              autosize: true,
              symbol: selectedCoin.tvSymbol,
              interval: "15",
              timezone: "America/New_York",
              theme: "dark",
              style: "1",
              locale: "en",
              allow_symbol_change: true,
              calendar: false,
              support_host: "https://www.tradingview.com",
              backgroundColor: "rgba(6, 13, 24, 0)",
              gridColor: "rgba(255, 255, 255, 0.03)",
              hide_volume: false,
              withdateranges: true,
              hide_side_toolbar: false,
              details: true,
              hotlist: true,
            }}
            containerId={`crypto-chart-${selectedCoin.symbol}`}
          />
        </div>

        {/* ── RIGHT: L2 / Trades / Order Entry (tabbed) ───────────── */}
        <div className="w-[340px] shrink-0 flex flex-col rounded-xl overflow-hidden relative" style={glassStyle}>
          {/* Tab Bar */}
          <div className="flex border-b border-white/[0.06] shrink-0">
            {[
              { id: 'l2', label: 'Level II' },
              { id: 'trades', label: 'T&S' },
              { id: 'order', label: 'Order' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setRightTab(tab.id)}
                className="flex-1 py-2.5 text-[10px] font-bold tracking-wider uppercase transition-all duration-200"
                style={{
                  color: rightTab === tab.id ? '#60a5fa' : 'rgba(148, 163, 184, 0.35)',
                  borderBottom: rightTab === tab.id ? '2px solid #3b82f6' : '2px solid transparent',
                  background: rightTab === tab.id ? 'rgba(59, 130, 246, 0.05)' : 'transparent',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-hidden">
            {rightTab === 'l2' && (
              <Level2Book
                orderbook={orderbook}
                coinSymbol={selectedCoin.symbol}
                lastPrice={lastPrice}
                priceDirection={priceDirection}
                onPriceClick={handlePriceClick}
              />
            )}
            {rightTab === 'trades' && (
              <TradesTape trades={trades} />
            )}
            {rightTab === 'order' && (
              <OrderEntry
                selectedCoin={selectedCoin}
                lastPrice={lastPrice}
                userId={userId}
                onOrderPlaced={handleOrderPlaced}
              />
            )}
          </div>
        </div>
      </div>

      {/* Animations */}
      <style>{`
        @keyframes tradeFlash {
          0% { background-color: rgba(255, 255, 255, 0.06); }
          100% { background-color: transparent; }
        }
      `}</style>
    </div>
  );
}
