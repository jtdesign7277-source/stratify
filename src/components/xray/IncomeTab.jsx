import WaterfallChart from './charts/WaterfallChart';
import RevenueSegmentChart from './charts/RevenueSegmentChart';
import MarginsChart from './charts/MarginsChart';
import IncomeCompChart from './charts/IncomeCompChart';

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

const extractSegmentRevenue = (raw, keyOptions) => {
  if (!raw || typeof raw !== 'object') return null;

  const entries = Object.entries(raw);
  for (const [key, value] of entries) {
    const normalizedKey = String(key || '').toLowerCase().replace(/[_\s-]+/g, ' ');
    if (!keyOptions.some((option) => normalizedKey.includes(option))) continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }

  return null;
};

const buildSegments = (rows) => {
  const automotive = [];
  const energy = [];
  const services = [];

  rows.forEach((row) => {
    const raw = row?.raw_json;

    const autoRevenue =
      extractSegmentRevenue(raw, ['automotive']) ??
      toNumber(row.total_revenue);
    const energyRevenue =
      extractSegmentRevenue(raw, ['energy']) ??
      0;
    const servicesRevenue =
      extractSegmentRevenue(raw, ['service']) ??
      extractSegmentRevenue(raw, ['services and other']) ??
      0;

    automotive.push(toMillions(autoRevenue));
    energy.push(toMillions(energyRevenue));
    services.push(toMillions(servicesRevenue));
  });

  return { automotive, energy, services };
};

export default function IncomeTab({ incomeRows = [] }) {
  const rows = normalizeRows(incomeRows);

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 bg-[#0a1628] p-10 text-center text-sm text-gray-400">
        No income statement data available for this symbol and period.
      </div>
    );
  }

  const labels = rows.map((row) => getDateLabel(row.fiscal_date));
  const latest = rows[rows.length - 1];

  const grossMargins = rows.map((row) => toNumber(row.gross_margin));
  const operatingMargins = rows.map((row) => toNumber(row.operating_margin));
  const netMargins = rows.map((row) => toNumber(row.net_margin));

  const grossProfit = rows.map((row) => toMillions(row.gross_profit));
  const operatingIncome = rows.map((row) => toMillions(row.operating_income));
  const netIncome = rows.map((row) => toMillions(row.net_income));

  const segments = buildSegments(rows);

  return (
    <div className="space-y-4">
      <WaterfallChart data={latest} />
      <RevenueSegmentChart labels={labels} segments={segments} grossMargins={grossMargins} />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <MarginsChart
          labels={labels}
          grossMargins={grossMargins}
          opMargins={operatingMargins}
          netMargins={netMargins}
        />
        <IncomeCompChart
          labels={labels}
          grossProfit={grossProfit}
          opIncome={operatingIncome}
          netIncome={netIncome}
        />
      </div>
    </div>
  );
}
