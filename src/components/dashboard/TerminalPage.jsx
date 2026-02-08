import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Play, RefreshCw, TrendingUp, TrendingDown, Cpu, Activity, Zap, Rocket, X, ChevronsLeft, ChevronsRight } from 'lucide-react';

const TerminalPage = ({ backtestResults, strategy = {}, ticker = 'SPY', onRunBacktest, isLoading, onDeploy, onNavigateToActive }) => {
  const [displayedLines, setDisplayedLines] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [showDeployPrompt, setShowDeployPrompt] = useState(false);
  const terminalRef = useRef(null);
  
  // Load history from localStorage
  const [history, setHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('stratify-terminal-history');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  
  // Save history to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('stratify-terminal-history', JSON.stringify(history));
  }, [history]);
  
  // Strategy used for display in terminal (captured when backtest runs)
  const [displayStrategy, setDisplayStrategy] = useState({});
  
  // Collapsed state for left panel
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  // Editable strategy for the input fields
  const [editableStrategy, setEditableStrategy] = useState({
    name: strategy?.name || '',
    entry: strategy?.entry || '',
    exit: strategy?.exit || '',
    stopLoss: strategy?.stopLoss || '',
    positionSize: strategy?.positionSize || '',
    ticker: strategy?.ticker || ticker || 'SPY',
  });

  // Update editable strategy when new strategy prop arrives (from GrokPanel)
  useEffect(() => {
    if (strategy && Object.keys(strategy).length > 0) {
      setEditableStrategy({
        name: strategy.name || `${strategy.ticker || ticker || 'SPY'} Strategy`,
        entry: strategy.entry || '',
        exit: strategy.exit || '',
        stopLoss: strategy.stopLoss || '',
        positionSize: strategy.positionSize || '',
        ticker: strategy.ticker || ticker || 'SPY',
      });
      // Also set as display strategy when it first arrives
      setDisplayStrategy(strategy);
    }
  }, [strategy, ticker]);

  // Build terminal lines function (reusable)
  const buildTerminalLines = (results, strat) => {
    if (!results) return;
    if (results.error) {
      setDisplayedLines([{ type: 'error', text: `ERROR: ${results.error}`, color: 'text-red-400' }]);
      return;
    }
    
    try {
      const lines = [];
      const timestamp = new Date().toLocaleTimeString();
      const dateStamp = new Date().toLocaleDateString();
      const safeStr = (val, fallback = 'N/A') => String(val || fallback).substring(0, 60).padEnd(60);
      
      lines.push({ type: 'header', text: '╔══════════════════════════════════════════════════════════════════════════════╗', color: 'text-emerald-500/50' });
      lines.push({ type: 'header', text: '║                    G R O K   B A C K T E S T   E N G I N E                   ║', color: 'text-emerald-400' });
      lines.push({ type: 'header', text: '║                              [ v2.0 CLASSIFIED ]                             ║', color: 'text-emerald-500/50' });
      lines.push({ type: 'header', text: '╚══════════════════════════════════════════════════════════════════════════════╝', color: 'text-emerald-500/50' });
      lines.push({ type: 'blank', text: '' });
      lines.push({ type: 'system', text: `[${dateStamp} ${timestamp}] Connection established to Alpaca Markets API`, color: 'text-gray-500' });
      lines.push({ type: 'system', text: `[${dateStamp} ${timestamp}] Initializing AI analysis module...`, color: 'text-gray-500' });
      lines.push({ type: 'blank', text: '' });
      
      lines.push({ type: 'info', text: `▸ TARGET:     ${results.symbol || strat?.ticker || 'N/A'}`, color: 'text-cyan-400' });
      lines.push({ type: 'info', text: `▸ PERIOD:     ${results.period || '6mo'}`, color: 'text-cyan-400' });
      lines.push({ type: 'info', text: `▸ TIMEFRAME:  ${results.timeframe || '1Day'}`, color: 'text-cyan-400' });
      lines.push({ type: 'info', text: `▸ BARS:       ${results.barsAnalyzed || 0} data points analyzed`, color: 'text-cyan-400' });
      lines.push({ type: 'blank', text: '' });
      
      lines.push({ type: 'section', text: '┌─────────────────────────── STRATEGY PARAMETERS ───────────────────────────┐', color: 'text-purple-500/70' });
      lines.push({ type: 'config', text: `│  ENTRY:    ${safeStr(strat?.entry)}  │`, color: 'text-yellow-300' });
      lines.push({ type: 'config', text: `│  EXIT:     ${safeStr(strat?.exit)}  │`, color: 'text-orange-300' });
      lines.push({ type: 'config', text: `│  STOP:     ${safeStr(strat?.stopLoss)}  │`, color: 'text-red-400' });
      lines.push({ type: 'config', text: `│  SIZE:     ${safeStr(strat?.positionSize)}  │`, color: 'text-blue-400' });
      lines.push({ type: 'section', text: '└────────────────────────────────────────────────────────────────────────────┘', color: 'text-purple-500/70' });
      lines.push({ type: 'blank', text: '' });

      const summary = results.summary || {};
      const pnl = parseFloat(summary.totalPnL) || 0;
      const winRate = parseFloat(summary.winRate) || 0;
      const pnlColor = pnl >= 0 ? 'text-emerald-400' : 'text-red-400';
      const winRateColor = winRate >= 50 ? 'text-emerald-400' : 'text-red-400';
      
      lines.push({ type: 'section', text: '┌─────────────────────────── PERFORMANCE METRICS ───────────────────────────┐', color: 'text-emerald-500/70' });
      lines.push({ type: 'metric', text: `│                                                                            │`, color: 'text-gray-700' });
      const winBarFilled = Math.round(winRate / 5);
      const winBar = '█'.repeat(Math.min(winBarFilled, 20)) + '░'.repeat(Math.max(20 - winBarFilled, 0));
      lines.push({ type: 'metric', text: `│  WIN RATE     [${winBar}]  ${winRate.toFixed(1)}%`, color: winRateColor });
      lines.push({ type: 'metric', text: `│                                                                            │`, color: 'text-gray-700' });
      lines.push({ type: 'metric', text: `│  TOTAL TRADES ············································  ${String(summary.totalTrades || 0).padStart(6)}`, color: 'text-white' });
      lines.push({ type: 'metric', text: `│  WINNING     ·············································  ${String(summary.winningTrades || 0).padStart(6)}`, color: 'text-emerald-400' });
      lines.push({ type: 'metric', text: `│  LOSING      ·············································  ${String(summary.losingTrades || 0).padStart(6)}`, color: 'text-red-400' });
      lines.push({ type: 'metric', text: `│                                                                            │`, color: 'text-gray-700' });
      lines.push({ type: 'metric', text: `│  TOTAL P&L   ············································· $${String(summary.totalPnL || '0.00').padStart(10)}`, color: pnlColor });
      lines.push({ type: 'metric', text: `│  RETURN      ·············································  ${String((summary.returnPercent || 0) + '%').padStart(10)}`, color: pnlColor });
      lines.push({ type: 'metric', text: `│  AVG WIN     ············································· $${String(summary.avgWin || '0.00').padStart(10)}`, color: 'text-emerald-400' });
      lines.push({ type: 'metric', text: `│  AVG LOSS    ············································· $${String(summary.avgLoss || '0.00').padStart(10)}`, color: 'text-red-400' });
      lines.push({ type: 'metric', text: `│                                                                            │`, color: 'text-gray-700' });
      lines.push({ type: 'section', text: '└────────────────────────────────────────────────────────────────────────────┘', color: 'text-emerald-500/70' });
      lines.push({ type: 'blank', text: '' });

      if (results.trades && results.trades.length > 0) {
        lines.push({ type: 'section', text: '┌──────────────────────────────── TRADE LOG ────────────────────────────────┐', color: 'text-amber-500/70' });
        results.trades.forEach((trade, idx) => {
          const entryDate = new Date(trade.entryTime).toLocaleDateString();
          const entryTime = new Date(trade.entryTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const exitDate = new Date(trade.exitTime).toLocaleDateString();
          const exitTime = new Date(trade.exitTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const tradePnl = parseFloat(trade.pnl) || 0;
          const tradeColor = tradePnl >= 0 ? 'text-emerald-400' : 'text-red-400';
          const icon = tradePnl >= 0 ? '✓' : '✗';
          const status = tradePnl >= 0 ? 'WIN ' : 'LOSS';
          
          lines.push({ type: 'trade', text: `│                                                                            │`, color: 'text-gray-700' });
          lines.push({ type: 'trade', text: `│  ═══ TRADE #${String(idx + 1).padStart(2, '0')} ═══════════════════════════════════════════════════════════`, color: tradeColor });
          lines.push({ type: 'trade', text: `│  ${icon} STATUS: ${status}                                                           │`, color: tradeColor });
          lines.push({ type: 'detail', text: `│    ┌─ BUY ───────────────────────────────────────────────────────────────┐`, color: 'text-cyan-500/50' });
          lines.push({ type: 'detail', text: `│    │  DATE:   ${entryDate}                                                    │`, color: 'text-cyan-300' });
          lines.push({ type: 'detail', text: `│    │  TIME:   ${entryTime}                                                       │`, color: 'text-cyan-300' });
          lines.push({ type: 'detail', text: `│    │  PRICE:  $${trade.entryPrice?.toFixed(2)}                                                   │`, color: 'text-cyan-400' });
          lines.push({ type: 'detail', text: `│    └──────────────────────────────────────────────────────────────────────┘`, color: 'text-cyan-500/50' });
          lines.push({ type: 'detail', text: `│    ┌─ SELL ──────────────────────────────────────────────────────────────┐`, color: 'text-orange-500/50' });
          lines.push({ type: 'detail', text: `│    │  DATE:   ${exitDate}                                                    │`, color: 'text-orange-300' });
          lines.push({ type: 'detail', text: `│    │  TIME:   ${exitTime}                                                       │`, color: 'text-orange-300' });
          lines.push({ type: 'detail', text: `│    │  PRICE:  $${trade.exitPrice?.toFixed(2)}                                                   │`, color: 'text-orange-400' });
          lines.push({ type: 'detail', text: `│    │  REASON: ${(trade.exitReason || 'N/A').substring(0, 55).padEnd(55)}    │`, color: 'text-orange-300' });
          lines.push({ type: 'detail', text: `│    └──────────────────────────────────────────────────────────────────────┘`, color: 'text-orange-500/50' });
          lines.push({ type: 'pnl', text: `│    P&L:  ${tradePnl >= 0 ? '+' : ''}$${trade.pnl?.toFixed(2)} (${tradePnl >= 0 ? '+' : ''}${trade.pnlPercent?.toFixed(2)}%)`, color: tradeColor });
        });
        lines.push({ type: 'section', text: '│                                                                            │', color: 'text-gray-700' });
        lines.push({ type: 'section', text: '└────────────────────────────────────────────────────────────────────────────┘', color: 'text-amber-500/70' });
      } else {
        lines.push({ type: 'warning', text: '⚠ NO TRADES EXECUTED - Strategy conditions not met during this period', color: 'text-yellow-500' });
      }

      lines.push({ type: 'blank', text: '' });
      lines.push({ type: 'system', text: `[${new Date().toLocaleTimeString()}] ▸ Analysis complete`, color: 'text-gray-500' });
      lines.push({ type: 'system', text: `[${new Date().toLocaleTimeString()}] ▸ System ready for deployment`, color: 'text-emerald-500' });
      lines.push({ type: 'blank', text: '' });
      lines.push({ type: 'cursor', text: '> █', color: 'text-emerald-400 animate-pulse' });

      // Typewriter effect
      setDisplayedLines([]);
      setIsTyping(true);
      let lineIndex = 0;
      
      const typeInterval = setInterval(() => {
        if (lineIndex < lines.length) {
          setDisplayedLines(prev => [...prev, lines[lineIndex]]);
          lineIndex++;
          if (terminalRef.current) {
            terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
          }
        } else {
          clearInterval(typeInterval);
          setIsTyping(false);
          setShowDeployPrompt(true);
        }
      }, 25);

      return () => clearInterval(typeInterval);
    } catch (err) {
      console.error('Terminal render error:', err);
      setDisplayedLines([{ type: 'error', text: `RENDER ERROR: ${err.message}`, color: 'text-red-400' }]);
    }
  };

  useEffect(() => {
    if (!backtestResults) return;
    buildTerminalLines(backtestResults, displayStrategy || strategy);
    // Save to history
    if (backtestResults && !backtestResults.error) {
      setHistory(prev => [{ timestamp: new Date().toISOString(), results: backtestResults, strategy: displayStrategy }, ...prev.slice(0, 19)]);
    }
  }, [backtestResults]);

  const handleRunBacktest = () => {
    // Capture the current editable strategy as the one being tested
    setDisplayStrategy({ ...editableStrategy });
    setShowDeployPrompt(false); // Reset deploy prompt
    onRunBacktest && onRunBacktest(editableStrategy);
  };

  const handleDeploy = () => {
    if (onDeploy) {
      const strategyToSave = {
        id: 'strategy-' + Date.now(),
        name: editableStrategy.name || `${editableStrategy.ticker || ticker} Strategy`,
        ticker: editableStrategy.ticker || ticker,
        entry: editableStrategy.entry,
        exit: editableStrategy.exit,
        stopLoss: editableStrategy.stopLoss,
        positionSize: editableStrategy.positionSize,
        backtestResults: backtestResults,
        deployed: true,
        runStatus: 'running',
        savedAt: Date.now(),
        deployedAt: Date.now(),
      };
      onDeploy(strategyToSave);
    }
    if (onNavigateToActive) {
      onNavigateToActive();
    }
  };

  // Load a history item into the terminal
  const handleLoadHistory = (historyItem) => {
    if (historyItem.results) {
      setDisplayStrategy(historyItem.strategy || {});
      setEditableStrategy(historyItem.strategy || {});
      // Trigger re-render of terminal with this result
      // We need to manually build the lines since backtestResults prop won't change
      buildTerminalLines(historyItem.results, historyItem.strategy || {});
      setShowDeployPrompt(true);
    }
  };

  // Clear all history
  const handleClearHistory = () => {
    setHistory([]);
    localStorage.removeItem('stratify-terminal-history');
  };

  return (
    <div className="h-full flex flex-col bg-[#0a0a0f]">
      {/* Terminal Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-[#0d0d12] via-[#111118] to-[#0d0d12] border-b border-emerald-500/20">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
            <Terminal className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-lg font-mono font-bold text-emerald-400 tracking-wider">GROK TERMINAL</h1>
            <p className="text-[10px] text-gray-500 font-mono">ENCRYPTED • AI-POWERED BACKTEST ENGINE v2.0</p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-2 text-gray-500">
            <Cpu className="w-3.5 h-3.5" />
            <span>GROK-3</span>
          </div>
          <div className="flex items-center gap-2 text-gray-500">
            <Activity className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-emerald-500">ONLINE</span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Strategy Editor Panel - Collapsible */}
        <div className={`${isCollapsed ? 'w-14' : 'w-80'} border-r border-gray-800 bg-[#0d0d12] p-3 flex flex-col overflow-hidden transition-all duration-200`}>
          <div className="flex items-center justify-between mb-3 flex-shrink-0">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-purple-400" />
              {!isCollapsed && <span className="text-sm font-mono text-purple-400 uppercase tracking-wider">Strategy Config</span>}
            </div>
            <button 
              onClick={() => setIsCollapsed(!isCollapsed)} 
              className="p-1 hover:bg-gray-700/50 rounded text-gray-400 hover:text-white"
            >
              {isCollapsed ? <ChevronsRight className="w-4 h-4" /> : <ChevronsLeft className="w-4 h-4" />}
            </button>
          </div>
          
          {!isCollapsed && (
          <div className="space-y-2 flex-1 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
            <div>
              <label className="text-[10px] text-emerald-400/60 uppercase tracking-wider font-mono">Strategy Name</label>
              <input
                type="text"
                value={editableStrategy.name || ''}
                onChange={(e) => setEditableStrategy(prev => ({ ...prev, name: e.target.value }))}
                className="w-full mt-1 px-2 py-1.5 bg-black/50 border border-gray-700 rounded text-white text-xs font-mono focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20"
                placeholder="My RSI Strategy"
              />
            </div>
            <div>
              <label className="text-[10px] text-emerald-400/60 uppercase tracking-wider font-mono">Ticker</label>
              <input
                type="text"
                value={editableStrategy.ticker || ticker || ''}
                onChange={(e) => setEditableStrategy(prev => ({ ...prev, ticker: e.target.value }))}
                className="w-full mt-1 px-2 py-1.5 bg-black/50 border border-gray-700 rounded text-cyan-400 text-xs font-mono focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20"
                placeholder="TSLA"
              />
            </div>
            <div>
              <label className="text-[10px] text-emerald-400/60 uppercase tracking-wider font-mono">Entry Condition</label>
              <textarea
                value={editableStrategy.entry || ''}
                onChange={(e) => setEditableStrategy(prev => ({ ...prev, entry: e.target.value }))}
                className="w-full mt-1 px-2 py-1.5 bg-black/50 border border-gray-700 rounded text-yellow-300 text-xs font-mono focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 resize-none"
                rows={1}
                placeholder="Buy when RSI < 30..."
              />
            </div>
            <div>
              <label className="text-[10px] text-emerald-400/60 uppercase tracking-wider font-mono">Exit Condition</label>
              <textarea
                value={editableStrategy.exit || ''}
                onChange={(e) => setEditableStrategy(prev => ({ ...prev, exit: e.target.value }))}
                className="w-full mt-1 px-2 py-1.5 bg-black/50 border border-gray-700 rounded text-orange-300 text-xs font-mono focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 resize-none"
                rows={1}
                placeholder="Sell when RSI > 70..."
              />
            </div>
            <div>
              <label className="text-[10px] text-emerald-400/60 uppercase tracking-wider font-mono">Stop Loss</label>
              <input
                type="text"
                value={editableStrategy.stopLoss || ''}
                onChange={(e) => setEditableStrategy(prev => ({ ...prev, stopLoss: e.target.value }))}
                className="w-full mt-1 px-2 py-1.5 bg-black/50 border border-gray-700 rounded text-red-400 text-xs font-mono focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20"
                placeholder="5%"
              />
            </div>
            <div>
              <label className="text-[10px] text-emerald-400/60 uppercase tracking-wider font-mono">Position Size</label>
              <input
                type="text"
                value={editableStrategy.positionSize || ''}
                onChange={(e) => setEditableStrategy(prev => ({ ...prev, positionSize: e.target.value }))}
                className="w-full mt-1 px-2 py-1.5 bg-black/50 border border-gray-700 rounded text-blue-400 text-xs font-mono focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20"
                placeholder="100 shares"
              />
            </div>
          </div>
          )}

          <button
            onClick={handleRunBacktest}
            disabled={isLoading}
            className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/50 rounded-lg text-emerald-400 text-xs font-mono font-medium transition-all disabled:opacity-50 hover:shadow-[0_0_20px_rgba(16,185,129,0.2)] flex-shrink-0"
          >
            {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {isCollapsed ? null : (isLoading ? 'ANALYZING...' : 'RUN BACKTEST')}
          </button>

          {/* History */}
          {!isCollapsed && history.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-800">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] text-gray-500 uppercase tracking-wider font-mono">Recent Tests</div>
                <button
                  onClick={handleClearHistory}
                  className="p-1 text-gray-600 hover:text-red-400 transition-colors"
                  title="Clear History"
                >
                  <RefreshCw className="w-3 h-3" />
                </button>
              </div>
              <div className="space-y-1 max-h-48 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: '#374151 transparent' }}>
                {history.map((h, i) => {
                  const pnl = parseFloat(h.results?.summary?.totalPnL) || 0;
                  const pnlColor = pnl >= 0 ? 'text-emerald-400' : 'text-red-400';
                  return (
                    <div 
                      key={i} 
                      onClick={() => handleLoadHistory(h)}
                      className="p-2 rounded bg-gray-800/50 hover:bg-gray-700/50 cursor-pointer transition-colors border border-transparent hover:border-emerald-500/30"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-gray-400">
                          {new Date(h.timestamp).toLocaleTimeString()} - {h.results?.symbol}
                        </span>
                        <span className={`text-xs font-mono ${pnlColor}`}>
                          {pnl >= 0 ? '+' : ''}${pnl.toFixed(0)}
                        </span>
                      </div>
                      <div className="text-[10px] text-gray-600 mt-0.5">
                        {h.results?.summary?.totalTrades || 0} trades • {h.results?.summary?.winRate || 0}% win
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Terminal Output */}
        <div
          ref={terminalRef}
          className="flex-1 overflow-y-auto p-6 font-mono text-sm bg-[#0a0a0f]"
          style={{ scrollbarWidth: 'none' }}
        >
          {displayedLines.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center h-full text-gray-600">
              <Terminal className="w-16 h-16 mb-4 opacity-20" />
              <p className="text-lg font-mono">AWAITING INPUT</p>
              <p className="text-xs mt-2 opacity-50">Configure strategy and run backtest</p>
            </div>
          )}
          {displayedLines.map((line, idx) => (
            line ? (
              <div key={idx} className={`${line.color || 'text-white'} ${line.type === 'blank' ? 'h-4' : ''} whitespace-pre`}>
                {line.text || ''}
              </div>
            ) : null
          ))}
          {isLoading && displayedLines.length === 0 && (
            <div className="text-emerald-400 animate-pulse">
              <span className="text-gray-500">[{new Date().toLocaleTimeString()}]</span> ▸ Initializing Grok analysis engine...
            </div>
          )}
          
          {/* Deploy Prompt */}
          {showDeployPrompt && !isTyping && backtestResults && !backtestResults.error && (
            <div className="mt-6 p-3 border border-emerald-500/20 rounded-lg bg-gradient-to-br from-emerald-500/5 to-transparent">
              <div className="flex items-center gap-2 mb-2">
                <Rocket className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-400 font-mono text-sm font-medium">DEPLOY THIS STRATEGY?</span>
              </div>
              <p className="text-gray-500 text-xs mb-3 font-mono">
                Strategy will begin live trading with your configured parameters.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleDeploy}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/50 rounded-lg text-emerald-400 font-mono text-sm font-medium transition-all hover:shadow-[0_0_20px_rgba(16,185,129,0.2)]"
                >
                  <span className="font-bold">Y</span>
                  <span>Deploy</span>
                </button>
                <button
                  onClick={() => setShowDeployPrompt(false)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-600/20 hover:bg-gray-600/30 border border-gray-500/50 rounded-lg text-gray-400 font-mono text-sm font-medium transition-all"
                >
                  <span className="font-bold">N</span>
                  <span>Cancel</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TerminalPage;
