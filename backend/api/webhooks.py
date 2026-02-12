"""Webhook endpoints for external services like AgentMail."""

from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Optional, Any
import json
import httpx
import os

router = APIRouter()

# AgentMail config
AGENTMAIL_API_KEY = os.getenv("AGENTMAIL_API_KEY")
AGENTMAIL_INBOX = "stratify@agentmail.to"
AGENTMAIL_API_BASE = "https://api.agentmail.to/v0"

# Grok API config  
GROK_API_KEY = os.getenv("XAI_API_KEY")
GROK_API_URL = "https://api.x.ai/v1/chat/completions"

SYSTEM_PROMPT = """You are Stratify Support, a helpful AI assistant for the Stratify trading platform.

About Stratify:
- AI-powered algorithmic trading platform
- Features: Arb Scanner (arbitrage), Atlas AI (strategy builder), real-time alerts, backtesting
- Supports Alpaca broker for stocks and crypto
- Website: stratify.associates
- Twitter: @stratify_hq

Your role:
- Answer questions about Stratify's features and capabilities
- Help users understand how to use the platform
- Provide guidance on trading strategies and AI tools
- Be friendly, professional, and helpful
- Keep responses concise but thorough

Sign off emails with:
Best regards,
Stratify Support Team"""


async def generate_ai_response(user_message: str) -> str:
    """Generate AI response using Grok."""
    if not GROK_API_KEY:
        return "Thank you for contacting Stratify Support. Our team will get back to you shortly."
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                GROK_API_URL,
                headers={
                    "Authorization": f"Bearer {GROK_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "grok-3",
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": user_message}
                    ],
                    "max_tokens": 1000,
                    "temperature": 0.7
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                return data["choices"][0]["message"]["content"]
            else:
                print(f"Grok API error: {response.status_code} - {response.text}")
                return "Thank you for contacting Stratify Support. Our team will review your message and get back to you shortly."
                
    except Exception as e:
        print(f"AI response error: {e}")
        return "Thank you for contacting Stratify Support. Our team will review your message and get back to you shortly."


async def send_email_reply(to_email: str, subject: str, body: str, thread_id: str = None):
    """Send email reply via AgentMail API."""
    if not AGENTMAIL_API_KEY:
        print("❌ AGENTMAIL_API_KEY not configured")
        return False
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Create draft
            draft_payload = {
                "to": [to_email],
                "subject": f"Re: {subject}" if not subject.startswith("Re:") else subject,
                "text": body
            }
            
            if thread_id:
                draft_payload["thread_id"] = thread_id
            
            draft_response = await client.post(
                f"{AGENTMAIL_API_BASE}/inboxes/{AGENTMAIL_INBOX}/drafts",
                headers={
                    "Authorization": f"Bearer {AGENTMAIL_API_KEY}",
                    "Content-Type": "application/json"
                },
                json=draft_payload
            )
            
            if draft_response.status_code != 200:
                print(f"❌ Failed to create draft: {draft_response.text}")
                return False
            
            draft = draft_response.json()
            draft_id = draft.get("draft_id")
            
            # Send draft
            send_response = await client.post(
                f"{AGENTMAIL_API_BASE}/inboxes/{AGENTMAIL_INBOX}/drafts/{draft_id}/send",
                headers={
                    "Authorization": f"Bearer {AGENTMAIL_API_KEY}",
                    "Content-Type": "application/json"
                }
            )
            
            if send_response.status_code == 200:
                print(f"✅ Reply sent to {to_email}")
                return True
            else:
                print(f"❌ Failed to send: {send_response.text}")
                return False
                
    except Exception as e:
        print(f"❌ Send email error: {e}")
        return False


@router.post("/email")
async def handle_email_webhook(request: Request):
    """
    Handle incoming email webhooks from AgentMail.
    Auto-responds to user inquiries using AI.
    """
    try:
        payload = await request.json()
        print(f"📧 Email webhook received: {json.dumps(payload, indent=2)}")
        
        event_type = payload.get("event", "unknown")
        
        if event_type == "message.received":
            # New email received
            data = payload.get("data", {})
            
            # Extract email details
            from_addr = data.get("from", "")
            subject = data.get("subject", "No subject")
            body = data.get("text", "") or data.get("body", "") or data.get("preview", "")
            thread_id = data.get("thread_id")
            
            print(f"📬 New email from {from_addr}: {subject}")
            
            # Skip if it's from ourselves (avoid loops)
            if AGENTMAIL_INBOX in from_addr:
                print("⏭️ Skipping self-sent email")
                return {"status": "ok", "action": "skipped_self"}
            
            # Skip auto-replies and notifications
            if any(x in subject.lower() for x in ["auto-reply", "out of office", "delivery notification", "undeliverable"]):
                print("⏭️ Skipping auto-reply/notification")
                return {"status": "ok", "action": "skipped_autoreply"}
            
            # Generate AI response
            user_query = f"Subject: {subject}\n\nMessage:\n{body}"
            ai_response = await generate_ai_response(user_query)
            
            # Send reply
            await send_email_reply(from_addr, subject, ai_response, thread_id)
            
            return {"status": "ok", "action": "replied"}
            
        elif event_type == "message.sent":
            print(f"✅ Email sent successfully")
            return {"status": "ok", "event": "sent"}
            
        else:
            print(f"📨 Event: {event_type}")
            return {"status": "ok", "event": event_type}
        
    except Exception as e:
        print(f"❌ Webhook error: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/email")
async def webhook_health():
    """Health check for webhook endpoint."""
    return {"status": "ok", "endpoint": "email_webhook", "ai_enabled": bool(GROK_API_KEY)}
