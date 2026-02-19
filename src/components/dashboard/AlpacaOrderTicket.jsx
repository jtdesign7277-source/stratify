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
  extraFields = null,
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

  const marketPriceText = useMemo(() => formatMoney(marketPrice), [marketPrice]);
  const estimatedCostText = useMemo(() => formatMoney(estimatedCost), [estimatedCost]);
  const buyingPowerText = useMemo(() => normalizeDisplayMoney(buyingPowerDisplay), [buyingPowerDisplay]);

  return (
    <div
      className={`rounded-2xl border border-[#c5c8cc] bg-[#ececec] p-5 text-[#24262b] shadow-[0_10px_24px_rgba(0,0,0,0.2)] ${className}`}
    >
      <div className="grid grid-cols-2 border-b border-[#d6d9dc]">
        <button
          type="button"
          onClick={() => onSideChange?.('buy')}
          className={`pb-2 text-[22px] font-semibold transition-colors ${
            side === 'buy' ? 'border-b-[3px] border-[#22a454] text-[#22a454]' : 'text-[#939393]'
          }`}
        >
          Buy
        </button>
        <button
          type="button"
          onClick={() => onSideChange?.('sell')}
          className={`pb-2 text-[22px] font-semibold transition-colors ${
            side === 'sell' ? 'border-b-[3px] border-[#c54c4c] text-[#c54c4c]' : 'text-[#939393]'
          }`}
        >
          Sell
        </button>
      </div>

      <div className="mt-5 space-y-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-6 w-6 -translate-y-1/2 text-[#7d7d7d]" strokeWidth={1.8} />
          <input
            type="text"
            value={symbolInput}
            onChange={(event) => setSymbolInput(event.target.value)}
            onBlur={handleCommitSymbol}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                handleCommitSymbol();
              }
            }}
            placeholder="Search by symbol..."
            className="h-[58px] w-full rounded-xl border border-[#aeb1b5] bg-[#f0f0f0] pl-14 pr-4 text-[18px] font-semibold text-[#6f7175] outline-none placeholder:text-[#7f8185] focus:border-[#95999d]"
          />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[17px] font-semibold">Market Price</span>
          <span className="text-[19px] font-semibold">{marketPriceText}</span>
        </div>

        <div>
          <label className="mb-2 block text-[17px] font-semibold">Quantity</label>
          <input
            type="number"
            step="any"
            min="0"
            value={activeAmount}
            onChange={(event) => handleAmountChange(event.target.value)}
            className="h-[58px] w-full rounded-xl border border-[#aeb1b5] bg-[#f0f0f0] px-4 text-[18px] font-semibold text-[#5e6063] outline-none focus:border-[#94989c]"
          />
        </div>

        <div>
          <label className="mb-2 block text-[17px] font-semibold">Order Type</label>
          <div className="relative">
            <select
              value={orderType}
              onChange={(event) => onOrderTypeChange?.(event.target.value)}
              className="h-[58px] w-full appearance-none rounded-xl border border-[#aeb1b5] bg-[#f0f0f0] px-4 pr-12 text-[18px] font-semibold text-[#2e2f32] outline-none focus:border-[#94989c]"
            >
              {orderTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-3 top-1/2 h-7 w-7 -translate-y-1/2 text-[#2e2f32]"
              strokeWidth={2.2}
            />
          </div>
        </div>

        {extraFields}

        <div>
          <div className="mb-2 text-[17px] font-semibold">Choose how to buy</div>
          <div className="flex items-center gap-7 text-[17px] text-[#4f5256]">
            <label className="inline-flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="size-mode"
                checked={sizeMode === 'shares'}
                onChange={() => onSizeModeChange?.('shares')}
                className="h-5 w-5 accent-[#2f6fe0]"
              />
              <span>Shares</span>
            </label>
            <label className="inline-flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="size-mode"
                checked={sizeMode === 'dollars'}
                onChange={() => onSizeModeChange?.('dollars')}
                className="h-5 w-5 accent-[#2f6fe0]"
              />
              <span>Dollars</span>
            </label>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-[17px] font-semibold">Time in Force</label>
          <div className="relative">
            <select
              value={timeInForce}
              onChange={(event) => onTimeInForceChange?.(event.target.value)}
              className="h-[58px] w-full appearance-none rounded-xl border border-[#aeb1b5] bg-[#f0f0f0] px-4 pr-12 text-[18px] font-semibold text-[#2e2f32] outline-none focus:border-[#94989c]"
            >
              {timeInForceOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-3 top-1/2 h-7 w-7 -translate-y-1/2 text-[#2e2f32]"
              strokeWidth={2.2}
            />
          </div>
        </div>

        <div className="space-y-1 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-[17px] font-semibold">Estimated Cost</span>
            <span className="text-[17px] font-semibold">{estimatedCostText}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[17px] font-semibold">Buying Power</span>
            <span className="text-[17px] font-semibold">{buyingPowerText}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onReview}
          disabled={reviewDisabled}
          className={`h-[60px] w-full rounded-2xl text-[18px] font-semibold transition ${
            reviewDisabled
              ? 'cursor-not-allowed bg-[#e4d48c] text-[#8e8488]'
              : 'bg-[#e5d27f] text-[#706663] hover:bg-[#e2cb6d]'
          }`}
        >
          {reviewLabel}
        </button>
      </div>
    </div>
  );
}
