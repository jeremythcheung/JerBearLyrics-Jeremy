const { getStore } = require('@netlify/blobs');

const ADMIN_SECRET = process.env.ADMIN_SECRET || 'jerbear-admin-2026';

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: ''
        };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    let secret;
    try {
        ({ secret } = JSON.parse(event.body || '{}'));
    } catch {
        return { statusCode: 400, body: 'Invalid JSON' };
    }

    if (secret !== ADMIN_SECRET) {
        return { statusCode: 403, body: 'Forbidden' };
    }

    const store = getStore('premium-users');
    const { blobs } = await store.list();

    const users = await Promise.all(
        blobs.map(async ({ key }) => {
            const data = await store.get(key, { type: 'json' });
            return { email: key, ...(data || { tier: 'free' }) };
        })
    );

    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify(users)
    };
};
