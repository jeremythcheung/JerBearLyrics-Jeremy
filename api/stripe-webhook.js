const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { Redis } = require('@upstash/redis');

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    const sig = req.headers['stripe-signature'];
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const rawBody = Buffer.concat(chunks);

    let stripeEvent;
    try {
        stripeEvent = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error('Webhook signature error:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (stripeEvent.type === 'checkout.session.completed') {
        const session = stripeEvent.data.object;
        const email = session.customer_details?.email?.toLowerCase();
        if (!email) return res.status(400).send('No email found');

        const priceId = session.line_items?.data?.[0]?.price?.id || '';
        const tier = priceId === process.env.STRIPE_PRICE_FULL ? 'full' : 'searches';

        await redis.set(email, { tier, activatedAt: new Date().toISOString() });
        console.log(`Unlocked ${tier} for ${email}`);
    }

    res.status(200).send('OK');
}

handler.config = { api: { bodyParser: false } };
module.exports = handler;
