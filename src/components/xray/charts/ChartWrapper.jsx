import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';

export default function ChartWrapper({ title, subtitle, options, loading = false, error = null, empty = false }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0b0b0b] p-3">
      {(title || subtitle) && (
        <div className="mb-2">
          {title ? <h3 className="text-sm font-semibold text-[#e5e7eb]">{title}</h3> : null}
          {subtitle ? <p className="mt-1 text-[11px] text-[#6b7280]">{subtitle}</p> : null}
        </div>
      )}

      {loading ? (
        <div className="flex h-[180px] items-center justify-center text-xs text-[#9ca3af]">Loading chart...</div>
      ) : null}

      {!loading && error ? (
        <div className="flex h-[180px] items-center justify-center text-xs text-red-300">{error}</div>
      ) : null}

      {!loading && !error && empty ? (
        <div className="flex h-[180px] items-center justify-center text-xs text-[#9ca3af]">No data available</div>
      ) : null}

      {!loading && !error && !empty && options ? (
        <HighchartsReact highcharts={Highcharts} options={options} />
      ) : null}
    </div>
  );
}
