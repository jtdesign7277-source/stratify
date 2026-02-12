export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, email, subject, message } = req.body;
  
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const AGENTMAIL_API_KEY = process.env.AGENTMAIL_API_KEY;
  
  if (!AGENTMAIL_API_KEY) {
    console.error('AGENTMAIL_API_KEY not configured');
    return res.status(500).json({ error: 'Email service not configured' });
  }

  try {
    // Send email via AgentMail API
    const emailBody = `
New Contact Form Submission
============================

From: ${name}
Email: ${email}
Subject: ${subject}

Message:
${message}

---
Sent from Stratify Contact Form
    `.trim();

    const response = await fetch('https://api.agentmail.to/v0/inboxes/stratify@agentmail.to/drafts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AGENTMAIL_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        to: [{ address: 'stratify@agentmail.to' }],
        subject: `[Contact] ${subject} - from ${name}`,
        text: emailBody,
        replyTo: [{ address: email, name: name }]
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('AgentMail API error:', response.status, errorData);
      return res.status(500).json({ error: 'Failed to send email' });
    }

    const draft = await response.json();
    
    // Send the draft
    const sendResponse = await fetch(`https://api.agentmail.to/v0/inboxes/stratify@agentmail.to/drafts/${draft.id}/send`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AGENTMAIL_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!sendResponse.ok) {
      console.error('Failed to send draft:', sendResponse.status);
      return res.status(500).json({ error: 'Failed to send email' });
    }

    return res.status(200).json({ success: true, message: 'Email sent successfully' });
    
  } catch (error) {
    console.error('Contact form error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
