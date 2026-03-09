/**
 * Manually trigger one X bot post immediately.
 * Calls the x-bot-v2 handler with type=market-open (no changes to x-bot-v2.js).
 */
export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const type = req.query.type || 'market-open';

  try {
    const xBotHandler = (await import('./x-bot-v2.js')).default;

    const mockReq = {
      method: 'GET',
      query: { type },
      headers: req.headers.authorization
        ? { authorization: req.headers.authorization }
        : {},
    };

    let statusCode = 200;
    let body = null;

    const mockRes = {
      status(code) {
        statusCode = code;
        return mockRes;
      },
      json(b) {
        body = b;
        return mockRes;
      },
    };

    await xBotHandler(mockReq, mockRes);

    res.status(statusCode).json(body);
  } catch (error) {
    console.error('test-post error:', error);
    res.status(500).json({
      status: 'error',
      error: error.message,
    });
  }
}
