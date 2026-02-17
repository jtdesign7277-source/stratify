import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Bell, BellOff, CheckCircle2, Clock3, Eye, Radio, RefreshCw, Shield, TrendingUp, X, Zap } from 'lucide-react';

const SEVERITY_STYLES = {
  '🔴': { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-300', glow: 'shadow-red-500/20' },
  '🟡': { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-yellow-300', glow: 'shadow-yellow-500/20' },
  '🟢': { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-300', glow: 'shadow-emerald-500/20' },
  '🔵': { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-300', glow: 'shadow-blue-500/20' },
};

const SEVERITY_ICONS = {
  '🔴': AlertTriangle,
  '🟡': Shield,
  '🟢': TrendingUp,
  '🔵': Eye,
};

const timeAgo = (dateStr) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

export default function SophiaCopilot({ onClose }) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [lastScan, setLastScan] = useState(null);
  const pollRef = useRef(null);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch('/api/sophia-copilot');
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setAlerts(Array.isArray(data) ? data : []);
      setError('');
    } catch (err) {
      setError('Failed to load alerts');
    } finally {
      setLoading(false);
    }
  }, []);

  const triggerScan = useCallback(async () => {
    setScanning(true);
    try {
      const res = await fetch('/api/sophia-copilot', { method: 'POST' });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setLastScan(new Date().toISOString());
      // Refresh the list
      await fetchAlerts();
    } catch (err) {
      setError('Scan failed: ' + err.message);
    } finally {
      setScanning(false);
    }
  }, [fetchAlerts]);

  useEffect(() => {
    fetchAlerts();
    // Poll every 60s
    pollRef.current = setInterval(fetchAlerts, 60000);
    return () => clearInterval(pollRef.current);
  }, [fetchAlerts]);

  const unreadCount = alerts.filter((a) => !a.read).length;
  const criticalCount = alerts.filter((a) => a.alert_type === 'critical' && !a.read).length;

  return (
    <div className="h-full flex flex-col bg-[#0b0b0b]">
      {/* Header */}
      <div className="shrink-0 border-b border-[#1f1f1f] px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${criticalCount > 0 ? 'bg-red-500/15 border border-red-500/30' : 'bg-emerald-500/15 border border-emerald-500/25'}`}>
              <Zap className={`w-4 h-4 ${criticalCount > 0 ? 'text-red-400 animate-pulse' : 'text-emerald-300'}`} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                Sophia Copilot
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-red-500/20 text-red-300 border border-red-500/30">
                    {unreadCount}
                  </span>
                )}
              </h2>
              <p className="text-[11px] text-zinc-500">
                {lastScan ? `Last scan ${timeAgo(lastScan)}` : 'Monitoring your positions'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={triggerScan}
              disabled={scanning}
              className={`p-1.5 rounded-lg border transition-colors ${
                scanning
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                  : 'border-[#1f1f1f] text-zinc-400 hover:text-white hover:border-zinc-600'
              }`}
              title="Scan positions now"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
            </button>
            {onClose && (
              <button onClick={onClose} className="p-1.5 rounded-lg border border-[#1f1f1f] text-zinc-400 hover:text-white transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Scan Button Banner */}
      {!loading && alerts.length === 0 && !error && (
        <div className="px-4 py-6 text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <Radio className="w-5 h-5 text-emerald-400" />
          </div>
          <p className="text-sm text-zinc-300 mb-1">No alerts yet</p>
          <p className="text-xs text-zinc-500 mb-4">Run a scan to have Sophia analyze your positions</p>
          <button
            onClick={triggerScan}
            disabled={scanning}
            className="px-4 py-2 text-sm font-medium text-emerald-300 border border-emerald-500/30 bg-emerald-500/10 rounded-lg hover:bg-emerald-500/15 transition-colors disabled:opacity-50"
          >
            {scanning ? 'Sophia is scanning...' : '⚡ Scan Positions Now'}
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mx-4 mt-3 px-3 py-2 rounded-lg border border-red-500/30 bg-red-500/10 text-xs text-red-300">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="px-4 py-8 text-center text-sm text-zinc-500">
          Loading alerts...
        </div>
      )}

      {/* Alert Feed */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {alerts.map((alert) => {
          const styles = SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES['🔵'];
          const Icon = SEVERITY_ICONS[alert.severity] || Eye;

          return (
            <div
              key={alert.id}
              className={`rounded-xl border ${styles.border} ${styles.bg} p-3 transition-all hover:shadow-lg ${styles.glow} ${
                !alert.read ? 'ring-1 ring-white/5' : 'opacity-70'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <div className="shrink-0 mt-0.5">
                  <Icon className={`w-4 h-4 ${styles.text}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-xs font-bold ${styles.text}`}>{alert.symbol}</span>
                    <span className="text-[10px] text-zinc-500">{alert.severity}</span>
                    <span className="text-[10px] text-zinc-600 ml-auto flex items-center gap-1">
                      <Clock3 className="w-2.5 h-2.5" />
                      {timeAgo(alert.created_at)}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-white mb-0.5">{alert.title}</p>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">{alert.message}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      {alerts.length > 0 && (
        <div className="shrink-0 border-t border-[#1f1f1f] px-4 py-2 flex items-center justify-between">
          <span className="text-[10px] text-zinc-600">
            {alerts.length} alerts • {criticalCount > 0 ? `${criticalCount} critical` : 'no critical'}
          </span>
          <button
            onClick={triggerScan}
            disabled={scanning}
            className="text-[10px] text-emerald-400 hover:text-emerald-300 transition-colors disabled:opacity-50"
          >
            {scanning ? 'Scanning...' : '⚡ Rescan'}
          </button>
        </div>
      )}
    </div>
  );
}
