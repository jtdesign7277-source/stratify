// FeedTickerPanel.jsx — Terminal-pro styled ticker panel for feed view
// Clean table layout: SYMBOL | PRICE | CHG%
// Uses /api/stocks for real Twelve Data prices

import { useState, useEffect, useRef, useMemo } from 'react'
import { motion } from 'framer-motion'
import { BarChart2, Zap } from 'lucide-react'

// Default tickers per feed
const FEED_TICKERS = {
  Earnings:          ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'TSLA', 'NFLX'],
  Momentum:          ['SPY', 'QQQ', 'IWM', 'NVDA', 'TSLA', 'AMD', 'SMCI', 'PLTR'],
  Macro:             ['SPY', 'TLT', 'GLD', 'QQQ', 'IWM', 'USO', 'UUP', 'HYG'],
  Options:           ['SPY', 'QQQ', 'TSLA', 'NVDA', 'AAPL', 'AMD', 'META', 'AMZN'],
  Sentiment:         ['SPY', 'QQQ', 'TLT', 'GLD', 'IWM', 'HYG', 'AAPL', 'NVDA'],
  PreMarket:         ['SPY', 'QQQ', 'TSLA', 'NVDA', 'AAPL', 'AMD', 'AMZN', 'META'],
  AfterHours:        ['TSLA', 'NVDA', 'AAPL', 'AMZN', 'META', 'GOOGL', 'MSFT', 'NFLX'],
  Sectors:           ['XLK', 'XLF', 'XLE', 'XLV', 'XLI', 'XLP', 'XLY', 'XLRE'],
  Indices:           ['SPY', 'QQQ', 'DIA', 'IWM', 'VTI', 'MDY', 'EFA', 'EEM'],
  Volume:            ['SPY', 'QQQ', 'TSLA', 'NVDA', 'AMD', 'AAPL', 'AMC', 'SOFI'],
  Trending:          ['NVDA', 'TSLA', 'AAPL', 'AMD', 'PLTR', 'SOFI', 'SMCI', 'META'],
  MemeStocks:        ['GME', 'AMC', 'BB', 'KOSS', 'SOFI', 'PLTR', 'HOOD', 'BBBY'],
  Runners:           ['SPY', 'QQQ', 'TSLA', 'NVDA', 'AMD', 'SMCI', 'PLTR', 'SOFI'],
  Squeezes:          ['GME', 'AMC', 'KOSS', 'SOFI', 'HOOD', 'BBBY', 'AAPL', 'SPY'],
  IPOs:              ['SPY', 'QQQ', 'RIVN', 'HOOD', 'ARM', 'CART', 'BIRK', 'DUOL'],
  SPACs:             ['SPY', 'SOFI', 'LCID', 'QQQ', 'IWM', 'HOOD', 'PLTR', 'RIVN'],
  PennyStocks:       ['SOFI', 'PLTR', 'BB', 'NOK', 'FUBO', 'CLOV', 'HOOD', 'AMC'],
  Breakouts:         ['SPY', 'QQQ', 'NVDA', 'TSLA', 'AMD', 'AAPL', 'MSFT', 'SMCI'],
  BigTech:           ['AAPL', 'MSFT', 'GOOGL', 'META', 'AMZN', 'NVDA', 'TSLA', 'NFLX'],
  AI:                ['NVDA', 'AMD', 'SMCI', 'PLTR', 'MSFT', 'GOOGL', 'META', 'TSM'],
  Semis:             ['NVDA', 'AMD', 'TSM', 'INTC', 'AVGO', 'QCOM', 'MU', 'LRCX'],
  EVs:               ['TSLA', 'RIVN', 'LCID', 'NIO', 'LI', 'XPEV', 'F', 'GM'],
  Fintech:           ['SOFI', 'HOOD', 'SQ', 'PYPL', 'COIN', 'AFRM', 'NU', 'UPST'],
  Biotech:           ['XBI', 'MRNA', 'BNTX', 'REGN', 'VRTX', 'AMGN', 'BIIB', 'GILD'],
  SpaceTech:         ['RKLB', 'LUNR', 'ASTS', 'BKSY', 'LMT', 'NOC', 'BA', 'RTX'],
  FedWatch:          ['TLT', 'SPY', 'GLD', 'SHY', 'IEF', 'LQD', 'HYG', 'UUP'],
  Trump:             ['DJT', 'TSLA', 'GEO', 'CXW', 'SPY', 'XLF', 'XLE', 'GLD'],
  ElonMusk:          ['TSLA', 'SPY', 'RKLB', 'COIN', 'NVDA', 'XPEV', 'META', 'GOOGL'],
  Politics:          ['SPY', 'QQQ', 'XLF', 'XLE', 'GLD', 'TLT', 'LMT', 'RTX'],
  Tariffs:           ['SPY', 'EEM', 'FXI', 'KWEB', 'BABA', 'NIO', 'TSM', 'CAT'],
  Bonds:             ['TLT', 'IEF', 'SHY', 'LQD', 'HYG', 'BND', 'AGG', 'TMF'],
  Commodities:       ['GLD', 'SLV', 'USO', 'UNG', 'COPX', 'DBA', 'WEAT', 'PPLT'],
  Forex:             ['UUP', 'FXE', 'FXY', 'FXB', 'FXA', 'EEM', 'SPY', 'GLD'],
  Housing:           ['XHB', 'ITB', 'VNQ', 'O', 'AMT', 'DHI', 'LEN', 'TOL'],
  Jobs:              ['SPY', 'QQQ', 'TLT', 'XLI', 'XLP', 'COST', 'WMT', 'IWM'],
  Bitcoin:           ['BTC-USD', 'ETH-USD', 'MSTR', 'COIN', 'BITO', 'GBTC', 'RIOT', 'MARA'],
  Ethereum:          ['ETH-USD', 'BTC-USD', 'SOL-USD', 'COIN', 'MSTR', 'RIOT', 'MARA'],
  Altcoins:          ['SOL-USD', 'XRP-USD', 'DOGE-USD', 'ADA-USD', 'AVAX-USD', 'LINK-USD', 'DOT-USD'],
  DeFi:              ['ETH-USD', 'SOL-USD', 'COIN', 'BTC-USD', 'AAVE-USD', 'UNI-USD'],
  CryptoNews:        ['BTC-USD', 'ETH-USD', 'SOL-USD', 'COIN', 'MSTR', 'HOOD', 'SQ'],
  TechnicalAnalysis: ['SPY', 'QQQ', 'TSLA', 'NVDA', 'AAPL', 'AMD', 'MSFT', 'IWM'],
  Fundamentals:      ['AAPL', 'MSFT', 'GOOGL', 'BRK.B', 'JNJ', 'JPM', 'V', 'UNH'],
  DayTrading:        ['SPY', 'QQQ', 'TSLA', 'NVDA', 'AMD', 'AAPL', 'META', 'AMZN'],
  SwingTrades:       ['SPY', 'QQQ', 'TSLA', 'NVDA', 'AAPL', 'MSFT', 'AMD', 'AMZN'],
  Dividends:         ['SCHD', 'VYM', 'O', 'JEPI', 'KO', 'PEP', 'JNJ', 'PG'],
  RiskManagement:    ['SPY', 'QQQ', 'TLT', 'GLD', 'AAPL', 'NVDA', 'SH', 'SQQQ'],
  LossPorn:          ['GME', 'AMC', 'TSLA', 'NVDA', 'SPY', 'QQQ', 'HOOD', 'BBBY'],
  GainPorn:          ['TSLA', 'NVDA', 'GME', 'AMD', 'SMCI', 'PLTR', 'COIN', 'MSTR'],
  TradingMemes:      ['GME', 'AMC', 'TSLA', 'SPY', 'HOOD', 'SOFI', 'BBBY', 'PLTR'],
  HotTakes:          ['SPY', 'QQQ', 'TSLA', 'NVDA', 'BTC-USD', 'META', 'AAPL', 'AMD'],
}

export default function FeedTickerPanel({ feedName, mentionedTickers = [] }) {
  const [tickerData, setTickerData] = useState({})
  const [prevPrices, setPrevPrices] = useState({})
  const [loading, setLoading] = useState(true)
  const intervalRef = useRef(null)

  // Merge default + mentioned tickers, deduplicate
  const allTickers = useMemo(() => {
    const defaults = FEED_TICKERS[feedName] || ['SPY', 'QQQ', 'TSLA', 'NVDA', 'AAPL']
    const combined = [...new Set([...defaults, ...mentionedTickers])]
    return combined.slice(0, 12)
  }, [feedName, mentionedTickers])

  const equityTickers = useMemo(() => allTickers.filter(t => !t.includes('-USD')), [allTickers])
  const cryptoTickers = useMemo(() => allTickers.filter(t => t.includes('-USD')), [allTickers])

  // Fetch prices
  useEffect(() => {
    let mounted = true
    setLoading(true)

    async function loadPrices() {
      if (equityTickers.length > 0) {
        try {
          const res = await fetch(`/api/stocks?symbols=${equityTickers.join(',')}`)
          if (res.ok) {
            const data = await res.json()
            if (mounted) {
              const priceMap = {}
              if (Array.isArray(data)) {
                data.forEach(item => { if (item.symbol) priceMap[item.symbol] = item })
              } else if (data.quotes) {
                data.quotes.forEach(item => { if (item.symbol) priceMap[item.symbol] = item })
              } else {
                Object.entries(data).forEach(([, val]) => {
                  if (val && typeof val === 'object' && val.symbol) priceMap[val.symbol] = val
                })
              }
              setTickerData(prev => ({ ...prev, ...priceMap }))
            }
          }
        } catch (err) {
          console.error('[FeedTickerPanel] Equity fetch error:', err)
        }
      }

      if (cryptoTickers.length > 0) {
        try {
          const symbols = cryptoTickers.map(t => t.replace('-USD', '/USD')).join(',')
          const res = await fetch(`/api/stocks?symbols=${symbols}`)
          if (res.ok) {
            const data = await res.json()
            if (mounted) {
              const priceMap = {}
              if (Array.isArray(data)) {
                data.forEach(item => {
                  if (item.symbol) priceMap[item.symbol.replace('/', '-')] = item
                })
              }
              setTickerData(prev => ({ ...prev, ...priceMap }))
            }
          }
        } catch (err) {
          console.error('[FeedTickerPanel] Crypto fetch error:', err)
        }
      }

      if (mounted) setLoading(false)
    }

    loadPrices()
    intervalRef.current = setInterval(loadPrices, 30000)

    return () => {
      mounted = false
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [equityTickers.join(','), cryptoTickers.join(',')])

  // Track previous prices for flash
  useEffect(() => {
    setPrevPrices(prev => {
      const next = { ...prev }
      Object.entries(tickerData).forEach(([symbol, data]) => {
        const p = data?.price || data?.close
        if (p) next[symbol] = p
      })
      return next
    })
  }, [tickerData])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1a2538] bg-[#0a1628]/50">
        <div className="flex items-center gap-2">
          <BarChart2 size={14} strokeWidth={1.5} className="text-blue-400" />
          <span className="text-gray-300 text-xs font-medium">Related Tickers</span>
        </div>
        <div className="flex items-center gap-1 text-emerald-500">
          <Zap size={9} strokeWidth={2} />
          <span className="text-[10px]">Live</span>
        </div>
      </div>

      {/* Column headers */}
      <div className="flex items-center px-4 py-1.5 border-b border-[#1a2538]/50 text-[10px] text-gray-600 uppercase tracking-wider font-medium">
        <span className="flex-1">Symbol</span>
        <span className="w-20 text-right">Price</span>
        <span className="w-16 text-right">Chg%</span>
      </div>

      {/* Ticker rows */}
      <div className="flex-1 overflow-y-auto ticker-scroll">
        {loading ? (
          [...Array(8)].map((_, i) => (
            <div key={i} className="flex items-center px-4 py-2 animate-pulse">
              <div className="flex-1"><div className="w-12 h-3 bg-[#1a2538] rounded" /></div>
              <div className="w-20 flex justify-end"><div className="w-14 h-3 bg-[#1a2538] rounded" /></div>
              <div className="w-16 flex justify-end"><div className="w-10 h-3 bg-[#1a2538] rounded" /></div>
            </div>
          ))
        ) : (
          allTickers.map((symbol) => {
            const data = tickerData[symbol] || tickerData[symbol.replace('-USD', '/USD')] || {}
            const price = data.price || data.close || data.last_price
            const changePercent = data.percent_change || data.change_percent || data.day_change_percent
            const pct = changePercent ? parseFloat(changePercent) : null
            const isPositive = (pct || 0) >= 0
            const prevPrice = prevPrices[symbol]
            const flashed = prevPrice && price && prevPrice !== price
            const displaySymbol = symbol.replace('-USD', '')

            return (
              <motion.button
                key={symbol}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={() => { window.location.hash = `#trade/${displaySymbol}` }}
                className="flex items-center w-full px-4 py-2 hover:bg-[#0f1d32] transition-colors text-left"
              >
                <span className="flex-1 font-mono text-xs text-blue-400 font-medium">
                  ${displaySymbol}
                </span>
                <motion.span
                  key={price}
                  initial={flashed ? { backgroundColor: isPositive ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.15)' } : {}}
                  animate={{ backgroundColor: 'transparent' }}
                  transition={{ duration: 0.5 }}
                  className="w-20 text-right font-mono text-xs text-gray-200 rounded px-1"
                >
                  {price != null ? (typeof price === 'number' ? price.toFixed(2) : price) : '--'}
                </motion.span>
                <span className={`w-16 text-right font-mono text-xs font-medium ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                  {pct != null ? `${isPositive ? '+' : ''}${pct.toFixed(2)}%` : '--'}
                </span>
              </motion.button>
            )
          })
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-1.5 border-t border-[#1a2538]">
        <span className="text-gray-600 text-[10px]">
          {allTickers.length} tickers · 30s refresh
        </span>
      </div>

      <style>{`
        .ticker-scroll::-webkit-scrollbar { width: 3px; }
        .ticker-scroll::-webkit-scrollbar-track { background: transparent; }
        .ticker-scroll::-webkit-scrollbar-thumb { background: #1a2538; border-radius: 2px; }
      `}</style>
    </div>
  )
}
