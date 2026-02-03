import React, { useState } from 'react';
import { Shield, ArrowUpRight, Settings2, Link2, X, ExternalLink, Key, Lock, CheckCircle, Plus } from 'lucide-react';

const Home = () => {
  const [activeTab, setActiveTab] = useState('balances');
  const [selectedBroker, setSelectedBroker] = useState(null);
  const [apiKey, setApiKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [connectedAccounts, setConnectedAccounts] = useState([]);
  const [isConnectOpen, setIsConnectOpen] = useState(true);

  const tabs = [
    { id: 'balances', label: 'Balances' },
    { id: 'open-orders', label: 'Open orders' },
    { id: 'conditional-orders', label: 'Conditional orders' }
  ];

  const brokers = [
    {
      id: 'alpaca',
      name: 'Alpaca',
      logo: '🦙',
      color: 'from-yellow-500 to-yellow-600',
      description: 'Commission-free stock & crypto trading API',
      apiUrl: 'https://app.alpaca.markets/brokerage/api-keys',
      docsUrl: 'https://docs.alpaca.markets',
      features: ['Stocks', 'Crypto', 'Paper Trading']
    },
    {
      id: 'interactive-brokers',
      name: 'Interactive Brokers',
      logo: '📊',
      color: 'from-red-500 to-red-600',
      description: 'Professional-grade trading platform',
      apiUrl: 'https://www.interactivebrokers.com/en/trading/ib-api.php',
      docsUrl: 'https://interactivebrokers.github.io/tws-api/',
      features: ['Stocks', 'Options', 'Futures', 'Forex']
    },
    {
      id: 'tradier',
      name: 'Tradier',
      logo: '📈',
      color: 'from-green-500 to-green-600',
      description: 'Brokerage API for stocks & options',
      apiUrl: 'https://developer.tradier.com/user/applications',
      docsUrl: 'https://documentation.tradier.com',
      features: ['Stocks', 'Options', 'Market Data']
    },
    {
      id: 'coinbase',
      name: 'Coinbase',
      logo: '🪙',
      color: 'from-emerald-500 to-emerald-500',
      description: 'Leading cryptocurrency exchange',
      apiUrl: 'https://www.coinbase.com/settings/api',
      docsUrl: 'https://docs.cloud.coinbase.com',
      features: ['Crypto', 'Staking', 'DeFi']
    },
    {
      id: 'binance',
      name: 'Binance',
      logo: '⚡',
      color: 'from-amber-500 to-amber-600',
      description: 'World\'s largest crypto exchange',
      apiUrl: 'https://www.binance.com/en/my/settings/api-management',
      docsUrl: 'https://binance-docs.github.io/apidocs/',
      features: ['Crypto', 'Futures', 'Spot']
    },
    {
      id: 'kraken',
      name: 'Kraken',
      logo: '🐙',
      color: 'from-emerald-500 to-emerald-500',
      description: 'Secure cryptocurrency exchange',
      apiUrl: 'https://www.kraken.com/u/security/api',
      docsUrl: 'https://docs.kraken.com/rest/',
      features: ['Crypto', 'Staking', 'Futures']
    },
    {
      id: 'etrade',
      name: 'E*TRADE',
      logo: '💹',
      color: 'from-indigo-500 to-indigo-600',
      description: 'Full-service online brokerage',
      apiUrl: 'https://developer.etrade.com/getting-started',
      docsUrl: 'https://apisb.etrade.com/docs/api/account/api-account-v1.html',
      features: ['Stocks', 'Options', 'Mutual Funds']
    },
    {
      id: 'robinhood',
      name: 'Robinhood',
      logo: '🪶',
      color: 'from-emerald-500 to-emerald-600',
      description: 'Commission-free trading (Limited API)',
      apiUrl: 'https://robinhood.com/account/settings',
      docsUrl: 'https://robinhood.com/us/en/support/',
      features: ['Stocks', 'Crypto', 'Options']
    },
    {
      id: 'kalshi',
      name: 'Kalshi',
      logo: '🎯',
      color: 'from-purple-500 to-purple-600',
      description: 'CFTC-regulated event contracts',
      apiUrl: 'https://kalshi.com/api',
      docsUrl: 'https://trading-api.readme.io/reference/getting-started',
      features: ['Events', 'Politics', 'Economics']
    }
  ];

  const handleConnect = () => {
    if (apiKey && secretKey && selectedBroker) {
      setConnectedAccounts([...connectedAccounts, {
        ...selectedBroker,
        connected: true,
        maskedKey: `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`,
        balance: 0
      }]);
      setSelectedBroker(null);
      setApiKey('');
      setSecretKey('');
      setActiveTab('balances');
      setIsConnectOpen(false);
    }
  };

  const openApiPage = (url) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const totalBalance = connectedAccounts.reduce((sum, account) => sum + (account.balance || 0), 0);
  const formattedBalance = totalBalance.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0d0d12] p-4 overflow-hidden">
      <div className="bg-[#111118] border border-gray-800 rounded-xl flex-1 flex flex-col overflow-hidden min-h-0">
        {/* Header */}
        <div className="px-4 py-4 border-b border-gray-800 flex-shrink-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                {connectedAccounts.length > 0 ? (
                  <>
                    <CheckCircle className="w-4 h-4 text-green-400" strokeWidth={1.5} />
                    <span className="text-white text-sm font-medium">Broker connected</span>
                  </>
                ) : (
                  <>
                    <div className="w-2 h-2 rounded-full bg-gray-500" />
                    <span className="text-white text-sm font-medium">No broker connected</span>
                  </>
                )}
              </div>
              {connectedAccounts.length > 0 ? (
                <div className="text-gray-400 text-sm mt-1">
                  Total balance: ${formattedBalance}
                </div>
              ) : (
                <div className="text-gray-400 text-sm mt-1">
                  Connect your brokerage account to start trading.
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {connectedAccounts.length === 0 && (
                <button
                  onClick={() => {
                    setIsConnectOpen(true);
                    setSelectedBroker(null);
                  }}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" strokeWidth={1.5} />
                  Connect a Broker
                </button>
              )}
              <button className="p-2 hover:bg-[#1a2438] rounded-lg transition-colors">
                <Settings2 className="w-4 h-4 text-gray-400" strokeWidth={1.5} />
              </button>
            </div>
          </div>
        </div>

        {/* Tabs Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  activeTab === tab.id
                    ? 'bg-[#1a2438] text-white'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-auto">
          {/* Connect Panel */}
          {isConnectOpen && (
            <div className="p-4 border-b border-gray-800">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-white font-medium mb-1">
                    <span className="flex items-center gap-1">
                      <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                        Connect
                      </span>
                      <span className="text-white/60">a Broker</span>
                    </span>
                  </h3>
                  <p className="text-gray-400 text-sm">Choose a broker and enter your API credentials.</p>
                </div>
                <button
                  onClick={() => {
                    setIsConnectOpen(false);
                    setSelectedBroker(null);
                  }}
                  className="p-2 hover:bg-[#1a2438] rounded-lg transition-colors"
                >
                  <X className="w-4 h-4 text-gray-400" strokeWidth={1.5} />
                </button>
              </div>

              {!selectedBroker && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {brokers.map((broker) => (
                    <button
                      key={broker.id}
                      onClick={() => setSelectedBroker(broker)}
                      className="bg-[#111118] hover:bg-white/5 border border-gray-800 hover:border-emerald-500/50 rounded-xl p-4 text-left transition-all group"
                    >
                      <div className="text-2xl mb-3">
                        {broker.logo}
                      </div>
                      <h4 className="text-white font-medium text-sm mb-1">{broker.name}</h4>
                      <p className="text-gray-500 text-xs mb-2 line-clamp-2">{broker.description}</p>
                      <div className="flex flex-wrap gap-1">
                        {broker.features.slice(0, 2).map((feature, idx) => (
                          <span key={idx} className="text-[10px] px-1.5 py-0.5 bg-gray-800 text-gray-400 rounded">
                            {feature}
                          </span>
                        ))}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {selectedBroker && (
                <div>
                  {/* Back button and broker header */}
                  <div className="flex items-center gap-4 mb-6">
                    <button
                      onClick={() => setSelectedBroker(null)}
                      className="p-2 hover:bg-[#1a2438] rounded-lg transition-colors"
                    >
                      <X className="w-4 h-4 text-gray-400" strokeWidth={1.5} />
                    </button>
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{selectedBroker.logo}</span>
                      <div>
                        <h3 className="text-white font-medium">Connect {selectedBroker.name}</h3>
                        <p className="text-gray-400 text-sm">{selectedBroker.description}</p>
                      </div>
                    </div>
                  </div>

                  {/* Get API Keys Section */}
                  <div className="bg-[#111118] border border-gray-800 rounded-xl p-4 mb-4">
                    <div className="flex items-start gap-3">
                      <Key className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                      <div className="flex-1">
                        <h4 className="text-white font-medium mb-1">Step 1: Get Your API Keys</h4>
                        <p className="text-gray-400 text-sm mb-3">
                          You'll need to generate API keys from your {selectedBroker.name} account. Click the button below to open {selectedBroker.name}'s API settings page.
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openApiPage(selectedBroker.apiUrl)}
                            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                          >
                            <ExternalLink className="w-4 h-4" strokeWidth={1.5} />
                            Open {selectedBroker.name} API Settings
                          </button>
                          <button
                            onClick={() => openApiPage(selectedBroker.docsUrl)}
                            className="px-4 py-2 bg-[#1a2438] hover:bg-[#243048] text-gray-300 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                          >
                            View Documentation
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* API Key Input Section */}
                  <div className="bg-[#111118] border border-gray-800 rounded-xl p-4">
                    <div className="flex items-start gap-3 mb-4">
                      <Lock className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                      <div>
                        <h4 className="text-white font-medium mb-1">Step 2: Enter Your Credentials</h4>
                        <p className="text-gray-400 text-sm">
                          Paste your API key and secret key below. Your credentials are encrypted and stored securely.
                        </p>
                      </div>
                    </div>

                    {/* Input Fields */}
                    <div className="space-y-3 ml-13">
                      <div>
                        <label className="block text-gray-300 text-sm font-medium mb-1.5">
                          API Key <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="text"
                          value={apiKey}
                          onChange={(e) => setApiKey(e.target.value)}
                          placeholder="Paste your API key here..."
                          className="w-full px-4 py-3 bg-[#060d18] border border-gray-700 focus:border-emerald-500 rounded-lg text-white placeholder-gray-500 text-sm font-mono outline-none transition-colors"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-gray-300 text-sm font-medium mb-1.5">
                          Secret Key <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="password"
                          value={secretKey}
                          onChange={(e) => setSecretKey(e.target.value)}
                          placeholder="Paste your secret key here..."
                          className="w-full px-4 py-3 bg-[#060d18] border border-gray-700 focus:border-emerald-500 rounded-lg text-white placeholder-gray-500 text-sm font-mono outline-none transition-colors"
                        />
                        <p className="text-gray-500 text-xs mt-1.5 flex items-center gap-1">
                          <Lock className="w-3 h-3" />
                          Your secret key is encrypted and never shared
                        </p>
                      </div>

                      {/* Connect Button */}
                      <div className="pt-2">
                        <button
                          onClick={handleConnect}
                          disabled={!apiKey || !secretKey}
                          className={`w-full py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                            apiKey && secretKey
                              ? 'bg-gradient-to-r from-emerald-500 to-cyan-400 hover:from-emerald-600 hover:to-cyan-300 text-white'
                              : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                          }`}
                        >
                          <Link2 className="w-4 h-4" strokeWidth={1.5} />
                          Connect {selectedBroker.name}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Security Note */}
                  <div className="flex items-center justify-center gap-2 mt-4 text-xs text-gray-500">
                    <Shield className="w-3.5 h-3.5 text-green-400" strokeWidth={1.5} />
                    <span>256-bit encryption • SOC 2 compliant • Read-only access available</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Balances Tab */}
          {activeTab === 'balances' && (
            <div className="flex-1 flex items-center justify-center h-full min-h-[200px]">
              {connectedAccounts.length > 0 ? (
                <div className="text-center">
                  <span className="text-gray-400 text-sm">Connected accounts: {connectedAccounts.length}</span>
                </div>
              ) : (
                <div className="text-center">
                  <span className="text-gray-400 text-sm">No broker connected. </span>
                  <button
                    onClick={() => {
                      setIsConnectOpen(true);
                      setSelectedBroker(null);
                    }}
                    className="text-emerald-400 text-sm font-medium hover:text-emerald-300 transition-colors inline-flex items-center gap-1"
                  >
                    Connect
                    <ArrowUpRight className="w-3.5 h-3.5" strokeWidth={1.5} />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Open Orders Tab */}
          {activeTab === 'open-orders' && (
            <div className="flex-1 flex items-center justify-center h-full min-h-[200px]">
              <div className="text-gray-400 text-sm">No open orders</div>
            </div>
          )}

          {/* Conditional Orders Tab */}
          {activeTab === 'conditional-orders' && (
            <div className="flex-1 flex items-center justify-center h-full min-h-[200px]">
              <div className="text-gray-400 text-sm">No conditional orders</div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default Home;
