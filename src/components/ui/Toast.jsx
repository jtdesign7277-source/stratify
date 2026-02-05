import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

// Toast Context
const ToastContext = createContext(null);

// Toast configuration by type
const TOAST_CONFIG = {
  success: {
    icon: CheckCircle,
    bgGradient: 'from-emerald-500/10 via-emerald-500/5 to-transparent',
    borderColor: 'border-emerald-500/30',
    iconColor: 'text-emerald-400',
    glowColor: 'shadow-[0_0_20px_rgba(16,185,129,0.15)]',
    progressColor: 'bg-emerald-500',
  },
  error: {
    icon: XCircle,
    bgGradient: 'from-red-500/10 via-red-500/5 to-transparent',
    borderColor: 'border-red-500/30',
    iconColor: 'text-red-400',
    glowColor: 'shadow-[0_0_20px_rgba(239,68,68,0.15)]',
    progressColor: 'bg-red-500',
  },
  warning: {
    icon: AlertTriangle,
    bgGradient: 'from-amber-500/10 via-amber-500/5 to-transparent',
    borderColor: 'border-amber-500/30',
    iconColor: 'text-amber-400',
    glowColor: 'shadow-[0_0_20px_rgba(245,158,11,0.15)]',
    progressColor: 'bg-amber-500',
  },
  info: {
    icon: Info,
    bgGradient: 'from-cyan-500/10 via-cyan-500/5 to-transparent',
    borderColor: 'border-cyan-500/30',
    iconColor: 'text-cyan-400',
    glowColor: 'shadow-[0_0_20px_rgba(6,182,212,0.15)]',
    progressColor: 'bg-cyan-500',
  },
};

const MAX_TOASTS = 5;
const DEFAULT_DURATION = 4000;

// Individual Toast Component
const Toast = ({ id, type, title, message, duration, onDismiss }) => {
  const config = TOAST_CONFIG[type] || TOAST_CONFIG.info;
  const Icon = config.icon;
  const [progress, setProgress] = useState(100);
  const [isPaused, setIsPaused] = useState(false);
  const startTimeRef = useRef(Date.now());
  const remainingRef = useRef(duration);

  useEffect(() => {
    if (isPaused) return;

    const tick = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const remaining = Math.max(0, remainingRef.current - elapsed);
      const newProgress = (remaining / duration) * 100;
      setProgress(newProgress);

      if (remaining <= 0) {
        onDismiss(id);
      }
    };

    const interval = setInterval(tick, 50);
    return () => clearInterval(interval);
  }, [id, duration, onDismiss, isPaused]);

  const handleMouseEnter = () => {
    setIsPaused(true);
    remainingRef.current = remainingRef.current - (Date.now() - startTimeRef.current);
  };

  const handleMouseLeave = () => {
    setIsPaused(false);
    startTimeRef.current = Date.now();
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 50, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 50, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`
        relative overflow-hidden
        w-80 bg-[#0d0d12] rounded-xl border ${config.borderColor}
        ${config.glowColor}
        backdrop-blur-sm
      `}
    >
      {/* Background gradient */}
      <div className={`absolute inset-0 bg-gradient-to-r ${config.bgGradient} pointer-events-none`} />
      
      {/* Content */}
      <div className="relative p-4 flex items-start gap-3">
        {/* Icon */}
        <div className={`flex-shrink-0 ${config.iconColor}`}>
          <Icon size={20} strokeWidth={2} />
        </div>
        
        {/* Text */}
        <div className="flex-1 min-w-0">
          {title && (
            <p className="text-sm font-semibold text-white mb-0.5 truncate">
              {title}
            </p>
          )}
          <p className="text-sm text-gray-400 leading-snug">
            {message}
          </p>
        </div>
        
        {/* Dismiss button */}
        <button
          onClick={() => onDismiss(id)}
          className="flex-shrink-0 p-1 rounded-lg hover:bg-white/5 transition-colors text-gray-500 hover:text-gray-300"
        >
          <X size={14} />
        </button>
      </div>
      
      {/* Progress bar */}
      <div className="h-0.5 bg-[#1e1e2d]">
        <motion.div
          className={`h-full ${config.progressColor}`}
          initial={{ width: '100%' }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.05, ease: 'linear' }}
        />
      </div>
    </motion.div>
  );
};

// Toast Container
const ToastContainer = ({ toasts, onDismiss }) => {
  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <Toast {...toast} onDismiss={onDismiss} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
};

// Toast Provider
export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const toastIdRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const addToast = useCallback(({ type, title, message, duration = DEFAULT_DURATION }) => {
    const id = `toast-${++toastIdRef.current}`;
    
    setToasts((prev) => {
      // Remove oldest toasts if we're at max capacity
      const newToasts = prev.length >= MAX_TOASTS ? prev.slice(1) : prev;
      return [...newToasts, { id, type, title, message, duration }];
    });

    return id;
  }, []);

  const toast = useCallback({
    success: (message, options = {}) => 
      addToast({ type: 'success', message, ...options }),
    error: (message, options = {}) => 
      addToast({ type: 'error', message, ...options }),
    warning: (message, options = {}) => 
      addToast({ type: 'warning', message, ...options }),
    info: (message, options = {}) => 
      addToast({ type: 'info', message, ...options }),
    dismiss,
  }, [addToast, dismiss]);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
};

// Hook to use toast
export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export default Toast;
