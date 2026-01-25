"""Social feed schemas."""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class PostCreate(BaseModel):
    """Schema for creating a post."""
    content: str = Field(..., min_length=1, max_length=5000)
    symbols: Optional[List[str]] = None  # Stock symbols mentioned
    image_url: Optional[str] = None


class PostResponse(BaseModel):
    """Schema for post response."""
    id: int
    user_id: int
    content: str
    symbols: Optional[List[str]] = None
    image_url: Optional[str] = None
    likes_count: int = 0
    comments_count: int = 0
    created_at: datetime
    
    # User info (populated via join)
    username: Optional[str] = None
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None

    class Config:
        from_attributes = True


class CommentCreate(BaseModel):
    """Schema for creating a comment."""
    content: str = Field(..., min_length=1, max_length=1000)


class CommentResponse(BaseModel):
    """Schema for comment response."""
    id: int
    user_id: int
    post_id: int
    content: str
    created_at: datetime
    
    # User info
    username: Optional[str] = None
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None

    class Config:
        from_attributes = True


class LeaderboardEntry(BaseModel):
    """Leaderboard entry schema."""
    rank: int
    user_id: int
    username: str
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    profit: float
    win_rate: float
    total_trades: int
