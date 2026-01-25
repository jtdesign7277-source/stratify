"""User management endpoints."""

from typing import Annotated, List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from api.auth import get_current_user
from core.database import get_db
from models.user import User
from schemas.user import UserPreferences, UserProfile, UserUpdate

router = APIRouter()


@router.get("/profile", response_model=UserProfile)
async def get_profile(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    """Get current user's full profile."""
    return current_user


@router.patch("/profile", response_model=UserProfile)
async def update_profile(
    update_data: UserUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """Update current user's profile."""
    update_dict = update_data.model_dump(exclude_unset=True)
    
    for field, value in update_dict.items():
        setattr(current_user, field, value)
    
    await db.commit()
    await db.refresh(current_user)
    
    return current_user


@router.get("/preferences", response_model=UserPreferences)
async def get_preferences(
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict:
    """Get user preferences."""
    return {
        "theme": current_user.theme or "dark",
        "notifications_enabled": current_user.notifications_enabled,
        "watchlist": current_user.watchlist or [],
    }


@router.patch("/preferences", response_model=UserPreferences)
async def update_preferences(
    preferences: UserPreferences,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Update user preferences (theme, notifications, watchlist)."""
    if preferences.theme is not None:
        current_user.theme = preferences.theme
    if preferences.notifications_enabled is not None:
        current_user.notifications_enabled = preferences.notifications_enabled
    if preferences.watchlist is not None:
        current_user.watchlist = preferences.watchlist
    
    await db.commit()
    
    return {
        "theme": current_user.theme,
        "notifications_enabled": current_user.notifications_enabled,
        "watchlist": current_user.watchlist or [],
    }


@router.post("/device-token")
async def register_device_token(
    device_token: str,
    platform: str,  # "ios" or "android"
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, str]:
    """Register device token for push notifications."""
    current_user.device_token = device_token
    current_user.device_platform = platform
    
    await db.commit()
    
    return {"status": "registered"}
