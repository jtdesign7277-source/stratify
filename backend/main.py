"""Stratify Backend - FastAPI Application."""

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api import auth, market, notifications, social, users, websocket
from core.config import settings
from core.database import close_db, init_db
from core.redis import redis_client


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan handler for startup/shutdown."""
    # Startup
    print("🚀 Starting Stratify Backend...")
    await init_db()
    await redis_client.connect()
    print("✅ Database and Redis connected")
    
    yield
    
    # Shutdown
    print("🛑 Shutting down Stratify Backend...")
    await close_db()
    await redis_client.disconnect()
    print("✅ Connections closed")


app = FastAPI(
    title=settings.app_name,
    description="Finance Stock Scanning API for Stratify Mobile Apps",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(users.router, prefix="/api/v1/users", tags=["Users"])
app.include_router(market.router, prefix="/api/v1/market", tags=["Market Data"])
app.include_router(social.router, prefix="/api/v1/social", tags=["Social Feed"])
app.include_router(notifications.router, prefix="/api/v1/notifications", tags=["Notifications"])
app.include_router(websocket.router, prefix="/api/v1/ws", tags=["WebSocket"])


@app.get("/")
async def root() -> dict[str, str]:
    """Root endpoint - health check."""
    return {"status": "healthy", "app": settings.app_name}


@app.get("/health")
async def health_check() -> dict[str, str]:
    """Health check endpoint for Railway/load balancers."""
    return {"status": "ok"}
