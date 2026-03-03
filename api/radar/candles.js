// /api/radar/candles.js
const https = require('https');

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Invalid JSON: ' + data.substring(0, 100)));
        }
      });
    }).on('error', reject);
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { symbol, interval } = req.query;
  if (!symbol) return res.status(400).json({ error: 'Missing symbol' });

  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'No TWELVE_DATA_API_KEY env var' });

  const tf = interval || '1h';
  const outputSize = tf === '1day' ? 365 : 500;

  try {
    const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=${tf}&outputsize=${outputSize}&apikey=${apiKey}`;
    const data = await httpsGet(url);
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
