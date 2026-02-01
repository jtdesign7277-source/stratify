import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, ArrowUp, Sparkles, Code, ChevronDown } from 'lucide-react';

const AtlasPanel = ({ onGenerateStrategy }) => {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const suggestions = [
    { label: 'Momentum Strategy', ticker: '$NVDA', prompt: 'Create a momentum strategy for $NVDA that buys when price breaks above 20-day high with volume confirmation' },
    { label: 'RSI Oversold', ticker: '$AAPL', prompt: 'Build an RSI oversold strategy for $AAPL that enters when RSI drops below 30 and exits at RSI 50' },
    { label: 'Mean Reversion', ticker: '$SPY', prompt: 'Design a mean reversion strategy for $SPY using Bollinger Bands with 2 standard deviations' },
    { label: 'MACD Cross', ticker: '$TSLA', prompt: 'Create a MACD crossover strategy for $TSLA with signal line confirmation' },
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  }, [inputValue]);

  const handleSubmit = async () => {
    if (!inputValue.trim() || isGenerating) return;

    const userMessage = inputValue.trim();
    setInputValue('');
    setShowSuggestions(false);
    
    // Add user message
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsGenerating(true);

    // Simulate AI response (replace with actual API call)
    setTimeout(() => {
      const aiResponse = {
        role: 'assistant',
        content: `I'll create that strategy for you. Here's the Python code:\n\n\`\`\`python
import pandas as pd
import numpy as np

class TradingStrategy:
    def __init__(self, symbol):
        self.symbol = symbol
        self.position = 0
        
    def calculate_signals(self, data):
        # Strategy logic here
        signals = pd.DataFrame(index=data.index)
        signals['signal'] = 0
        
        # Add your conditions
        return signals
        
    def execute(self, signal):
        if signal == 1 and self.position == 0:
            return 'BUY'
        elif signal == -1 and self.position == 1:
            return 'SELL'
        return 'HOLD'
\`\`\`

Would you like me to add backtesting logic or modify the entry/exit conditions?`
      };
      setMessages(prev => [...prev, aiResponse]);
      setIsGenerating(false);
    }, 1500);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSuggestionClick = (suggestion) => {
    setInputValue(suggestion.prompt);
    textareaRef.current?.focus();
  };

  return (
    <div className="flex flex-col h-full bg-[#060d18]">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10">
        <Brain className="w-5 h-5 text-blue-400" strokeWidth={1.5} />
        <div>
          <h2 className="text-base font-semibold text-white">Atlas AI</h2>
          <p className="text-sm text-gray-400">Strategy Builder</p>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col justify-center">
            {/* Welcome State */}
            <div className="text-center mb-8">
              <Sparkles className="w-10 h-10 text-blue-400 mx-auto mb-4" strokeWidth={1.5} />
              <h3 className="text-xl font-medium text-white mb-2">What strategy would you like to build?</h3>
              <p className="text-base text-gray-400">Describe your trading idea and I'll generate the code.</p>
            </div>

            {/* Suggestions */}
            {showSuggestions && (
              <div className="space-y-2">
                {suggestions.map((suggestion, index) => (
                  <motion.button
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="w-full text-left px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-blue-500/30 transition-all group"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-base text-white group-hover:text-blue-400 transition-colors">
                          {suggestion.label}
                        </span>
                        <span className="text-sm text-blue-400 ml-2">{suggestion.ticker}</span>
                      </div>
                      <ArrowUp className="w-4 h-4 text-gray-500 group-hover:text-blue-400 rotate-45 transition-colors" strokeWidth={1.5} />
                    </div>
                  </motion.button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {messages.map((message, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.role === 'assistant' && (
                  <Brain className="w-5 h-5 text-blue-400 mr-3 flex-shrink-0 mt-1" strokeWidth={1.5} />
                )}
                <div
                  className={`max-w-[85%] ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white rounded-2xl rounded-br-md px-4 py-3'
                      : 'text-gray-100'
                  }`}
                >
                  {message.role === 'assistant' ? (
                    <div className="text-base leading-relaxed">
                      {message.content.split('```').map((part, i) => {
                        if (i % 2 === 1) {
                          // Code block
                          const lines = part.split('\n');
                          const language = lines[0];
                          const code = lines.slice(1).join('\n');
                          return (
                            <div key={i} className="my-4 rounded-xl overflow-hidden bg-[#0a1628] border border-white/10">
                              <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/10">
                                <div className="flex items-center gap-2">
                                  <Code className="w-4 h-4 text-gray-400" strokeWidth={1.5} />
                                  <span className="text-sm text-gray-400">{language || 'code'}</span>
                                </div>
                                <button className="text-xs text-gray-400 hover:text-white transition-colors">
                                  Copy
                                </button>
                              </div>
                              <pre className="p-4 overflow-x-auto">
                                <code className="text-sm text-gray-300 font-mono">{code}</code>
                              </pre>
                            </div>
                          );
                        }
                        return <span key={i}>{part}</span>;
                      })}
                    </div>
                  ) : (
                    <p className="text-base">{message.content}</p>
                  )}
                </div>
              </motion.div>
            ))}
            
            {/* Generating indicator */}
            {isGenerating && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start"
              >
                <Brain className="w-5 h-5 text-blue-400 mr-3 flex-shrink-0" strokeWidth={1.5} />
                <div className="flex items-center gap-1 py-3">
                  <motion.div
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="w-2 h-2 rounded-full bg-blue-400"
                  />
                  <motion.div
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}
                    className="w-2 h-2 rounded-full bg-blue-400"
                  />
                  <motion.div
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: 0.4 }}
                    className="w-2 h-2 rounded-full bg-blue-400"
                  />
                </div>
              </motion.div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area - Claude Style */}
      <div className="p-4 border-t border-white/10">
        <div className="relative bg-[#0a1628] rounded-2xl border border-white/10 focus-within:border-blue-500/50 transition-colors">
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe your trading strategy..."
            rows={1}
            className="w-full bg-transparent text-base text-white placeholder-gray-500 px-4 py-4 pr-14 resize-none focus:outline-none max-h-[200px]"
            style={{ minHeight: '56px' }}
          />
          
          {/* Submit Arrow Button */}
          <button
            onClick={handleSubmit}
            disabled={!inputValue.trim() || isGenerating}
            className={`absolute right-3 bottom-3 w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
              inputValue.trim() && !isGenerating
                ? 'bg-blue-600 hover:bg-blue-500 text-white'
                : 'bg-white/10 text-gray-500 cursor-not-allowed'
            }`}
          >
            <ArrowUp className="w-5 h-5" strokeWidth={1.5} />
          </button>
        </div>
        
        <p className="text-xs text-gray-500 text-center mt-3">
          Atlas generates Python trading strategies. Always backtest before live trading.
        </p>
      </div>
    </div>
  );
};

export default AtlasPanel;
