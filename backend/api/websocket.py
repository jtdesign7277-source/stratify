"""WebSocket endpoints for real-time data."""

import asyncio
import json
from typing import Annotated, Dict, Set

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, Query
from fastapi.websockets import WebSocketState

from core.config import settings
from core.redis import redis_client
from core.security import decode_token
from services.alpaca_service import alpaca_service

router = APIRouter()


class ConnectionManager:
    """Manage WebSocket connections."""

    def __init__(self) -> None:
        # user_id -> set of websockets
        self.active_connections: Dict[int, Set[WebSocket]] = {}
        # symbol -> set of websockets subscribed
        self.symbol_subscriptions: Dict[str, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: int) -> None:
        """Accept and track a new WebSocket connection."""
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = set()
        self.active_connections[user_id].add(websocket)

    def disconnect(self, websocket: WebSocket, user_id: int) -> None:
        """Remove a WebSocket connection."""
        if user_id in self.active_connections:
            self.active_connections[user_id].discard(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
        
        # Remove from all symbol subscriptions
        for symbol in list(self.symbol_subscriptions.keys()):
            self.symbol_subscriptions[symbol].discard(websocket)
            if not self.symbol_subscriptions[symbol]:
                del self.symbol_subscriptions[symbol]

    def subscribe_symbol(self, websocket: WebSocket, symbol: str) -> None:
        """Subscribe a websocket to a symbol's updates."""
        if symbol not in self.symbol_subscriptions:
            self.symbol_subscriptions[symbol] = set()
        self.symbol_subscriptions[symbol].add(websocket)

    def unsubscribe_symbol(self, websocket: WebSocket, symbol: str) -> None:
        """Unsubscribe a websocket from a symbol's updates."""
        if symbol in self.symbol_subscriptions:
            self.symbol_subscriptions[symbol].discard(websocket)

    async def send_personal_message(self, message: dict, user_id: int) -> None:
        """Send a message to a specific user."""
        if user_id in self.active_connections:
            for websocket in self.active_connections[user_id]:
                if websocket.client_state == WebSocketState.CONNECTED:
                    await websocket.send_json(message)

    async def broadcast_to_symbol(self, symbol: str, message: dict) -> None:
        """Broadcast a message to all subscribers of a symbol."""
        if symbol in self.symbol_subscriptions:
            disconnected = []
            for websocket in self.symbol_subscriptions[symbol]:
                try:
                    if websocket.client_state == WebSocketState.CONNECTED:
                        await websocket.send_json(message)
                except Exception:
                    disconnected.append(websocket)
            
            for ws in disconnected:
                self.symbol_subscriptions[symbol].discard(ws)


manager = ConnectionManager()


@router.websocket("/market")
async def websocket_market(
    websocket: WebSocket,
    token: str = Query(...),
) -> None:
    """
    WebSocket endpoint for real-time market data.
    
    Messages from client:
    - {"action": "subscribe", "symbols": ["AAPL", "GOOGL"]}
    - {"action": "unsubscribe", "symbols": ["AAPL"]}
    
    Messages to client:
    - {"type": "quote", "symbol": "AAPL", "data": {...}}
    - {"type": "trade", "symbol": "AAPL", "data": {...}}
    """
    # Authenticate
    payload = decode_token(token)
    if not payload:
        await websocket.close(code=4001, reason="Invalid token")
        return
    
    user_id = int(payload.get("sub", 0))
    await manager.connect(websocket, user_id)
    
    try:
        while True:
            data = await websocket.receive_json()
            action = data.get("action")
            
            if action == "subscribe":
                symbols = data.get("symbols", [])
                for symbol in symbols:
                    manager.subscribe_symbol(websocket, symbol.upper())
                await websocket.send_json({
                    "type": "subscribed",
                    "symbols": symbols,
                })
            
            elif action == "unsubscribe":
                symbols = data.get("symbols", [])
                for symbol in symbols:
                    manager.unsubscribe_symbol(websocket, symbol.upper())
                await websocket.send_json({
                    "type": "unsubscribed",
                    "symbols": symbols,
                })
    
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)


@router.websocket("/alerts")
async def websocket_alerts(
    websocket: WebSocket,
    token: str = Query(...),
) -> None:
    """
    WebSocket endpoint for real-time arbitrage and price alerts.
    
    Messages to client:
    - {"type": "arbitrage", "data": {...}}
    - {"type": "price_alert", "data": {...}}
    """
    # Authenticate
    payload = decode_token(token)
    if not payload:
        await websocket.close(code=4001, reason="Invalid token")
        return
    
    user_id = int(payload.get("sub", 0))
    await manager.connect(websocket, user_id)
    
    # Subscribe to Redis pubsub for alerts
    pubsub = redis_client.pubsub()
    await pubsub.subscribe(f"alerts:user:{user_id}")
    
    try:
        while True:
            message = await pubsub.get_message(ignore_subscribe_messages=True)
            if message:
                await websocket.send_json(json.loads(message["data"]))
            
            # Also check for incoming messages from client
            try:
                data = await asyncio.wait_for(
                    websocket.receive_json(),
                    timeout=0.1,
                )
                # Handle any client messages if needed
            except asyncio.TimeoutError:
                pass
    
    except WebSocketDisconnect:
        await pubsub.unsubscribe(f"alerts:user:{user_id}")
        manager.disconnect(websocket, user_id)


@router.websocket("/social")
async def websocket_social(
    websocket: WebSocket,
    token: str = Query(...),
) -> None:
    """
    WebSocket endpoint for real-time social feed updates.
    
    Messages to client:
    - {"type": "new_post", "data": {...}}
    - {"type": "new_comment", "data": {...}}
    - {"type": "new_like", "data": {...}}
    """
    # Authenticate
    payload = decode_token(token)
    if not payload:
        await websocket.close(code=4001, reason="Invalid token")
        return
    
    user_id = int(payload.get("sub", 0))
    await manager.connect(websocket, user_id)
    
    # Subscribe to Redis pubsub for social updates
    pubsub = redis_client.pubsub()
    await pubsub.subscribe("social:feed")
    
    try:
        while True:
            message = await pubsub.get_message(ignore_subscribe_messages=True)
            if message:
                await websocket.send_json(json.loads(message["data"]))
            await asyncio.sleep(0.1)
    
    except WebSocketDisconnect:
        await pubsub.unsubscribe("social:feed")
        manager.disconnect(websocket, user_id)
