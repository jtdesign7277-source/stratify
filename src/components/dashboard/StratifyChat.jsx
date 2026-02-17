import { useEffect, useRef, useState } from 'react';

const QUICK_ACTIONS = ['Analyze $TSLA', 'Build Strategy', 'What can you do?', 'Backtest RSI'];
const WELCOME_MESSAGE = "Welcome to Stratify AI. I'm your trading copilot — I can analyze markets, build strategies, run backtests, and help you make smarter trades. What are you looking at today?";

const INLINE_TOKEN_REGEX = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;

const normalizeLine = (line) => {
  if (/^\s*[-*]\s+/.test(line)) {
    return line.replace(/^\s*[-*]\s+/, '• ');
  }
  return line;
};

const renderPlainText = (text, keyPrefix) => {
  const parts = text.split('•');
  return parts.map((part, index) => (
    <span key={`${keyPrefix}-bullet-${index}`}>
      {part}
      {index < parts.length - 1 && <span className="text-blue-300">•</span>}
    </span>
  ));
};

const renderInline = (text, keyPrefix) => {
  const parts = text.split(INLINE_TOKEN_REGEX);
  return parts.map((part, index) => {
    if (!part) return null;
    const key = `${keyPrefix}-${index}`;
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <span key={key} className="font-semibold text-blue-300">
          {part.slice(2, -2)}
        </span>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={key}
          className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-200 font-medium"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return (
        <span key={key} className="italic text-gray-300">
          {part.slice(1, -1)}
        </span>
      );
    }
    return <span key={key}>{renderPlainText(part, key)}</span>;
  });
};

const renderMessageContent = (content) => {
  const lines = content.split('\n');
  return lines.map((line, index) => {
    const normalized = normalizeLine(line);
    return (
      <span key={`line-${index}`}>
        {renderInline(normalized, `line-${index}`)}
        {index < lines.length - 1 && <br />}
      </span>
    );
  });
};

const UserAvatar = () => (
  <div className="w-9 h-9 rounded-full bg-emerald-500/15 border border-emerald-400/40 flex items-center justify-center">
    <svg viewBox="0 0 24 24" className="w-5 h-5 text-emerald-300" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 7.5a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 20.25a7.5 7.5 0 0115 0" />
    </svg>
  </div>
);

const AssistantAvatar = () => (
  <div className="w-9 h-9 rounded-full bg-blue-500/15 border border-blue-400/40 flex items-center justify-center">
    <svg viewBox="0 0 24 24" className="w-5 h-5 text-blue-300" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l8 5-8 5-8-5 8-5z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 13l8 5 8-5" />
    </svg>
  </div>
);

const TypingIndicator = () => (
  <div className="flex items-center gap-1">
    <span className="typing-dot" />
    <span className="typing-dot delay-150" />
    <span className="typing-dot delay-300" />
  </div>
);

export default function StratifyChat() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: WELCOME_MESSAGE },
  ]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const textareaRef = useRef(null);
  const scrollRef = useRef(null);

  const hasUserMessage = messages.some((message) => message.role === 'user');
  const canSend = input.trim().length > 0 && !isStreaming;

  useEffect(() => {
    const id = 'jetbrains-mono-font';
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap';
    document.head.appendChild(link);
  }, []);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
  }, [input]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, streamingContent, isStreaming]);

  const sendMessage = async (text) => {
    const userMessage = text || input.trim();
    if (!userMessage || isStreaming) return;
    setInput('');
    const newMessages = [...messages, { role: 'user', content: userMessage }];
    const firstUserIndex = newMessages.findIndex(m => m.role === 'user');
    const apiMessages = firstUserIndex === -1 ? [] : newMessages.slice(firstUserIndex);
    setMessages(newMessages);
    setIsStreaming(true);
    setStreamingContent('');

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages.map(m => ({ role: m.role, content: m.content })) }),
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.text) {
                accumulated += parsed.text;
                setStreamingContent(accumulated);
              }
            } catch (e) {}
          }
        }
      }
      setMessages(prev => [...prev, { role: 'assistant', content: accumulated }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Connection error. Please try again.' }]);
    }
    setStreamingContent('');
    setIsStreaming(false);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  return (
    <div
      className="h-full w-full flex flex-col rounded-2xl border border-gray-800/50 bg-[#060d18] text-gray-100"
      style={{
        fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      }}
    >
      <style>{`
        .stratify-chat-scroll::-webkit-scrollbar {
          display: none;
        }
        .stratify-chat-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .stratify-chat-scroll::-webkit-scrollbar-thumb {
          display: none;
          border-radius: 999px;
        }
        .stratify-chat-scroll {
          scrollbar-width: none;
        }
        @keyframes cursor-blink {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
        .cursor-blink {
          animation: cursor-blink 1s steps(1) infinite;
        }
        @keyframes typing-pulse {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.3; }
          40% { transform: translateY(-2px); opacity: 1; }
        }
        .typing-dot {
          width: 6px;
          height: 6px;
          border-radius: 999px;
          background: #60a5fa;
          display: inline-block;
          animation: typing-pulse 1.2s infinite;
        }
        .typing-dot.delay-150 { animation-delay: 0.15s; }
        .typing-dot.delay-300 { animation-delay: 0.3s; }
      `}</style>

      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800/50 bg-[#0d1829]/70">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold tracking-[0.25em] text-white">STRATIFY AI</span>
          <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-[#121f33] text-orange-300 border border-orange-400/30">
            CLAUDE
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-emerald-300">
          <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
          <span>ONLINE</span>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto stratify-chat-scroll px-5 py-4 space-y-4">
        {!hasUserMessage && (
          <div className="p-3 rounded-xl border border-blue-500/20 bg-[#0d1829]/70">
            <div className="text-[11px] uppercase tracking-[0.3em] text-blue-200/70 mb-2">Quick Actions</div>
            <div className="flex flex-wrap gap-2">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action}
                  onClick={() => sendMessage(action)}
                  className="px-3 py-1.5 rounded-lg bg-[#0d1829] border border-blue-500/30 text-blue-200 text-xs tracking-wide hover:border-blue-400/60 hover:text-blue-100 transition"
                  type="button"
                >
                  {action}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message, index) => {
          const isUser = message.role === 'user';
          return (
            <div key={`${message.role}-${index}`} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
              {!isUser && <AssistantAvatar />}
              <div className={`max-w-[75%] ${isUser ? 'order-1' : 'order-2'} mx-3`}>
                <div
                  className={`px-4 py-3 rounded-2xl border text-sm leading-relaxed ${
                    isUser
                      ? 'bg-emerald-500/15 border-emerald-400/30 text-emerald-100'
                      : 'bg-[#0d1829] border-gray-800/50 text-slate-100'
                  }`}
                >
                  {renderMessageContent(message.content)}
                </div>
              </div>
              {isUser && <UserAvatar />}
            </div>
          );
        })}

        {isStreaming && (
          <div className="flex justify-start">
            <AssistantAvatar />
            <div className="max-w-[75%] mx-3">
              <div className="px-4 py-3 rounded-2xl border bg-[#0d1829] border-gray-800/50 text-slate-100 text-sm leading-relaxed">
                {streamingContent.length === 0 ? (
                  <TypingIndicator />
                ) : (
                  <>
                    {renderMessageContent(streamingContent)}
                    <span className="inline-block w-2 h-4 bg-blue-400 align-middle ml-1 cursor-blink" />
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-gray-800/50 bg-[#0d1829]/80 px-4 py-3">
        <div className="flex items-end gap-3">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Stratify AI..."
            rows={1}
            className="flex-1 resize-none rounded-xl border border-gray-800/60 bg-[#060d18] px-4 py-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />
          <button
            type="button"
            onClick={() => sendMessage()}
            disabled={!canSend}
            className={`h-11 w-11 rounded-xl border border-blue-500/30 flex items-center justify-center transition ${
              canSend
                ? 'bg-blue-500/20 text-blue-200 shadow-[0_0_12px_rgba(59,130,246,0.55)] hover:bg-blue-500/30'
                : 'bg-[#0b1424] text-blue-200/30 cursor-not-allowed'
            }`}
            aria-label="Send message"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 12h16M14 6l6 6-6 6" />
            </svg>
          </button>
        </div>
        <div className="mt-2 text-center text-[10px] text-blue-200/60 tracking-[0.25em]">
          POWERED BY CLAUDE • CONNECTED • ⌘K COMMANDS
        </div>
      </div>
    </div>
  );
}
