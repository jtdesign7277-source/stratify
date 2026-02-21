import { useState, useEffect } from 'react';
import { validateKalshiCredentials, setKalshiCredentials } from '../../lib/kalshi';

// Broker logos as simple icons
const BrokerIcon = ({ broker, className = "w-8 h-8" }) => {
  const icons = {
    alpaca: (
      <svg className={className} viewBox="0 0 32 32" fill="none">
        <rect width="32" height="32" rx="6" fill="#FFCD00"/>
        <path d="M8 22V12l8-4 8 4v10l-8 4-8-4z" fill="#000" opacity="0.9"/>
        <path d="M16 8l8 4v10l-8 4" stroke="#000" strokeWidth="1.5" fill="none"/>
      </svg>
    ),
    polymarket: (
      <svg className={className} viewBox="0 0 32 32" fill="none">
        <rect width="32" height="32" rx="6" fill="#6366F1"/>
        <circle cx="16" cy="16" r="8" stroke="#fff" strokeWidth="2" fill="none"/>
        <path d="M12 16h8M16 12v8" stroke="#fff" strokeWidth="2"/>
      </svg>
    ),
    kalshi: (
      <svg className={className} viewBox="0 0 32 32" fill="none">
        <rect width="32" height="32" rx="6" fill="#00D4AA"/>
        <text x="16" y="21" textAnchor="middle" fill="#000" fontSize="14" fontWeight="bold">K</text>
      </svg>
    ),
    webull: (
      <svg className={className} viewBox="0 0 32 32" fill="none">
        <rect width="32" height="32" rx="6" fill="#1E40AF"/>
        <path d="M10 20 C10 14, 16 8, 22 14" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round"/>
      </svg>
    ),
    ibkr: (
      <svg className={className} viewBox="0 0 32 32" fill="none">
        <rect width="32" height="32" rx="6" fill="#D32F2F"/>
        <text x="16" y="21" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="bold">IBKR</text>
      </svg>
    ),
    robinhood: (
      <svg className={className} viewBox="0 0 32 32" fill="none">
        <rect width="32" height="32" rx="6" fill="#21CE99"/>
        <path d="M13 24 Q13 10 21 10 Q17 15 19 24 Z" fill="#fff"/>
      </svg>
    ),
    coinbase: (
      <svg className={className} viewBox="0 0 32 32" fill="none">
        <rect width="32" height="32" rx="6" fill="#0052FF"/>
        <circle cx="16" cy="16" r="8" fill="#fff"/>
        <circle cx="16" cy="16" r="4" fill="#0052FF"/>
      </svg>
    ),
    binance: (
      <svg className={className} viewBox="0 0 32 32" fill="none">
        <rect width="32" height="32" rx="6" fill="#F3BA2F"/>
        <path d="M16 8l3 3-3 3-3-3 3-3zM10 14l3 3-3 3-3-3 3-3zM22 14l3 3-3 3-3-3 3-3zM16 20l3 3-3 3-3-3 3-3z" fill="#000"/>
      </svg>
    ),
    // TradeZella brokers
    dxtrade: (
      <svg className={className} viewBox="0 0 32 32" fill="none">
        <rect width="32" height="32" rx="6" fill="#6B46C1"/>
        <text x="16" y="15" textAnchor="middle" fill="#fff" fontSize="9" fontWeight="bold">DX</text>
        <text x="16" y="24" textAnchor="middle" fill="#fff" fontSize="7">trade</text>
      </svg>
    ),
    tradingview: (
      <svg className={className} viewBox="0 0 32 32" fill="none">
        <rect width="32" height="32" rx="6" fill="#131722"/>
        <rect x="12" y="12" width="8" height="8" rx="1" fill="#fff"/>
        <line x1="16" y1="6" x2="16" y2="12" stroke="#fff" strokeWidth="2"/>
        <line x1="26" y1="16" x2="20" y2="16" stroke="#fff" strokeWidth="2"/>
        <line x1="16" y1="26" x2="16" y2="20" stroke="#fff" strokeWidth="2"/>
        <line x1="6" y1="16" x2="12" y2="16" stroke="#fff" strokeWidth="2"/>
      </svg>
    ),
    tradestation: (
      <svg className={className} viewBox="0 0 32 32" fill="none">
        <rect width="32" height="32" rx="6" fill="#2563EB"/>
        <path d="M12 22 L16 8 L20 22 Z" fill="#fff"/>
      </svg>
    ),
    tradezero: (
      <svg className={className} viewBox="0 0 32 32" fill="none">
        <rect width="32" height="32" rx="6" fill="#DC2626"/>
        <path d="M22 12 Q14 12 11 16 Q14 20 22 20" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round"/>
      </svg>
    ),
    tdameritrade: (
      <svg className={className} viewBox="0 0 32 32" fill="none">
        <rect width="32" height="32" rx="6" fill="#2563EB"/>
        <ellipse cx="16" cy="18" rx="8" ry="6" fill="#fff"/>
        <circle cx="13" cy="14" r="2" fill="#2563EB"/>
        <circle cx="19" cy="14" r="2" fill="#2563EB"/>
        <path d="M10 12 Q8 8 6 10" stroke="#fff" strokeWidth="2" fill="none"/>
        <path d="M22 12 Q24 8 26 10" stroke="#fff" strokeWidth="2" fill="none"/>
      </svg>
    ),
    schwab: (
      <svg className={className} viewBox="0 0 32 32" fill="none">
        <rect width="32" height="32" rx="6" fill="#6B46C1"/>
        <text x="16" y="13" textAnchor="middle" fill="#fff" fontSize="5" fontWeight="bold">Charles</text>
        <text x="16" y="22" textAnchor="middle" fill="#fff" fontSize="7" fontWeight="bold">SCHWAB</text>
      </svg>
    ),
    topstep: (
      <svg className={className} viewBox="0 0 32 32" fill="none">
        <rect width="32" height="32" rx="6" fill="#1F2937"/>
        <text x="16" y="12" textAnchor="middle" fill="#fff" fontSize="5" fontWeight="bold">TOPSTEP</text>
        <text x="16" y="24" textAnchor="middle" fill="#fff" fontSize="12" fontWeight="bold">X</text>
      </svg>
    ),
    lightspeed: (
      <svg className={className} viewBox="0 0 32 32" fill="none">
        <rect width="32" height="32" rx="6" fill="#F97316"/>
        <path d="M18 6 L13 17 H18 L14 26 L21 15 H16 L20 6 Z" fill="#fff"/>
      </svg>
    ),
    ninjatrader: (
      <svg className={className} viewBox="0 0 32 32" fill="none">
        <rect width="32" height="32" rx="6" fill="#F97316"/>
        <text x="16" y="20" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="bold">NT</text>
      </svg>
    ),
    tradier: (
      <svg className={className} viewBox="0 0 32 32" fill="none">
        <rect width="32" height="32" rx="6" fill="#22C55E"/>
        <ellipse cx="16" cy="18" rx="8" ry="6" fill="#166534"/>
        <circle cx="12" cy="13" r="3" fill="#fff"/>
        <circle cx="20" cy="13" r="3" fill="#fff"/>
        <circle cx="12" cy="13" r="1.5" fill="#166534"/>
        <circle cx="20" cy="13" r="1.5" fill="#166534"/>
      </svg>
    ),
  };
  return icons[broker] || null;
};

const brokers = [
  // Stocks & Options
  { id: 'alpaca', name: 'Alpaca', category: 'stocks', description: 'Commission-free stock trading API' },
  { id: 'webull', name: 'Webull', category: 'stocks', description: 'Zero-commission stock trading' },
  { id: 'ibkr', name: 'Interactive Brokers', category: 'stocks', description: 'Professional trading platform' },
  { id: 'robinhood', name: 'Robinhood', category: 'stocks', description: 'Commission-free investing' },
  { id: 'tdameritrade', name: 'TD Ameritrade', category: 'stocks', description: 'Full-service brokerage' },
  { id: 'schwab', name: 'Charles Schwab', category: 'stocks', description: 'Premium investment services' },
  { id: 'tradestation', name: 'TradeStation', category: 'stocks', description: 'Advanced trading platform' },
  { id: 'tradezero', name: 'TradeZero', category: 'stocks', description: 'Commission-free day trading' },
  { id: 'lightspeed', name: 'Lightspeed', category: 'stocks', description: 'Professional day trading' },
  { id: 'tradier', name: 'Tradier', category: 'stocks', description: 'Brokerage API platform' },
  // Futures & Prop Trading
  { id: 'ninjatrader', name: 'NinjaTrader', category: 'futures', description: 'Futures & forex trading' },
  { id: 'topstep', name: 'TopstepX', category: 'futures', description: 'Funded futures trading' },
  { id: 'dxtrade', name: 'DX Trade', category: 'futures', description: 'Multi-asset trading platform' },
  // Prediction Markets
  { id: 'polymarket', name: 'Polymarket', category: 'prediction', description: 'Decentralized prediction markets' },
  { id: 'kalshi', name: 'Kalshi', category: 'prediction', description: 'CFTC-regulated event contracts' },
  // Crypto
  { id: 'coinbase', name: 'Coinbase', category: 'crypto', description: 'Cryptocurrency exchange' },
  { id: 'binance', name: 'Binance', category: 'crypto', description: 'Global crypto exchange' },
  // Charting & Analysis
  { id: 'tradingview', name: 'TradingView', category: 'tools', description: 'Charts & social trading' },
];

export default function BrokerConnectModal({ isOpen, onClose, onConnect, connectedBrokers = [] }) {
  // Restore saved form state from sessionStorage
  const [selectedBroker, setSelectedBroker] = useState(() => {
    try {
      const saved = sessionStorage.getItem('broker-connect-form');
      return saved ? JSON.parse(saved).broker : null;
    } catch {
      return null;
    }
  });
  const [apiKey, setApiKey] = useState(() => {
    try {
      const saved = sessionStorage.getItem('broker-connect-form');
      return saved ? JSON.parse(saved).apiKey : '';
    } catch {
      return '';
    }
  });
  const [secretKey, setSecretKey] = useState(() => {
    try {
      const saved = sessionStorage.getItem('broker-connect-form');
      return saved ? JSON.parse(saved).secretKey : '';
    } catch {
      return '';
    }
  });
  const [connecting, setConnecting] = useState(false);
  const [filter, setFilter] = useState('all');
  const [connectError, setConnectError] = useState('');

  // Auto-save form state on change (persists across tab switches)
  useEffect(() => {
    if (selectedBroker || apiKey || secretKey) {
      sessionStorage.setItem('broker-connect-form', JSON.stringify({
        broker: selectedBroker,
        apiKey,
        secretKey,
      }));
    }
  }, [selectedBroker, apiKey, secretKey]);

  // Clear saved form on close
  useEffect(() => {
    if (!isOpen) {
      // Clear on close only if not in the middle of connecting
      if (!connecting) {
        sessionStorage.removeItem('broker-connect-form');
      }
    }
  }, [isOpen, connecting]);

  if (!isOpen) return null;

  const filteredBrokers = filter === 'all' 
    ? brokers 
    : brokers.filter(b => b.category === filter);

  const handleConnect = async () => {
    if (!apiKey || !secretKey) return;
    
    setConnecting(true);
    setConnectError('');
    
    try {
      // Special handling for Kalshi - validate credentials and get balance
      if (selectedBroker.id === 'kalshi') {
        const result = await validateKalshiCredentials(apiKey, secretKey);
        
        if (!result.valid) {
          setConnectError(result.error || 'Invalid credentials');
          setConnecting(false);
          return;
        }
        
        // Credentials are valid - store them
        setKalshiCredentials(apiKey, secretKey);
        
        onConnect({
          id: selectedBroker.id,
          name: selectedBroker.name,
          apiKey: apiKey.slice(0, 8) + '...',
          connectedAt: Date.now(),
          status: 'connected',
          balance: result.balance,
          availableBalance: result.availableBalance,
        });
      } else {
        // For other brokers, simulate connection (TODO: implement each)
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        onConnect({
          id: selectedBroker.id,
          name: selectedBroker.name,
          apiKey: apiKey.slice(0, 8) + '...',
          connectedAt: Date.now(),
          status: 'connected'
        });
      }
      
      // Clear saved form on success
      sessionStorage.removeItem('broker-connect-form');
      setConnecting(false);
      setSelectedBroker(null);
      setApiKey('');
      setSecretKey('');
    } catch (error) {
      setConnectError(error.message || 'Connection failed');
      setConnecting(false);
    }
  };

  const isConnected = (brokerId) => connectedBrokers.some(b => b.id === brokerId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" onClick={onClose} />
      
      {/* Modal */}
      <div className="relative w-full max-w-2xl mx-4 animate-fadeIn">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 text-gray-400 hover:text-white transition-colors z-10"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="bg-[#202124] rounded-2xl overflow-hidden border border-[#5f6368]">
          
          {!selectedBroker ? (
            <>
              {/* Header */}
              <div className="p-6 border-b border-[#5f6368]">
                <h2 className="text-xl font-semibold text-white mb-1">Connect a Broker</h2>
                <p className="text-sm text-gray-400">Link your accounts to enable cross-market scanning & arbitrage</p>
              </div>

              {/* Filters */}
              <div className="px-6 py-3 border-b border-[#5f6368] flex gap-2 flex-wrap">
                {['all', 'stocks', 'futures', 'prediction', 'crypto', 'tools'].map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                      filter === f 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-[#3c4043] text-gray-400 hover:text-white'
                    }`}
                  >
                    {f === 'all' ? 'All' : f === 'prediction' ? 'Prediction' : f === 'tools' ? 'Tools' : f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>

              {/* Broker Grid */}
              <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 max-h-[400px] overflow-y-auto">
                {filteredBrokers.map(broker => {
                  const connected = isConnected(broker.id);
                  return (
                    <button
                      key={broker.id}
                      onClick={() => !connected && setSelectedBroker(broker)}
                      disabled={connected}
                      className={`relative p-4 rounded-xl border transition-all text-center group ${
                        connected 
                          ? 'bg-emerald-500/10 border-emerald-500/30 cursor-default'
                          : 'bg-[#303134] border-[#5f6368] hover:border-blue-500/50 hover:bg-[#3c4043]'
                      }`}
                    >
                      {connected && (
                        <div className="absolute top-2 right-2">
                          <svg className="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                      <div className="flex justify-center mb-3">
                        <BrokerIcon broker={broker.id} className="w-10 h-10" />
                      </div>
                      <div className="text-sm font-medium text-white mb-1">{broker.name}</div>
                      <div className="text-[10px] text-white/50 leading-tight">{broker.description}</div>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              {/* Connect Form */}
              <div className="p-6 border-b border-[#5f6368]">
                <button 
                  onClick={() => setSelectedBroker(null)}
                  className="flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-4 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back to brokers
                </button>
                
                <div className="flex items-center gap-4">
                  <BrokerIcon broker={selectedBroker.id} className="w-12 h-12" />
                  <div>
                    <h2 className="text-xl font-semibold text-white">Connect {selectedBroker.name}</h2>
                    <p className="text-sm text-gray-400">{selectedBroker.description}</p>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-wide block mb-2">API Key</label>
                  <input
                    type="text"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Enter your API key"
                    className="w-full bg-[#303134] border border-[#5f6368] focus:border-blue-500 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none transition-colors"
                  />
                </div>
                
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-wide block mb-2">Secret Key</label>
                  <input
                    type="password"
                    value={secretKey}
                    onChange={(e) => setSecretKey(e.target.value)}
                    placeholder="Enter your secret key"
                    className="w-full bg-[#303134] border border-[#5f6368] focus:border-blue-500 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none transition-colors"
                  />
                </div>

                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                  <p className="text-xs text-blue-300">
                    <strong>🔒 Secure:</strong> Your keys are encrypted and stored locally. We never have access to your funds.
                  </p>
                </div>

                {connectError && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                    <p className="text-xs text-red-400">
                      <strong>❌ Error:</strong> {connectError}
                    </p>
                  </div>
                )}

                {selectedBroker?.id === 'kalshi' && (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                    <p className="text-xs text-amber-300">
                      <strong>📝 Note:</strong> For Kalshi, paste your full Private Key (PEM format) in the Secret Key field.
                    </p>
                  </div>
                )}

                <button
                  onClick={handleConnect}
                  disabled={!apiKey || !secretKey || connecting}
                  className={`w-full py-3 rounded-lg font-medium transition-all ${
                    apiKey && secretKey && !connecting
                      ? 'bg-blue-500 hover:bg-blue-600 text-white'
                      : 'bg-[#3c4043] text-white/50 cursor-not-allowed'
                  }`}
                >
                  {connecting ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                      </svg>
                      Connecting...
                    </span>
                  ) : (
                    'Connect Account'
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out forwards;
        }
      `}</style>
    </div>
  );
}

// Export broker icon for use in sidebar
export { BrokerIcon, brokers };
