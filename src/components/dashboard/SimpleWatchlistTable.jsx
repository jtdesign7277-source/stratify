import { useMemo } from 'react';

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

const formatVolume = (value) => {
  if (value === null || value === undefined) return '--';
  const num = Number(value);
  if (!Number.isFinite(num)) return '--';
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
              <td className="py-2.5 px-3 text-base font-medium text-[#e9f0fd]">{row.symbol}</td>
              <td className="py-2.5 px-3 text-right text-base text-gray-300">{formatPrice(row.price)}</td>
              <td className={`py-2.5 px-3 text-right text-base font-medium ${getColorClass(row.change)}`}>
                {formatSigned(row.change)}
              </td>
              <td className={`py-2.5 px-3 text-right text-base font-medium ${getColorClass(row.changePercent)}`}>
                {formatSignedPercent(row.changePercent)}
              </td>
              <td className="py-2.5 px-3 text-right text-base text-gray-300">{formatVolume(row.volume)}</td>
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
