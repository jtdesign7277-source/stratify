import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { ALL_FEED_HASHTAGS, MAX_VISIBLE_FEED_HASHTAGS } from './communityConstants';

const FeedCustomizerModal = ({ open, onClose, enabledFeeds, onToggle }) => {
  const atLimit = enabledFeeds.length >= MAX_VISIBLE_FEED_HASHTAGS;

  return (
    <AnimatePresence mode="wait" initial={false}>
      {open && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="relative z-[60] w-full max-w-md rounded-2xl border shadow-2xl shadow-black/40 overflow-hidden"
            style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'linear-gradient(180deg, rgba(28,35,51,0.98) 0%, rgba(13,17,23,0.98) 100%)' }}
          >
            <div className="px-5 py-4 border-b border-white/6 flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.14em] text-[#7d8590]">Customize</div>
                <h3 className="text-lg font-semibold text-[#e6edf3]">Feed Channels</h3>
              </div>
              <button type="button" onClick={onClose} className="h-8 w-8 inline-flex items-center justify-center text-[#e6edf3]">
                <X size={14} strokeWidth={1.5} />
              </button>
            </div>
            <div className="p-5 space-y-2 max-h-[60vh] overflow-y-auto">
              <p className="text-xs text-[#7d8590] mb-3">
                Choose up to {MAX_VISIBLE_FEED_HASHTAGS} feed channels to show when you click the Globe icon.{' '}
                {atLimit ? <span className="text-[#f0883e] font-medium">Limit reached — disable one to add another.</span> : null}
              </p>
              {ALL_FEED_HASHTAGS.map((feed) => {
                const isEnabled = enabledFeeds.includes(feed.id);
                const isDisabledByLimit = !isEnabled && atLimit;
                return (
                  <button
                    key={feed.id}
                    type="button"
                    onClick={() => { if (!isDisabledByLimit) onToggle(feed.id); }}
                    disabled={isDisabledByLimit}
                    className={'w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all duration-200 ' + (isEnabled ? 'bg-[#58a6ff]/10 border-[#58a6ff]/30' : isDisabledByLimit ? 'bg-white/2 border-white/4 opacity-40 cursor-not-allowed' : 'bg-white/3 border-white/6 hover:bg-white/5')}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium" style={{ color: isEnabled ? '#58a6ff' : '#7d8590' }}>#</span>
                      <span className="text-sm font-medium" style={{ color: isEnabled ? '#e6edf3' : '#7d8590' }}>{feed.label}</span>
                    </div>
                    <div className={'w-9 h-5 rounded-full transition-all duration-200 flex items-center ' + (isEnabled ? 'bg-[#58a6ff] justify-end' : 'bg-white/10 justify-start')}>
                      <div className="w-4 h-4 rounded-full bg-white mx-0.5 shadow-sm transition-all duration-200" />
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="px-5 py-3 border-t border-white/6 flex items-center justify-between">
              <span className="text-xs text-[#7d8590]">{enabledFeeds.length} / {MAX_VISIBLE_FEED_HASHTAGS} slots used</span>
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-[#58a6ff] text-black text-sm font-semibold hover:bg-[#79b8ff] transition">Done</button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default FeedCustomizerModal;
