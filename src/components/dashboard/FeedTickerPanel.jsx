// FeedTickerPanel.jsx — Live ticker panel for the split-screen feed view
// Shows tickers related to the selected hashtag with live streaming prices
// Combines hardcoded default tickers per feed + dynamically extracted from posts

import { useState, useEffect, useRef, useMemo } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Zap, ExternalLink, BarChart2 } from 'lucide-react'

// Default tickers per feed — curated for each hashtag
const FEED_TICKERS = {
  Earnings:          ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'TSLA', 'NFLX'],
  Momentum:          ['SPY', 'QQQ', 'IWM', 'NVDA', 'TSLA', 'AMD', 'SMCI', 'PLTR'],
  Macro:             ['SPY', 'TLT', 'GLD', 'DXY', 'QQQ', 'IWM', 'VIX', 'USO'],
  Options:           ['SPY', 'QQQ', 'TSLA', 'NVDA', 'AAPL', 'AMD', 'META', 'AMZN'],
  Sentiment:         ['SPY', 'QQQ', 'VIX', 'TLT', 'GLD', 'IWM', 'HYG', 'UVXY'],
  PreMarket:         ['SPY', 'QQQ', 'TSLA', 'NVDA', 'AAPL', 'AMD', 'AMZN', 'META'],
  AfterHours:        ['TSLA', 'NVDA', 'AAPL', 'AMZN', 'META', 'GOOGL', 'MSFT', 'NFLX'],
  Sectors:           ['XLK', 'XLF', 'XLE', 'XLV', 'XLI', 'XLP', 'XLY', 'XLRE'],
  Indices:           ['SPY', 'QQQ', 'DIA', 'IWM', 'VTI', 'MDY', 'EFA', 'EEM'],
  Volume:            ['SPY', 'QQQ', 'TSLA', 'NVDA', 'AMD', 'AAPL', 'AMC', 'SOFI'],
  Trending:          ['NVDA', 'TSLA', 'AAPL', 'AMD', 'PLTR', 'SOFI', 'SMCI', 'META'],
  MemeStocks:        ['GME', 'AMC', 'BBBY', 'BB', 'KOSS', 'SOFI', 'PLTR', 'HOOD'],
  Runners:           ['SPY', 'QQQ', 'TSLA', 'NVDA', 'AMD', 'SMCI', 'PLTR', 'SOFI'],
  Squeezes:          ['GME', 'AMC', 'BBBY', 'KOSS', 'SPRT', 'ATER', 'IRNT', 'SOFI'],
  IPOs:              ['SPY', 'QQQ', 'RIVN', 'HOOD', 'DUOL', 'ARM', 'CART', 'BIRK'],
  SPACs:             ['SPY', 'DWAC', 'IPOF', 'PSTH', 'SOFI', 'LCID', 'QQQ', 'IWM'],
  PennyStocks:       ['SOFI', 'PLTR', 'BB', 'NOK', 'FUBO', 'CLOV', 'WISH', 'HOOD'],
  Breakouts:         ['SPY', 'QQQ', 'NVDA', 'TSLA', 'AMD', 'AAPL', 'MSFT', 'SMCI'],
  BigTech:           ['AAPL', 'MSFT', 'GOOGL', 'META', 'AMZN', 'NVDA', 'TSLA'],
  AI:                ['NVDA', 'AMD', 'SMCI', 'PLTR', 'MSFT', 'GOOGL', 'META', 'TSM'],
  Semis:             ['NVDA', 'AMD', 'TSM', 'INTC', 'AVGO', 'QCOM', 'MU', 'LRCX'],
  EVs:               ['TSLA', 'RIVN', 'LCID', 'NIO', 'LI', 'XPEV', 'F', 'GM'],
  Fintech:           ['SOFI', 'HOOD', 'SQ', 'PYPL', 'COIN', 'AFRM', 'NU', 'UPST'],
  Biotech:           ['XBI', 'MRNA', 'BNTX', 'REGN', 'VRTX', 'AMGN', 'BIIB', 'GILD'],
  SpaceTech:         ['RKLB', 'LUNR', 'ASTS', 'BKSY', 'MNTS', 'ASTR', 'LMT', 'NOC'],
  FedWatch:          ['TLT', 'SPY', 'GLD', 'SHY', 'IEF', 'LQD', 'HYG', 'DXY'],
  Trump:             ['DJT', 'TSLA', 'GEO', 'CXW', 'DOGE-USD', 'SPY', 'XLF', 'XLE'],
  ElonMusk:          ['TSLA', 'DOGE-USD', 'BTC-USD', 'TWTR', 'SPY', 'XPEV', 'RKLB'],
  Politics:          ['SPY', 'QQQ', 'XLF', 'XLE', 'GLD', 'TLT', 'DXY', 'LMT'],
  Tariffs:           ['SPY', 'EEM', 'FXI', 'KWEB', 'BABA', 'NIO', 'TSM', 'CAT'],
  Bonds:             ['TLT', 'IEF', 'SHY', 'LQD', 'HYG', 'BND', 'AGG', 'TMF'],
  Commodities:       ['GLD', 'SLV', 'USO', 'WEAT', 'COPX', 'DBA', 'UNG', 'PPLT'],
  Forex:             ['UUP', 'FXE', 'FXY', 'FXB', 'FXA', 'EEM', 'SPY', 'GLD'],
  Housing:           ['XHB', 'ITB', 'VNQ', 'O', 'AMT', 'DHI', 'LEN', 'TOL'],
  Jobs:              ['SPY', 'QQQ', 'TLT', 'XLI', 'XLP', 'COST', 'WMT', 'IWM'],
  Bitcoin:           ['BTC-USD', 'ETH-USD', 'MSTR', 'COIN', 'BITO', 'GBTC', 'RIOT', 'MARA'],
  Ethereum:          ['ETH-USD', 'BTC-USD', 'SOL-USD', 'COIN', 'ETHE', 'MSTR', 'RIOT'],
  Altcoins:          ['SOL-USD', 'XRP-USD', 'DOGE-USD', 'ADA-USD', 'AVAX-USD', 'LINK-USD', 'DOT-USD'],
  DeFi:              ['ETH-USD', 'SOL-USD', 'UNI-USD', 'AAVE-USD', 'COIN', 'BTC-USD'],
  CryptoNews:        ['BTC-USD', 'ETH-USD', 'SOL-USD', 'COIN', 'MSTR', 'HOOD', 'SQ'],
  TechnicalAnalysis: ['SPY', 'QQQ', 'TSLA', 'NVDA', 'AAPL', 'AMD', 'MSFT', 'IWM'],
  Fundamentals:      ['AAPL', 'MSFT', 'GOOGL', 'BRK.B', 'JNJ', 'JPM', 'V', 'UNH'],
  DayTrading:        ['SPY', 'QQQ', 'TSLA', 'NVDA', 'AMD', 'AAPL', 'META', 'AMZN'],
  SwingTrades:       ['SPY', 'QQQ', 'TSLA', 'NVDA', 'AAPL', 'MSFT', 'AMD', 'AMZN'],
  Dividends:         ['SCHD', 'VYM', 'O', 'JEPI', 'KO', 'PEP', 'JNJ', 'PG'],
  RiskManagement:    ['SPY', 'QQQ', 'VIX', 'TLT', 'GLD', 'UVXY', 'SH', 'SQQQ'],
  LossPorn:          ['GME', 'AMC', 'TSLA', 'NVDA', 'SPY', 'QQQ', 'BBBY', 'HOOD'],
  GainPorn:          ['TSLA', 'NVDA', 'GME', 'AMD', 'SMCI', 'PLTR', 'COIN', 'MSTR'],
  TradingMemes:      ['GME', 'AMC', 'TSLA', 'DOGE-USD', 'SPY', 'BBBY', 'HOOD', 'SOFI'],
  HotTakes:          ['SPY', 'QQQ', 'TSLA', 'NVDA', 'BTC-USD', 'META', 'AAPL', 'AMD'],
}

// Fetch price data from Twelve Data via your existing Vercel endpoint
async function fetchTickerPrices(symbols) {
  try {
    // Use your existing stocks endpoint or Twelve Data directly
    const res = await fetch(`/api/stocks?symbols=${symbols.join(',')}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } catch (err) {
    console.error('[FeedTickerPanel] Price fetch error:', err)
    return null
  }
}

// Individual ticker row with live price flash
function TickerRow({ symbol, price, prevPrice, change, changePercent, name, onClick }) {
  const isPositive = (changePercent || 0) >= 0
  const priceChanged = prevPrice && prevPrice !== price

  return (
    <motion.button
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      onClick={() => onClick?.(symbol)}
      className="flex items-center justify-between w-full py-2.5 px-3 hover:bg-[#0f1d32] rounded-lg transition-colors group"
    >
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-[#0f1d32] rounded flex items-center justify-center group-hover:bg-[#1a2538] transition-colors">
          <span className="text-xs font-mono font-bold text-blue-400">
            {symbol.replace('-USD', '').slice(0, 3)}
          </span>
        </div>
        <div className="text-left">
          <div className="font-mono text-blue-400 text-sm">${symbol.replace('-USD', '')}</div>
          {name && <div className="text-gray-600 text-xs truncate max-w-[100px]">{name}</div>}
        </div>
      </div>

      <div className="text-right">
        <motion.div
          key={price}
          initial={priceChanged ? {
            backgroundColor: isPositive ? 'rgba(52,211,153,0.2)' : 'rgba(248,113,113,0.2)'
          } : {}}
          animate={{ backgroundColor: 'transparent' }}
          transition={{ duration: 0.6 }}
          className="font-mono text-sm text-white px-1 rounded"
        >
          {price != null ? (typeof price === 'number' ? price.toFixed(2) : price) : '—'}
        </motion.div>
        <div className={`font-mono text-xs ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
          {changePercent != null ? `${isPositive ? '+' : ''}${(typeof changePercent === 'number' ? changePercent.toFixed(2) : changePercent)}%` : '—'}
        </div>
      </div>
    </motion.button>
  )
}

export default function FeedTickerPanel({ feedName, mentionedTickers = [] }) {
  const [tickerData, setTickerData] = useState({})
  const [prevPrices, setPrevPrices] = useState({})
  const [loading, setLoading] = useState(true)
  const wsRef = useRef(null)
  const intervalRef = useRef(null)

  // Merge default tickers + mentioned tickers, deduplicate
  const allTickers = useMemo(() => {
    const defaults = FEED_TICKERS[feedName] || ['SPY', 'QQQ', 'TSLA', 'NVDA', 'AAPL']
    const combined = [...new Set([...defaults, ...mentionedTickers])]
    return combined.slice(0, 12) // Max 12
  }, [feedName, mentionedTickers])

  // Separate crypto from equities for different data handling
  const equityTickers = useMemo(() => allTickers.filter(t => !t.includes('-USD') && t !== 'VIX' && t !== 'DXY'), [allTickers])
  const cryptoTickers = useMemo(() => allTickers.filter(t => t.includes('-USD')), [allTickers])

  // Fetch initial prices
  useEffect(() => {
    let mounted = true
    setLoading(true)

    async function loadPrices() {
      // Fetch equity prices
      if (equityTickers.length > 0) {
        try {
          const res = await fetch(`/api/stocks?symbols=${equityTickers.join(',')}`)
          if (res.ok) {
            const data = await res.json()
            if (mounted) {
              // Handle both array and object responses
              const priceMap = {}
              if (Array.isArray(data)) {
                data.forEach(item => {
                  if (item.symbol) priceMap[item.symbol] = item
                })
              } else if (data.quotes) {
                data.quotes.forEach(item => {
                  if (item.symbol) priceMap[item.symbol] = item
                })
              } else {
                // Single object or keyed object
                Object.entries(data).forEach(([key, val]) => {
                  if (val && typeof val === 'object' && val.symbol) {
                    priceMap[val.symbol] = val
                  }
                })
              }
              setTickerData(prev => ({ ...prev, ...priceMap }))
            }
          }
        } catch (err) {
          console.error('[FeedTickerPanel] Equity fetch error:', err)
        }
      }

      // Fetch crypto prices (if you have a crypto endpoint)
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

    // Refresh every 30 seconds
    intervalRef.current = setInterval(loadPrices, 30000)

    return () => {
      mounted = false
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [equityTickers.join(','), cryptoTickers.join(',')])

  // Track previous prices for flash animation
  useEffect(() => {
    setPrevPrices(prev => {
      const next = { ...prev }
      Object.entries(tickerData).forEach(([symbol, data]) => {
        if (data?.price || data?.close) {
          next[symbol] = data.price || data.close
        }
      })
      return next
    })
  }, [tickerData])

  const handleTickerClick = (symbol) => {
    // Navigate to trade page for this ticker
    window.location.hash = `#trade/${symbol.replace('-USD', '')}`
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a2538] bg-[#0a1628]/50">
        <div className="flex items-center gap-2">
          <BarChart2 size={16} strokeWidth={1.5} className="text-blue-400" />
          <span className="text-gray-300 text-sm font-medium">Related Tickers</span>
        </div>
        <span className="text-gray-600 text-xs">#{feedName}</span>
      </div>

      {/* Ticker List */}
      <div className="flex-1 overflow-y-auto px-1 py-2 custom-ticker-scroll">
        {loading ? (
          // Skeleton
          [...Array(8)].map((_, i) => (
            <div key={i} className="flex items-center justify-between py-2.5 px-3 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-[#1a2538] rounded" />
                <div>
                  <div className="w-14 h-3 bg-[#1a2538] rounded" />
                  <div className="w-20 h-2 bg-[#1a2538] rounded mt-1" />
                </div>
              </div>
              <div className="text-right">
                <div className="w-14 h-3 bg-[#1a2538] rounded" />
                <div className="w-10 h-2 bg-[#1a2538] rounded mt-1 ml-auto" />
              </div>
            </div>
          ))
        ) : (
          allTickers.map((symbol, i) => {
            const data = tickerData[symbol] || tickerData[symbol.replace('-USD', '/USD')] || {}
            const price = data.price || data.close || data.last_price
            const change = data.change || data.day_change
            const changePercent = data.percent_change || data.change_percent || data.day_change_percent

            return (
              <TickerRow
                key={symbol}
                symbol={symbol}
                price={price}
                prevPrice={prevPrices[symbol]}
                change={change}
                changePercent={changePercent ? parseFloat(changePercent) : null}
                name={data.name}
                onClick={handleTickerClick}
              />
            )
          })
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-[#1a2538]">
        <div className="flex items-center justify-between">
          <span className="text-gray-600 text-xs">
            {allTickers.length} tickers · {mentionedTickers.length} from posts
          </span>
          <div className="flex items-center gap-1 text-emerald-500 text-xs">
            <Zap size={10} strokeWidth={2} />
            <span>Live</span>
          </div>
        </div>
      </div>

      <style>{`
        .custom-ticker-scroll::-webkit-scrollbar { width: 4px; }
        .custom-ticker-scroll::-webkit-scrollbar-track { background: transparent; }
        .custom-ticker-scroll::-webkit-scrollbar-thumb { background: #1a2538; border-radius: 2px; }
      `}</style>
    </div>
  )
}
