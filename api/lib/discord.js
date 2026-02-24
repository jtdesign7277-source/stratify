const CHANNELS = {
  general:       process.env.DISCORD_WEBHOOK_GENERAL,
  strategies:    process.env.DISCORD_WEBHOOK_STRATEGIES,
  tradeSetups:   process.env.DISCORD_WEBHOOK_TRADE_SETUPS,
  marketTalk:    process.env.DISCORD_WEBHOOK_MARKET_TALK,
  announcements: process.env.DISCORD_WEBHOOK_ANNOUNCEMENTS,
  showYourPnl:   process.env.DISCORD_WEBHOOK_SHOW_YOUR_PNL,
};

const toBlob = (file = {}) => {
  const bytes = file?.data;
  if (bytes instanceof Uint8Array || bytes instanceof ArrayBuffer) {
    return new Blob([bytes], { type: file.contentType || 'application/octet-stream' });
  }
  if (typeof bytes === 'string') {
    return new Blob([bytes], { type: file.contentType || 'text/plain' });
  }
  return null;
};

export async function postToDiscord(channel, { content, embeds, username, avatarUrl, allowedMentions, files }) {
  const webhookUrl = CHANNELS[channel];
  if (!webhookUrl) {
    throw new Error(`No webhook URL for channel: ${channel}`);
  }

  const payload = {
    username: username || 'Stratify Bot',
    avatar_url: avatarUrl || 'https://stratify-eight.vercel.app/stratify-icon.png',
  };

  if (content) payload.content = content;
  if (embeds) payload.embeds = embeds;
  if (allowedMentions) payload.allowed_mentions = allowedMentions;

  const normalizedFiles = Array.isArray(files)
    ? files.map((file) => ({
      name: file?.name || `attachment-${Date.now()}.bin`,
      blob: toBlob(file),
    })).filter((file) => Boolean(file.blob))
    : [];

  const useMultipart = normalizedFiles.length > 0;

  const res = useMultipart
    ? await (async () => {
      const formData = new FormData();
      formData.set('payload_json', JSON.stringify(payload));
      normalizedFiles.forEach((file, index) => {
        formData.append(`files[${index}]`, file.blob, file.name);
      });

      return fetch(webhookUrl, {
        method: 'POST',
        body: formData,
      });
    })()
    : await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Discord webhook failed (${res.status}): ${text}`);
  }

  return { success: true, channel };
}

export function buildStrategyEmbed({ name, ticker, type, description, winRate, signals }) {
  return {
    title: `🧠 New Strategy: ${name}`,
    description: description || `AI-generated ${type} strategy for **$${ticker}**`,
    color: 0x3B82F6,
    fields: [
      { name: 'Ticker',   value: `$${ticker}`,  inline: true },
      { name: 'Type',     value: type,           inline: true },
      { name: 'Win Rate', value: winRate || '—', inline: true },
      ...(signals ? [{ name: 'Signals', value: signals }] : []),
    ],
    footer: { text: 'Stratify AI • Not financial advice' },
    timestamp: new Date().toISOString(),
  };
}

export function buildTradeSetupEmbed({ ticker, direction, entry, target, stopLoss, reasoning }) {
  const isLong = direction?.toLowerCase() === 'long';
  return {
    title: `${isLong ? '🟢' : '🔴'} $${ticker} — ${isLong ? 'LONG' : 'SHORT'} Setup`,
    color: isLong ? 0x22C55E : 0xEF4444,
    fields: [
      { name: 'Entry',     value: `$${entry}`,    inline: true },
      { name: 'Target',    value: `$${target}`,    inline: true },
      { name: 'Stop Loss', value: `$${stopLoss}`,  inline: true },
      ...(reasoning ? [{ name: 'Reasoning', value: reasoning }] : []),
    ],
    footer: { text: 'Stratify • Educational purposes only' },
    timestamp: new Date().toISOString(),
  };
}

export function buildMarketMoverEmbed({ ticker, price, change, changePercent, volume, catalyst }) {
  const isUp = change >= 0;
  return {
    title: `${isUp ? '🚀' : '📉'} $${ticker} ${isUp ? '+' : ''}${changePercent}%`,
    color: isUp ? 0x22C55E : 0xEF4444,
    fields: [
      { name: 'Price',   value: `$${price}`,                    inline: true },
      { name: 'Change',  value: `${isUp ? '+' : ''}$${change}`, inline: true },
      { name: 'Volume',  value: volume?.toLocaleString() || '—', inline: true },
      ...(catalyst ? [{ name: 'Catalyst', value: catalyst }] : []),
    ],
    footer: { text: 'Stratify Market Intel' },
    timestamp: new Date().toISOString(),
  };
}

export function buildAnnouncementEmbed({ title, description, features, url }) {
  return {
    title: `📢 ${title}`,
    description,
    color: 0x8B5CF6,
    fields: features ? [{ name: "What's New", value: features.map(f => `• ${f}`).join('\n') }] : [],
    ...(url ? { url } : {}),
    footer: { text: 'Stratify Updates' },
    timestamp: new Date().toISOString(),
  };
}

export function buildPnlEmbed({ username, ticker, pnl, pnlPercent, strategy, duration }) {
  const isProfit = pnl >= 0;
  return {
    title: `${isProfit ? '💰' : '📊'} $${ticker} — ${isProfit ? '+' : ''}$${pnl.toLocaleString()}`,
    description: `**${username}** closed a trade on **$${ticker}**`,
    color: isProfit ? 0x22C55E : 0xEF4444,
    fields: [
      { name: 'P&L',      value: `${isProfit ? '+' : ''}$${pnl.toLocaleString()} (${pnlPercent}%)`, inline: true },
      { name: 'Strategy', value: strategy || '—', inline: true },
      { name: 'Duration', value: duration || '—', inline: true },
    ],
    footer: { text: 'Stratify Paper Trading • Not financial advice' },
    timestamp: new Date().toISOString(),
  };
}
