import { Router } from 'express';

const router = Router();

/**
 * POST /webhook/email
 * Handle incoming email webhooks from AgentMail.
 *
 * AgentMail sends POST requests here when:
 *  - A new email arrives at stratify@agentmail.to
 *  - An email is sent
 *  - Other email events
 */
router.post('/email', async (req, res) => {
    try {
          const payload = req.body;
          console.log('📬 Email webhook received:', JSON.stringify(payload, null, 2));

      const eventType = payload.event || 'unknown';

      // Handle different event types
      if (eventType === 'email.received') {
              const { from, to, subject, body } = payload.data || {};
              console.log(`📥 New email from ${from} to ${to}: ${subject}`);
              // TODO: Add your email processing logic here
      } else if (eventType === 'email.sent') {
              console.log('✅ Email sent successfully');
      } else {
              console.log(`📨 Unhandled email event: ${eventType}`);
      }

      res.json({ status: 'ok', received: eventType });
    } catch (error) {
          console.error('❌ Webhook error:', error);
          res.status(400).json({ error: error.message });
    }
});

/**
 * GET /webhook/email
 * Health check for the webhook endpoint.
 */
router.get('/email', (req, res) => {
    res.json({ status: 'ok', endpoint: 'email_webhook' });
});

export default router;
