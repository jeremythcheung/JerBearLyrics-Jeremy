const { getStore } = require('@netlify/blobs');

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

    let email;
    try {
        ({ email } = JSON.parse(event.body || '{}'));
    } catch {
        return { statusCode: 400, body: 'Invalid JSON' };
    }

    if (!email) {
        return { statusCode: 400, body: 'No email provided' };
    }

    const store = getStore('premium-users');
    const data = await store.get(email.toLowerCase(), { type: 'json' });

    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify(data || { tier: 'free' })
    };
};
