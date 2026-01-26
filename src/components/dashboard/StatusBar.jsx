export default function StatusBar({ connectionStatus, theme, themeClasses }) {
  const statusConfig = {
    connected: { color: 'bg-emerald-500', text: 'NORMAL OPERATIONS', textColor: 'text-emerald-400' },
    connecting: { color: 'bg-yellow-500', text: 'CONNECTING...', textColor: 'text-yellow-400' },
    disconnected: { color: 'bg-red-500', text: 'DISCONNECTED', textColor: 'text-red-400' },
  };

  const status = statusConfig[connectionStatus] || statusConfig.disconnected;
  const now = new Date();
  const currentTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

  return (
    <div className={`h-7 flex items-center justify-between px-4 ${themeClasses.surfaceElevated} border-t ${themeClasses.border}`}>
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${status.color} ${connectionStatus === 'connecting' ? 'animate-pulse' : ''}`} />
        <span className={`text-xs font-medium ${status.textColor}`}>{status.text}</span>
      </div>
      <div className="flex items-center gap-4">
        <span className={`text-xs ${themeClasses.textMuted}`}>{currentTime}</span>
        <span className={`text-xs ${themeClasses.textMuted}`}>Build 1.0.0</span>
        <span className={`text-xs ${themeClasses.textMuted}`}>MARKET DATA POWERED BY <a href="https://alpaca.markets" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">ALPACA</a></span>
      </div>
    </div>
  );
}
