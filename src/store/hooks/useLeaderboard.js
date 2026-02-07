import { useMemo } from 'react';

const CHALLENGE_INFO = {
  id: 'super-bowl-2026',
  startingCapital: 100000,
  startDate: '2026-02-01',
  endDate: '2026-02-08',
};

const MOCK_USERS = [
  { id: 'user-01', name: 'Avery C.', totalValue: 165420, todayPnL: 1120, todayPnLPercent: 0.68 },
  { id: 'user-02', name: 'Jordan M.', totalValue: 162880, todayPnL: 840, todayPnLPercent: 0.52 },
  { id: 'user-03', name: 'Riley S.', totalValue: 159640, todayPnL: 410, todayPnLPercent: 0.26 },
  { id: 'user-04', name: 'Quinn T.', totalValue: 156210, todayPnL: 980, todayPnLPercent: 0.63 },
  { id: 'user-05', name: 'Morgan P.', totalValue: 154900, todayPnL: -120, todayPnLPercent: -0.08 },
  { id: 'user-06', name: 'Cameron L.', totalValue: 152475, todayPnL: 260, todayPnLPercent: 0.17 },
  { id: 'user-07', name: 'Harper D.', totalValue: 149330, todayPnL: 690, todayPnLPercent: 0.46 },
  { id: 'user-08', name: 'Parker B.', totalValue: 147920, todayPnL: -340, todayPnLPercent: -0.23 },
  { id: 'user-09', name: 'Blake R.', totalValue: 146775, todayPnL: 530, todayPnLPercent: 0.36 },
  { id: 'user-10', name: 'Reese K.', totalValue: 145010, todayPnL: 150, todayPnLPercent: 0.1 },
  { id: 'user-11', name: 'Sawyer H.', totalValue: 143690, todayPnL: -220, todayPnLPercent: -0.15 },
  { id: 'user-12', name: 'Rowan F.', totalValue: 142350, todayPnL: 420, todayPnLPercent: 0.3 },
  { id: 'user-13', name: 'Emerson G.', totalValue: 139980, todayPnL: 610, todayPnLPercent: 0.44 },
  { id: 'user-14', name: 'Taylor N.', totalValue: 137440, todayPnL: -95, todayPnLPercent: -0.07 },
  { id: 'user-15', name: 'Casey V.', totalValue: 135120, todayPnL: 330, todayPnLPercent: 0.25 },
  { id: 'user-16', name: 'Finley W.', totalValue: 133860, todayPnL: 70, todayPnLPercent: 0.05 },
  { id: 'user-17', name: 'Alex J.', totalValue: 131540, todayPnL: -410, todayPnLPercent: -0.31 },
  { id: 'user-18', name: 'Sydney Z.', totalValue: 129280, todayPnL: 260, todayPnLPercent: 0.2 },
  { id: 'user-19', name: 'Jamie Q.', totalValue: 127900, todayPnL: 120, todayPnLPercent: 0.09 },
  { id: 'user-20', name: 'Kendall Y.', totalValue: 125450, todayPnL: -180, todayPnLPercent: -0.14 },
];

const buildRankings = (entries) => (
  entries
    .slice()
    .sort((a, b) => (
      (b.totalValue - a.totalValue)
      || (b.todayPnL - a.todayPnL)
      || a.name.localeCompare(b.name)
    ))
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }))
);

const normalizeMetric = (value, fallback) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

export const useLeaderboard = ({ totalValue, todayPnL, todayPnLPercent } = {}) => {
  const rankings = useMemo(() => buildRankings(MOCK_USERS), []);

  const myRank = useMemo(() => {
    const safeTotalValue = normalizeMetric(totalValue, CHALLENGE_INFO.startingCapital);
    const safeTodayPnL = normalizeMetric(todayPnL, 0);
    const baseValue = safeTotalValue - safeTodayPnL;
    const derivedPnLPercent = baseValue > 0 ? (safeTodayPnL / baseValue) * 100 : 0;
    const safePnLPercent = normalizeMetric(todayPnLPercent, derivedPnLPercent);

    const me = {
      id: 'you',
      name: 'You',
      totalValue: safeTotalValue,
      todayPnL: safeTodayPnL,
      todayPnLPercent: safePnLPercent,
    };

    const combined = buildRankings([...rankings.map((entry) => ({
      id: entry.id,
      name: entry.name,
      totalValue: entry.totalValue,
      todayPnL: entry.todayPnL,
      todayPnLPercent: entry.todayPnLPercent,
    })), me]);

    const rankIndex = combined.findIndex((entry) => entry.id === me.id);

    return {
      ...me,
      rank: rankIndex >= 0 ? rankIndex + 1 : combined.length + 1,
    };
  }, [rankings, totalValue, todayPnL, todayPnLPercent]);

  return {
    challengeInfo: CHALLENGE_INFO,
    rankings,
    myRank,
  };
};

export { useLeaderboard };
