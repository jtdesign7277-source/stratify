// SentinelToast — App-level toast for Sentinel notifications
// Wire at App level so toasts appear on ANY page

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';

const ICONS = {
  trade_opened: '⚡',
  trade_closed: '✓',
  brain_update: '🧠',
  yolo_unlocked: '🔓',
  session_summary: '📊',
};

export default function SentinelToast({ onNavigateToSentinel }) {
  const { user } = useAuth();
  const [toast, setToast] = useState(null);

  const showToast = useCallback((notification) => {
    setToast(notification);
    setTimeout(() => setToast(null), 5000);
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel('sentinel-toast')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'sentinel_notifications',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        showToast(payload.new);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, showToast]);

  return (
    <div className="fixed bottom-4 right-4 z-[9999] pointer-events-none">
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, x: 100, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            onClick={() => {
              setToast(null);
              onNavigateToSentinel?.();
            }}
            className="pointer-events-auto cursor-pointer bg-white/[0.05] backdrop-blur-2xl rounded-2xl border border-white/[0.08] shadow-[0_24px_64px_rgba(0,0,0,0.6),0_8px_24px_rgba(0,0,0,0.4)] p-4 max-w-xs"
          >
            <div className="flex items-start gap-3">
              <span className="text-lg flex-shrink-0">{ICONS[toast.type] || '⚡'}</span>
              <div className="min-w-0">
                <p className="text-sm font-mono font-semibold text-white truncate">{toast.title}</p>
                <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{toast.body}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
