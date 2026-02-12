import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Mail, 
  Send, 
  CheckCircle, 
  XCircle,
  Loader2,
  MessageCircle,
  X,
  HelpCircle,
  ExternalLink
} from 'lucide-react';
import SupportChat from './SupportChat';

export default function MoreInfoPage() {
  const [formData, setFormData] = useState({ name: '', email: '', subject: 'General Inquiry', message: '' });
  const [status, setStatus] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [hoveredTip, setHoveredTip] = useState(null);

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

  const tips = [
    { id: 'arb', label: 'Arb Scanner', desc: 'Find arbitrage opportunities across markets in real-time' },
    { id: 'ai', label: 'Atlas AI', desc: 'Describe strategies in plain English, AI builds them' },
    { id: 'alerts', label: 'Alerts', desc: 'Get notified instantly when your strategies trigger' },
    { id: 'broker', label: 'Brokers', desc: 'Currently supports Alpaca for stocks & crypto' },
  ];

  return (
    <div className="h-full bg-[#0b0b0b] p-6 flex flex-col">
      <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col gap-4">
        
        {/* Header Row */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">Contact & Support</h2>
            <p className="text-gray-500 text-sm">Get help or reach out to our team</p>
          </div>
          
          {/* Quick Links */}
          <div className="flex items-center gap-3">
            <a 
              href="mailto:stratify@agentmail.to" 
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#111118] border border-[#2a2a3d] hover:border-emerald-500/40 text-gray-300 hover:text-emerald-400 text-sm transition-all"
            >
              <Mail className="w-4 h-4" strokeWidth={1.5} />
              stratify@agentmail.to
            </a>
            <a 
              href="https://x.com/stratify_hq" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#111118] border border-[#2a2a3d] hover:border-emerald-500/40 text-gray-300 hover:text-emerald-400 text-sm transition-all"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
              @stratify_hq
            </a>
          </div>
        </div>

        {/* Main Content - Two Columns */}
        <div className="flex-1 grid grid-cols-2 gap-4">
          
          {/* Contact Form */}
          <div className="bg-[#0b0b0b] border border-[#1f1f1f] rounded-xl p-4">
            <h3 className="text-white font-medium mb-3 flex items-center gap-2">
              <Mail className="w-4 h-4 text-emerald-400" strokeWidth={1.5} />
              Send us a message
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input 
                  type="text" 
                  required
                  value={formData.name}
                  onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
                  className="w-full rounded-lg border border-[#2a2a3d] bg-[#111118] px-3 py-2 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/60 transition-all" 
                  placeholder="Name"
                />
                <input 
                  type="email" 
                  required
                  value={formData.email}
                  onChange={(e) => setFormData(p => ({ ...p, email: e.target.value }))}
                  className="w-full rounded-lg border border-[#2a2a3d] bg-[#111118] px-3 py-2 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/60 transition-all" 
                  placeholder="Email"
                />
              </div>
              
              <select 
                value={formData.subject}
                onChange={(e) => setFormData(p => ({ ...p, subject: e.target.value }))}
                className="w-full rounded-lg border border-[#2a2a3d] bg-[#111118] px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500/60 transition-all"
              >
                <option>General Inquiry</option>
                <option>Technical Support</option>
                <option>Billing Question</option>
                <option>Feature Request</option>
                <option>Bug Report</option>
              </select>
              
              <textarea 
                rows={3} 
                required
                value={formData.message}
                onChange={(e) => setFormData(p => ({ ...p, message: e.target.value }))}
                placeholder="How can we help?" 
                className="w-full rounded-lg border border-[#2a2a3d] bg-[#111118] px-3 py-2 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/60 transition-all resize-none" 
              />
              
              <div className="flex items-center gap-3">
                <button 
                  type="submit"
                  disabled={status === 'loading'}
                  className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-500/50 text-white text-sm font-medium transition-all flex items-center gap-2"
                >
                  {status === 'loading' ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</>
                  ) : (
                    <><Send className="w-4 h-4" strokeWidth={1.5} /> Send</>
                  )}
                </button>
                
                <AnimatePresence>
                  {status === 'success' && (
                    <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-emerald-400 text-sm flex items-center gap-1">
                      <CheckCircle className="w-4 h-4" /> Sent!
                    </motion.span>
                  )}
                  {status === 'error' && (
                    <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-red-400 text-sm flex items-center gap-1">
                      <XCircle className="w-4 h-4" /> Failed
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            </form>
          </div>

          {/* Right Column - Quick Help & AI Chat Button */}
          <div className="flex flex-col gap-4">
            
            {/* Quick Help Tips */}
            <div className="bg-[#0b0b0b] border border-[#1f1f1f] rounded-xl p-4 flex-1">
              <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-blue-400" strokeWidth={1.5} />
                Quick Help
              </h3>
              
              <div className="grid grid-cols-2 gap-2">
                {tips.map(tip => (
                  <div 
                    key={tip.id}
                    className="relative"
                    onMouseEnter={() => setHoveredTip(tip.id)}
                    onMouseLeave={() => setHoveredTip(null)}
                  >
                    <div className="px-3 py-2 rounded-lg bg-[#111118] border border-[#2a2a3d] hover:border-emerald-500/40 cursor-default transition-all">
                      <span className="text-white text-sm">{tip.label}</span>
                    </div>
                    
                    <AnimatePresence>
                      {hoveredTip === tip.id && (
                        <motion.div
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 5 }}
                          className="absolute z-10 left-0 right-0 top-full mt-1 p-2 rounded-lg bg-[#1a1a2e] border border-emerald-500/30 shadow-lg"
                        >
                          <p className="text-gray-300 text-xs">{tip.desc}</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Chat CTA */}
            <button
              onClick={() => setChatOpen(true)}
              className="bg-gradient-to-r from-emerald-500/20 to-blue-500/20 border border-emerald-500/30 hover:border-emerald-500/60 rounded-xl p-4 text-left transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-blue-500 flex items-center justify-center">
                  <MessageCircle className="w-5 h-5 text-white" strokeWidth={1.5} />
                </div>
                <div>
                  <h3 className="text-white font-medium group-hover:text-emerald-400 transition-colors">Chat with AI Support</h3>
                  <p className="text-gray-500 text-sm">Get instant answers about Stratify</p>
                </div>
                <ExternalLink className="w-4 h-4 text-gray-500 ml-auto group-hover:text-emerald-400 transition-colors" />
              </div>
            </button>
            
          </div>
        </div>
      </div>

      {/* AI Chat Modal */}
      <AnimatePresence>
        {chatOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setChatOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative">
                <button
                  onClick={() => setChatOpen(false)}
                  className="absolute -top-3 -right-3 z-10 w-8 h-8 rounded-full bg-[#1f1f1f] border border-[#2a2a2a] hover:border-red-500/50 hover:bg-red-500/20 text-gray-400 hover:text-red-400 flex items-center justify-center transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
                <SupportChat />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
