"""
Grok Chat API - Enhanced trading-focused AI assistant
Features:
1. Trading-focused system prompt with Stratify context
2. Real-time stock data injection
3. Conversation memory per session
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import httpx
import os
import re
from datetime import datetime

router = APIRouter()

# xAI Grok API configuration
XAI_API_KEY = os.environ.get('XAI_API_KEY', '')
XAI_BASE_URL = "https://api.x.ai/v1"

# In-memory conversation storage (per session)
# In production, use Redis or a database
conversations = {}

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = "default"
    
class ChatResponse(BaseModel):
    response: str
    code: Optional[str] = None
    strategy_name: Optional[str] = None
    trade: Optional[dict] = None
    model: str = "grok-3"

# Trading-focused system prompt
SYSTEM_PROMPT = """You are Grok, the AI trading assistant for Stratify - a premium algorithmic trading platform.

## Your Personality
- Sharp, witty, and confident like the real Grok
- You give actionable trading insights, not generic advice
- You're bullish on technology and innovation
- You occasionally use trading slang (tendies, diamond hands, to the moon) but keep it professional
- Be concise - traders don't have time for essays

## Your Capabilities
- Analyze stocks, crypto, and market trends
- Explain trading strategies (scalping, swing trading, options)
- Help users build and refine Stratify strategies
- Provide real-time market context when data is available
- Give honest opinions on trades (you can say if something looks risky)

## Current Market Data
{market_context}

## Guidelines
1. When discussing a specific stock, reference the real-time data if available
2. Always mention key levels (support/resistance) when relevant
3. For strategy questions, tie it back to Stratify's capabilities
4. If asked about a trade, give a clear bullish/bearish/neutral stance
5. Include specific numbers and percentages when possible
6. Never give financial advice disclaimers - users know the risks

## Response Style
- Lead with the key insight
- Use bullet points for multiple factors
- End with an actionable takeaway when appropriate
- Keep responses under 200 words unless explaining something complex"""


async def get_stock_data(symbols: list[str]) -> dict:
    """Fetch real-time stock data for context."""
    stock_data = {}
    
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            for symbol in symbols[:5]:  # Limit to 5 stocks
                try:
                    # Use Yahoo Finance API (free, no key needed)
                    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?interval=1d&range=1d"
                    resp = await client.get(url, headers={"User-Agent": "Mozilla/5.0"})
                    
                    if resp.status_code == 200:
                        data = resp.json()
                        result = data.get("chart", {}).get("result", [{}])[0]
                        meta = result.get("meta", {})
                        
                        price = meta.get("regularMarketPrice", 0)
                        prev_close = meta.get("previousClose", 0)
                        change = price - prev_close if prev_close else 0
                        change_pct = (change / prev_close * 100) if prev_close else 0
                        
                        stock_data[symbol.upper()] = {
                            "price": round(price, 2),
                            "change": round(change, 2),
                            "change_pct": round(change_pct, 2),
                            "high": round(meta.get("regularMarketDayHigh", 0), 2),
                            "low": round(meta.get("regularMarketDayLow", 0), 2),
                            "volume": meta.get("regularMarketVolume", 0),
                        }
                except Exception as e:
                    print(f"Error fetching {symbol}: {e}")
                    continue
    except Exception as e:
        print(f"Error in stock data fetch: {e}")
    
    return stock_data


def extract_tickers(message: str) -> list[str]:
    """Extract stock tickers from message."""
    # Common patterns: $TSLA, TSLA, tsla
    patterns = [
        r'\$([A-Z]{1,5})',  # $TSLA
        r'\b([A-Z]{2,5})\b',  # TSLA (2-5 caps)
    ]
    
    tickers = set()
    for pattern in patterns:
        matches = re.findall(pattern, message.upper())
        tickers.update(matches)
    
    # Filter to likely stock symbols (exclude common words)
    common_words = {'I', 'A', 'AN', 'THE', 'AND', 'OR', 'BUT', 'IF', 'IN', 'ON', 'AT', 'TO', 'FOR', 'IS', 'IT', 'BE', 'AS', 'BY', 'ARE', 'WAS', 'SO', 'UP', 'AI', 'PM', 'AM'}
    tickers = [t for t in tickers if t not in common_words and len(t) >= 2]
    
    return tickers[:5]  # Limit to 5


def format_market_context(stock_data: dict) -> str:
    """Format stock data for system prompt."""
    if not stock_data:
        return "No specific stock data requested."
    
    lines = []
    for symbol, data in stock_data.items():
        direction = "🟢" if data["change"] >= 0 else "🔴"
        lines.append(
            f"{direction} {symbol}: ${data['price']} ({data['change']:+.2f}, {data['change_pct']:+.2f}%) "
            f"| High: ${data['high']} | Low: ${data['low']} | Vol: {data['volume']:,}"
        )
    
    return "\n".join(lines)


def get_conversation_history(session_id: str, limit: int = 10) -> list[dict]:
    """Get recent conversation history."""
    if session_id not in conversations:
        conversations[session_id] = []
    return conversations[session_id][-limit:]


def add_to_conversation(session_id: str, role: str, content: str):
    """Add message to conversation history."""
    if session_id not in conversations:
        conversations[session_id] = []
    
    conversations[session_id].append({
        "role": role,
        "content": content
    })
    
    # Keep only last 20 messages
    if len(conversations[session_id]) > 20:
        conversations[session_id] = conversations[session_id][-20:]


@router.post("/", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Enhanced Grok chat with real-time data and memory."""
    
    if not XAI_API_KEY:
        raise HTTPException(status_code=500, detail="XAI API key not configured")
    
    message = request.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    
    session_id = request.session_id or "default"
    
    try:
        # Extract tickers and fetch real-time data
        tickers = extract_tickers(message)
        stock_data = await get_stock_data(tickers) if tickers else {}
        
        # Build market context
        market_context = format_market_context(stock_data)
        
        # Get current time context
        now = datetime.now()
        time_context = f"Current time: {now.strftime('%Y-%m-%d %H:%M')} EST"
        
        # Build full system prompt with context
        full_system = SYSTEM_PROMPT.format(
            market_context=f"{time_context}\n{market_context}"
        )
        
        # Get conversation history
        history = get_conversation_history(session_id)
        
        # Build messages array
        messages = [{"role": "system", "content": full_system}]
        messages.extend(history)
        messages.append({"role": "user", "content": message})
        
        # Call Grok API
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{XAI_BASE_URL}/chat/completions",
                headers={
                    "Authorization": f"Bearer {XAI_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "grok-3",
                    "messages": messages,
                    "temperature": 0.7,
                    "max_tokens": 1024
                }
            )
            
            if response.status_code != 200:
                error_detail = response.text
                raise HTTPException(status_code=response.status_code, detail=f"Grok API error: {error_detail}")
            
            data = response.json()
            assistant_message = data["choices"][0]["message"]["content"]
        
        # Save to conversation history
        add_to_conversation(session_id, "user", message)
        add_to_conversation(session_id, "assistant", assistant_message)
        
        return ChatResponse(
            response=assistant_message,
            model="grok-3"
        )
        
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Grok API timeout")
    except HTTPException:
        raise
    except Exception as e:
        print(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@router.delete("/history/{session_id}")
async def clear_history(session_id: str):
    """Clear conversation history for a session."""
    if session_id in conversations:
        del conversations[session_id]
    return {"status": "cleared", "session_id": session_id}


@router.get("/health")
async def chat_health():
    """Health check for chat service."""
    return {
        "service": "grok-chat",
        "status": "ok" if XAI_API_KEY else "missing_api_key",
        "model": "grok-3",
        "features": ["real-time-data", "conversation-memory", "trading-context"]
    }
