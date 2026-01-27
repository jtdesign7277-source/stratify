import { useState } from 'react';

export default function NewsletterModal({ isOpen, onClose }) {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (email) {
      // Save to localStorage for now
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
      <div className="relative w-full max-w-xl mx-4 animate-fadeIn">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 text-gray-400 hover:text-white transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Card */}
        <div className="bg-[#FAFAFA] rounded-2xl p-8 md:p-12">
          {!submitted ? (
            <>
              {/* Headline */}
              <h2 className="text-3xl md:text-4xl font-bold text-[#0D0D0D] mb-3 tracking-tight">
                Trade signals to your inbox
              </h2>
              
              {/* Subheadline */}
              <p className="text-gray-600 text-sm mb-2">
                3 edge picks weekly with exact entry and exit points
              </p>
              
              {/* Mystery hook */}
              <p className="text-gray-500 text-xs mb-6 italic">
                The setups we don't post publicly. First movers only.
              </p>

              {/* Form */}
              <form onSubmit={handleSubmit} className="flex gap-3">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Your email address"
                  required
                  className="flex-1 px-5 py-3 rounded-full border border-gray-300 text-[#0D0D0D] placeholder-gray-400 focus:outline-none focus:border-gray-500 text-sm"
                />
                <button
                  type="submit"
                  className="px-6 py-3 bg-[#0D0D0D] text-white rounded-full font-medium text-sm hover:bg-[#1A1A1A] transition-colors whitespace-nowrap"
                >
                  Sign up
                </button>
              </form>

              {/* Privacy note */}
              <p className="text-[10px] text-gray-400 mt-4 leading-relaxed">
                No spam. Unsubscribe anytime. We guard your email like we guard our positions.
              </p>
            </>
          ) : (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-[#0D0D0D] mb-2">You're in.</h3>
              <p className="text-gray-600 text-sm">Watch your inbox. First signal drops soon.</p>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
