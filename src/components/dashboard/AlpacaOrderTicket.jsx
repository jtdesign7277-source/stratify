import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';

const formatMoney = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return '$ -';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(number);
};

const normalizeDisplayMoney = (value) => {
  if (value === null || value === undefined || value === '' || value === '--') return '$ -';
  if (typeof value === 'string' && value.trim().startsWith('$')) return value;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return String(value);
  return formatMoney(parsed);
};

const DEFAULT_ORDER_TYPES = [
  { value: 'market', label: 'Market' },
  { value: 'limit', label: 'Limit' },
  { value: 'stop', label: 'Stop' },
  { value: 'stop_limit', label: 'Stop Limit' },
];

const DEFAULT_TIF = [
  { value: 'day', label: 'DAY' },
  { value: 'gtc', label: 'GTC' },
  { value: 'ioc', label: 'IOC' },
];

export default function AlpacaOrderTicket({
  side = 'buy',
  onSideChange,
  symbol = '',
  onSymbolSubmit,
  marketPrice,
  quantity = '',
  onQuantityChange,
  orderType = 'market',
  onOrderTypeChange,
  orderTypeOptions = DEFAULT_ORDER_TYPES,
  sizeMode = 'shares',
  onSizeModeChange,
  dollarAmount = '',
  onDollarAmountChange,
  timeInForce = 'day',
  onTimeInForceChange,
  timeInForceOptions = DEFAULT_TIF,
  estimatedCost,
  buyingPowerDisplay,
  onReview,
  reviewDisabled,
  reviewLabel = 'Review Order',
  stickyReviewFooter = false,
  extraFields = null,
  density = 'default',
  className = '',
}) {
  const [symbolInput, setSymbolInput] = useState(symbol);

  useEffect(() => {
    setSymbolInput(symbol || '');
  }, [symbol]);

  const activeAmount = sizeMode === 'dollars' ? dollarAmount : quantity;

  const handleCommitSymbol = () => {
    if (!onSymbolSubmit) return;
    const next = String(symbolInput || '').trim().toUpperCase();
    if (!next) return;
    onSymbolSubmit(next);
  };

  const handleAmountChange = (value) => {
    if (sizeMode === 'dollars') {
      onDollarAmountChange?.(value);
      return;
    }
    onQuantityChange?.(value);
  };

  const marketPriceText = useMemo(() => {
    if (marketPrice === null || marketPrice === undefined) return 'Loading...';
    if (marketPrice === 0) return '$ -';
    return formatMoney(marketPrice);
  }, [marketPrice]);
  const estimatedCostText = useMemo(() => {
    if ((marketPrice === null || marketPrice === undefined || marketPrice === 0) && !activeAmount) {
      return 'Enter quantity';
    }
    if (!activeAmount || parseFloat(activeAmount) === 0) return '$ 0.00';
    if (estimatedCost === null || estimatedCost === undefined) return 'Calculating...';
    return formatMoney(estimatedCost);
  }, [estimatedCost, marketPrice, activeAmount]);
  const buyingPowerText = useMemo(() => normalizeDisplayMoney(buyingPowerDisplay), [buyingPowerDisplay]);

  const isTradeDensity = density === 'trade';
  const isCryptoDensity = density === 'crypto';
  const isCompactCryptoSticky = isCryptoDensity && stickyReviewFooter;

  const panelPaddingClass = isTradeDensity ? 'p-2.5' : isCompactCryptoSticky ? 'p-1' : isCryptoDensity ? 'p-2' : 'p-3';
  const tabTextClass = isCompactCryptoSticky ? 'text-[13px]' : 'text-[14px]';
  const tabPaddingClass = isCompactCryptoSticky ? 'h-8 py-0' : 'h-8 py-0.5';
  const contentTopClass = isCompactCryptoSticky ? 'mt-1' : 'mt-2';
  const verticalGapClass = isCompactCryptoSticky ? 'space-y-1' : 'space-y-2';
  const controlHeightClass = isTradeDensity ? 'h-[36px]' : isCompactCryptoSticky ? 'h-[32px]' : isCryptoDensity ? 'h-[36px]' : 'h-[38px]';
  const controlTextClass = isCompactCryptoSticky ? 'text-[12px]' : 'text-[13px]';
  const labelTextClass = isCompactCryptoSticky ? 'text-[11px]' : 'text-[12px]';
  const valueTextClass = isCompactCryptoSticky ? 'text-[12px]' : 'text-[13px]';
  const searchIconClass = isCompactCryptoSticky ? 'h-3.5 w-3.5' : 'h-4 w-4';
  const searchIconLeftClass = isCompactCryptoSticky ? 'left-2.5' : 'left-3';
  const symbolInputPaddingClass = isCompactCryptoSticky ? 'pl-8 pr-2.5' : 'pl-9 pr-3';
  const labelSpacingClass = isCompactCryptoSticky ? 'mb-0.5' : 'mb-1';
  const sizeModeGapClass = isCompactCryptoSticky ? 'gap-2' : 'gap-4';
  const reviewButtonClass = isCompactCryptoSticky
    ? 'py-2 text-[12px] leading-none'
    : isTradeDensity
      ? 'h-[36px] text-[13px]'
      : isCryptoDensity
        ? 'h-[36px] text-[13px]'
        : 'h-[38px] text-[13px]';
  const radioSizeClass = isCompactCryptoSticky ? 'h-3 w-3' : 'h-3.5 w-3.5';
  const reviewFooterClass = isCompactCryptoSticky
    ? 'mt-1 shrink-0 border-t border-white/10 pt-1'
    : 'mt-2 shrink-0 border-t border-white/10 pt-2';
  const reviewButtonStateClass = reviewDisabled
    ? 'cursor-not-allowed border-amber-500/20 bg-amber-500/20 text-amber-100/50'
    : 'border-emerald-500/40 bg-emerald-600 text-white hover:bg-emerald-500';
  const reviewButtonText = typeof reviewLabel === 'string' && reviewLabel.trim() ? reviewLabel : 'Review Order';
  const rootLayoutClass = stickyReviewFooter ? 'flex min-h-0 flex-col overflow-hidden' : '';
  const contentLayoutClass = stickyReviewFooter
    ? `${contentTopClass} ${verticalGapClass} flex-1 min-h-0`
    : `${contentTopClass} ${verticalGapClass}`;

  return (
    <div
      className={`rounded-xl border border-white/10 bg-[#0a1628]/95 ${panelPaddingClass} ${rootLayoutClass} text-white shadow-[0_18px_34px_rgba(0,0,0,0.45)] backdrop-blur ${className}`}
    >
      <div className="grid grid-cols-2 border-b border-white/10">
        <button
          type="button"
          onClick={() => onSideChange?.('buy')}
          className={`${tabPaddingClass} ${tabTextClass} font-semibold transition-colors ${
            side === 'buy' ? 'border-b-2 border-emerald-500 text-emerald-400' : 'text-gray-500'
          }`}
        >
          Buy
        </button>
        <button
          type="button"
          onClick={() => onSideChange?.('sell')}
          className={`${tabPaddingClass} ${tabTextClass} font-semibold transition-colors ${
            side === 'sell' ? 'border-b-2 border-red-500 text-red-400' : 'text-gray-500'
          }`}
        >
          Sell
        </button>
      </div>

      <div className={contentLayoutClass}>
        <div className="relative">
          <Search
            className={`pointer-events-none absolute ${searchIconLeftClass} top-1/2 -translate-y-1/2 text-gray-500 ${searchIconClass}`}
            strokeWidth={1.6}
          />
          <input
            type="text"
            value={symbolInput}
            onChange={(event) => setSymbolInput(String(event.target.value || '').toUpperCase())}
            onBlur={handleCommitSymbol}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                handleCommitSymbol();
              }
            }}
            placeholder="Search by symbol..."
            className={`${controlHeightClass} w-full rounded-lg border border-[#1f2a3a] bg-[#050b16] ${symbolInputPaddingClass} ${controlTextClass} font-semibold text-white outline-none placeholder:text-gray-500 focus:border-blue-500/60`}
          />
        </div>

        <div className="flex items-center justify-between">
          <span className={`${labelTextClass} font-semibold text-slate-200`}>Market Price</span>
          <span className={`${valueTextClass} font-semibold text-white`}>{marketPriceText}</span>
        </div>

        <div>
          <label className={`${labelSpacingClass} block ${labelTextClass} font-semibold text-slate-200`}>Quantity</label>
          <input
            type="number"
            step="any"
            min="0"
            value={activeAmount}
            onChange={(event) => handleAmountChange(event.target.value)}
            className={`${controlHeightClass} w-full rounded-lg border border-[#1f2a3a] bg-[#050b16] px-3 ${controlTextClass} font-semibold text-white outline-none focus:border-blue-500/60`}
          />
        </div>

        <div>
          <label className={`${labelSpacingClass} block ${labelTextClass} font-semibold text-slate-200`}>Order Type</label>
          <div className="relative">
            <select
              value={orderType}
              onChange={(event) => onOrderTypeChange?.(event.target.value)}
              className={`${controlHeightClass} w-full appearance-none rounded-lg border border-[#1f2a3a] bg-[#050b16] px-3 pr-10 ${controlTextClass} font-semibold text-white outline-none focus:border-blue-500/60`}
            >
              {orderTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              strokeWidth={1.8}
            />
          </div>
        </div>

        {extraFields}

        <div>
          <div className={`${labelSpacingClass} ${labelTextClass} font-semibold text-slate-200`}>Choose how to buy</div>
          <div className={`flex items-center ${sizeModeGapClass} ${controlTextClass} text-slate-300`}>
            <label className="inline-flex cursor-pointer items-center gap-1.5">
              <input
                type="radio"
                name="size-mode"
                checked={sizeMode === 'shares'}
                onChange={() => onSizeModeChange?.('shares')}
                className={`${radioSizeClass} accent-blue-500`}
              />
              <span>Shares</span>
            </label>
            <label className="inline-flex cursor-pointer items-center gap-1.5">
              <input
                type="radio"
                name="size-mode"
                checked={sizeMode === 'dollars'}
                onChange={() => onSizeModeChange?.('dollars')}
                className={`${radioSizeClass} accent-blue-500`}
              />
              <span>Dollars</span>
            </label>
          </div>
        </div>

        <div>
          <label className={`${labelSpacingClass} block ${labelTextClass} font-semibold text-slate-200`}>Time in Force</label>
          <div className="relative">
            <select
              value={timeInForce}
              onChange={(event) => onTimeInForceChange?.(event.target.value)}
              className={`${controlHeightClass} w-full appearance-none rounded-lg border border-[#1f2a3a] bg-[#050b16] px-3 pr-10 ${controlTextClass} font-semibold text-white outline-none focus:border-blue-500/60`}
            >
              {timeInForceOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              strokeWidth={1.8}
            />
          </div>
        </div>

        <div className="space-y-0.5">
          <div className="flex items-center justify-between">
            <span className={`${labelTextClass} font-semibold text-slate-200`}>Estimated Cost</span>
            <span className={`${labelTextClass} font-semibold text-white`}>{estimatedCostText}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className={`${labelTextClass} font-semibold text-slate-200`}>Buying Power</span>
            <span className={`${labelTextClass} font-semibold text-white`}>{buyingPowerText}</span>
          </div>
        </div>

        {!stickyReviewFooter && (
          <button
            type="button"
            onClick={onReview}
            disabled={reviewDisabled}
            className={`${reviewButtonClass} w-full rounded-lg border px-3 font-semibold transition ${reviewButtonStateClass}`}
          >
            {reviewButtonText}
          </button>
        )}
      </div>

      {stickyReviewFooter && (
        <div className={reviewFooterClass}>
          <button
            type="button"
            onClick={onReview}
            disabled={reviewDisabled}
            className={`${reviewButtonClass} w-full rounded-lg border px-3 font-semibold transition ${reviewButtonStateClass}`}
          >
            {reviewButtonText}
          </button>
        </div>
      )}
    </div>
  );
}
