"""Market data endpoints - Alpaca API integration."""

from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from api.auth import get_current_user
from models.user import User
from schemas.market import (
    MarketQuote,
    MarketBar,
    StockScreener,
    WatchlistItem,
    ArbitrageAlert,
)
from services.alpaca_service import alpaca_service
from core.redis import get_redis, RedisClient

router = APIRouter()


@router.get("/quote/{symbol}", response_model=MarketQuote)
async def get_quote(
    symbol: str,
    current_user: Annotated[User, Depends(get_current_user)],
    redis: Annotated[RedisClient, Depends(get_redis)],
) -> dict:
    """Get real-time quote for a symbol."""
    # Check cache first
    cached = await redis.get_market_data(symbol)
    if cached:
        import json
        return json.loads(cached)
    
    # Fetch from Alpaca
    quote = await alpaca_service.get_quote(symbol)
    
    # Cache for 30 seconds
    import json
    await redis.cache_market_data(symbol, json.dumps(quote), ttl=30)
    
    return quote


@router.get("/bars/{symbol}", response_model=List[MarketBar])
async def get_bars(
    symbol: str,
    current_user: Annotated[User, Depends(get_current_user)],
    timeframe: str = Query("1D", description="Timeframe: 1Min, 5Min, 15Min, 1H, 1D"),
    limit: int = Query(100, ge=1, le=1000),
) -> list:
    """Get historical bars/candles for a symbol."""
    bars = await alpaca_service.get_bars(symbol, timeframe, limit)
    return bars


@router.get("/screener", response_model=List[StockScreener])
async def stock_screener(
    current_user: Annotated[User, Depends(get_current_user)],
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    min_volume: Optional[int] = None,
    min_change_percent: Optional[float] = None,
    max_change_percent: Optional[float] = None,
    sector: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
) -> list:
    """Screen stocks based on criteria."""
    results = await alpaca_service.screen_stocks(
        min_price=min_price,
        max_price=max_price,
        min_volume=min_volume,
        min_change_percent=min_change_percent,
        max_change_percent=max_change_percent,
        sector=sector,
        limit=limit,
    )
    return results


@router.get("/watchlist", response_model=List[WatchlistItem])
async def get_watchlist(
    current_user: Annotated[User, Depends(get_current_user)],
) -> list:
    """Get user's watchlist with current prices."""
    if not current_user.watchlist:
        return []
    
    watchlist_data = []
    for symbol in current_user.watchlist:
        quote = await alpaca_service.get_quote(symbol)
        watchlist_data.append({
            "symbol": symbol,
            "price": quote.get("price"),
            "change": quote.get("change"),
            "change_percent": quote.get("change_percent"),
        })
    
    return watchlist_data


@router.post("/watchlist/{symbol}")
async def add_to_watchlist(
    symbol: str,
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict[str, str]:
    """Add a symbol to user's watchlist."""
    # Validate symbol exists
    try:
        await alpaca_service.get_quote(symbol.upper())
    except Exception:
        raise HTTPException(status_code=404, detail="Symbol not found")
    
    if current_user.watchlist is None:
        current_user.watchlist = []
    
    symbol_upper = symbol.upper()
    if symbol_upper not in current_user.watchlist:
        current_user.watchlist.append(symbol_upper)
    
    return {"status": "added", "symbol": symbol_upper}


@router.delete("/watchlist/{symbol}")
async def remove_from_watchlist(
    symbol: str,
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict[str, str]:
    """Remove a symbol from user's watchlist."""
    if current_user.watchlist and symbol.upper() in current_user.watchlist:
        current_user.watchlist.remove(symbol.upper())
    
    return {"status": "removed", "symbol": symbol.upper()}


@router.get("/alerts/arbitrage", response_model=List[ArbitrageAlert])
async def get_arbitrage_alerts(
    current_user: Annotated[User, Depends(get_current_user)],
    redis: Annotated[RedisClient, Depends(get_redis)],
) -> list:
    """Get recent arbitrage alerts."""
    # This would be populated by the Kafka consumer
    alerts_json = await redis.get("alerts:arbitrage:recent")
    if alerts_json:
        import json
        return json.loads(alerts_json)
    return []
