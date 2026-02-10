"""Market news endpoints using Finnhub."""

from __future__ import annotations

import time
from typing import Any

import httpx
from fastapi import APIRouter

from core.config import settings


router = APIRouter()

CACHE_TTL_SECONDS = 300
_cached_news: dict[str, Any] = {"expires_at": 0.0, "data": []}


def _mock_news() -> list[dict[str, Any]]:
    now = int(time.time())
    return [
        {
            "id": 9001,
            "headline": "Fed signals potential rate pause in March meeting",
            "source": "Stratify",
            "url": "https://example.com/market/fed-rate-pause",
            "datetime": now - 3600,
        },
        {
            "id": 9002,
            "headline": "NVDA earnings beat expectations, stock surges after hours",
            "source": "Stratify",
            "url": "https://example.com/market/nvda-earnings",
            "datetime": now - 5400,
        },
        {
            "id": 9003,
            "headline": "Bitcoin breaks $50K resistance level",
            "source": "Stratify",
            "url": "https://example.com/market/bitcoin-50k",
            "datetime": now - 7200,
        },
        {
            "id": 9004,
            "headline": "Tesla announces new factory expansion in Texas",
            "source": "Stratify",
            "url": "https://example.com/market/tesla-texas",
            "datetime": now - 9000,
        },
        {
            "id": 9005,
            "headline": "Oil slides as inventories climb ahead of demand forecast",
            "source": "Stratify",
            "url": "https://example.com/market/oil-inventories",
            "datetime": now - 10800,
        },
        {
            "id": 9006,
            "headline": "Gold steadies as investors weigh inflation data",
            "source": "Stratify",
            "url": "https://example.com/market/gold-inflation",
            "datetime": now - 12600,
        },
        {
            "id": 9007,
            "headline": "Bank stocks rally after upbeat loan growth report",
            "source": "Stratify",
            "url": "https://example.com/market/bank-loan-growth",
            "datetime": now - 14400,
        },
        {
            "id": 9008,
            "headline": "S&P 500 futures edge higher into CPI release",
            "source": "Stratify",
            "url": "https://example.com/market/sp500-futures-cpi",
            "datetime": now - 16200,
        },
        {
            "id": 9009,
            "headline": "USD dips as traders price in slower tightening path",
            "source": "Stratify",
            "url": "https://example.com/market/usd-dips",
            "datetime": now - 18000,
        },
        {
            "id": 9010,
            "headline": "Tech leads premarket gains amid AI infrastructure spend",
            "source": "Stratify",
            "url": "https://example.com/market/tech-ai-spend",
            "datetime": now - 19800,
        },
    ]


def _normalize_news(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    for idx, item in enumerate(items):
        if not isinstance(item, dict):
            continue
        headline = item.get("headline") or ""
        source = item.get("source") or ""
        url = item.get("url") or ""
        timestamp = item.get("datetime")
        if timestamp is None:
            timestamp = int(time.time())
        news_id = item.get("id") or item.get("news_id") or idx
        if not headline:
            continue
        normalized.append(
            {
                "id": news_id,
                "headline": headline,
                "source": source,
                "url": url,
                "datetime": int(timestamp),
            }
        )

    normalized.sort(key=lambda entry: entry.get("datetime", 0), reverse=True)
    return normalized[:10]


async def _fetch_finnhub_news(api_key: str) -> list[dict[str, Any]]:
    url = "https://finnhub.io/api/v1/news"
    params = {"category": "general", "token": api_key}
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(url, params=params)
        response.raise_for_status()
        data = response.json()
    if not isinstance(data, list):
        return []
    return _normalize_news(data)


@router.get("/market")
async def get_market_news() -> list[dict[str, Any]]:
    """Return latest market headlines from Finnhub (cached)."""
    now = time.time()
    if _cached_news["data"] and _cached_news["expires_at"] > now:
        return _cached_news["data"]

    api_key = settings.finnhub_api_key
    if not api_key:
        data = _normalize_news(_mock_news())
        _cached_news["data"] = data
        _cached_news["expires_at"] = now + CACHE_TTL_SECONDS
        return data

    try:
        data = await _fetch_finnhub_news(api_key)
        if not data:
            raise ValueError("Empty Finnhub response")
    except Exception:
        data = _normalize_news(_mock_news())

    _cached_news["data"] = data
    _cached_news["expires_at"] = now + CACHE_TTL_SECONDS
    return data
