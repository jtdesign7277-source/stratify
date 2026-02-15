export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const API_KEY = process.env.LIVEAVATAR_API_KEY;
  if (!API_KEY) {
    return res.status(500).json({ error: 'LiveAvatar API key not configured' });
  }

  const AVATAR_ID = '26393b8e-e944-4367-98ef-e2bc75c4b792'; // Katya in Black Suit
  const CONTEXT_ID = '0ada154b-9ea5-4e2f-871f-e841ecc763fb'; // Stratify Trading Assistant

  try {
    const response = await fetch('https://api.liveavatar.com/v1/sessions/token', {
      method: 'POST',
      headers: {
        'X-API-KEY': API_KEY,
        'accept': 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        mode: 'FULL',
        avatar_id: AVATAR_ID,
        avatar_persona: {
          language: 'en',
          context_id: CONTEXT_ID,
        },
      }),
    });

    const data = await response.json();

    if (!response.ok || data.code !== 1000) {
      return res.status(response.status || 500).json({ error: data.message || 'Token generation failed' });
    }

    // Now start the session
    const startRes = await fetch('https://api.liveavatar.com/v1/sessions/start', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'authorization': `Bearer ${data.data.session_token}`,
      },
    });

    const startData = await startRes.json();

    if (!startRes.ok || startData.code !== 1000) {
      return res.status(startRes.status || 500).json({ error: startData.message || 'Session start failed' });
    }

    return res.status(200).json({
      session_id: data.data.session_id,
      session_token: data.data.session_token,
      livekit: startData.data,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to connect to LiveAvatar API: ' + err.message });
  }
}
