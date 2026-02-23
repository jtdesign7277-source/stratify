import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const ACTIVE_STRIPE_STATUSES = new Set(['active', 'trialing', 'past_due']);
const PRO_STATUSES = new Set(['pro', 'elite', 'active', 'trialing', 'paid']);

const normalizeStatus = (value) => String(value || '').toLowerCase().trim();

const isStripeSubscriptionActive = (subscription) => {
  const status = normalizeStatus(subscription?.status);
  return ACTIVE_STRIPE_STATUSES.has(status);
};

const toSubscriptionPayload = (subscription, customerId) => ({
  subscriptionId: typeof subscription?.id === 'string' ? subscription.id : null,
  subscriptionStatus: normalizeStatus(subscription?.status),
  customerId: customerId || (typeof subscription?.customer === 'string' ? subscription.customer : subscription?.customer?.id || null),
});

const findActiveSubscriptionForCustomer = async (customerId) => {
  if (!customerId) return null;

  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: 'all',
    limit: 20,
  });

  const active = subscriptions.data.find(isStripeSubscriptionActive);
  if (!active) return null;
  return toSubscriptionPayload(active, customerId);
};

const findActiveSubscriptionByEmail = async (email) => {
  if (!email) return null;

  const customers = await stripe.customers.list({
    email,
    limit: 10,
  });

  for (const customer of customers.data) {
    const match = await findActiveSubscriptionForCustomer(customer?.id);
    if (match) return match;
  }

  return null;
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
    const { userId, email } = req.body || {};

    if (!userId) {
      return res.status(400).json({ error: 'Missing required field: userId' });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, subscription_status, stripe_customer_id, stripe_subscription_id')
      .eq('id', userId)
      .single();

    if (profileError) {
      return res.status(500).json({ error: profileError.message || 'Unable to load user profile' });
    }

    const existingStatus = normalizeStatus(profile?.subscription_status || 'free');
    if (PRO_STATUSES.has(existingStatus)) {
      return res.status(200).json({
        ok: true,
        isPro: true,
        source: 'profile',
        subscriptionStatus: existingStatus,
      });
    }

    const profileSubscriptionId = profile?.stripe_subscription_id || null;
    const profileCustomerId = profile?.stripe_customer_id || null;

    let activeSubscription = null;

    if (profileSubscriptionId) {
      const subscription = await stripe.subscriptions.retrieve(profileSubscriptionId);
      if (isStripeSubscriptionActive(subscription)) {
        activeSubscription = toSubscriptionPayload(subscription, profileCustomerId);
      }
    }

    if (!activeSubscription && profileCustomerId) {
      activeSubscription = await findActiveSubscriptionForCustomer(profileCustomerId);
    }

    if (!activeSubscription) {
      activeSubscription = await findActiveSubscriptionByEmail(email);
    }

    if (!activeSubscription) {
      return res.status(200).json({
        ok: true,
        isPro: false,
        source: 'stripe',
        subscriptionStatus: existingStatus || 'free',
      });
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        subscription_status: 'pro',
        stripe_customer_id: activeSubscription.customerId,
        stripe_subscription_id: activeSubscription.subscriptionId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (updateError) {
      return res.status(500).json({ error: updateError.message || 'Failed to update profile subscription' });
    }

    return res.status(200).json({
      ok: true,
      isPro: true,
      source: 'stripe',
      subscriptionStatus: 'pro',
      stripeSubscriptionStatus: activeSubscription.subscriptionStatus || null,
    });
  } catch (error) {
    return res.status(500).json({
      error: error?.message || 'Unable to refresh subscription',
    });
  }
}
