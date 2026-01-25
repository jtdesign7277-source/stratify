"""Authentication schemas."""

from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    """Schema for user registration."""
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=8)


class UserResponse(BaseModel):
    """Schema for user response (without password)."""
    id: int
    email: str
    username: str
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    theme: str = "dark"
    is_verified: bool = False
    is_premium: bool = False

    class Config:
        from_attributes = True


class Token(BaseModel):
    """Schema for JWT token response."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenRefresh(BaseModel):
    """Schema for token refresh request."""
    refresh_token: str
