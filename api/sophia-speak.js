export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Missing text' });

  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Missing HEYGEN_API_KEY' });

  try {
    const response = await fetch('https://api.heygen.com/v1/audio/text_to_speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey,
      },
      body: JSON.stringify({
        voice_id: '0b41c487c6da4f5ba5782bbe462958e8',
        text: text.slice(0, 3000),
        speed: 1.0,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(502).json({ error: `HeyGen error: ${response.status} ${errText}` });
    }

    const data = await response.json();
    const audioUrl = data.data?.audio_url || data.data?.url || data.audio_url || data.url || null;
    return res.status(200).json({ audio_url: audioUrl, data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
