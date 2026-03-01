import { useEffect, useMemo, useState } from 'react';

const BRAND_DOMAIN_BY_SYMBOL = {
  AAPL: 'apple.com',
  MSFT: 'microsoft.com',
  NVDA: 'nvidia.com',
  TSLA: 'tesla.com',
  AMZN: 'amazon.com',
  META: 'meta.com',
  GOOGL: 'abc.xyz',
  GOOG: 'abc.xyz',
  AMD: 'amd.com',
  PLTR: 'palantir.com',
  SOFI: 'sofi.com',
  HIMS: 'hims.com',
  NIO: 'nio.com',
  COIN: 'coinbase.com',
  SPY: 'ssga.com',
  QQQ: 'invesco.com',
  DIA: 'ssga.com',
  IWM: 'ishares.com',
  GLD: 'spdrgoldshares.com',
  JPM: 'jpmorganchase.com',
  BAC: 'bankofamerica.com',
  WFC: 'wellsfargo.com',
  V: 'visa.com',
  MA: 'mastercard.com',
  PYPL: 'paypal.com',
  NFLX: 'netflix.com',
  INTC: 'intel.com',
  AVGO: 'broadcom.com',
  CRM: 'salesforce.com',
  ADBE: 'adobe.com',
  ORCL: 'oracle.com',
  UBER: 'uber.com',
  ABNB: 'airbnb.com',
  HOOD: 'robinhood.com',
  SHOP: 'shopify.com',
  SNOW: 'snowflake.com',
  PANW: 'paloaltonetworks.com',
  CRWD: 'crowdstrike.com',
  MU: 'micron.com',
  SMCI: 'supermicro.com',
  ARM: 'arm.com',
  XOM: 'exxon.com',
  CVX: 'chevron.com',
  WMT: 'walmart.com',
  COST: 'costco.com',
  UNH: 'unitedhealthgroup.com',
  JNJ: 'jnj.com',
  LLY: 'lilly.com',
  PG: 'pg.com',
  HD: 'homedepot.com',
  DIS: 'disney.com',
  BA: 'boeing.com',
  NKE: 'nike.com',
  T: 'att.com',
  PFE: 'pfizer.com',
  MRK: 'merck.com',
  ABBV: 'abbvie.com',
  KO: 'coca-cola.com',
  PEP: 'pepsico.com',
  MCD: 'mcdonalds.com',
  LOW: 'lowes.com',
  GE: 'geaerospace.com',
  CAT: 'caterpillar.com',
  DE: 'deere.com',
  F: 'ford.com',
  GM: 'gm.com',
};

const normalizeSymbol = (value) =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/^\$/, '')
    .replace(/\s+/g, '')
    .split(':')
    .pop();

const normalizeDomain = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const parsed = raw.startsWith('http://') || raw.startsWith('https://')
      ? new URL(raw)
      : new URL(`https://${raw}`);
    return parsed.hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return raw.replace(/^www\./i, '').replace(/^https?:\/\//i, '').split('/')[0].toLowerCase();
  }
};

const resolveBrandDomain = (symbol) => {
  const normalized = normalizeSymbol(symbol);
  const base = normalized.split('/')[0].split('.')[0];
  return normalizeDomain(BRAND_DOMAIN_BY_SYMBOL[normalized] || BRAND_DOMAIN_BY_SYMBOL[base] || '');
};

function BrandDomainLogo({ symbol, size = 16 }) {
  const [sourceIndex, setSourceIndex] = useState(0);
  const domain = useMemo(() => resolveBrandDomain(symbol), [symbol]);
  const clean = normalizeSymbol(symbol);
  const primary = clean.split('/')[0].split('.')[0];
  const dimension = Math.max(24, size * 2);
  const urls = useMemo(() => {
    if (!domain) return [];
    return [
      `https://img.logo.dev/${domain}?size=${dimension}`,
      `https://logo.clearbit.com/${domain}?size=${dimension}`,
    ];
  }, [domain, dimension]);

  useEffect(() => {
    setSourceIndex(0);
  }, [domain, clean, size]);

  if (!urls.length || sourceIndex >= urls.length) {
    return (
      <div
        className="flex-shrink-0 rounded-sm border border-[#354560]/60 bg-[#0b1220] text-[10px] font-semibold text-[#d5dfef] flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        {(primary.charAt(0) || '?').toUpperCase()}
      </div>
    );
  }

  return (
    <img
      src={urls[sourceIndex]}
      alt={`${primary} logo`}
      className="flex-shrink-0 object-contain"
      style={{ width: size, height: size }}
      loading="lazy"
      onError={() => setSourceIndex((previous) => previous + 1)}
    />
  );
}

const formatPrice = (value) => {
  if (value === null || value === undefined || value === '') return '--';
  const num = Number(value);
  if (!Number.isFinite(num)) return '--';
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatSigned = (value) => {
  if (value === null || value === undefined) return '--';
  const num = Number(value);
  if (!Number.isFinite(num)) return '--';
  const sign = num >= 0 ? '+' : '';
  return `${sign}${num.toFixed(2)}`;
};

const formatSignedPercent = (value) => {
  if (value === null || value === undefined) return '--';
  const num = Number(value);
  if (!Number.isFinite(num)) return '--';
  const sign = num >= 0 ? '+' : '';
  return `${sign}${num.toFixed(2)}%`;
};

const formatVolume = (value, symbol) => {
  const isCryptoPair = typeof symbol === 'string' && symbol.includes('/');
  if (value === null || value === undefined) return '--';
  const num = Number(value);
  if (!Number.isFinite(num)) return '--';
  if (isCryptoPair && num === 0) return '--';
  if (Math.abs(num) >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
  if (Math.abs(num) >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
  if (Math.abs(num) >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
  return num.toLocaleString('en-US');
};

const getColorClass = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num) || num === 0) return 'text-gray-400';
  return num > 0 ? 'text-emerald-400' : 'text-red-400';
};

export default function SimpleWatchlistTable({ rows }) {
  return (
    <div className="w-full overflow-visible">
      <table className="w-full border-collapse">
        <thead className="sticky top-0 z-10 bg-[#0a0f1a]">
          <tr className="border-b border-[#354560]/60">
            <th className="text-left py-2.5 px-3 text-xs font-medium text-[#c5d0df]/80 uppercase tracking-wide">Symbol</th>
            <th className="text-right py-2.5 px-3 text-xs font-medium text-[#c5d0df]/80 uppercase tracking-wide">Last</th>
            <th className="text-right py-2.5 px-3 text-xs font-medium text-[#c5d0df]/80 uppercase tracking-wide">Chg</th>
            <th className="text-right py-2.5 px-3 text-xs font-medium text-[#c5d0df]/80 uppercase tracking-wide">Chg%</th>
            <th className="text-right py-2.5 px-3 text-xs font-medium text-[#c5d0df]/80 uppercase tracking-wide">Vol</th>
            <th className="text-right py-2.5 px-3 text-xs font-medium text-[#c5d0df]/80 uppercase tracking-wide">Ext</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.symbol} className="border-b border-[#1c2739]/70 hover:bg-[#141e32]/40 transition-colors">
              <td className="py-2.5 px-3 text-base font-medium text-[#e9f0fd]">
                <div className="flex items-center gap-2">
                  <BrandDomainLogo symbol={row.symbol} size={16} />
                  <span>{row.symbol}</span>
                </div>
              </td>
              <td className="py-2.5 px-3 text-right text-base text-gray-300">{formatPrice(row.price)}</td>
              <td className={`py-2.5 px-3 text-right text-base font-medium ${getColorClass(row.change)}`}>
                {formatSigned(row.change)}
              </td>
              <td className={`py-2.5 px-3 text-right text-base font-medium ${getColorClass(row.changePercent)}`}>
                {formatSignedPercent(row.changePercent)}
              </td>
              <td className="py-2.5 px-3 text-right text-base text-gray-300">{formatVolume(row.volume, row.symbol)}</td>
              <td className={`py-2.5 px-3 text-right text-base font-medium ${getColorClass(row.extChangePercent)}`}>
                {formatSignedPercent(row.extChangePercent)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
