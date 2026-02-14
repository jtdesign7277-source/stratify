import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export const config = {
  api: { bodyParser: false },
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Stripe-Signature');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(500).json({ error: 'Stripe webhook not configured' });
  }

  if (!process.env.VITE_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Supabase server keys not configured' });
  }

  const signatureHeader = req.headers['stripe-signature'];
  const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
  if (!signature) {
    return res.status(400).json({ error: 'Missing Stripe signature' });
  }

  let event;
  try {
    const rawBody = await readRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.client_reference_id;
        const customerId = session.customer;
        const subscriptionId = session.subscription;

        if (userId) {
          const { error } = await supabase
            .from('profiles')
            .update({
              subscription_status: 'pro',
              stripe_customer_id: customerId || null,
              stripe_subscription_id: subscriptionId || null,
            })
            .eq('id', userId);

          if (error) {
            console.error('Supabase update error (checkout.session.completed):', error);
          }
        } else {
          console.error('Missing client_reference_id on checkout.session.completed');
        }
        break;
      }
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const status = subscription.status;
        const customerId = subscription.customer;
        const subscriptionStatus = ['active', 'trialing'].includes(status) ? 'pro' : 'free';

        const { error } = await supabase
          .from('profiles')
          .update({
            subscription_status: subscriptionStatus,
            stripe_subscription_id: subscription.id || null,
          })
          .eq('stripe_customer_id', customerId);

        if (error) {
          console.error('Supabase update error (customer.subscription.updated):', error);
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customerId = subscription.customer;

        const { error } = await supabase
          .from('profiles')
          .update({
            subscription_status: 'free',
            stripe_customer_id: null,
            stripe_subscription_id: null,
          })
          .eq('stripe_customer_id', customerId);

        if (error) {
          console.error('Supabase update error (customer.subscription.deleted):', error);
        }
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error('Webhook handler error:', err);
  }

  return res.status(200).json({ received: true });
}
