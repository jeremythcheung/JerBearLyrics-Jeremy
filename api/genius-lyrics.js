const { fetchGeniusSong } = require('./_genius');

function normalizeMetaText(s) {
    return (s || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function canonicalizeLookup(artist, title) {
    const normalizedArtist = normalizeMetaText(artist);
    const normalizedTitle = normalizeMetaText(title);
    const elijahWoodsTitles = new Set([
        '2010',
        '2 thousand 10',
        '2 thousand ten',
        'two thousand 10',
        'two thousand ten',
        'two thousand and ten'
    ]);

    if (normalizedArtist === 'elijah woods' && elijahWoodsTitles.has(normalizedTitle)) {
        return { artist: 'elijah woods', title: '2 thousand 10' };
    }

    return { artist, title };
}

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { artist, title } = req.query;
    if (!artist || !title) return res.status(400).json({ error: 'Missing artist or title' });

    try {
        const lookup = canonicalizeLookup(artist, title);
        const song = await fetchGeniusSong(lookup.artist, lookup.title, process.env.GENIUS_ACCESS_TOKEN || '');
        if (!song) return res.status(404).json({ error: 'Song not found on Genius' });
        return res.status(200).json(song);
    } catch (_) {
        return res.status(502).json({ error: 'Failed to fetch Genius lyrics page' });
    }
};
