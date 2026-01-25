"""Push notifications endpoints."""

from typing import Annotated, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from api.auth import get_current_user
from core.database import get_db
from models.user import User
from models.notification import Notification
from schemas.notification import NotificationResponse, NotificationSettings
from services.push_notification_service import push_service

router = APIRouter()


@router.get("/", response_model=List[NotificationResponse])
async def get_notifications(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = 50,
    unread_only: bool = False,
) -> list:
    """Get user's notifications."""
    notifications = await Notification.get_for_user(
        db,
        user_id=current_user.id,
        limit=limit,
        unread_only=unread_only,
    )
    return notifications


@router.post("/{notification_id}/read")
async def mark_as_read(
    notification_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, str]:
    """Mark a notification as read."""
    notification = await Notification.get_by_id(db, notification_id)
    
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    if notification.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    notification.is_read = True
    await db.commit()
    
    return {"status": "read"}


@router.post("/read-all")
async def mark_all_as_read(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, str]:
    """Mark all notifications as read."""
    await Notification.mark_all_read(db, current_user.id)
    return {"status": "all_read"}


@router.get("/settings", response_model=NotificationSettings)
async def get_notification_settings(
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict:
    """Get notification settings."""
    return {
        "push_enabled": current_user.notifications_enabled,
        "arbitrage_alerts": current_user.alert_arbitrage,
        "price_alerts": current_user.alert_price,
        "social_alerts": current_user.alert_social,
        "news_alerts": current_user.alert_news,
    }


@router.patch("/settings", response_model=NotificationSettings)
async def update_notification_settings(
    settings: NotificationSettings,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Update notification settings."""
    if settings.push_enabled is not None:
        current_user.notifications_enabled = settings.push_enabled
    if settings.arbitrage_alerts is not None:
        current_user.alert_arbitrage = settings.arbitrage_alerts
    if settings.price_alerts is not None:
        current_user.alert_price = settings.price_alerts
    if settings.social_alerts is not None:
        current_user.alert_social = settings.social_alerts
    if settings.news_alerts is not None:
        current_user.alert_news = settings.news_alerts
    
    await db.commit()
    
    return {
        "push_enabled": current_user.notifications_enabled,
        "arbitrage_alerts": current_user.alert_arbitrage,
        "price_alerts": current_user.alert_price,
        "social_alerts": current_user.alert_social,
        "news_alerts": current_user.alert_news,
    }


@router.post("/test")
async def send_test_notification(
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict[str, str]:
    """Send a test push notification to the user's device."""
    if not current_user.device_token:
        raise HTTPException(
            status_code=400,
            detail="No device token registered",
        )
    
    await push_service.send_notification(
        device_token=current_user.device_token,
        title="Stratify Test",
        body="This is a test notification from Stratify!",
        data={"type": "test"},
    )
    
    return {"status": "sent"}
