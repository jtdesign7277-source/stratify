import { createContext, useContext } from 'react';

import { useLeaderboard as useLeaderboardHook } from './hooks/useLeaderboard';
import { useMarketData as useMarketDataHook } from './hooks/useMarketData';
import { usePortfolio as usePortfolioHook } from './hooks/usePortfolio';
import { useStrategies as useStrategiesHook } from './hooks/useStrategies';
import { useTradeHistory as useTradeHistoryHook } from './hooks/useTradeHistory';
import { useWatchlist as useWatchlistHook } from './hooks/useWatchlist';

const StratifyContext = createContext(null);

export const StratifyProvider = ({ children }) => {
  const marketData = useMarketDataHook();
  const portfolio = usePortfolioHook(marketData.prices);
  const watchlist = useWatchlistHook();
  const tradeHistory = useTradeHistoryHook({ onApplyTrade: portfolio.applyTrade });
  const leaderboard = useLeaderboardHook({
    totalValue: portfolio.totalValue,
    todayPnL: portfolio.todayPnL,
    todayPnLPercent: portfolio.todayPnLPercent,
  });
  const strategies = useStrategiesHook();

  const value = {
    marketData,
    portfolio,
    watchlist,
    tradeHistory,
    leaderboard,
    strategies,
  };

  return (
    <StratifyContext.Provider value={value}>
      {children}
    </StratifyContext.Provider>
  );
};

const useStratifyContext = () => {
  const context = useContext(StratifyContext);
  if (!context) {
    throw new Error('StratifyProvider is missing. Wrap your component tree in <StratifyProvider>.');
  }
  return context;
};

export const useMarketData = () => useStratifyContext().marketData;
export const usePortfolio = () => useStratifyContext().portfolio;
export const useWatchlist = () => useStratifyContext().watchlist;
export const useTradeHistory = () => useStratifyContext().tradeHistory;
export const useLeaderboard = () => useStratifyContext().leaderboard;
export const useStrategies = () => useStratifyContext().strategies;

export default StratifyProvider;
