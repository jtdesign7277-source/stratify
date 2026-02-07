import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Send, Loader2, X, Zap } from 'lucide-react';

const API_BASE = 'https://stratify-backend-production-3ebd.up.railway.app';
const POSITION_STORAGE_KEY = 'stratify-floating-grok-position';
const DEFAULT_POSITION = { x: 80, y: 110 };
const MIN_WIDTH = 320;
const MIN_HEIGHT = 360;

const clampPosition = (pos, size) => {
  const width = size?.width || MIN_WIDTH;
  const height = size?.height || MIN_HEIGHT;
  const maxX = Math.max(12, window.innerWidth - width - 12);
  const maxY = Math.max(12, window.innerHeight - height - 12);
  return {
    x: Math.min(Math.max(12, pos.x), maxX),
    y: Math.min(Math.max(12, pos.y), maxY),
  };
};

const parseStoredPosition = () => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(POSITION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Number.isFinite(parsed?.x) || !Number.isFinite(parsed?.y)) return null;
    return { x: parsed.x, y: parsed.y };
  } catch {
    return null;
  }
};

const FloatingGrokChat = ({ isOpen, onClose }) => {
  const [position, setPosition] = useState(DEFAULT_POSITION);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const widgetRef = useRef(null);
  const dragState = useRef({ active: false, offsetX: 0, offsetY: 0 });
  const positionRef = useRef(position);
  const messagesEndRef = useRef(null);
  const typingIntervalRef = useRef(null);

  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  useEffect(() => {
    if (!isOpen) return;
    const stored = parseStoredPosition();
    if (!stored) return;
    const size = widgetRef.current
      ? { width: widgetRef.current.offsetWidth, height: widgetRef.current.offsetHeight }
      : null;
    const clamped = clampPosition(stored, size);
    positionRef.current = clamped;
    setPosition(clamped);
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    const handleResize = () => {
      if (!widgetRef.current) return;
      setPosition((prev) => {
        const clamped = clampPosition(prev, {
          width: widgetRef.current.offsetWidth,
          height: widgetRef.current.offsetHeight,
        });
        positionRef.current = clamped;
        return clamped;
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    return () => {
      if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
    };
  }, []);

  const savePosition = () => {
    try {
      localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(positionRef.current));
    } catch {
      // Ignore storage failures (private mode, etc.)
    }
  };

  const handleDragStart = (event) => {
    if (event.button !== 0) return;
    if (event.target.closest('[data-grok-close]')) return;
    const { x, y } = positionRef.current;
    dragState.current = {
      active: true,
      offsetX: event.clientX - x,
      offsetY: event.clientY - y,
    };
    setIsDragging(true);
    event.preventDefault();
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (event) => {
      if (!dragState.current.active) return;
      const size = widgetRef.current
        ? { width: widgetRef.current.offsetWidth, height: widgetRef.current.offsetHeight }
        : null;
      const next = clampPosition(
        {
          x: event.clientX - dragState.current.offsetX,
          y: event.clientY - dragState.current.offsetY,
        },
        size
      );
      positionRef.current = next;
      setPosition(next);
    };

    const handleUp = () => {
      if (!dragState.current.active) return;
      dragState.current.active = false;
      setIsDragging(false);
      savePosition();
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [isDragging]);

  const renderCode = (code, key) => (
    <pre
      key={key}
      className="mt-2 rounded-lg border border-white/10 bg-[#141518] px-3 py-2 text-xs text-gray-200 font-mono overflow-x-auto"
    >
      {code}
    </pre>
  );

  const renderContent = (content, msgIdx) => {
    const codeRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const parts = [];
    let last = 0;
    let match;
    while ((match = codeRegex.exec(content)) !== null) {
      if (match.index > last) {
        parts.push({ type: 'text', content: content.slice(last, match.index) });
      }
      parts.push({ type: 'code', content: match[2].trim() });
      last = match.index + match[0].length;
    }
    if (last < content.length) parts.push({ type: 'text', content: content.slice(last) });
    if (!parts.length) parts.push({ type: 'text', content });
    return parts.map((part, i) =>
      part.type === 'code' ? (
        renderCode(part.content, `${msgIdx}-code-${i}`)
      ) : (
        <span key={`${msgIdx}-text-${i}`} className="whitespace-pre-wrap">
          {part.content}
        </span>
      )
    );
  };

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
        body: JSON.stringify({ message: userMsg }),
      });
      if (!response.ok) throw new Error('Failed');
      const data = await response.json();
      const fullContent = data.response || "Couldn't respond.";
      setMessages((prev) => [...prev, { role: 'assistant', content: '', isTyping: true }]);

      let idx = 0;
      if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
      typingIntervalRef.current = setInterval(() => {
        idx += 10;
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
      }, 5);
    } catch (e) {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Error.', isError: true }]);
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={widgetRef}
          initial={{ opacity: 0, scale: 0.98, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 12 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="fixed top-0 left-0 z-[9999] w-[360px] max-w-[90vw] max-h-[85vh] min-h-[360px] rounded-2xl border border-white/10 bg-[#202124]/90 backdrop-blur-xl shadow-[0_24px_60px_rgba(0,0,0,0.55)] overflow-hidden"
          style={{
            x: position.x,
            y: position.y,
            resize: 'both',
          }}
        >
          <div
            className={`flex items-center justify-between px-3 py-2 border-b border-white/10 bg-[#303134]/80 cursor-${
              isDragging ? 'grabbing' : 'grab'
            }`}
            onPointerDown={handleDragStart}
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <div className="w-6 h-6 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shadow-[0_0_12px_rgba(16,185,129,0.25)]">
                <Zap className="w-3.5 h-3.5 text-emerald-300" strokeWidth={1.5} fill="none" />
              </div>
              Grok
            </div>
            <button
              data-grok-close
              onClick={onClose}
              className="p-1 rounded-md text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
              title="Close"
            >
              <X className="w-4 h-4" strokeWidth={1.5} fill="none" />
            </button>
          </div>

          <div className="flex flex-col h-full min-h-0">
            <div className="flex-1 overflow-y-auto min-h-0 px-3 py-2 space-y-2">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[88%] rounded-lg px-2.5 py-2 text-sm leading-relaxed ${
                      m.role === 'user'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-[#303134]/70 text-[#e5e5e5] border border-white/5'
                    }`}
                  >
                    {m.role === 'assistant' && m.isTyping && (
                      <div className="flex items-center gap-1 mb-1">
                        <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                      </div>
                    )}
                    {renderContent(m.content, i)}
                  </div>
                </div>
              ))}
              {isLoading && messages[messages.length - 1]?.role === 'user' && (
                <div className="flex justify-start">
                  <div className="bg-[#303134]/80 rounded-lg px-2.5 py-2 flex items-center gap-2 border border-white/5">
                    <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
                    <span className="text-gray-300 text-sm">Thinking...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="border-t border-white/10 bg-[#202124]/95 px-3 py-2">
              <div className="flex items-end gap-2">
                <textarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Ask Grok..."
                  className="flex-1 min-h-[48px] max-h-28 rounded-lg bg-[#111118] border border-white/10 px-2.5 py-2 text-sm text-[#e5e5e5] placeholder-gray-500 focus:outline-none focus:border-emerald-500/40 hover:border-emerald-500/40 resize-none"
                />
                <button
                  onClick={handleSend}
                  disabled={!chatInput.trim() || isLoading}
                  className={`h-9 w-9 flex items-center justify-center rounded-lg transition-colors ${
                    chatInput.trim() && !isLoading
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      : 'bg-gray-800 text-gray-600'
                  }`}
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default FloatingGrokChat;
