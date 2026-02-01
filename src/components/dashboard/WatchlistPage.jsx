import React, { useState, useEffect } from 'react';
import { Search, Plus, X, Trash2, ChevronsLeft, ChevronsRight } from 'lucide-react';

const getMarketStatus = () => {
  const now = new Date();
  const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const hours = et.getHours();
  const minutes = et.getMinutes();
  const day = et.getDay();
  const time = hours * 60 + minutes;
  
  const marketOpen = 9 * 60 + 30;
  const marketClose = 16 * 60;
  const preMarketStart = 4 * 60;
  const afterHoursEnd = 20 * 60;
  
  if (day === 0 || day === 6) return 'closed';
  if (time >= marketOpen && time < marketClose) return 'open';
  if (time >= preMarketStart && time < marketOpen) return 'premarket';
  if (time >= marketClose && time < afterHoursEnd) return 'afterhours';
  return 'closed';
};

const DEFAULT_WATCHLIST = [
  { symbol: 'AAPL', name: 'Apple Inc.', price: 259.48, change: 1.20, changePercent: 0.46, afterHoursChange: 0.37, afterHoursPercent: 0.14 },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', price: 338.00, change: -0.25, changePercent: -0.07, afterHoursChange: -0.50, afterHoursPercent: -0.15 },
  { symbol: 'AMZN', name: 'Amazon.com, Inc.', price: 239.30, change: -2.43, changePercent: -1.01, afterHoursChange: 0.50, afterHoursPercent: 0.21 },
  { symbol: 'NVDA', name: 'NVIDIA Corporation', price: 191.13, change: -1.38, changePercent: -0.72, afterHoursChange: 0.37, afterHoursPercent: 0.19 },
  { symbol: 'META', name: 'Meta Platforms, Inc.', price: 716.50, change: -21.81, changePercent: -2.95, afterHoursChange: 1.70, afterHoursPercent: 0.24 },
  { symbol: 'TSLA', name: 'Tesla, Inc.', price: 430.41, change: 13.84, changePercent: 3.32, afterHoursChange: -1.91, afterHoursPercent: -0.44 },
  { symbol: 'QQQ', name: 'Invesco QQQ Trust', price: 621.87, change: -7.56, changePercent: -1.20, afterHoursChange: 0.23, afterHoursPercent: 0.04 },
  { symbol: 'SOFI', name: 'SoFi Technologies', price: 22.81, change: -1.55, changePercent: -6.36, afterHoursChange: 0.14, afterHoursPercent: 0.61 },
];

const ALL_STOCKS = [
  { symbol: 'AAPL', name: 'Apple Inc.', price: 259.48, change: 1.20, changePercent: 0.46 },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', price: 338.00, change: -0.25, changePercent: -0.07 },
  { symbol: 'GOOG', name: 'Alphabet Inc. Class C', price: 339.50, change: -0.30, changePercent: -0.09 },
  { symbol: 'AMZN', name: 'Amazon.com, Inc.', price: 239.30, change: -2.43, changePercent: -1.01 },
  { symbol: 'NVDA', name: 'NVIDIA Corporation', price: 191.13, change: -1.38, changePercent: -0.72 },
  { symbol: 'META', name: 'Meta Platforms, Inc.', price: 716.50, change: -21.81, changePercent: -2.95 },
  { symbol: 'TSLA', name: 'Tesla, Inc.', price: 430.41, change: 13.84, changePercent: 3.32 },
  { symbol: 'MSFT', name: 'Microsoft Corporation', price: 415.50, change: 2.35, changePercent: 0.57 },
  { symbol: 'GME', name: 'GameStop Corp.', price: 28.45, change: 1.23, changePercent: 4.52 },
  { symbol: 'AMC', name: 'AMC Entertainment', price: 4.85, change: 0.15, changePercent: 3.19 },
  { symbol: 'BB', name: 'BlackBerry Limited', price: 2.85, change: 0.08, changePercent: 2.89 },
  { symbol: 'NOK', name: 'Nokia Corporation', price: 4.12, change: 0.05, changePercent: 1.23 },
  { symbol: 'WISH', name: 'ContextLogic Inc.', price: 5.67, change: 0.23, changePercent: 4.23 },
  { symbol: 'CLOV', name: 'Clover Health', price: 1.23, change: 0.05, changePercent: 4.24 },
  { symbol: 'SPCE', name: 'Virgin Galactic', price: 1.85, change: 0.12, changePercent: 6.94 },
  { symbol: 'SOFI', name: 'SoFi Technologies', price: 22.81, change: -1.55, changePercent: -6.36 },
  { symbol: 'HOOD', name: 'Robinhood Markets', price: 18.90, change: 0.45, changePercent: 2.44 },
  { symbol: 'COIN', name: 'Coinbase Global', price: 265.30, change: 8.45, changePercent: 3.29 },
  { symbol: 'PYPL', name: 'PayPal Holdings', price: 68.90, change: 0.85, changePercent: 1.25 },
  { symbol: 'SQ', name: 'Block, Inc.', price: 78.50, change: -2.10, changePercent: -2.60 },
  { symbol: 'AFRM', name: 'Affirm Holdings', price: 56.70, change: 2.34, changePercent: 4.31 },
  { symbol: 'UPST', name: 'Upstart Holdings', price: 67.80, change: 3.45, changePercent: 5.36 },
  { symbol: 'NU', name: 'Nu Holdings', price: 14.50, change: 0.45, changePercent: 3.20 },
  { symbol: 'MARA', name: 'Marathon Digital', price: 21.30, change: 1.56, changePercent: 7.90 },
  { symbol: 'RIOT', name: 'Riot Platforms', price: 12.45, change: 0.87, changePercent: 7.51 },
  { symbol: 'MSTR', name: 'MicroStrategy', price: 478.90, change: 23.45, changePercent: 5.15 },
  { symbol: 'BITF', name: 'Bitfarms Ltd.', price: 2.34, change: 0.15, changePercent: 6.85 },
  { symbol: 'HUT', name: 'Hut 8 Mining', price: 12.45, change: 0.67, changePercent: 5.69 },
  { symbol: 'CLSK', name: 'CleanSpark Inc.', price: 18.90, change: 1.23, changePercent: 6.96 },
  { symbol: 'RIVN', name: 'Rivian Automotive', price: 14.25, change: -0.35, changePercent: -2.40 },
  { symbol: 'LCID', name: 'Lucid Group', price: 3.45, change: 0.08, changePercent: 2.37 },
  { symbol: 'NIO', name: 'NIO Inc.', price: 5.80, change: 0.12, changePercent: 2.11 },
  { symbol: 'XPEV', name: 'XPeng Inc.', price: 14.56, change: 0.45, changePercent: 3.19 },
  { symbol: 'LI', name: 'Li Auto Inc.', price: 28.90, change: 0.87, changePercent: 3.10 },
  { symbol: 'F', name: 'Ford Motor Company', price: 10.45, change: 0.12, changePercent: 1.16 },
  { symbol: 'GM', name: 'General Motors', price: 45.67, change: 0.34, changePercent: 0.75 },
  { symbol: 'RKLB', name: 'Rocket Lab USA', price: 22.45, change: 1.34, changePercent: 6.35 },
  { symbol: 'ASTS', name: 'AST SpaceMobile', price: 23.45, change: 1.67, changePercent: 7.67 },
  { symbol: 'LUNR', name: 'Intuitive Machines', price: 15.67, change: 0.89, changePercent: 6.02 },
  { symbol: 'PL', name: 'Planet Labs', price: 3.45, change: 0.12, changePercent: 3.60 },
  { symbol: 'BA', name: 'Boeing Company', price: 178.90, change: 2.34, changePercent: 1.33 },
  { symbol: 'LMT', name: 'Lockheed Martin', price: 456.70, change: 3.45, changePercent: 0.76 },
  { symbol: 'RTX', name: 'RTX Corporation', price: 112.30, change: 0.89, changePercent: 0.80 },
  { symbol: 'NOC', name: 'Northrop Grumman', price: 478.90, change: 3.45, changePercent: 0.73 },
  { symbol: 'GD', name: 'General Dynamics', price: 289.50, change: 2.34, changePercent: 0.82 },
  { symbol: 'PLTR', name: 'Palantir Technologies', price: 24.80, change: 0.65, changePercent: 2.69 },
  { symbol: 'AI', name: 'C3.ai, Inc.', price: 34.50, change: 1.23, changePercent: 3.70 },
  { symbol: 'BBAI', name: 'BigBear.ai Holdings', price: 4.56, change: 0.23, changePercent: 5.31 },
  { symbol: 'SOUN', name: 'SoundHound AI', price: 8.90, change: 0.45, changePercent: 5.33 },
  { symbol: 'IONQ', name: 'IonQ, Inc.', price: 35.60, change: 2.45, changePercent: 7.39 },
  { symbol: 'RGTI', name: 'Rigetti Computing', price: 12.34, change: 0.89, changePercent: 7.77 },
  { symbol: 'QUBT', name: 'Quantum Computing', price: 8.90, change: 0.67, changePercent: 8.14 },
  { symbol: 'QBTS', name: 'D-Wave Quantum', price: 6.78, change: 0.45, changePercent: 7.11 },
  { symbol: 'PATH', name: 'UiPath Inc.', price: 14.50, change: 0.34, changePercent: 2.40 },
  { symbol: 'AMD', name: 'Advanced Micro Devices', price: 164.25, change: 3.45, changePercent: 2.15 },
  { symbol: 'INTC', name: 'Intel Corporation', price: 31.20, change: -0.45, changePercent: -1.42 },
  { symbol: 'MU', name: 'Micron Technology', price: 98.70, change: 2.34, changePercent: 2.43 },
  { symbol: 'TSM', name: 'Taiwan Semiconductor', price: 189.70, change: 3.45, changePercent: 1.85 },
  { symbol: 'AVGO', name: 'Broadcom Inc.', price: 178.90, change: 2.34, changePercent: 1.33 },
  { symbol: 'QCOM', name: 'Qualcomm Inc.', price: 167.80, change: 1.89, changePercent: 1.14 },
  { symbol: 'MRVL', name: 'Marvell Technology', price: 89.45, change: 1.67, changePercent: 1.90 },
  { symbol: 'ASML', name: 'ASML Holding', price: 756.80, change: 12.34, changePercent: 1.66 },
  { symbol: 'LRCX', name: 'Lam Research', price: 89.70, change: 1.45, changePercent: 1.64 },
  { symbol: 'KLAC', name: 'KLA Corporation', price: 756.80, change: 8.90, changePercent: 1.19 },
  { symbol: 'AMAT', name: 'Applied Materials', price: 178.90, change: 2.34, changePercent: 1.33 },
  { symbol: 'ON', name: 'ON Semiconductor', price: 67.80, change: 1.23, changePercent: 1.85 },
  { symbol: 'SMCI', name: 'Super Micro Computer', price: 45.60, change: 2.34, changePercent: 5.41 },
  { symbol: 'ARM', name: 'Arm Holdings', price: 156.70, change: 4.56, changePercent: 3.00 },
  { symbol: 'ADBE', name: 'Adobe Inc.', price: 478.90, change: 5.67, changePercent: 1.20 },
  { symbol: 'CRM', name: 'Salesforce, Inc.', price: 289.50, change: 3.45, changePercent: 1.21 },
  { symbol: 'NOW', name: 'ServiceNow, Inc.', price: 856.70, change: 12.34, changePercent: 1.46 },
  { symbol: 'SNOW', name: 'Snowflake Inc.', price: 178.90, change: -4.56, changePercent: -2.49 },
  { symbol: 'DDOG', name: 'Datadog, Inc.', price: 132.40, change: 3.21, changePercent: 2.49 },
  { symbol: 'NET', name: 'Cloudflare, Inc.', price: 98.70, change: 2.34, changePercent: 2.43 },
  { symbol: 'CRWD', name: 'CrowdStrike Holdings', price: 345.60, change: 5.67, changePercent: 1.67 },
  { symbol: 'ZS', name: 'Zscaler, Inc.', price: 198.70, change: 4.56, changePercent: 2.35 },
  { symbol: 'MDB', name: 'MongoDB, Inc.', price: 287.60, change: 6.78, changePercent: 2.41 },
  { symbol: 'TEAM', name: 'Atlassian Corp.', price: 234.50, change: 3.45, changePercent: 1.49 },
  { symbol: 'OKTA', name: 'Okta, Inc.', price: 98.70, change: 1.23, changePercent: 1.26 },
  { symbol: 'TWLO', name: 'Twilio Inc.', price: 67.80, change: 1.45, changePercent: 2.19 },
  { symbol: 'U', name: 'Unity Software', price: 23.45, change: 0.67, changePercent: 2.94 },
  { symbol: 'RBLX', name: 'Roblox Corporation', price: 56.70, change: 1.23, changePercent: 2.22 },
  { symbol: 'SHOP', name: 'Shopify Inc.', price: 78.90, change: 2.34, changePercent: 3.06 },
  { symbol: 'PANW', name: 'Palo Alto Networks', price: 345.67, change: 5.67, changePercent: 1.67 },
  { symbol: 'ZM', name: 'Zoom Video', price: 67.89, change: 0.89, changePercent: 1.33 },
  { symbol: 'HIMS', name: 'Hims & Hers Health', price: 26.80, change: 1.45, changePercent: 5.72 },
  { symbol: 'MRNA', name: 'Moderna, Inc.', price: 45.30, change: -1.23, changePercent: -2.64 },
  { symbol: 'BNTX', name: 'BioNTech SE', price: 98.70, change: 2.34, changePercent: 2.43 },
  { symbol: 'PFE', name: 'Pfizer Inc.', price: 28.90, change: -0.34, changePercent: -1.16 },
  { symbol: 'JNJ', name: 'Johnson & Johnson', price: 156.80, change: 0.67, changePercent: 0.43 },
  { symbol: 'UNH', name: 'UnitedHealth Group', price: 534.20, change: 4.56, changePercent: 0.86 },
  { symbol: 'LLY', name: 'Eli Lilly', price: 789.50, change: 12.34, changePercent: 1.59 },
  { symbol: 'ABBV', name: 'AbbVie Inc.', price: 178.90, change: 1.23, changePercent: 0.69 },
  { symbol: 'DNA', name: 'Ginkgo Bioworks', price: 12.45, change: 0.67, changePercent: 5.68 },
  { symbol: 'CRSP', name: 'CRISPR Therapeutics', price: 56.78, change: 1.23, changePercent: 2.21 },
  { symbol: 'ENPH', name: 'Enphase Energy', price: 89.45, change: 3.21, changePercent: 3.72 },
  { symbol: 'SEDG', name: 'SolarEdge Technologies', price: 23.40, change: 0.87, changePercent: 3.86 },
  { symbol: 'FSLR', name: 'First Solar, Inc.', price: 198.70, change: 5.67, changePercent: 2.94 },
  { symbol: 'RUN', name: 'Sunrun Inc.', price: 12.34, change: 0.45, changePercent: 3.79 },
  { symbol: 'PLUG', name: 'Plug Power Inc.', price: 2.45, change: 0.12, changePercent: 5.15 },
  { symbol: 'CHPT', name: 'ChargePoint Holdings', price: 1.45, change: 0.05, changePercent: 3.57 },
  { symbol: 'BLNK', name: 'Blink Charging', price: 2.34, change: 0.08, changePercent: 3.54 },
  { symbol: 'XOM', name: 'Exxon Mobil', price: 112.34, change: -0.89, changePercent: -0.79 },
  { symbol: 'CVX', name: 'Chevron Corporation', price: 156.78, change: -1.23, changePercent: -0.78 },
  { symbol: 'ELF', name: 'e.l.f. Beauty', price: 112.45, change: 3.45, changePercent: 3.17 },
  { symbol: 'LULU', name: 'Lululemon Athletica', price: 389.70, change: 5.67, changePercent: 1.48 },
  { symbol: 'DECK', name: 'Deckers Outdoor', price: 178.90, change: 4.56, changePercent: 2.62 },
  { symbol: 'ULTA', name: 'Ulta Beauty', price: 398.70, change: -3.45, changePercent: -0.86 },
  { symbol: 'TGT', name: 'Target Corporation', price: 145.60, change: 1.23, changePercent: 0.85 },
  { symbol: 'COST', name: 'Costco Wholesale', price: 789.30, change: 5.67, changePercent: 0.72 },
  { symbol: 'WMT', name: 'Walmart Inc.', price: 178.90, change: 1.23, changePercent: 0.69 },
  { symbol: 'HD', name: 'Home Depot', price: 378.90, change: 2.34, changePercent: 0.62 },
  { symbol: 'LOW', name: "Lowe's Companies", price: 256.70, change: 1.89, changePercent: 0.74 },
  { symbol: 'NKE', name: 'Nike, Inc.', price: 98.40, change: -1.23, changePercent: -1.23 },
  { symbol: 'SBUX', name: 'Starbucks Corporation', price: 98.70, change: 0.87, changePercent: 0.89 },
  { symbol: 'MCD', name: "McDonald's Corporation", price: 289.70, change: 1.45, changePercent: 0.50 },
  { symbol: 'CMG', name: 'Chipotle Mexican Grill', price: 56.70, change: 0.89, changePercent: 1.60 },
  { symbol: 'ETSY', name: 'Etsy, Inc.', price: 56.70, change: 1.23, changePercent: 2.22 },
  { symbol: 'PTON', name: 'Peloton Interactive', price: 5.67, change: 0.23, changePercent: 4.23 },
  { symbol: 'CROX', name: 'Crocs Inc.', price: 112.34, change: 2.34, changePercent: 2.13 },
  { symbol: 'NFLX', name: 'Netflix, Inc.', price: 891.50, change: 12.30, changePercent: 1.40 },
  { symbol: 'DIS', name: 'Walt Disney Company', price: 112.45, change: -1.20, changePercent: -1.06 },
  { symbol: 'SPOT', name: 'Spotify Technology', price: 456.70, change: 8.90, changePercent: 1.99 },
  { symbol: 'ROKU', name: 'Roku, Inc.', price: 65.40, change: -1.23, changePercent: -1.85 },
  { symbol: 'WBD', name: 'Warner Bros. Discovery', price: 10.45, change: 0.23, changePercent: 2.25 },
  { symbol: 'PARA', name: 'Paramount Global', price: 11.20, change: 0.15, changePercent: 1.36 },
  { symbol: 'SNAP', name: 'Snap Inc.', price: 11.23, change: -0.45, changePercent: -3.85 },
  { symbol: 'PINS', name: 'Pinterest, Inc.', price: 32.10, change: 0.87, changePercent: 2.79 },
  { symbol: 'RDDT', name: 'Reddit, Inc.', price: 156.70, change: 5.67, changePercent: 3.75 },
  { symbol: 'TTD', name: 'The Trade Desk', price: 112.30, change: 2.45, changePercent: 2.23 },
  { symbol: 'UBER', name: 'Uber Technologies', price: 78.90, change: 1.20, changePercent: 1.54 },
  { symbol: 'LYFT', name: 'Lyft, Inc.', price: 18.45, change: 0.32, changePercent: 1.77 },
  { symbol: 'ABNB', name: 'Airbnb, Inc.', price: 145.60, change: 2.34, changePercent: 1.63 },
  { symbol: 'DASH', name: 'DoorDash, Inc.', price: 178.90, change: 3.45, changePercent: 1.97 },
  { symbol: 'BABA', name: 'Alibaba Group', price: 89.45, change: 1.23, changePercent: 1.39 },
  { symbol: 'JD', name: 'JD.com, Inc.', price: 34.50, change: 0.67, changePercent: 1.98 },
  { symbol: 'PDD', name: 'PDD Holdings', price: 112.30, change: 2.34, changePercent: 2.13 },
  { symbol: 'MELI', name: 'MercadoLibre', price: 1890.50, change: 34.56, changePercent: 1.86 },
  { symbol: 'SE', name: 'Sea Limited', price: 98.70, change: 3.45, changePercent: 3.62 },
  { symbol: 'JPM', name: 'JPMorgan Chase', price: 198.70, change: 1.23, changePercent: 0.62 },
  { symbol: 'BAC', name: 'Bank of America', price: 35.40, change: 0.23, changePercent: 0.65 },
  { symbol: 'WFC', name: 'Wells Fargo', price: 56.70, change: 0.45, changePercent: 0.80 },
  { symbol: 'GS', name: 'Goldman Sachs', price: 478.90, change: 5.67, changePercent: 1.20 },
  { symbol: 'MS', name: 'Morgan Stanley', price: 98.70, change: 0.89, changePercent: 0.91 },
  { symbol: 'C', name: 'Citigroup Inc.', price: 67.80, change: 0.45, changePercent: 0.67 },
  { symbol: 'SCHW', name: 'Charles Schwab', price: 78.90, change: 0.67, changePercent: 0.86 },
  { symbol: 'V', name: 'Visa Inc.', price: 278.90, change: 2.34, changePercent: 0.85 },
  { symbol: 'MA', name: 'Mastercard Inc.', price: 456.70, change: 3.45, changePercent: 0.76 },
  { symbol: 'AXP', name: 'American Express', price: 234.56, change: 1.89, changePercent: 0.81 },
  { symbol: 'BRK.B', name: 'Berkshire Hathaway B', price: 456.78, change: 2.34, changePercent: 0.51 },
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF', price: 502.34, change: 1.23, changePercent: 0.25 },
  { symbol: 'QQQ', name: 'Invesco QQQ Trust', price: 621.87, change: -7.56, changePercent: -1.20 },
  { symbol: 'DIA', name: 'SPDR Dow Jones ETF', price: 389.12, change: -0.87, changePercent: -0.22 },
  { symbol: 'IWM', name: 'iShares Russell 2000', price: 198.45, change: 1.23, changePercent: 0.62 },
  { symbol: 'VOO', name: 'Vanguard S&P 500', price: 465.30, change: 2.10, changePercent: 0.45 },
  { symbol: 'VTI', name: 'Vanguard Total Stock', price: 245.60, change: 1.45, changePercent: 0.59 },
  { symbol: 'ARKK', name: 'ARK Innovation ETF', price: 48.90, change: 1.23, changePercent: 2.58 },
  { symbol: 'ARKG', name: 'ARK Genomic ETF', price: 34.50, change: 0.67, changePercent: 1.98 },
  { symbol: 'SOXL', name: 'Direxion Semi Bull 3X', price: 34.50, change: 1.89, changePercent: 5.79 },
  { symbol: 'TQQQ', name: 'ProShares UltraPro QQQ', price: 67.80, change: 2.34, changePercent: 3.57 },
  { symbol: 'SQQQ', name: 'ProShares Short QQQ 3X', price: 8.90, change: -0.34, changePercent: -3.68 },
  { symbol: 'XLF', name: 'Financial Select SPDR', price: 42.30, change: 0.34, changePercent: 0.81 },
  { symbol: 'XLK', name: 'Technology Select SPDR', price: 198.70, change: 1.87, changePercent: 0.95 },
  { symbol: 'XLE', name: 'Energy Select SPDR', price: 89.45, change: -0.67, changePercent: -0.74 },
  { symbol: 'XLV', name: 'Health Care Select SPDR', price: 145.30, change: 0.45, changePercent: 0.31 },
  { symbol: 'GLD', name: 'SPDR Gold Trust', price: 189.30, change: 0.87, changePercent: 0.46 },
  { symbol: 'SLV', name: 'iShares Silver Trust', price: 21.45, change: 0.32, changePercent: 1.51 },
  { symbol: 'TLT', name: 'iShares 20+ Year Treasury', price: 89.45, change: 0.23, changePercent: 0.26 },
  { symbol: 'EEM', name: 'iShares Emerging Markets', price: 42.34, change: 0.34, changePercent: 0.81 },
  { symbol: 'BTC', name: 'Bitcoin', price: 97543.21, change: 2345.67, changePercent: 2.46 },
  { symbol: 'ETH', name: 'Ethereum', price: 3245.89, change: -45.23, changePercent: -1.37 },
  { symbol: 'SOL', name: 'Solana', price: 178.34, change: 12.45, changePercent: 7.51 },
  { symbol: 'XRP', name: 'XRP', price: 2.34, change: 0.12, changePercent: 5.41 },
  { symbol: 'DOGE', name: 'Dogecoin', price: 0.32, change: 0.02, changePercent: 6.67 },
  { symbol: 'ADA', name: 'Cardano', price: 0.89, change: 0.05, changePercent: 5.95 },
  { symbol: 'AVAX', name: 'Avalanche', price: 35.67, change: 2.34, changePercent: 7.02 },
  { symbol: 'LINK', name: 'Chainlink', price: 18.90, change: 0.78, changePercent: 4.31 },
  { symbol: 'DOT', name: 'Polkadot', price: 7.45, change: 0.34, changePercent: 4.78 },
  { symbol: 'SHIB', name: 'Shiba Inu', price: 0.000023, change: 0.000001, changePercent: 4.55 },
  { symbol: 'MATIC', name: 'Polygon', price: 0.56, change: 0.03, changePercent: 5.66 },
  { symbol: 'LTC', name: 'Litecoin', price: 89.45, change: 2.34, changePercent: 2.69 },
  { symbol: 'NEAR', name: 'NEAR Protocol', price: 5.45, change: 0.34, changePercent: 6.65 },
  { symbol: 'APT', name: 'Aptos', price: 8.90, change: 0.45, changePercent: 5.33 },
  { symbol: 'SUI', name: 'Sui', price: 3.45, change: 0.23, changePercent: 7.14 },
  { symbol: 'PEPE', name: 'Pepe', price: 0.0000089, change: 0.0000005, changePercent: 5.95 },
  { symbol: 'WIF', name: 'dogwifhat', price: 1.89, change: 0.12, changePercent: 6.78 },
  { symbol: 'BONK', name: 'Bonk', price: 0.000023, change: 0.000002, changePercent: 9.52 },
];

const WatchlistPage = () => {
  const [selectedTicker, setSelectedTicker] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [marketStatus, setMarketStatus] = useState(getMarketStatus());
  const [watchlistStocks, setWatchlistStocks] = useState(DEFAULT_WATCHLIST);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setMarketStatus(getMarketStatus());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const query = searchQuery.toLowerCase();
    const watchlistSymbols = watchlistStocks.map(s => s.symbol);
    
    const results = ALL_STOCKS.filter(stock => 
      !watchlistSymbols.includes(stock.symbol) &&
      (stock.symbol.toLowerCase().includes(query) || 
       stock.name.toLowerCase().includes(query))
    ).slice(0, 10);

    setSearchResults(results);
  }, [searchQuery, watchlistStocks]);

  const handleAddStock = (stock) => {
    const exists = watchlistStocks.some(s => s.symbol === stock.symbol);
    if (exists) {
      setSearchQuery('');
      setSearchResults([]);
      return;
    }
    
    const newStock = { 
      ...stock, 
      afterHoursChange: (Math.random() * 2 - 1).toFixed(2) * 1, 
      afterHoursPercent: (Math.random() * 0.5 - 0.25).toFixed(2) * 1
    };
    
    setWatchlistStocks([...watchlistStocks, newStock]);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleRemoveStock = (symbolToRemove, e) => {
    e.stopPropagation();
    e.preventDefault();
    setWatchlistStocks(watchlistStocks.filter(s => s.symbol !== symbolToRemove));
  };

  const handleTickerClick = (symbol) => {
    setSelectedTicker(symbol);
  };

  const handleCloseChart = () => {
    setSelectedTicker(null);
  };

  const formatPrice = (price) => {
    if (!price) return '0.00';
    if (price >= 1000) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (price < 0.01) return price.toFixed(6);
    if (price < 1) return price.toFixed(4);
    return price.toFixed(2);
  };

  const showExtendedHours = marketStatus === 'afterhours' || marketStatus === 'premarket' || marketStatus === 'closed';
  const extendedLabel = marketStatus === 'premarket' ? 'Pre' : 'After';

  // Custom scrollbar-hide style
  const scrollHideStyle = {
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
  };

  return (
    <div className="flex-1 flex h-full bg-[#060d18] overflow-hidden">
      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      
      {/* Watchlist Panel */}
      <div className={`flex flex-col border-r border-gray-800 transition-all duration-300 ${
        isCollapsed ? 'w-20' : selectedTicker ? 'w-80' : 'flex-1 max-w-2xl'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-gray-800">
          {!isCollapsed ? (
            <div className="flex-1">
              <h1 className="font-semibold text-white text-lg">Watchlist</h1>
              <span className={`text-xs px-2 py-0.5 rounded inline-block mt-1 ${
                marketStatus === 'open' ? 'bg-emerald-500/20 text-emerald-400' :
                marketStatus === 'premarket' ? 'bg-blue-500/20 text-blue-400' :
                marketStatus === 'afterhours' ? 'bg-purple-500/20 text-purple-400' :
                'bg-gray-500/20 text-gray-400'
              }`}>
                {marketStatus === 'open' ? 'Open' :
                 marketStatus === 'premarket' ? 'Pre' :
                 marketStatus === 'afterhours' ? 'After' :
                 'Closed'}
              </span>
            </div>
          ) : (
            <div className="flex-1" />
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 hover:bg-gray-700/50 rounded-lg transition-colors text-gray-400 hover:text-white"
            title={isCollapsed ? 'Expand watchlist' : 'Collapse watchlist'}
          >
            {isCollapsed ? (
              <ChevronsRight className="w-4 h-4" strokeWidth={1.5} />
            ) : (
              <ChevronsLeft className="w-4 h-4" strokeWidth={1.5} />
            )}
          </button>
        </div>

        {/* Search - Hidden when collapsed */}
        {!isCollapsed && (
          <div className="p-3 border-b border-gray-800 bg-[#0a1628] relative">
            <div className="flex items-center gap-2 bg-[#060d18] border border-gray-700 rounded-lg px-3 py-2">
              <Search className="w-4 h-4 text-gray-500" strokeWidth={1.5} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search symbol or company..."
                className="flex-1 bg-transparent text-white placeholder-gray-500 text-sm outline-none"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="text-gray-500 hover:text-white">
                  <X className="w-4 h-4" strokeWidth={1.5} />
                </button>
              )}
            </div>

            {/* Search Results Dropdown */}
            {searchQuery && searchResults.length > 0 && (
              <div 
                className="absolute left-3 right-3 top-full mt-1 bg-[#0d1829] border border-gray-700 rounded-lg overflow-hidden shadow-xl z-50 max-h-80 overflow-y-auto scrollbar-hide"
                style={scrollHideStyle}
              >
                {searchResults.map((stock) => (
                  <div 
                    key={stock.symbol}
                    className="flex items-center justify-between px-3 py-3 hover:bg-purple-500/20 cursor-pointer transition-colors border-b border-gray-800/50 last:border-0"
                    onClick={() => handleAddStock(stock)}
                  >
                    <div className="flex-1">
                      <span className="text-white font-semibold">{stock.symbol}</span>
                      <span className="text-gray-400 text-sm ml-2">{stock.name}</span>
                    </div>
                    <Plus className="w-5 h-5 text-purple-400" strokeWidth={2} />
                  </div>
                ))}
              </div>
            )}
            
            {searchQuery && searchResults.length === 0 && (
              <div className="absolute left-3 right-3 top-full mt-1 bg-[#0d1829] border border-gray-700 rounded-lg overflow-hidden shadow-xl z-50">
                <div className="px-4 py-6 text-center text-gray-400 text-sm">
                  No results for "{searchQuery}"
                </div>
              </div>
            )}
          </div>
        )}

        {/* Stock List - Hidden scrollbar */}
        <div 
          className="flex-1 overflow-auto scrollbar-hide"
          style={scrollHideStyle}
        >
          {watchlistStocks.map((stock) => {
            const isPositive = (stock.change || 0) >= 0;
            const isAfterHoursPositive = (stock.afterHoursChange || 0) >= 0;
            const isSelected = selectedTicker === stock.symbol;
            
            return (
              <div 
                key={stock.symbol}
                className={`flex items-center justify-between cursor-pointer transition-colors border-b border-gray-800/50 ${
                  isSelected ? 'bg-purple-500/20' : 'hover:bg-[#0d1829]'
                } ${isCollapsed ? 'px-2 py-3' : 'px-3 py-2.5'}`}
                onClick={() => handleTickerClick(stock.symbol)}
              >
                {isCollapsed ? (
                  // Collapsed view - WHITE ticker + colored % change only
                  <div className="w-full text-center">
                    <div className="text-white text-xs font-semibold">
                      {stock.symbol}
                    </div>
                    <div className={`text-[10px] font-medium mt-0.5 ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                      {isPositive ? '+' : ''}{(stock.changePercent || 0).toFixed(2)}%
                    </div>
                  </div>
                ) : (
                  // Expanded view
                  <>
                    {/* Left: Symbol & Name */}
                    <div className="flex-1 min-w-0 pr-4">
                      <div className="text-white font-semibold text-base">{stock.symbol}</div>
                      <div className="text-gray-500 text-sm truncate">{stock.name}</div>
                    </div>

                    {/* Right: Price & Changes */}
                    <div className="text-right flex-shrink-0 mr-3">
                      <div className="text-white font-semibold text-base font-mono">
                        ${formatPrice(stock.price)}
                      </div>
                      
                      <div className={`text-sm font-medium ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                        {isPositive ? '+' : ''}{(stock.change || 0).toFixed(2)} ({isPositive ? '+' : ''}{(stock.changePercent || 0).toFixed(2)}%)
                      </div>
                      
                      {showExtendedHours && stock.afterHoursChange !== undefined && (
                        <div className={`text-xs mt-0.5 ${isAfterHoursPositive ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
                          <span className="text-gray-500">{extendedLabel}:</span>{' '}
                          {isAfterHoursPositive ? '+' : ''}{(stock.afterHoursChange || 0).toFixed(2)} ({isAfterHoursPositive ? '+' : ''}{(stock.afterHoursPercent || 0).toFixed(2)}%)
                        </div>
                      )}
                    </div>

                    {/* Delete Button */}
                    <button 
                      onClick={(e) => handleRemoveStock(stock.symbol, e)}
                      className="p-2 hover:bg-red-500/20 rounded-lg transition-colors text-gray-500 hover:text-red-400"
                      title="Remove from watchlist"
                    >
                      <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        {!isCollapsed && (
          <div className="p-3 border-t border-gray-800 flex items-center justify-between text-xs">
            <span className="text-gray-400">{watchlistStocks.length} symbols</span>
            <div className="flex items-center gap-3">
              <span className="text-emerald-400">{watchlistStocks.filter(s => (s.change || 0) >= 0).length} ↑</span>
              <span className="text-red-400">{watchlistStocks.filter(s => (s.change || 0) < 0).length} ↓</span>
            </div>
          </div>
        )}
      </div>

      {/* TradingView Chart Panel */}
      {selectedTicker && (
        <div className="flex-1 flex flex-col bg-[#060d18] min-w-0">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 flex-shrink-0">
            <div className="flex items-center gap-3">
              <h2 className="text-white font-semibold text-lg">{selectedTicker}</h2>
              <span className="text-gray-400 text-sm">
                {watchlistStocks.find(s => s.symbol === selectedTicker)?.name}
              </span>
            </div>
            <button 
              onClick={handleCloseChart}
              className="p-2 hover:bg-red-500/20 rounded-lg transition-colors text-gray-400 hover:text-red-400"
            >
              <X className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>

          <div className="flex-1 min-h-0">
            <iframe
              key={selectedTicker}
              src={`https://s.tradingview.com/widgetembed/?frameElementId=tradingview_widget&symbol=${selectedTicker}&interval=D&hidesidetoolbar=0&symboledit=1&saveimage=0&toolbarbg=f1f3f6&studies=[]&theme=dark&style=1&timezone=America%2FNew_York&withdateranges=1&showpopupbutton=0&studies_overrides={}&overrides={}&enabled_features=[]&disabled_features=[]&locale=en`}
              style={{ width: '100%', height: '100%', border: 'none' }}
              allowFullScreen
            />
          </div>
        </div>
      )}

      {!selectedTicker && (
        <div className="flex-1 flex items-center justify-center bg-[#060d18]">
          <div className="text-center text-gray-500">
            <p className="text-lg">Select a ticker to view chart</p>
            <p className="text-sm mt-1">Click any symbol from your watchlist</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default WatchlistPage;
