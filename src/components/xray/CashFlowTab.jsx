import CashFlowChart from './charts/CashFlowChart';
import FreeCashFlowChart from './charts/FreeCashFlowChart';

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

export default function CashFlowTab({ cashFlowRows = [] }) {
  const rows = normalizeRows(cashFlowRows);

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 bg-[#0a1628] p-10 text-center text-sm text-gray-400">
        No cash flow data available for this symbol and period.
      </div>
    );
  }

  const labels = rows.map((row) => getDateLabel(row.fiscal_date));
  const operating = rows.map((row) => toMillions(row.operating_cash_flow));
  const investing = rows.map((row) => toMillions(row.investing_cash_flow));
  const financing = rows.map((row) => toMillions(row.financing_cash_flow));

  return (
    <div className="space-y-4">
      <CashFlowChart labels={labels} operating={operating} investing={investing} financing={financing} />
      <FreeCashFlowChart labels={labels} operatingCF={operating} investingCF={investing} />
    </div>
  );
}
