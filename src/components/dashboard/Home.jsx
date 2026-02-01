import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Search, Shield, ArrowUpRight, Settings2, Link2, X, ExternalLink, Key, Lock, CheckCircle, Plus, Wallet, GripHorizontal } from 'lucide-react';

const Home = () => {
  const [activeTab, setActiveTab] = useState('balances');
  const [selectedBroker, setSelectedBroker] = useState(null);
  const [apiKey, setApiKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [connectedAccounts, setConnectedAccounts] = useState([]);
  
  // Resizable panels state
  const [topPanelHeight, setTopPanelHeight] = useState(() => {
    const saved = localStorage.getItem('stratify-home-panel-height');
    return saved ? parseInt(saved, 10) : 320;
  });
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef(null);

  // Save panel height to localStorage
  useEffect(() => {
    localStorage.setItem('stratify-home-panel-height', topPanelHeight.toString());
  }, [topPanelHeight]);

  // Handle mouse move during drag
  const handleMouseMove = useCallback((e) => {
    if (!isDragging || !containerRef.current) return;
    
    const containerRect = containerRef.current.getBoundingClientRect();
    const searchBarHeight = 60; // Approximate height of search bar
    const newHeight = e.clientY - containerRect.top - searchBarHeight;
    
    // Constrain between min and max heights
    const minHeight = 150;
    const maxHeight = containerRect.height - 200;
    setTopPanelHeight(Math.min(maxHeight, Math.max(minHeight, newHeight)));
  }, [isDragging]);

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    document.body.style.cursor = 'default';
    document.body.style.userSelect = 'auto';
  }, []);

  // Add/remove event listeners
  useEffect(() => {
    if (isDragging) {
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const tabs = [
    { id: 'balances', label: 'Balances' },
    { id: 'open-orders', label: 'Open orders' },
    { id: 'conditional-orders', label: 'Conditional orders' },
    { id: 'connect', label: 'Connect', icon: Plus }
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
      color: 'from-blue-500 to-blue-600',
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
      color: 'from-purple-500 to-purple-600',
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
    }
  ];

  const handleConnect = () => {
    if (apiKey && secretKey && selectedBroker) {
      setConnectedAccounts([...connectedAccounts, {
        ...selectedBroker,
        connected: true,
        maskedKey: `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`
      }]);
      setSelectedBroker(null);
      setApiKey('');
      setSecretKey('');
      setActiveTab('balances');
    }
  };

  const openApiPage = (url) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div ref={containerRef} className="flex-1 flex flex-col h-full bg-[#060d18] p-4 overflow-hidden">
      {/* Search Bar */}
      <div className="mb-4 flex-shrink-0">
        <div className="flex items-center gap-2 bg-[#0a1628] border border-gray-800 rounded-lg px-4 py-2.5 w-fit cursor-pointer hover:border-gray-700 transition-colors">
          <Search className="w-4 h-4 text-gray-500" strokeWidth={1.5} />
          <span className="text-gray-500 text-sm">Search for a market</span>
          <div className="flex items-center gap-1 bg-[#1a2438] px-2 py-0.5 rounded text-xs text-gray-400 ml-2">
            <span>⌘</span>
            <span>K</span>
          </div>
        </div>
      </div>

      {/* Connect Account Card - Resizable Top Panel */}
      <div 
        className="bg-[#0a1628] border border-gray-800 rounded-xl overflow-auto flex-shrink-0"
        style={{ height: topPanelHeight }}
      >
        <div className="p-8 flex flex-col items-center text-center h-full justify-center">
          {/* Connection Icon */}
          <div className="mb-6">
            <Link2 className="w-12 h-12 text-purple-400" strokeWidth={1.5} />
          </div>

          {/* Heading */}
          <h2 className="text-white text-xl font-semibold mb-2">
            Connect an account so you're ready to trade
          </h2>
          
          {/* Subtitle */}
          <p className="text-gray-400 text-sm mb-2 max-w-lg">
            Link your brokerage accounts to start trading. Connect multiple accounts simultaneously to manage all your portfolios in one place.
          </p>

          {/* Multi-account highlight */}
          <div className="flex items-center gap-2 mb-6 px-3 py-1.5 bg-purple-500/10 border border-purple-500/20 rounded-full">
            <Wallet className="w-4 h-4 text-purple-400" strokeWidth={1.5} />
            <span className="text-purple-300 text-xs font-medium">Support for unlimited connected accounts</span>
          </div>

          {/* Connected Accounts Preview */}
          {connectedAccounts.length > 0 && (
            <div className="flex items-center gap-2 mb-4">
              {connectedAccounts.map((account, idx) => (
                <div key={idx} className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/30 rounded-lg">
                  <span className="text-lg">{account.logo}</span>
                  <span className="text-green-400 text-sm font-medium">{account.name}</span>
                  <CheckCircle className="w-4 h-4 text-green-400" strokeWidth={1.5} />
                </div>
              ))}
            </div>
          )}

          {/* Action Button */}
          <button 
            onClick={() => setActiveTab('connect')}
            className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" strokeWidth={1.5} />
            Connect a Broker
          </button>

          {/* Security Badge */}
          <div className="flex items-center gap-2 text-sm mt-4">
            <Shield className="w-4 h-4 text-green-400" strokeWidth={1.5} />
            <span className="text-gray-400">Bank-level encryption • Your keys are stored securely</span>
          </div>
        </div>
      </div>

      {/* Resize Handle */}
      <div 
        className="h-4 flex items-center justify-center cursor-row-resize group flex-shrink-0 relative"
        onMouseDown={() => setIsDragging(true)}
      >
        {/* Subtle line */}
        <div className="absolute inset-x-0 top-1/2 h-px bg-gray-800 group-hover:bg-gray-700 transition-colors" />
        {/* Drag indicator */}
        <div className="relative z-10 flex items-center justify-center w-12 h-4 rounded bg-[#0a1628] border border-gray-800 group-hover:border-gray-600 group-hover:bg-[#0d1829] transition-all">
          <GripHorizontal className="w-4 h-3 text-gray-600 group-hover:text-gray-400 transition-colors" strokeWidth={1.5} />
        </div>
      </div>

      {/* Tabs Section - Bottom Panel */}
      <div className="bg-[#0a1628] border border-gray-800 rounded-xl flex-1 flex flex-col overflow-hidden min-h-0">
        {/* Tabs Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  activeTab === tab.id
                    ? tab.id === 'connect' 
                      ? 'bg-purple-600 text-white'
                      : 'bg-[#1a2438] text-white'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                {tab.icon && <tab.icon className="w-3.5 h-3.5" strokeWidth={1.5} />}
                {tab.label}
              </button>
            ))}
          </div>
          <button className="p-2 hover:bg-[#1a2438] rounded-lg transition-colors">
            <Settings2 className="w-4 h-4 text-gray-400" strokeWidth={1.5} />
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-auto">
          {/* Balances Tab */}
          {activeTab === 'balances' && (
            <div className="flex-1 flex items-center justify-center h-full min-h-[200px]">
              {connectedAccounts.length > 0 ? (
                <div className="text-center">
                  <span className="text-gray-400 text-sm">Connected accounts: {connectedAccounts.length}</span>
                </div>
              ) : (
                <div className="text-center">
                  <span className="text-gray-400 text-sm">No balances. </span>
                  <button 
                    onClick={() => setActiveTab('connect')}
                    className="text-purple-400 text-sm font-medium hover:text-purple-300 transition-colors inline-flex items-center gap-1"
                  >
                    Connect a broker
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

          {/* Connect Tab - Broker Selection */}
          {activeTab === 'connect' && !selectedBroker && (
            <div className="p-4">
              <div className="mb-4">
                <h3 className="text-white font-medium mb-1">Select a Broker</h3>
                <p className="text-gray-400 text-sm">Choose from our supported brokers to connect your account</p>
              </div>
              
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {brokers.map((broker) => (
                  <button
                    key={broker.id}
                    onClick={() => setSelectedBroker(broker)}
                    className="bg-[#0d1829] hover:bg-[#131f35] border border-gray-800 hover:border-purple-500/50 rounded-xl p-4 text-left transition-all group"
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
            </div>
          )}

          {/* Connect Tab - API Key Entry */}
          {activeTab === 'connect' && selectedBroker && (
            <div className="p-4">
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
              <div className="bg-[#0d1829] border border-gray-800 rounded-xl p-4 mb-4">
                <div className="flex items-start gap-3">
                  <Key className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                  <div className="flex-1">
                    <h4 className="text-white font-medium mb-1">Step 1: Get Your API Keys</h4>
                    <p className="text-gray-400 text-sm mb-3">
                      You'll need to generate API keys from your {selectedBroker.name} account. Click the button below to open {selectedBroker.name}'s API settings page.
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openApiPage(selectedBroker.apiUrl)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
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
              <div className="bg-[#0d1829] border border-gray-800 rounded-xl p-4">
                <div className="flex items-start gap-3 mb-4">
                  <Lock className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
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
                      className="w-full px-4 py-3 bg-[#060d18] border border-gray-700 focus:border-purple-500 rounded-lg text-white placeholder-gray-500 text-sm font-mono outline-none transition-colors"
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
                      className="w-full px-4 py-3 bg-[#060d18] border border-gray-700 focus:border-purple-500 rounded-lg text-white placeholder-gray-500 text-sm font-mono outline-none transition-colors"
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
                          ? 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white'
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
      </div>
    </div>
  );
};

export default Home;
