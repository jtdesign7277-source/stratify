import React, { useState } from 'react';
import { Trophy } from 'lucide-react';
import StrategyRankingDrawer from './StrategyRankingDrawer';

// ============================================
// USAGE EXAMPLE - Add this to your strategy results page
// ============================================
// 
// Import and add next to your "Activate Strategy" button:
//
//   <RankAllStrategiesButton 
//     ticker="TSLA"
//     timeframe="1H" 
//     period="6M"
//     capital={100000}
//     onSelectStrategy={(result) => {
//       // Load selected strategy into main chart view
//       // result.fullData contains the full backtest response
//       // result.id is the strategy template id (momentum, rsi, etc.)
//       console.log('Load strategy:', result.id, result.fullData);
//     }}
//   />
//

const RankAllStrategiesButton = ({ 
  ticker, 
  timeframe, 
  period, 
  capital,
  onSelectStrategy,
  backtestEndpoint 
}) => {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setDrawerOpen(true)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-yellow-500/20 bg-yellow-500/[0.05] hover:bg-yellow-500/[0.1] hover:border-yellow-500/30 transition-all duration-200 group"
      >
        <Trophy className="w-4 h-4 text-yellow-400 group-hover:scale-110 transition-transform" strokeWidth={1.5} />
        <span className="text-sm font-medium text-yellow-400/90">Rank All Strategies</span>
      </button>

      <StrategyRankingDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        ticker={ticker}
        timeframe={timeframe}
        period={period}
        capital={capital}
        onSelectStrategy={(result) => {
          onSelectStrategy?.(result);
          setDrawerOpen(false);
        }}
        backtestEndpoint={backtestEndpoint}
      />
    </>
  );
};

export default RankAllStrategiesButton;
