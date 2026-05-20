const { fetchGeniusSong } = require('./_genius');

function normalizeStr(s) {
    return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizeMetaText(s) {
    return normalizeStr(s)
        .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
        .replace(/\b(feat|ft|featuring|with|from|remaster(?:ed)?|version|edit|mix|live|acoustic|bonus track)\b/g, ' ')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function formatReleaseDate(dateStr) {
    if (!dateStr) return null;
    const parts = String(dateStr).split('-');
    if (parts.length === 3) {
        return new Date(`${parts[0]}-${parts[1]}-${parts[2]}T00:00:00Z`).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            timeZone: 'UTC'
        });
    }
    if (parts.length === 2) {
        return new Date(`${parts[0]}-${parts[1]}-01T00:00:00Z`).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            timeZone: 'UTC'
        });
    }
    return parts[0];
}

function scoreMusicBrainzRecording(recording, artist, title) {
    const wantedArtist = normalizeMetaText(artist);
    const wantedTitle = normalizeMetaText(title);
    const resultArtist = normalizeMetaText((recording['artist-credit'] || [])
        .map(c => c.name || c.artist?.name || '')
        .join(' '));
    const resultTitle = normalizeMetaText(recording.title || '');

    let score = Number(recording.score || 0);

    if (resultTitle === wantedTitle) score += 120;
    else if (resultTitle.includes(wantedTitle) || wantedTitle.includes(resultTitle)) score += 70;

    if (resultArtist === wantedArtist) score += 120;
    else if (resultArtist.includes(wantedArtist) || wantedArtist.includes(resultArtist)) score += 70;

    if ((recording.releases || []).some(r => r.status === 'Official')) score += 20;
    if (recording['first-release-date']) score += 10;

    return score;
}

function scoreItunesResult(result, artist, title) {
    const wantedArtist = normalizeMetaText(artist);
    const wantedTitle = normalizeMetaText(title);
    const resultArtist = normalizeMetaText(result.artistName || '');
    const resultTitle = normalizeMetaText(result.trackName || result.trackCensoredName || result.collectionName || '');

    let score = 0;

    if (resultTitle === wantedTitle) score += 120;
    else if (resultTitle.includes(wantedTitle) || wantedTitle.includes(resultTitle)) score += 70;

    if (resultArtist === wantedArtist) score += 120;
    else if (resultArtist.includes(wantedArtist) || wantedArtist.includes(resultArtist)) score += 70;

    if ((result.kind || '') === 'song') score += 20;

    return score;
}

async function fetchMusicBrainzMeta(artist, title) {
    const params = new URLSearchParams({
        query: `recording:"${title}" AND artist:"${artist}"`,
        fmt: 'json',
        limit: '5'
    });

    const res = await fetch(`https://musicbrainz.org/ws/2/recording?${params.toString()}`, {
        headers: {
            'Accept': 'application/json',
            'User-Agent': 'JerBearLyrics-Jeremy/1.0 (non-commercial metadata lookup)'
        },
        signal: AbortSignal.timeout(8000)
    });

    if (!res.ok) throw new Error('MusicBrainz request failed');

    const data = await res.json();
    const recordings = Array.isArray(data.recordings) ? data.recordings : [];
    if (!recordings.length) return null;

    const ranked = recordings
        .map(r => ({ recording: r, score: scoreMusicBrainzRecording(r, artist, title) }))
        .sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return String(a.recording['first-release-date'] || '').localeCompare(String(b.recording['first-release-date'] || ''));
        });

    const best = ranked[0];
    if (!best || best.score < 190 || !best.recording['first-release-date']) return null;

    const credit = (best.recording['artist-credit'] || [])
        .map(c => c.name || c.artist?.name || '')
        .join(' ')
        .trim();

    return {
        artist: credit || artist,
        date: formatReleaseDate(best.recording['first-release-date']),
        source: 'MusicBrainz'
    };
}

async function fetchItunesMeta(artist, title) {
    const query = encodeURIComponent(`${artist} ${title}`);
    const res = await fetch(`https://itunes.apple.com/search?term=${query}&entity=song&limit=10`, {
        signal: AbortSignal.timeout(8000)
    });

    if (!res.ok) throw new Error('iTunes request failed');

    const data = await res.json();
    const results = Array.isArray(data.results) ? data.results : [];
    if (!results.length) return null;

    const ranked = results
        .map(r => ({ result: r, score: scoreItunesResult(r, artist, title) }))
        .sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return String(a.result.releaseDate || '').localeCompare(String(b.result.releaseDate || ''));
        });

    const best = ranked[0];
    if (!best || best.score < 220 || !best.result.releaseDate) return null;

    return {
        artist: best.result.artistName || artist,
        date: formatReleaseDate(best.result.releaseDate),
        source: 'iTunes'
    };
}

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { artist, title } = req.query;
    if (!artist || !title) return res.status(400).json({ error: 'Missing artist or title' });

    try {
        const geniusMeta = await fetchGeniusSong(artist, title, process.env.GENIUS_ACCESS_TOKEN || '');
        if (geniusMeta && geniusMeta.date) {
            return res.status(200).json({
                artist: geniusMeta.artist || artist,
                date: geniusMeta.date,
                source: 'Genius'
            });
        }

        const musicBrainzMeta = await fetchMusicBrainzMeta(artist, title);
        if (musicBrainzMeta) return res.status(200).json(musicBrainzMeta);

        const itunesMeta = await fetchItunesMeta(artist, title);
        if (itunesMeta) return res.status(200).json(itunesMeta);

        return res.status(404).json({ error: 'Metadata not found' });
    } catch (_) {
        return res.status(502).json({ error: 'Metadata lookup failed' });
    }
};
