import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Mail, 
  Send, 
  ChevronDown, 
  Radar, 
  Brain, 
  Bell, 
  CheckCircle, 
  XCircle,
  Loader2
} from 'lucide-react';

const faqs = [
  {
    q: "What is Stratify?",
    a: "Stratify is an AI-powered trading platform that helps you build, test, and deploy automated trading strategies. Our tools include the Arb Scanner for arbitrage opportunities, Atlas AI for strategy generation, and real-time market alerts."
  },
  {
    q: "How does the AI Strategy Builder work?",
    a: "Simply describe your trading idea in plain English, and Atlas AI will generate a complete strategy with entry/exit rules, risk management, and backtesting results. You can then deploy it with one click."
  },
  {
    q: "Is my data secure?",
    a: "Absolutely. We use bank-level encryption and never store your broker credentials on our servers. All connections are secured via OAuth and API keys remain on your device."
  },
  {
    q: "What brokers do you support?",
    a: "We currently support Alpaca for stocks and crypto trading. More brokers including Interactive Brokers and TD Ameritrade are coming soon."
  }
];

export default function MoreInfoPage() {
  const [formData, setFormData] = useState({ name: '', email: '', subject: 'General Inquiry', message: '' });
  const [status, setStatus] = useState(null); // 'loading' | 'success' | 'error'
  const [openFaq, setOpenFaq] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('loading');
    
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      if (res.ok) {
        setStatus('success');
        setFormData({ name: '', email: '', subject: 'General Inquiry', message: '' });
        setTimeout(() => setStatus(null), 4000);
      } else {
        setStatus('error');
        setTimeout(() => setStatus(null), 4000);
      }
    } catch {
      setStatus('error');
      setTimeout(() => setStatus(null), 4000);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-[#0b0b0b] p-6" style={{ scrollbarWidth: 'none' }}>
      <style>{`.more-info-scroll::-webkit-scrollbar { display: none; }`}</style>
      <div className="max-w-3xl mx-auto space-y-8">
        
        {/* About Section */}
        <section className="bg-[#0b0b0b] border border-[#1f1f1f] rounded-2xl p-6">
          <h2 className="text-2xl font-semibold text-white mb-2">About Stratify</h2>
          <p className="text-gray-400 mb-6">
            Stratify is building the future of algorithmic trading — making powerful AI-driven strategies accessible to everyone. 
            Our mission is to democratize quantitative finance and give retail traders the same edge as institutions.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#111118] border border-[#1f1f1f] rounded-xl p-4 hover:border-emerald-500/40 hover:-translate-y-0.5 transition-all">
              <Radar className="w-8 h-8 text-emerald-400 mb-3" fill="none" strokeWidth={1.5} />
              <h3 className="text-white font-medium mb-1">Arb Scanner</h3>
              <p className="text-gray-500 text-sm">Find arbitrage opportunities across markets in real-time.</p>
            </div>
            <div className="bg-[#111118] border border-[#1f1f1f] rounded-xl p-4 hover:border-emerald-500/40 hover:-translate-y-0.5 transition-all">
              <Brain className="w-8 h-8 text-blue-400 mb-3" fill="none" strokeWidth={1.5} />
              <h3 className="text-white font-medium mb-1">AI Strategy Builder</h3>
              <p className="text-gray-500 text-sm">Describe your idea, let Atlas AI build the strategy.</p>
            </div>
            <div className="bg-[#111118] border border-[#1f1f1f] rounded-xl p-4 hover:border-emerald-500/40 hover:-translate-y-0.5 transition-all">
              <Bell className="w-8 h-8 text-amber-400 mb-3" fill="none" strokeWidth={1.5} />
              <h3 className="text-white font-medium mb-1">Real-time Alerts</h3>
              <p className="text-gray-500 text-sm">Get notified instantly when your strategies trigger.</p>
            </div>
          </div>
        </section>

        {/* Contact Form */}
        <section className="bg-[#0b0b0b] border border-[#1f1f1f] rounded-2xl p-6">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <Mail className="w-5 h-5 text-emerald-400" fill="none" strokeWidth={1.5} />
            Contact Us
          </h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-white/50 uppercase tracking-wider mb-1">Name</label>
                <input 
                  type="text" 
                  required
                  value={formData.name}
                  onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
                  className="w-full rounded-lg border border-[#2a2a3d] bg-[#111118] px-4 py-2.5 text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/60 transition-all" 
                  placeholder="Your name"
                />
              </div>
              <div>
                <label className="block text-xs text-white/50 uppercase tracking-wider mb-1">Email</label>
                <input 
                  type="email" 
                  required
                  value={formData.email}
                  onChange={(e) => setFormData(p => ({ ...p, email: e.target.value }))}
                  className="w-full rounded-lg border border-[#2a2a3d] bg-[#111118] px-4 py-2.5 text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/60 transition-all" 
                  placeholder="you@example.com"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-xs text-white/50 uppercase tracking-wider mb-1">Subject</label>
              <select 
                value={formData.subject}
                onChange={(e) => setFormData(p => ({ ...p, subject: e.target.value }))}
                className="w-full rounded-lg border border-[#2a2a3d] bg-[#111118] px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500/60 transition-all"
              >
                <option>General Inquiry</option>
                <option>Technical Support</option>
                <option>Billing Question</option>
                <option>Feature Request</option>
                <option>Bug Report</option>
                <option>Partnership</option>
              </select>
            </div>
            
            <div>
              <label className="block text-xs text-white/50 uppercase tracking-wider mb-1">Message</label>
              <textarea 
                rows={4} 
                required
                value={formData.message}
                onChange={(e) => setFormData(p => ({ ...p, message: e.target.value }))}
                placeholder="How can we help you?" 
                className="w-full rounded-lg border border-[#2a2a3d] bg-[#111118] px-4 py-2.5 text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/60 transition-all resize-none" 
              />
            </div>
            
            <button 
              type="submit"
              disabled={status === 'loading'}
              className="px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-500/50 text-white font-medium transition-all flex items-center gap-2 hover:-translate-y-0.5"
            >
              {status === 'loading' ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</>
              ) : (
                <><Send className="w-4 h-4" fill="none" strokeWidth={1.5} /> Send Message</>
              )}
            </button>
          </form>

          {/* Toast */}
          <AnimatePresence>
            {status === 'success' && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0 }}
                className="mt-4 p-3 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center gap-2"
              >
                <CheckCircle className="w-5 h-5" /> Message sent! We'll get back to you soon.
              </motion.div>
            )}
            {status === 'error' && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0 }}
                className="mt-4 p-3 rounded-lg bg-red-500/20 border border-red-500/40 text-red-300 flex items-center gap-2"
              >
                <XCircle className="w-5 h-5" /> Failed to send. Please try again.
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Contact Info */}
        <section className="bg-[#0b0b0b] border border-[#1f1f1f] rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Get in Touch</h3>
          <div className="space-y-3">
            <a 
              href="mailto:stratify@agentmail.to" 
              className="flex items-center gap-3 text-gray-300 hover:text-emerald-400 transition-colors"
            >
              <Mail className="w-5 h-5" fill="none" strokeWidth={1.5} />
              stratify@agentmail.to
            </a>
            <a 
              href="https://x.com/stratify_hq" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-3 text-gray-300 hover:text-emerald-400 transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
              @stratify_hq
            </a>
          </div>
          <p className="text-gray-500 text-sm mt-4">
            Business Hours: Mon-Fri 9AM - 6PM EST
          </p>
        </section>

        {/* FAQ */}
        <section className="bg-[#0b0b0b] border border-[#1f1f1f] rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Frequently Asked Questions</h3>
          <div className="space-y-2">
            {faqs.map((faq, i) => (
              <div key={i} className="border border-[#1f1f1f] rounded-lg overflow-hidden">
                <button 
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full px-4 py-3 flex items-center justify-between text-left text-white hover:bg-[#111118] transition-colors"
                >
                  <span className="font-medium">{faq.q}</span>
                  <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${openFaq === i ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {openFaq === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <p className="px-4 pb-4 text-gray-400 text-sm">{faq.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}
