"""Redis client configuration for caching and pub/sub."""

from typing import Optional

import redis.asyncio as redis

from core.config import settings


class RedisClient:
    """Redis client wrapper for async operations."""

    def __init__(self) -> None:
        self._client: Optional[redis.Redis] = None

    async def connect(self) -> None:
        """Initialize Redis connection."""
        self._client = redis.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True,
        )

    async def disconnect(self) -> None:
        """Close Redis connection."""
        if self._client:
            await self._client.close()

    @property
    def client(self) -> redis.Redis:
        """Get the Redis client instance."""
        if self._client is None:
            raise RuntimeError("Redis client not initialized. Call connect() first.")
        return self._client

    # Cache operations
    async def get(self, key: str) -> Optional[str]:
        """Get a value from cache."""
        return await self.client.get(key)

    async def set(
        self,
        key: str,
        value: str,
        expire: Optional[int] = None,
    ) -> None:
        """Set a value in cache with optional expiration (seconds)."""
        await self.client.set(key, value, ex=expire)

    async def delete(self, key: str) -> None:
        """Delete a key from cache."""
        await self.client.delete(key)

    # Real-time data caching
    async def cache_market_data(self, symbol: str, data: str, ttl: int = 60) -> None:
        """Cache market data for a symbol."""
        key = f"market:{symbol}"
        await self.set(key, data, expire=ttl)

    async def get_market_data(self, symbol: str) -> Optional[str]:
        """Get cached market data for a symbol."""
        return await self.get(f"market:{symbol}")

    # Pub/Sub for real-time updates
    async def publish(self, channel: str, message: str) -> None:
        """Publish a message to a channel."""
        await self.client.publish(channel, message)

    def pubsub(self) -> redis.client.PubSub:
        """Get a pubsub instance for subscriptions."""
        return self.client.pubsub()


# Global Redis client instance
redis_client = RedisClient()


async def get_redis() -> RedisClient:
    """Dependency for getting Redis client."""
    return redis_client
