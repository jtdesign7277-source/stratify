import { useState, useMemo } from 'react';

const formatCurrency = (value) => {
  if (value === null || value === undefined || isNaN(value)) return '--';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(value);
};

const formatPercent = (value) => {
  if (value === null || value === undefined || isNaN(value)) return '--';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
};

export default function DataTable({ activeTab, alpacaData, theme, themeClasses }) {
  const [sortColumn, setSortColumn] = useState('symbol');
  const [sortDirection, setSortDirection] = useState('asc');
  const [selectedRow, setSelectedRow] = useState(null);

  const columnConfigs = {
    positions: [
      { key: 'symbol', label: 'Symbol', align: 'left' },
      { key: 'qty', label: 'Position', align: 'right' },
      { key: 'current_price', label: 'Last', align: 'right' },
      { key: 'unrealized_pl', label: 'Daily P&L', align: 'right', colored: true },
      { key: 'unrealized_plpc', label: 'P&L %', align: 'right', colored: true },
      { key: 'avg_entry_price', label: 'Avg Price', align: 'right' },
      { key: 'market_value', label: 'Market Value', align: 'right' },
    ],
    orders: [
      { key: 'symbol', label: 'Symbol', align: 'left' },
      { key: 'side', label: 'Side', align: 'left' },
      { key: 'qty', label: 'Qty', align: 'right' },
      { key: 'type', label: 'Type', align: 'left' },
      { key: 'status', label: 'Status', align: 'left' },
    ],
    trades: [
      { key: 'symbol', label: 'Symbol', align: 'left' },
      { key: 'side', label: 'Side', align: 'left' },
      { key: 'qty', label: 'Qty', align: 'right' },
      { key: 'price', label: 'Price', align: 'right' },
    ],
    balances: [
      { key: 'type', label: 'Type', align: 'left' },
      { key: 'currency', label: 'Currency', align: 'left' },
      { key: 'amount', label: 'Amount', align: 'right' },
    ],
  };

  const columns = columnConfigs[activeTab] || columnConfigs.positions;

  const getData = () => {
    switch (activeTab) {
      case 'positions': return alpacaData?.positions || [];
      case 'orders': return alpacaData?.orders || [];
      case 'trades': return alpacaData?.trades || [];
      case 'balances': 
        const account = alpacaData?.account || {};
        return [{ type: 'USD CASH', currency: 'USD', amount: account.cash }];
      default: return [];
    }
  };

  const sortedData = useMemo(() => {
    const data = getData();
    return [...data].sort((a, b) => {
      const aVal = a[sortColumn], bVal = b[sortColumn];
      if (aVal === bVal) return 0;
      const comparison = aVal < bVal ? -1 : 1;
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [activeTab, alpacaData, sortColumn, sortDirection]);

  const handleSort = (column) => {
    if (sortColumn === column) setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortColumn(column); setSortDirection('asc'); }
  };

  const getValueColor = (value) => {
    if (value === null || value === undefined) return themeClasses.text;
    const num = parseFloat(value);
    if (num > 0) return 'text-emerald-400';
    if (num < 0) return 'text-red-400';
    return themeClasses.text;
  };

  const renderCell = (row, col) => {
    const value = row[col.key];
    if (col.key === 'current_price' || col.key === 'avg_entry_price' || col.key === 'price' || col.key === 'market_value' || col.key === 'amount') return formatCurrency(value);
    if (col.key === 'unrealized_plpc') return formatPercent(parseFloat(value) * 100);
    if (col.key === 'unrealized_pl') return formatCurrency(value);
    if (col.key === 'side') return <span className={value === 'buy' ? 'text-emerald-400' : 'text-red-400'}>{value?.toUpperCase()}</span>;
    if (col.key === 'status') return <span className={value === 'filled' ? 'text-emerald-400' : 'text-cyan-400'}>{value?.toUpperCase()}</span>;
    return value ?? '--';
  };

  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full">
        <thead className={`sticky top-0 ${themeClasses.surfaceElevated}`}>
          <tr>
            {columns.map((col) => (
              <th key={col.key} onClick={() => handleSort(col.key)} className={`px-4 py-3 text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-[#2A2A2A] ${themeClasses.textMuted} ${col.align === 'right' ? 'text-right' : 'text-left'}`}>
                <div className={`flex items-center gap-1 ${col.align === 'right' ? 'justify-end' : ''}`}>
                  {col.label}
                  {sortColumn === col.key && <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={sortDirection === 'asc' ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} /></svg>}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedData.length === 0 ? (
            <tr><td colSpan={columns.length} className={`px-4 py-16 text-center ${themeClasses.textMuted}`}>No {activeTab} to display</td></tr>
          ) : (
            sortedData.map((row, index) => (
              <tr key={row.symbol || index} onClick={() => setSelectedRow(index)} className={`border-b border-[#1A1A1A] cursor-pointer ${selectedRow === index ? 'bg-[#252525] border-l-2 border-l-emerald-500' : 'hover:bg-[#1E1E1E]'}`}>
                {columns.map((col) => (
                  <td key={col.key} className={`px-4 py-3 text-sm font-mono ${col.align === 'right' ? 'text-right' : 'text-left'} ${col.colored ? getValueColor(row[col.key]) : themeClasses.text}`}>{renderCell(row, col)}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
