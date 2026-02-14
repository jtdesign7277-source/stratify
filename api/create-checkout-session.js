import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: 'Stripe secret key not configured' });
  }

  try {
    const { priceId, userId, userEmail } = req.body || {};

    if (!priceId || !userId || !userEmail) {
      return res.status(400).json({ error: 'Missing required fields: priceId, userId, userEmail' });
    }

    const origin = process.env.VITE_APP_URL || 'https://stratify-black.vercel.app';

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pricing`,
      client_reference_id: userId,
      customer_email: userEmail,
      metadata: { userId },
    });

    return res.status(200).json({ sessionId: session.id, url: session.url });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
