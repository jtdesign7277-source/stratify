import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Mail, 
  Send, 
  CheckCircle, 
  XCircle,
  X,
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
import useSubscription from '../../hooks/useSubscription';
import { supabase } from '../../lib/supabaseClient';

const UPGRADE_URL = null; // Handled by click handler

const avatarOptions = [
  ...Array.from({ length: 6 }, (_, i) => `https://api.dicebear.com/7.x/bottts/svg?seed=avatar${i + 1}`),
  ...Array.from({ length: 6 }, (_, i) => `https://api.dicebear.com/7.x/avataaars/svg?seed=avatar${i + 7}`),
  ...Array.from({ length: 6 }, (_, i) => `https://api.dicebear.com/7.x/pixel-art/svg?seed=avatar${i + 13}`),
  ...Array.from({ length: 6 }, (_, i) => `https://api.dicebear.com/7.x/fun-emoji/svg?seed=avatar${i + 19}`),
];

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
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editStatus, setEditStatus] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = useState(false);
  const [avatarStatus, setAvatarStatus] = useState(null);
  const { user, isAuthenticated, updateProfile } = useAuth();
  const { isProUser } = useSubscription();

  const fullName = user?.user_metadata?.full_name?.trim();
  const displayName = fullName || 'Stratify User';
  const email = user?.email || '';
  const initialSource = (fullName || email || 'S').trim();
  const initials = initialSource ? initialSource[0].toUpperCase() : 'S';
  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—';
  const truncatedId = user?.id ? `${user.id.slice(0, 8)}...${user.id.slice(-4)}` : '—';
  const accountBadge = isProUser
    ? {
        label: 'Pro Account',
        badgeClass: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
        iconClass: 'text-sky-300',
      }
    : {
        label: 'Free Account',
        badgeClass: 'border-amber-500/30 bg-white/5 text-amber-300',
        iconClass: 'text-amber-300',
      };

  const handleCopyId = async () => {
    if (!user?.id || !navigator?.clipboard) return;
    try {
      await navigator.clipboard.writeText(user.id);
    } catch {
      // no-op
    }
  };

  useEffect(() => {
    if (!user?.id) {
      setAvatarUrl(null);
      return;
    }
    let isMounted = true;
    const loadAvatar = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', user.id)
        .single();
      if (!isMounted) return;
      if (!error) {
        setAvatarUrl(data?.avatar_url ?? null);
      }
    };
    loadAvatar();
    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  const handleAvatarSelect = async (selectedUrl) => {
    setAvatarStatus('saving');
    const { data } = await supabase.auth.getUser();
    const currentUser = data?.user;
    if (!currentUser) {
      setAvatarStatus(null);
      return;
    }
    const { error } = await supabase
      .from('profiles')
      .update({ avatar_url: selectedUrl })
      .eq('id', currentUser.id);
    if (!error) {
      setAvatarUrl(selectedUrl);
      setAvatarStatus(null);
    } else {
      setAvatarStatus('error');
      setTimeout(() => setAvatarStatus(null), 3000);
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
    <div className="h-full bg-[#0b0b0b] p-4 flex flex-col overflow-hidden">
      <div className="max-w-5xl mx-auto w-full flex-1 flex flex-col gap-3 min-h-0">
        
        {/* Header Row */}
        <div className="flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-xl font-semibold text-white">Contact & Support</h2>
            <p className="text-gray-500 text-sm">Get help or reach out to our team</p>
          </div>
          
          {/* Quick Links */}
          <div className="flex items-center gap-2">
            <a 
              href="mailto:jeff@stratify-associates.com" 
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#111118] border border-[#2a2a3d] hover:border-emerald-500/40 text-gray-300 hover:text-emerald-400 text-sm transition-all"
            >
              <Mail className="w-3.5 h-3.5" strokeWidth={1.5} />
              jeff@stratify-associates.com
            </a>
            <a 
              href="https://x.com/stratify_hq" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#111118] border border-[#2a2a3d] hover:border-emerald-500/40 text-gray-300 hover:text-emerald-400 text-sm transition-all"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
              @stratify_hq
            </a>
          </div>
        </div>

        {/* Top Row - Contact Form & Chat (Compact) */}
        <div className="flex-1 grid grid-cols-2 gap-3 min-h-0">
          
          {/* Contact Form */}
          <div className="bg-[#0b0b0b] border border-[#1f1f1f] rounded-xl p-4 flex flex-col">
            <h3 className="text-white font-medium text-lg mb-3 flex items-center gap-2">
              <Mail className="w-4 h-4 text-emerald-400" strokeWidth={1.5} />
              Send us a message
            </h3>
            
            <form onSubmit={handleSubmit} className="flex-1 flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                <input 
                  type="text" 
                  required
                  value={formData.name}
                  onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
                  className="w-full rounded-md border border-[#2a2a3d] bg-[#111118] px-3 py-2 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/60 transition-all" 
                  placeholder="Name"
                />
                <input 
                  type="email" 
                  required
                  value={formData.email}
                  onChange={(e) => setFormData(p => ({ ...p, email: e.target.value }))}
                  className="w-full rounded-md border border-[#2a2a3d] bg-[#111118] px-3 py-2 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/60 transition-all" 
                  placeholder="Email"
                />
              </div>
              
              <select 
                value={formData.subject}
                onChange={(e) => setFormData(p => ({ ...p, subject: e.target.value }))}
                className="w-full rounded-md border border-[#2a2a3d] bg-[#111118] px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500/60 transition-all"
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
                className="flex-1 w-full rounded-md border border-[#2a2a3d] bg-[#111118] px-3 py-2 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/60 transition-all resize-none" 
              />
              
              <div className="flex items-center gap-2">
                <button 
                  type="submit"
                  disabled={status === 'loading'}
                  className="px-2.5 py-1 rounded-md border border-emerald-500/40 hover:border-emerald-400 disabled:opacity-50 text-emerald-400 hover:text-emerald-300 text-sm font-medium transition-all flex items-center gap-1.5"
                >
                  {status === 'loading' ? (
                    <><Loader2 className="w-3 h-3 animate-spin" /> Sending...</>
                  ) : (
                    <><Send className="w-3 h-3" strokeWidth={1.5} /> Send</>
                  )}
                </button>
                
                <AnimatePresence>
                  {status === 'success' && (
                    <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-emerald-400 text-sm flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Sent!
                    </motion.span>
                  )}
                  {status === 'error' && (
                    <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-red-400 text-sm flex items-center gap-1">
                      <XCircle className="w-3 h-3" /> Failed
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            </form>
          </div>

          {/* Live Chat */}
          <div className="min-h-0 flex flex-col [&_*]:text-sm [&>div>div:first-child>span]:text-lg [&>div>div:first-child>div>span:last-child]:text-xs">
            <SupportChat compact className="flex-1" />
          </div>
        </div>

        {/* FAQ & User Profile - Side by Side */}
        <div className="flex-1 grid grid-cols-2 gap-3 min-h-0">

          {/* FAQ Section */}
          <div className="bg-[#0b0b0b] border border-[#1f1f1f] rounded-xl p-4 flex flex-col">
            <h3 className="text-white font-medium text-lg mb-3">Frequently Asked Questions</h3>
            
            <div className="flex-1 flex flex-col justify-between space-y-2">
              
              {faqs.map((faq, i) => (
                <div key={i} className="border border-[#1f1f1f] rounded-lg overflow-hidden">
                  <button 
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full px-4 py-3 flex items-center justify-between text-left text-white hover:bg-[#111118] transition-colors"
                  >
                    <span className="text-base font-medium">{faq.q}</span>
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
                        <p className="px-4 pb-3 text-gray-400 text-sm leading-relaxed">{faq.a}</p>
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
              <h3 className="text-white font-medium text-lg flex items-center gap-2">
                <User className="w-4 h-4 text-emerald-400" strokeWidth={1.5} />
                User Profile
              </h3>
              {isAuthenticated && (
                <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-sm ${accountBadge.badgeClass}`}>
                  <Shield className={`w-3.5 h-3.5 ${accountBadge.iconClass}`} strokeWidth={1.5} />
                  {accountBadge.label}
                </span>
              )}
            </div>

            {isAuthenticated && user ? (
              <div className="space-y-4">
                {/* Avatar + Name (editable) */}
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => isAuthenticated && setIsAvatarPickerOpen(true)}
                    disabled={!isAuthenticated}
                    className="h-14 w-14 rounded-full flex items-center justify-center text-white text-xl font-semibold flex-shrink-0 bg-gradient-to-br from-emerald-400 to-blue-500 hover:ring-2 hover:ring-blue-500/60 transition-all disabled:cursor-not-allowed"
                    aria-label="Change avatar"
                  >
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt="User avatar"
                        className="h-full w-full rounded-full object-cover"
                      />
                    ) : (
                      initials
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    {isEditing ? (
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full rounded-md border border-[#2a2a3d] bg-[#111118] px-3 py-2 text-white text-base focus:outline-none focus:border-emerald-500/60 transition-all"
                        placeholder="Display name"
                        autoFocus
                      />
                    ) : (
                      <p className="text-lg font-semibold text-white truncate">{displayName}</p>
                    )}
                    <p className="text-base text-gray-400 truncate mt-0.5">{email}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Account Type — clickable to upgrade */}
                  <button
                    onClick={async () => {
                      try {
                        const resp = await (await import('../../lib/supabaseClient')).supabase.auth.getUser();
                        const u = resp.data.user;
                        if (u === null) { window.location.href = '/signup'; return; }
                        const res = await fetch('/api/create-checkout-session', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ priceId: 'price_1T0jBTRdPxQfs9UeRln3Uj68', userId: u.id, userEmail: u.email })
                        });
                        const data = await res.json();
                        if (data.url) window.location.href = data.url;
                      } catch (e) { console.error('Checkout error:', e); }
                    }}
                    className="rounded-lg border border-[#1f1f1f] bg-[#0b0b0b] p-3 hover:border-emerald-500/40 transition-colors group cursor-pointer block text-left w-full"
                  >
                    <div className="flex items-center gap-1.5 text-gray-400 text-sm mb-1">
                      <Shield className="w-4 h-4" strokeWidth={1.5} />
                      Account Type
                    </div>
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-sm ${accountBadge.badgeClass}`}>
                      <Shield className={`w-3.5 h-3.5 ${accountBadge.iconClass}`} strokeWidth={1.5} />
                      {accountBadge.label}
                    </span>
                    <p className="text-sm text-emerald-400/70 mt-1.5 group-hover:text-emerald-400 transition-colors">
                      Upgrade to Pro →
                    </p>
                  </button>
                  <div className="rounded-lg border border-[#1f1f1f] bg-[#0b0b0b] p-3">
                    <div className="flex items-center gap-1.5 text-gray-400 text-sm mb-1">
                      <Calendar className="w-4 h-4" strokeWidth={1.5} />
                      Member Since
                    </div>
                    <p className="text-base text-white font-medium">{memberSince}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-lg border border-[#1f1f1f] bg-[#0b0b0b] p-3">
                  <div>
                    <p className="text-gray-400 text-sm mb-0.5">User ID</p>
                    <p className="text-base text-white font-mono">{truncatedId}</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyId}
                    className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/40 px-3 py-1.5 text-emerald-400 text-sm hover:border-emerald-400 hover:text-emerald-300 transition-all"
                  >
                    <Copy className="w-4 h-4" strokeWidth={1.5} />
                    Copy
                  </button>
                </div>

                {/* Edit Profile / Save button */}
                {isEditing ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        setEditStatus('saving');
                        const { error } = await updateProfile({ full_name: editName });
                        if (!error) {
                          setIsEditing(false);
                          setEditStatus(null);
                        } else {
                          setEditStatus('error');
                          setTimeout(() => setEditStatus(null), 3000);
                        }
                      }}
                      disabled={editStatus === 'saving'}
                      className="flex-1 rounded-md border border-emerald-500/40 px-3 py-2.5 text-emerald-400 text-base font-medium flex items-center justify-center gap-2 hover:border-emerald-400 hover:text-emerald-300 transition-all disabled:opacity-50"
                    >
                      {editStatus === 'saving' ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                      ) : (
                        <><CheckCircle className="w-4 h-4" strokeWidth={1.5} /> Save Changes</>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setIsEditing(false); setEditStatus(null); }}
                      className="rounded-md border border-[#2a2a3d] px-3 py-2.5 text-gray-400 text-base font-medium hover:border-red-500/40 hover:text-red-400 transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setIsEditing(true); setEditName(fullName || ''); }}
                    className="w-full rounded-md border border-emerald-500/40 px-3 py-2.5 text-emerald-400 text-base font-medium flex items-center justify-center gap-2 hover:border-emerald-400 hover:text-emerald-300 transition-all"
                  >
                    <Edit3 className="w-4 h-4" strokeWidth={1.5} />
                    Edit Profile
                  </button>
                )}
                {editStatus === 'error' && (
                  <p className="text-red-400 text-sm flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5" /> Failed to update profile
                  </p>
                )}
              </div>
            ) : (
              <p className="text-gray-500 text-base">Sign in to view your profile</p>
            )}
          </div>

        </div>{/* close grid */}

      </div>

      <AnimatePresence>
        {isAvatarPickerOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-start justify-end bg-black/50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsAvatarPickerOpen(false)}
          >
            <motion.div
              className="w-[360px] max-w-full h-full bg-[#0b0b0b] border border-white/10 rounded-xl p-4 text-white shadow-2xl flex flex-col"
              initial={{ x: 40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 40, opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-semibold">Choose Your Avatar</h4>
                <button
                  type="button"
                  onClick={() => setIsAvatarPickerOpen(false)}
                  className="h-8 w-8 rounded-full border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:border-blue-500 transition-all"
                  aria-label="Close avatar picker"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-4 gap-3">
                {avatarOptions.map((url) => {
                  const isSelected = avatarUrl === url;
                  return (
                    <button
                      key={url}
                      type="button"
                      onClick={() => handleAvatarSelect(url)}
                      className={`h-[60px] w-[60px] rounded-full border ${isSelected ? 'border-blue-500' : 'border-transparent'} hover:border-blue-500 transition-all`}
                      aria-pressed={isSelected}
                    >
                      <img
                        src={url}
                        alt="Avatar option"
                        className="h-full w-full rounded-full object-cover"
                      />
                    </button>
                  );
                })}
              </div>
              {avatarStatus === 'error' && (
                <p className="text-red-400 text-sm mt-3 flex items-center gap-1">
                  <XCircle className="w-3.5 h-3.5" /> Failed to update avatar
                </p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
