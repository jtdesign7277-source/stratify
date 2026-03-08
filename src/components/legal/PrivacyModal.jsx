import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

export default function PrivacyModal({ isOpen, onClose }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="privacy-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50"
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
          <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col bg-gradient-to-br from-white/[0.06] to-white/[0.02] backdrop-blur-xl rounded-2xl border border-white/[0.08] shadow-[0_24px_64px_rgba(0,0,0,0.6)] pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between px-6 pt-6">
                <h2 className="text-white font-semibold text-lg">Privacy Policy</h2>
                <button
                  type="button"
                  onClick={onClose}
                  className="text-white/70 hover:text-white transition p-1 -mt-1 -mr-1"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" strokeWidth={1.5} />
                </button>
              </div>
              <div className="overflow-y-auto px-6 pb-6 text-gray-400 text-sm leading-relaxed">
                <p className="mb-4">Last updated: March 8, 2026</p>

                <p className="mb-4"><strong className="text-gray-300">1. INFORMATION WE COLLECT</strong><br />
                We collect information you provide directly including: email address, password (encrypted), trading preferences, and watchlist data. We also automatically collect usage data, device information, and interaction logs to improve the Platform.</p>

                <p className="mb-4"><strong className="text-gray-300">2. HOW WE USE YOUR INFORMATION</strong><br />
                We use your information to: (a) provide and maintain the Platform; (b) process subscription payments via Stripe; (c) send service-related emails; (d) improve and personalize your experience; (e) detect and prevent fraud or abuse.</p>

                <p className="mb-4"><strong className="text-gray-300">3. DATA STORAGE</strong><br />
                Your account data is stored securely using Supabase, a SOC 2 compliant database provider. Payment information is processed and stored by Stripe and is never stored on our servers.</p>

                <p className="mb-4"><strong className="text-gray-300">4. DATA SHARING</strong><br />
                We do not sell, trade, or rent your personal information to third parties. We may share data with trusted service providers (Supabase, Stripe, Anthropic AI) solely to operate the Platform. We may disclose information if required by law.</p>

                <p className="mb-4"><strong className="text-gray-300">5. COOKIES AND TRACKING</strong><br />
                We use cookies and similar technologies to maintain your session and improve Platform functionality. You can disable cookies in your browser settings, though this may affect Platform functionality.</p>

                <p className="mb-4"><strong className="text-gray-300">6. THIRD PARTY SERVICES</strong><br />
                The Platform integrates with third-party services including Stripe (payments), Supabase (database), Twelve Data (market data), and Anthropic (AI). Each service has its own privacy policy.</p>

                <p className="mb-4"><strong className="text-gray-300">7. DATA RETENTION</strong><br />
                We retain your account data for as long as your account is active. You may request deletion of your account and associated data by contacting us at <a href="mailto:jeff@stratify-associates.com" className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2 transition-colors">jeff@stratify-associates.com</a>.</p>

                <p className="mb-4"><strong className="text-gray-300">8. CHILDREN&apos;S PRIVACY</strong><br />
                The Platform is not directed to children under 18. We do not knowingly collect personal information from children.</p>

                <p className="mb-4"><strong className="text-gray-300">9. YOUR RIGHTS</strong><br />
                You have the right to: access your personal data, correct inaccurate data, request deletion of your data, and opt out of marketing communications. Contact <a href="mailto:jeff@stratify-associates.com" className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2 transition-colors">jeff@stratify-associates.com</a> to exercise these rights.</p>

                <p className="mb-4"><strong className="text-gray-300">10. SECURITY</strong><br />
                We implement industry-standard security measures to protect your data. However, no method of transmission over the internet is 100% secure.</p>

                <p className="mb-4"><strong className="text-gray-300">11. CHANGES TO THIS POLICY</strong><br />
                We may update this Privacy Policy periodically. We will notify you of significant changes via email or a notice on the Platform.</p>

                <p className="mb-0"><strong className="text-gray-300">12. CONTACT</strong><br />
                For privacy-related questions, contact us at <a href="mailto:jeff@stratify-associates.com" className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2 transition-colors">jeff@stratify-associates.com</a></p>
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
