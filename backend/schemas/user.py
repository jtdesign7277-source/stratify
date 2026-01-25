"""User schemas."""

from typing import List, Optional

from pydantic import BaseModel, Field


class UserProfile(BaseModel):
    """Full user profile schema."""
    id: int
    email: str
    username: str
    display_name: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    theme: str = "dark"
    
    # Stats
    total_trades: int = 0
    win_rate: float = 0.0
    total_profit: float = 0.0
    
    # Status
    is_verified: bool = False
    is_premium: bool = False

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    """Schema for updating user profile."""
    display_name: Optional[str] = Field(None, max_length=100)
    bio: Optional[str] = Field(None, max_length=500)
    avatar_url: Optional[str] = None


class UserPreferences(BaseModel):
    """User preferences schema."""
    theme: Optional[str] = Field(None, pattern="^(dark|light)$")
    notifications_enabled: Optional[bool] = None
    watchlist: Optional[List[str]] = None
