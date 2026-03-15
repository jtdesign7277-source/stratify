/**
 * /api/claude-signal — Claude AI signal analysis for Arb Engine
 * Analyzes BTC price + Polymarket spread to produce Bayesian-style signal
 * Returns: { bayesian, edge, spread, stoikov, mc, signal }
 */

import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { btcPrice, bid, ask, polymarkets, accountBalance } = req.body || {};

  if (!btcPrice) {
    return res.status(400).json({ error: 'btcPrice required' });
  }

  const balance = accountBalance || 2000000;
  const spreadBps = bid && ask ? ((ask - bid) / btcPrice) * 10000 : null;

  try {
    // Build market context for Claude
    const polyContext = (polymarkets || []).slice(0, 5).map(m =>
      `- "${m.question}" YES=${m.yesPrice} NO=${m.noPrice} pSum=${m.pSum} spread=${m.spread}`
    ).join('\n');

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 600,
      system: [{
        type: 'text',
        text: `You are a quantitative trading signal engine. Analyze BTC market data and output a JSON signal assessment. Be concise and precise. Output ONLY valid JSON, no markdown.`,
        cache_control: { type: 'ephemeral' },
      }],
      messages: [{
        role: 'user',
        content: `BTC spot: $${btcPrice}${bid ? ` bid: $${bid} ask: $${ask} spread: ${spreadBps?.toFixed(1)}bps` : ''}
Account balance: $${balance.toLocaleString()}

${polyContext ? `Polymarket BTC markets:\n${polyContext}` : 'No Polymarket data available'}

Produce a JSON object with these fields:
{
  "prior": <float 0.3-0.7, base probability of BTC up next 5min>,
  "posterior": <float, updated probability after market data>,
  "ev": <float, expected value in dollars>,
  "confidence": <float 0-100>,
  "edgeNet": <float, net edge after costs>,
  "signal": "LONG" | "SHORT" | "HOLD",
  "reason": <string, one-line reason>,
  "kellyF": <float 0-0.25, Kelly fraction>,
  "riskDollars": <float, suggested position size in dollars>
}`,
      }],
    });

    const text = response.content[0]?.text || '{}';
    let signal;
    try {
      // Strip any markdown code fences
      const cleaned = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      signal = JSON.parse(cleaned);
    } catch {
      signal = { prior: 0.5, posterior: 0.5, ev: 0, confidence: 50, edgeNet: 0, signal: 'HOLD', reason: 'parse error', kellyF: 0, riskDollars: 0 };
    }

    // Compute derived Bayesian/edge/spread/stoikov/mc values for the engine display
    const prior = signal.prior || 0.5;
    const post = signal.posterior || 0.5;
    const evCalc = (post - prior) * btcPrice * 0.01;
    const cost = spreadBps ? spreadBps / 10000 * btcPrice * 0.01 : 0.015;
    const net = evCalc - cost;

    // Stoikov reservation price
    const midPrice = bid && ask ? (bid + ask) / 2 : btcPrice;
    const gamma = 0.01 + Math.random() * 0.04;
    const sigma2 = spreadBps ? spreadBps * 10 : 200;
    const q = signal.signal === 'LONG' ? 1 : signal.signal === 'SHORT' ? -1 : 0;
    const reservation = midPrice - q * gamma * sigma2;

    // Monte Carlo summary
    const kellyF = signal.kellyF || 0;
    const maxDdEst = kellyF * 3.5; // rough MC DD estimate

    return res.status(200).json({
      bayesian: {
        prior: +prior.toFixed(3),
        post: +post.toFixed(3),
        ev: +evCalc.toFixed(2),
        conf: +(signal.confidence || 50).toFixed(1),
        loss: +(Math.abs(post - prior) * 0.1).toFixed(4),
      },
      edge: {
        ev: +evCalc.toFixed(4),
        cost: +cost.toFixed(4),
        net: +net.toFixed(4),
        pass: net > 0,
      },
      spread: {
        z: spreadBps ? +((spreadBps - 5) / 2).toFixed(2) : 0,
        pSum: polymarkets?.length > 0
          ? +(polymarkets[0].pSum || 0.96).toFixed(4)
          : 0.96,
      },
      stoikov: {
        r: +reservation.toFixed(0),
        q: +q.toFixed(1),
        gamma: +gamma.toFixed(2),
        s2: +sigma2.toFixed(0),
      },
      mc: {
        dd: +maxDdEst.toFixed(1),
        fStar: +kellyF.toFixed(2),
        f: +(kellyF * 0.8).toFixed(2),
      },
      signal: {
        action: signal.signal || 'HOLD',
        reason: signal.reason || '',
        confidence: signal.confidence || 50,
        riskDollars: signal.riskDollars || 0,
      },
      ts: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[claude-signal] error:', err.message);
    return res.status(500).json({ error: 'Signal analysis failed', detail: err.message });
  }
}
