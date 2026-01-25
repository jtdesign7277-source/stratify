"""Social feed and leaderboard endpoints."""

from typing import Annotated, List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from api.auth import get_current_user
from core.database import get_db
from models.user import User
from models.social import Post, Comment, Like
from schemas.social import (
    PostCreate,
    PostResponse,
    CommentCreate,
    CommentResponse,
    LeaderboardEntry,
)

router = APIRouter()


@router.get("/feed", response_model=List[PostResponse])
async def get_feed(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
) -> list:
    """Get social feed with posts from all users."""
    offset = (page - 1) * limit
    posts = await Post.get_feed(db, offset=offset, limit=limit)
    return posts


@router.post("/posts", response_model=PostResponse, status_code=201)
async def create_post(
    post_data: PostCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Post:
    """Create a new post."""
    post = Post(
        user_id=current_user.id,
        content=post_data.content,
        symbols=post_data.symbols,
        image_url=post_data.image_url,
    )
    db.add(post)
    await db.commit()
    await db.refresh(post)
    
    return post


@router.get("/posts/{post_id}", response_model=PostResponse)
async def get_post(
    post_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Post:
    """Get a specific post."""
    post = await Post.get_by_id(db, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return post


@router.delete("/posts/{post_id}")
async def delete_post(
    post_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, str]:
    """Delete a post (only owner can delete)."""
    post = await Post.get_by_id(db, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.delete(post)
    await db.commit()
    
    return {"status": "deleted"}


@router.post("/posts/{post_id}/like")
async def like_post(
    post_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, str]:
    """Like a post."""
    post = await Post.get_by_id(db, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    existing_like = await Like.get_by_user_and_post(db, current_user.id, post_id)
    if existing_like:
        return {"status": "already_liked"}
    
    like = Like(user_id=current_user.id, post_id=post_id)
    db.add(like)
    await db.commit()
    
    return {"status": "liked"}


@router.delete("/posts/{post_id}/like")
async def unlike_post(
    post_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, str]:
    """Unlike a post."""
    like = await Like.get_by_user_and_post(db, current_user.id, post_id)
    if like:
        await db.delete(like)
        await db.commit()
    
    return {"status": "unliked"}


@router.post("/posts/{post_id}/comments", response_model=CommentResponse, status_code=201)
async def add_comment(
    post_id: int,
    comment_data: CommentCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Comment:
    """Add a comment to a post."""
    post = await Post.get_by_id(db, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    comment = Comment(
        user_id=current_user.id,
        post_id=post_id,
        content=comment_data.content,
    )
    db.add(comment)
    await db.commit()
    await db.refresh(comment)
    
    return comment


@router.get("/leaderboard", response_model=List[LeaderboardEntry])
async def get_leaderboard(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    period: str = Query("weekly", description="Period: daily, weekly, monthly, all-time"),
    limit: int = Query(50, ge=1, le=100),
) -> list:
    """Get trading leaderboard."""
    leaderboard = await User.get_leaderboard(db, period=period, limit=limit)
    return leaderboard


@router.get("/leaderboard/me")
async def get_my_ranking(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    period: str = Query("weekly"),
) -> dict:
    """Get current user's ranking on the leaderboard."""
    ranking = await User.get_user_ranking(db, current_user.id, period=period)
    return ranking
