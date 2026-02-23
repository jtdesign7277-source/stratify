import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';

export { Highcharts };

export default function ChartWrapper({ title, subtitle, options, height = 300 }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#0a1628] p-4 shadow-[0_8px_25px_rgba(2,8,20,0.35)]">
      {title ? (
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-gray-100">{title}</h3>
          {subtitle ? <p className="text-[11px] text-gray-400 mt-0.5">{subtitle}</p> : null}
        </div>
      ) : null}
      <div style={{ height }}>
        <HighchartsReact highcharts={Highcharts} options={options} />
      </div>
    </div>
  );
}
