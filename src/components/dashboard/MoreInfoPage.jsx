import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Mail, 
  Send, 
  CheckCircle, 
  XCircle,
  Loader2,
  ChevronDown,
  User,
  Shield,
  Calendar,
  Copy,
  Edit3
} from 'lucide-react';
import SupportChat from './SupportChat';
import { useAuth } from '../../context/AuthContext';

const faqs = [
  {
    q: "How do I connect my broker?",
    a: "Go to Settings → Broker Connect and select Alpaca. You'll need your API Key and Secret from your Alpaca dashboard. We support both paper trading and live accounts. Once connected, you can execute trades directly from Stratify."
  },
  {
    q: "What markets does Stratify support?",
    a: "Stratify currently supports US stocks and crypto through Alpaca. You can trade thousands of stocks during market hours (9:30 AM - 4 PM ET) and crypto 24/7. Options and futures support coming soon!"
  },
  {
    q: "How does the AI strategy builder work?",
    a: "Just describe your trading idea in plain English — like 'Buy TSLA when RSI drops below 30 and sell when it hits 70'. Grok AI will generate a complete strategy with entry/exit rules, risk management, and you can backtest it instantly before deploying."
  },
  {
    q: "Is my data and money safe?",
    a: "Absolutely. We never store your broker credentials — they stay encrypted on your device. All connections use bank-level SSL encryption. Stratify can only execute trades you authorize, and you can revoke access anytime from your Alpaca dashboard."
  }
];

export default function MoreInfoPage() {
  const [formData, setFormData] = useState({ name: '', email: '', subject: 'General Inquiry', message: '' });
  const [status, setStatus] = useState(null);
  const [openFaq, setOpenFaq] = useState(null);
  const { user, isAuthenticated } = useAuth();

  const fullName = user?.user_metadata?.full_name?.trim();
  const displayName = fullName || 'Stratify User';
  const email = user?.email || '';
  const initialSource = (fullName || email || 'S').trim();
  const initials = initialSource ? initialSource[0].toUpperCase() : 'S';
  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—';
  const truncatedId = user?.id ? `${user.id.slice(0, 8)}...${user.id.slice(-4)}` : '—';

  const handleCopyId = async () => {
    if (!user?.id || !navigator?.clipboard) return;
    try {
      await navigator.clipboard.writeText(user.id);
    } catch {
      // no-op
    }
  };

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
        setTimeout(() => setStatus(null), 3000);
      } else {
        setStatus('error');
        setTimeout(() => setStatus(null), 3000);
      }
    } catch {
      setStatus('error');
      setTimeout(() => setStatus(null), 3000);
    }
  };

  return (
    <div className="h-full bg-[#0b0b0b] p-4 pb-2 flex flex-col overflow-hidden">
      <div className="max-w-5xl mx-auto w-full flex-1 flex flex-col gap-3 min-h-0">
        
        {/* Header Row */}
        <div className="flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-white">Contact & Support</h2>
            <p className="text-gray-500 text-xs">Get help or reach out to our team</p>
          </div>
          
          {/* Quick Links */}
          <div className="flex items-center gap-2">
            <a 
              href="mailto:stratify@agentmail.to" 
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#111118] border border-[#2a2a3d] hover:border-emerald-500/40 text-gray-300 hover:text-emerald-400 text-xs transition-all"
            >
              <Mail className="w-3.5 h-3.5" strokeWidth={1.5} />
              stratify@agentmail.to
            </a>
            <a 
              href="https://x.com/stratify_hq" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#111118] border border-[#2a2a3d] hover:border-emerald-500/40 text-gray-300 hover:text-emerald-400 text-xs transition-all"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
              @stratify_hq
            </a>
          </div>
        </div>

        {/* Top Row - Contact Form & Chat (Compact) */}
        <div className="grid grid-cols-2 gap-3" style={{ height: '300px' }}>
          
          {/* Contact Form */}
          <div className="bg-[#0b0b0b] border border-[#1f1f1f] rounded-xl p-3 flex flex-col">
            <h3 className="text-white font-medium text-xs mb-2 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-emerald-400" strokeWidth={1.5} />
              Send us a message
            </h3>
            
            <form onSubmit={handleSubmit} className="flex-1 flex flex-col gap-1.5">
              <div className="grid grid-cols-2 gap-1.5">
                <input 
                  type="text" 
                  required
                  value={formData.name}
                  onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
                  className="w-full rounded-md border border-[#2a2a3d] bg-[#111118] px-2 py-1 text-white text-[11px] placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/60 transition-all" 
                  placeholder="Name"
                />
                <input 
                  type="email" 
                  required
                  value={formData.email}
                  onChange={(e) => setFormData(p => ({ ...p, email: e.target.value }))}
                  className="w-full rounded-md border border-[#2a2a3d] bg-[#111118] px-2 py-1 text-white text-[11px] placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/60 transition-all" 
                  placeholder="Email"
                />
              </div>
              
              <select 
                value={formData.subject}
                onChange={(e) => setFormData(p => ({ ...p, subject: e.target.value }))}
                className="w-full rounded-md border border-[#2a2a3d] bg-[#111118] px-2 py-1 text-white text-[11px] focus:outline-none focus:border-emerald-500/60 transition-all"
              >
                <option>General Inquiry</option>
                <option>Technical Support</option>
                <option>Billing Question</option>
                <option>Feature Request</option>
                <option>Bug Report</option>
              </select>
              
              <textarea 
                rows={2} 
                required
                value={formData.message}
                onChange={(e) => setFormData(p => ({ ...p, message: e.target.value }))}
                placeholder="How can we help?" 
                className="flex-1 w-full rounded-md border border-[#2a2a3d] bg-[#111118] px-2 py-1 text-white text-[11px] placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/60 transition-all resize-none" 
              />
              
              <div className="flex items-center gap-2">
                <button 
                  type="submit"
                  disabled={status === 'loading'}
                  className="px-2.5 py-1 rounded-md border border-emerald-500/40 hover:border-emerald-400 disabled:opacity-50 text-emerald-400 hover:text-emerald-300 text-[11px] font-medium transition-all flex items-center gap-1"
                >
                  {status === 'loading' ? (
                    <><Loader2 className="w-3 h-3 animate-spin" /> Sending...</>
                  ) : (
                    <><Send className="w-3 h-3" strokeWidth={1.5} /> Send</>
                  )}
                </button>
                
                <AnimatePresence>
                  {status === 'success' && (
                    <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-emerald-400 text-[11px] flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Sent!
                    </motion.span>
                  )}
                  {status === 'error' && (
                    <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-red-400 text-[11px] flex items-center gap-1">
                      <XCircle className="w-3 h-3" /> Failed
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            </form>
          </div>

          {/* Live Chat */}
          <div className="min-h-0">
            <SupportChat compact />
          </div>
        </div>

        {/* FAQ & User Profile - Side by Side */}
        <div className="grid grid-cols-2 gap-3">

          {/* FAQ Section */}
          <div className="bg-[#0b0b0b] border border-[#1f1f1f] rounded-xl p-4">
            <h3 className="text-white font-medium text-sm mb-3">Frequently Asked Questions</h3>
            
            <div className="space-y-2">
              
              {faqs.map((faq, i) => (
                <div key={i} className="border border-[#1f1f1f] rounded-lg overflow-hidden">
                  <button 
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full px-4 py-3 flex items-center justify-between text-left text-white hover:bg-[#111118] transition-colors"
                  >
                    <span className="text-sm font-medium">{faq.q}</span>
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${openFaq === i ? 'rotate-180' : ''}`} />
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
                        <p className="px-4 pb-3 text-gray-400 text-xs leading-relaxed">{faq.a}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </div>

          {/* User Profile */}
          <div className="bg-[#111111] border border-[#1f1f1f] rounded-xl p-4 text-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-medium text-sm flex items-center gap-2">
                <User className="w-4 h-4 text-emerald-400" strokeWidth={1.5} />
                User Profile
              </h3>
              {isAuthenticated && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-300">
                  <Shield className="w-3.5 h-3.5" strokeWidth={1.5} />
                  Paper Account
                </span>
              )}
            </div>

            {isAuthenticated && user ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-full bg-gradient-to-br from-emerald-400 to-blue-500 flex items-center justify-center text-white text-lg font-semibold">
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-base font-semibold text-white truncate">{displayName}</p>
                    <p className="text-sm text-gray-400 truncate">{email}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-[#1f1f1f] bg-[#0b0b0b] p-3">
                    <div className="flex items-center gap-1.5 text-gray-400 text-xs mb-1">
                      <Shield className="w-4 h-4" strokeWidth={1.5} />
                      Account Type
                    </div>
                    <span className="inline-flex items-center rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-300">
                      Paper Account
                    </span>
                  </div>
                  <div className="rounded-lg border border-[#1f1f1f] bg-[#0b0b0b] p-3">
                    <div className="flex items-center gap-1.5 text-gray-400 text-xs mb-1">
                      <Calendar className="w-4 h-4" strokeWidth={1.5} />
                      Member Since
                    </div>
                    <p className="text-sm text-white font-medium">{memberSince}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-lg border border-[#1f1f1f] bg-[#0b0b0b] p-3">
                  <div>
                    <p className="text-gray-400 text-xs mb-0.5">User ID</p>
                    <p className="text-sm text-white font-mono">{truncatedId}</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyId}
                    className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/40 px-3 py-1.5 text-emerald-400 text-xs hover:border-emerald-400 hover:text-emerald-300 transition-all"
                  >
                    <Copy className="w-4 h-4" strokeWidth={1.5} />
                    Copy
                  </button>
                </div>

                <button
                  type="button"
                  disabled
                  className="w-full rounded-md border border-emerald-500/40 px-3 py-2.5 text-emerald-400 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Edit3 className="w-4 h-4" strokeWidth={1.5} />
                  Edit Profile
                </button>
              </div>
            ) : (
              <p className="text-gray-500 text-sm">Sign in to view your profile</p>
            )}
          </div>

        </div>{/* close grid */}

      </div>
    </div>
  );
}
