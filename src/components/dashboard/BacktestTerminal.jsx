import React, { useState, useEffect, useRef } from 'react';
import { X, Terminal, Play, RefreshCw, TrendingUp, TrendingDown, Clock, DollarSign } from 'lucide-react';

const BacktestTerminal = ({ isOpen, onClose, results, strategy, ticker, onRunBacktest, isLoading }) => {
  const [displayedLines, setDisplayedLines] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const terminalRef = useRef(null);
  const [editableStrategy, setEditableStrategy] = useState(strategy || {});

  useEffect(() => {
    if (strategy) setEditableStrategy(strategy);
  }, [strategy]);

  useEffect(() => {
    if (!isOpen || !results) return;
    
    // Build terminal output lines
    const lines = [];
    const timestamp = new Date().toLocaleTimeString();
    
    lines.push({ type: 'system', text: `[${timestamp}] GROK BACKTEST ENGINE v2.0`, color: 'text-emerald-400' });
    lines.push({ type: 'system', text: '═══════════════════════════════════════════════════════', color: 'text-gray-600' });
    lines.push({ type: 'info', text: `> Analyzing ${results.symbol || ticker} | ${results.period || '6mo'} historical data`, color: 'text-cyan-400' });
    lines.push({ type: 'info', text: `> Bars processed: ${results.barsAnalyzed || 0}`, color: 'text-gray-400' });
    lines.push({ type: 'blank', text: '' });
    
    // Strategy summary
    lines.push({ type: 'header', text: '[ STRATEGY CONFIG ]', color: 'text-purple-400' });
    lines.push({ type: 'config', text: `  ENTRY: ${editableStrategy.entry || 'N/A'}`, color: 'text-yellow-300' });
    lines.push({ type: 'config', text: `  EXIT:  ${editableStrategy.exit || 'N/A'}`, color: 'text-orange-300' });
    lines.push({ type: 'config', text: `  STOP:  ${editableStrategy.stopLoss || 'N/A'}`, color: 'text-red-400' });
    lines.push({ type: 'config', text: `  SIZE:  ${editableStrategy.positionSize || 'N/A'}`, color: 'text-blue-400' });
    lines.push({ type: 'blank', text: '' });

    // Results summary
    const summary = results.summary || {};
    const pnl = parseFloat(summary.totalPnL) || 0;
    const pnlColor = pnl >= 0 ? 'text-emerald-400' : 'text-red-400';
    
    lines.push({ type: 'header', text: '[ PERFORMANCE METRICS ]', color: 'text-purple-400' });
    lines.push({ type: 'metric', text: `  Total Trades:    ${summary.totalTrades || 0}`, color: 'text-white' });
    lines.push({ type: 'metric', text: `  Win Rate:        ${summary.winRate || 0}%`, color: parseFloat(summary.winRate) >= 50 ? 'text-emerald-400' : 'text-red-400' });
    lines.push({ type: 'metric', text: `  Total P&L:       $${summary.totalPnL || '0.00'}`, color: pnlColor });
    lines.push({ type: 'metric', text: `  Return:          ${summary.returnPercent || 0}%`, color: pnlColor });
    lines.push({ type: 'metric', text: `  Avg Win:         $${summary.avgWin || '0.00'}`, color: 'text-emerald-400' });
    lines.push({ type: 'metric', text: `  Avg Loss:        $${summary.avgLoss || '0.00'}`, color: 'text-red-400' });
    lines.push({ type: 'blank', text: '' });

    // Trade log
    if (results.trades && results.trades.length > 0) {
      lines.push({ type: 'header', text: '[ TRADE LOG ]', color: 'text-purple-400' });
      lines.push({ type: 'system', text: '───────────────────────────────────────────────────────', color: 'text-gray-700' });
      
      results.trades.forEach((trade, idx) => {
        const entryDate = new Date(trade.entryTime).toLocaleDateString();
        const entryTime = new Date(trade.entryTime).toLocaleTimeString();
        const exitDate = new Date(trade.exitTime).toLocaleDateString();
        const exitTime = new Date(trade.exitTime).toLocaleTimeString();
        const tradePnl = parseFloat(trade.pnl) || 0;
        const tradeColor = tradePnl >= 0 ? 'text-emerald-400' : 'text-red-400';
        const icon = tradePnl >= 0 ? '▲' : '▼';
        
        lines.push({ type: 'trade', text: `  #${idx + 1} ${icon} ${tradePnl >= 0 ? 'WIN' : 'LOSS'}`, color: tradeColor });
        lines.push({ type: 'detail', text: `     BUY:  ${entryDate} @ ${entryTime}  →  $${trade.entryPrice?.toFixed(2)}`, color: 'text-cyan-300' });
        lines.push({ type: 'detail', text: `     SELL: ${exitDate} @ ${exitTime}  →  $${trade.exitPrice?.toFixed(2)}`, color: 'text-orange-300' });
        lines.push({ type: 'detail', text: `     P&L:  $${trade.pnl?.toFixed(2)} (${trade.pnlPercent?.toFixed(2)}%)  |  ${trade.exitReason}`, color: tradeColor });
        lines.push({ type: 'system', text: '  · · · · · · · · · · · · · · · · · · · · · · · · · · ·', color: 'text-gray-800' });
      });
    } else {
      lines.push({ type: 'warning', text: '> No trades executed in this period', color: 'text-yellow-500' });
    }

    lines.push({ type: 'blank', text: '' });
    lines.push({ type: 'system', text: `[${new Date().toLocaleTimeString()}] Analysis complete. Ready for deployment.`, color: 'text-emerald-400' });
    lines.push({ type: 'cursor', text: '█', color: 'text-emerald-400 animate-pulse' });

    // Typewriter effect
    setDisplayedLines([]);
    setIsTyping(true);
    let lineIndex = 0;
    
    const typeInterval = setInterval(() => {
      if (lineIndex < lines.length) {
        setDisplayedLines(prev => [...prev, lines[lineIndex]]);
        lineIndex++;
        // Auto-scroll
        if (terminalRef.current) {
          terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
      } else {
        clearInterval(typeInterval);
        setIsTyping(false);
      }
    }, 50);

    return () => clearInterval(typeInterval);
  }, [isOpen, results, editableStrategy, ticker]);

  const handleRunBacktest = () => {
    onRunBacktest && onRunBacktest(editableStrategy);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-3xl mx-4 bg-[#0a0a0f] border border-emerald-500/30 rounded-lg shadow-[0_0_50px_rgba(16,185,129,0.15)] overflow-hidden">
        {/* Terminal Header */}
        <div className="flex items-center justify-between px-4 py-2 bg-gradient-to-r from-[#0d0d12] to-[#111118] border-b border-emerald-500/20">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500/80 hover:bg-red-400 cursor-pointer" onClick={onClose} />
              <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
              <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
            </div>
            <div className="flex items-center gap-2 text-emerald-400">
              <Terminal className="w-4 h-4" />
              <span className="text-sm font-mono font-medium">GROK_BACKTEST_v2.0</span>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded transition-colors">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Strategy Editor */}
        <div className="px-4 py-3 bg-[#0d0d12] border-b border-gray-800">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-emerald-400/60 uppercase tracking-wider">Entry</label>
              <input
                type="text"
                value={editableStrategy.entry || ''}
                onChange={(e) => setEditableStrategy(prev => ({ ...prev, entry: e.target.value }))}
                className="w-full mt-1 px-2 py-1.5 bg-black/50 border border-gray-700 rounded text-yellow-300 text-xs font-mono focus:outline-none focus:border-emerald-500/50"
              />
            </div>
            <div>
              <label className="text-[10px] text-emerald-400/60 uppercase tracking-wider">Exit</label>
              <input
                type="text"
                value={editableStrategy.exit || ''}
                onChange={(e) => setEditableStrategy(prev => ({ ...prev, exit: e.target.value }))}
                className="w-full mt-1 px-2 py-1.5 bg-black/50 border border-gray-700 rounded text-orange-300 text-xs font-mono focus:outline-none focus:border-emerald-500/50"
              />
            </div>
            <div>
              <label className="text-[10px] text-emerald-400/60 uppercase tracking-wider">Stop Loss</label>
              <input
                type="text"
                value={editableStrategy.stopLoss || ''}
                onChange={(e) => setEditableStrategy(prev => ({ ...prev, stopLoss: e.target.value }))}
                className="w-full mt-1 px-2 py-1.5 bg-black/50 border border-gray-700 rounded text-red-400 text-xs font-mono focus:outline-none focus:border-emerald-500/50"
              />
            </div>
            <div>
              <label className="text-[10px] text-emerald-400/60 uppercase tracking-wider">Position Size</label>
              <input
                type="text"
                value={editableStrategy.positionSize || ''}
                onChange={(e) => setEditableStrategy(prev => ({ ...prev, positionSize: e.target.value }))}
                className="w-full mt-1 px-2 py-1.5 bg-black/50 border border-gray-700 rounded text-blue-400 text-xs font-mono focus:outline-none focus:border-emerald-500/50"
              />
            </div>
          </div>
          <button
            onClick={handleRunBacktest}
            disabled={isLoading}
            className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/50 rounded text-emerald-400 text-sm font-medium transition-all disabled:opacity-50"
          >
            {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {isLoading ? 'ANALYZING...' : 'RUN BACKTEST'}
          </button>
        </div>

        {/* Terminal Output */}
        <div
          ref={terminalRef}
          className="h-[400px] overflow-y-auto p-4 font-mono text-sm bg-[#0a0a0f]"
          style={{ scrollbarWidth: 'none' }}
        >
          {displayedLines.map((line, idx) => (
            <div key={idx} className={`${line.color} ${line.type === 'blank' ? 'h-3' : ''}`}>
              {line.text}
            </div>
          ))}
          {isLoading && (
            <div className="text-emerald-400 animate-pulse">
              {'>'} Processing market data...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BacktestTerminal;
