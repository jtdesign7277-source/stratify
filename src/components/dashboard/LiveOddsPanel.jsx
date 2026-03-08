import React from 'react';

/**
 * Live odds panel — shows DK + FanDuel odds for selected games (ESPN pill selection).
 * Receives selectedGames (array of { espnId, homeAbbrev, awayAbbrev }) and isArticleOpen.
 */
export default function LiveOddsPanel({ selectedGames = [], isArticleOpen = false }) {
  return (
    <div
      className="flex flex-col h-full min-h-0 overflow-hidden rounded-lg border border-white/[0.06] bg-white/[0.02]"
      style={{ width: '100%' }}
    >
      <div className="shrink-0 px-3 py-2 border-b border-white/[0.06]">
        <span className="text-[11px] font-medium uppercase tracking-wider text-gray-500">
          Live odds
        </span>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-3">
        {Array.isArray(selectedGames) && selectedGames.length > 0 ? (
          <p className="text-xs text-gray-400">
            {selectedGames.length} game(s) selected. Odds load here.
          </p>
        ) : (
          <p className="text-xs text-gray-500">
            Select games from the ESPN pills above to see odds.
          </p>
        )}
      </div>
    </div>
  );
}
