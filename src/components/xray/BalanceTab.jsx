import BalanceBarChart from './charts/BalanceBarChart';

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toMillions = (value) => toNumber(value) / 1e6;

const getDateLabel = (fiscalDate) => {
  const text = String(fiscalDate || '');
  if (!text) return 'N/A';
  return text.slice(0, 4);
};

const normalizeRows = (rows = []) =>
  [...(Array.isArray(rows) ? rows : [])]
    .filter((row) => row && row.fiscal_date)
    .sort((a, b) => String(a.fiscal_date).localeCompare(String(b.fiscal_date)));

export default function BalanceTab({ balanceRows = [] }) {
  const rows = normalizeRows(balanceRows);

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 bg-[#0a1628] p-10 text-center text-sm text-gray-400">
        No balance sheet data available for this symbol and period.
      </div>
    );
  }

  const labels = rows.map((row) => getDateLabel(row.fiscal_date));
  const currentAssets = rows.map((row) => toMillions(row.current_assets));
  const nonCurrentAssets = rows.map((row) => toMillions(row.non_current_assets));
  const currentLiab = rows.map((row) => toMillions(row.current_liabilities));
  const nonCurrentLiab = rows.map((row) => toMillions(row.non_current_liabilities));
  const equity = rows.map((row) => toMillions(row.total_equity));

  return (
    <div className="space-y-4">
      <BalanceBarChart
        labels={labels}
        currentAssets={currentAssets}
        nonCurrentAssets={nonCurrentAssets}
        currentLiab={currentLiab}
        nonCurrentLiab={nonCurrentLiab}
        equity={equity}
      />
    </div>
  );
}
