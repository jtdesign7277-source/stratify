import express from 'express';
import { runBacktest } from '../services/backtestEngine.js';

const router = express.Router();

const GROK_URL = 'https://api.x.ai/v1/chat/completions';

const SYSTEM_PROMPT =
  'Return ONLY a JSON object with fields name, description, entryCondition, exitCondition, params (rsiPeriod, rsiBuyThreshold, rsiSellThreshold, smaPeriod, emaPeriod, stopLossPercent, takeProfitPercent, positionSizePercent), and logic (step-by-step).';

const toNumber = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
};

const normalizeParams = (params) => {
  const source = params && typeof params === 'object' && !Array.isArray(params) ? params : {};
  const rsiBuyThreshold = toNumber(source.rsiBuyThreshold ?? source.buyThreshold);
  const rsiSellThreshold = toNumber(source.rsiSellThreshold ?? source.sellThreshold);

  return {
    rsiPeriod: toNumber(source.rsiPeriod),
    rsiBuyThreshold,
    rsiSellThreshold,
    smaPeriod: toNumber(source.smaPeriod),
    emaPeriod: toNumber(source.emaPeriod),
    stopLossPercent: toNumber(source.stopLossPercent),
    takeProfitPercent: toNumber(source.takeProfitPercent),
    positionSizePercent: toNumber(source.positionSizePercent),
    buyThreshold: rsiBuyThreshold,
    sellThreshold: rsiSellThreshold,
  };
};

const normalizeLogic = (logic) => {
  if (Array.isArray(logic)) return logic.filter(Boolean);
  if (typeof logic === 'string' && logic.trim()) return [logic.trim()];
  return [];
};

const extractJsonObject = (raw = '') => {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  const candidates = [trimmed];

  const fenceRegex = /```(?:json)?\s*([\s\S]*?)```/gi;
  let match;
  while ((match = fenceRegex.exec(trimmed)) !== null) {
    if (match[1]) candidates.push(match[1].trim());
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    candidates.push(trimmed.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch {
      // ignore parse errors
    }
  }

  return null;
};

router.post('/generate-and-backtest', async (req, res) => {
  const { ticker, type, indicator, timeframe, period, description } = req.body || {};
  const apiKey = process.env.XAI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'XAI_API_KEY not configured' });
  }

  try {
    const requestBody = {
      model: 'grok-3',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: JSON.stringify({
            ticker,
            type,
            indicator,
            timeframe,
            period,
            description,
          }),
        },
      ],
      temperature: 0.3,
      max_tokens: 800,
    };

    const grokResponse = await fetch(GROK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!grokResponse.ok) {
      const errText = await grokResponse.text();
      return res.status(500).json({ error: `Grok API error: ${errText}` });
    }

    const grokData = await grokResponse.json();
    const rawContent = grokData?.choices?.[0]?.message?.content?.trim() || '';
    const parsed = extractJsonObject(rawContent);

    if (!parsed) {
      return res.status(500).json({ error: 'Invalid JSON from Grok' });
    }

    const params = normalizeParams(parsed.params);
    const strategy = {
      ticker,
      type,
      indicator,
      timeframe,
      period,
      description: parsed.description ?? description ?? null,
      name: parsed.name ?? null,
      entryCondition: parsed.entryCondition ?? null,
      exitCondition: parsed.exitCondition ?? null,
      params,
      logic: normalizeLogic(parsed.logic),
    };

    let backtest;
    try {
      backtest = await runBacktest(strategy);
    } catch (error) {
      return res.status(200).json({ strategy, backtestError: error.message });
    }

    const totalTrades = Number.isFinite(backtest?.summary?.totalTrades)
      ? backtest.summary.totalTrades
      : Array.isArray(backtest?.trades)
        ? backtest.trades.length
        : 0;

    if (backtest?.summary && totalTrades === 0) {
      backtest.summary = {
        ...backtest.summary,
        warning: 'No trades were generated for this backtest period.',
      };
    }

    return res.json({ strategy, backtest });
  } catch (error) {
    console.error('Strategy generation error:', error);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
