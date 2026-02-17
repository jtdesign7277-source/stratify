export async function generateTTS(text) {
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey || !text) return null;

  try {
    const res = await fetch('https://api.heygen.com/v1/audio/text_to_speech', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
      body: JSON.stringify({
        voice_id: '0b41c487c6da4f5ba5782bbe462958e8',
        text: text.slice(0, 1500),
        speed: 1.0,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.data?.audio_url || data.data?.url || null;
  } catch {
    return null;
  }
}
