import { useState, useEffect, useRef } from 'react';

// ============== MOCK DATA ==============
const MOCK_USER = {
  name: 'Grok',
  email: 'grok@stratify.io',
  avatar: 'brain', // Special avatar type for Grok AI brain icon
  initials: 'AI',
  plan: 'pro',
  planExpiresAt: '2026-02-28',
  memberSince: '2024-11-15',
  timezone: 'America/New_York',
  twoFactorEnabled: true,
};

const MOCK_STATS = {
  strategiesCreated: 12,
  strategiesLive: 5,
  totalTrades: 847,
  winRate: 62.4,
  totalPnL: 12847.32,
  grokQueries: 127,
  grokLimit: 1000,
  backtestsRun: 34,
  backtestsLimit: 500,
};

const MOCK_BROKERS = [
  { id: 'alpaca', name: 'Alpaca', connected: true, lastSync: '2 min ago', icon: '🦙', status: 'active' },
  { id: 'ibkr', name: 'Interactive Brokers', connected: false, icon: '📊', status: 'disconnected' },
  { id: 'td', name: 'TD Ameritrade', connected: false, icon: '📈', status: 'disconnected' },
  { id: 'robinhood', name: 'Robinhood', connected: false, icon: '🪶', status: 'coming_soon' },
];

const MOCK_ACTIVITY = [
  { id: 1, type: 'strategy_deployed', text: 'Deployed "Golden Cross Strategy"', time: '45 min ago' },
  { id: 2, type: 'trade', text: 'RSI Reversal executed BUY TSLA', time: '2 hours ago' },
  { id: 3, type: 'backtest', text: 'Backtest completed for MACD Momentum', time: '5 hours ago' },
  { id: 4, type: 'login', text: 'Logged in from MacBook Pro', time: 'Yesterday' },
  { id: 5, type: 'upgrade', text: 'Upgraded to Pro plan', time: '3 days ago' },
];

// ============== PLAN CONFIG ==============
const PLANS = {
  free: { name: 'Free', price: 0, color: 'gray', features: ['$100K Paper Money', '3 Active Strategies', '10 Backtests/mo', '50 AI Queries'] },
  pro: { name: 'Pro', price: 29, color: 'cyan', badge: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30', features: ['Unlimited Strategies', '500 Backtests/mo', '1000 AI Queries', 'Arbitrage Scanner'] },
  elite: { name: 'Elite', price: 99, color: 'purple', badge: 'bg-purple-500/20 text-purple-400 border-purple-500/30', features: ['Everything Unlimited', 'API Access', 'Priority Support', 'White-glove Onboarding'] },
};

// ============== SUB-COMPONENTS ==============

// Animated gradient background
const GradientOrb = ({ className }) => (
  <div className={`absolute rounded-full blur-3xl opacity-20 animate-pulse ${className}`} />
);

// Grok Brain Icon for avatar
const GrokBrainIcon = ({ className = "w-full h-full" }) => (
  <div className={`${className} flex items-center justify-center bg-gradient-to-br from-blue-600 via-cyan-500 to-purple-600 animate-pulse`}>
    <svg viewBox="0 0 24 24" className="w-3/5 h-3/5" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 4.5C10 4.5 9 5.5 9 7c0-2-1.5-3-3-3s-2.5 1.5-2.5 3c0 1 .5 2 1 2.5-.5.5-1.5 1.5-1.5 3 0 2 1.5 3 3 3 .5 0 1-.1 1.5-.3 0 1.8 1.5 3.3 3.5 3.3" />
      <path d="M12 4.5c2 0 3 1 3 2.5 0-2 1.5-3 3-3s2.5 1.5 2.5 3c0 1-.5 2-1 2.5.5.5 1.5 1.5 1.5 3 0 2-1.5 3-3 3-.5 0-1-.1-1.5-.3 0 1.8-1.5 3.3-3.5 3.3" />
      <path d="M12 4.5v15" />
    </svg>
  </div>
);

// Stat card with animation
const StatCard = ({ label, value, subValue, icon, color = 'cyan', trend }) => (
  <div className="group relative bg-[#0f0f14] border border-[#1e1e2d] rounded-2xl p-5 hover:border-[#2a2a3d] transition-all duration-300 overflow-hidden">
    <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
    <div className="relative">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-gray-500 uppercase tracking-wider font-medium">{label}</span>
        {icon && <span className="text-lg">{icon}</span>}
      </div>
      <div className="flex items-end gap-2">
        <span className={`text-2xl font-bold ${
          color === 'cyan' ? 'text-cyan-400' : 
          color === 'green' ? 'text-emerald-400' : 
          color === 'purple' ? 'text-purple-400' : 
          color === 'amber' ? 'text-amber-400' : 'text-white'
        }`}>{value}</span>
        {trend && (
          <span className={`text-xs font-medium ${trend > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
        )}
      </div>
      {subValue && <p className="text-xs text-gray-500 mt-1">{subValue}</p>}
    </div>
  </div>
);

// Progress bar with glow
const ProgressBar = ({ value, max, color = 'cyan', showLabel = true }) => {
  const percent = Math.min((value / max) * 100, 100);
  const isNearLimit = percent > 80;
  
  return (
    <div className="space-y-2">
      {showLabel && (
        <div className="flex justify-between text-xs">
          <span className="text-gray-400">{value.toLocaleString()} / {max.toLocaleString()}</span>
          <span className={isNearLimit ? 'text-amber-400' : 'text-gray-500'}>{percent.toFixed(0)}%</span>
        </div>
      )}
      <div className="h-2 bg-[#1a1a24] rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all duration-500 ${
            isNearLimit 
              ? 'bg-gradient-to-r from-amber-500 to-red-500' 
              : color === 'cyan' 
                ? 'bg-gradient-to-r from-cyan-500 to-blue-500' 
                : 'bg-gradient-to-r from-purple-500 to-pink-500'
          }`}
          style={{ width: `${percent}%`, boxShadow: isNearLimit ? '0 0 20px rgba(245, 158, 11, 0.4)' : '0 0 20px rgba(6, 182, 212, 0.3)' }}
        />
      </div>
    </div>
  );
};

// Toggle switch
const Toggle = ({ enabled, onChange, label }) => (
  <button
    onClick={() => onChange(!enabled)}
    className="flex items-center gap-3 group"
  >
    <div className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${enabled ? 'bg-cyan-500' : 'bg-[#2a2a3a]'}`}>
      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-lg transition-transform duration-200 ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
    </div>
    {label && <span className="text-sm text-gray-400 group-hover:text-gray-300 transition-colors">{label}</span>}
  </button>
);

// Broker card
const BrokerCard = ({ broker, onConnect }) => (
  <div className={`relative bg-[#0f0f14] border rounded-xl p-4 transition-all duration-300 ${
    broker.connected 
      ? 'border-emerald-500/30 hover:border-emerald-500/50' 
      : broker.status === 'coming_soon'
        ? 'border-[#1e1e2d] opacity-60'
        : 'border-[#1e1e2d] hover:border-[#2a2a3d]'
  }`}>
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{broker.icon}</span>
        <div>
          <h4 className="text-sm font-medium text-white">{broker.name}</h4>
          {broker.connected ? (
            <p className="text-xs text-emerald-400">Connected • Synced {broker.lastSync}</p>
          ) : broker.status === 'coming_soon' ? (
            <p className="text-xs text-gray-500">Coming soon</p>
          ) : (
            <p className="text-xs text-gray-500">Not connected</p>
          )}
        </div>
      </div>
      {broker.connected ? (
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
          <button className="text-xs text-gray-500 hover:text-red-400 transition-colors">Disconnect</button>
        </div>
      ) : broker.status !== 'coming_soon' && (
        <button 
          onClick={() => onConnect(broker.id)}
          className="px-3 py-1.5 text-xs font-medium bg-white/5 hover:bg-white/10 text-white border border-[#2a2a3a] rounded-lg transition-all"
        >
          Connect
        </button>
      )}
    </div>
  </div>
);

// Activity item
const ActivityItem = ({ activity }) => {
  const icons = {
    strategy_deployed: '🚀',
    trade: '💹',
    backtest: '📊',
    login: '🔐',
    upgrade: '⭐',
  };
  
  return (
    <div className="flex items-center gap-4 py-3 border-b border-[#1a1a24] last:border-0">
      <span className="text-lg">{icons[activity.type] || '📌'}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-300 truncate">{activity.text}</p>
      </div>
      <span className="text-xs text-gray-500 whitespace-nowrap">{activity.time}</span>
    </div>
  );
};

// Section header
const SectionHeader = ({ title, action, actionLabel }) => (
  <div className="flex items-center justify-between mb-4">
    <h3 className="text-lg font-semibold text-white">{title}</h3>
    {action && (
      <button onClick={action} className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors">
        {actionLabel}
      </button>
    )}
  </div>
);

// ============== PAYMENT MODAL ==============
const PaymentModal = ({ plan, onClose, onComplete }) => {
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [processing, setProcessing] = useState(false);
  
  const selectedPlan = PLANS[plan];
  
  const handleSubmit = () => {
    if (!cardNumber || !expiry || !cvc) return;
    setProcessing(true);
    setTimeout(() => {
      setProcessing(false);
      onComplete?.();
    }, 1500);
  };
  
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-[#12121a] border border-[#2a2a3d] rounded-2xl w-[440px] shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-[#1e1e2d]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">Upgrade to {selectedPlan?.name}</h2>
              <p className="text-sm text-gray-500 mt-1">${selectedPlan?.price}/month • Cancel anytime</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-[#1e1e2d] rounded-lg transition-colors">
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        
        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs text-gray-500 mb-2 block">Card Number</label>
            <input
              type="text"
              value={cardNumber}
              onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim())}
              placeholder="1234 5678 9012 3456"
              className="w-full px-4 py-3.5 bg-[#0d0d12] border border-[#1e1e2d] rounded-xl text-white placeholder-gray-600 focus:border-cyan-500/50 focus:outline-none transition-colors font-mono"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 mb-2 block">Expiry</label>
              <input
                type="text"
                value={expiry}
                onChange={(e) => setExpiry(e.target.value.replace(/\D/g, '').slice(0, 4).replace(/(.{2})/, '$1/'))}
                placeholder="MM/YY"
                className="w-full px-4 py-3.5 bg-[#0d0d12] border border-[#1e1e2d] rounded-xl text-white placeholder-gray-600 focus:border-cyan-500/50 focus:outline-none transition-colors font-mono"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-2 block">CVC</label>
              <input
                type="text"
                value={cvc}
                onChange={(e) => setCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="123"
                className="w-full px-4 py-3.5 bg-[#0d0d12] border border-[#1e1e2d] rounded-xl text-white placeholder-gray-600 focus:border-cyan-500/50 focus:outline-none transition-colors font-mono"
              />
            </div>
          </div>
          
          <div className="bg-[#0d0d12] border border-[#1e1e2d] rounded-xl p-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Stratify {selectedPlan?.name}</span>
              <span className="text-white">${selectedPlan?.price}.00/mo</span>
            </div>
            <div className="border-t border-[#1e1e2d] pt-3 flex justify-between">
              <span className="text-white font-medium">Total today</span>
              <span className="text-white font-semibold">${selectedPlan?.price}.00</span>
            </div>
          </div>
          
          <button 
            onClick={handleSubmit}
            disabled={processing || !cardNumber || !expiry || !cvc}
            className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all shadow-lg shadow-cyan-500/25"
          >
            {processing ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </span>
            ) : (
              'Subscribe Now'
            )}
          </button>
          
          <p className="text-[11px] text-gray-600 text-center flex items-center justify-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Secure payments powered by Stripe
          </p>
        </div>
      </div>
    </div>
  );
};

// ============== BILLING VIEW ==============
function BillingView({ onClose, currentPlan, setCurrentPlan }) {
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedUpgradePlan, setSelectedUpgradePlan] = useState(null);
  const [upgradeConfirm, setUpgradeConfirm] = useState(false);
  
  const handleSelectPlan = (plan) => {
    if (plan === currentPlan) return;
    if (PLANS[plan].price > PLANS[currentPlan].price) {
      setSelectedUpgradePlan(plan);
      setShowPaymentModal(true);
    } else {
      setCurrentPlan(plan);
    }
  };
  
  const handlePaymentComplete = () => {
    setShowPaymentModal(false);
    setCurrentPlan(selectedUpgradePlan);
    setUpgradeConfirm(true);
    setTimeout(() => setUpgradeConfirm(false), 3000);
  };

  return (
    <div className="space-y-8">
      {/* Back button */}
      <button 
        onClick={onClose}
        className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Settings
      </button>

      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Plans & Billing</h2>
        <p className="text-gray-500">Choose the plan that fits your trading style</p>
      </div>

      {/* Upgrade Success */}
      {upgradeConfirm && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex items-center gap-3 animate-pulse">
          <span className="text-xl">🎉</span>
          <span className="text-emerald-400 font-medium">Welcome to Stratify {PLANS[currentPlan].name}!</span>
        </div>
      )}

      {/* Plan Cards */}
      <div className="grid grid-cols-3 gap-5">
        {Object.entries(PLANS).map(([key, plan]) => {
          const isCurrentPlan = currentPlan === key;
          const isElite = key === 'elite';
          
          return (
            <div 
              key={key}
              className={`relative rounded-2xl p-6 transition-all duration-300 ${
                isCurrentPlan 
                  ? 'bg-gradient-to-b from-[#1a1a24] to-[#12121a] border-2 border-cyan-500/50 shadow-lg shadow-cyan-500/10' 
                  : 'bg-[#0f0f14] border border-[#1e1e2d] hover:border-[#2a2a3d]'
              }`}
            >
              {isCurrentPlan && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-cyan-500 text-black text-xs font-bold rounded-full">
                  CURRENT
                </div>
              )}
              
              <h3 className="text-lg font-semibold text-white mb-2">{plan.name}</h3>
              <div className="mb-4">
                <span className="text-3xl font-bold text-white">${plan.price}</span>
                <span className="text-gray-500 text-sm">/mo</span>
              </div>
              
              <ul className="space-y-2.5 mb-6">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-sm text-gray-400">
                    <svg className="w-4 h-4 text-cyan-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>
              
              {isCurrentPlan ? (
                <button disabled className="w-full py-3 bg-[#1e1e2d] text-gray-500 text-sm font-medium rounded-xl cursor-default">
                  Current Plan
                </button>
              ) : (
                <button 
                  onClick={() => handleSelectPlan(key)}
                  className={`w-full py-3 text-sm font-semibold rounded-xl transition-all ${
                    isElite
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-lg shadow-purple-500/25'
                      : 'bg-white hover:bg-gray-100 text-black'
                  }`}
                >
                  {PLANS[key].price > PLANS[currentPlan].price ? 'Upgrade' : 'Downgrade'}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {showPaymentModal && (
        <PaymentModal 
          plan={selectedUpgradePlan}
          onClose={() => setShowPaymentModal(false)} 
          onComplete={handlePaymentComplete} 
        />
      )}
    </div>
  );
}

// ============== ACCOUNT VIEW ==============
function AccountView({ onClose, user, setUser, onRemoveAvatar, onTriggerAvatarPicker, avatarProcessing, avatarError }) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  
  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      setUser({ ...user, name, email });
      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }, 800);
  };

  return (
    <div className="space-y-8">
      <button onClick={onClose} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Settings
      </button>

      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Account Settings</h2>
        <p className="text-gray-500">Manage your profile and security</p>
      </div>

      {saved && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex items-center gap-3">
          <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-emerald-400">Changes saved successfully</span>
        </div>
      )}

      {/* Profile Section */}
      <div className="bg-[#0f0f14] border border-[#1e1e2d] rounded-2xl p-6 space-y-6">
        <h3 className="text-lg font-semibold text-white">Profile</h3>
        
        <div className="flex items-center gap-6">
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 p-0.5">
              <div className="relative w-full h-full rounded-[14px] bg-[#0d0d12] flex items-center justify-center text-white text-2xl font-bold overflow-hidden">
                {user.avatar === 'brain' ? (
                  <GrokBrainIcon />
                ) : user.avatar ? (
                  <img src={user.avatar} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  user.initials
                )}
                {avatarProcessing && (
                  <div className="absolute inset-0 bg-black/50 backdrop-blur-[1px] flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-cyan-300/60 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={onTriggerAvatarPicker}
              disabled={avatarProcessing}
              className="absolute -bottom-1 -right-1 w-7 h-7 bg-[#1e1e2d] border border-[#2a2a3d] rounded-lg flex items-center justify-center hover:bg-[#2a2a3d] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              title="Change photo"
            >
              <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          </div>
          <div>
            <p className="text-sm text-gray-500">Profile Photo</p>
            <p className="text-xs text-gray-600 mt-1">JPG, PNG or GIF. Max 2MB.</p>
            {avatarError && (
              <p className="text-xs text-amber-400 mt-2">{avatarError}</p>
            )}
            {user.avatar && (
              <button
                onClick={onRemoveAvatar}
                disabled={avatarProcessing}
                className="mt-3 text-xs text-gray-400 hover:text-gray-200 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Remove Photo
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-500 mb-2 block">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 bg-[#0d0d12] border border-[#1e1e2d] rounded-xl text-white focus:border-cyan-500/50 focus:outline-none transition-colors"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-2 block">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-[#0d0d12] border border-[#1e1e2d] rounded-xl text-white focus:border-cyan-500/50 focus:outline-none transition-colors"
            />
          </div>
        </div>

        <button 
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-black font-medium rounded-xl transition-colors"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {/* Security Section */}
      <div className="bg-[#0f0f14] border border-[#1e1e2d] rounded-2xl p-6 space-y-5">
        <h3 className="text-lg font-semibold text-white">Security</h3>
        
        <div className="flex items-center justify-between py-3 border-b border-[#1a1a24]">
          <div>
            <p className="text-sm text-white font-medium">Two-Factor Authentication</p>
            <p className="text-xs text-gray-500 mt-0.5">Add an extra layer of security</p>
          </div>
          <Toggle enabled={user.twoFactorEnabled} onChange={() => {}} />
        </div>
        
        <div className="flex items-center justify-between py-3">
          <div>
            <p className="text-sm text-white font-medium">Password</p>
            <p className="text-xs text-gray-500 mt-0.5">Last changed 30 days ago</p>
          </div>
          <button className="px-4 py-2 text-xs font-medium bg-[#1e1e2d] hover:bg-[#2a2a3d] text-white rounded-lg transition-colors">
            Change
          </button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-red-400 mb-2">Danger Zone</h3>
        <p className="text-sm text-gray-500 mb-4">Once you delete your account, there is no going back.</p>
        <button className="px-4 py-2 text-sm font-medium bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl transition-colors">
          Delete Account
        </button>
      </div>
    </div>
  );
}

// ============== MAIN SETTINGS PAGE ==============
export default function SettingsPage({ themeClasses, onClose }) {
  const [activeView, setActiveView] = useState('main');
  const [user, setUser] = useState(MOCK_USER);
  const [stats] = useState(MOCK_STATS);
  const [brokers] = useState(MOCK_BROKERS);
  const [activity] = useState(MOCK_ACTIVITY);
  const [currentPlan, setCurrentPlan] = useState(user.plan);
  const [avatarProcessing, setAvatarProcessing] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const fileInputRef = useRef(null);

  const handleTriggerAvatarPicker = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarFileChange = (event) => {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    const maxSize = 2 * 1024 * 1024;

    if (!allowedTypes.includes(file.type)) {
      setAvatarError('Unsupported format. Use JPG, PNG, or GIF.');
      input.value = '';
      return;
    }

    if (file.size > maxSize) {
      setAvatarError('File too large. Max size is 2MB.');
      input.value = '';
      return;
    }

    setAvatarError('');
    setAvatarProcessing(true);

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setUser((prev) => ({ ...prev, avatar: reader.result }));
      } else {
        setAvatarError('Could not process the image. Please try another file.');
      }
      setAvatarProcessing(false);
      input.value = '';
    };
    reader.onerror = () => {
      setAvatarProcessing(false);
      setAvatarError('Could not process the image. Please try another file.');
      input.value = '';
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = () => {
    setUser((prev) => ({ ...prev, avatar: null }));
    setAvatarError('');
  };

  // Sub-views
  if (activeView === 'billing') {
    return (
      <div className="h-full overflow-y-auto bg-[#0d0d12] p-8">
        <div className="max-w-4xl mx-auto">
          <BillingView 
            onClose={() => setActiveView('main')} 
            currentPlan={currentPlan}
            setCurrentPlan={setCurrentPlan}
          />
        </div>
      </div>
    );
  }

  if (activeView === 'account') {
    return (
      <div className="h-full overflow-y-auto bg-[#0d0d12] p-8">
        <div className="max-w-3xl mx-auto">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif"
            onChange={handleAvatarFileChange}
            className="hidden"
          />
          <AccountView 
            onClose={() => setActiveView('main')} 
            user={user}
            setUser={setUser}
            onTriggerAvatarPicker={handleTriggerAvatarPicker}
            onRemoveAvatar={handleRemoveAvatar}
            avatarProcessing={avatarProcessing}
            avatarError={avatarError}
          />
        </div>
      </div>
    );
  }

  // Main settings view
  return (
    <div className="h-full overflow-y-auto bg-[#0d0d12]">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif"
        onChange={handleAvatarFileChange}
        className="hidden"
      />
      {/* Gradient background effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <GradientOrb className="w-96 h-96 bg-cyan-500 -top-48 -right-48" />
        <GradientOrb className="w-96 h-96 bg-purple-500 -bottom-48 -left-48" />
      </div>

      <div className="relative max-w-6xl mx-auto px-8 py-10">
        {/* Header with close */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-3xl font-bold text-white mb-1">Settings</h1>
            <p className="text-gray-500">Manage your account and preferences</p>
          </div>
          {onClose && (
            <button 
              onClick={onClose}
              className="p-3 bg-[#1e1e2d] hover:bg-[#2a2a3d] rounded-xl transition-colors"
            >
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* User Profile Hero */}
        <div className="relative bg-gradient-to-br from-[#12121a] via-[#0f0f14] to-[#12121a] border border-[#1e1e2d] rounded-3xl p-8 mb-8 overflow-hidden">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiMyMDIwMzAiIGZpbGwtb3BhY2l0eT0iMC40Ij48cGF0aCBkPSJNMzYgMzRjMC0yIDItNCAyLTRzLTItMi00LTJjMCAwIDAtMiAwLTRzMi00IDItNGMtMiAwLTQtMi00LTJzLTIgMi0yIDRjMCAwLTIgMC00IDBzLTQgMi00IDJjMCAyIDIgNCAyIDRzLTIgMi00IDJjMCAyIDIgNCAyIDRzMi0yIDQtMmMwIDAgMi0yIDQtMnoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-20" />
          
          <div className="relative flex items-center gap-8">
            {/* Avatar */}
            <div className="relative group">
              <div className="w-28 h-28 rounded-3xl border border-[#2a2a3d] bg-[#12121a]">
                <div className="relative w-full h-full rounded-3xl bg-[#0d0d12] flex items-center justify-center text-white text-3xl font-bold overflow-hidden">
                  {user.avatar === 'brain' ? (
                    <GrokBrainIcon />
                  ) : user.avatar ? (
                    <img src={user.avatar} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    user.initials
                  )}
                  {avatarProcessing && (
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-[1px] flex items-center justify-center">
                      <div className="w-6 h-6 border-2 border-cyan-300/60 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={handleTriggerAvatarPicker}
                disabled={avatarProcessing}
                className="absolute -bottom-2 -right-2 w-10 h-10 bg-cyan-500 rounded-xl flex items-center justify-center hover:bg-cyan-400 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                title="Change photo"
              >
                <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            </div>

            {/* User Info */}
            <div className="flex-1">
              <div className="flex items-center gap-4 mb-2">
                <h2 className="text-2xl font-bold text-white">{user.name}</h2>
                <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${PLANS[currentPlan].badge}`}>
                  {PLANS[currentPlan].name.toUpperCase()}
                </span>
              </div>
              <p className="text-gray-400 mb-4">{user.email}</p>
              <div className="flex items-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">Member since</span>
                  <span className="text-white font-medium">Nov 2024</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">Timezone</span>
                  <span className="text-white font-medium">{user.timezone}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${user.twoFactorEnabled ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  <span className="text-gray-500">2FA {user.twoFactorEnabled ? 'Enabled' : 'Disabled'}</span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => setActiveView('account')}
                className="px-5 py-2.5 bg-white hover:bg-gray-100 text-black text-sm font-semibold rounded-xl transition-colors"
              >
                Edit Profile
              </button>
              <button 
                onClick={() => setActiveView('billing')}
                className="px-5 py-2.5 bg-[#1e1e2d] hover:bg-[#2a2a3d] text-white text-sm font-medium rounded-xl transition-colors border border-[#2a2a3d]"
              >
                Manage Plan
              </button>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-5 mb-8">
          <StatCard label="Strategies Live" value={stats.strategiesLive} subValue={`${stats.strategiesCreated} total created`} icon="🚀" color="cyan" />
          <StatCard label="Total Trades" value={stats.totalTrades.toLocaleString()} subValue={`${stats.winRate}% win rate`} icon="💹" color="green" trend={4.2} />
          <StatCard label="Total P&L" value={`$${stats.totalPnL.toLocaleString()}`} icon="💰" color="green" trend={12.8} />
          <StatCard label="Grok AI Queries" value={stats.grokQueries} subValue={`${stats.grokLimit - stats.grokQueries} remaining`} icon="🤖" color="purple" />
        </div>

        {/* Usage & Limits */}
        <div className="grid grid-cols-2 gap-5 mb-8">
          <div className="bg-[#0f0f14] border border-[#1e1e2d] rounded-2xl p-6">
            <SectionHeader title="Usage" />
            <div className="space-y-5">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">Grok AI Queries</span>
                  <span className="text-xs text-gray-500">{PLANS[currentPlan].name} Plan</span>
                </div>
                <ProgressBar value={stats.grokQueries} max={stats.grokLimit} color="cyan" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">Backtests</span>
                </div>
                <ProgressBar value={stats.backtestsRun} max={stats.backtestsLimit} color="purple" />
              </div>
            </div>
          </div>

          {/* Activity Feed */}
          <div className="bg-[#0f0f14] border border-[#1e1e2d] rounded-2xl p-6">
            <SectionHeader title="Recent Activity" action={() => {}} actionLabel="View All" />
            <div className="space-y-1">
              {activity.slice(0, 4).map(item => (
                <ActivityItem key={item.id} activity={item} />
              ))}
            </div>
          </div>
        </div>

        {/* Connected Brokers */}
        <div className="bg-[#0f0f14] border border-[#1e1e2d] rounded-2xl p-6 mb-8">
          <SectionHeader title="Connected Brokers" action={() => {}} actionLabel="Add Broker" />
          <div className="grid grid-cols-2 gap-4">
            {brokers.map(broker => (
              <BrokerCard key={broker.id} broker={broker} onConnect={() => {}} />
            ))}
          </div>
        </div>

        {/* Quick Settings */}
        <div className="grid grid-cols-3 gap-5">
          {/* Notifications */}
          <div className="bg-[#0f0f14] border border-[#1e1e2d] rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-5">Notifications</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Trade Alerts</span>
                <Toggle enabled={true} onChange={() => {}} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Strategy Updates</span>
                <Toggle enabled={true} onChange={() => {}} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Marketing Emails</span>
                <Toggle enabled={false} onChange={() => {}} />
              </div>
            </div>
          </div>

          {/* Display */}
          <div className="bg-[#0f0f14] border border-[#1e1e2d] rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-5">Display</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Dark Mode</span>
                <Toggle enabled={true} onChange={() => {}} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Compact View</span>
                <Toggle enabled={false} onChange={() => {}} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Show P&L</span>
                <Toggle enabled={true} onChange={() => {}} />
              </div>
            </div>
          </div>

          {/* API */}
          <div className="bg-[#0f0f14] border border-[#1e1e2d] rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-5">API Access</h3>
            <p className="text-sm text-gray-500 mb-4">Generate API keys for programmatic access</p>
            <button className="w-full py-3 bg-[#1e1e2d] hover:bg-[#2a2a3d] text-white text-sm font-medium rounded-xl transition-colors border border-[#2a2a3d]">
              Generate API Key
            </button>
            <p className="text-xs text-gray-600 mt-3 text-center">Available on Elite plan</p>
          </div>
        </div>
      </div>
    </div>
  );
}
