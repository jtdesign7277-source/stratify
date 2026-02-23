-- X-Ray Fundamentals cache schema

CREATE TABLE IF NOT EXISTS xray_income_statement (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol TEXT NOT NULL,
  period TEXT NOT NULL CHECK (period IN ('annual', 'quarterly')),
  fiscal_date TEXT NOT NULL,
  total_revenue BIGINT,
  cost_of_revenue BIGINT,
  gross_profit BIGINT,
  research_development BIGINT,
  selling_general_admin BIGINT,
  operating_expenses BIGINT,
  operating_income BIGINT,
  interest_expense BIGINT,
  income_before_tax BIGINT,
  income_tax_expense BIGINT,
  net_income BIGINT,
  eps NUMERIC(10,4),
  eps_diluted NUMERIC(10,4),
  shares_outstanding BIGINT,
  gross_margin NUMERIC(6,2),
  operating_margin NUMERIC(6,2),
  net_margin NUMERIC(6,2),
  raw_json JSONB,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(symbol, period, fiscal_date)
);

CREATE TABLE IF NOT EXISTS xray_balance_sheet (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol TEXT NOT NULL,
  period TEXT NOT NULL CHECK (period IN ('annual', 'quarterly')),
  fiscal_date TEXT NOT NULL,
  total_assets BIGINT,
  current_assets BIGINT,
  cash_and_equivalents BIGINT,
  short_term_investments BIGINT,
  accounts_receivable BIGINT,
  inventory BIGINT,
  non_current_assets BIGINT,
  property_plant_equipment BIGINT,
  goodwill BIGINT,
  intangible_assets BIGINT,
  total_liabilities BIGINT,
  current_liabilities BIGINT,
  accounts_payable BIGINT,
  short_term_debt BIGINT,
  non_current_liabilities BIGINT,
  long_term_debt BIGINT,
  total_equity BIGINT,
  retained_earnings BIGINT,
  raw_json JSONB,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(symbol, period, fiscal_date)
);

CREATE TABLE IF NOT EXISTS xray_cash_flow (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol TEXT NOT NULL,
  period TEXT NOT NULL CHECK (period IN ('annual', 'quarterly')),
  fiscal_date TEXT NOT NULL,
  operating_cash_flow BIGINT,
  investing_cash_flow BIGINT,
  financing_cash_flow BIGINT,
  capital_expenditure BIGINT,
  free_cash_flow BIGINT,
  dividends_paid BIGINT,
  share_repurchase BIGINT,
  debt_repayment BIGINT,
  net_change_in_cash BIGINT,
  raw_json JSONB,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(symbol, period, fiscal_date)
);

CREATE TABLE IF NOT EXISTS xray_statistics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol TEXT NOT NULL UNIQUE,
  market_cap BIGINT,
  enterprise_value BIGINT,
  pe_ratio NUMERIC(10,2),
  forward_pe NUMERIC(10,2),
  peg_ratio NUMERIC(10,4),
  price_to_sales NUMERIC(10,2),
  price_to_book NUMERIC(10,2),
  ev_to_ebitda NUMERIC(10,2),
  ev_to_revenue NUMERIC(10,2),
  profit_margin NUMERIC(8,4),
  operating_margin NUMERIC(8,4),
  return_on_equity NUMERIC(8,4),
  return_on_assets NUMERIC(8,4),
  revenue_growth NUMERIC(8,4),
  earnings_growth NUMERIC(8,4),
  current_ratio NUMERIC(8,4),
  debt_to_equity NUMERIC(8,4),
  dividend_yield NUMERIC(8,4),
  payout_ratio NUMERIC(8,4),
  beta NUMERIC(6,4),
  fifty_two_week_high NUMERIC(12,2),
  fifty_two_week_low NUMERIC(12,2),
  fifty_day_ma NUMERIC(12,2),
  two_hundred_day_ma NUMERIC(12,2),
  shares_outstanding BIGINT,
  float_shares BIGINT,
  raw_json JSONB,
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS xray_quotes (
  symbol TEXT PRIMARY KEY,
  price NUMERIC(12,2),
  change NUMERIC(12,2),
  change_percent NUMERIC(8,4),
  volume BIGINT,
  open NUMERIC(12,2),
  high NUMERIC(12,2),
  low NUMERIC(12,2),
  previous_close NUMERIC(12,2),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS xray_revenue_segments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol TEXT NOT NULL,
  period TEXT NOT NULL,
  fiscal_date TEXT NOT NULL,
  segment_name TEXT NOT NULL,
  revenue BIGINT,
  UNIQUE(symbol, period, fiscal_date, segment_name)
);

CREATE INDEX IF NOT EXISTS idx_income_symbol ON xray_income_statement(symbol, period);
CREATE INDEX IF NOT EXISTS idx_balance_symbol ON xray_balance_sheet(symbol, period);
CREATE INDEX IF NOT EXISTS idx_cashflow_symbol ON xray_cash_flow(symbol, period);
CREATE INDEX IF NOT EXISTS idx_income_date ON xray_income_statement(symbol, fiscal_date DESC);
CREATE INDEX IF NOT EXISTS idx_balance_date ON xray_balance_sheet(symbol, fiscal_date DESC);
CREATE INDEX IF NOT EXISTS idx_cashflow_date ON xray_cash_flow(symbol, fiscal_date DESC);
