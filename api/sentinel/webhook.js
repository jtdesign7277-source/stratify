// api/sentinel/webhook.js — Stripe webhook handler for Sentinel subscriptions

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export const config = {
  api: { bodyParser: false },
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const readRawBody = async (req) => {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
};

async function findUserByCustomerId(customerId) {
  const { data } = await supabase
    .from('sentinel_user_settings')
    .select('user_id')
    .eq('stripe_subscription_id', customerId)
    .maybeSingle();
  return data?.user_id || null;
}

async function upsertUserSettings(userId, updates) {
  const { error } = await supabase
    .from('sentinel_user_settings')
    .upsert({ user_id: userId, ...updates, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) console.error('[sentinel/webhook] Upsert error:', error);
}

async function createNotification(userId, type, title, body) {
  await supabase.from('sentinel_notifications').insert({
    user_id: userId,
    type,
    title,
    body,
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Stripe-Signature');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const webhookSecret = process.env.STRIPE_SENTINEL_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  const signature = req.headers['stripe-signature'];
  if (!signature) {
    return res.status(400).json({ error: 'Missing Stripe signature' });
  }

  let event;
  try {
    const rawBody = await readRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    return res.status(400).json({ error: `Verification failed: ${err.message}` });
  }

  try {
    switch (event.type) {
      case 'customer.subscription.trial_will_end': {
        const sub = event.data.object;
        const userId = sub.metadata?.user_id;
        if (userId) {
          await createNotification(userId, 'session_summary', 'Trial ending soon', 'Your Sentinel trial ends in 3 days. Subscribe to keep copying trades.');
        }
        break;
      }

      case 'customer.subscription.created': {
        const sub = event.data.object;
        const userId = sub.metadata?.user_id;
        if (!userId) break;

        const status = sub.status === 'trialing' ? 'trialing' : 'active';
        const updates = {
          stripe_subscription_id: sub.id,
          subscription_status: status,
          subscribed_at: new Date().toISOString(),
        };

        if (sub.trial_start) updates.trial_start = new Date(sub.trial_start * 1000).toISOString();
        if (sub.trial_end) updates.trial_end = new Date(sub.trial_end * 1000).toISOString();

        await upsertUserSettings(userId, updates);
        await createNotification(userId, 'yolo_unlocked', 'YOLO Unlocked', 'Your Sentinel subscription is active. Enable YOLO to start copying trades.');
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const userId = sub.metadata?.user_id || await findUserByCustomerId(sub.id);
        if (!userId) break;

        const status = ['active', 'trialing'].includes(sub.status) ? sub.status : 'inactive';
        await upsertUserSettings(userId, { subscription_status: status });
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const userId = sub.metadata?.user_id || await findUserByCustomerId(sub.id);
        if (!userId) break;

        await upsertUserSettings(userId, {
          subscription_status: 'canceled',
          yolo_active: false,
          canceled_at: new Date().toISOString(),
        });
        // Do NOT close copied trades — let them close naturally with Sentinel
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const sub = invoice.subscription
          ? await stripe.subscriptions.retrieve(invoice.subscription)
          : null;
        const userId = sub?.metadata?.user_id;
        if (userId) {
          await createNotification(userId, 'session_summary', 'Payment failed', 'Your Sentinel payment failed. Update your card to keep YOLO active.');
        }
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error('[sentinel/webhook] Handler error:', err);
  }

  return res.status(200).json({ received: true });
}
