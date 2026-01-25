"""Notification schemas."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class NotificationResponse(BaseModel):
    """Notification response schema."""
    id: int
    type: str
    title: str
    body: str
    data: Optional[str] = None
    is_read: bool = False
    created_at: datetime

    class Config:
        from_attributes = True


class NotificationSettings(BaseModel):
    """Notification settings schema."""
    push_enabled: Optional[bool] = None
    arbitrage_alerts: Optional[bool] = None
    price_alerts: Optional[bool] = None
    social_alerts: Optional[bool] = None
    news_alerts: Optional[bool] = None
