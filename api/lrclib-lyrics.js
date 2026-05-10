module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { artist, title } = req.query;
    if (!artist || !title) return res.status(400).json({ error: 'Missing artist or title' });

    try {
        const searchUrl = `https://lrclib.net/api/search?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`;
        const searchRes = await fetch(searchUrl, { signal: AbortSignal.timeout(5000) });
        if (!searchRes.ok) return res.status(502).json({ error: 'LRCLIB search failed' });

        const matches = await searchRes.json();
        const match = Array.isArray(matches)
            ? matches.find(item => item.plainLyrics || item.syncedLyrics)
            : null;

        if (!match) return res.status(404).json({ error: 'Lyrics not found on LRCLIB' });

        res.status(200).json({
            lyrics: (match.plainLyrics || match.syncedLyrics).trim(),
            syncedLyrics: match.syncedLyrics || null,
            artist: match.artistName || artist,
            title: match.trackName || title
        });
    } catch (e) {
        res.status(502).json({ error: 'LRCLIB request failed' });
    }
};
