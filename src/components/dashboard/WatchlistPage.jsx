import React, { useState, useMemo, useEffect } from 'react';
import { Search, Plus, TrendingUp, TrendingDown, X, Loader } from 'lucide-react';

const API_BASE = 'https://atlas-api-production-5944.up.railway.app';

const WatchlistPage = ({ watchlist = [], onAddToWatchlist, onRemoveFromWatchlist }) => {
  const [selectedTicker, setSelectedTicker] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [localWatchlist, setLocalWatchlist] = useState([
    { symbol: 'AAPL', name: 'Apple Inc.', price: 259.48, change: 1.20, changePercent: 0.46 },
    { symbol: 'GOOGL', name: 'Alphabet Inc.', price: 338.00, change: -0.25, changePercent: -0.07 },
    { symbol: 'AMZN', name: 'Amazon.com, Inc.', price: 239.30, change: -2.43, changePercent: -1.01 },
    { symbol: 'NVDA', name: 'NVIDIA Corporation', price: 191.13, change: -1.38, changePercent: -0.72 },
    { symbol: 'META', name: 'Meta Platforms, Inc.', price: 716.50, change: -21.81, changePercent: -2.95 },
    { symbol: 'TSLA', name: 'Tesla, Inc.', price: 430.41, change: 13.84, changePercent: 3.32 },
    { symbol: 'QQQ', name: 'Invesco QQQ Trust', price: 621.87, change: -7.56, changePercent: -1.20 },
    { symbol: 'SOFI', name: 'SoFi Technologies, Inc.', price: 22.81, change: -1.55, changePercent: -6.36 },
  ]);

  // Expanded stock database - popular retail stocks
  const allStocks = [
    // Mag 7 + Big Tech
    { symbol: 'AAPL', name: 'Apple Inc.', price: 259.48, change: 1.20, changePercent: 0.46 },
    { symbol: 'GOOGL', name: 'Alphabet Inc.', price: 338.00, change: -0.25, changePercent: -0.07 },
    { symbol: 'GOOG', name: 'Alphabet Inc. Class C', price: 339.50, change: -0.30, changePercent: -0.09 },
    { symbol: 'AMZN', name: 'Amazon.com, Inc.', price: 239.30, change: -2.43, changePercent: -1.01 },
    { symbol: 'NVDA', name: 'NVIDIA Corporation', price: 191.13, change: -1.38, changePercent: -0.72 },
    { symbol: 'META', name: 'Meta Platforms, Inc.', price: 716.50, change: -21.81, changePercent: -2.95 },
    { symbol: 'TSLA', name: 'Tesla, Inc.', price: 430.41, change: 13.84, changePercent: 3.32 },
    { symbol: 'MSFT', name: 'Microsoft Corporation', price: 415.50, change: 2.35, changePercent: 0.57 },
    
    // Retail Favorites - Meme/Growth
    { symbol: 'GME', name: 'GameStop Corp.', price: 28.45, change: 1.23, changePercent: 4.52 },
    { symbol: 'AMC', name: 'AMC Entertainment', price: 4.85, change: 0.15, changePercent: 3.19 },
    { symbol: 'PLTR', name: 'Palantir Technologies', price: 24.80, change: 0.65, changePercent: 2.69 },
    { symbol: 'SOFI', name: 'SoFi Technologies', price: 22.81, change: -1.55, changePercent: -6.36 },
    { symbol: 'HOOD', name: 'Robinhood Markets', price: 18.90, change: 0.45, changePercent: 2.44 },
    { symbol: 'RIVN', name: 'Rivian Automotive', price: 14.25, change: -0.35, changePercent: -2.40 },
    { symbol: 'LCID', name: 'Lucid Group', price: 3.45, change: 0.08, changePercent: 2.37 },
    { symbol: 'NIO', name: 'NIO Inc.', price: 5.80, change: 0.12, changePercent: 2.11 },
    { symbol: 'RKLB', name: 'Rocket Lab USA', price: 22.45, change: 1.34, changePercent: 6.35 },
    { symbol: 'IONQ', name: 'IonQ, Inc.', price: 35.60, change: 2.45, changePercent: 7.39 },
    { symbol: 'MARA', name: 'Marathon Digital', price: 21.30, change: 1.56, changePercent: 7.90 },
    { symbol: 'RIOT', name: 'Riot Platforms', price: 12.45, change: 0.87, changePercent: 7.51 },
    { symbol: 'COIN', name: 'Coinbase Global', price: 265.30, change: 8.45, changePercent: 3.29 },
    { symbol: 'MSTR', name: 'MicroStrategy', price: 478.90, change: 23.45, changePercent: 5.15 },
    { symbol: 'SMCI', name: 'Super Micro Computer', price: 45.60, change: 2.34, changePercent: 5.41 },
    { symbol: 'ARM', name: 'Arm Holdings', price: 156.70, change: 4.56, changePercent: 3.00 },
    
    // Healthcare/Biotech
    { symbol: 'HIMS', name: 'Hims & Hers Health', price: 26.80, change: 1.45, changePercent: 5.72 },
    { symbol: 'MRNA', name: 'Moderna, Inc.', price: 45.30, change: -1.23, changePercent: -2.64 },
    { symbol: 'BNTX', name: 'BioNTech SE', price: 98.70, change: 2.34, changePercent: 2.43 },
    { symbol: 'DNA', name: 'Ginkgo Bioworks', price: 12.45, change: 0.67, changePercent: 5.68 },
    
    // Software/SaaS
    { symbol: 'ADBE', name: 'Adobe Inc.', price: 478.90, change: 5.67, changePercent: 1.20 },
    { symbol: 'CRM', name: 'Salesforce, Inc.', price: 289.50, change: 3.45, changePercent: 1.21 },
    { symbol: 'NOW', name: 'ServiceNow, Inc.', price: 856.70, change: 12.34, changePercent: 1.46 },
    { symbol: 'SNOW', name: 'Snowflake Inc.', price: 178.90, change: -4.56, changePercent: -2.49 },
    { symbol: 'DDOG', name: 'Datadog, Inc.', price: 132.40, change: 3.21, changePercent: 2.49 },
    { symbol: 'NET', name: 'Cloudflare, Inc.', price: 98.70, change: 2.34, changePercent: 2.43 },
    { symbol: 'CRWD', name: 'CrowdStrike Holdings', price: 345.60, change: 5.67, changePercent: 1.67 },
    { symbol: 'ZS', name: 'Zscaler, Inc.', price: 198.70, change: 4.56, changePercent: 2.35 },
    { symbol: 'MDB', name: 'MongoDB, Inc.', price: 287.60, change: 6.78, changePercent: 2.41 },
    { symbol: 'TEAM', name: 'Atlassian Corp.', price: 234.50, change: 3.45, changePercent: 1.49 },
    { symbol: 'OKTA', name: 'Okta, Inc.', price: 98.70, change: 1.23, changePercent: 1.26 },
    { symbol: 'TWLO', name: 'Twilio Inc.', price: 67.80, change: 1.45, changePercent: 2.19 },
    { symbol: 'U', name: 'Unity Software', price: 23.45, change: 0.67, changePercent: 2.94 },
    { symbol: 'RBLX', name: 'Roblox Corporation', price: 56.70, change: 1.23, changePercent: 2.22 },
    { symbol: 'PATH', name: 'UiPath Inc.', price: 14.50, change: 0.34, changePercent: 2.40 },
    
    // Energy/Solar/EV
    { symbol: 'ENPH', name: 'Enphase Energy', price: 89.45, change: 3.21, changePercent: 3.72 },
    { symbol: 'SEDG', name: 'SolarEdge Technologies', price: 23.40, change: 0.87, changePercent: 3.86 },
    { symbol: 'FSLR', name: 'First Solar, Inc.', price: 198.70, change: 5.67, changePercent: 2.94 },
    { symbol: 'RUN', name: 'Sunrun Inc.', price: 12.34, change: 0.45, changePercent: 3.79 },
    { symbol: 'PLUG', name: 'Plug Power Inc.', price: 2.45, change: 0.12, changePercent: 5.15 },
    { symbol: 'CHPT', name: 'ChargePoint Holdings', price: 1.45, change: 0.05, changePercent: 3.57 },
    { symbol: 'BLNK', name: 'Blink Charging', price: 2.34, change: 0.08, changePercent: 3.54 },
    
    // Consumer/Retail
    { symbol: 'ELF', name: 'e.l.f. Beauty', price: 112.45, change: 3.45, changePercent: 3.17 },
    { symbol: 'LULU', name: 'Lululemon Athletica', price: 389.70, change: 5.67, changePercent: 1.48 },
    { symbol: 'DECK', name: 'Deckers Outdoor', price: 178.90, change: 4.56, changePercent: 2.62 },
    { symbol: 'ULTA', name: 'Ulta Beauty', price: 398.70, change: -3.45, changePercent: -0.86 },
    { symbol: 'TGT', name: 'Target Corporation', price: 145.60, change: 1.23, changePercent: 0.85 },
    { symbol: 'COST', name: 'Costco Wholesale', price: 789.30, change: 5.67, changePercent: 0.72 },
    { symbol: 'WMT', name: 'Walmart Inc.', price: 178.90, change: 1.23, changePercent: 0.69 },
    { symbol: 'HD', name: 'Home Depot', price: 378.90, change: 2.34, changePercent: 0.62 },
    { symbol: 'LOW', name: "Lowe's Companies", price: 256.70, change: 1.89, changePercent: 0.74 },
    { symbol: 'NKE', name: 'Nike, Inc.', price: 98.40, change: -1.23, changePercent: -1.23 },
    { symbol: 'SBUX', name: 'Starbucks Corporation', price: 98.70, change: 0.87, changePercent: 0.89 },
    { symbol: 'MCD', name: "McDonald's Corporation", price: 289.70, change: 1.45, changePercent: 0.50 },
    { symbol: 'CMG', name: 'Chipotle Mexican Grill', price: 56.70, change: 0.89, changePercent: 1.60 },
    { symbol: 'DPZ', name: "Domino's Pizza", price: 456.70, change: 3.45, changePercent: 0.76 },
    
    // Streaming/Media
    { symbol: 'NFLX', name: 'Netflix, Inc.', price: 891.50, change: 12.30, changePercent: 1.40 },
    { symbol: 'DIS', name: 'Walt Disney Company', price: 112.45, change: -1.20, changePercent: -1.06 },
    { symbol: 'SPOT', name: 'Spotify Technology', price: 456.70, change: 8.90, changePercent: 1.99 },
    { symbol: 'ROKU', name: 'Roku, Inc.', price: 65.40, change: -1.23, changePercent: -1.85 },
    { symbol: 'WBD', name: 'Warner Bros. Discovery', price: 10.45, change: 0.23, changePercent: 2.25 },
    { symbol: 'PARA', name: 'Paramount Global', price: 11.20, change: 0.15, changePercent: 1.36 },
    
    // Social/Internet
    { symbol: 'SNAP', name: 'Snap Inc.', price: 11.23, change: -0.45, changePercent: -3.85 },
    { symbol: 'PINS', name: 'Pinterest, Inc.', price: 32.10, change: 0.87, changePercent: 2.79 },
    { symbol: 'RDDT', name: 'Reddit, Inc.', price: 156.70, change: 5.67, changePercent: 3.75 },
    { symbol: 'TTD', name: 'The Trade Desk', price: 112.30, change: 2.45, changePercent: 2.23 },
    { symbol: 'UBER', name: 'Uber Technologies', price: 78.90, change: 1.20, changePercent: 1.54 },
    { symbol: 'LYFT', name: 'Lyft, Inc.', price: 18.45, change: 0.32, changePercent: 1.77 },
    { symbol: 'ABNB', name: 'Airbnb, Inc.', price: 145.60, change: 2.34, changePercent: 1.63 },
    { symbol: 'DASH', name: 'DoorDash, Inc.', price: 178.90, change: 3.45, changePercent: 1.97 },
    
    // Fintech/Payments
    { symbol: 'PYPL', name: 'PayPal Holdings', price: 68.90, change: 0.85, changePercent: 1.25 },
    { symbol: 'SQ', name: 'Block, Inc.', price: 78.50, change: -2.10, changePercent: -2.60 },
    { symbol: 'AFRM', name: 'Affirm Holdings', price: 56.70, change: 2.34, changePercent: 4.31 },
    { symbol: 'UPST', name: 'Upstart Holdings', price: 67.80, change: 3.45, changePercent: 5.36 },
    { symbol: 'NU', name: 'Nu Holdings', price: 14.50, change: 0.45, changePercent: 3.20 },
    { symbol: 'V', name: 'Visa Inc.', price: 278.90, change: 2.34, changePercent: 0.85 },
    { symbol: 'MA', name: 'Mastercard Inc.', price: 456.70, change: 3.45, changePercent: 0.76 },
    
    // E-commerce
    { symbol: 'SHOP', name: 'Shopify Inc.', price: 78.90, change: 2.34, changePercent: 3.06 },
    { symbol: 'ETSY', name: 'Etsy, Inc.', price: 56.70, change: 1.23, changePercent: 2.22 },
    { symbol: 'MELI', name: 'MercadoLibre', price: 1890.50, change: 34.56, changePercent: 1.86 },
    { symbol: 'SE', name: 'Sea Limited', price: 98.70, change: 3.45, changePercent: 3.62 },
    { symbol: 'BABA', name: 'Alibaba Group', price: 89.45, change: 1.23, changePercent: 1.39 },
    { symbol: 'JD', name: 'JD.com, Inc.', price: 34.50, change: 0.67, changePercent: 1.98 },
    { symbol: 'PDD', name: 'PDD Holdings', price: 112.30, change: 2.34, changePercent: 2.13 },
    
    // Semiconductors
    { symbol: 'AMD', name: 'Advanced Micro Devices', price: 164.25, change: 3.45, changePercent: 2.15 },
    { symbol: 'INTC', name: 'Intel Corporation', price: 31.20, change: -0.45, changePercent: -1.42 },
    { symbol: 'AVGO', name: 'Broadcom Inc.', price: 178.90, change: 2.34, changePercent: 1.33 },
    { symbol: 'QCOM', name: 'Qualcomm Inc.', price: 167.80, change: 1.89, changePercent: 1.14 },
    { symbol: 'MU', name: 'Micron Technology', price: 98.70, change: 2.34, changePercent: 2.43 },
    { symbol: 'MRVL', name: 'Marvell Technology', price: 89.45, change: 1.67, changePercent: 1.90 },
    { symbol: 'TSM', name: 'Taiwan Semiconductor', price: 189.70, change: 3.45, changePercent: 1.85 },
    { symbol: 'ASML', name: 'ASML Holding', price: 756.80, change: 12.34, changePercent: 1.66 },
    { symbol: 'LRCX', name: 'Lam Research', price: 89.70, change: 1.45, changePercent: 1.64 },
    { symbol: 'KLAC', name: 'KLA Corporation', price: 756.80, change: 8.90, changePercent: 1.19 },
    { symbol: 'ON', name: 'ON Semiconductor', price: 67.80, change: 1.23, changePercent: 1.85 },
    
    // AI/Data
    { symbol: 'AI', name: 'C3.ai, Inc.', price: 34.50, change: 1.23, changePercent: 3.70 },
    { symbol: 'BBAI', name: 'BigBear.ai Holdings', price: 4.56, change: 0.23, changePercent: 5.31 },
    { symbol: 'SOUN', name: 'SoundHound AI', price: 8.90, change: 0.45, changePercent: 5.33 },
    { symbol: 'UPWK', name: 'Upwork Inc.', price: 14.50, change: 0.34, changePercent: 2.40 },
    
    // Banks/Financial
    { symbol: 'JPM', name: 'JPMorgan Chase', price: 198.70, change: 1.23, changePercent: 0.62 },
    { symbol: 'BAC', name: 'Bank of America', price: 35.40, change: 0.23, changePercent: 0.65 },
    { symbol: 'WFC', name: 'Wells Fargo', price: 56.70, change: 0.45, changePercent: 0.80 },
    { symbol: 'GS', name: 'Goldman Sachs', price: 478.90, change: 5.67, changePercent: 1.20 },
    { symbol: 'MS', name: 'Morgan Stanley', price: 98.70, change: 0.89, changePercent: 0.91 },
    { symbol: 'C', name: 'Citigroup Inc.', price: 67.80, change: 0.45, changePercent: 0.67 },
    { symbol: 'SCHW', name: 'Charles Schwab', price: 78.90, change: 0.67, changePercent: 0.86 },
    
    // Pharma/Healthcare
    { symbol: 'JNJ', name: 'Johnson & Johnson', price: 156.80, change: 0.67, changePercent: 0.43 },
    { symbol: 'PFE', name: 'Pfizer Inc.', price: 28.90, change: -0.34, changePercent: -1.16 },
    { symbol: 'UNH', name: 'UnitedHealth Group', price: 534.20, change: 4.56, changePercent: 0.86 },
    { symbol: 'LLY', name: 'Eli Lilly', price: 789.50, change: 12.34, changePercent: 1.59 },
    { symbol: 'ABBV', name: 'AbbVie Inc.', price: 178.90, change: 1.23, changePercent: 0.69 },
    { symbol: 'BMY', name: 'Bristol-Myers Squibb', price: 45.60, change: 0.34, changePercent: 0.75 },
    { symbol: 'GILD', name: 'Gilead Sciences', price: 89.70, change: 0.67, changePercent: 0.75 },
    
    // Aerospace/Defense
    { symbol: 'BA', name: 'Boeing Company', price: 178.90, change: 2.34, changePercent: 1.33 },
    { symbol: 'LMT', name: 'Lockheed Martin', price: 456.70, change: 3.45, changePercent: 0.76 },
    { symbol: 'RTX', name: 'RTX Corporation', price: 112.30, change: 0.89, changePercent: 0.80 },
    { symbol: 'NOC', name: 'Northrop Grumman', price: 478.90, change: 3.45, changePercent: 0.73 },
    { symbol: 'GD', name: 'General Dynamics', price: 289.50, change: 2.34, changePercent: 0.82 },
    
    // ETFs
    { symbol: 'SPY', name: 'SPDR S&P 500 ETF', price: 502.34, change: 1.23, changePercent: 0.25 },
    { symbol: 'QQQ', name: 'Invesco QQQ Trust', price: 621.87, change: -7.56, changePercent: -1.20 },
    { symbol: 'DIA', name: 'SPDR Dow Jones ETF', price: 389.12, change: -0.87, changePercent: -0.22 },
    { symbol: 'IWM', name: 'iShares Russell 2000', price: 198.45, change: 1.23, changePercent: 0.62 },
    { symbol: 'VOO', name: 'Vanguard S&P 500', price: 465.30, change: 2.10, changePercent: 0.45 },
    { symbol: 'VTI', name: 'Vanguard Total Stock', price: 245.60, change: 1.45, changePercent: 0.59 },
    { symbol: 'ARKK', name: 'ARK Innovation ETF', price: 48.90, change: 1.23, changePercent: 2.58 },
    { symbol: 'ARKG', name: 'ARK Genomic ETF', price: 34.50, change: 0.67, changePercent: 1.98 },
    { symbol: 'ARKW', name: 'ARK Next Gen Internet', price: 78.90, change: 1.45, changePercent: 1.87 },
    { symbol: 'SOXL', name: 'Direxion Semiconductor Bull', price: 34.50, change: 1.89, changePercent: 5.79 },
    { symbol: 'TQQQ', name: 'ProShares UltraPro QQQ', price: 67.80, change: 2.34, changePercent: 3.57 },
    { symbol: 'SQQQ', name: 'ProShares UltraPro Short QQQ', price: 8.90, change: -0.34, changePercent: -3.68 },
    { symbol: 'XLF', name: 'Financial Select SPDR', price: 42.30, change: 0.34, changePercent: 0.81 },
    { symbol: 'XLK', name: 'Technology Select SPDR', price: 198.70, change: 1.87, changePercent: 0.95 },
    { symbol: 'XLE', name: 'Energy Select SPDR', price: 89.45, change: -0.67, changePercent: -0.74 },
    { symbol: 'XLV', name: 'Health Care Select SPDR', price: 145.30, change: 0.45, changePercent: 0.31 },
    { symbol: 'GLD', name: 'SPDR Gold Trust', price: 189.30, change: 0.87, changePercent: 0.46 },
    { symbol: 'SLV', name: 'iShares Silver Trust', price: 21.45, change: 0.32, changePercent: 1.51 },
    
    // Crypto
    { symbol: 'BTC', name: 'Bitcoin', price: 97543.21, change: 2345.67, changePercent: 2.46 },
    { symbol: 'ETH', name: 'Ethereum', price: 3245.89, change: -45.23, changePercent: -1.37 },
    { symbol: 'SOL', name: 'Solana', price: 178.34, change: 12.45, changePercent: 7.51 },
    { symbol: 'XRP', name: 'XRP', price: 2.34, change: 0.12, changePercent: 5.41 },
    { symbol: 'DOGE', name: 'Dogecoin', price: 0.32, change: 0.02, changePercent: 6.67 },
    { symbol: 'ADA', name: 'Cardano', price: 0.89, change: 0.05, changePercent: 5.95 },
    { symbol: 'AVAX', name: 'Avalanche', price: 35.67, change: 2.34, changePercent: 7.02 },
    { symbol: 'LINK', name: 'Chainlink', price: 18.90, change: 0.78, changePercent: 4.31 },
    { symbol: 'DOT', name: 'Polkadot', price: 7.45, change: 0.34, changePercent: 4.78 },
    { symbol: 'SHIB', name: 'Shiba Inu', price: 0.000023, change: 0.000001, changePercent: 4.55 },
    { symbol: 'MATIC', name: 'Polygon', price: 0.56, change: 0.03, changePercent: 5.66 },
    { symbol: 'UNI', name: 'Uniswap', price: 12.34, change: 0.45, changePercent: 3.79 },
    { symbol: 'ATOM', name: 'Cosmos', price: 8.90, change: 0.34, changePercent: 3.97 },
    { symbol: 'LTC', name: 'Litecoin', price: 89.45, change: 2.34, changePercent: 2.69 },
  ];

  // Use provided watchlist or local state
  const stocks = watchlist.length > 0 ? watchlist : localWatchlist;

  // Search when query changes
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const query = searchQuery.toLowerCase();
    const watchlistSymbols = stocks.map(s => s.symbol);
    
    // First search local database
    const localResults = allStocks.filter(stock => 
      !watchlistSymbols.includes(stock.symbol) &&
      (stock.symbol.toLowerCase().includes(query) || 
       stock.name.toLowerCase().includes(query))
    ).slice(0, 10);

    setSearchResults(localResults);

    // If no local results, try API
    if (localResults.length === 0 && searchQuery.length >= 2) {
      setIsSearching(true);
      // Try to fetch from backend
      fetch(`${API_BASE}/api/stocks/search?q=${encodeURIComponent(searchQuery)}`)
        .then(res => res.json())
        .then(data => {
          if (data.results && data.results.length > 0) {
            const apiResults = data.results
              .filter(s => !watchlistSymbols.includes(s.symbol))
              .slice(0, 10);
            setSearchResults(apiResults);
          }
        })
        .catch(() => {
          // API failed, keep showing local results or empty
        })
        .finally(() => {
          setIsSearching(false);
        });
    }
  }, [searchQuery, stocks]);

  const handleAddStock = (stock) => {
    if (onAddToWatchlist) {
      onAddToWatchlist(stock);
    } else {
      setLocalWatchlist(prev => [...prev, stock]);
    }
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleRemoveStock = (symbol) => {
    if (onRemoveFromWatchlist) {
      onRemoveFromWatchlist(symbol);
    } else {
      setLocalWatchlist(prev => prev.filter(s => s.symbol !== symbol));
    }
  };

  const handleTickerClick = (symbol) => {
    setSelectedTicker(symbol);
  };

  const handleCloseChart = () => {
    setSelectedTicker(null);
  };

  return (
    <div className="flex-1 flex h-full bg-[#060d18] overflow-hidden">
      {/* Watchlist Panel */}
      <div className={`flex flex-col border-r border-gray-800 transition-all duration-300 ${
        selectedTicker ? 'w-72' : 'flex-1'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div>
            <h1 className={`font-semibold text-white ${selectedTicker ? 'text-base' : 'text-xl'}`}>Watchlist</h1>
            {!selectedTicker && (
              <p className="text-gray-400 text-sm">Live market data • Updates every 15s</p>
            )}
          </div>
        </div>

        {/* Search Bar */}
        <div className="p-3 border-b border-gray-800 bg-[#0a1628] relative">
          <div className="flex items-center gap-2 bg-[#060d18] border border-gray-700 rounded-lg px-3 py-2">
            <Search className="w-4 h-4 text-gray-500" strokeWidth={1.5} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search any stock or crypto..."
              className="flex-1 bg-transparent text-white placeholder-gray-500 text-sm outline-none"
            />
            {isSearching && <Loader className="w-4 h-4 text-purple-400 animate-spin" strokeWidth={1.5} />}
            {searchQuery && !isSearching && (
              <button onClick={() => setSearchQuery('')} className="text-gray-500 hover:text-white">
                <X className="w-4 h-4" strokeWidth={1.5} />
              </button>
            )}
          </div>

          {/* Search Results Dropdown */}
          {searchQuery && (
            <div className="absolute left-3 right-3 top-full mt-1 bg-[#0d1829] border border-gray-700 rounded-lg overflow-hidden shadow-xl z-50 max-h-80 overflow-y-auto">
              {searchResults.length > 0 ? (
                <>
                  <div className="px-3 py-2 text-xs text-gray-500 border-b border-gray-700 bg-[#0a1420] sticky top-0">
                    Click to add to watchlist
                  </div>
                  {searchResults.map((stock) => {
                    const isPositive = (stock.change || 0) >= 0;
                    return (
                      <div 
                        key={stock.symbol}
                        className="flex items-center justify-between px-3 py-2.5 hover:bg-purple-500/20 cursor-pointer transition-colors border-b border-gray-800/50 last:border-0"
                        onClick={() => handleAddStock(stock)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-white font-semibold text-sm">${stock.symbol}</span>
                            <span className="text-gray-400 text-xs truncate">{stock.name}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 ml-2">
                          {stock.price && (
                            <span className="text-white text-sm font-mono">${stock.price?.toFixed(2)}</span>
                          )}
                          {stock.changePercent !== undefined && (
                            <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                              isPositive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                            }`}>
                              {isPositive ? '+' : ''}{stock.changePercent?.toFixed(2)}%
                            </span>
                          )}
                          <Plus className="w-4 h-4 text-purple-400" strokeWidth={2} />
                        </div>
                      </div>
                    );
                  })}
                </>
              ) : (
                <div className="px-4 py-6 text-center">
                  {isSearching ? (
                    <p className="text-gray-400 text-sm">Searching...</p>
                  ) : (
                    <>
                      <p className="text-gray-400 text-sm">No stocks found for "{searchQuery}"</p>
                      <p className="text-gray-500 text-xs mt-1">Try searching by ticker symbol (e.g., AAPL, TSLA)</p>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Stocks List */}
        <div className="flex-1 overflow-auto">
          {!selectedTicker && (
            <div className="grid grid-cols-12 gap-4 px-4 py-2 border-b border-gray-800 text-xs text-gray-500 font-medium sticky top-0 bg-[#060d18] z-10">
              <div className="col-span-4">Symbol</div>
              <div className="col-span-2 text-right">Price</div>
              <div className="col-span-2 text-right">Change</div>
              <div className="col-span-2 text-right">% Change</div>
              <div className="col-span-2 text-right">Actions</div>
            </div>
          )}

          {stocks.map((stock) => {
            const isPositive = stock.change >= 0;
            const isSelected = selectedTicker === stock.symbol;
            
            return (
              <div 
                key={stock.symbol}
                onClick={() => handleTickerClick(stock.symbol)}
                className={`cursor-pointer transition-colors border-b border-gray-800/50 ${
                  isSelected ? 'bg-purple-500/20 border-l-2 border-l-purple-500' : 'hover:bg-[#0d1829]'
                } ${selectedTicker ? 'px-3 py-2.5' : 'px-4 py-3'}`}
              >
                {selectedTicker ? (
                  <div className="flex items-center justify-between">
                    <span className="text-white font-medium text-sm">${stock.symbol}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-white text-sm font-mono">${stock.price?.toFixed(2)}</span>
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                        isPositive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                      }`}>
                        {isPositive ? '+' : ''}{stock.changePercent?.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-12 gap-4 items-center">
                    <div className="col-span-4">
                      <div className="text-white font-medium text-sm">${stock.symbol}</div>
                      <div className="text-gray-500 text-xs truncate">{stock.name}</div>
                    </div>
                    <div className="col-span-2 text-right">
                      <span className="text-white font-mono text-sm">${stock.price?.toFixed(2)}</span>
                    </div>
                    <div className="col-span-2 flex items-center justify-end gap-1">
                      {isPositive ? (
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-400" strokeWidth={2} />
                      ) : (
                        <TrendingDown className="w-3.5 h-3.5 text-red-400" strokeWidth={2} />
                      )}
                      <span className={`font-mono text-sm ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                        {isPositive ? '+' : ''}{stock.change?.toFixed(2)}
                      </span>
                    </div>
                    <div className="col-span-2 text-right">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        isPositive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                      }`}>
                        {isPositive ? '+' : ''}{stock.changePercent?.toFixed(2)}%
                      </span>
                    </div>
                    <div className="col-span-2 flex items-center justify-end">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveStock(stock.symbol);
                        }}
                        className="p-1.5 hover:bg-red-500/20 rounded-lg transition-colors text-gray-400 hover:text-red-400"
                        title="Remove"
                      >
                        <X className="w-4 h-4" strokeWidth={1.5} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-gray-800 flex items-center justify-between text-xs flex-shrink-0">
          <span className="text-gray-400">{stocks.length} symbols</span>
          {!selectedTicker && (
            <div className="flex items-center gap-3">
              <span className="text-emerald-400">{stocks.filter(s => s.change >= 0).length} gaining</span>
              <span className="text-red-400">{stocks.filter(s => s.change < 0).length} declining</span>
            </div>
          )}
        </div>
      </div>

      {/* TradingView Chart Panel */}
      {selectedTicker && (
        <div className="flex-1 flex flex-col bg-[#060d18] min-w-0">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 flex-shrink-0">
            <div className="flex items-center gap-3">
              <h2 className="text-white font-semibold text-lg">${selectedTicker}</h2>
              <span className="text-gray-400 text-sm">
                {stocks.find(s => s.symbol === selectedTicker)?.name}
              </span>
            </div>
            <button 
              onClick={handleCloseChart}
              className="p-2 hover:bg-red-500/20 rounded-lg transition-colors text-gray-400 hover:text-red-400"
              title="Close chart"
            >
              <X className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>

          <div className="flex-1 min-h-0">
            <iframe
              key={selectedTicker}
              src={`https://s.tradingview.com/widgetembed/?frameElementId=tradingview_widget&symbol=${selectedTicker}&interval=D&hidesidetoolbar=0&symboledit=1&saveimage=0&toolbarbg=f1f3f6&studies=[]&theme=dark&style=1&timezone=America%2FNew_York&withdateranges=1&showpopupbutton=0&studies_overrides={}&overrides={"paneProperties.vertGridProperties.color":"rgba(0,0,0,0)","paneProperties.horzGridProperties.color":"rgba(0,0,0,0)","paneProperties.background":"rgba(6,13,24,1)","paneProperties.backgroundType":"solid"}&enabled_features=[]&disabled_features=[]&locale=en`}
              style={{ width: '100%', height: '100%', border: 'none' }}
              allowFullScreen
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default WatchlistPage;
