import { useState } from 'react';

// Plan configurations
const PLANS = {
  free: {
    name: 'Free',
    price: 0,
    description: 'Get started with paper trading',
    features: [
      '$100K Paper Money',
      '3 Active Strategies',
      '10 Backtests per month',
      '1 Connected Broker',
      'Monthly Newsletter',
      '50 Atlas AI Queries',
    ]
  },
  pro: {
    name: 'Pro',
    price: 29,
    description: 'For active traders',
    features: [
      'Everything in Free',
      'Unlimited Strategies',
      '500 Backtests per month',
      '5 Connected Brokers',
      'Weekly Newsletter',
      '1,000 Atlas AI Queries',
      'Arbitrage Scanner',
      'Template Strategies',
    ]
  },
  elite: {
    name: 'Elite',
    price: 99,
    description: 'For professional traders',
    features: [
      'Everything in Pro',
      'Unlimited Backtests',
      'Unlimited Brokers',
      'Unlimited AI Queries',
      'Priority Support',
      'Custom Indicators',
      'API Access',
      'White-glove Onboarding',
    ]
  }
};

// Add Payment Method Modal
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
      if (onComplete) {
        onComplete();
      } else {
        onClose();
      }
    }, 1500);
  };
  
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-[#1c1c1c] border border-[#2a2a2a] rounded-2xl w-[420px]" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-[#2a2a2a] flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Upgrade to {selectedPlan?.name}</h2>
            <p className="text-sm text-gray-500">${selectedPlan?.price}/month • Cancel anytime</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">Card Number</label>
            <input
              type="text"
              value={cardNumber}
              onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim())}
              placeholder="1234 5678 9012 3456"
              className="w-full px-4 py-3 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white placeholder-gray-600 focus:border-[#3a3a3a] focus:outline-none transition-colors"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block">Expiry</label>
              <input
                type="text"
                value={expiry}
                onChange={(e) => setExpiry(e.target.value.replace(/\D/g, '').slice(0, 4).replace(/(.{2})/, '$1/'))}
                placeholder="MM/YY"
                className="w-full px-4 py-3 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white placeholder-gray-600 focus:border-[#3a3a3a] focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block">CVC</label>
              <input
                type="text"
                value={cvc}
                onChange={(e) => setCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="123"
                className="w-full px-4 py-3 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white placeholder-gray-600 focus:border-[#3a3a3a] focus:outline-none transition-colors"
              />
            </div>
          </div>
          
          <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Stratify {selectedPlan?.name} (Monthly)</span>
              <span className="text-white">${selectedPlan?.price}.00</span>
            </div>
            <div className="flex justify-between text-sm border-t border-[#2a2a2a] pt-2">
              <span className="text-white font-medium">Total</span>
              <span className="text-white font-medium">${selectedPlan?.price}.00/mo</span>
            </div>
          </div>
          
          <button 
            onClick={handleSubmit}
            disabled={processing || !cardNumber || !expiry || !cvc}
            className="w-full py-3.5 bg-white hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-black font-medium rounded-xl transition-colors"
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
          
          <p className="text-[11px] text-gray-600 text-center">
            Secure payments powered by Stripe
          </p>
        </div>
      </div>
    </div>
  );
};

// Billing View Component - Clean minimal design
function BillingView({ onClose }) {
  const [currentPlan, setCurrentPlan] = useState('free');
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
    <div className="h-full overflow-y-auto bg-[#0a0a0a]">
      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-12">
          <div>
            <h1 className="text-3xl font-semibold text-white mb-2">Choose a plan</h1>
            <p className="text-gray-500">Simple pricing. No hidden fees.</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-[#1c1c1c] rounded-lg transition-colors"
          >
            <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Upgrade Success Banner */}
        {upgradeConfirm && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 mb-8 flex items-center gap-3">
            <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-emerald-400">Welcome to Stratify {PLANS[currentPlan].name}! Your subscription is now active.</span>
          </div>
        )}

        {/* Pricing Cards */}
        <div className="grid grid-cols-3 gap-6">
          {Object.entries(PLANS).map(([key, plan]) => {
            const isCurrentPlan = currentPlan === key;
            const isElite = key === 'elite';
            
            return (
              <div 
                key={key}
                className={`relative rounded-2xl p-6 transition-all ${
                  isCurrentPlan 
                    ? 'bg-[#1c1c1c] border-2 border-white/20' 
                    : 'bg-[#141414] border border-[#2a2a2a] hover:border-[#3a3a3a]'
                }`}
              >
                {/* Plan Name */}
                <h3 className="text-lg font-medium text-white mb-4">{plan.name}</h3>
                
                {/* Price */}
                <div className="mb-6">
                  <span className="text-4xl font-semibold text-white">${plan.price}</span>
                  <span className="text-gray-500 ml-1">/month</span>
                </div>
                
                {/* Description */}
                <p className="text-sm text-gray-500 mb-6">{plan.description}</p>
                
                {/* Divider */}
                <div className="border-t border-[#2a2a2a] mb-6"></div>
                
                {/* Features */}
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-3 text-sm">
                      <svg className="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-gray-300">{feature}</span>
                    </li>
                  ))}
                </ul>
                
                {/* Button */}
                {isCurrentPlan ? (
                  <button className="w-full py-3 bg-[#2a2a2a] text-gray-400 text-sm font-medium rounded-xl cursor-default">
                    Current Plan
                  </button>
                ) : (
                  <button 
                    onClick={() => handleSelectPlan(key)}
                    className={`w-full py-3 text-sm font-medium rounded-xl transition-all ${
                      isElite
                        ? 'bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white'
                        : 'bg-white hover:bg-gray-100 text-black'
                    }`}
                  >
                    Get Started
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* FAQ Section */}
        <div className="mt-16 pt-12 border-t border-[#1c1c1c]">
          <h2 className="text-xl font-semibold text-white mb-8">Frequently Asked Questions</h2>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="text-white font-medium mb-2">Can I cancel anytime?</h3>
              <p className="text-sm text-gray-500">Yes, cancel anytime. You'll keep access until your billing period ends.</p>
            </div>
            <div>
              <h3 className="text-white font-medium mb-2">What payment methods do you accept?</h3>
              <p className="text-sm text-gray-500">All major credit cards, Apple Pay, and Google Pay via Stripe.</p>
            </div>
            <div>
              <h3 className="text-white font-medium mb-2">Is my data secure?</h3>
              <p className="text-sm text-gray-500">Bank-level encryption. We never store your trading credentials.</p>
            </div>
            <div>
              <h3 className="text-white font-medium mb-2">Can I upgrade or downgrade?</h3>
              <p className="text-sm text-gray-500">Yes, change your plan anytime. Changes take effect immediately.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
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

export default function SettingsPage({ themeClasses, onClose }) {
  const [activeView, setActiveView] = useState('menu'); // 'menu' | 'billing'
  
  if (activeView === 'billing') {
    return <BillingView onClose={() => setActiveView('menu')} />;
  }

  return (
    <div className="h-full overflow-y-auto bg-[#0a0a0a] p-6">
      {/* Header with Close Button */}
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-white">Settings</h1>
            <p className="text-gray-500 text-sm mt-1">Manage your account and preferences</p>
          </div>
          {onClose && (
            <button 
              onClick={onClose}
              className="p-2 hover:bg-[#1c1c1c] rounded-lg transition-colors"
            >
              <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Settings Menu */}
        <div className="space-y-2">
          {/* Billing & Subscription */}
          <button 
            onClick={() => setActiveView('billing')}
            className="w-full bg-[#141414] border border-[#2a2a2a] rounded-xl p-4 flex items-center justify-between hover:bg-[#1c1c1c] hover:border-[#3a3a3a] transition-all text-left"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-[#1c1c1c] rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-white font-medium">Billing & Subscription</h3>
                <p className="text-sm text-gray-500">Manage your plan and payment methods</p>
              </div>
            </div>
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Account Settings */}
          <div className="w-full bg-[#141414] border border-[#2a2a2a] rounded-xl p-4 flex items-center justify-between hover:bg-[#1c1c1c] hover:border-[#3a3a3a] transition-all cursor-pointer">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-[#1c1c1c] rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <h3 className="text-white font-medium">Account</h3>
                <p className="text-sm text-gray-500">Profile, email, and password</p>
              </div>
            </div>
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>

          {/* Notifications */}
          <div className="w-full bg-[#141414] border border-[#2a2a2a] rounded-xl p-4 flex items-center justify-between hover:bg-[#1c1c1c] hover:border-[#3a3a3a] transition-all cursor-pointer">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-[#1c1c1c] rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <div>
                <h3 className="text-white font-medium">Notifications</h3>
                <p className="text-sm text-gray-500">Email alerts and push notifications</p>
              </div>
            </div>
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>

          {/* API & Integrations */}
          <div className="w-full bg-[#141414] border border-[#2a2a2a] rounded-xl p-4 flex items-center justify-between hover:bg-[#1c1c1c] hover:border-[#3a3a3a] transition-all cursor-pointer">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-[#1c1c1c] rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-white font-medium">API & Integrations</h3>
                <p className="text-sm text-gray-500">API keys and third-party connections</p>
              </div>
            </div>
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>

          {/* Display */}
          <div className="w-full bg-[#141414] border border-[#2a2a2a] rounded-xl p-4 flex items-center justify-between hover:bg-[#1c1c1c] hover:border-[#3a3a3a] transition-all cursor-pointer">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-[#1c1c1c] rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-white font-medium">Display</h3>
                <p className="text-sm text-gray-500">Theme and appearance</p>
              </div>
            </div>
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
