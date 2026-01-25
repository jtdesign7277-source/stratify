import { getQuotes, getBars } from '../lib/alpaca.js';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { symbol } = req.query;

  try {
    const [quotes, bars] = await Promise.all([getQuotes(), getBars()]);
    
    const quote = quotes.find(q => q.symbol === symbol.toUpperCase());
    const bar = bars.find(b => b.symbol === symbol.toUpperCase());
    
    if (!quote && !bar) {
      return res.status(404).json({ error: 'Symbol not found' });
    }
    
    res.status(200).json({ ...quote, ...bar });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
