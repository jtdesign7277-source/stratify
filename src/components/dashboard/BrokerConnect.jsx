import { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

const BROKERS = [
  {
    id: 'alpaca',
    name: 'Alpaca',
    status: 'ready',
    statusLabel: 'Ready',
    hoverBorder: 'hover:border-emerald-500/30',
    keysUrl: 'https://app.alpaca.markets/brokerage/api-keys',
    keyLabel: 'API Key',
    secretLabel: 'Secret Key',
    keyPlaceholder: 'PK...',
    info: 'Keys never expire. Generate separate keys for paper and live trading.',
    hasPaperToggle: true,
    description: 'Commission-free stock & crypto trading API',
    logoBg: 'bg-yellow-500',
    logoIcon: (
      <svg className="w-6 h-6" viewBox="0 0 32 32" fill="none">
        <path d="M8 22V12l8-4 8 4v10l-8 4-8-4z" fill="#000" opacity="0.9"/>
      </svg>
    ),
  },
  {
    id: 'tradier',
    name: 'Tradier',
    status: 'ready',
    statusLabel: 'Ready',
    hoverBorder: 'hover:border-emerald-500/30',
    keysUrl: 'https://developer.tradier.com/user/tokens',
    keyLabel: 'Access Token',
    secretLabel: 'Account ID',
    keyPlaceholder: 'Your Tradier access token',
    info: 'Simple REST API. Keys don\'t expire. Stocks, options, ETFs.',
    hasPaperToggle: true,
    description: 'Stocks, options & ETFs via REST API',
    logoBg: 'bg-purple-600',
    logoIcon: (
      <svg className="w-6 h-6" viewBox="0 0 32 32" fill="none">
        <path d="M8 12h16M16 12v12" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: 'webull',
    name: 'Webull',
    status: 'ready',
    statusLabel: 'Ready (keys expire)',
    statusColor: 'text-amber-400',
    hoverBorder: 'hover:border-blue-500/30',
    keysUrl: 'https://www.webull.com/center#main/setting/api',
    keyLabel: 'App Key',
    secretLabel: 'App Secret',
    keyPlaceholder: 'Your Webull App Key',
    info: '⚠️ Webull keys expire every 1-7 days and must be regenerated. API access requires approval (1-2 business days). Go to Account Center → API Management → My Application to apply.',
    hasPaperToggle: true,
    description: 'Zero-commission stock & options trading',
    logoBg: 'bg-blue-800',
    logoIcon: (
      <svg className="w-6 h-6" viewBox="0 0 32 32" fill="none">
        <path d="M10 20 C10 14, 16 8, 22 14" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: 'interactive_brokers',
    name: 'Interactive Brokers',
    status: 'coming_soon',
    statusLabel: 'Coming Soon',
    hoverBorder: 'hover:border-white/10',
    keysUrl: 'https://www.interactivebrokers.com/en/trading/ib-api.php',
    keyLabel: 'API Key',
    secretLabel: 'Secret Key',
    keyPlaceholder: '',
    info: 'Supports stocks, options, futures, forex. Requires TWS or Client Portal Gateway running.',
    hasPaperToggle: true,
    description: 'Stocks, options, futures & forex',
    logoBg: 'bg-red-700',
    logoIcon: (
      <svg className="w-6 h-6" viewBox="0 0 32 32" fill="none">
        <text x="8" y="22" fill="#fff" fontSize="16" fontWeight="bold" fontFamily="sans-serif">IB</text>
      </svg>
    ),
  },
  {
    id: 'td_ameritrade',
    name: 'TD Ameritrade / Schwab',
    status: 'coming_soon',
    statusLabel: 'Coming Soon',
    hoverBorder: 'hover:border-white/10',
    keysUrl: 'https://developer.tdameritrade.com/',
    keyLabel: 'Consumer Key',
    secretLabel: 'Redirect URI',
    keyPlaceholder: '',
    info: 'Largest US retail broker. OAuth authentication required.',
    hasPaperToggle: false,
    description: 'OAuth-based stock & options trading',
    logoBg: 'bg-green-700',
    logoIcon: (
      <svg className="w-6 h-6" viewBox="0 0 32 32" fill="none">
        <text x="6" y="22" fill="#fff" fontSize="14" fontWeight="bold" fontFamily="sans-serif">TD</text>
      </svg>
    ),
  },
  {
    id: 'ninjatrader',
    name: 'NinjaTrader',
    status: 'coming_soon',
    statusLabel: 'Coming Soon',
    hoverBorder: 'hover:border-white/10',
    keysUrl: 'https://ninjatrader.com/futures',
    keyLabel: 'API Key',
    secretLabel: 'Secret Key',
    keyPlaceholder: '',
    info: '⚠️ Futures & forex only, not stocks. Requires NinjaTrader desktop platform running locally.',
    hasPaperToggle: false,
    description: 'Futures & forex trading platform',
    logoBg: 'bg-orange-600',
    logoIcon: (
      <svg className="w-6 h-6" viewBox="0 0 32 32" fill="none">
        <path d="M10 22l4-14 4 8 4-6" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    id: 'coinbase',
    name: 'Coinbase',
    status: 'coming_soon',
    statusLabel: 'Coming Soon',
    hoverBorder: 'hover:border-white/10',
    keysUrl: 'https://www.coinbase.com/settings/api',
    keyLabel: 'API Key',
    secretLabel: 'API Secret',
    keyPlaceholder: '',
    info: 'Crypto trading only. Supports BTC, ETH, SOL, and 200+ tokens.',
    hasPaperToggle: false,
    description: 'Crypto trading — BTC, ETH, SOL & more',
    logoBg: 'bg-blue-600',
    logoIcon: (
      <svg className="w-6 h-6" viewBox="0 0 32 32" fill="none">
        <circle cx="16" cy="16" r="8" stroke="#fff" strokeWidth="2.5" fill="none"/>
        <path d="M14 13h5M14 19h5" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
  },
];

const InfoTooltip = ({ text }) => {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-block">
      <button
        type="button"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={(e) => { e.stopPropagation(); setShow(!show); }}
        className="w-4 h-4 rounded-full border border-white/20 text-white/40 hover:text-white/70 hover:border-white/40 transition-colors flex items-center justify-center text-[9px] font-medium leading-none"
      >
        i
      </button>
      {show && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 rounded-lg border border-white/10 bg-[#1a1a1a] shadow-xl">
          <p className="text-xs text-white/70 leading-relaxed">{text}</p>
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px w-2 h-2 rotate-45 bg-[#1a1a1a] border-r border-b border-white/10" />
        </div>
      )}
    </span>
  );
};

const StatusBadge = ({ label, color }) => (
  <span className={`text-[9px] uppercase tracking-wider ${color || 'text-emerald-400/70'}`}>
    {label}
  </span>
);

const BrokerConnect = ({ onConnected }) => {
  const [selectedBroker, setSelectedBroker] = useState(null);
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [isPaper, setIsPaper] = useState(true);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const broker = selectedBroker ? BROKERS.find(b => b.id === selectedBroker) : null;
  const isLive = !isPaper;

  const handleTestAndConnect = async () => {
    if (!apiKey || !apiSecret) return;
    setTesting(true);
    setError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError('Not authenticated. Please sign in.');
        setTesting(false);
        return;
      }

      const resp = await fetch('/api/broker-connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          broker: selectedBroker,
          api_key: apiKey,
          api_secret: apiSecret,
          is_paper: isPaper,
        }),
      });

      const data = await resp.json();
      if (!resp.ok) {
        setError(data.error || 'Connection failed');
        setTesting(false);
        return;
      }

      setSuccess(true);
      setTesting(false);
      if (onConnected) onConnected(data);
    } catch (err) {
      setError(err.message);
      setTesting(false);
    }
  };

  const handleSelectBroker = (b) => {
    if (b.status === 'coming_soon') return;
    setSelectedBroker(b.id);
  };

  if (success) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#0a0a0a]">
        <div className="max-w-md w-full p-8 text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-full border border-emerald-500/30 flex items-center justify-center">
            <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-white">Broker Connected</h3>
          <p className="text-sm text-white/50">Your {broker?.name} account is now linked. Refreshing data...</p>
        </div>
      </div>
    );
  }

  // Broker selection screen
  if (!selectedBroker) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#0a0a0a]">
        <div className="max-w-lg w-full p-8 space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-xl font-semibold text-white">Connect Your Broker</h2>
            <p className="text-sm text-white/40">Link your brokerage account to see live positions and portfolio data</p>
          </div>

          <div className="space-y-2.5">
            {BROKERS.map((b) => {
              const isComingSoon = b.status === 'coming_soon';
              return (
                <button
                  key={b.id}
                  onClick={() => handleSelectBroker(b)}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl border border-white/[0.06] bg-[#111111] ${
                    isComingSoon ? 'opacity-50 cursor-default' : `${b.hoverBorder} cursor-pointer`
                  } transition-colors text-left`}
                >
                  <div className={`w-10 h-10 ${b.logoBg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                    {b.logoIcon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">{b.name}</span>
                      <InfoTooltip text={b.info} />
                      <StatusBadge label={b.statusLabel} color={b.statusColor} />
                    </div>
                    <div className="text-xs text-white/40">{b.description}</div>
                    <a
                      href={b.keysUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-[11px] text-emerald-400/70 hover:text-emerald-400 transition-colors mt-0.5 inline-block"
                    >
                      Get Your API Keys →
                    </a>
                  </div>
                  {!isComingSoon && (
                    <svg className="w-4 h-4 text-white/20 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Broker connection form
  return (
    <div className="flex-1 flex items-center justify-center bg-[#0a0a0a]">
      <div className="max-w-md w-full p-8 space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setSelectedBroker(null); setError(''); setApiKey(''); setApiSecret(''); setIsPaper(true); }}
            className="text-white/40 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-white">Connect {broker.name}</h2>
              <InfoTooltip text={broker.info} />
            </div>
            <p className="text-xs text-white/40">Enter your API credentials</p>
          </div>
        </div>

        {/* Get API Keys link */}
        <a
          href={broker.keysUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-xs text-emerald-400/70 hover:text-emerald-400 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
          </svg>
          Get Your API Keys →
        </a>

        <div className="space-y-4">
          <div>
            <label className="text-[10px] uppercase tracking-[0.2em] text-white/40 block mb-1.5">
              {broker.keyLabel}
            </label>
            <input
              type="text"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={broker.keyPlaceholder}
              className="w-full bg-[#111111] border border-white/[0.06] rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-emerald-500/40 transition-colors font-mono"
            />
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-[0.2em] text-white/40 block mb-1.5">
              {broker.secretLabel}
            </label>
            <input
              type="password"
              value={apiSecret}
              onChange={(e) => setApiSecret(e.target.value)}
              placeholder="••••••••••••••••"
              className="w-full bg-[#111111] border border-white/[0.06] rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-emerald-500/40 transition-colors font-mono"
            />
          </div>

          {/* Paper/Live toggle */}
          {broker.hasPaperToggle && (
            <div className="flex items-center justify-between py-2">
              <div>
                <div className={`text-sm ${isLive ? 'text-orange-400' : 'text-white'}`}>
                  {isPaper ? 'Paper Trading' : 'Live Trading'}
                </div>
                <div className={`text-xs ${isLive ? 'text-orange-400/50' : 'text-white/30'}`}>
                  {isPaper ? 'Use paper trading endpoint' : 'Connected to live brokerage'}
                </div>
              </div>
              <button
                onClick={() => setIsPaper(!isPaper)}
                className={`relative w-10 h-5 rounded-full transition-colors ${isPaper ? 'bg-emerald-500/40' : 'bg-orange-500/40'}`}
              >
                <div className={`absolute top-0.5 w-4 h-4 rounded-full transition-transform ${isPaper ? 'translate-x-5 bg-emerald-400' : 'translate-x-0.5 bg-orange-400'}`} />
              </button>
            </div>
          )}

          {/* Live trading warning */}
          {isLive && (
            <div className="border border-orange-500/20 rounded-lg p-3 bg-orange-500/5">
              <p className="text-xs text-orange-400 font-medium">⚠️ Live Trading Mode — Orders will execute with real money</p>
              <p className="text-[10px] text-orange-400/60 mt-1">Make sure you are using your live API keys.</p>
            </div>
          )}

          {error && (
            <div className="border border-red-500/20 rounded-lg p-3">
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}

          <button
            onClick={handleTestAndConnect}
            disabled={!apiKey || !apiSecret || testing}
            className={`w-full py-2.5 rounded-lg text-sm font-medium border transition-all ${
              apiKey && apiSecret && !testing
                ? isLive
                  ? 'border-orange-500/30 text-orange-400 hover:border-orange-500/60 hover:bg-orange-500/5'
                  : 'border-emerald-500/30 text-emerald-400 hover:border-emerald-500/60 hover:bg-emerald-500/5'
                : 'border-white/[0.06] text-white/20 cursor-not-allowed'
            }`}
          >
            {testing ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
                Testing Connection...
              </span>
            ) : isLive ? (
              '⚠️ Test & Connect (Live)'
            ) : (
              'Test & Connect'
            )}
          </button>

          <p className="text-[10px] text-white/20 text-center">
            Your credentials are stored securely and used only to fetch your portfolio data.
          </p>
        </div>
      </div>
    </div>
  );
};

export default BrokerConnect;
