"""Notification model for push notifications."""

from datetime import datetime
from typing import List, Optional, TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base

if TYPE_CHECKING:
    from models.user import User


class Notification(Base):
    """Push notification model."""

    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    
    type: Mapped[str] = mapped_column(String(50), nullable=False)  # "arbitrage", "price", "social", "news"
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    
    # Optional data payload
    data: Mapped[Optional[str]] = mapped_column(Text)  # JSON string
    
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    is_sent: Mapped[bool] = mapped_column(Boolean, default=False)  # Push sent to device
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="notifications")

    @classmethod
    async def get_by_id(cls, db: AsyncSession, notification_id: int) -> Optional["Notification"]:
        """Get notification by ID."""
        result = await db.execute(select(cls).where(cls.id == notification_id))
        return result.scalar_one_or_none()

    @classmethod
    async def get_for_user(
        cls,
        db: AsyncSession,
        user_id: int,
        limit: int = 50,
        unread_only: bool = False,
    ) -> List["Notification"]:
        """Get notifications for a user."""
        query = select(cls).where(cls.user_id == user_id)
        
        if unread_only:
            query = query.where(cls.is_read == False)
        
        query = query.order_by(cls.created_at.desc()).limit(limit)
        result = await db.execute(query)
        return list(result.scalars().all())

    @classmethod
    async def mark_all_read(cls, db: AsyncSession, user_id: int) -> None:
        """Mark all notifications as read for a user."""
        await db.execute(
            update(cls)
            .where(cls.user_id == user_id, cls.is_read == False)
            .values(is_read=True)
        )
        await db.commit()

    @classmethod
    async def get_unread_count(cls, db: AsyncSession, user_id: int) -> int:
        """Get count of unread notifications."""
        result = await db.execute(
            select(func.count(cls.id)).where(
                cls.user_id == user_id,
                cls.is_read == False,
            )
        )
        return result.scalar() or 0
