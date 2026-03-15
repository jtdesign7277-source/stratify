// api/sentinel/subscribe.js — Create Stripe checkout for Sentinel YOLO ($29.99/month)
// POST — requires auth

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Extract user from Supabase JWT
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing auth token' });
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid auth token' });
  }

  try {
    const priceId = process.env.STRIPE_SENTINEL_PRICE_ID;
    if (!priceId) {
      return res.status(500).json({ error: 'STRIPE_SENTINEL_PRICE_ID not configured' });
    }

    const appUrl = process.env.VITE_APP_URL || 'https://stratifymarket.com';

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: 7,
        metadata: { user_id: user.id, product: 'sentinel_yolo' },
      },
      client_reference_id: user.id,
      metadata: { user_id: user.id, product: 'sentinel_yolo' },
      success_url: `${appUrl}/dashboard?sentinel=subscribed`,
      cancel_url: `${appUrl}/dashboard?sentinel=canceled`,
    });

    return res.status(200).json({ checkoutUrl: session.url });
  } catch (err) {
    console.error('[sentinel/subscribe] Error:', err);
    return res.status(500).json({ error: err.message });
  }
}
