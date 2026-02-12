import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Send, Loader2, X, Bot, GripVertical } from 'lucide-react';

const API_BASE = 'https://stratify-backend-production-3ebd.up.railway.app';
const STORAGE_KEY = 'stratify-chat-v4';
const DEFAULT_WIDTH = 380;
const DEFAULT_HEIGHT = 480;

const getSessionId = () => {
  let id = sessionStorage.getItem('grok-session-id');
  if (!id) {
    id = 'session-' + Math.random().toString(36).substr(2, 9);
    sessionStorage.setItem('grok-session-id', id);
  }
  return id;
};

const FloatingGrokChat = ({ isOpen, onClose, onMessageCountChange }) => {
  const containerRef = useRef(null);
  const positionRef = useRef({ x: 220, y: 150 });
  const sizeRef = useRef({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });
  const dragOffset = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ x: 0, y: 0, width: 0, height: 0 });

  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [size, setSize] = useState({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });
  const [position, setPosition] = useState({ x: 220, y: 150 });

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const typingIntervalRef = useRef(null);

  useEffect(() => { sizeRef.current = size; }, [size]);
  useEffect(() => { positionRef.current = position; }, [position]);

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

  const saveState = (pos = positionRef.current, sz = sizeRef.current) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ pos, sz })); } catch {}
  };

  const clampPosition = useCallback((pos, sz = sizeRef.current) => {
    if (typeof window === "undefined") return pos;
    return {
      x: Math.min(Math.max(0, pos.x), window.innerWidth - sz.width),
      y: Math.min(Math.max(0, pos.y), window.innerHeight - sz.height),
    };
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 100);
  }, [isOpen]);

  // Report message count
  useEffect(() => {
    onMessageCountChange?.(messages.length);
  }, [messages.length, onMessageCountChange]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Cleanup typing interval
  useEffect(() => {
    return () => { if (typingIntervalRef.current) clearInterval(typingIntervalRef.current); };
  }, []);

  // ── Drag ─────────────────────────────────────────────────────
  const handleDragStart = (e) => {
    if (e.target.closest("button") || e.target.closest("a") || e.target.closest("input") || e.target.closest("textarea")) return;
    e.preventDefault();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    dragOffset.current = { x: clientX - positionRef.current.x, y: clientY - positionRef.current.y };
    setIsDragging(true);
  };

  const handleDragMove = useCallback((e) => {
    if (!isDragging) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const newPos = clampPosition({ x: clientX - dragOffset.current.x, y: clientY - dragOffset.current.y });
    positionRef.current = newPos;
    if (containerRef.current) containerRef.current.style.transform = `translate(${newPos.x}px, ${newPos.y}px)`;
  }, [isDragging, clampPosition]);

  const handleDragEnd = useCallback(() => {
    if (isDragging) { setPosition({ ...positionRef.current }); saveState(); }
    setIsDragging(false);
  }, [isDragging]);

  useEffect(() => {
    if (!isDragging) return;
    window.addEventListener("mousemove", handleDragMove);
    window.addEventListener("mouseup", handleDragEnd);
    window.addEventListener("touchmove", handleDragMove, { passive: false });
    window.addEventListener("touchend", handleDragEnd);
    return () => {
      window.removeEventListener("mousemove", handleDragMove);
      window.removeEventListener("mouseup", handleDragEnd);
      window.removeEventListener("touchmove", handleDragMove);
      window.removeEventListener("touchend", handleDragEnd);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  // ── Resize ───────────────────────────────────────────────────
  const handleResizeStart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    resizeStart.current = { x: clientX, y: clientY, width: sizeRef.current.width, height: sizeRef.current.height };
    setIsResizing(true);
  };

  const handleResizeMove = useCallback((e) => {
    if (!isResizing) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const newSize = {
      width: Math.max(300, Math.min(600, resizeStart.current.width + (clientX - resizeStart.current.x))),
      height: Math.max(300, Math.min(800, resizeStart.current.height + (clientY - resizeStart.current.y))),
    };
    sizeRef.current = newSize;
    if (containerRef.current) {
      containerRef.current.style.width = `${newSize.width}px`;
      containerRef.current.style.height = `${newSize.height}px`;
    }
  }, [isResizing]);

  const handleResizeEnd = useCallback(() => {
    if (isResizing) { setSize({ ...sizeRef.current }); saveState(); }
    setIsResizing(false);
  }, [isResizing]);

  useEffect(() => {
    if (!isResizing) return;
    window.addEventListener("mousemove", handleResizeMove);
    window.addEventListener("mouseup", handleResizeEnd);
    window.addEventListener("touchmove", handleResizeMove, { passive: false });
    window.addEventListener("touchend", handleResizeEnd);
    return () => {
      window.removeEventListener("mousemove", handleResizeMove);
      window.removeEventListener("mouseup", handleResizeEnd);
      window.removeEventListener("touchmove", handleResizeMove);
      window.removeEventListener("touchend", handleResizeEnd);
    };
  }, [isResizing, handleResizeMove, handleResizeEnd]);

  // ── Send Message ─────────────────────────────────────────────
  const handleSend = async () => {
    if (!chatInput.trim() || isLoading) return;
    const userMsg = chatInput.trim();
    setChatInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsLoading(true);

    try {
      const response = await fetch(API_BASE + '/api/v1/chat/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg, session_id: getSessionId() }),
      });
      if (!response.ok) throw new Error('Failed');
      const data = await response.json();
      const fullContent = data.response || "Couldn't respond.";
      
      setMessages(prev => [...prev, { role: 'assistant', content: '', isTyping: true }]);

      let idx = 0;
      if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
      typingIntervalRef.current = setInterval(() => {
        idx += 3;
        setMessages(prev => {
          const next = [...prev];
          const done = idx >= fullContent.length;
          next[next.length - 1] = { role: 'assistant', content: fullContent.slice(0, idx), isTyping: !done };
          return next;
        });
        if (idx >= fullContent.length) {
          clearInterval(typingIntervalRef.current);
          typingIntervalRef.current = null;
          setIsLoading(false);
        }
      }, 15);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Couldn't connect. Try again." }]);
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={containerRef}
      className="fixed z-[9999] flex flex-col rounded-xl overflow-hidden shadow-2xl shadow-black/50"
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
        width: size.width,
        height: size.height,
        background: "linear-gradient(180deg, #12141a 0%, #0a0c10 100%)",
        border: "1px solid rgba(59, 130, 246, 0.2)",
        left: 0,
        top: 0,
        userSelect: isDragging || isResizing ? "none" : "auto",
      }}
    >
      {/* Header (draggable) */}
      <div
        className="flex items-center gap-2 px-3 py-2.5 border-b border-white/10 cursor-grab active:cursor-grabbing select-none"
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
      >
        <GripVertical className="w-3.5 h-3.5 text-white/20" strokeWidth={1.5} />
        <Bot className="w-4 h-4 text-blue-400" />
        <span className="text-[13px] font-semibold text-white">Chat</span>
        <span className="text-[11px] text-blue-400/60 ml-1">AI Assistant</span>
        <div className="ml-auto">
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-white/5 transition-colors">
            <X className="w-3.5 h-3.5 text-white/40 hover:text-white/70" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div 
        className="flex-1 overflow-y-auto p-3 space-y-2"
        style={{ scrollbarWidth: 'none' }}
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <Bot className="w-10 h-10 text-blue-400/30 mb-3" />
            <p className="text-white/30 text-sm">Ask anything about trading, markets, or strategies.</p>
          </div>
        )}
        
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                m.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-sm'
                  : 'bg-white/5 text-white/90 border border-white/5 rounded-bl-sm'
              }`}
            >
              {m.content}
              {m.isTyping && <span className="inline-block w-1 h-3.5 bg-blue-400 ml-0.5 animate-pulse" />}
            </div>
          </div>
        ))}
        
        {isLoading && messages[messages.length - 1]?.role === 'user' && (
          <div className="flex justify-start">
            <div className="bg-white/5 rounded-lg px-3 py-2 flex items-center gap-2 border border-white/5">
              <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />
              <span className="text-white/40 text-sm">Thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-2.5 border-t border-white/10">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }}}
            placeholder="Ask anything..."
            rows={1}
            className="flex-1 min-h-[40px] max-h-20 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50 resize-none"
            style={{ scrollbarWidth: 'none' }}
          />
          <button
            onClick={handleSend}
            disabled={!chatInput.trim() || isLoading}
            className={`h-10 w-10 flex items-center justify-center rounded-lg transition-all ${
              chatInput.trim() && !isLoading
                ? 'bg-blue-600 hover:bg-blue-500 text-white'
                : 'bg-white/5 text-white/30 border border-white/10'
            }`}
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Resize handle */}
      <div
        className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
        onMouseDown={handleResizeStart}
        onTouchStart={handleResizeStart}
      >
        <svg className="w-3 h-3 text-white/15 absolute bottom-0.5 right-0.5" viewBox="0 0 10 10">
          <path d="M9 1v8H1" fill="none" stroke="currentColor" strokeWidth="1" />
          <path d="M9 5v4H5" fill="none" stroke="currentColor" strokeWidth="1" />
        </svg>
      </div>
    </div>
  );
};

export default FloatingGrokChat;
