"""Webhook endpoints for external services like AgentMail."""

from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Optional, Any
import json

router = APIRouter()


class EmailWebhookPayload(BaseModel):
    """AgentMail webhook payload for email events."""
    event: str  # e.g., "email.received", "email.sent"
    data: dict[str, Any]
    timestamp: Optional[str] = None


@router.post("/email")
async def handle_email_webhook(request: Request):
    """
    Handle incoming email webhooks from AgentMail.
    
    AgentMail sends POST requests here when:
    - New email arrives at stratify@agentmail.to
    - Email is sent
    - Other email events
    """
    try:
        payload = await request.json()
        print(f"📧 Email webhook received: {json.dumps(payload, indent=2)}")
        
        # Extract event type
        event_type = payload.get("event", "unknown")
        
        # Handle different event types
        if event_type == "email.received":
            # New email received
            email_data = payload.get("data", {})
            from_addr = email_data.get("from", "unknown")
            subject = email_data.get("subject", "No subject")
            print(f"📬 New email from {from_addr}: {subject}")
            
            # TODO: Process incoming email
            # - Forward to AI agent
            # - Store in database
            # - Send notification
            
        elif event_type == "email.sent":
            print(f"✅ Email sent successfully")
            
        else:
            print(f"📨 Unhandled email event: {event_type}")
        
        return {"status": "ok", "received": event_type}
        
    except Exception as e:
        print(f"❌ Webhook error: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/email")
async def webhook_health():
    """Health check for webhook endpoint."""
    return {"status": "ok", "endpoint": "email_webhook"}
