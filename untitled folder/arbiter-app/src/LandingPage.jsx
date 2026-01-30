import { useState, useEffect } from 'react'

const testimonials = [
  { name: 'Mike R.', handle: '@mikerarb', text: 'Found a 14% arb on Trump pardon markets. Arbiter paid for itself in one trade.', avatar: 'M', verified: true },
  { name: 'Sarah K.', handle: '@sarahk_trades', text: 'Finally a tool that actually works. The real-time alerts are insane.', avatar: 'S', verified: true },
  { name: 'DeFi Dan', handle: '@defidan', text: 'Was manually checking Poly vs Kalshi for hours. This does it in seconds.', avatar: 'D', verified: false },
  { name: 'Alex T.', handle: '@alext_bets', text: 'The scanner found 8 opportunities I completely missed. +$340 in a week.', avatar: 'A', verified: true },
  { name: 'Jordan', handle: '@jordan_arb', text: 'Clean UI, fast updates, actually shows fees. 10/10', avatar: 'J', verified: false },
  { name: 'CryptoKing', handle: '@cryptoking99', text: 'Been waiting for something like this. Polymarket + Kalshi arbitrage is free money.', avatar: 'C', verified: true },
  { name: 'Emma W.', handle: '@emmaw_finance', text: 'The liquidity filter alone saves so much time. No more tiny markets.', avatar: 'E', verified: false },
  { name: 'TraderTom', handle: '@tradertom', text: 'Switched from doing this manually. Arbiter is a game changer.', avatar: 'T', verified: true },
]

const features = [
  {
    icon: '🔍',
    title: 'Real-Time Scanner',
    description: 'Scans Polymarket, Kalshi, and more every 10 seconds. Never miss an opportunity.',
  },
  {
    icon: '⚡',
    title: 'Instant Alerts',
    description: 'Push notifications the moment a profitable arb appears. Be first to execute.',
  },
  {
    icon: '📊',
    title: 'Fee Calculator',
    description: 'Shows net profit after all platform fees. No surprises, just real numbers.',
  },
  {
    icon: '🎯',
    title: 'Smart Matching',
    description: 'AI-powered market matching finds the same event across different platforms.',
  },
]

const faqs = [
  {
    q: 'What is prediction market arbitrage?',
    a: 'Arbitrage is when you can buy YES on one platform and NO on another for less than $1 total. Since one must win, you profit the difference risk-free.',
  },
  {
    q: 'How much can I make?',
    a: 'Typical spreads range from 1-15%. With a $1000 bankroll and consistent execution, users report $200-500/month in profits.',
  },
  {
    q: 'Is this legal?',
    a: 'Yes. You\'re simply buying contracts on regulated platforms. Arbitrage is a standard trading strategy used by institutions.',
  },
  {
    q: 'What platforms do you support?',
    a: 'Currently Polymarket and Kalshi. We\'re adding PredictIt, Manifold, and Myriad soon.',
  },
  {
    q: 'How fast do opportunities disappear?',
    a: 'Good arbs can last minutes to hours depending on liquidity. Our real-time alerts help you catch them before they close.',
  },
  {
    q: 'Do you execute trades for me?',
    a: 'No. We show you the opportunity and link directly to each platform. You execute the trades yourself.',
  },
]

// Mock scanner data for the preview
const mockOpportunities = [
  { event: 'Trump Pardon 2026', outcome: 'Donald Trump', yesOn: 'KALSHI', noOn: 'POLYMARKET', spread: '15.0¢', fees: '1¢', profit: '+14.0¢' },
  { event: 'Taylor Swift Tour...', outcome: 'Max Martin', yesOn: 'POLYMARKET', noOn: 'KALSHI', spread: '8.0¢', fees: '2¢', profit: '+6.0¢' },
  { event: 'Bitcoin $100k March', outcome: 'Above $100,000', yesOn: 'KALSHI', noOn: 'POLYMARKET', spread: '4.5¢', fees: '1¢', profit: '+3.5¢' },
]

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState(null)
  const [email, setEmail] = useState('')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-[#09090B] text-white overflow-hidden">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#09090B]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-sm font-bold">
              A
            </div>
            <span className="font-semibold text-lg">Arbiter</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-gray-400 hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="text-sm text-gray-400 hover:text-white transition-colors">How it Works</a>
            <a href="#pricing" className="text-sm text-gray-400 hover:text-white transition-colors">Pricing</a>
            <a href="#faq" className="text-sm text-gray-400 hover:text-white transition-colors">FAQ</a>
          </div>
          <div className="hidden md:flex items-center gap-3">
            <button className="px-4 py-2 text-sm text-gray-300 hover:text-white transition-colors">Log in</button>
            <button className="px-4 py-2 text-sm font-medium bg-white text-black rounded-lg hover:bg-gray-100 transition-colors">
              Get Started
            </button>
          </div>
          {/* Mobile menu button */}
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-gray-400 hover:text-white"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-[#09090B] border-t border-white/5 px-4 py-4 space-y-4">
            <a href="#features" className="block text-gray-300 hover:text-white">Features</a>
            <a href="#how-it-works" className="block text-gray-300 hover:text-white">How it Works</a>
            <a href="#pricing" className="block text-gray-300 hover:text-white">Pricing</a>
            <a href="#faq" className="block text-gray-300 hover:text-white">FAQ</a>
            <div className="pt-4 border-t border-white/10 flex flex-col gap-3">
              <button className="w-full py-2.5 text-sm text-gray-300 hover:text-white transition-colors">Log in</button>
              <button className="w-full py-2.5 text-sm font-medium bg-white text-black rounded-lg hover:bg-gray-100 transition-colors">
                Get Started
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="relative pt-24 md:pt-32 pb-12 md:pb-20 px-4 md:px-6">
        {/* Ambient glow effects */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] opacity-30">
          <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-emerald-500 rounded-full blur-[150px]"></div>
          <div className="absolute top-40 left-1/3 w-[300px] h-[300px] bg-cyan-500 rounded-full blur-[120px]"></div>
          <div className="absolute top-32 right-1/3 w-[250px] h-[250px] bg-emerald-400 rounded-full blur-[100px]"></div>
        </div>

        <div className="max-w-6xl mx-auto relative z-10">
          {/* Badge */}
          <div className="flex justify-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full text-sm">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
              <span className="text-gray-300">Live arbitrage scanner</span>
              <span className="text-emerald-400 font-medium">— 23 opportunities found</span>
            </div>
          </div>

          {/* Headline */}
          <div className="text-center max-w-4xl mx-auto mb-6 md:mb-8">
            <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold leading-[1.1] mb-4 md:mb-6 tracking-tight">
              Risk-free profits in{' '}
              <span className="bg-gradient-to-r from-emerald-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent">
                prediction markets
              </span>
            </h1>
            <p className="text-base md:text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed px-2">
              We scan thousands of markets across Polymarket, Kalshi, and more to find arbitrage opportunities. Buy YES here, NO there, profit guaranteed.
            </p>
          </div>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8 md:mb-16 px-2">
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full sm:w-80 px-4 md:px-5 py-3 md:py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 focus:bg-white/[0.07] transition-all text-sm md:text-base"
            />
            <button className="w-full sm:w-auto px-6 md:px-8 py-3 md:py-3.5 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold rounded-xl transition-all hover:shadow-lg hover:shadow-emerald-500/25 text-sm md:text-base">
              Start Scanning Free →
            </button>
          </div>

          {/* Product Screenshot with Glow */}
          <div className="relative">
            {/* Glow behind the card */}
            <div className="absolute inset-0 bg-gradient-to-t from-emerald-500/20 via-emerald-500/5 to-transparent rounded-3xl blur-2xl scale-95"></div>
            
            {/* Main product preview */}
            <div className="relative bg-[#0F0F12] rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
              {/* Browser chrome */}
              <div className="flex items-center gap-2 px-4 py-3 bg-[#0A0A0C] border-b border-white/5">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
                </div>
                <div className="flex-1 flex justify-center">
                  <div className="px-4 py-1 bg-white/5 rounded-lg text-xs text-gray-500">
                    app.arbiter.io/scanner
                  </div>
                </div>
              </div>

              {/* Scanner UI Preview */}
              <div className="p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <h2 className="text-xl font-semibold">Arbitrage Scanner</h2>
                    <span className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-medium rounded-full">
                      <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
                      Live
                    </span>
                  </div>
                  <div className="text-sm text-gray-500">Updated: just now</div>
                </div>

                {/* Filters row */}
                <div className="flex items-center gap-3 mb-6">
                  {['All', 'Kalshi', 'Polymarket'].map((f, i) => (
                    <button
                      key={f}
                      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                        i === 0 ? 'bg-emerald-500 text-black' : 'bg-white/5 text-gray-400 hover:bg-white/10'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                  <div className="flex-1"></div>
                  <div className="text-sm text-gray-500">23 of 23 opportunities</div>
                </div>

                {/* Table - Desktop */}
                <div className="hidden md:block rounded-xl border border-white/5 overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-white/[0.02] text-left text-xs text-gray-500 uppercase tracking-wider">
                        <th className="px-4 py-3 font-medium">Event</th>
                        <th className="px-4 py-3 font-medium">Outcome</th>
                        <th className="px-4 py-3 font-medium">Trade</th>
                        <th className="px-4 py-3 font-medium text-right">Spread</th>
                        <th className="px-4 py-3 font-medium text-right">Fees</th>
                        <th className="px-4 py-3 font-medium text-right">Net Profit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mockOpportunities.map((opp, i) => (
                        <tr key={i} className="border-t border-white/5 hover:bg-white/[0.02] transition-colors">
                          <td className="px-4 py-4 font-medium">{opp.event}</td>
                          <td className="px-4 py-4">
                            <span className="px-2 py-1 bg-white/5 rounded text-sm">{opp.outcome}</span>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex flex-col gap-1 text-xs">
                              <span><span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 rounded font-medium">YES</span> on {opp.yesOn}</span>
                              <span><span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded font-medium">NO</span> on {opp.noOn}</span>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-right font-mono">{opp.spread}</td>
                          <td className="px-4 py-4 text-right font-mono text-gray-500">{opp.fees}</td>
                          <td className="px-4 py-4 text-right font-mono font-semibold text-emerald-400">{opp.profit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden space-y-3">
                  {mockOpportunities.map((opp, i) => (
                    <div key={i} className="bg-white/[0.02] rounded-xl p-4 border border-white/5">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="font-medium text-sm mb-1">{opp.event}</div>
                          <span className="text-xs px-2 py-0.5 bg-white/5 rounded">{opp.outcome}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-emerald-400 font-mono font-bold">{opp.profit}</div>
                          <div className="text-xs text-gray-500">profit</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 rounded">YES</span>
                        <span className="text-gray-500">{opp.yesOn}</span>
                        <span className="text-gray-600">→</span>
                        <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded">NO</span>
                        <span className="text-gray-500">{opp.noOn}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Bottom stats */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between mt-4 md:mt-6 pt-4 md:pt-6 border-t border-white/5 gap-4">
                  <div className="flex items-center gap-6 md:gap-8">
                    <div>
                      <div className="text-xl md:text-2xl font-bold text-emerald-400">+14.0¢</div>
                      <div className="text-xs text-gray-500">Best opportunity</div>
                    </div>
                    <div>
                      <div className="text-xl md:text-2xl font-bold">23</div>
                      <div className="text-xs text-gray-500">Active arbs</div>
                    </div>
                    <div>
                      <div className="text-xl md:text-2xl font-bold">$2.4M</div>
                      <div className="text-xs text-gray-500">Total liquidity</div>
                    </div>
                  </div>
                  <button className="w-full md:w-auto px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-medium rounded-lg transition-colors text-sm">
                    View All →
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Trust badges */}
          <div className="flex flex-wrap items-center justify-center gap-4 md:gap-8 mt-8 md:mt-12 text-xs md:text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <svg className="w-4 md:w-5 h-4 md:h-5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Bank-level encryption</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-4 md:w-5 h-4 md:h-5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>No credit card</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-4 md:w-5 h-4 md:h-5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
              </svg>
              <span>Real-time updates</span>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section id="how-it-works" className="py-16 md:py-24 px-4 md:px-6 bg-[#0D0D0F]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10 md:mb-16">
            <p className="text-emerald-400 font-semibold mb-3 text-xs md:text-sm tracking-wider">HOW IT WORKS</p>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">Guaranteed profit in 3 steps</h2>
            <p className="text-gray-400 text-base md:text-lg max-w-2xl mx-auto px-2">
              Prediction market arbitrage is simple math. If YES + NO costs less than $1, you profit the difference.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                step: '01',
                title: 'We scan',
                description: 'Arbiter continuously monitors prices across Polymarket, Kalshi, and other platforms every 10 seconds.',
                icon: '🔍',
              },
              {
                step: '02',
                title: 'You execute',
                description: 'When we find a profitable spread, you buy YES on one platform and NO on the other.',
                icon: '⚡',
              },
              {
                step: '03',
                title: 'You profit',
                description: 'One contract always wins. Your payout is $1, your cost was less. The difference is yours.',
                icon: '💰',
              },
            ].map((item, i) => (
              <div key={i} className="relative group">
                <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/10 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative bg-[#141416] border border-white/5 rounded-2xl p-8 hover:border-emerald-500/30 transition-colors">
                  <div className="text-6xl mb-6">{item.icon}</div>
                  <div className="text-emerald-400 text-sm font-mono mb-2">{item.step}</div>
                  <h3 className="text-xl font-semibold mb-3">{item.title}</h3>
                  <p className="text-gray-400">{item.description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Example calculation */}
          <div className="mt-16 bg-[#141416] border border-white/5 rounded-2xl p-8 md:p-12">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <h3 className="text-2xl font-bold mb-4">See the math</h3>
                <p className="text-gray-400 mb-6">
                  Here's a real example. The same event on two platforms with different prices creates a guaranteed profit opportunity.
                </p>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                    <div>
                      <div className="text-sm text-gray-500 mb-1">Buy YES on Kalshi</div>
                      <div className="font-semibold">Trump Pardon: Donald Trump</div>
                    </div>
                    <div className="text-xl font-mono font-bold">42¢</div>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                    <div>
                      <div className="text-sm text-gray-500 mb-1">Buy NO on Polymarket</div>
                      <div className="font-semibold">Trump Pardon: Donald Trump</div>
                    </div>
                    <div className="text-xl font-mono font-bold">44¢</div>
                  </div>
                </div>
              </div>
              <div className="bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 rounded-2xl p-8 border border-emerald-500/20">
                <div className="text-center">
                  <div className="text-sm text-gray-400 mb-2">Total Cost</div>
                  <div className="text-4xl font-bold font-mono mb-6">86¢</div>
                  
                  <div className="w-16 h-0.5 bg-white/20 mx-auto mb-6"></div>
                  
                  <div className="text-sm text-gray-400 mb-2">Guaranteed Payout</div>
                  <div className="text-4xl font-bold font-mono text-white mb-6">$1.00</div>
                  
                  <div className="w-16 h-0.5 bg-emerald-500/50 mx-auto mb-6"></div>
                  
                  <div className="text-sm text-emerald-400 mb-2">Your Profit</div>
                  <div className="text-5xl font-bold font-mono text-emerald-400">+14¢</div>
                  <div className="text-sm text-gray-500 mt-2">16.3% return, risk-free</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-16 md:py-24 px-4 md:px-6 bg-white text-gray-900">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10 md:mb-16">
            <p className="text-emerald-600 font-semibold mb-3 text-xs md:text-sm tracking-wider">FEATURES</p>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">Everything you need to win</h2>
            <p className="text-gray-600 text-base md:text-lg">Stop playing their game. Use these tools to exploit market inefficiencies.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {features.map((feature, i) => (
              <div key={i} className="bg-gray-50 rounded-2xl p-8 border border-gray-100 hover:border-emerald-200 hover:shadow-xl hover:shadow-emerald-500/5 transition-all group">
                <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center text-2xl mb-5 group-hover:scale-110 transition-transform">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                <p className="text-gray-600 mb-4 leading-relaxed">{feature.description}</p>
                <a href="#" className="inline-flex items-center gap-1 text-emerald-600 font-medium hover:gap-2 transition-all">
                  Learn more <span>→</span>
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section id="testimonials" className="py-16 md:py-24 px-4 md:px-6 bg-[#09090B]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10 md:mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">Loved by traders</h2>
            <p className="text-gray-400 text-base md:text-lg">Join thousands finding risk-free profits every day.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {testimonials.map((t, i) => (
              <div key={i} className="bg-[#141416] border border-white/5 rounded-2xl p-5 hover:border-white/10 transition-colors">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-blue-500 flex items-center justify-center font-bold text-sm">
                    {t.avatar}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-1">
                      <span className="font-semibold text-sm">{t.name}</span>
                      {t.verified && (
                        <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">{t.handle}</span>
                  </div>
                  <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                </div>
                <p className="text-sm text-gray-300">{t.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-16 md:py-24 px-4 md:px-6 bg-white text-gray-900">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8 md:mb-12">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">FAQ</h2>
            <p className="text-gray-600 text-sm md:text-base">Everything you need to know about arbitrage scanning.</p>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className="border border-gray-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full px-6 py-5 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
                >
                  <span className="font-medium text-lg">{faq.q}</span>
                  <svg 
                    className={`w-5 h-5 text-gray-400 transition-transform ${openFaq === i ? 'rotate-180' : ''}`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-5 text-gray-600 leading-relaxed">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 md:py-24 px-4 md:px-6 bg-[#09090B] relative overflow-hidden">
        {/* Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] md:w-[600px] h-[300px] md:h-[400px] bg-emerald-500/20 rounded-full blur-[100px] md:blur-[150px]"></div>
        
        <div className="max-w-3xl mx-auto text-center relative z-10">
          <h2 className="text-3xl md:text-5xl font-bold mb-4 md:mb-6">Start finding arbitrage today</h2>
          <p className="text-gray-400 text-base md:text-lg mb-6 md:mb-8 px-2">
            Join thousands of traders using Arbiter to find risk-free profits in prediction markets.
          </p>
          <button className="w-full sm:w-auto px-8 md:px-10 py-3.5 md:py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold rounded-xl transition-all text-base md:text-lg hover:shadow-lg hover:shadow-emerald-500/25">
            Get Started Free →
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 md:py-12 px-4 md:px-6 bg-[#09090B] border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10 md:mb-12">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-sm font-bold">
                  A
                </div>
                <span className="font-semibold text-lg">Arbiter</span>
              </div>
              <p className="text-sm text-gray-500">Find risk-free profit in prediction markets.</p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">Arbitrage Scanner</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Positive EV Finder</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Market Screener</a></li>
                <li><a href="#" className="hover:text-white transition-colors">API Access</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Resources</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">Documentation</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Tutorials</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Support</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">Terms of Service</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Disclaimer</a></li>
              </ul>
            </div>
          </div>
          
          <div className="flex items-center justify-between pt-8 border-t border-white/5">
            <p className="text-sm text-gray-500">© 2026 Arbiter. All rights reserved.</p>
            <div className="flex items-center gap-4">
              <a href="#" className="text-gray-400 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
                </svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
