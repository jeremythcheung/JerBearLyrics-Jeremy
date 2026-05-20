function slugPart(value) {
    return (value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/&/g, ' and ')
        .replace(/['’]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-+/g, '-')
        .toLowerCase();
}

function decodeHtmlEntities(text) {
    return (text || '')
        .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
        .replace(/&#([0-9]+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&nbsp;/g, ' ');
}

function parseLyricsFromHtml(html) {
    const containers = [];
    let searchFrom = 0;

    while (true) {
        const attrPos = html.indexOf('data-lyrics-container="true"', searchFrom);
        if (attrPos === -1) break;

        const openBracket = html.indexOf('>', attrPos);
        if (openBracket === -1) break;

        let pos = openBracket + 1;
        let depth = 1;

        while (pos < html.length && depth > 0) {
            const nextOpen = html.indexOf('<div', pos);
            const nextClose = html.indexOf('</div>', pos);

            if (nextClose === -1) break;

            if (nextOpen !== -1 && nextOpen < nextClose) {
                depth++;
                pos = nextOpen + 4;
            } else {
                depth--;
                if (depth === 0) containers.push(html.substring(openBracket + 1, nextClose));
                pos = nextClose + 6;
            }
        }

        searchFrom = openBracket + 1;
    }

    if (!containers.length) return null;

    const lyrics = containers
        .map(c => decodeHtmlEntities(
            c.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')
        ).trim())
        .join('\n\n')
        .trim();

    return lyrics || null;
}

function extractEscapedJsonValue(html, key) {
    const match = html.match(new RegExp(`\\\\"${key}\\\\":(?:null|\\\\"([^\\\\"]*)\\\\")`, 'i'));
    if (!match || typeof match[1] === 'undefined') return null;
    return decodeHtmlEntities(match[1].replace(/\\u0026/g, '&').replace(/\\u00a0/gi, ' ')).trim();
}

function extractSongMetaFromHtml(html) {
    return {
        artist: extractEscapedJsonValue(html, 'primaryArtistNames') || null,
        title: extractEscapedJsonValue(html, 'title') || null,
        date: extractEscapedJsonValue(html, 'releaseDateForDisplay') || null
    };
}

function buildUrlCandidates(artist, title) {
    const artistSlug = slugPart(artist);
    const titleSlug = slugPart(title);
    const candidates = new Set();

    if (artistSlug && titleSlug) {
        candidates.add(`https://genius.com/${artistSlug}-${titleSlug}-lyrics`);
    }

    const artistKey = artistSlug.replace(/-/g, '');
    if (artistKey === 'michaeldimuccio' || artistKey === 'michealdimuccio') {
        candidates.add(`https://genius.com/micheal-dimuccio-${titleSlug}-lyrics`);
        candidates.add(`https://genius.com/michael-dimuccio-${titleSlug}-lyrics`);
    }

    return [...candidates];
}

function extractGeniusPathsFromSearchHtml(html) {
    const paths = new Set();
    const regex = /href="(\/[^"#?]*-lyrics)"/gi;
    let match;

    while ((match = regex.exec(html)) !== null) {
        paths.add(`https://genius.com${match[1]}`);
    }

    return [...paths];
}

async function fetchGeniusPage(url) {
    const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
        signal: AbortSignal.timeout(8000),
        redirect: 'follow'
    });
    if (!res.ok) return null;

    const html = await res.text();
    const lyrics = parseLyricsFromHtml(html);
    if (!lyrics) return null;

    const meta = extractSongMetaFromHtml(html);
    return {
        lyrics,
        artist: meta.artist || null,
        title: meta.title || null,
        date: meta.date || null,
        url
    };
}

async function fetchViaSiteSearch(artist, title) {
    const query = encodeURIComponent(`${artist} ${title}`);
    const res = await fetch(`https://genius.com/search?q=${query}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
        signal: AbortSignal.timeout(8000),
        redirect: 'follow'
    });
    if (!res.ok) return null;

    const html = await res.text();
    const urls = extractGeniusPathsFromSearchHtml(html);
    if (!urls.length) return null;

    for (const url of urls.slice(0, 5)) {
        const page = await fetchGeniusPage(url);
        if (page) {
            return {
                ...page,
                artist: page.artist || artist,
                title: page.title || title
            };
        }
    }

    return null;
}

function scoreSearchHit(hit, artist, title) {
    const normalize = value => slugPart(value).replace(/-/g, '');
    const wantedArtist = normalize(artist);
    const wantedTitle = normalize(title);
    const resultArtist = normalize(hit.result?.primary_artist?.name || '');
    const resultTitle = normalize(hit.result?.title || '');

    let score = 0;
    if (resultArtist === wantedArtist) score += 100;
    else if (resultArtist.includes(wantedArtist) || wantedArtist.includes(resultArtist)) score += 60;

    if (resultTitle === wantedTitle) score += 100;
    else if (resultTitle.includes(wantedTitle) || wantedTitle.includes(resultTitle)) score += 60;

    return score;
}

async function fetchViaApiSearch(artist, title, token) {
    if (!token) return null;

    const query = encodeURIComponent(`${artist} ${title}`);
    const res = await fetch(`https://api.genius.com/search?q=${query}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) return null;

    const data = await res.json();
    const hits = Array.isArray(data.response?.hits) ? data.response.hits : [];
    if (!hits.length) return null;

    const ranked = hits
        .map(hit => ({ hit, score: scoreSearchHit(hit, artist, title) }))
        .sort((a, b) => b.score - a.score);

    for (const { hit, score } of ranked.slice(0, 3)) {
        if (score < 120) continue;
        const page = await fetchGeniusPage(hit.result?.url);
        if (!page) continue;
        return {
            ...page,
            artist: page.artist || hit.result?.primary_artist?.name || artist,
            title: page.title || hit.result?.title || title
        };
    }

    return null;
}

async function fetchGeniusSong(artist, title, token) {
    for (const url of buildUrlCandidates(artist, title)) {
        const page = await fetchGeniusPage(url);
        if (page) {
            return {
                lyrics: page.lyrics,
                artist: page.artist || artist,
                title: page.title || title,
                date: page.date || null,
                url: page.url,
                source: 'Genius'
            };
        }
    }

    const siteSearched = await fetchViaSiteSearch(artist, title);
    if (siteSearched) {
        return {
            lyrics: siteSearched.lyrics,
            artist: siteSearched.artist || artist,
            title: siteSearched.title || title,
            date: siteSearched.date || null,
            url: siteSearched.url,
            source: 'Genius'
        };
    }

    const searched = await fetchViaApiSearch(artist, title, token);
    if (searched) {
        return {
            lyrics: searched.lyrics,
            artist: searched.artist || artist,
            title: searched.title || title,
            date: searched.date || null,
            url: searched.url,
            source: 'Genius'
        };
    }

    return null;
}

module.exports = {
    fetchGeniusSong,
    parseLyricsFromHtml
};
