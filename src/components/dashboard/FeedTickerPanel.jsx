// FeedTickerPanel.jsx — Terminal-pro ticker panel with mini sparklines
// Uses /api/stocks for real Twelve Data prices

import { useState, useEffect, useRef, useMemo } from 'react'
import { motion } from 'framer-motion'
import { BarChart2, Zap } from 'lucide-react'

const COMPANY_NAMES = {
  AAPL: 'Apple Inc.', MSFT: 'Microsoft', NVDA: 'NVIDIA', GOOGL: 'Alphabet',
  AMZN: 'Amazon', META: 'Meta Platforms', TSLA: 'Tesla', NFLX: 'Netflix',
  AMD: 'AMD', SPY: 'SPDR S&P 500', QQQ: 'Invesco QQQ', TLT: 'iShares 20+ Treasury',
  GLD: 'SPDR Gold', IWM: 'iShares Russell 2000', COIN: 'Coinbase',
  PLTR: 'Palantir', SOFI: 'SoFi Technologies', SMCI: 'Super Micro',
  GME: 'GameStop', AMC: 'AMC Entertainment', MSTR: 'MicroStrategy',
  INTC: 'Intel', AVGO: 'Broadcom', BB: 'BlackBerry', HOOD: 'Robinhood',
  RIVN: 'Rivian', DJT: 'Trump Media', XBI: 'Biotech ETF', SCHD: 'Schwab Dividend',
  TSM: 'TSMC', QCOM: 'Qualcomm', MU: 'Micron', LRCX: 'Lam Research',
  MRNA: 'Moderna', BNTX: 'BioNTech', REGN: 'Regeneron', VRTX: 'Vertex',
  AMGN: 'Amgen', BIIB: 'Biogen', GILD: 'Gilead', RKLB: 'Rocket Lab',
  NIO: 'NIO Inc.', LI: 'Li Auto', XPEV: 'XPeng', LCID: 'Lucid Motors',
  SQ: 'Block Inc.', PYPL: 'PayPal', AFRM: 'Affirm', NU: 'Nu Holdings',
  DIA: 'SPDR Dow Jones', VTI: 'Vanguard Total', EFA: 'iShares MSCI EAFE',
  EEM: 'iShares Emerging', XLK: 'Tech Select', XLF: 'Financial Select',
  XLE: 'Energy Select', XLV: 'Health Care Select', XLI: 'Industrial Select',
  USO: 'US Oil Fund', UUP: 'US Dollar Index', HYG: 'High Yield Bond',
  SLV: 'iShares Silver', UNG: 'US Natural Gas', BND: 'Vanguard Bond',
  RIOT: 'Riot Platforms', MARA: 'Marathon Digital', BITO: 'ProShares Bitcoin',
  VYM: 'Vanguard High Div', JEPI: 'JPMorgan Equity', KO: 'Coca-Cola',
  PEP: 'PepsiCo', JNJ: 'Johnson & Johnson', PG: 'Procter & Gamble',
  JPM: 'JPMorgan Chase', V: 'Visa', UNH: 'UnitedHealth',
  'BTC-USD': 'Bitcoin', 'ETH-USD': 'Ethereum', 'SOL-USD': 'Solana',
  'XRP-USD': 'Ripple', 'DOGE-USD': 'Dogecoin', 'ADA-USD': 'Cardano',
  'AVAX-USD': 'Avalanche', 'LINK-USD': 'Chainlink', 'DOT-USD': 'Polkadot',
}

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
  MemeStocks:        ['GME', 'AMC', 'BB', 'KOSS', 'SOFI', 'PLTR', 'HOOD'],
  Runners:           ['SPY', 'QQQ', 'TSLA', 'NVDA', 'AMD', 'SMCI', 'PLTR', 'SOFI'],
  Squeezes:          ['GME', 'AMC', 'KOSS', 'SOFI', 'HOOD', 'AAPL', 'SPY'],
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
  LossPorn:          ['GME', 'AMC', 'TSLA', 'NVDA', 'SPY', 'QQQ', 'HOOD'],
  GainPorn:          ['TSLA', 'NVDA', 'GME', 'AMD', 'SMCI', 'PLTR', 'COIN', 'MSTR'],
  TradingMemes:      ['GME', 'AMC', 'TSLA', 'SPY', 'HOOD', 'SOFI', 'PLTR'],
  HotTakes:          ['SPY', 'QQQ', 'TSLA', 'NVDA', 'BTC-USD', 'META', 'AAPL', 'AMD'],
}

// Generate deterministic sparkline points from price + change
function generateSparkline(price, changePct) {
  if (!price || price === 0) return null
  const points = 12
  const w = 50
  const h = 20
  const trend = changePct || 0
  // Seed from price for determinism
  let seed = Math.round(price * 100)
  const seededRandom = () => {
    seed = (seed * 16807 + 0) % 2147483647
    return (seed & 0x7fffffff) / 0x7fffffff
  }
  // Generate path trending in the direction of change
  const values = []
  let val = h / 2
  for (let i = 0; i < points; i++) {
    val += (seededRandom() - 0.45) * 4 + (trend / 100) * 1.5
    val = Math.max(2, Math.min(h - 2, val))
    values.push(val)
  }
  // Build SVG path
  const step = w / (points - 1)
  const d = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${(h - v).toFixed(1)}`).join(' ')
  return d
}

// Mini sparkline SVG component
function Sparkline({ price, changePct }) {
  const path = useMemo(() => generateSparkline(price, changePct), [price, changePct])
  if (!path) return <div className="w-[50px] h-[20px]" />
  const color = (changePct || 0) >= 0 ? '#34d399' : '#f87171'
  return (
    <svg width="50" height="20" viewBox="0 0 50 20" className="flex-shrink-0">
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function FeedTickerPanel({ feedName, mentionedTickers = [] }) {
  const [tickerData, setTickerData] = useState({})
  const [prevPrices, setPrevPrices] = useState({})
  const [loading, setLoading] = useState(true)
  const intervalRef = useRef(null)

  const allTickers = useMemo(() => {
    const defaults = FEED_TICKERS[feedName] || ['SPY', 'QQQ', 'TSLA', 'NVDA', 'AAPL']
    const combined = [...new Set([...defaults, ...mentionedTickers])]
    return combined.slice(0, 10)
  }, [feedName, mentionedTickers])

  const equityTickers = useMemo(() => allTickers.filter(t => !t.includes('-USD')), [allTickers])
  const cryptoTickers = useMemo(() => allTickers.filter(t => t.includes('-USD')), [allTickers])

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
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#1a2538] bg-[#0a1628]/50">
        <div className="flex items-center gap-2">
          <BarChart2 size={13} strokeWidth={1.5} className="text-blue-400" />
          <span className="text-gray-300 text-xs font-medium">Related Tickers</span>
        </div>
        <div className="flex items-center gap-1 text-emerald-500">
          <Zap size={9} strokeWidth={2} />
          <span className="text-[10px]">Live</span>
        </div>
      </div>

      {/* Ticker rows */}
      <div className="flex-1 overflow-y-auto ticker-scroll py-1">
        {loading ? (
          [...Array(8)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2.5 animate-pulse">
              <div className="flex-1">
                <div className="w-12 h-3 bg-[#1a2538] rounded mb-1" />
                <div className="w-20 h-2 bg-[#1a2538] rounded" />
              </div>
              <div className="w-[50px] h-[20px] bg-[#1a2538] rounded" />
              <div className="text-right">
                <div className="w-14 h-3 bg-[#1a2538] rounded mb-1 ml-auto" />
                <div className="w-16 h-4 bg-[#1a2538] rounded ml-auto" />
              </div>
            </div>
          ))
        ) : (
          allTickers.map((symbol) => {
            const data = tickerData[symbol] || tickerData[symbol.replace('-USD', '/USD')] || {}
            const price = data.price || data.close || data.last_price
            const changePercent = data.percent_change || data.change_percent || data.day_change_percent
            const pct = changePercent ? parseFloat(changePercent) : null
            const isPositive = (pct || 0) >= 0
            const displaySymbol = symbol.replace('-USD', '')
            const name = COMPANY_NAMES[symbol] || data.name || ''

            return (
              <motion.button
                key={symbol}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={() => { window.location.hash = `#trade/${displaySymbol}` }}
                className="flex items-center gap-3 w-full px-3 py-2.5 hover:bg-[#0f1d32] transition-colors text-left"
              >
                {/* Left: Symbol + Name */}
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-xs text-blue-400 font-medium">${displaySymbol}</div>
                  {name && <div className="text-[10px] text-gray-500 truncate">{name}</div>}
                </div>

                {/* Middle: Sparkline */}
                <Sparkline price={price} changePct={pct} />

                {/* Right: Price + Change badge */}
                <div className="text-right flex-shrink-0">
                  <div className="font-mono text-xs text-white">
                    {price != null ? (typeof price === 'number' ? price.toFixed(2) : price) : '--'}
                  </div>
                  {pct != null ? (
                    <span className={`inline-block font-mono text-[10px] font-medium px-1.5 py-0.5 rounded-md mt-0.5 ${
                      isPositive
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {isPositive ? '+' : ''}{pct.toFixed(2)}%
                    </span>
                  ) : (
                    <span className="text-[10px] text-gray-600">--</span>
                  )}
                </div>
              </motion.button>
            )
          })
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-1.5 border-t border-[#1a2538]">
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
