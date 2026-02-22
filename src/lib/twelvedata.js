export const normalizeSymbol = (value) =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\$/g, '')
    .split(':')[0]
    .split('.')[0];

export const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const toMillions = (value) => {
  const numeric = toNumber(value);
  return numeric === null ? 0 : Number((numeric / 1e6).toFixed(2));
};

export const toBillions = (value) => {
  const numeric = toNumber(value);
  return numeric === null ? 0 : Number((numeric / 1e9).toFixed(2));
};

export const formatCompactNumber = (value, digits = 2) => {
  const numeric = toNumber(value);
  if (numeric === null) return '--';
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: digits,
  }).format(numeric);
};

export const formatCurrency = (value, digits = 2) => {
  const numeric = toNumber(value);
  if (numeric === null) return '--';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(numeric);
};

export const formatPercent = (value, digits = 2) => {
  const numeric = toNumber(value);
  if (numeric === null) return '--';
  return `${numeric.toFixed(digits)}%`;
};

export const formatSignedPercent = (value, digits = 2) => {
  const numeric = toNumber(value);
  if (numeric === null) return '--';
  const sign = numeric >= 0 ? '+' : '';
  return `${sign}${numeric.toFixed(digits)}%`;
};

export const sortByFiscalDate = (rows = [], ascending = true) => {
  const copy = Array.isArray(rows) ? [...rows] : [];
  copy.sort((a, b) => {
    const aDate = new Date(a?.fiscal_date || 0).getTime();
    const bDate = new Date(b?.fiscal_date || 0).getTime();
    return ascending ? aDate - bDate : bDate - aDate;
  });
  return copy;
};

const quarterFromDate = (dateString) => {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return null;
  return `Q${Math.floor(date.getMonth() / 3) + 1}`;
};

export const getPeriodLabel = (row, period = 'annual') => {
  const fiscalDate = String(row?.fiscal_date || '');
  const year = fiscalDate.slice(0, 4);
  if (period !== 'quarterly') return year || fiscalDate || '--';

  const rawQuarter = String(row?.raw_json?.quarter || row?.quarter || '').trim();
  const quarter = rawQuarter || quarterFromDate(fiscalDate) || 'Q?';
  return `${year || '--'} ${quarter}`;
};

export const parseRevenueSegments = (statement) => {
  const totalRevenue = toNumber(statement?.total_revenue) || 0;
  const raw = statement?.raw_json || {};

  const automotive = toNumber(
    raw?.automotive_sales || raw?.automotive_revenue || raw?.automotive_revenues
  );
  const energy = toNumber(
    raw?.energy_generation_and_storage
      || raw?.energy_generation_and_storage_revenue
      || raw?.energy_revenue
  );
  const services = toNumber(
    raw?.services_and_other || raw?.services_revenue || raw?.services_and_other_revenue
  );

  if (automotive !== null || energy !== null || services !== null) {
    const known = [automotive, energy, services].filter((v) => v !== null);
    const knownTotal = known.reduce((sum, value) => sum + value, 0);

    const fallback = totalRevenue > knownTotal ? totalRevenue - knownTotal : 0;

    return {
      automotive: automotive ?? fallback,
      energy: energy ?? 0,
      services: services ?? 0,
    };
  }

  return {
    automotive: totalRevenue * 0.82,
    energy: totalRevenue * 0.1,
    services: totalRevenue * 0.08,
  };
};
