import { useState, useEffect, useRef, useMemo } from 'react';
import { ChevronsLeft, ChevronsRight } from 'lucide-react';
import { subscribeCryptoPrices, getTwelveDataConnectionStatus } from '../../services/twelveDataStream';
import AlpacaOrderTicket from './AlpacaOrderTicket';

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

const CRYPTO_ORDER_TYPE_OPTIONS = [
  { value: 'market', label: 'Market' },
  { value: 'limit', label: 'Limit' },
  { value: 'stop', label: 'Stop' },
  { value: 'stop_limit', label: 'Stop Limit' },
  { value: 'trailing_stop', label: 'Trailing Stop' },
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
const normalizeCryptoSymbol = (symbol = '') => String(symbol || '')
  .trim()
  .toUpperCase()
  .replace(/_/g, '/')  // Convert underscores to forward slash
  .replace(/-/g, '/'); // Convert hyphens to forward slash (normalize to BTC/USD format)

function useAlpacaOrderbook(alpacaSymbol) {
  const [connected, setConnected] = useState(false);
  const [hasRecentMessage, setHasRecentMessage] = useState(false);
  const [lastPrice, setLastPrice] = useState(null);
  const lastPriceRef = useRef(null);
  const heartbeatTimerRef = useRef(null);
  const normalizedSymbol = useMemo(() => normalizeCryptoSymbol(alpacaSymbol), [alpacaSymbol]);

  // Fetch initial price via REST API for instant display (before WebSocket connects)
  useEffect(() => {
    if (!normalizedSymbol) return;
    
    const fetchInitialPrice = async () => {
      try {
        console.log('[CryptoPrice] Fetching initial price for:', normalizedSymbol);
        const response = await fetch(`/api/crypto/twelve-data-price?symbol=${encodeURIComponent(normalizedSymbol)}`);
        
        if (response.ok) {
          const data = await response.json();
          console.log('[CryptoPrice] Received price data:', data);
          
          if (data?.price) {
            const price = Number(data.price);
            if (Number.isFinite(price) && price > 0) {
              console.log('[CryptoPrice] Setting lastPrice to:', price);
              setLastPrice(price);
              lastPriceRef.current = price;
            } else {
              console.warn('[CryptoPrice] Invalid price value:', price);
            }
          } else {
            console.warn('[CryptoPrice] No price in response:', data);
          }
        } else {
          const errorText = await response.text();
          console.error('[CryptoPrice] API error:', response.status, errorText);
        }
      } catch (err) {
        console.error('[CryptoPrice] Failed to fetch initial crypto price:', err);
      }
    };

    fetchInitialPrice();
  }, [normalizedSymbol]);

  const markStreamHeartbeat = () => {
    setHasRecentMessage(true);
    if (heartbeatTimerRef.current) {
      clearTimeout(heartbeatTimerRef.current);
    }
    heartbeatTimerRef.current = setTimeout(() => {
      setHasRecentMessage(false);
      heartbeatTimerRef.current = null;
    }, 15000);
  };

  useEffect(() => {
    setHasRecentMessage(false);
    setLastPrice(null);
    lastPriceRef.current = null;
    if (heartbeatTimerRef.current) {
      clearTimeout(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }

    if (!normalizedSymbol) return undefined;

    console.log('[TwelveData] Subscribing to:', normalizedSymbol);

    // Check connection status periodically
    const statusInterval = setInterval(() => {
      const status = getTwelveDataConnectionStatus();
      setConnected(status.connected);
      if (status.connected) {
        markStreamHeartbeat();
      }
    }, 2000);

    // Subscribe to Twelve Data price updates
    const unsubscribe = subscribeCryptoPrices(normalizedSymbol, (data) => {
      console.log('[TwelveData] Price update:', data);
      markStreamHeartbeat();

      const nextPrice = data.price;
      if (Number.isFinite(nextPrice) && nextPrice > 0) {
        lastPriceRef.current = nextPrice;
        setLastPrice(nextPrice);
      }
    });

    return () => {
      if (heartbeatTimerRef.current) {
        clearTimeout(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
      }
      clearInterval(statusInterval);
      unsubscribe?.();
    };
  }, [normalizedSymbol]);

  return { connected, hasRecentMessage, lastPrice };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ALPACA-STYLE ORDER ENTRY
// ═══════════════════════════════════════════════════════════════════════════════
function OrderEntry({
  selectedCoin,
  lastPrice,
  userId,
  onOrderPlaced,
  onSymbolChange,
  buyingPowerDisplay,
}) {
  const [side, setSide] = useState('buy');
  const [orderType, setOrderType] = useState('market');
  const [sizeMode, setSizeMode] = useState('shares');
  const [quantity, setQuantity] = useState('');
  const [dollarAmount, setDollarAmount] = useState('');
  const [limitPrice, setLimitPrice] = useState('');
  const [stopPrice, setStopPrice] = useState('');
  const [trailAmount, setTrailAmount] = useState('');
  const [trailType, setTrailType] = useState('dollars');
  const [timeInForce, setTimeInForce] = useState('day');
  const [submitting, setSubmitting] = useState(false);
  const [confirmModal, setConfirmModal] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  const referencePrice = useMemo(() => {
    const price =
      orderType === 'market' || orderType === 'trailing_stop'
        ? Number(lastPrice) || 0
        : orderType === 'stop'
          ? parseFloat(stopPrice) || Number(lastPrice) || 0
          : parseFloat(limitPrice) || Number(lastPrice) || 0;
    console.log('[OrderEntry] referencePrice:', price, '(lastPrice:', lastPrice, 'orderType:', orderType, ')');
    return price;
  }, [orderType, limitPrice, stopPrice, lastPrice]);

  const resolvedQuantity = useMemo(() => {
    if (sizeMode === 'shares') {
      return parseFloat(quantity) || 0;
    }
    const dollars = parseFloat(dollarAmount) || 0;
    if (!referencePrice || referencePrice <= 0) return 0;
    return dollars / referencePrice;
  }, [sizeMode, quantity, dollarAmount, referencePrice]);

  const notionalNumber = useMemo(() => {
    const parsed = parseFloat(dollarAmount);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }, [dollarAmount]);

  const estimatedTotal = useMemo(() => {
    if (sizeMode === 'dollars') {
      return notionalNumber;
    }
    return resolvedQuantity * referencePrice;
  }, [sizeMode, notionalNumber, resolvedQuantity, referencePrice]);

  const hasValidOrderSize = sizeMode === 'dollars' ? notionalNumber > 0 : resolvedQuantity > 0;
  const limitPriceNumber = Number(limitPrice);
  const stopPriceNumber = Number(stopPrice);
  const trailAmountNumber = Number(trailAmount);
  const requiresLimit = orderType === 'limit' || orderType === 'stop_limit';
  const requiresStop = orderType === 'stop' || orderType === 'stop_limit';
  const requiresTrail = orderType === 'trailing_stop';

  useEffect(() => {
    let cancelled = false;

    const fetchBuyingPower = async () => {
      try {
        const response = await fetch('/api/account');
        const payload = await response.json();
        if (!response.ok || cancelled) return;
        const buyingPower = payload?.buying_power ?? payload?.cash ?? payload?.buyingPower;
        const parsed = Number(buyingPower);
        if (!Number.isFinite(parsed)) return;
        setBuyingPowerDisplay(new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(parsed));
      } catch {
        if (!cancelled) {
          setBuyingPowerDisplay('$ -');
        }
      }
    };

    fetchBuyingPower();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = () => {
    if (!hasValidOrderSize) return;
    if (requiresLimit && (!Number.isFinite(limitPriceNumber) || limitPriceNumber <= 0)) return;
    if (requiresStop && (!Number.isFinite(stopPriceNumber) || stopPriceNumber <= 0)) return;
    if (requiresTrail && (!Number.isFinite(trailAmountNumber) || trailAmountNumber <= 0)) return;
    setConfirmModal(true);
  };

  const executeOrder = async () => {
    setSubmitting(true);
    setConfirmModal(false);
    const normalizedTimeInForce = String(timeInForce || 'day').toLowerCase() === 'day'
      ? 'gtc'
      : String(timeInForce || 'gtc').toLowerCase();

    const order = {
      symbol: selectedCoin.alpacaSymbol,
      side,
      orderType,
      quantity: resolvedQuantity,
      notionalAmount: sizeMode === 'dollars' ? notionalNumber : null,
      limitPrice: requiresLimit ? limitPriceNumber : null,
      stopPrice: requiresStop ? stopPriceNumber : null,
      ...(requiresTrail
        ? (trailType === 'percent'
          ? { trail_percent: trailAmountNumber }
          : { trail_amount: trailAmountNumber })
        : {}),
      timeInForce: normalizedTimeInForce,
    };

    try {
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      const headers = {
        'Content-Type': 'application/json',
      };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch('/api/crypto/order', {
        method: 'POST',
        headers,
        body: JSON.stringify(order),
      });
      const result = await response.json();

      // Save to Supabase
      if (userId) {
        await saveOrder(userId, { ...order, status: result.success ? 'filled' : 'failed' });
      }

      if (result.success) {
        setLastResult('filled');
        setTimeout(() => setLastResult(null), 3000);
        handleOrderPlaced();
      } else {
        // Show detailed error message
        const errorMsg = result.error || 'Order rejected';
        console.error('Order rejected:', errorMsg);
        
        if (errorMsg.includes('No Alpaca broker connected') || errorMsg.includes('not_connected')) {
          alert('❌ No broker connected\n\nPlease connect your Alpaca paper account in the Portfolio page before trading.');
        } else if (errorMsg.includes('insufficient')) {
          alert(`❌ Order rejected\n\nInsufficient buying power. Check your account balance.`);
        } else if (errorMsg.includes('forbidden') || errorMsg.includes('not authorized')) {
          alert(`❌ Order rejected\n\nYour Alpaca API keys may not have trading permissions. Check your Alpaca dashboard.`);
        } else {
          alert(`❌ Order rejected\n\n${errorMsg}`);
        }
        
        setLastResult('rejected');
        setTimeout(() => setLastResult(null), 3000);
      }
    } catch (err) {
      if (userId) {
        await saveOrder(userId, { ...order, status: 'error' });
      }
      console.error('Order submission error:', err);
      setLastResult('error');
      setTimeout(() => setLastResult(null), 3000);
    }

    setSubmitting(false);
  };

  const fieldClassName =
    'h-[36px] w-full rounded-lg border border-[#1f2a3a] bg-[#050b16] px-3 text-[13px] font-semibold text-white outline-none focus:border-blue-500/60';

  const handleSymbolSubmit = (input) => {
    const normalized = String(input || '')
      .replace(/^\$/, '')
      .replace(/[-/_]/g, '')
      .toUpperCase();
    if (!normalized) return;
    onSymbolChange?.(normalized);
  };

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden">
      <AlpacaOrderTicket
        side={side}
        onSideChange={setSide}
        symbol={`$${selectedCoin.symbol}`}
        onSymbolSubmit={handleSymbolSubmit}
        marketPrice={referencePrice}
        quantity={quantity}
        onQuantityChange={setQuantity}
        orderType={orderType}
        onOrderTypeChange={setOrderType}
        orderTypeOptions={CRYPTO_ORDER_TYPE_OPTIONS}
        sizeMode={sizeMode}
        onSizeModeChange={setSizeMode}
        dollarAmount={dollarAmount}
        onDollarAmountChange={setDollarAmount}
        timeInForce={timeInForce}
        onTimeInForceChange={setTimeInForce}
        timeInForceOptions={[
          { value: 'day', label: 'DAY' },
          { value: 'gtc', label: 'GTC' },
          { value: 'ioc', label: 'IOC' },
        ]}
        estimatedCost={estimatedTotal}
        buyingPowerDisplay={buyingPowerDisplay}
        onReview={handleSubmit}
        reviewDisabled={submitting || !hasValidOrderSize}
        reviewLabel={submitting ? 'Submitting...' : 'Review Order'}
        density="crypto"
        stickyReviewFooter
        className="flex-1 min-h-0"
        extraFields={
          <div className="space-y-1">
            {(orderType === 'limit' || orderType === 'stop_limit') && (
              <div className="space-y-1">
                <label className="block text-[12px] font-semibold text-slate-300">Limit Price</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={limitPrice}
                  onChange={(event) => setLimitPrice(event.target.value)}
                  placeholder={lastPrice ? lastPrice.toFixed(2) : '0.00'}
                  className={fieldClassName}
                />
              </div>
            )}
            {(orderType === 'stop' || orderType === 'stop_limit') && (
              <div className="space-y-1">
                <label className="block text-[12px] font-semibold text-slate-300">Stop Price</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={stopPrice}
                  onChange={(event) => setStopPrice(event.target.value)}
                  placeholder="0.00"
                  className={fieldClassName}
                />
              </div>
            )}
            {orderType === 'trailing_stop' && (
              <div className="space-y-1">
                <div className="grid grid-cols-2 border-b border-white/10">
                  <button
                    type="button"
                    onClick={() => setTrailType('dollars')}
                    className={`py-1 text-[12px] font-semibold transition-colors ${
                      trailType === 'dollars' ? 'border-b-2 border-emerald-500 text-emerald-400' : 'text-gray-500'
                    }`}
                  >
                    $
                  </button>
                  <button
                    type="button"
                    onClick={() => setTrailType('percent')}
                    className={`py-1 text-[12px] font-semibold transition-colors ${
                      trailType === 'percent' ? 'border-b-2 border-emerald-500 text-emerald-400' : 'text-gray-500'
                    }`}
                  >
                    %
                  </button>
                </div>
                <label className="block text-[12px] font-semibold text-slate-300">
                  {trailType === 'percent' ? 'Trail Amount (%)' : 'Trail Amount ($)'}
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={trailAmount}
                  onChange={(event) => setTrailAmount(event.target.value)}
                  placeholder="0.00"
                  className={fieldClassName}
                />
              </div>
            )}
            {sizeMode === 'dollars' && (
              <div className="text-[12px] font-semibold text-slate-300">
                Est. Qty: {resolvedQuantity > 0 ? resolvedQuantity.toFixed(6) : '0.000000'} {selectedCoin.symbol}
              </div>
            )}
          </div>
        }
      />

      {/* ── Order Result Flash ────────────────────────────────── */}
      <div className="px-2">
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
                {side.toUpperCase()} {resolvedQuantity.toFixed(6)} {selectedCoin.symbol} @ {
                  orderType === 'market'
                    ? 'MARKET'
                    : orderType === 'limit'
                      ? `$${limitPrice}`
                      : orderType === 'stop'
                        ? `STOP $${stopPrice}`
                        : orderType === 'stop_limit'
                          ? `STOP $${stopPrice} / LIMIT $${limitPrice}`
                          : trailType === 'percent'
                            ? `TRAIL ${trailAmount}%`
                            : `TRAIL $${trailAmount}`
                }
              </div>
              {sizeMode === 'dollars' && (
                <div className="text-[10px] mt-1" style={{ color: 'rgba(148, 163, 184, 0.45)' }}>
                  From ${notionalNumber.toFixed(2)} notional
                </div>
              )}
            </div>
            <div className="text-center text-lg font-mono font-black" style={{ color: side === 'buy' ? '#22c55e' : '#ef4444' }}>
              ${estimatedTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setConfirmModal(false)}
                className="py-2.5 rounded-lg text-xs font-semibold transition-colors border border-white/10 bg-white/5 text-slate-400 hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-400"
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
export default function CryptoPage({ alpacaData, onOrderPlaced }) {
  const [selectedCoin, setSelectedCoin] = useState(CRYPTO_COINS[0]);
  const [isRightPanelCollapsed, setIsRightPanelCollapsed] = useState(true);
  const [userId, setUserId] = useState(null);
  const [orderHistory, setOrderHistory] = useState([]);
  const { connected, hasRecentMessage, lastPrice } = useAlpacaOrderbook(selectedCoin.alpacaSymbol);
  const streamLive = connected || hasRecentMessage;

  // Extract buying power from Alpaca account data
  const buyingPower = alpacaData?.account?.buying_power || 0;
  const buyingPowerFormatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(buyingPower) || 0);

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

  // Refresh order history after placing
  const handleOrderPlaced = () => {
    if (userId) {
      fetchOrderHistory(userId).then(({ data: orders }) => {
        if (orders) setOrderHistory(orders);
      });
    }
    // Trigger Alpaca data refresh to update buying power
    if (onOrderPlaced) {
      onOrderPlaced();
    }
  };

  const glassStyle = {
    background: 'rgba(6, 13, 24, 0.6)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
  };

  const orderTicketStyle = {
    background: '#060d18',
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
              {streamLive && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                  style={{ backgroundColor: '#22c55e' }}
                />
              )}
              <span className="relative inline-flex rounded-full h-2 w-2"
                style={{ backgroundColor: streamLive ? '#22c55e' : '#ef4444' }}
              />
            </span>
            <span className="text-[10px] font-bold tracking-wider uppercase"
              style={{ color: streamLive ? 'rgba(34, 197, 94, 0.7)' : 'rgba(239, 68, 68, 0.7)' }}
            >
              {streamLive ? 'Live' : 'Offline'}
            </span>
          </div>
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

        {/* ── RIGHT: Order Entry ───────────────────────────────────── */}
        <div
          className={`${isRightPanelCollapsed ? 'w-[42px]' : 'w-[296px]'} shrink-0 flex h-full max-h-[calc(100vh-200px)] min-h-0 flex-col rounded-xl overflow-hidden relative transition-all duration-200`}
          style={orderTicketStyle}
        >
          {isRightPanelCollapsed ? (
            <div className="h-full flex flex-col items-center py-2 gap-2">
              <button
                onClick={() => setIsRightPanelCollapsed(false)}
                className="h-7 w-7 rounded-md text-xs font-bold transition-colors"
                style={{
                  color: 'rgba(148, 163, 184, 0.6)',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
                title="Expand order entry panel"
                aria-label="Expand order entry panel"
              >
                <ChevronsRight className="h-3.5 w-3.5 mx-auto" strokeWidth={1.7} />
              </button>
              <div
                className="text-[9px] font-bold tracking-[0.2em] uppercase"
                style={{
                  color: 'rgba(96, 165, 250, 0.75)',
                  writingMode: 'vertical-rl',
                  textOrientation: 'mixed',
                }}
              >
                Order
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between border-b border-white/[0.06] px-2.5 py-1.5 shrink-0">
                <span
                  className="text-[10px] font-bold tracking-[0.16em] uppercase"
                  style={{ color: 'rgba(96, 165, 250, 0.85)' }}
                >
                  Order Entry
                </span>
                <button
                  onClick={() => setIsRightPanelCollapsed(true)}
                  className="h-7 w-7 flex items-center justify-center rounded transition-colors hover:bg-white/[0.03]"
                  style={{ color: 'rgba(148, 163, 184, 0.55)' }}
                  title="Collapse order entry panel"
                  aria-label="Collapse order entry panel"
                >
                  <ChevronsLeft className="h-4 w-4" strokeWidth={1.7} />
                </button>
              </div>

              <div className="flex-1 min-h-0 overflow-hidden">
                <OrderEntry
                  selectedCoin={selectedCoin}
                  lastPrice={lastPrice}
                  userId={userId}
                  onOrderPlaced={handleOrderPlaced}
                  buyingPowerDisplay={buyingPowerFormatted}
                  onSymbolChange={(symbolInput) => {
                    const normalized = String(symbolInput || '').toUpperCase();
                    const nextCoin = CRYPTO_COINS.find((coin) =>
                      coin.symbol === normalized ||
                      `${coin.symbol}USD` === normalized
                    );
                    if (nextCoin) {
                      handleCoinSelect(nextCoin);
                    }
                  }}
                />
              </div>
            </>
          )}
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
