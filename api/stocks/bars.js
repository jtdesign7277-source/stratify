import { getBars } from '../lib/alpaca.js';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const bars = await getBars();
    res.status(200).json(bars);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
