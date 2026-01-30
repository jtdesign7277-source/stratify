"""
Kalshi API Service
Fetches live prediction market data from Kalshi
"""
import os
import time
import base64
import hashlib
import httpx
from datetime import datetime
from typing import Optional, List, Dict, Any
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.backends import default_backend


class KalshiClient:
    """Client for interacting with Kalshi API"""
    
    def __init__(self):
        self.api_key = os.getenv("KALSHI_API_KEY")
        self.private_key_path = os.getenv("KALSHI_PRIVATE_KEY_PATH", "./kalshi_private_key.pem")
        self.base_url = os.getenv("KALSHI_API_URL", "https://api.elections.kalshi.com/trade-api/v2")
        self.private_key = self._load_private_key()
        
    def _load_private_key(self):
        """Load RSA private key from file"""
        try:
            with open(self.private_key_path, "rb") as key_file:
                return serialization.load_pem_private_key(
                    key_file.read(),
                    password=None,
                    backend=default_backend()
                )
        except Exception as e:
            print(f"Error loading Kalshi private key: {e}")
            return None
    
    def _sign_request(self, timestamp: str, method: str, path: str) -> str:
        """Sign a request using RSA-SHA256"""
        if not self.private_key:
            return ""
        
        message = f"{timestamp}{method}{path}"
        signature = self.private_key.sign(
            message.encode('utf-8'),
            padding.PKCS1v15(),
            hashes.SHA256()
        )
        return base64.b64encode(signature).decode('utf-8')
    
    def _get_headers(self, method: str, path: str) -> Dict[str, str]:
        """Generate authenticated headers for API request"""
        timestamp = str(int(time.time() * 1000))
        signature = self._sign_request(timestamp, method, path)
        
        return {
            "KALSHI-ACCESS-KEY": self.api_key,
            "KALSHI-ACCESS-SIGNATURE": signature,
            "KALSHI-ACCESS-TIMESTAMP": timestamp,
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
    
    def get_markets(self, limit: int = 100, status: str = "open") -> List[Dict[str, Any]]:
        """Fetch active markets from Kalshi"""
        path = f"/markets?limit={limit}&status={status}"
        url = f"{self.base_url}{path}"
        
        try:
            headers = self._get_headers("GET", path)
            with httpx.Client(timeout=10) as client:
                response = client.get(url, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                return data.get("markets", [])
            else:
                print(f"Kalshi API error: {response.status_code} - {response.text}")
                return []
        except Exception as e:
            print(f"Error fetching Kalshi markets: {e}")
            return []
    
    def get_market(self, ticker: str) -> Optional[Dict[str, Any]]:
        """Fetch a specific market by ticker"""
        path = f"/markets/{ticker}"
        url = f"{self.base_url}{path}"
        
        try:
            headers = self._get_headers("GET", path)
            with httpx.Client(timeout=10) as client:
                response = client.get(url, headers=headers)
            
            if response.status_code == 200:
                return response.json().get("market")
            else:
                return None
        except Exception as e:
            print(f"Error fetching Kalshi market {ticker}: {e}")
            return None
    
    def get_events(self, limit: int = 50, status: str = "open") -> List[Dict[str, Any]]:
        """Fetch events (categories of markets)"""
        path = f"/events?limit={limit}&status={status}"
        url = f"{self.base_url}{path}"
        
        try:
            headers = self._get_headers("GET", path)
            with httpx.Client(timeout=10) as client:
                response = client.get(url, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                return data.get("events", [])
            else:
                print(f"Kalshi API error: {response.status_code}")
                return []
        except Exception as e:
            print(f"Error fetching Kalshi events: {e}")
            return []
    
    def format_market_for_arb(self, market: Dict[str, Any]) -> Dict[str, Any]:
        """Format a Kalshi market for the arbitrage panel"""
        # Extract prices (Kalshi uses cents, 0-100)
        yes_price = market.get("yes_ask", market.get("last_price", 50)) / 100
        no_price = market.get("no_ask", 1 - yes_price)
        
        return {
            "id": market.get("ticker"),
            "event": market.get("title", market.get("ticker")),
            "category": market.get("category", "Other"),
            "kalshi": {
                "yes": yes_price,
                "no": no_price,
                "volume": market.get("volume", 0),
                "open_interest": market.get("open_interest", 0)
            },
            "expiry": market.get("close_time", market.get("expiration_time")),
            "status": market.get("status", "open")
        }


# Singleton instance
kalshi_client = KalshiClient()


def get_kalshi_markets(limit: int = 50) -> List[Dict[str, Any]]:
    """Get formatted Kalshi markets for the arbitrage panel"""
    markets = kalshi_client.get_markets(limit=limit)
    return [kalshi_client.format_market_for_arb(m) for m in markets]


def get_kalshi_events(limit: int = 30) -> List[Dict[str, Any]]:
    """Get Kalshi events"""
    return kalshi_client.get_events(limit=limit)
