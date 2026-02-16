import { useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

export function useSophiaChat() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentStrategy, setCurrentStrategy] = useState(null);

  const parseKeyTradeSetups = (content) => {
    const hasKeySection = /KEY TRADE SETUPS/i.test(content);
    const sourceText = hasKeySection
      ? content.split(/KEY TRADE SETUPS/i).slice(-1)[0] || ''
      : content;

    const entryMatch = sourceText.match(/Entry Signal:\s*(.+)/i);
    const volumeMatch = sourceText.match(/Volume:\s*(.+)/i);
    const trendMatch = sourceText.match(/Trend:\s*(.+)/i);
    const rrMatch = sourceText.match(/Risk\/Reward:\s*(.+)/i);
    const stopMatch = sourceText.match(/Stop Loss:\s*(.+)/i);
    const allocationMatch = sourceText.match(/\$ ?Allocation:\s*(.+)/i);

    const entry = entryMatch?.[1]?.trim() || '';
    const volume = volumeMatch?.[1]?.trim() || '';
    const trend = trendMatch?.[1]?.trim() || '';
    const riskReward = rrMatch?.[1]?.trim() || '';
    const stopLoss = stopMatch?.[1]?.trim() || '';
    const allocation = allocationMatch?.[1]?.trim() || '';

    const hasAll = [entry, volume, trend, riskReward, stopLoss, allocation].every(Boolean);

    return { entry, volume, trend, riskReward, stopLoss, allocation, hasAll, hasKeySection };
  };

  const parseStrategy = (content) => {
    if (!content) return null;

    const { entry, volume, trend, riskReward, stopLoss, allocation, hasAll } = parseKeyTradeSetups(content);

    const nameMatch = content.match(/## 🏷️ Strategy Name:\s*(.+)/);
    const valueMatch = content.match(/## 💰 Backtest Value:\s*(.+)/);
    const codeMatch = content.match(/```python\n([\s\S]*?)```/);
    const tickerMatch = content.match(/\bTicker:\s*\$?([A-Z]{1,5})\b/i) || content.match(/\$([A-Z]{1,5})/);

    return {
      name: nameMatch?.[1]?.trim() || 'Sophia Strategy',
      value: valueMatch?.[1]?.trim() || '',
      ticker: tickerMatch?.[1] || '',
      entry,
      volume,
      trend,
      riskReward,
      stopLoss,
      allocation,
      code: codeMatch?.[1]?.trim() || '',
      raw: content,
      parseError: !hasAll,
      keyTradeSetups: { entry, volume, trend, riskReward, stopLoss, allocation },
      generatedAt: Date.now(),
    };
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
