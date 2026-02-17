import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Clock3, Eye, RefreshCw, Shield, TrendingUp, X, Zap } from 'lucide-react';

const SEVERITY_STYLES = {
  '🔴': { border: 'border-red-500/30', text: 'text-red-300', dot: 'bg-red-400' },
  '🟡': { border: 'border-yellow-500/30', text: 'text-yellow-300', dot: 'bg-yellow-400' },
  '🟢': { border: 'border-emerald-500/30', text: 'text-emerald-300', dot: 'bg-emerald-400' },
  '🔵': { border: 'border-blue-500/30', text: 'text-blue-300', dot: 'bg-blue-400' },
  '💡': { border: 'border-amber-500/30', text: 'text-amber-300', dot: 'bg-amber-400' },
  '☀️': { border: 'border-orange-500/30', text: 'text-orange-300', dot: 'bg-orange-400' },
};

const SEVERITY_ICONS = {
  '🔴': AlertTriangle,
  '🟡': Shield,
  '🟢': TrendingUp,
  '🔵': Eye,
  '💡': Zap,
  '☀️': Zap,
};

const timeAgo = (dateStr) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
};

export default function SophiaCopilot({ onClose }) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const panelRef = useRef(null);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch('/api/sophia-copilot');
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setAlerts(Array.isArray(data) ? data.slice(0, 20) : []);
      setError('');
    } catch {
      setError('Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  const triggerScan = useCallback(async () => {
    setScanning(true);
    setError('');
    try {
      const res = await fetch('/api/sophia-copilot', { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `${res.status}`);
      }
      await fetchAlerts();
    } catch (err) {
      setError(err.message || 'Scan failed');
    } finally {
      setScanning(false);
    }
  }, [fetchAlerts]);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  // Close on click outside
  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        onClose?.();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const criticalCount = alerts.filter((a) => a.alert_type === 'critical').length;

  return (
    <div
      ref={panelRef}
      className="absolute bottom-10 left-0 w-[340px] max-h-[420px] rounded-xl border border-[#1f1f1f] bg-[#0c0c0c]/95 backdrop-blur-xl shadow-2xl shadow-black/60 flex flex-col z-[60] overflow-hidden"
    >
      {/* Header */}
      <div className="shrink-0 px-3 py-2.5 border-b border-[#1a1a1a] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className={`w-3.5 h-3.5 ${criticalCount > 0 ? 'text-red-400 animate-pulse' : 'text-amber-400'}`} />
          <span className="text-xs font-bold text-white">Sophia Copilot</span>
          {alerts.length > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400">{alerts.length}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={triggerScan}
            disabled={scanning}
            className="p-1 rounded-md text-zinc-500 hover:text-white transition-colors disabled:opacity-40"
            title="Scan positions"
          >
            <RefreshCw className={`w-3 h-3 ${scanning ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
          <button onClick={onClose} className="p-1 rounded-md text-zinc-500 hover:text-white transition-colors">
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Scan button when empty */}
        {!loading && alerts.length === 0 && !error && (
          <div className="px-4 py-6 text-center">
            <p className="text-xs text-zinc-400 mb-3">No alerts yet</p>
            <button
              onClick={triggerScan}
              disabled={scanning}
              className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors disabled:opacity-50"
            >
              {scanning ? 'Scanning...' : '⚡ Scan Positions'}
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mx-3 mt-2 px-2.5 py-1.5 rounded-lg border border-red-500/20 bg-red-500/5 text-[11px] text-red-300">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="px-4 py-6 text-center text-[11px] text-zinc-600">Loading...</div>
        )}

        {/* Alerts */}
        <div className="p-2 space-y-1.5">
          {alerts.map((alert) => {
            const styles = SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES['🔵'];
            const Icon = SEVERITY_ICONS[alert.severity] || Eye;

            return (
              <div
                key={alert.id}
                className={`rounded-lg border ${styles.border} bg-white/[0.02] px-3 py-2 hover:bg-white/[0.04] transition-colors`}
              >
                <div className="flex items-start gap-2">
                  <Icon className={`w-3 h-3 mt-0.5 shrink-0 ${styles.text}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className={`text-[11px] font-bold ${styles.text}`}>{alert.symbol}</span>
                      <span className="text-[9px] text-zinc-600 ml-auto">{timeAgo(alert.created_at)}</span>
                    </div>
                    <p className={`text-[11px] text-zinc-300 leading-snug ${alert.alert_type === 'morning' ? 'whitespace-pre-line' : ''}`}>{alert.message}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      {scanning && (
        <div className="shrink-0 border-t border-[#1a1a1a] px-3 py-2 text-center">
          <span className="text-[10px] text-emerald-400 animate-pulse">Sophia is analyzing your positions...</span>
        </div>
      )}
    </div>
  );
}
