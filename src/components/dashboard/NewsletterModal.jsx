import { useState, useEffect } from 'react';

// Floating stock ticker component
const FloatingTicker = ({ symbol, price, change, delay, position }) => (
  <div 
    className="absolute bg-[#1A1A1A] rounded-lg px-3 py-2 shadow-xl border border-[#2A2A2A] animate-float"
    style={{ 
      ...position,
      animationDelay: `${delay}s`,
    }}
  >
    <div className="text-[10px] text-gray-400 font-medium">{symbol}</div>
    <div className="text-sm text-white font-bold">${price}</div>
    <div className={`text-[10px] font-medium ${change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
      {change >= 0 ? '+' : ''}{change}%
    </div>
  </div>
);

// Mini candlestick chart
const MiniChart = ({ delay, position }) => (
  <div 
    className="absolute bg-[#1A1A1A]/90 rounded-lg p-2 shadow-xl border border-[#2A2A2A] animate-float"
    style={{ 
      ...position,
      animationDelay: `${delay}s`,
    }}
  >
    <div className="flex items-end gap-0.5 h-12">
      {[40, 60, 45, 70, 55, 80, 65, 90, 75, 85].map((h, i) => (
        <div key={i} className="flex flex-col items-center">
          <div 
            className={`w-1.5 rounded-sm ${i % 2 === 0 ? 'bg-emerald-500' : 'bg-red-500'}`}
            style={{ height: `${h * 0.4}px` }}
          />
        </div>
      ))}
    </div>
  </div>
);

// Trend line graphic
const TrendLine = ({ delay, position }) => (
  <div 
    className="absolute animate-float"
    style={{ 
      ...position,
      animationDelay: `${delay}s`,
    }}
  >
    <svg width="100" height="50" viewBox="0 0 100 50" className="opacity-60">
      <defs>
        <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0.8" />
        </linearGradient>
      </defs>
      <path 
        d="M 0 40 Q 25 35 40 25 T 70 15 T 100 5" 
        stroke="url(#lineGrad)" 
        strokeWidth="2" 
        fill="none"
      />
      <circle cx="100" cy="5" r="3" fill="#10b981" className="animate-pulse" />
    </svg>
  </div>
);

export default function NewsletterModal({ isOpen, onClose }) {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [prices, setPrices] = useState({
    NVDA: { price: '891.25', change: 4.2 },
    TSLA: { price: '248.50', change: -1.8 },
    AAPL: { price: '189.84', change: 2.1 },
    SPY: { price: '502.12', change: 0.8 },
  });

  // Animate prices
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setPrices(prev => ({
        NVDA: { 
          price: (parseFloat(prev.NVDA.price) + (Math.random() - 0.4) * 2).toFixed(2),
          change: prev.NVDA.change + (Math.random() - 0.5) * 0.2
        },
        TSLA: { 
          price: (parseFloat(prev.TSLA.price) + (Math.random() - 0.5) * 1.5).toFixed(2),
          change: prev.TSLA.change + (Math.random() - 0.5) * 0.2
        },
        AAPL: { 
          price: (parseFloat(prev.AAPL.price) + (Math.random() - 0.4) * 0.8).toFixed(2),
          change: prev.AAPL.change + (Math.random() - 0.5) * 0.1
        },
        SPY: { 
          price: (parseFloat(prev.SPY.price) + (Math.random() - 0.4) * 0.5).toFixed(2),
          change: prev.SPY.change + (Math.random() - 0.5) * 0.1
        },
      }));
    }, 2000);
    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (email) {
      const subscribers = JSON.parse(localStorage.getItem('stratify-newsletter') || '[]');
      if (!subscribers.includes(email)) {
        subscribers.push(email);
        localStorage.setItem('stratify-newsletter', JSON.stringify(subscribers));
      }
      setSubmitted(true);
      setTimeout(() => {
        onClose();
        setSubmitted(false);
        setEmail('');
      }, 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-4xl mx-4 animate-fadeIn">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 text-gray-400 hover:text-white transition-colors z-10"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Card */}
        <div className="bg-[#FAFAFA] rounded-2xl overflow-hidden flex">
          {/* Left side - Form */}
          <div className="flex-1 p-8 md:p-10">
            {!submitted ? (
              <>
                <h2 className="text-2xl md:text-3xl font-bold text-[#0D0D0D] mb-2 tracking-tight">
                  Trade signals to your inbox
                </h2>
                
                <p className="text-gray-600 text-sm mb-1">
                  3 edge picks weekly with exact entry and exit points
                </p>
                
                <p className="text-gray-500 text-xs mb-5 italic">
                  The setups we don't post publicly. First movers only.
                </p>

                <form onSubmit={handleSubmit} className="flex gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Your email address"
                    required
                    className="flex-1 px-4 py-2.5 rounded-full border border-gray-300 text-[#0D0D0D] placeholder-gray-400 focus:outline-none focus:border-gray-500 text-sm"
                  />
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-[#0D0D0D] text-white rounded-full font-medium text-sm hover:bg-[#1A1A1A] transition-colors whitespace-nowrap"
                  >
                    Subscribe
                  </button>
                </form>

                <p className="text-[10px] text-gray-400 mt-3">
                  No spam. Unsubscribe anytime.
                </p>
              </>
            ) : (
              <div className="text-center py-6">
                <div className="w-14 h-14 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-[#0D0D0D] mb-1">You're in.</h3>
                <p className="text-gray-600 text-sm">First signal drops soon.</p>
              </div>
            )}
          </div>

          {/* Right side - Floating graphics */}
          <div className="hidden md:block w-72 bg-gradient-to-br from-[#0D0D0D] to-[#1A1A1A] relative overflow-hidden">
            {/* Floating tickers */}
            <FloatingTicker 
              symbol="NVDA" 
              price={prices.NVDA.price} 
              change={parseFloat(prices.NVDA.change.toFixed(1))} 
              delay={0}
              position={{ top: '15%', left: '10%' }}
            />
            <FloatingTicker 
              symbol="TSLA" 
              price={prices.TSLA.price} 
              change={parseFloat(prices.TSLA.change.toFixed(1))} 
              delay={0.5}
              position={{ top: '55%', right: '15%' }}
            />
            <FloatingTicker 
              symbol="SPY" 
              price={prices.SPY.price} 
              change={parseFloat(prices.SPY.change.toFixed(1))} 
              delay={1}
              position={{ bottom: '15%', left: '20%' }}
            />
            
            {/* Mini charts */}
            <MiniChart delay={0.3} position={{ top: '35%', right: '10%' }} />
            <MiniChart delay={0.8} position={{ bottom: '35%', left: '5%' }} />
            
            {/* Trend lines */}
            <TrendLine delay={0.2} position={{ top: '10%', right: '5%' }} />
            <TrendLine delay={0.7} position={{ bottom: '10%', right: '20%' }} />

            {/* Glowing orb effect */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-emerald-500/20 rounded-full blur-3xl" />
            <div className="absolute top-1/4 right-1/4 w-20 h-20 bg-purple-500/20 rounded-full blur-2xl" />
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out forwards;
        }
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
