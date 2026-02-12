import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Loader2, Bot, User, Sparkles } from 'lucide-react';

const API_BASE = 'https://stratify-backend-production-3ebd.up.railway.app';

const SYSTEM_PROMPT = `You are Stratify Support, a helpful AI assistant for the Stratify trading platform. 

About Stratify:
- Stratify is an AI-powered algorithmic trading platform
- Features include: Arb Scanner (arbitrage opportunities), Atlas AI (strategy builder), real-time alerts, backtesting
- Supports Alpaca broker for stocks and crypto trading
- Users can describe trading strategies in plain English and Atlas AI builds them
- Contact email: stratify@agentmail.to
- Twitter/X: @stratify_hq

Your role:
- Answer questions about Stratify's features and capabilities
- Help users understand how to use the platform
- Provide guidance on trading strategies and the AI tools
- Be friendly, concise, and helpful
- If you don't know something specific, suggest contacting support via the contact form

Keep responses concise (2-4 sentences for simple questions). Use markdown formatting when helpful.`;

// Unique session ID for conversation memory
const getSessionId = () => {
  let id = sessionStorage.getItem('support-session-id');
  if (!id) {
    id = 'support-' + Math.random().toString(36).substr(2, 9);
    sessionStorage.setItem('support-session-id', id);
  }
  return id;
};

export default function SupportChat() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Hi! I'm Stratify Support. Ask me anything about the platform — features, trading strategies, how things work, or any questions you have! 🚀" }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMessage = { role: 'user', content: text };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Build conversation history for context
      const conversationHistory = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages.filter(m => m.role !== 'system'),
        userMessage
      ];

      const response = await fetch(`${API_BASE}/api/v1/chat/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: conversationHistory,
          session_id: getSessionId()
        })
      });

      if (!response.ok) throw new Error('Failed to get response');

      // Handle streaming response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';

      // Add placeholder for assistant message
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content || parsed.content || '';
              if (content) {
                assistantContent += content;
                setMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: 'assistant', content: assistantContent };
                  return updated;
                });
              }
            } catch {}
          }
        }
      }

      // Ensure we have content
      if (!assistantContent) {
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: "I'm having trouble responding right now. Please try again or use the contact form above." };
          return updated;
        });
      }

    } catch (error) {
      console.error('Support chat error:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: "Sorry, I couldn't connect. Please try again or use the contact form to reach our team directly." 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="bg-[#0b0b0b] border border-[#1f1f1f] rounded-2xl overflow-hidden flex flex-col" style={{ height: '400px' }}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#1f1f1f] flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-blue-500 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-white" fill="none" strokeWidth={1.5} />
        </div>
        <div>
          <h3 className="text-white font-medium text-sm">Stratify Support</h3>
          <p className="text-gray-500 text-xs">Ask anything about the platform</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs text-gray-500">Online</span>
        </div>
      </div>

      {/* Messages */}
      <div 
        className="flex-1 overflow-y-auto p-4 space-y-4"
        style={{ scrollbarWidth: 'none' }}
      >
        <style>{`.support-chat-scroll::-webkit-scrollbar { display: none; }`}</style>
        
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500/20 to-blue-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-3.5 h-3.5 text-emerald-400" />
                </div>
              )}
              <div className={`max-w-[80%] px-3 py-2 rounded-xl text-sm ${
                msg.role === 'user' 
                  ? 'bg-emerald-500 text-white rounded-br-sm' 
                  : 'bg-[#1a1a1a] text-gray-200 border border-[#2a2a2a] rounded-bl-sm'
              }`}>
                {msg.content || (
                  <span className="flex items-center gap-1 text-gray-400">
                    <Loader2 className="w-3 h-3 animate-spin" /> Thinking...
                  </span>
                )}
              </div>
              {msg.role === 'user' && (
                <div className="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
                  <User className="w-3.5 h-3.5 text-emerald-400" />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-[#1f1f1f]">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about Stratify..."
            disabled={isLoading}
            className="flex-1 bg-[#111118] border border-[#2a2a3d] rounded-lg px-3 py-2 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/60 transition-colors disabled:opacity-50"
          />
          <button
            onClick={sendMessage}
            disabled={isLoading || !input.trim()}
            className="px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-500/30 disabled:cursor-not-allowed text-white transition-all"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" fill="none" strokeWidth={1.5} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
