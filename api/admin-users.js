const { Redis } = require('@upstash/redis');

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const ADMIN_SECRET = process.env.ADMIN_SECRET || 'jerbear-admin-2026';

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    const { secret } = req.body || {};
    if (secret !== ADMIN_SECRET) return res.status(403).send('Forbidden');

    const keys = await redis.keys('*');
    const users = await Promise.all(
        keys.map(async (key) => {
            const data = await redis.get(key);
            return { email: key, ...(data || { tier: 'free' }) };
        })
    );

    res.status(200).json(users);
};
