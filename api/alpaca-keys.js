/**
 * Alpaca API Keys endpoint
 * Securely provides keys to the frontend for WebSocket authentication
 * 
 * NOTE: In production, you might want to add additional security like:
 * - Rate limiting
 * - User authentication check
 * - CORS restrictions
 */

export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ALPACA_KEY = process.env.ALPACA_API_KEY;
  const ALPACA_SECRET = process.env.ALPACA_SECRET_KEY;

  if (!ALPACA_KEY || !ALPACA_SECRET) {
    return res.status(500).json({ error: 'Alpaca API keys not configured' });
  }

  // Return keys for WebSocket authentication
  // The frontend needs these to authenticate with Alpaca's streaming API
  res.status(200).json({
    key: ALPACA_KEY,
    secret: ALPACA_SECRET
  });
}
