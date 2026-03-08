import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

export default function TermsModal({ isOpen, onClose }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="terms-modal"
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
                <h2 className="text-white font-semibold text-lg">Terms of Service</h2>
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

                <p className="mb-4"><strong className="text-gray-300">1. ACCEPTANCE OF TERMS</strong><br />
                By accessing or using Stratify (&quot;the Platform&quot;), you agree to be bound by these Terms of Service. If you do not agree, do not use the Platform.</p>

                <p className="mb-4"><strong className="text-gray-300">2. DESCRIPTION OF SERVICE</strong><br />
                Stratify is an AI-powered trading platform that provides paper trading simulation, market data, AI-generated strategy insights, and financial education tools. Stratify is NOT a licensed broker-dealer, investment advisor, or financial institution.</p>

                <p className="mb-4"><strong className="text-gray-300">3. NOT FINANCIAL ADVICE</strong><br />
                All content, strategies, and analysis provided by Stratify are for educational and informational purposes only. Nothing on the Platform constitutes financial, investment, legal, or tax advice. You are solely responsible for your own investment decisions. Past performance is not indicative of future results.</p>

                <p className="mb-4"><strong className="text-gray-300">4. PAPER TRADING</strong><br />
                Stratify&apos;s trading features use simulated paper trading only. No real money is invested or at risk through the Platform&apos;s trading features.</p>

                <p className="mb-4"><strong className="text-gray-300">5. SUBSCRIPTION AND BILLING</strong><br />
                Stratify Pro is available for $19.99/month or $191.90/year. Subscriptions are billed in advance on a recurring basis. You may cancel at any time through your account settings. Cancellations take effect at the end of the current billing period. No refunds are provided for partial periods.</p>

                <p className="mb-4"><strong className="text-gray-300">6. USER ACCOUNTS</strong><br />
                You are responsible for maintaining the confidentiality of your account credentials. You must be at least 18 years old to use the Platform. You agree to provide accurate and complete information when creating your account.</p>

                <p className="mb-4"><strong className="text-gray-300">7. PROHIBITED CONDUCT</strong><br />
                You agree not to: (a) use the Platform for any unlawful purpose; (b) attempt to gain unauthorized access to any part of the Platform; (c) interfere with the Platform&apos;s operation; (d) resell or redistribute Platform content without written permission.</p>

                <p className="mb-4"><strong className="text-gray-300">8. INTELLECTUAL PROPERTY</strong><br />
                All content, features, and functionality of the Platform are owned by Stratify and are protected by applicable intellectual property laws.</p>

                <p className="mb-4"><strong className="text-gray-300">9. DISCLAIMER OF WARRANTIES</strong><br />
                THE PLATFORM IS PROVIDED &quot;AS IS&quot; WITHOUT WARRANTIES OF ANY KIND. STRATIFY DOES NOT GUARANTEE THE ACCURACY OF MARKET DATA OR AI-GENERATED CONTENT.</p>

                <p className="mb-4"><strong className="text-gray-300">10. LIMITATION OF LIABILITY</strong><br />
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, STRATIFY SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, OR CONSEQUENTIAL DAMAGES ARISING FROM YOUR USE OF THE PLATFORM.</p>

                <p className="mb-4"><strong className="text-gray-300">11. CHANGES TO TERMS</strong><br />
                We reserve the right to modify these Terms at any time. Continued use of the Platform after changes constitutes acceptance of the new Terms.</p>

                <p className="mb-0"><strong className="text-gray-300">12. CONTACT</strong><br />
                For questions about these Terms, contact us at <a href="mailto:jeff@stratify-associates.com" className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2 transition-colors">jeff@stratify-associates.com</a></p>
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
