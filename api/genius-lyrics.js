const { fetchGeniusSong } = require('./_genius');

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { artist, title } = req.query;
    if (!artist || !title) return res.status(400).json({ error: 'Missing artist or title' });

    try {
        const song = await fetchGeniusSong(artist, title, process.env.GENIUS_ACCESS_TOKEN || '');
        if (!song) return res.status(404).json({ error: 'Song not found on Genius' });
        return res.status(200).json(song);
    } catch (_) {
        return res.status(502).json({ error: 'Failed to fetch Genius lyrics page' });
    }
};
