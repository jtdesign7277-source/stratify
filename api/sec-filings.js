const TICKER_TO_CIK_URL = 'https://www.sec.gov/files/company_tickers.json';
const SUBMISSIONS_URL = 'https://data.sec.gov/submissions';
const USER_AGENT = 'Stratify support@stratifymarket.com';
const FILING_TYPES = new Set(['10-K', '10-Q', '8-K']);

let tickerMap = null;
let tickerMapExpiry = 0;
const TICKER_MAP_TTL = 60 * 60 * 1000; // 1 hour

async function getTickerMap() {
  if (tickerMap && Date.now() < tickerMapExpiry) return tickerMap;

  const res = await fetch(TICKER_TO_CIK_URL, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Failed to fetch ticker map: ${res.status}`);

  const data = await res.json();
  const map = {};
  for (const entry of Object.values(data)) {
    if (entry.ticker) {
      map[entry.ticker.toUpperCase()] = {
        cik: entry.cik_str,
        name: entry.title,
      };
    }
  }

  tickerMap = map;
  tickerMapExpiry = Date.now() + TICKER_MAP_TTL;
  return map;
}

function padCik(cik) {
  return String(cik).padStart(10, '0');
}

function buildFilingUrl(accessionNumber, primaryDocument) {
  const clean = accessionNumber.replace(/-/g, '');
  return `https://www.sec.gov/Archives/edgar/data/${clean.slice(0, 10)}/${accessionNumber}/${primaryDocument}`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const symbol = String(req.query.symbol || '').trim().toUpperCase();
  if (!symbol) return res.status(400).json({ error: 'Missing symbol' });

  const limit = Math.min(Number(req.query.limit) || 15, 50);

  try {
    const map = await getTickerMap();
    const company = map[symbol];
    if (!company) {
      return res.status(404).json({ error: `Ticker ${symbol} not found in SEC database` });
    }

    const cik = padCik(company.cik);
    const subRes = await fetch(`${SUBMISSIONS_URL}/CIK${cik}.json`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    });

    if (!subRes.ok) {
      return res.status(502).json({ error: `SEC API error: ${subRes.status}` });
    }

    const subData = await subRes.json();
    const recent = subData?.filings?.recent || {};
    const forms = recent.form || [];
    const filingDates = recent.filingDate || [];
    const reportDates = recent.reportDate || [];
    const accessionNumbers = recent.accessionNumber || [];
    const primaryDocs = recent.primaryDocument || [];
    const descriptions = recent.primaryDocDescription || [];

    const filings = [];
    for (let i = 0; i < forms.length && filings.length < limit; i++) {
      if (!FILING_TYPES.has(forms[i])) continue;

      const accession = accessionNumbers[i];
      const primaryDoc = primaryDocs[i];
      const url = accession && primaryDoc
        ? `https://www.sec.gov/Archives/edgar/data/${company.cik}/${accession.replace(/-/g, '')}/${primaryDoc}`
        : `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${symbol}&type=${forms[i]}&dateb=&owner=include&count=1`;

      filings.push({
        form: forms[i],
        filingDate: filingDates[i] || null,
        reportDate: reportDates[i] || null,
        description: descriptions[i] || forms[i],
        url,
        accessionNumber: accession || null,
      });
    }

    return res.status(200).json({
      symbol,
      companyName: subData.name || company.name,
      cik: company.cik,
      filings,
    });
  } catch (error) {
    console.error('SEC filings error:', error);
    return res.status(500).json({ error: 'Failed to fetch SEC filings' });
  }
}
