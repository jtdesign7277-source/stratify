"""Market data schemas."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class MarketQuote(BaseModel):
    """Real-time quote schema."""
    symbol: str
    price: float
    bid: Optional[float] = None
    ask: Optional[float] = None
    volume: int
    change: float
    change_percent: float
    timestamp: datetime


class MarketBar(BaseModel):
    """OHLCV bar/candle schema."""
    symbol: str
    open: float
    high: float
    low: float
    close: float
    volume: int
    timestamp: datetime


class StockScreener(BaseModel):
    """Stock screener result schema."""
    symbol: str
    name: str
    price: float
    change: float
    change_percent: float
    volume: int
    market_cap: Optional[float] = None
    sector: Optional[str] = None


class WatchlistItem(BaseModel):
    """Watchlist item with current price."""
    symbol: str
    price: float
    change: float
    change_percent: float


class ArbitrageAlert(BaseModel):
    """Arbitrage opportunity alert."""
    id: str
    symbol: str
    type: str  # "price_discrepancy", "correlation_break", etc.
    description: str
    potential_profit: float
    confidence: float
    expires_at: datetime
    created_at: datetime
