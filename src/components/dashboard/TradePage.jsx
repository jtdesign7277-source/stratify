import TraderPage from './TraderPage';
import useTradingMode from '../../hooks/useTradingMode';

export default function TradePage({ onPinToTop }) {
  const { tradingMode, isLive, canUseLiveTrading } = useTradingMode();

  return (
    <div className="relative flex-1 min-h-0">
      {isLive && (
        <div className="pointer-events-none absolute right-3 top-3 z-30">
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-gradient-to-r from-emerald-500/20 to-amber-400/20 px-2.5 py-1 text-[10px] font-semibold tracking-[0.15em] text-emerald-100">
            <span>💰</span>
            <span>LIVE</span>
          </span>
        </div>
      )}

      <TraderPage
        onPinToTop={onPinToTop}
        tradingMode={tradingMode}
        canUseLiveTrading={canUseLiveTrading}
      />
    </div>
  );
}
