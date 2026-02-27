import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ExternalLink, RefreshCw } from 'lucide-react';

const REFRESH_INTERVAL_MS = 30000;

const numberFormatter = new Intl.NumberFormat('en-US');

const formatTokens = (value) => numberFormatter.format(Math.max(0, Math.round(Number(value) || 0)));

const normalizeBreakdown = (rows = []) =>
  Array.isArray(rows)
    ? rows
        .map((row) => ({
          name: String(row?.name || row?.job || row?.label || 'Unnamed Cron'),
          tokens: Number(row?.tokens || row?.used_tokens || row?.usage || 0),
          percentage: Number(row?.percentage || row?.pct || 0),
          runs: Number(row?.runs || row?.count || 0),
        }))
        .filter((row) => Number.isFinite(row.tokens) && row.tokens >= 0)
    : [];

const TokensPage = ({ onBack }) => {
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadUsage = useCallback(async ({ silent = false } = {}) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const response = await fetch('/api/xai-usage', { cache: 'no-store' });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || 'Unable to load token usage.');
      }

      setUsage({
        total_tokens: Number(data?.total_tokens || 0),
        used_tokens: Number(data?.used_tokens || 0),
        remaining_tokens: Number(data?.remaining_tokens || 0),
        percentage: Number(data?.percentage || 0),
        alert: Boolean(data?.alert),
        cron_breakdown: normalizeBreakdown(data?.cron_breakdown),
      });
      setLastUpdated(new Date());
      setError('');
    } catch (err) {
      setError(err?.message || 'Unable to load token usage.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadUsage();
    const timer = window.setInterval(() => {
      loadUsage({ silent: true });
    }, REFRESH_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [loadUsage]);

  const metrics = useMemo(() => {
    const total = Number(usage?.total_tokens || 0);
    const used = Number(usage?.used_tokens || 0);
    const remaining = Number(usage?.remaining_tokens || Math.max(total - used, 0));
    const percentage = Math.min(100, Math.max(0, Number(usage?.percentage || 0)));
    const remainingPercent = total > 0 ? (remaining / total) * 100 : 0;
    return {
      total,
      used,
      remaining,
      percentage,
      remainingPercent,
      alert: Boolean(usage?.alert) || remainingPercent < 25,
    };
  }, [usage]);

  const gaugeColor = metrics.percentage >= 85 ? '#ef4444' : metrics.percentage >= 60 ? '#f59e0b' : '#10b981';
  const gaugeTrack = '#1f2937';
  const radius = 88;
  const circumference = 2 * Math.PI * radius;
  const progressOffset = circumference - (metrics.percentage / 100) * circumference;

  return (
    <div className="min-h-screen bg-[#060b12] text-slate-100">
      <div className="mx-auto w-full max-w-6xl px-6 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-300/70">Hidden Diagnostics</p>
            <h1 className="mt-1 text-2xl font-semibold text-emerald-200">xAI Token Timer</h1>
          </div>

          <div className="flex items-center gap-2">
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs text-white/75 transition hover:border-white/30 hover:text-white"
              >
                Back
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => loadUsage({ silent: true })}
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs font-medium text-emerald-200 transition hover:bg-emerald-400/20"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <a
              href="https://console.x.ai/billing"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-black transition hover:bg-emerald-400"
            >
              Purchase More
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>

        {metrics.alert ? (
          <div className="mb-5 flex items-center gap-3 rounded-xl border border-amber-300/40 bg-amber-500/10 px-4 py-3 text-amber-100">
            <AlertTriangle className="h-4 w-4" />
            <p className="text-sm">
              Low token balance: remaining capacity is below 25%. Top up soon to avoid cron interruptions.
            </p>
          </div>
        ) : null}

        {error ? (
          <div className="mb-5 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
          <div className="rounded-2xl border border-white/10 bg-[#0b1522] p-5 shadow-[0_0_24px_rgba(0,0,0,0.35)]">
            <p className="text-xs uppercase tracking-[0.2em] text-white/55">Token Utilization</p>
            <div className="mt-4 flex flex-wrap items-center gap-6">
              <div className="relative h-52 w-52">
                <svg className="h-full w-full -rotate-90" viewBox="0 0 220 220" role="img" aria-label="Token usage gauge">
                  <circle cx="110" cy="110" r={radius} fill="none" stroke={gaugeTrack} strokeWidth="16" />
                  <circle
                    cx="110"
                    cy="110"
                    r={radius}
                    fill="none"
                    stroke={gaugeColor}
                    strokeWidth="16"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={progressOffset}
                    style={{ transition: 'stroke-dashoffset 0.5s ease, stroke 0.3s ease' }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <p className="text-4xl font-semibold">{Math.round(metrics.percentage)}%</p>
                  <p className="text-xs uppercase tracking-[0.2em] text-white/50">Used</p>
                </div>
              </div>

              <div className="grid flex-1 gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-white/50">Total</p>
                  <p className="mt-1 font-mono text-lg text-white">{formatTokens(metrics.total)}</p>
                </div>
                <div className="rounded-xl border border-yellow-400/25 bg-yellow-400/5 p-3">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-yellow-200/80">Used</p>
                  <p className="mt-1 font-mono text-lg text-yellow-100">{formatTokens(metrics.used)}</p>
                </div>
                <div className="rounded-xl border border-emerald-400/25 bg-emerald-400/5 p-3">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-emerald-200/80">Remaining</p>
                  <p className="mt-1 font-mono text-lg text-emerald-100">{formatTokens(metrics.remaining)}</p>
                </div>
              </div>
            </div>

            <p className="mt-4 text-xs text-white/45">
              Auto-refreshes every 30s
              {lastUpdated ? ` • Last updated ${lastUpdated.toLocaleTimeString()}` : ''}
              {loading ? ' • Loading...' : ''}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0b1522] p-5 shadow-[0_0_24px_rgba(0,0,0,0.35)]">
            <p className="text-xs uppercase tracking-[0.2em] text-white/55">Cron Job Breakdown</p>
            <div className="mt-3 space-y-3">
              {(usage?.cron_breakdown || []).length > 0 ? (
                usage.cron_breakdown.map((job) => {
                  const pct = Math.max(0, Math.min(100, Number(job.percentage || 0)));
                  return (
                    <div key={`${job.name}-${job.tokens}`} className="rounded-xl border border-white/10 bg-black/20 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm text-white/90">{job.name}</p>
                        <p className="font-mono text-xs text-emerald-200">{formatTokens(job.tokens)}</p>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-emerald-400/80" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="mt-1 text-[11px] text-white/55">
                        {pct.toFixed(1)}% of usage{job.runs > 0 ? ` • ${job.runs} runs` : ''}
                      </p>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-white/60">
                  No cron usage breakdown available yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TokensPage;
