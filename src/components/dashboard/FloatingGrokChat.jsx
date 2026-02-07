import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Send, Loader2, X, Zap } from 'lucide-react';

const API_BASE = 'https://stratify-backend-production-3ebd.up.railway.app';

const FloatingGrokChat = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const typingIntervalRef = useRef(null);
  const inputRef = useRef(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Cleanup typing interval
  useEffect(() => {
    return () => {
      if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
    };
  }, []);

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
      
      // Add empty assistant message for typewriter effect
      setMessages((prev) => [...prev, { role: 'assistant', content: '', isTyping: true }]);

      // Typewriter effect
      let idx = 0;
      if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
      typingIntervalRef.current = setInterval(() => {
        idx += 2; // Characters per tick
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
      }, 15); // Speed of typewriter
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
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="fixed bottom-24 right-6 z-[9999] w-[380px] h-[500px] flex flex-col rounded-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, #1a1a1f 0%, #0d0d12 100%)',
          border: '1px solid rgba(16, 185, 129, 0.2)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 40px rgba(16, 185, 129, 0.1)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-gradient-to-r from-emerald-500/10 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.3)]">
              <Zap className="w-4 h-4 text-emerald-400" strokeWidth={2} />
            </div>
            <div>
              <span className="text-white font-semibold text-sm">Grok</span>
              <span className="text-emerald-400/60 text-xs ml-2">AI Assistant</span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-500/40 text-gray-400 hover:text-red-400 transition-all duration-200"
          >
            <X className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ scrollbarWidth: 'thin' }}>
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
                <Zap className="w-8 h-8 text-emerald-400/60" strokeWidth={1.5} />
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
                    : 'bg-[#252530] text-[#e5e5e5] border border-white/5 rounded-bl-sm'
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
              <div className="bg-[#252530] rounded-xl rounded-bl-sm px-3.5 py-2.5 flex items-center gap-2 border border-white/5">
                <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
                <span className="text-gray-400 text-sm">Thinking...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-3 border-t border-white/10 bg-[#0d0d12]">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
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
              className="flex-1 min-h-[44px] max-h-24 rounded-xl bg-[#1a1a1f] border border-white/10 px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 resize-none transition-all"
              style={{ scrollbarWidth: 'thin' }}
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={!chatInput.trim() || isLoading}
              className={`h-11 w-11 flex-shrink-0 flex items-center justify-center rounded-xl transition-all duration-200 ${
                chatInput.trim() && !isLoading
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)]'
                  : 'bg-[#1a1a1f] text-gray-600 border border-white/10'
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
      </motion.div>
    </AnimatePresence>
  );
};

export default FloatingGrokChat;
