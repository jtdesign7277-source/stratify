import { useState } from 'react';
import { Send, Bot, User, Loader2, Play } from 'lucide-react';

export default function AIChat() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Hey! Describe a trading strategy and I'll translate it." }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastStrategy, setLastStrategy] = useState(null);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);
    try {
      const res = await fetch('https://stratify-backend-production-3ebd.up.railway.app/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage }),
      });
      const data = await res.json();
      let response = data.response;
      const jsonMatch = response.match(/```json\n?([\s\S]*?)```/);
      if (jsonMatch) {
        try {
          const strategy = JSON.parse(jsonMatch[1]);
          setLastStrategy(strategy);
          response = strategy.explanation || 'Strategy ready!';
        } catch (e) {}
      }
      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error connecting.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-900 rounded-lg border border-zinc-800">
      <div className="flex items-center gap-2 p-4 border-b border-zinc-800">
        <Bot className="w-5 h-5 text-emerald-400" />
        <span className="font-semibold text-white">Grok AI</span>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
            {msg.role === 'assistant' && <Bot className="w-6 h-6 text-emerald-400" />}
            <div className={`max-w-[80%] p-3 rounded-lg ${msg.role === 'user' ? 'bg-blue-600' : 'bg-zinc-800'} text-white`}>
              {msg.content}
            </div>
          </div>
        ))}
        {loading && <div className="text-gray-400">Thinking...</div>}
      </div>
      {lastStrategy && (
        <div className="mx-4 mb-2 p-3 bg-zinc-800 rounded-lg border border-emerald-500/30 text-white text-sm">
          {lastStrategy.action} {lastStrategy.quantity} {lastStrategy.symbol}
        </div>
      )}
      <div className="p-4 border-t border-zinc-800 flex gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendMessage()} placeholder="Describe your strategy..." className="flex-1 bg-zinc-800 text-white px-4 py-2 rounded-lg border border-zinc-700" />
        <button onClick={sendMessage} className="p-2 bg-emerald-500 text-white rounded-lg"><Send className="w-5 h-5" /></button>
      </div>
    </div>
  );
}
