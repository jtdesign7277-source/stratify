// api/discord-post.js — Post content to Stratify Discord server via webhook
// Mirrors market content from the X content engine to Discord channels
// Each content type maps to a specific Discord channel webhook

import { Redis } from '@upstash/redis'

// Discord channel webhooks — set these in Vercel env vars
// Create webhooks in Discord: Server Settings → Integrations → Webhooks
const CHANNEL_WEBHOOKS = {
  'morning-briefing':    'DISCORD_WEBHOOK_BRIEFINGS',
  'technical-setup':     'DISCORD_WEBHOOK_SETUPS',
  'top-movers':          'DISCORD_WEBHOOK_MOVERS',
  'midday-update':       'DISCORD_WEBHOOK_ALERTS',
  'power-hour':          'DISCORD_WEBHOOK_ALERTS',
  'market-recap':        'DISCORD_WEBHOOK_RECAPS',
  'afterhours-movers':   'DISCORD_WEBHOOK_MOVERS',
  'weekend-watchlist':   'DISCORD_WEBHOOK_SETUPS',
}

// Format content for Discord embeds (richer than plain text)
function formatDiscordEmbed(type, content) {
  const colors = {
    'morning-briefing':  0x3B82F6, // blue
    'technical-setup':   0x10B981, // green
    'top-movers':        0xF59E0B, // amber
    'midday-update':     0x6366F1, // indigo
    'power-hour':        0xEF4444, // red
    'market-recap':      0x8B5CF6, // purple
    'afterhours-movers': 0xF97316, // orange
    'weekend-watchlist':  0x06B6D4, // cyan
  }

  const titles = {
    'morning-briefing':  '☀️ Morning Market Briefing',
    'technical-setup':   '📊 Technical Setup Alert',
    'top-movers':        '🔥 Top Movers',
    'midday-update':     '📈 Midday Market Pulse',
    'power-hour':        '⚡ Power Hour Alert',
    'market-recap':      '📋 Market Recap',
    'afterhours-movers': '🌙 After Hours Movers',
    'weekend-watchlist':  '🎯 Weekend Watchlist',
  }

  // Build description from content
  let description = ''
  if (Array.isArray(content)) {
    description = content.map(t => typeof t === 'string' ? t : t.text || JSON.stringify(t)).join('\n\n')
  } else if (content.tweet) {
    description = content.tweet
    if (content.thread) {
      description += '\n\n' + content.thread.join('\n\n')
    }
  } else {
    description = JSON.stringify(content)
  }

  // Technical setup gets extra fields
  const fields = []
  if (type === 'technical-setup' && content.entry) {
    fields.push(
      { name: 'Ticker', value: `\`${content.ticker}\``, inline: true },
      { name: 'Pattern', value: content.pattern || 'N/A', inline: true },
      { name: 'Timeframe', value: content.timeframe || 'Daily', inline: true },
      { name: 'Entry', value: `$${content.entry}`, inline: true },
      { name: 'Stop', value: `$${content.stop}`, inline: true },
      { name: 'Target', value: `$${content.target}`, inline: true },
      { name: 'R:R', value: content.rr_ratio || 'N/A', inline: true },
    )
    if (content.chartUrl) {
      description += `\n\n[View Chart](${content.chartUrl})`
    }
  }

  return {
    embeds: [{
      title: titles[type] || '📊 Stratify Alert',
      description: description.slice(0, 4096), // Discord limit
      color: colors[type] || 0x3B82F6,
      fields: fields.length > 0 ? fields : undefined,
      footer: {
        text: 'Stratify — Strategic Intelligence. Optimized Data.',
        icon_url: 'https://stratifymarket.com/favicon.ico',
      },
      timestamp: new Date().toISOString(),
    }],
    username: 'Stratify',
    avatar_url: 'https://stratifymarket.com/favicon.ico',
  }
}

async function postToDiscord(webhookUrl, payload) {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Discord ${response.status}: ${err}`)
  }

  return { status: 'posted' }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { type } = req.query
  const content = req.body

  if (!type || !content) {
    return res.status(400).json({ error: 'Missing type or content body' })
  }

  const webhookEnvVar = CHANNEL_WEBHOOKS[type]
  if (!webhookEnvVar) {
    return res.status(400).json({ error: `No Discord channel mapped for type: ${type}` })
  }

  const webhookUrl = process.env[webhookEnvVar]
  if (!webhookUrl) {
    return res.status(200).json({
      skipped: true,
      message: `Discord webhook not configured (${webhookEnvVar}). Set it in Vercel env vars.`,
    })
  }

  try {
    const payload = formatDiscordEmbed(type, content)
    await postToDiscord(webhookUrl, payload)
    console.log(`[discord-post] Posted ${type} to Discord`)
    return res.status(200).json({ status: 'posted', type })
  } catch (err) {
    console.error(`[discord-post] Error:`, err.message)
    return res.status(500).json({ error: err.message, type })
  }
}
