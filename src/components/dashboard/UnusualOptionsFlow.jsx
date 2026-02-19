import React, { useState, useEffect, useCallback } from 'react';

const fmtK = (v) => {
  if (v == null) return '—';
  if (v >= 1000000) return (v / 1000000).toFixed(1) + 'M';
  if (v >= 1000) return (v / 1000).toFixed(1) + 'K';
  return v.toLocaleString();
};

const fmtPremium = (v) => {
  if (v == null) return '—';
  if (v >= 1000000) return '$' + (v / 1000000).toFixed(1) + 'M';
  if (v >= 1000) return '$' + (v / 1000).toFixed(0) + 'K';
  return '$' + v.toLocaleString();
};

const fmtExp = (d) => {
  if (!d) return '';
  const parts = d.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return months[parseInt(parts[1], 10) - 1] + ' ' + parseInt(parts[2], 10);
};

const BADGE_STYLES = {
  'SWEEP': 'text-yellow-400 border-yellow-400/30',
  'BLOCK': 'text-orange-400 border-orange-400/30',
  'DARK POOL': 'text-purple-400 border-purple-400/30',
};

const UnusualOptionsFlow = ({ className = '', maxItems = 50 }) => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);

  const fetchFlow = useCallback(async () => {
    try {
      const res = await fetch('/api/options/flow');
      const data = await res.json();
      if (data.alerts) {
        setAlerts(data.alerts.slice(0, maxItems));
        setLastUpdate(new Date());
      }
    } catch (e) { console.error('Options flow error:', e); }
    setLoading(false);
  }, [maxItems]);

  useEffect(() => {
    fetchFlow();
    const iv = setInterval(fetchFlow, 30000);
    return () => clearInterval(iv);
  }, [fetchFlow]);

  return (
    <div className={`bg-[#0b0b0b] text-white/80 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#1f1f1f]">
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-orange-400">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
          <span className="text-[11px] tracking-wider uppercase text-white/40 font-medium">Unusual Options Flow</span>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdate && (
            <span className="text-[9px] text-white/20 font-mono">
              {lastUpdate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          {loading && (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/20 animate-spin">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          )}
        </div>
      </div>

      {/* Feed */}
      <div className="overflow-y-auto max-h-[400px] divide-y divide-[#0f0f0f]">
        {alerts.length === 0 && !loading && (
          <div className="text-white/15 text-xs py-6 text-center">No unusual activity detected</div>
        )}
        {alerts.map((a, i) => {
          const isCall = a.type === 'call';
          const strikeStr = a.strike % 1 === 0 ? a.strike.toFixed(0) : a.strike.toFixed(1);
          return (
            <div key={i} className="flex items-center gap-2 px-3 py-2 hover:bg-white/[0.02] transition-colors">
              {/* Sentiment dot */}
              <span className="text-[11px] flex-shrink-0">{isCall ? '🟢' : '🔴'}</span>

              {/* Symbol */}
              <span className="text-white font-semibold text-[12px] w-11 flex-shrink-0 font-mono">{a.symbol}</span>

              {/* Strike + type */}
              <span className={`text-[11px] font-mono flex-shrink-0 w-14 ${isCall ? 'text-emerald-400' : 'text-red-400'}`}>
                {strikeStr}{isCall ? 'C' : 'P'}
              </span>

              {/* Expiration */}
              <span className="text-[10px] text-white/30 w-12 flex-shrink-0 font-mono">{fmtExp(a.expiration)}</span>

              {/* Vol / OI */}
              <span className="text-[10px] text-white/50 font-mono flex-shrink-0">
                <span className="text-white/25">Vol:</span> {fmtK(a.volume)}
              </span>
              <span className="text-[10px] text-white/35 font-mono flex-shrink-0">
                <span className="text-white/20">OI:</span> {fmtK(a.openInterest)}
              </span>

              {/* V/OI Ratio */}
              <span className={`text-[10px] font-mono font-semibold flex-shrink-0 ${
                a.volumeOIRatio >= 10 ? 'text-orange-400' : a.volumeOIRatio >= 5 ? 'text-yellow-400' : 'text-white/50'
              }`}>
                {a.volumeOIRatio >= 999 ? '∞' : a.volumeOIRatio + 'x'}
              </span>

              {/* Premium */}
              <span className="text-[10px] text-white/60 font-mono font-medium flex-shrink-0 ml-auto">
                {fmtPremium(a.estimatedPremium)}
              </span>

              {/* Badge */}
              {a.tradeType && (
                <span className={`text-[8px] tracking-wider font-semibold border rounded px-1 py-0.5 flex-shrink-0 ${BADGE_STYLES[a.tradeType] || 'text-white/30 border-white/10'}`}>
                  {a.tradeType}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default UnusualOptionsFlow;
