import { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

const BrokerConnect = ({ onConnected }) => {
  const [selectedBroker, setSelectedBroker] = useState(null);
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [isPaper, setIsPaper] = useState(true);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

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
          <p className="text-sm text-white/50">Your Alpaca account is now linked. Refreshing data...</p>
        </div>
      </div>
    );
  }

  if (!selectedBroker) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#0a0a0a]">
        <div className="max-w-lg w-full p-8 space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-xl font-semibold text-white">Connect Your Broker</h2>
            <p className="text-sm text-white/40">Link your brokerage account to see live positions and portfolio data</p>
          </div>

          <div className="space-y-3">
            {/* Alpaca */}
            <button
              onClick={() => setSelectedBroker('alpaca')}
              className="w-full flex items-center gap-4 p-4 rounded-xl border border-white/[0.06] bg-[#111111] hover:border-emerald-500/30 transition-colors text-left"
            >
              <div className="w-10 h-10 bg-yellow-500 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6" viewBox="0 0 32 32" fill="none">
                  <path d="M8 22V12l8-4 8 4v10l-8 4-8-4z" fill="#000" opacity="0.9"/>
                </svg>
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-white">Alpaca</div>
                <div className="text-xs text-white/40">Commission-free stock & crypto trading API</div>
              </div>
              <svg className="w-4 h-4 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>

            {/* Webull */}
            <button
              onClick={() => setSelectedBroker('webull')}
              className="w-full flex items-center gap-4 p-4 rounded-xl border border-white/[0.06] bg-[#111111] hover:border-blue-500/30 transition-colors text-left"
            >
              <div className="w-10 h-10 bg-blue-800 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6" viewBox="0 0 32 32" fill="none">
                  <path d="M10 20 C10 14, 16 8, 22 14" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round"/>
                </svg>
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-white">Webull</div>
                <div className="text-xs text-white/40">Zero-commission stock & options trading</div>
              </div>
              <svg className="w-4 h-4 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center bg-[#0a0a0a]">
      <div className="max-w-md w-full p-8 space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setSelectedBroker(null); setError(''); }}
            className="text-white/40 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <div>
            <h2 className="text-lg font-semibold text-white">Connect {selectedBroker === 'alpaca' ? 'Alpaca' : 'Webull'}</h2>
            <p className="text-xs text-white/40">Enter your API credentials</p>
          </div>
        </div>

        {selectedBroker === 'webull' && (
          <div className="border border-amber-500/20 rounded-lg p-3 bg-amber-500/5">
            <p className="text-xs text-amber-400">⏰ Webull API keys expire every 1-7 days depending on your settings. You will need to reconnect when your key resets. Manage key duration at webull.com → API Management.</p>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="text-[10px] uppercase tracking-[0.2em] text-white/40 block mb-1.5">
              {selectedBroker === 'webull' ? 'App Key' : 'API Key'}
            </label>
            <input
              type="text"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={selectedBroker === 'webull' ? 'Your Webull App Key' : 'PK...'}
              className="w-full bg-[#111111] border border-white/[0.06] rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-emerald-500/40 transition-colors font-mono"
            />
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-[0.2em] text-white/40 block mb-1.5">
              {selectedBroker === 'webull' ? 'App Secret' : 'Secret Key'}
            </label>
            <input
              type="password"
              value={apiSecret}
              onChange={(e) => setApiSecret(e.target.value)}
              placeholder="••••••••••••••••"
              className="w-full bg-[#111111] border border-white/[0.06] rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-emerald-500/40 transition-colors font-mono"
            />
          </div>

          {/* Paper/Live toggle — Alpaca only */}
          {selectedBroker === 'alpaca' && (
            <div className="flex items-center justify-between py-2">
              <div>
                <div className="text-sm text-white">{isPaper ? 'Paper Trading' : 'Live Trading'}</div>
                <div className="text-xs text-white/30">{isPaper ? 'Use paper trading endpoint' : 'Connected to live brokerage'}</div>
              </div>
              <button
                onClick={() => setIsPaper(!isPaper)}
                className={`relative w-10 h-5 rounded-full transition-colors ${isPaper ? 'bg-emerald-500/40' : 'bg-orange-500/40'}`}
              >
                <div className={`absolute top-0.5 w-4 h-4 rounded-full transition-transform ${isPaper ? 'translate-x-5 bg-emerald-400' : 'translate-x-0.5 bg-orange-400'}`} />
              </button>
            </div>
          )}

          {!isPaper && selectedBroker === 'alpaca' && (
            <div className="border border-orange-500/20 rounded-lg p-3 bg-orange-500/5">
              <p className="text-xs text-orange-400">⚠️ Live Trading Mode — Orders will execute with real money. Make sure you are using your live API keys.</p>
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
                ? isPaper
                  ? 'border-emerald-500/30 text-emerald-400 hover:border-emerald-500/60 hover:bg-emerald-500/5'
                  : 'border-orange-500/30 text-orange-400 hover:border-orange-500/60 hover:bg-orange-500/5'
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
