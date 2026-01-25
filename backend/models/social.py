"""Social feed models - Posts, Comments, Likes."""

from datetime import datetime
from typing import List, Optional, TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func, select, JSON
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base

if TYPE_CHECKING:
    from models.user import User


class Post(Base):
    """Social feed post model."""

    __tablename__ = "posts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    
    content: Mapped[str] = mapped_column(Text, nullable=False)
    symbols: Mapped[Optional[List[str]]] = mapped_column(JSON, default=list)  # Stock symbols mentioned
    image_url: Mapped[Optional[str]] = mapped_column(String(500))
    
    # Engagement counts (denormalized for performance)
    likes_count: Mapped[int] = mapped_column(Integer, default=0)
    comments_count: Mapped[int] = mapped_column(Integer, default=0)
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="posts")
    comments: Mapped[List["Comment"]] = relationship("Comment", back_populates="post", cascade="all, delete-orphan")
    likes: Mapped[List["Like"]] = relationship("Like", back_populates="post", cascade="all, delete-orphan")

    @classmethod
    async def get_by_id(cls, db: AsyncSession, post_id: int) -> Optional["Post"]:
        """Get post by ID."""
        result = await db.execute(select(cls).where(cls.id == post_id))
        return result.scalar_one_or_none()

    @classmethod
    async def get_feed(
        cls,
        db: AsyncSession,
        offset: int = 0,
        limit: int = 20,
    ) -> List["Post"]:
        """Get posts for the social feed."""
        result = await db.execute(
            select(cls)
            .order_by(cls.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        return list(result.scalars().all())

    @classmethod
    async def get_by_user(
        cls,
        db: AsyncSession,
        user_id: int,
        offset: int = 0,
        limit: int = 20,
    ) -> List["Post"]:
        """Get posts by a specific user."""
        result = await db.execute(
            select(cls)
            .where(cls.user_id == user_id)
            .order_by(cls.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        return list(result.scalars().all())


class Comment(Base):
    """Comment on a post."""

    __tablename__ = "comments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    post_id: Mapped[int] = mapped_column(Integer, ForeignKey("posts.id"), nullable=False)
    
    content: Mapped[str] = mapped_column(Text, nullable=False)
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="comments")
    post: Mapped["Post"] = relationship("Post", back_populates="comments")


class Like(Base):
    """Like on a post."""

    __tablename__ = "likes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    post_id: Mapped[int] = mapped_column(Integer, ForeignKey("posts.id"), nullable=False)
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="likes")
    post: Mapped["Post"] = relationship("Post", back_populates="likes")

    @classmethod
    async def get_by_user_and_post(
        cls,
        db: AsyncSession,
        user_id: int,
        post_id: int,
    ) -> Optional["Like"]:
        """Check if a user has liked a post."""
        result = await db.execute(
            select(cls).where(
                cls.user_id == user_id,
                cls.post_id == post_id,
            )
        )
        return result.scalar_one_or_none()
