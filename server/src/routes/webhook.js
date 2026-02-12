import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';

const router = Router();

// ─── Supabase client ───
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ─── Telegram notification helper ───
async function notifyTelegram(message) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.warn('⚠️ Telegram not configured — skipping notification');
    return;
  }
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown',
      }),
    });
  } catch (err) {
    console.error('❌ Telegram notification failed:', err.message);
  }
}

// ─── AI: Categorize the email ───
async function categorizeEmail(subject, body) {
  const apiKey = process.env.OPENAI_API_KEY || process.env.XAI_API_KEY;
  if (!apiKey) return 'uncategorized';

  const isGrok = !process.env.OPENAI_API_KEY && process.env.XAI_API_KEY;
  const baseUrl = isGrok
    ? 'https://api.x.ai/v1/chat/completions'
    : 'https://api.openai.com/v1/chat/completions';
  const model = isGrok ? 'grok-3' : 'gpt-4o-mini';

  try {
    const resp = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content:
              'You are an email classifier. Respond with ONLY one word — the category. Valid categories: support, sales, spam, billing, partnership, feedback, general. Nothing else.',
          },
          {
            role: 'user',
            content: `Subject: ${subject}\n\nBody: ${(body || '').slice(0, 500)}`,
          },
        ],
        temperature: 0,
        max_tokens: 10,
      }),
    });
    const data = await resp.json();
    const category = (data.choices?.[0]?.message?.content || 'general')
      .trim()
      .toLowerCase();
    const valid = ['support', 'sales', 'spam', 'billing', 'partnership', 'feedback', 'general'];
    return valid.includes(category) ? category : 'general';
  } catch (err) {
    console.error('❌ Categorization failed:', err.message);
    return 'general';
  }
}

// ─── AI: Generate a smart reply for simple questions ───
async function generateSmartReply(subject, body, category) {
  const apiKey = process.env.OPENAI_API_KEY || process.env.XAI_API_KEY;
  if (!apiKey) return null;

  // Only auto-reply for certain categories (not spam, not sales)
  const autoReplyCategories = ['support', 'general', 'feedback', 'billing'];
  if (!autoReplyCategories.includes(category)) return null;

  const isGrok = !process.env.OPENAI_API_KEY && process.env.XAI_API_KEY;
  const baseUrl = isGrok
    ? 'https://api.x.ai/v1/chat/completions'
    : 'https://api.openai.com/v1/chat/completions';
  const model = isGrok ? 'grok-3' : 'gpt-4o-mini';

  try {
    const resp = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: `You are a helpful customer service AI for Stratify, a financial technology platform. Write a short, friendly, professional reply to this email. If the question is simple and you can answer it, do so. If it's complex, acknowledge receipt and say the team will follow up soon. Keep it under 150 words. Sign off as "Stratify Team".`,
          },
          {
            role: 'user',
            content: `Subject: ${subject}\n\nBody: ${(body || '').slice(0, 1000)}`,
          },
        ],
        temperature: 0.7,
        max_tokens: 300,
      }),
    });
    const data = await resp.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch (err) {
    console.error('❌ Smart reply generation failed:', err.message);
    return null;
  }
}

// ─── Send reply via AgentMail ───
async function sendReply(toAddress, subject, replyBody) {
  const agentMailKey = process.env.AGENTMAIL_API_KEY;
  if (!agentMailKey) {
    console.warn('⚠️ AGENTMAIL_API_KEY not set — cannot send reply');
    return false;
  }
  try {
    const resp = await fetch('https://api.agentmail.to/v0/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${agentMailKey}`,
      },
      body: JSON.stringify({
        from: 'stratify@agentmail.to',
        to: toAddress,
        subject: `Re: ${subject}`,
        body: replyBody,
      }),
    });
    return resp.ok;
  } catch (err) {
    console.error('❌ Reply send failed:', err.message);
    return false;
  }
}

// ═══════════════════════════════════════════════
// POST /webhook/email — Main webhook handler
// ═══════════════════════════════════════════════
router.post('/email', async (req, res) => {
  try {
    const payload = req.body;
    console.log('📬 Email webhook received:', JSON.stringify(payload, null, 2));

    const eventType = payload.event || 'unknown';

    if (eventType === 'email.received') {
      const { from, to, subject, body } = payload.data || {};
      console.log(`📥 New email from ${from} to ${to}: ${subject}`);

      // ── Step 1: Categorize with AI ──
      const category = await categorizeEmail(subject, body);
      console.log(`🏷️  Category: ${category}`);

      // ── Step 2: Log to Supabase ──
      const { data: dbRecord, error: dbError } = await supabase
        .from('emails')
        .insert({
          from_address: from,
          to_address: to,
          subject,
          body,
          category,
          raw_payload: payload,
        })
        .select()
        .single();

      if (dbError) {
        console.error('❌ Supabase insert error:', dbError);
      } else {
        console.log('✅ Email logged to Supabase:', dbRecord.id);
      }

      // ── Step 3: Notify via Telegram ──
      const categoryEmoji = {
        support: '🛠️',
        sales: '💰',
        spam: '🚫',
        billing: '💳',
        partnership: '🤝',
        feedback: '📝',
        general: '📧',
      };
      const emoji = categoryEmoji[category] || '📧';

      await notifyTelegram(
        `${emoji} *New Email Received*\n\n` +
          `*From:* ${from}\n` +
          `*Subject:* ${subject}\n` +
          `*Category:* ${category}\n` +
          `*Time:* ${new Date().toLocaleString()}\n\n` +
          `_Preview:_ ${(body || '').slice(0, 200)}...`
      );

      // ── Step 4: Send auto-acknowledgment ──
      const ackSent = await sendReply(
        from,
        subject,
        `Hi there,\n\nThank you! We received your email and will be in touch soon.\n\nBest,\nStratify Team`
      );
      console.log(ackSent ? '✅ Acknowledgment sent' : '⚠️ Acknowledgment skipped');

      // ── Step 5: AI smart reply (for simple questions) ──
      let smartReply = null;
      if (category !== 'spam') {
        smartReply = await generateSmartReply(subject, body, category);
        if (smartReply) {
          const smartSent = await sendReply(from, subject, smartReply);
          console.log(smartSent ? '🤖 Smart reply sent' : '⚠️ Smart reply send failed');

          // Update Supabase with the AI reply
          if (dbRecord?.id) {
            await supabase
              .from('emails')
              .update({ ai_reply_sent: true, ai_reply_text: smartReply })
              .eq('id', dbRecord.id);
          }
        }
      }

      // ── Step 6: Category-based routing ──
      switch (category) {
        case 'spam':
          console.log('🚫 Spam detected — no further action');
          break;
        case 'sales':
          console.log('💰 Sales inquiry — flagged for sales team');
          await notifyTelegram(`💰 *Sales Lead!*\nFrom: ${from}\nSubject: ${subject}`);
          break;
        case 'support':
          console.log('🛠️ Support request — AI reply sent if applicable');
          break;
        case 'billing':
          console.log('💳 Billing inquiry — flagged for billing team');
          await notifyTelegram(`💳 *Billing Request*\nFrom: ${from}\nSubject: ${subject}`);
          break;
        case 'partnership':
          console.log('🤝 Partnership inquiry — flagged for review');
          await notifyTelegram(`🤝 *Partnership Inquiry!*\nFrom: ${from}\nSubject: ${subject}`);
          break;
        default:
          console.log(`📧 General email — category: ${category}`);
      }

      res.json({
        status: 'ok',
        received: eventType,
        category,
        aiReplySent: !!smartReply,
        logged: !dbError,
      });
    } else if (eventType === 'email.sent') {
      console.log('✅ Email sent successfully');
      res.json({ status: 'ok', received: eventType });
    } else {
      console.log(`📨 Unhandled email event: ${eventType}`);
      res.json({ status: 'ok', received: eventType });
    }
  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Health check
router.get('/email', (req, res) => {
  res.json({ status: 'ok', endpoint: 'email_webhook', features: ['supabase', 'telegram', 'ai-categorize', 'ai-reply', 'auto-ack'] });
});

export default router;
