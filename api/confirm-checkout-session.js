import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing', 'past_due']);

const resolveSubscriptionId = (subscriptionRef) => {
  if (!subscriptionRef) return null;
  if (typeof subscriptionRef === 'string') return subscriptionRef;
  if (typeof subscriptionRef === 'object' && subscriptionRef.id) return subscriptionRef.id;
  return null;
};

const resolveSubscriptionStatus = (subscriptionRef) => {
  if (!subscriptionRef || typeof subscriptionRef !== 'object') return null;
  const status = String(subscriptionRef.status || '').toLowerCase();
  return status || null;
};

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

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Supabase server keys not configured' });
  }

  try {
    const { sessionId, userId } = req.body || {};
    if (!sessionId) {
      return res.status(400).json({ error: 'Missing required field: sessionId' });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    });

    if (!session || session.object !== 'checkout.session') {
      return res.status(404).json({ error: 'Checkout session not found' });
    }

    const checkoutUserId = session.client_reference_id || session.metadata?.supabase_user_id || null;
    if (!checkoutUserId) {
      return res.status(400).json({ error: 'No user mapping found for checkout session' });
    }

    if (userId && checkoutUserId !== userId) {
      return res.status(403).json({ error: 'Checkout session does not belong to this user' });
    }

    const paymentStatus = String(session.payment_status || '').toLowerCase();
    const checkoutStatus = String(session.status || '').toLowerCase();
    const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id || null;
    const subscriptionId = resolveSubscriptionId(session.subscription);

    let subscriptionStatus = resolveSubscriptionStatus(session.subscription);
    if (!subscriptionStatus && subscriptionId) {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      subscriptionStatus = String(subscription?.status || '').toLowerCase();
    }

    const hasActiveSubscription = subscriptionStatus && ACTIVE_SUBSCRIPTION_STATUSES.has(subscriptionStatus);
    const canActivate = hasActiveSubscription || paymentStatus === 'paid' || checkoutStatus === 'complete';

    if (!canActivate) {
      return res.status(409).json({
        error: 'Checkout session is not finalized yet',
        checkoutStatus,
        paymentStatus,
        subscriptionStatus: subscriptionStatus || null,
      });
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        subscription_status: 'pro',
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', checkoutUserId);

    if (updateError) {
      return res.status(500).json({ error: updateError.message || 'Failed to update profile subscription' });
    }

    return res.status(200).json({
      ok: true,
      subscriptionStatus: 'pro',
      userId: checkoutUserId,
      checkoutStatus,
      paymentStatus,
      stripeSubscriptionStatus: subscriptionStatus || null,
    });
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'Unable to confirm checkout session' });
  }
}

