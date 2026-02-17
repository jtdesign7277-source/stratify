const NON_TICKER_WORDS = new Set([
  'ENTRY',
  'EXIT',
  'SIGNAL',
  'VOLUME',
  'TREND',
  'RISK',
  'REWARD',
  'STOP',
  'LOSS',
  'GAIN',
  'LONG',
  'SHORT',
  'CALL',
  'PUT',
  'OPEN',
  'HIGH',
  'LOW',
  'CLOSE',
  'RSI',
  'MACD',
  'VWAP',
  'EMA',
  'SMA',
  'ATR',
  'ADX',
  'ROC',
  'OBV',
  'OHLC',
  'OHLCV',
  'ROI',
  'PNL',
  'USD',
  'USDT',
  'BUY',
  'SELL',
  'HOLD',
  'DATE',
  'DAYS',
  'WEEK',
  'WEEKS',
  'MONTH',
  'MONTHS',
  'YEAR',
  'YEARS',
  'MIN',
  'MINS',
  'HOUR',
  'HOURS',
]);

const TICKER_TOKEN_REGEX = /(^|[^A-Za-z0-9$])(\$?[A-Z]{2,5})(?=$|[^A-Za-z0-9])/g;

export const normalizeTickerSymbol = (value = '') =>
  String(value || '').replace(/^\$/, '').trim().toUpperCase();

const isTickerCandidate = (symbol = '', hasDollarPrefix = false) => {
  if (!symbol) return false;
  if (symbol.length < 2 || symbol.length > 5) return false;
  if (hasDollarPrefix) return true;
  return !NON_TICKER_WORDS.has(symbol);
};

export const tokenizeTickerText = (value = '') => {
  const source = String(value ?? '');
  const tokens = [];
  let cursor = 0;

  for (const match of source.matchAll(TICKER_TOKEN_REGEX)) {
    const fullStart = match.index ?? 0;
    const prefix = match[1] || '';
    const candidate = match[2] || '';
    const symbol = normalizeTickerSymbol(candidate);

    if (!isTickerCandidate(symbol, candidate.startsWith('$'))) continue;

    const candidateStart = fullStart + prefix.length;
    const candidateEnd = candidateStart + candidate.length;

    if (fullStart > cursor) {
      tokens.push({ type: 'text', value: source.slice(cursor, fullStart) });
    }

    if (prefix) {
      tokens.push({ type: 'text', value: prefix });
    }

    tokens.push({
      type: 'ticker',
      value: `$${symbol}`,
      symbol,
    });

    cursor = candidateEnd;
  }

  if (cursor < source.length) {
    tokens.push({ type: 'text', value: source.slice(cursor) });
  }

  if (!tokens.length) {
    tokens.push({ type: 'text', value: source });
  }

  return tokens;
};

export const withDollarTickers = (value = '') =>
  tokenizeTickerText(value)
    .map((token) => token.value)
    .join('');

export const formatTickersAsHtml = (value = '') =>
  tokenizeTickerText(value)
    .map((token) =>
      token.type === 'ticker'
        ? `<span class="text-emerald-400 font-semibold">${token.value}</span>`
        : token.value
    )
    .join('');
