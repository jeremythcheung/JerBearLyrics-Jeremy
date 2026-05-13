const bibleBookNames = [
    'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy', 'Joshua', 'Judges', 'Ruth',
    '1 Samuel', '2 Samuel', '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles',
    'Ezra', 'Nehemiah', 'Esther', 'Job', 'Psalms', 'Proverbs', 'Ecclesiastes', 'Song of Solomon',
    'Isaiah', 'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos',
    'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi',
    'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans', '1 Corinthians', '2 Corinthians',
    'Galatians', 'Ephesians', 'Philippians', 'Colossians', '1 Thessalonians', '2 Thessalonians',
    '1 Timothy', '2 Timothy', 'Titus', 'Philemon', 'Hebrews', 'James', '1 Peter', '2 Peter',
    '1 John', '2 John', '3 John', 'Jude', 'Revelation'
];

const bookIdByName = {
    'Genesis': 'GEN', 'Exodus': 'EXO', 'Leviticus': 'LEV', 'Numbers': 'NUM', 'Deuteronomy': 'DEU',
    'Joshua': 'JOS', 'Judges': 'JDG', 'Ruth': 'RUT', '1 Samuel': '1SA', '2 Samuel': '2SA',
    '1 Kings': '1KI', '2 Kings': '2KI', '1 Chronicles': '1CH', '2 Chronicles': '2CH', 'Ezra': 'EZR',
    'Nehemiah': 'NEH', 'Esther': 'EST', 'Job': 'JOB', 'Psalms': 'PSA', 'Proverbs': 'PRO',
    'Ecclesiastes': 'ECC', 'Song of Solomon': 'SNG', 'Isaiah': 'ISA', 'Jeremiah': 'JER',
    'Lamentations': 'LAM', 'Ezekiel': 'EZK', 'Daniel': 'DAN', 'Hosea': 'HOS', 'Joel': 'JOL',
    'Amos': 'AMO', 'Obadiah': 'OBA', 'Jonah': 'JON', 'Micah': 'MIC', 'Nahum': 'NAM',
    'Habakkuk': 'HAB', 'Zephaniah': 'ZEP', 'Haggai': 'HAG', 'Zechariah': 'ZEC', 'Malachi': 'MAL',
    'Matthew': 'MAT', 'Mark': 'MRK', 'Luke': 'LUK', 'John': 'JHN', 'Acts': 'ACT', 'Romans': 'ROM',
    '1 Corinthians': '1CO', '2 Corinthians': '2CO', 'Galatians': 'GAL', 'Ephesians': 'EPH',
    'Philippians': 'PHP', 'Colossians': 'COL', '1 Thessalonians': '1TH', '2 Thessalonians': '2TH',
    '1 Timothy': '1TI', '2 Timothy': '2TI', 'Titus': 'TIT', 'Philemon': 'PHM', 'Hebrews': 'HEB',
    'James': 'JAS', '1 Peter': '1PE', '2 Peter': '2PE', '1 John': '1JN', '2 John': '2JN',
    '3 John': '3JN', 'Jude': 'JUD', 'Revelation': 'REV'
};

const translationConfigs = {
    kjv:    { apiBibleAbbreviation: 'KJV', selectedName: 'King James Version (KJV)', publicCode: 'kjv' },
    nkjv:   { apiBibleAbbreviation: 'NKJV', selectedName: 'New King James Version (NKJV)', publicCode: 'kjv', fallbackName: 'King James Version (KJV)' },
    esv:    { apiBibleAbbreviation: 'ESV', selectedName: 'English Standard Version (ESV)', publicCode: 'web', fallbackName: 'World English Bible (WEB)' },
    nasb:   { apiBibleAbbreviation: 'NASB', selectedName: 'New American Standard Bible (NASB)', publicCode: 'asv', fallbackName: 'American Standard Version (ASV)' },
    csb:    { apiBibleAbbreviation: 'CSB', selectedName: 'Christian Standard Bible (CSB)', publicCode: 'web', fallbackName: 'World English Bible (WEB)' },
    nrsvue: { apiBibleAbbreviation: 'NRSVUE', selectedName: 'New Revised Standard Version Updated Edition (NRSVUE)', publicCode: 'web', fallbackName: 'World English Bible (WEB)' },
    nabre:  { apiBibleAbbreviation: 'NABRE', selectedName: 'New American Bible Revised Edition (NABRE)', publicCode: 'dra', fallbackName: 'Douay-Rheims (DRA)' },
    niv:    { apiBibleAbbreviation: 'NIV', selectedName: 'New International Version (NIV)', publicCode: 'web', fallbackName: 'World English Bible (WEB)' },
    nlt:    { apiBibleAbbreviation: 'NLT', selectedName: 'New Living Translation (NLT)', publicCode: 'bbe', fallbackName: 'Bible in Basic English (BBE)' },
    ceb:    { apiBibleAbbreviation: 'CEB', selectedName: 'Common English Bible (CEB)', publicCode: 'bbe', fallbackName: 'Bible in Basic English (BBE)' },
    nirv:   { apiBibleAbbreviation: 'NIrV', selectedName: 'New International Reader\'s Version (NIrV)', publicCode: 'bbe', fallbackName: 'Bible in Basic English (BBE)' }
};

const bibleIdCache = new Map();

function normalizeBibleBookKey(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function bibleBookEditDistance(a, b) {
    const previous = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        const current = [i];
        for (let j = 1; j <= b.length; j++) {
            current[j] = Math.min(
                previous[j] + 1,
                current[j - 1] + 1,
                previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
            );
        }
        previous.splice(0, previous.length, ...current);
    }
    return previous[b.length];
}

function normalizeBibleBookName(bookName) {
    const typedKey = normalizeBibleBookKey(bookName);
    const exact = bibleBookNames.find(name => normalizeBibleBookKey(name) === typedKey);
    if (exact) return exact;

    let bestMatch = bookName;
    let bestDistance = Infinity;
    for (const name of bibleBookNames) {
        const distance = bibleBookEditDistance(typedKey, normalizeBibleBookKey(name));
        if (distance < bestDistance) {
            bestMatch = name;
            bestDistance = distance;
        }
    }
    return bestDistance <= 2 ? bestMatch : bookName;
}

function buildBibleQueriesForReference(bookName, reference) {
    const chapterRange = reference.match(/^(\d+)\s*-\s*(\d+)$/);
    if (!chapterRange) return [`${bookName} ${reference}`];

    const startChapter = Number(chapterRange[1]);
    const endChapter = Number(chapterRange[2]);
    if (endChapter < startChapter) throw new Error('Chapter range must go from low to high.');
    if (endChapter - startChapter > 20) throw new Error('Please search 20 chapters or fewer at a time.');

    const queries = [];
    for (let chapter = startChapter; chapter <= endChapter; chapter++) {
        queries.push(`${bookName} ${chapter}`);
    }
    return queries;
}

function parseBibleLookup(book, ref) {
    let bookName = String(book || '').trim();
    let reference = String(ref || '').trim();

    if (!reference) {
        const fullLookup = bookName.match(/^(.+?)\s+(\d+(?::\d+)?(?:\s*-\s*\d+(?::\d+)?)?(?:\s*,\s*\d+(?::\d+)?(?:\s*-\s*\d+(?::\d+)?)?)*)$/);
        if (fullLookup) {
            bookName = fullLookup[1].trim();
            reference = fullLookup[2].trim();
        }
    }

    if (!bookName || !reference) throw new Error('Please enter a book name and reference.');
    bookName = normalizeBibleBookName(bookName);

    return {
        bookName,
        queries: reference
            .split(',')
            .map(part => part.trim())
            .filter(Boolean)
            .flatMap(part => buildBibleQueriesForReference(bookName, part))
    };
}

function cleanTextContent(content) {
    return String(content || '')
        .replace(/\r/g, '')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function getTranslationConfig(code) {
    return translationConfigs[String(code || '').toLowerCase()] || translationConfigs.kjv;
}

async function fetchJson(url, options = {}) {
    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(data.message || data.error || `Request failed with ${response.status}`);
        error.status = response.status;
        error.payload = data;
        throw error;
    }
    return data;
}

async function resolveApiBibleId(apiKey, config) {
    if (bibleIdCache.has(config.apiBibleAbbreviation)) {
        return bibleIdCache.get(config.apiBibleAbbreviation);
    }

    const url = `https://rest.api.bible/v1/bibles?language=eng&abbreviation=${encodeURIComponent(config.apiBibleAbbreviation)}`;
    const result = await fetchJson(url, {
        headers: { 'api-key': apiKey },
        signal: AbortSignal.timeout(8000)
    });

    const matches = Array.isArray(result.data) ? result.data : [];
    const selected = matches.find(item =>
        String(item.abbreviation || '').toUpperCase() === config.apiBibleAbbreviation.toUpperCase()
    ) || matches[0];

    if (!selected) {
        throw new Error(`${config.selectedName} is not available for this API.Bible account.`);
    }

    bibleIdCache.set(config.apiBibleAbbreviation, {
        bibleId: selected.id,
        name: selected.name || config.selectedName
    });
    return bibleIdCache.get(config.apiBibleAbbreviation);
}

async function fetchApiBibleContent(apiKey, bibleId, bookName, lookup) {
    const bookId = bookIdByName[bookName];
    if (!bookId) {
        throw new Error(`Unsupported book name: ${bookName}`);
    }

    const reference = lookup.slice(bookName.length).trim();
    const baseHeaders = { 'api-key': apiKey };
    const params = 'content-type=text&include-notes=false&include-titles=false&include-chapter-numbers=false&include-verse-numbers=true';

    if (/^\d+$/.test(reference)) {
        const chapterId = `${bookId}.${reference}`;
        const data = await fetchJson(`https://rest.api.bible/v1/bibles/${bibleId}/chapters/${chapterId}?${params}`, {
            headers: baseHeaders,
            signal: AbortSignal.timeout(8000)
        });
        return {
            reference: data.data.reference,
            text: cleanTextContent(data.data.content)
        };
    }

    const verseMatch = reference.match(/^(\d+):(\d+)(?:\s*-\s*(?:(\d+):)?(\d+))?$/);
    if (!verseMatch) {
        throw new Error(`Unsupported reference format: ${reference}`);
    }

    const startChapter = verseMatch[1];
    const startVerse = verseMatch[2];
    const endChapter = verseMatch[3] || startChapter;
    const endVerse = verseMatch[4];

    if (!endVerse) {
        const verseId = `${bookId}.${startChapter}.${startVerse}`;
        const data = await fetchJson(`https://rest.api.bible/v1/bibles/${bibleId}/verses/${verseId}?${params}`, {
            headers: baseHeaders,
            signal: AbortSignal.timeout(8000)
        });
        return {
            reference: data.data.reference,
            text: cleanTextContent(data.data.content)
        };
    }

    const startId = `${bookId}.${startChapter}.${startVerse}`;
    const endId = `${bookId}.${endChapter}.${endVerse}`;
    const data = await fetchJson(`https://rest.api.bible/v1/bibles/${bibleId}/passages/${startId}-${endId}?${params}`, {
        headers: baseHeaders,
        signal: AbortSignal.timeout(8000)
    });
    return {
        reference: data.data.reference,
        text: cleanTextContent(data.data.content)
    };
}

async function fetchExactBibleVerse(book, ref, translationCode, apiKey) {
    const config = getTranslationConfig(translationCode);
    const { bookName, queries } = parseBibleLookup(book, ref);
    const { bibleId, name } = await resolveApiBibleId(apiKey, config);
    const chunks = [];

    for (const lookup of queries) {
        chunks.push(await fetchApiBibleContent(apiKey, bibleId, bookName, lookup));
    }

    const references = chunks.map(chunk => chunk.reference);
    return {
        reference: references.join(', '),
        translation: name,
        text: chunks.map(chunk => chunk.text).join('\n\n'),
        exact: true
    };
}

async function fetchPublicBibleVerse(book, ref, translationCode) {
    const config = getTranslationConfig(translationCode);
    const { queries } = parseBibleLookup(book, ref);
    const chapters = [];

    for (const lookup of queries) {
        const query = encodeURIComponent(lookup);
        const data = await fetchJson(`https://bible-api.com/${query}?translation=${config.publicCode}`, {
            signal: AbortSignal.timeout(8000)
        });
        if (data.error) throw new Error(data.error);
        chapters.push(data);
    }

    const hasMultipleChapters = chapters.length > 1;
    const lines = chapters.flatMap(data => data.verses.map(v => {
        const label = hasMultipleChapters ? `${v.chapter}:${v.verse}` : v.verse;
        return `[${label}] ${v.text.trim()}`;
    }));
    const hasOnlyWholeChapterQueries = queries.every(lookup => /^\D+\s+\d+$/.test(lookup));
    const reference = hasMultipleChapters && hasOnlyWholeChapterQueries
        ? `${chapters[0].verses[0].book_name} ${chapters[0].verses[0].chapter}-${chapters[chapters.length - 1].verses[0].chapter}`
        : chapters.map(data => data.reference).join(', ');

    const exact = config.publicCode === 'kjv' && config.apiBibleAbbreviation === 'KJV';
    return {
        reference,
        translation: exact
            ? (chapters[0].translation_name || config.selectedName)
            : `${config.selectedName} (shown using ${config.fallbackName})`,
        text: lines.join('\n') + (exact ? '' : `\n\nNote: ${config.selectedName} requires API.Bible access. This result is shown using ${config.fallbackName}.`),
        exact
    };
}

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { book, ref = '', translation = 'kjv' } = req.query;
    if (!book) return res.status(400).json({ error: 'Missing book name' });

    const apiKey = process.env.BIBLE_API_KEY;

    try {
        if (apiKey) {
            try {
                const exactResult = await fetchExactBibleVerse(book, ref, translation, apiKey);
                return res.status(200).json(exactResult);
            } catch (error) {
                const fallbackResult = await fetchPublicBibleVerse(book, ref, translation);
                fallbackResult.notice = error.message || 'Exact translation lookup failed';
                return res.status(200).json(fallbackResult);
            }
        }

        const fallbackResult = await fetchPublicBibleVerse(book, ref, translation);
        fallbackResult.notice = 'BIBLE_API_KEY is not configured';
        return res.status(200).json(fallbackResult);
    } catch (error) {
        return res.status(500).json({ error: error.message || 'Verse lookup failed' });
    }
};
