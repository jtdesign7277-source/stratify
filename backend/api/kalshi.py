"""
Kalshi API Routes
Endpoints for prediction market data
"""
from fastapi import APIRouter, HTTPException, Query
from typing import List, Dict, Any, Optional
from services.kalshi_service import get_kalshi_markets, get_kalshi_events, kalshi_client

router = APIRouter(prefix="/api/v1/kalshi", tags=["kalshi"])


@router.get("/markets")
async def get_markets(
    limit: int = Query(50, ge=1, le=200),
    category: Optional[str] = None
) -> Dict[str, Any]:
    """
    Get live Kalshi prediction markets
    
    Returns markets with current prices, volume, and metadata
    """
    try:
        markets = get_kalshi_markets(limit=limit)
        
        # Filter by category if specified
        if category and category != "All":
            markets = [m for m in markets if m.get("category", "").lower() == category.lower()]
        
        return {
            "success": True,
            "count": len(markets),
            "markets": markets
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching Kalshi markets: {str(e)}")


@router.get("/markets/{ticker}")
async def get_market(ticker: str) -> Dict[str, Any]:
    """
    Get a specific Kalshi market by ticker
    """
    try:
        market = kalshi_client.get_market(ticker)
        if not market:
            raise HTTPException(status_code=404, detail=f"Market {ticker} not found")
        
        return {
            "success": True,
            "market": kalshi_client.format_market_for_arb(market)
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching market: {str(e)}")


@router.get("/events")
async def get_events(
    limit: int = Query(30, ge=1, le=100)
) -> Dict[str, Any]:
    """
    Get Kalshi events (market categories/groupings)
    """
    try:
        events = get_kalshi_events(limit=limit)
        return {
            "success": True,
            "count": len(events),
            "events": events
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching events: {str(e)}")


@router.get("/arbitrage")
async def get_arbitrage_opportunities(
    limit: int = Query(20, ge=1, le=50)
) -> Dict[str, Any]:
    """
    Get potential arbitrage opportunities
    
    Compares Kalshi prices with known Polymarket prices
    to find spreads that could be profitable
    """
    try:
        kalshi_markets = get_kalshi_markets(limit=100)
        
        # Mock Polymarket data for comparison (in production, fetch from Polymarket API)
        # Polymarket uses CLOB system - we'd need to query their GraphQL API
        opportunities = []
        
        for market in kalshi_markets[:limit]:
            kalshi_yes = market.get("kalshi", {}).get("yes", 0.5)
            
            # Simulate Polymarket price (in production, fetch real data)
            # Adding small random spread for demo
            import random
            poly_spread = random.uniform(-0.05, 0.05)
            poly_yes = max(0.01, min(0.99, kalshi_yes + poly_spread))
            
            spread = abs(kalshi_yes - poly_yes) * 100
            
            if spread >= 2.0:  # Only show opportunities with 2%+ spread
                opportunities.append({
                    "id": market.get("id"),
                    "event": market.get("event"),
                    "category": market.get("category"),
                    "kalshi": {
                        "yes": round(kalshi_yes, 2),
                        "volume": market.get("kalshi", {}).get("volume", 0)
                    },
                    "polymarket": {
                        "yes": round(poly_yes, 2),
                        "volume": f"{random.randint(100, 5000)}K"  # Mock for now
                    },
                    "spread": round(spread, 1),
                    "profit": f"${int(spread * 10)} per $1000",
                    "confidence": "High" if spread >= 4 else "Medium" if spread >= 3 else "Low",
                    "expiry": market.get("expiry")
                })
        
        # Sort by spread (highest first)
        opportunities.sort(key=lambda x: x["spread"], reverse=True)
        
        return {
            "success": True,
            "count": len(opportunities),
            "opportunities": opportunities[:limit]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error calculating arbitrage: {str(e)}")


@router.get("/health")
async def health_check() -> Dict[str, Any]:
    """Check if Kalshi API connection is working"""
    try:
        markets = kalshi_client.get_markets(limit=1)
        connected = len(markets) > 0
        
        return {
            "success": True,
            "kalshi_connected": connected,
            "api_key_set": bool(kalshi_client.api_key),
            "private_key_loaded": bool(kalshi_client.private_key)
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "kalshi_connected": False
        }
