import React from 'react';
import { ExternalLink, Info } from 'lucide-react';

const TokensPage = ({ onBack }) => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0b0b0b] px-6 py-12">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-400/40">
            HIDDEN DIAGNOSTICS
          </div>
          <h1 className="text-3xl font-bold text-zinc-100">xAI Token Management</h1>
        </div>

        {/* Info Card */}
        <div className="rounded-2xl border border-emerald-500/20 bg-[#0f0f0f] p-8 shadow-2xl">
          <div className="mb-6 flex items-start gap-4">
            <div className="rounded-full bg-emerald-500/10 p-3">
              <Info className="h-6 w-6 text-emerald-400" />
            </div>
            <div>
              <h2 className="mb-2 text-lg font-semibold text-zinc-100">
                Token Usage Not Available via API
              </h2>
              <p className="text-sm leading-relaxed text-zinc-400">
                xAI does not currently expose token usage data through their API.
                To view your token balance and usage history, please visit the xAI console.
              </p>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <a
              href="https://console.x.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-6 py-3 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/20"
            >
              <span>Open xAI Console</span>
              <ExternalLink className="h-4 w-4" />
            </a>
            
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800/50 px-6 py-3 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800"
              >
                Back to Dashboard
              </button>
            )}
          </div>

          {/* Usage Note */}
          <div className="mt-6 rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
            <p className="text-xs text-zinc-500">
              <span className="font-semibold text-zinc-400">Note:</span> Once logged in to x.ai,
              look for "Billing," "Usage," or "API Keys" in their navigation to find your token balance.
              xAI may add API access for usage data in the future.
            </p>
          </div>
        </div>

        {/* Access Info */}
        <div className="mt-6 text-center text-xs text-zinc-600">
          <p>
            This page is hidden. Access via clicking{' '}
            <span className="font-mono text-emerald-400/60">BETA</span> on the landing page.
          </p>
        </div>
      </div>
    </div>
  );
};

export default TokensPage;
