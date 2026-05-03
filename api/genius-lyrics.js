module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { artist, title } = req.query;
    if (!artist || !title) return res.status(400).json({ error: 'Missing artist or title' });

    const token = process.env.GENIUS_ACCESS_TOKEN;
    if (!token) return res.status(500).json({ error: 'Genius API not configured' });

    // Step 1: Search Genius API for the song URL
    const query = encodeURIComponent(`${artist} ${title}`);
    let searchData;
    try {
        const searchRes = await fetch(`https://api.genius.com/search?q=${query}`, {
            headers: { Authorization: `Bearer ${token}` },
            signal: AbortSignal.timeout(5000)
        });
        if (!searchRes.ok) return res.status(502).json({ error: 'Genius search failed' });
        searchData = await searchRes.json();
    } catch (e) {
        return res.status(502).json({ error: 'Genius search request failed' });
    }

    const hits = searchData.response?.hits || [];
    if (hits.length === 0) return res.status(404).json({ error: 'Song not found on Genius' });

    const songUrl    = hits[0].result.url;
    const songArtist = hits[0].result.primary_artist.name;
    const songTitle  = hits[0].result.title;

    // Step 2: Fetch the Genius page and parse lyrics from it
    let html;
    try {
        const pageRes = await fetch(songUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
            signal: AbortSignal.timeout(8000)
        });
        if (!pageRes.ok) return res.status(502).json({ error: 'Failed to fetch Genius lyrics page' });
        html = await pageRes.text();
    } catch (e) {
        return res.status(502).json({ error: 'Failed to fetch Genius lyrics page' });
    }

    const lyrics = parseLyricsFromHtml(html);
    if (!lyrics) return res.status(404).json({ error: 'Could not parse lyrics from Genius page' });

    res.status(200).json({ lyrics, artist: songArtist, title: songTitle });
};

// Extract text from all data-lyrics-container="true" divs,
// handling nested divs by tracking brace depth.
function parseLyricsFromHtml(html) {
    const containers = [];
    let searchFrom = 0;

    while (true) {
        const attrPos = html.indexOf('data-lyrics-container="true"', searchFrom);
        if (attrPos === -1) break;

        const openBracket = html.indexOf('>', attrPos);
        if (openBracket === -1) break;

        let pos   = openBracket + 1;
        let depth = 1;

        while (pos < html.length && depth > 0) {
            const nextOpen  = html.indexOf('<div', pos);
            const nextClose = html.indexOf('</div>', pos);

            if (nextClose === -1) break;

            if (nextOpen !== -1 && nextOpen < nextClose) {
                depth++;
                pos = nextOpen + 4;
            } else {
                depth--;
                if (depth === 0) {
                    containers.push(html.substring(openBracket + 1, nextClose));
                }
                pos = nextClose + 6;
            }
        }

        searchFrom = openBracket + 1;
    }

    if (containers.length === 0) return null;

    const lyrics = containers
        .map(c => c
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<[^>]+>/g, '')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&nbsp;/g, ' ')
            .trim()
        )
        .join('\n\n')
        .trim();

    return lyrics || null;
}
