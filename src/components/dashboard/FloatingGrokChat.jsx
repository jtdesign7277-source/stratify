import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Send, Loader2, X, GripVertical } from 'lucide-react';

// X (Twitter) logo for Grok
const XLogo = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const API_BASE = 'https://stratify-backend-production-3ebd.up.railway.app';

// Unique session ID for conversation memory
const getSessionId = () => {
  let id = sessionStorage.getItem('grok-session-id');
  if (!id) {
    id = 'session-' + Math.random().toString(36).substr(2, 9);
    sessionStorage.setItem('grok-session-id', id);
  }
  return id;
};
const STORAGE_KEY = 'stratify-grok-chat-v2';

const FloatingGrokChat = ({ isOpen, onClose, onMessageCountChange }) => {
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [position, setPosition] = useState({ x: 220, y: 200 });
  const [size, setSize] = useState({ width: 380, height: 500 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  
  const messagesEndRef = useRef(null);
  const typingIntervalRef = useRef(null);
  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ x: 0, y: 0, width: 0, height: 0 });
  const dragStartPos = useRef({ x: 0, y: 0 });

  // Load saved position/size
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const { pos, sz } = JSON.parse(saved);
        if (pos) setPosition(pos);
        if (sz) setSize(sz);
      }
    } catch {}
  }, []);

  // Save position/size
  const saveState = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ pos: position, sz: size }));
    } catch {}
  };

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Report message count to parent
  useEffect(() => {
    onMessageCountChange?.(messages.length);
  }, [messages.length, onMessageCountChange]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
    };
  }, []);

  // Drag handlers - use transform for buttery smooth movement
  const currentPos = useRef(position);
  const frameRef = useRef(null);
  
  const handleDragStart = (e) => {
    if (e.target.closest('[data-no-drag]')) return;
    e.preventDefault();
    e.stopPropagation();
    currentPos.current = { ...position };
    dragOffset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
    
    // Disable pointer events on iframe/content during drag
    if (containerRef.current) {
      containerRef.current.style.transition = 'none';
    }
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) return;
    
    const handleMove = (e) => {
      // Cancel previous frame
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      
      // Use requestAnimationFrame for smooth 60fps updates
      frameRef.current = requestAnimationFrame(() => {
        const newX = Math.max(0, Math.min(window.innerWidth - size.width, e.clientX - dragOffset.current.x));
        const newY = Math.max(0, Math.min(window.innerHeight - size.height, e.clientY - dragOffset.current.y));
        currentPos.current = { x: newX, y: newY };
        
        // Apply transform directly for GPU-accelerated smooth movement
        if (containerRef.current) {
          containerRef.current.style.left = `${newX}px`;
          containerRef.current.style.top = `${newY}px`;
        }
      });
    };
    
    const handleUp = () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      setPosition({ ...currentPos.current });
      setIsDragging(false);
      
      // Re-enable transitions
      if (containerRef.current) {
        containerRef.current.style.transition = '';
      }
      
      // Save after a short delay
      setTimeout(saveState, 50);
    };
    
    // Use capture phase for faster response
    document.addEventListener('mousemove', handleMove, { capture: true, passive: true });
    document.addEventListener('mouseup', handleUp, { capture: true });
    
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      document.removeEventListener('mousemove', handleMove, { capture: true });
      document.removeEventListener('mouseup', handleUp, { capture: true });
    };
  }, [isDragging, size]);

  // Resize handlers
  const handleResizeStart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    resizeStart.current = {
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height,
    };
    setIsResizing(true);
  };

  useEffect(() => {
    if (!isResizing) return;
    
    const handleMove = (e) => {
      const deltaX = e.clientX - resizeStart.current.x;
      const deltaY = e.clientY - resizeStart.current.y;
      const newWidth = Math.max(200, Math.min(600, resizeStart.current.width + deltaX));
      const newHeight = Math.max(180, Math.min(800, resizeStart.current.height + deltaY));
      setSize({ width: newWidth, height: newHeight });
    };
    
    const handleUp = () => {
      setIsResizing(false);
      saveState();
    };
    
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [isResizing]);

  const handleSend = async () => {
    if (!chatInput.trim() || isLoading) return;
    const userMsg = chatInput.trim();
    setChatInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }]);
    setIsLoading(true);

    try {
      const response = await fetch(API_BASE + '/api/v1/chat/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: userMsg,
          session_id: getSessionId()
        }),
      });
      if (!response.ok) throw new Error('Failed');
      const data = await response.json();
      const fullContent = data.response || "Couldn't respond.";
      
      setMessages((prev) => [...prev, { role: 'assistant', content: '', isTyping: true }]);

      let idx = 0;
      if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
      typingIntervalRef.current = setInterval(() => {
        idx += 2;
        setMessages((prev) => {
          const next = [...prev];
          const done = idx >= fullContent.length;
          next[next.length - 1] = {
            role: 'assistant',
            content: fullContent.slice(0, idx),
            isTyping: !done,
          };
          return next;
        });
        if (idx >= fullContent.length) {
          clearInterval(typingIntervalRef.current);
          typingIntervalRef.current = null;
          setIsLoading(false);
        }
      }, 15);
    } catch (e) {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Error connecting to Grok.', isError: true }]);
      setIsLoading(false);
    }
  };

  const handleClose = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        ref={containerRef}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.15 }}
        className="fixed z-[9999] flex flex-col rounded-2xl overflow-hidden select-none"
        style={{
          left: position.x,
          top: position.y,
          width: size.width,
          height: size.height,
          willChange: isDragging ? 'left, top' : 'auto',
          transform: 'translateZ(0)', // Force GPU layer
          backfaceVisibility: 'hidden',
          background: 'linear-gradient(180deg, #1a1a1f 0%, #0d0d12 100%)',
          border: '1px solid rgba(16, 185, 129, 0.2)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 40px rgba(16, 185, 129, 0.1)',
        }}
      >
        {/* Header - Draggable */}
        <div 
          className={`flex items-center justify-between px-4 py-3 border-b border-white/10 bg-gradient-to-r from-emerald-500/10 to-transparent ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
          onMouseDown={handleDragStart}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.3)]">
              <XLogo className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <span className="text-white font-semibold text-sm">Grok</span>
              <span className="text-emerald-400/60 text-xs ml-2">AI Assistant</span>
            </div>
          </div>
          <button
            type="button"
            data-no-drag
            onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-500/40 text-gray-400 hover:text-red-400 transition-all duration-200"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Messages - NO SCROLLBAR */}
        <div 
          className="flex-1 overflow-y-auto p-4 space-y-3"
          style={{ 
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          <style>{`.floating-grok-messages::-webkit-scrollbar { display: none; }`}</style>
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
                <XLogo className="w-8 h-8 text-emerald-400/50" />
              </div>
              <p className="text-white/40 text-sm">Ask Grok anything about trading, markets, or strategies.</p>
            </div>
          )}
          
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-emerald-600 text-white rounded-br-sm'
                    : 'bg-[#111111] text-[#e5e5e5] border border-white/5 rounded-bl-sm'
                }`}
              >
                <span className="whitespace-pre-wrap">{m.content}</span>
                {m.role === 'assistant' && m.isTyping && (
                  <span className="inline-block w-1.5 h-4 bg-emerald-400 ml-0.5 animate-pulse" />
                )}
              </div>
            </div>
          ))}
          
          {isLoading && messages[messages.length - 1]?.role === 'user' && (
            <div className="flex justify-start">
              <div className="bg-[#111111] rounded-xl rounded-bl-sm px-3.5 py-2.5 flex items-center gap-2 border border-white/5">
                <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
                <span className="text-gray-400 text-sm">Thinking...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-3 border-t border-white/10 bg-[#0b0b0b]" data-no-drag>
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              data-no-drag
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask Grok..."
              rows={1}
              className="flex-1 min-h-[44px] max-h-24 rounded-xl bg-[#111111] border border-white/10 px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 resize-none transition-all"
              style={{ scrollbarWidth: 'none' }}
            />
            <button
              type="button"
              data-no-drag
              onClick={handleSend}
              disabled={!chatInput.trim() || isLoading}
              className={`h-11 w-11 flex-shrink-0 flex items-center justify-center rounded-xl transition-all duration-200 ${
                chatInput.trim() && !isLoading
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)]'
                  : 'bg-[#111111] text-gray-600 border border-white/10'
              }`}
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {/* Resize Handle */}
        <div
          data-no-drag
          onMouseDown={handleResizeStart}
          className={`absolute bottom-0 right-0 w-6 h-6 flex items-center justify-center cursor-se-resize opacity-40 hover:opacity-100 transition-opacity ${isResizing ? 'opacity-100' : ''}`}
          style={{ 
            background: 'linear-gradient(135deg, transparent 50%, rgba(16, 185, 129, 0.3) 50%)',
            borderRadius: '0 0 16px 0',
          }}
        >
          <GripVertical className="w-3 h-3 text-emerald-400 rotate-[-45deg]" />
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default FloatingGrokChat;
