"""Alpaca API service for market data."""

from datetime import datetime
from typing import Any, Dict, List, Optional

from alpaca.data import StockHistoricalDataClient, StockLatestQuoteRequest
from alpaca.data.requests import StockBarsRequest
from alpaca.data.timeframe import TimeFrame

from core.config import settings


class AlpacaService:
    """Service for interacting with Alpaca Markets API."""

    def __init__(self) -> None:
        self._client: Optional[StockHistoricalDataClient] = None

    def _get_client(self) -> StockHistoricalDataClient:
        """Get or create Alpaca client."""
        if self._client is None:
            self._client = StockHistoricalDataClient(
                api_key=settings.alpaca_api_key,
                secret_key=settings.alpaca_secret_key,
            )
        return self._client

    def _parse_timeframe(self, timeframe: str) -> TimeFrame:
        """Convert string timeframe to Alpaca TimeFrame."""
        mapping = {
            "1Min": TimeFrame.Minute,
            "5Min": TimeFrame.Minute,
            "15Min": TimeFrame.Minute,
            "1H": TimeFrame.Hour,
            "1D": TimeFrame.Day,
        }
        return mapping.get(timeframe, TimeFrame.Day)

    async def get_quote(self, symbol: str) -> Dict[str, Any]:
        """Get real-time quote for a symbol."""
        client = self._get_client()
        
        request = StockLatestQuoteRequest(symbol_or_symbols=symbol.upper())
        quote = client.get_stock_latest_quote(request)
        
        quote_data = quote.get(symbol.upper())
        if not quote_data:
            return {}
        
        return {
            "symbol": symbol.upper(),
            "price": float(quote_data.ask_price),
            "bid": float(quote_data.bid_price),
            "ask": float(quote_data.ask_price),
            "volume": 0,  # Would need separate call for volume
            "change": 0.0,  # Calculate from previous close
            "change_percent": 0.0,
            "timestamp": quote_data.timestamp.isoformat(),
        }

    async def get_bars(
        self,
        symbol: str,
        timeframe: str = "1D",
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        """Get historical bars/candles for a symbol."""
        client = self._get_client()
        
        from datetime import timedelta
        end = datetime.now()
        
        # Calculate start time based on timeframe and limit
        if "Min" in timeframe:
            start = end - timedelta(days=5)
        elif timeframe == "1H":
            start = end - timedelta(days=30)
        else:
            start = end - timedelta(days=365)
        
        request = StockBarsRequest(
            symbol_or_symbols=symbol.upper(),
            timeframe=self._parse_timeframe(timeframe),
            start=start,
            end=end,
            limit=limit,
        )
        
        bars = client.get_stock_bars(request)
        symbol_bars = bars.get(symbol.upper(), [])
        
        return [
            {
                "symbol": symbol.upper(),
                "open": float(bar.open),
                "high": float(bar.high),
                "low": float(bar.low),
                "close": float(bar.close),
                "volume": int(bar.volume),
                "timestamp": bar.timestamp.isoformat(),
            }
            for bar in symbol_bars
        ]

    async def screen_stocks(
        self,
        min_price: Optional[float] = None,
        max_price: Optional[float] = None,
        min_volume: Optional[int] = None,
        min_change_percent: Optional[float] = None,
        max_change_percent: Optional[float] = None,
        sector: Optional[str] = None,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        """
        Screen stocks based on criteria.
        
        Note: Alpaca doesn't have a native screener API.
        This would need to:
        1. Get a list of tradeable assets
        2. Fetch quotes for each
        3. Filter based on criteria
        
        For production, consider using a dedicated screener API.
        """
        # Placeholder - would need real implementation
        # Could integrate with providers like:
        # - Financial Modeling Prep
        # - Polygon.io
        # - Alpha Vantage
        
        return []

    async def get_account(self) -> Dict[str, Any]:
        """Get Alpaca account information."""
        # Would use TradingClient for account info
        return {}


# Global service instance
alpaca_service = AlpacaService()
