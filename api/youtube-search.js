module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { q } = req.query;
    if (!q) return res.status(400).json({ error: 'Missing query' });

    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'YouTube API not configured' });

    try {
        const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=1&q=${encodeURIComponent(q)}&key=${apiKey}`;
        const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (!response.ok) return res.status(502).json({ error: 'YouTube API request failed' });

        const data = await response.json();
        const videoId = data.items?.[0]?.id?.videoId;
        if (!videoId) return res.status(404).json({ error: 'No video found' });

        res.status(200).json({ videoId });
    } catch (e) {
        res.status(502).json({ error: 'YouTube search failed' });
    }
};
