import React from 'react';

export default function SportsOddsPage() {
  const apiKey = import.meta.env.VITE_ODDS_API_KEY;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-xl font-semibold text-white mb-4">Sports Odds</h1>
        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
          <p className="text-sm text-gray-400">
            Live lines panel. Set <code className="text-emerald-400/80">VITE_ODDS_API_KEY</code> in .env to connect.
          </p>
          {!apiKey && (
            <p className="text-xs text-amber-400/80 mt-2">No API key configured.</p>
          )}
        </div>
      </div>
    </div>
  );
}
