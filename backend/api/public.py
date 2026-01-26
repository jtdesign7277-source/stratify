from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from alpaca.data.historical import StockHistoricalDataClient
from alpaca.data.requests import StockLatestQuoteRequest, StockBarsRequest
from alpaca.data.timeframe import TimeFrame
from alpaca.trading.client import TradingClient
from alpaca.trading.requests import GetAssetsRequest
from alpaca.trading.enums import AssetClass
from backend.core.config import settings

router = APIRouter()

# Initialize Alpaca clients
data_client = StockHistoricalDataClient(
    api_key=settings.alpaca_api_key,
    secret_key=settings.alpaca_secret_key
)

trading_client = TradingClient(
    api_key=settings.alpaca_api_key,
    secret_key=settings.alpaca_secret_key,
    paper=True
)

@router.get("/quote/{symbol}")
async def get_quote(symbol: str):
    """Get real-time quote for a symbol (public)."""
    try:
        request = StockLatestQuoteRequest(symbol_or_symbols=symbol.upper())
        quote = data_client.get_stock_latest_quote(request)
        quote_data = quote.get(symbol.upper())
        if not quote_data:
            raise HTTPException(status_code=404, detail="Symbol not found")
        return {
            "symbol": symbol.upper(),
            "bid": float(quote_data.bid_price),
            "ask": float(quote_data.ask_price),
            "bid_size": quote_data.bid_size,
            "ask_size": quote_data.ask_size,
            "timestamp": str(quote_data.timestamp)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/search")
async def search_stocks(q: str = Query(..., min_length=1)):
    """Search for stocks by symbol or name (public)."""
    try:
        assets = trading_client.get_all_assets(GetAssetsRequest(asset_class=AssetClass.US_EQUITY))
        query = q.upper()
        results = [
            {"symbol": a.symbol, "name": a.name, "exchange": a.exchange, "tradable": a.tradable}
            for a in assets
            if query in a.symbol.upper() or (a.name and query in a.name.upper())
        ][:20]
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/quotes")
async def get_multiple_quotes(symbols: str = Query(..., description="Comma-separated symbols")):
    """Get quotes for multiple symbols (public)."""
    try:
        symbol_list = [s.strip().upper() for s in symbols.split(",")]
        request = StockLatestQuoteRequest(symbol_or_symbols=symbol_list)
        quotes = data_client.get_stock_latest_quote(request)
        results = {}
        for symbol, quote_data in quotes.items():
            results[symbol] = {
                "bid": float(quote_data.bid_price),
                "ask": float(quote_data.ask_price),
                "price": float((quote_data.bid_price + quote_data.ask_price) / 2),
                "timestamp": str(quote_data.timestamp)
            }
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
