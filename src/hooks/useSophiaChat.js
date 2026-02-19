import { useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

const createMessageId = () => `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const parseWarRoomCommand = (text = '') => {
  const trimmed = String(text || '').trim();
  const match = trimmed.match(/^\/(warroom|research)\b\s*(.*)$/i);
  if (!match) return null;
  return {
    command: String(match[1] || '').toLowerCase(),
    query: String(match[2] || '').trim(),
  };
};

export function useSophiaChat() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentStrategy, setCurrentStrategy] = useState(null);

  const firstMatch = (content, patterns = []) => {
    for (const pattern of patterns) {
      const match = String(content || '').match(pattern);
      const value = String(match?.[1] || '').trim();
      if (value) return value;
    }
    return '';
  };

  const parseKeyTradeSetups = (content) => {
    const hasKeySection = /(?:🔥\s*Key Trade Setups|KEY TRADE SETUPS)/i.test(content);
    const sectionMatch = content.match(/(?:🔥\s*Key Trade Setups|KEY TRADE SETUPS)([\s\S]*)$/i);
    const sourceText = sectionMatch?.[1] || content;

    const entryMatch = sourceText.match(/[●•\-\*]?\s*Entry Signal:\s*(.+)/i);
    const volumeMatch = sourceText.match(/[●•\-\*]?\s*Volume:\s*(.+)/i);
    const trendMatch = sourceText.match(/[●•\-\*]?\s*Trend:\s*(.+)/i);
    const rrMatch = sourceText.match(/[●•\-\*]?\s*Risk\/Reward:\s*(.+)/i);
    const stopMatch = sourceText.match(/[●•\-\*]?\s*Stop Loss:\s*(.+)/i);
    const allocationMatch = sourceText.match(/[●•\-\*]?\s*\$ ?Allocation:\s*(.+)/i);

    const entry = entryMatch?.[1]?.trim() || '';
    const volume = volumeMatch?.[1]?.trim() || '';
    const trend = trendMatch?.[1]?.trim() || '';
    const riskReward = rrMatch?.[1]?.trim() || '';
    const stopLoss = stopMatch?.[1]?.trim() || '';
    const allocation = allocationMatch?.[1]?.trim() || '';

    const hasAll = [entry, volume, trend, riskReward, stopLoss].every(Boolean);

    return { entry, volume, trend, riskReward, stopLoss, allocation, hasAll, hasKeySection };
  };

  const ensureKeyTradeSetupsInContent = (content) => {
    const raw = String(content || '').trimEnd();
    const parsed = parseKeyTradeSetups(raw);
    const hasFullSection = parsed.hasKeySection && parsed.hasAll;
    if (hasFullSection) {
      return {
        content: raw,
        setups: parsed,
      };
    }

    const entry = parsed.entry || firstMatch(raw, [
      /(?:Entry Logic|Entry Condition)\s*:\s*(.+)/i,
      /-\s*\*\*Entry:\*\*\s*(.+)/i,
    ]);
    const volume = parsed.volume || firstMatch(raw, [
      /(?:Volume)\s*:\s*(.+)/i,
      /(volume[^.\n]+)/i,
    ]);
    const trend = parsed.trend || firstMatch(raw, [
      /(?:Trend)\s*:\s*(.+)/i,
      /(bullish|bearish|neutral(?:\s+to\s+(?:bullish|bearish))?[^.\n]*)/i,
    ]);
    const riskReward = parsed.riskReward || firstMatch(raw, [
      /(?:Risk\/Reward(?:\s*Ratio)?)\s*:\s*(.+)/i,
      /(\d+(?:\.\d+)?\s*:\s*\d+(?:\.\d+)?)/,
    ]);
    const stopLoss = parsed.stopLoss || firstMatch(raw, [
      /(?:Stop Loss)\s*:\s*(.+)/i,
      /\|\s*\*\*Stop Loss:\*\*\s*([^\n]+)/i,
    ]);
    const allocation = parsed.allocation || firstMatch(raw, [
      /(?:Backtest amount|Position Size|\$ ?Allocation)\s*:\s*(.+)/i,
    ]);

    const setupLines = [
      '🔥 Key Trade Setups',
      `● Entry Signal: ${entry || '—'}`,
      `● Volume: ${volume || '—'}`,
      `● Trend: ${trend || '—'}`,
      `● Risk/Reward: ${riskReward || '—'}`,
      `● Stop Loss: ${stopLoss || '—'}`,
      `● $ Allocation: ${allocation || '—'}`,
    ];

    const hasAnyKeyHeading = /(?:🔥\s*Key Trade Setups|KEY TRADE SETUPS)/i.test(raw);
    const normalized = hasAnyKeyHeading
      ? raw.replace(/(?:🔥\s*Key Trade Setups|KEY TRADE SETUPS)[\s\S]*$/i, setupLines.join('\n'))
      : `${raw}\n\n${setupLines.join('\n')}`.trim();

    const parsedNormalized = parseKeyTradeSetups(normalized);
    return {
      content: normalized,
      setups: parsedNormalized,
    };
  };

  const parseStrategy = (content) => {
    if (!content) return null;

    const normalized = ensureKeyTradeSetupsInContent(content);
    const { entry, volume, trend, riskReward, stopLoss, allocation, hasAll } = normalized.setups;
    const normalizedContent = normalized.content;

    const nameMatch = normalizedContent.match(/## 🏷️ Strategy Name:\s*(.+)/);
    const valueMatch = normalizedContent.match(/## 💰 Backtest Value:\s*(.+)/);
    const codeMatch = normalizedContent.match(/```python\n([\s\S]*?)```/);
    const tickerMatch =
      normalizedContent.match(/\bTicker:\s*\$?([A-Z]{1,5})\b/i) || normalizedContent.match(/\$([A-Z]{1,5})/);

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
      raw: normalizedContent,
      parseError: !hasAll,
      keyTradeSetups: { entry, volume, trend, riskReward, stopLoss, allocation },
      generatedAt: Date.now(),
    };
  };

  const sendMessage = useCallback(
    async (text) => {
      const trimmedText = String(text || '').trim();
      if (!trimmedText || isLoading) return;

      const userMessage = {
        id: createMessageId(),
        role: 'user',
        content: trimmedText,
        createdAt: Date.now(),
      };
      const command = parseWarRoomCommand(trimmedText);
      const assistantMessageId = createMessageId();
      const nextMessages = [...messages, userMessage];

      setMessages([
        ...nextMessages,
        {
          id: assistantMessageId,
          role: 'assistant',
          content: '',
          isWarRoom: Boolean(command),
          citations: [],
          savedToWarRoom: false,
        },
      ]);
      setIsLoading(true);

      if (command) {
        if (!command.query) {
          setMessages((prev) =>
            prev.map((message) =>
              message.id === assistantMessageId
                ? {
                    ...message,
                    isWarRoom: true,
                    content:
                      '📡 War Room Intel:\n\nPlease provide a query after the command, e.g. `/warroom $SPY options flow today`.',
                  }
                : message
            )
          );
          setIsLoading(false);
          return;
        }

        try {
          const response = await fetch('/api/warroom', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: command.query }),
          });

          const payload = await response.json().catch(() => ({}));
          if (!response.ok) {
            throw new Error(payload?.error || `Request failed (${response.status})`);
          }

          const content = String(payload?.content || '').trim() || 'No War Room intelligence returned.';
          const sources = Array.isArray(payload?.sources) ? payload.sources : [];

          setMessages((prev) =>
            prev.map((message) =>
              message.id === assistantMessageId
                ? {
                    ...message,
                    isWarRoom: true,
                    query: command.query,
                    content: `📡 War Room Intel:\n\n${content}`,
                    citations: sources,
                    savedToWarRoom: false,
                  }
                : message
            )
          );
        } catch (error) {
          setMessages((prev) =>
            prev.map((message) =>
              message.id === assistantMessageId
                ? {
                    ...message,
                    isWarRoom: true,
                    content: `📡 War Room Intel:\n\nError: ${error?.message || 'Unable to fetch intel.'}`,
                    citations: [],
                  }
                : message
            )
          );
        }

        setIsLoading(false);
        return;
      }

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
          setMessages((prev) =>
            prev.map((message) =>
              message.id === assistantMessageId
                ? { ...message, content: `Error: ${res.status} — ${errorText}` }
                : message
            )
          );
          setIsLoading(false);
          return;
        }

        if (!res.body) {
          setIsLoading(false);
          return;
        }

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
            setMessages((prev) =>
              prev.map((message) =>
                message.id === assistantMessageId ? { ...message, content: captured } : message
              )
            );
          }
        }

        const normalizedResponse = ensureKeyTradeSetupsInContent(fullContent);
        const finalContent = normalizedResponse.content;
        if (finalContent && finalContent !== fullContent) {
          setMessages((prev) =>
            prev.map((message) =>
              message.id === assistantMessageId ? { ...message, content: finalContent } : message
            )
          );
        }

        const strategy = parseStrategy(finalContent || fullContent);
        if (strategy) setCurrentStrategy(strategy);
      } catch (err) {
        setMessages((prev) =>
          prev.map((message) =>
            message.id === assistantMessageId
              ? { ...message, content: `Error: ${err?.message || 'Unknown error'}` }
              : message
          )
        );
      }

      setIsLoading(false);
    },
    [messages, isLoading, user]
  );

  const clearChat = useCallback(() => {
    setMessages([]);
    setCurrentStrategy(null);
  }, []);

  const markMessageSavedToWarRoom = useCallback((messageId) => {
    const targetId = String(messageId || '').trim();
    if (!targetId) return;

    setMessages((prev) =>
      prev.map((message) =>
        message.id === targetId ? { ...message, savedToWarRoom: true } : message
      )
    );
  }, []);

  return {
    messages,
    sendMessage,
    isLoading,
    currentStrategy,
    clearChat,
    setCurrentStrategy,
    markMessageSavedToWarRoom,
  };
}

export default useSophiaChat;
