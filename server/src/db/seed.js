import { pool } from './index.js';

const templates = [
  {
    id: 'featured-super-bowl-2026',
    name: 'Super Bowl Stocks 2026',
    category: 'Featured',
    description:
      'Targets brands with heavy Super Bowl ad spend and streaming exposure. Rotates into DIS, GOOGL, META, NFLX, and BUD leading into game week.',
    metrics: { winRate: '64%', avgReturn: '+8.3%', risk: 'Medium' },
    tags: ['DIS', 'GOOGL', 'META', 'NFLX', 'BUD'],
    featured: true,
  },
  {
    id: 'rsi-momentum',
    name: 'RSI Momentum',
    category: 'Momentum',
    description:
      'Buys oversold pullbacks and fades overbought spikes using RSI thresholds with volume confirmation.',
    metrics: { winRate: '58%', avgReturn: '+3.1%', risk: 'Medium' },
  },
  {
    id: 'macd-crossover',
    name: 'MACD Crossover',
    category: 'Trend Following',
    description:
      'Captures trend shifts with MACD signal crossovers and adaptive stop placement for momentum regimes.',
    metrics: { winRate: '55%', avgReturn: '+4.6%', risk: 'Medium' },
  },
  {
    id: 'gap-fill',
    name: 'Gap Fill Strategy',
    category: 'Mean Reversion',
    description:
      'Fades large overnight gaps in liquid equities once early volume confirms a mean-reversion setup.',
    metrics: { winRate: '61%', avgReturn: '+2.4%', risk: 'Low' },
  },
  {
    id: 'bollinger-squeeze',
    name: 'Bollinger Squeeze',
    category: 'Momentum',
    description:
      'Waits for volatility compression then enters on breakout confirmation with ATR-based targets.',
    metrics: { winRate: '52%', avgReturn: '+6.8%', risk: 'High' },
  },
  {
    id: 'mean-reversion-spy',
    name: 'Mean Reversion SPY',
    category: 'Mean Reversion',
    description:
      'Reverts SPY to its 20-day mean using intraday z-score extremes and time-based exits.',
    metrics: { winRate: '66%', avgReturn: '+1.9%', risk: 'Low' },
  },
  {
    id: 'earnings-momentum',
    name: 'Earnings Momentum',
    category: 'Event-Based',
    description:
      'Plays post-earnings drift by riding strong guidance surprises with tight volatility filters.',
    metrics: { winRate: '57%', avgReturn: '+5.4%', risk: 'Medium' },
  },
  {
    id: 'friday-spy-calls',
    name: 'Friday SPY Calls',
    category: 'Event-Based',
    description:
      'If markets bleed all week, buys Friday EOD SPY calls for a mean-reverting squeeze into close.',
    metrics: { winRate: '49%', avgReturn: '+7.2%', risk: 'High' },
  },
  {
    id: 'liquidity-scalp',
    name: 'Liquidity Scalper',
    category: 'Scalping',
    description:
      'Hits short-term liquidity pockets with tight spreads, fast exits, and depth-of-book confirmations.',
    metrics: { winRate: '63%', avgReturn: '+0.9%', risk: 'Medium' },
  },
];

const jsonOrNull = (value) => (value === undefined || value === null ? null : JSON.stringify(value));

const insertTemplate = async (template) => {
  const keyMetrics = template.metrics
    ? { winRate: template.metrics.winRate, avgReturn: template.metrics.avgReturn }
    : null;

  const values = [
    template.id,
    template.name,
    template.category,
    template.description,
    template.tagline ?? null,
    template.metrics?.risk ?? null,
    template.timeframe ?? null,
    jsonOrNull(template.best_for ?? []),
    jsonOrNull(keyMetrics),
    jsonOrNull(template.entry_rules ?? []),
    jsonOrNull(template.exit_rules ?? []),
    jsonOrNull(template.metrics ?? null),
    jsonOrNull(template.tags ?? []),
    template.featured ?? false,
  ];

  const insertSql = `
    INSERT INTO strategy_templates (
      id,
      name,
      category,
      description,
      tagline,
      risk_level,
      timeframe,
      best_for,
      key_metrics,
      entry_rules,
      exit_rules,
      stats,
      tags,
      featured,
      created_at,
      updated_at
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      $7,
      $8::jsonb,
      $9::jsonb,
      $10::jsonb,
      $11::jsonb,
      $12::jsonb,
      $13::jsonb,
      $14,
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      category = EXCLUDED.category,
      description = EXCLUDED.description,
      tagline = EXCLUDED.tagline,
      risk_level = EXCLUDED.risk_level,
      timeframe = EXCLUDED.timeframe,
      best_for = EXCLUDED.best_for,
      key_metrics = EXCLUDED.key_metrics,
      entry_rules = EXCLUDED.entry_rules,
      exit_rules = EXCLUDED.exit_rules,
      stats = EXCLUDED.stats,
      tags = EXCLUDED.tags,
      featured = EXCLUDED.featured,
      updated_at = NOW();
  `;

  await pool.query(insertSql, values);
};

const run = async () => {
  for (const template of templates) {
    await insertTemplate(template);
  }

  await pool.end();
  console.log(`Seeded ${templates.length} strategy templates.`);
};

run().catch((error) => {
  console.error('Database seed failed:', error);
  process.exitCode = 1;
});
