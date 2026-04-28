const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const sig = event.headers['stripe-signature'];
    let stripeEvent;

    try {
        stripeEvent = stripe.webhooks.constructEvent(
            event.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
        console.error('Webhook signature error:', err.message);
        return { statusCode: 400, body: `Webhook Error: ${err.message}` };
    }

    if (stripeEvent.type === 'checkout.session.completed') {
        const session = stripeEvent.data.object;
        const email = session.customer_details?.email?.toLowerCase();

        if (!email) {
            return { statusCode: 400, body: 'No email found' };
        }

        // Determine tier based on which price was purchased
        const priceId = session.line_items?.data?.[0]?.price?.id || '';
        const isFullTier = priceId === process.env.STRIPE_PRICE_FULL;
        const tier = isFullTier ? 'full' : 'searches';

        const store = getStore('premium-users');
        await store.setJSON(email, {
            tier,
            activatedAt: new Date().toISOString()
        });

        console.log(`Unlocked ${tier} for ${email}`);
    }

    return { statusCode: 200, body: 'OK' };
};
