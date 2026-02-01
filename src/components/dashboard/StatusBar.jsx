export default function StatusBar({ connectionStatus, theme, themeClasses, onOpenNewsletter }) {
  const statusConfig = {
    connected: { color: 'bg-emerald-500', textColor: 'text-emerald-400' },
    connecting: { color: 'bg-yellow-500', textColor: 'text-yellow-400' },
    disconnected: { color: 'bg-red-500', textColor: 'text-red-400' },
  };

  const status = statusConfig[connectionStatus] || statusConfig.disconnected;
  const now = new Date();
  const currentTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

  return (
    <div className={`h-7 flex items-center justify-between px-4 ${themeClasses.surfaceElevated} border-t ${themeClasses.border}`}>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${status.color} ${connectionStatus === 'connecting' ? 'animate-pulse' : ''}`} />
          <button 
            onClick={onOpenNewsletter}
            className="text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1.5"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Newsletter
          </button>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <span className={`text-xs ${themeClasses.textMuted} flex items-center gap-1`}>
          <kbd className="px-1.5 py-0.5 bg-[#1e1e2d] rounded text-[10px] font-mono text-gray-500 border border-[#2a2a3d]">⌘K</kbd>
          <span className="text-gray-600">Command palette</span>
        </span>
        <span className={`text-xs ${themeClasses.textMuted}`}>{currentTime}</span>
        <span className={`text-xs ${themeClasses.textMuted}`}>Build 1.0.0</span>
        <span className={`text-xs ${themeClasses.textMuted}`}>MARKET DATA POWERED BY <a href="https://alpaca.markets" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">ALPACA</a></span>
      </div>
    </div>
  );
}
