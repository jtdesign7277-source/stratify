export default async function handler(req, res) {
  const { series_id, search_text, endpoint } = req.query;
  const API_KEY = process.env.FRED_API_KEY;

  let url;
  if (endpoint === 'search') {
    url = `https://api.stlouisfed.org/fred/series/search?search_text=${encodeURIComponent(search_text || '')}&api_key=${API_KEY}&file_type=json&limit=10`;
  } else {
    url = `https://api.stlouisfed.org/fred/series/observations?series_id=${encodeURIComponent(series_id || '')}&api_key=${API_KEY}&file_type=json&sort_order=desc&limit=60`;
  }

  try {
    const response = await fetch(url);
    const data = await response.json();
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch FRED data' });
  }
}
