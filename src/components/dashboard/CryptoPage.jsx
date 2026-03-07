import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from "framer-motion";
import { ChevronsLeft, ChevronsRight } from 'lucide-react';
import { subscribeCryptoPrices, getTwelveDataConnectionStatus } from '../../services/twelveDataStream';
import AlpacaOrderTicket from './AlpacaOrderTicket';
import { usePaperTrading } from '../../hooks/usePaperTrading';

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
    const el = containerRef.current;
    if (!el) return;
    el.innerHTML = '';

    const mount = () => {
      if (!el.isConnected) return;
      el.innerHTML = '';
      const widgetContainer = document.createElement('div');
      widgetContainer.className = 'tradingview-widget-container';
      widgetContainer.style.height = '100%';
      widgetContainer.style.width = '100%';
      widgetContainer.style.minHeight = '400px';

      const widgetInner = document.createElement('div');
      widgetInner.className = 'tradingview-widget-container__widget';
      widgetInner.style.height = '100%';
      widgetInner.style.width = '100%';
      widgetInner.style.minHeight = '400px';

      const script = document.createElement('script');
      script.src = scriptSrc;
      script.async = true;
      script.type = 'text/javascript';
      script.innerHTML = JSON.stringify(config);

      widgetContainer.appendChild(widgetInner);
      widgetContainer.appendChild(script);
      el.appendChild(widgetContainer);
    };

    const raf = requestAnimationFrame(() => {
      mount();
    });

    return () => {
      cancelAnimationFrame(raf);
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
  }, [scriptSrc, JSON.stringify(config)]);

  return (
    <div
      ref={containerRef}
      id={containerId}
      className={className}
      style={{ height: '100%', width: '100%', minHeight: '400px', ...style }}
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CRYPTO COINS CONFIG
// ═══════════════════════════════════════════════════════════════════════════════
const CRYPTO_COINS = [
  { symbol: 'BTC', name: 'Bitcoin', tvSymbol: 'COINBASE:BTCUSD', tradeSymbol: 'BTC/USD', color: '#F7931A' },
  { symbol: 'ETH', name: 'Ethereum', tvSymbol: 'COINBASE:ETHUSD', tradeSymbol: 'ETH/USD', color: '#627EEA' },
  { symbol: 'SOL', name: 'Solana', tvSymbol: 'COINBASE:SOLUSD', tradeSymbol: 'SOL/USD', color: '#9945FF' },
  { symbol: 'XRP', name: 'XRP', tvSymbol: 'BINANCE:XRPUSDT', tradeSymbol: 'XRP/USD', color: '#00AAE4' },
  { symbol: 'DOGE', name: 'Dogecoin', tvSymbol: 'COINBASE:DOGEUSD', tradeSymbol: 'DOGE/USD', color: '#C3A634' },
  { symbol: 'LINK', name: 'Chainlink', tvSymbol: 'COINBASE:LINKUSD', tradeSymbol: 'LINK/USD', color: '#2A5ADA' },
  { symbol: 'ADA', name: 'Cardano', tvSymbol: 'COINBASE:ADAUSD', tradeSymbol: 'ADA/USD', color: '#0033AD' },
  { symbol: 'AVAX', name: 'Avalanche', tvSymbol: 'COINBASE:AVAXUSD', tradeSymbol: 'AVAX/USD', color: '#E84142' },
  { symbol: 'DOT', name: 'Polkadot', tvSymbol: 'COINBASE:DOTUSD', tradeSymbol: 'DOT/USD', color: '#E6007A' },
];

const CRYPTO_ORDER_TYPE_OPTIONS = [
  { value: 'market', label: 'Market' },
  { value: 'limit', label: 'Limit' },
  { value: 'stop', label: 'Stop' },
  { value: 'stop_limit', label: 'Stop Limit' },
  { value: 'trailing_stop', label: 'Trailing Stop' },
];

const listItemMotion = (index) => ({
  initial: { opacity: 0, x: -8 },
  animate: { opacity: 1, x: 0 },
  transition: { delay: index * 0.03, duration: 0.25 },
});

const interactiveTransition = { type: 'spring', stiffness: 400, damping: 25 };

const modalBackdropMotion = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.2 },
};

const modalPanelMotion = {
  initial: { opacity: 0, scale: 0.95, y: 10 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.95, y: 10 },
  transition: { type: 'spring', stiffness: 300, damping: 25 },
};

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
// LEVEL 2 ORDERBOOK HOOK
// ═══════════════════════════════════════════════════════════════════════════════
const normalizeCryptoSymbol = (symbol = '') => String(symbol || '')
  .trim()
  .toUpperCase()
  .replace(/_/g, '/')  // Convert underscores to forward slash
  .replace(/-/g, '/'); // Convert hyphens to forward slash (normalize to BTC/USD format)

const toPaperSymbolKey = (value = '') =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

const matchesPaperSymbol = (positionSymbol, candidates = []) => {
  const positionKey = toPaperSymbolKey(positionSymbol);
  if (!positionKey) return false;
  return candidates.some((candidate) => toPaperSymbolKey(candidate) === positionKey);
};

const formatPaperSymbol = (value = '') => {
  const normalized = normalizeCryptoSymbol(value);
  if (!normalized) return '$--';
  if (normalized.includes('/')) return `$${normalized.split('/')[0]}`;
  if (normalized.endsWith('USD') && normalized.length <= 6) return `$${normalized.slice(0, -3)}`;
  return `$${normalized}`;
};

const formatPaperCurrency = (value) => {
  const parsed = Number(value);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(parsed) ? parsed : 0);
};

const formatSignedPaperCurrency = (value) => {
  const parsed = Number(value);
  const amount = Number.isFinite(parsed) ? parsed : 0;
  const sign = amount > 0 ? '+' : amount < 0 ? '-' : '';
  return `${sign}${formatPaperCurrency(Math.abs(amount))}`;
};

const formatPaperQuantity = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '0';
  return parsed.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: parsed >= 1000 ? 2 : 6,
  });
};

const formatPaperTimestamp = (value) => {
  const parsed = new Date(value || Date.now());
  if (Number.isNaN(parsed.getTime())) return '--';
  return parsed.toLocaleString([], {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

function useCryptoOrderbook(tradeSymbol) {
  const [connected, setConnected] = useState(false);
  const [hasRecentMessage, setHasRecentMessage] = useState(false);
  const [lastPrice, setLastPrice] = useState(null);
  const lastPriceRef = useRef(null);
  const heartbeatTimerRef = useRef(null);
  const normalizedSymbol = useMemo(() => normalizeCryptoSymbol(tradeSymbol), [tradeSymbol]);

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
// ORDER ENTRY
// ═══════════════════════════════════════════════════════════════════════════════
function OrderEntry({
  selectedCoin,
  lastPrice,
  onOrderPlaced,
  onSymbolChange,
}) {
  const {
    portfolio,
    trades,
    trading,
    error,
    executeTrade,
    closePosition,
    fetchPortfolio,
  } = usePaperTrading();
  const normalizedTradingMode = 'paper';
  const isLiveMode = false;
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
  const [confirmModal, setConfirmModal] = useState(false);
  const [confirmCloseModal, setConfirmCloseModal] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [inlineError, setInlineError] = useState('');
  const [successToast, setSuccessToast] = useState('');
  const liveMarketPrice = Number(lastPrice) || 0;
  const symbolForTrade = normalizeCryptoSymbol(selectedCoin?.tradeSymbol || selectedCoin?.symbol || '');
  const positionCandidates = useMemo(() => ([
    symbolForTrade,
    selectedCoin?.symbol,
    `${selectedCoin?.symbol || ''}/USD`,
    `${selectedCoin?.symbol || ''}USD`,
  ]).filter(Boolean), [selectedCoin?.symbol, symbolForTrade]);

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
  const positions = Array.isArray(portfolio?.positions) ? portfolio.positions : [];
  const selectedPosition = useMemo(
    () => positions.find((position) => matchesPaperSymbol(position?.symbol, positionCandidates)) || null,
    [positionCandidates, positions]
  );
  const hasSelectedPosition = Number(selectedPosition?.quantity) > 0;
  const holdings = useMemo(
    () => (Array.isArray(positions) ? positions.slice(0, 5) : []),
    [positions]
  );
  const { totalHoldingsValue, holdingsPercentOfAccount } = useMemo(() => {
    let total = 0;
    holdings.forEach((position) => {
      const qty = Number(position.quantity) || 0;
      const val = Number(position.market_value);
      const price = Number(position.current_price) || Number(position.avg_cost_basis) || 0;
      total += Number.isFinite(val) && val > 0 ? val : qty * price;
    });
    const cash = Number(portfolio?.cash_balance || 0);
    const accountValue = total + cash;
    const percent = accountValue > 0 ? (total / accountValue) * 100 : 0;
    return { totalHoldingsValue: total, holdingsPercentOfAccount: percent };
  }, [holdings, portfolio?.cash_balance]);
  const accountBuyingPowerDisplay = formatPaperCurrency(portfolio?.cash_balance);
  const availableCash = Number(portfolio?.cash_balance || 0);
  const selectedPositionQtyOwned = Number(selectedPosition?.quantity || 0);
  const executionPrice = liveMarketPrice > 0 ? liveMarketPrice : referencePrice;
  const accountBadgeColorClass = isLiveMode ? 'text-emerald-400' : 'text-cyan-400';
  const accountBadgeText = isLiveMode ? 'Live Account' : 'Paper Account';

  useEffect(() => {
    if (!successToast) return undefined;
    const timer = setTimeout(() => setSuccessToast(''), 2800);
    return () => clearTimeout(timer);
  }, [successToast]);

  const getValidationError = () => {
    if (!symbolForTrade) return 'Select a symbol first.';
    if (trading) return 'Trade is already executing.';
    if (!hasValidOrderSize || !Number.isFinite(resolvedQuantity) || resolvedQuantity <= 0) {
      return 'Quantity must be greater than 0.';
    }
    if (!Number.isFinite(executionPrice) || executionPrice <= 0) {
      return 'Live market price is unavailable.';
    }

    if (side === 'buy') {
      const totalCost = resolvedQuantity * executionPrice;
      if (totalCost > availableCash) {
        return `Insufficient cash. Available: ${formatPaperCurrency(availableCash)}`;
      }
      return '';
    }

    if (resolvedQuantity > selectedPositionQtyOwned) {
      return `Insufficient shares. Owned: ${formatPaperQuantity(selectedPositionQtyOwned)}.`;
    }

    return '';
  };

  const handleSubmit = () => {
    const validationError = getValidationError();
    if (validationError) {
      setInlineError(validationError);
      return;
    }
    setInlineError('');
    setConfirmModal(true);
  };

  const executeOrder = async () => {
    const validationError = getValidationError();
    if (validationError) {
      setInlineError(validationError);
      return;
    }
    setConfirmModal(false);

    try {
      const result = await executeTrade({
        symbol: symbolForTrade,
        side,
        quantity: resolvedQuantity,
        price: executionPrice,
      });

      await fetchPortfolio({ silent: true });

      setLastResult('filled');
      setTimeout(() => setLastResult(null), 3000);
      setInlineError('');
      const actionLabel = side === 'buy' ? 'Bought' : 'Sold';
      const totalCost = resolvedQuantity * executionPrice;
      setSuccessToast(
        `${actionLabel} ${formatPaperQuantity(resolvedQuantity)} ${formatPaperSymbol(symbolForTrade)} @ ${formatPaperCurrency(executionPrice)} · Total: ${formatPaperCurrency(totalCost)}`
      );
      onOrderPlaced?.(result);
      if (sizeMode === 'shares') {
        setQuantity('');
      } else {
        setDollarAmount('');
      }
    } catch (err) {
      console.error('Order submission error:', err);
      setInlineError(String(err?.message || 'Trade rejected.'));
      setLastResult('rejected');
      setTimeout(() => setLastResult(null), 3000);
    }
  };

  const requestClosePosition = () => {
    if (!hasSelectedPosition || trading) return;
    setInlineError('');
    setConfirmCloseModal(true);
  };

  const handleClosePosition = async () => {
    if (!hasSelectedPosition || trading) return;
    const closingSymbol = selectedPosition?.symbol || symbolForTrade;
    const closingQuantity = Number(selectedPosition?.quantity || 0);
    setConfirmCloseModal(false);
    try {
      await closePosition(closingSymbol);
      await fetchPortfolio({ silent: true });
      setLastResult('filled');
      setTimeout(() => setLastResult(null), 3000);
      setInlineError('');
      setSuccessToast(
        `Sold ${formatPaperQuantity(closingQuantity)} ${formatPaperSymbol(closingSymbol)} @ MARKET`
      );
      onOrderPlaced?.({
        symbol: closingSymbol,
        side: 'sell',
        quantity: closingQuantity,
      });
    } catch (closeError) {
      console.error('Close position failed:', closeError);
      setInlineError(String(closeError?.message || 'Close position failed.'));
      setLastResult('rejected');
      setTimeout(() => setLastResult(null), 3000);
    }
  };

  const selectedPositionSymbol = String(selectedPosition?.symbol || symbolForTrade || '').replace('/USD', '');
  const selectedPositionQty = Number(selectedPosition?.quantity || 0);
  const selectedPositionAvgCost = Number(
    selectedPosition?.avg_cost_basis
    ?? selectedPosition?.avg_entry_price
    ?? selectedPosition?.avgCost
    ?? 0
  );
  const selectedPositionLivePrice = liveMarketPrice > 0
    ? liveMarketPrice
    : Number(selectedPosition?.current_price || 0);
  const selectedPositionValue = selectedPositionQty > 0 && selectedPositionLivePrice > 0
    ? selectedPositionQty * selectedPositionLivePrice
    : Number(selectedPosition?.market_value || 0);
  const selectedPositionCostBasis = selectedPositionQty > 0 && selectedPositionAvgCost > 0
    ? selectedPositionQty * selectedPositionAvgCost
    : 0;
  const selectedPositionPnl = selectedPositionCostBasis > 0
    ? selectedPositionValue - selectedPositionCostBasis
    : Number(selectedPosition?.pnl || 0);
  const selectedPositionPnlPercent = selectedPositionCostBasis > 0
    ? (selectedPositionPnl / selectedPositionCostBasis) * 100
    : Number(selectedPosition?.pnl_percent || 0);
  const selectedPositionPnlClass = selectedPositionPnl >= 0 ? 'text-emerald-400' : 'text-red-400';
  const showSellAllButton = hasSelectedPosition && side === 'sell';
  const selectedPositionSummary = hasSelectedPosition ? (
    <div className="rounded-md border border-white/10 bg-transparent px-2 py-1 text-[11px]">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 space-y-0.5">
          <div className="truncate text-slate-300">
            Position: {formatPaperQuantity(selectedPosition.quantity)} {selectedPositionSymbol} · Avg {formatPaperCurrency(selectedPosition.avg_cost_basis)}
          </div>
          <div className="truncate text-slate-400">
            Value: {formatPaperCurrency(selectedPositionValue)}
          </div>
          <div className={`truncate font-semibold ${selectedPositionPnlClass}`}>
            P&L: {formatSignedPaperCurrency(selectedPositionPnl)} ({selectedPositionPnlPercent > 0 ? '+' : ''}{selectedPositionPnlPercent.toFixed(2)}%)
          </div>
        </div>
        {showSellAllButton ? (
          <button
            type="button"
            onClick={requestClosePosition}
            disabled={trading}
            className="shrink-0 rounded border border-red-500/30 px-2 py-0.5 text-[10px] font-semibold text-red-300 transition-colors hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {trading ? 'Executing...' : 'Sell All'}
          </button>
        ) : null}
      </div>
    </div>
  ) : null;

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
    <div className="relative flex min-h-full flex-col overflow-y-auto">
      <AlpacaOrderTicket
        side={side}
        onSideChange={setSide}
        symbol={`$${selectedCoin.symbol}`}
        onSymbolSubmit={handleSymbolSubmit}
        marketPrice={liveMarketPrice}
        marketPriceDisplay="crypto"
        positionSummary={selectedPositionSummary}
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
        tradingMode={normalizedTradingMode}
        estimatedCost={estimatedTotal}
        buyingPowerDisplay={accountBuyingPowerDisplay}
        onReview={handleSubmit}
        reviewDisabled={trading || !hasValidOrderSize || !symbolForTrade}
        reviewLabel={trading ? 'Executing...' : `Review ${side.toUpperCase()} Order`}
        density="crypto"
        surfaceTone="black"
        stickyReviewFooter
        className="shrink-0"
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
            <div className="text-[11px] text-slate-400">
              Paper trades execute as market orders at the live quote.
            </div>
          </div>
        }
      />

      <div className="mt-1 min-h-0 flex-1 space-y-1.5 overflow-y-auto px-2 pb-2">
        {lastResult && (
          <div className="text-center text-xs font-semibold py-2 rounded-lg animate-pulse"
            style={{
              background: lastResult === 'filled' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              color: lastResult === 'filled' ? '#22c55e' : '#ef4444',
              border: `1px solid ${lastResult === 'filled' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
            }}
          >
            {lastResult === 'filled' ? 'Order Filled' : lastResult === 'rejected' ? 'Order Rejected' : 'Connection Error'}
          </div>
        )}

        {error ? (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-2 text-xs text-red-300">
            {error}
          </div>
        ) : null}

        {inlineError ? (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-2 text-xs text-red-300">
            {inlineError}
          </div>
        ) : null}

        {successToast ? (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-2 text-xs text-emerald-300">
            {successToast}
          </div>
        ) : null}

        <div className="rounded-xl border border-white/[0.06] bg-black/40 px-3 py-2.5 backdrop-blur-xl shadow-[inset_4px_4px_8px_rgba(0,0,0,0.5),inset_-2px_-2px_6px_rgba(255,255,255,0.02)] transition-all duration-300">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold uppercase tracking-[0.12em] text-slate-400">Available Cash</span>
            <span className="text-[14px] font-mono font-semibold text-white">{accountBuyingPowerDisplay}</span>
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-black/40 px-3 py-2.5 backdrop-blur-xl shadow-[inset_4px_4px_8px_rgba(0,0,0,0.5),inset_-2px_-2px_6px_rgba(255,255,255,0.02)] transition-all duration-300">
          <div className="text-[13px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            Holdings {holdings.length ? `(${holdings.length})` : '(0)'}
          </div>
          {holdings.length > 0 ? (
            <div className="mt-1 space-y-1">
              {holdings.map((position) => {
                const qty = Number(position.quantity) || 0;
                const val = Number(position.market_value);
                const price = Number(position.current_price) || Number(position.avg_cost_basis) || 0;
                const currentValue = Number.isFinite(val) && val > 0 ? val : qty * price;
                return (
                  <div key={`paper-holding-${position.symbol}`} className="flex items-center justify-between gap-2">
                    <span className="text-[14px] font-medium text-slate-300">
                      {formatPaperSymbol(position.symbol)} · {formatPaperQuantity(position.quantity)}
                    </span>
                    <span className="text-[14px] font-mono font-semibold text-emerald-400">
                      {formatPaperCurrency(currentValue)}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : null}
          <div className="mt-1 pt-1.5 flex items-center justify-between gap-2 border-t border-white/[0.06]">
            <span className="text-[13px] font-semibold text-slate-400">Total</span>
            <span className="text-[14px] font-mono font-semibold text-emerald-400">
              {formatPaperCurrency(totalHoldingsValue)} ({Number(holdingsPercentOfAccount).toFixed(1)}%)
            </span>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {confirmModal && (
          <motion.div
            {...modalBackdropMotion}
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              {...modalPanelMotion}
              className="w-[280px] rounded-2xl border border-white/8 shadow-2xl shadow-black/30 bg-[rgba(10,22,40,0.98)] p-5 space-y-4"
            >
            <div className="text-center">
              <div className="mb-2">
                <span className={`${accountBadgeColorClass} text-xs font-semibold tracking-widest uppercase`}>
                  {accountBadgeText}
                </span>
              </div>
              <div className="text-sm font-bold mb-1" style={{ color: '#e2e8f0' }}>
                Confirm {isLiveMode ? 'Live' : 'Paper'} Order
              </div>
              <div className="text-[11px]" style={{ color: 'rgba(148, 163, 184, 0.5)' }}>
                {side.toUpperCase()} {resolvedQuantity.toFixed(6)} {formatPaperSymbol(symbolForTrade)} @ MARKET
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
              <motion.button
                onClick={() => setConfirmModal(false)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={interactiveTransition}
                className="py-2.5 rounded-lg text-xs font-semibold transition-colors border border-white/10 bg-white/5 text-slate-400 hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-400"
              >
                Cancel
              </motion.button>
              <motion.button
                onClick={executeOrder}
                disabled={trading}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={interactiveTransition}
                className="py-2.5 rounded-lg text-xs font-bold transition-colors"
                style={{
                  background: side === 'buy' ? 'rgba(34, 197, 94, 0.25)' : 'rgba(239, 68, 68, 0.25)',
                  color: side === 'buy' ? '#22c55e' : '#ef4444',
                  border: side === 'buy' ? '1px solid rgba(34, 197, 94, 0.4)' : '1px solid rgba(239, 68, 68, 0.4)',
                }}
              >
                {trading ? 'Executing...' : `Confirm ${side.toUpperCase()} (PAPER)`}
              </motion.button>
            </div>
            </motion.div>
          </motion.div>
        )}
        {confirmCloseModal && (
          <motion.div
            {...modalBackdropMotion}
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              {...modalPanelMotion}
              className="w-[280px] space-y-4 rounded-2xl border border-white/8 bg-[rgba(10,22,40,0.98)] p-5 shadow-2xl shadow-black/30"
            >
              <div className="text-center">
                <div className="mb-1 text-sm font-bold text-red-300">
                  Close Position?
                </div>
                <div className="text-[11px] text-slate-400">
                  Sell all {formatPaperQuantity(selectedPosition?.quantity || 0)} {formatPaperSymbol(selectedPosition?.symbol || symbolForTrade)} at market?
                </div>
              </div>
              <div className="text-center font-mono text-lg font-black text-red-400">
                {formatPaperCurrency(selectedPositionValue)}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <motion.button
                  type="button"
                  onClick={() => setConfirmCloseModal(false)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  transition={interactiveTransition}
                  className="rounded-lg border border-white/10 bg-white/5 py-2.5 text-xs font-semibold text-slate-400 transition-colors hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-400"
                >
                  Cancel
                </motion.button>
                <motion.button
                  type="button"
                  onClick={handleClosePosition}
                  disabled={trading}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  transition={interactiveTransition}
                  className="rounded-lg border border-red-500/40 bg-red-500/25 py-2.5 text-xs font-bold text-red-300 transition-colors"
                >
                  {trading ? 'Executing...' : 'Confirm Sell All'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COIN SELECTOR BAR
// ═══════════════════════════════════════════════════════════════════════════════
function CoinSelector({ coins, selected, onSelect }) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto px-4 py-2.5" style={{ scrollbarWidth: 'none' }}>
      {coins.map((coin, index) => (
        <motion.button
          key={coin.symbol}
          {...listItemMotion(index)}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          transition={{ ...listItemMotion(index).transition, ...interactiveTransition }}
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
        </motion.button>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN CRYPTO PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function CryptoPage({ alpacaData: _brokerData, onOrderPlaced }) {
  const [selectedCoin, setSelectedCoin] = useState(CRYPTO_COINS[0]);
  const [isRightPanelCollapsed, setIsRightPanelCollapsed] = useState(true);
  const [userId, setUserId] = useState(null);
  const { connected, hasRecentMessage, lastPrice } = useCryptoOrderbook(selectedCoin.tradeSymbol);
  const streamLive = connected || hasRecentMessage;

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setUserId(data.user.id);
        loadUserPreference(data.user.id).then(({ data: pref }) => {
          if (pref?.crypto_default_coin) {
            const coin = CRYPTO_COINS.find((c) => c.symbol === pref.crypto_default_coin);
            if (coin) setSelectedCoin(coin);
          }
        });
      }
    });
  }, []);

  const handleCoinSelect = (coin) => {
    setSelectedCoin(coin);
    if (userId) saveUserPreference(userId, coin.symbol);
  };

  const handleOrderPlaced = () => {
    if (onOrderPlaced) {
      onOrderPlaced();
    }
  };

  const glassStyle = {
    background: 'rgba(6, 13, 24, 0.6)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    minHeight: 400,
  };

  const orderTicketStyle = {
    background: '#0b0b0b',
    border: '1px solid rgba(255, 255, 255, 0.06)',
  };

  return (
    <div className="h-full w-full flex flex-col overflow-hidden" style={{ background: '#0b0b0b' }}>
      {/* ── Top Bar ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-white/[0.06] shrink-0"
        style={{ background: '#0b0b0b' }}
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
      <div className="flex-1 min-h-0 flex overflow-hidden p-3 gap-3 min-h-[300px]">

        {/* ── LEFT: TradingView Chart (bigger now) ────────────────── */}
        <div className="flex-1 w-full min-h-0 min-w-0 min-h-[280px] rounded-2xl border border-white/8 shadow-2xl shadow-black/30 overflow-hidden" style={glassStyle}>
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
            className="h-full w-full"
          />
        </div>

        {/* ── RIGHT: Order Entry ───────────────────────────────────── */}
        <div
          className={`${isRightPanelCollapsed ? 'w-[42px]' : 'w-[296px]'} shrink-0 flex h-full max-h-[calc(100vh-200px)] min-h-0 flex-col rounded-xl overflow-hidden relative transition-all duration-200 z-10`}
          style={orderTicketStyle}
        >
          {isRightPanelCollapsed ? (
            <div className="h-full flex flex-col items-center py-2 gap-2">
              <motion.button
                onClick={(e) => {
                  e.stopPropagation();
                  console.log('Crypto expand button clicked, current state:', isRightPanelCollapsed);
                  setIsRightPanelCollapsed(false);
                }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={interactiveTransition}
                className="h-7 w-7 text-xs font-bold transition-opacity cursor-pointer pointer-events-auto relative z-20 hover:opacity-80"
                style={{
                  color: 'rgba(34, 197, 94, 0.9)',
                }}
                title="Expand order entry panel"
                aria-label="Expand order entry panel"
              >
                <ChevronsLeft className="h-3.5 w-3.5 mx-auto pointer-events-none" strokeWidth={1.7} />
              </motion.button>
              <div
                className="text-[9px] font-bold tracking-[0.2em] uppercase"
                style={{
                  color: 'rgba(34, 197, 94, 0.85)',
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
                  style={{ color: 'rgba(34, 197, 94, 0.85)' }}
                >
                  Order Entry
                </span>
                <motion.button
                  onClick={() => {
                    console.log('Crypto collapse button clicked, current state:', isRightPanelCollapsed);
                    setIsRightPanelCollapsed(true);
                  }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  transition={interactiveTransition}
                  className="h-7 w-7 flex items-center justify-center transition-opacity cursor-pointer hover:opacity-80"
                  style={{ color: 'rgba(34, 197, 94, 0.8)' }}
                  title="Collapse order entry panel"
                  aria-label="Collapse order entry panel"
                >
                  <ChevronsRight className="h-4 w-4" strokeWidth={1.7} />
                </motion.button>
              </div>

              <div className="flex-1 min-h-0 overflow-hidden">
                <OrderEntry
                  selectedCoin={selectedCoin}
                  lastPrice={lastPrice}
                  onOrderPlaced={handleOrderPlaced}
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
