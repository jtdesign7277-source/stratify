"""User database model."""

from datetime import datetime
from typing import List, Optional, TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Integer, String, Text, func, select, JSON
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base

if TYPE_CHECKING:
    from models.social import Post, Comment, Like
    from models.notification import Notification


class User(Base):
    """User model for authentication and profile data."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    
    # Profile
    display_name: Mapped[Optional[str]] = mapped_column(String(100))
    bio: Mapped[Optional[str]] = mapped_column(Text)
    avatar_url: Mapped[Optional[str]] = mapped_column(String(500))
    
    # Preferences
    theme: Mapped[str] = mapped_column(String(10), default="dark")  # "dark" or "light"
    watchlist: Mapped[Optional[List[str]]] = mapped_column(JSON, default=list)
    
    # Notifications
    notifications_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    alert_arbitrage: Mapped[bool] = mapped_column(Boolean, default=True)
    alert_price: Mapped[bool] = mapped_column(Boolean, default=True)
    alert_social: Mapped[bool] = mapped_column(Boolean, default=True)
    alert_news: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # Device tokens for push notifications
    device_token: Mapped[Optional[str]] = mapped_column(String(500))
    device_platform: Mapped[Optional[str]] = mapped_column(String(20))  # "ios" or "android"
    
    # Leaderboard stats
    total_trades: Mapped[int] = mapped_column(Integer, default=0)
    win_rate: Mapped[float] = mapped_column(default=0.0)
    total_profit: Mapped[float] = mapped_column(default=0.0)
    weekly_profit: Mapped[float] = mapped_column(default=0.0)
    monthly_profit: Mapped[float] = mapped_column(default=0.0)
    
    # Account status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    is_premium: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )
    last_login: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    # Relationships
    posts: Mapped[List["Post"]] = relationship("Post", back_populates="user", cascade="all, delete-orphan")
    comments: Mapped[List["Comment"]] = relationship("Comment", back_populates="user", cascade="all, delete-orphan")
    likes: Mapped[List["Like"]] = relationship("Like", back_populates="user", cascade="all, delete-orphan")
    notifications: Mapped[List["Notification"]] = relationship("Notification", back_populates="user", cascade="all, delete-orphan")

    @classmethod
    async def get_by_id(cls, db: AsyncSession, user_id: int) -> Optional["User"]:
        """Get user by ID."""
        result = await db.execute(select(cls).where(cls.id == user_id))
        return result.scalar_one_or_none()

    @classmethod
    async def get_by_email(cls, db: AsyncSession, email: str) -> Optional["User"]:
        """Get user by email."""
        result = await db.execute(select(cls).where(cls.email == email))
        return result.scalar_one_or_none()

    @classmethod
    async def get_by_username(cls, db: AsyncSession, username: str) -> Optional["User"]:
        """Get user by username."""
        result = await db.execute(select(cls).where(cls.username == username))
        return result.scalar_one_or_none()

    @classmethod
    async def get_leaderboard(
        cls,
        db: AsyncSession,
        period: str = "weekly",
        limit: int = 50,
    ) -> List[dict]:
        """Get leaderboard rankings."""
        if period == "daily":
            order_col = cls.weekly_profit  # Use weekly as proxy for now
        elif period == "weekly":
            order_col = cls.weekly_profit
        elif period == "monthly":
            order_col = cls.monthly_profit
        else:  # all-time
            order_col = cls.total_profit

        result = await db.execute(
            select(cls)
            .where(cls.is_active == True)
            .order_by(order_col.desc())
            .limit(limit)
        )
        users = result.scalars().all()

        return [
            {
                "rank": idx + 1,
                "user_id": user.id,
                "username": user.username,
                "display_name": user.display_name,
                "avatar_url": user.avatar_url,
                "profit": getattr(user, order_col.key),
                "win_rate": user.win_rate,
                "total_trades": user.total_trades,
            }
            for idx, user in enumerate(users)
        ]

    @classmethod
    async def get_user_ranking(
        cls,
        db: AsyncSession,
        user_id: int,
        period: str = "weekly",
    ) -> dict:
        """Get a specific user's ranking."""
        leaderboard = await cls.get_leaderboard(db, period, limit=1000)
        for entry in leaderboard:
            if entry["user_id"] == user_id:
                return entry
        return {"rank": None, "user_id": user_id}
