import { useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

export function useSophiaChat() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentStrategy, setCurrentStrategy] = useState(null);

  const parseStrategy = (content) => {
    // Extract Key Trade Setups
    const entryMatch = content.match(/\*\*Entry Signal:\*\*\s*(.+)/);
    const volumeMatch = content.match(/\*\*Volume:\*\*\s*(.+)/);
    const trendMatch = content.match(/\*\*Trend:\*\*\s*(.+)/);
    const rrMatch = content.match(/\*\*Risk\/Reward:\*\*\s*(.+)/);
    const stopMatch = content.match(/\*\*Stop Loss:\*\*\s*(.+)/);
    const nameMatch = content.match(/## 🏷️ Strategy Name:\s*(.+)/);
    const valueMatch = content.match(/## 💰 Backtest Value:\s*(.+)/);
    const codeMatch = content.match(/```python\n([\s\S]*?)```/);
    const tickerMatch = content.match(/\$([A-Z]{1,5})/);

    if (entryMatch || nameMatch || codeMatch) {
      return {
        name: nameMatch?.[1]?.trim() || 'Sophia Strategy',
        value: valueMatch?.[1]?.trim() || '',
        ticker: tickerMatch?.[1] || '',
        entry: entryMatch?.[1]?.trim() || '',
        volume: volumeMatch?.[1]?.trim() || '',
        trend: trendMatch?.[1]?.trim() || '',
        riskReward: rrMatch?.[1]?.trim() || '',
        stopLoss: stopMatch?.[1]?.trim() || '',
        code: codeMatch?.[1]?.trim() || '',
        raw: content,
      };
    }
    return null;
  };

  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || isLoading) return;
    const userMessage = { role: 'user', content: text.trim() };
    const nextMessages = [...messages, userMessage];
    setMessages([...nextMessages, { role: 'assistant', content: '' }]);
    setIsLoading(true);

    try {
      const res = await fetch('/api/sophia-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [userMessage],
          userId: user?.id || null,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => 'Unknown error');
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: `Error: ${res.status} — ${errorText}` };
          return updated;
        });
        setIsLoading(false);
        return;
      }

      if (!res.body) { setIsLoading(false); return; }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let fullContent = '';

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        const chunk = decoder.decode(value || new Uint8Array(), { stream: !done });
        if (chunk) {
          fullContent += chunk;
          const captured = fullContent;
          setMessages(prev => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last && last.role === 'assistant') {
              updated[updated.length - 1] = { ...last, content: captured };
            }
            return updated;
          });
        }
      }

      // Parse strategy from response
      const strategy = parseStrategy(fullContent);
      if (strategy) setCurrentStrategy(strategy);
    } catch (err) {
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'assistant', content: `Error: ${err.message}` };
        return updated;
      });
    }

    setIsLoading(false);
  }, [messages, isLoading, user]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setCurrentStrategy(null);
  }, []);

  return { messages, sendMessage, isLoading, currentStrategy, clearChat, setCurrentStrategy };
}

export default useSophiaChat;
