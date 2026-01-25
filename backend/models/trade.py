"""Trade and trade history models."""

from datetime import datetime
from typing import List, Optional

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column

from core.database import Base


class Trade(Base):
    """Active trade/position model."""

    __tablename__ = "trades"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    
    symbol: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    side: Mapped[str] = mapped_column(String(10), nullable=False)  # "buy" or "sell"
    quantity: Mapped[float] = mapped_column(Float, nullable=False)
    entry_price: Mapped[float] = mapped_column(Float, nullable=False)
    
    # Optional targets
    stop_loss: Mapped[Optional[float]] = mapped_column(Float)
    take_profit: Mapped[Optional[float]] = mapped_column(Float)
    
    # Current P&L (updated periodically)
    current_price: Mapped[Optional[float]] = mapped_column(Float)
    unrealized_pnl: Mapped[float] = mapped_column(Float, default=0.0)
    unrealized_pnl_percent: Mapped[float] = mapped_column(Float, default=0.0)
    
    status: Mapped[str] = mapped_column(String(20), default="open")  # "open", "closed", "pending"
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    @classmethod
    async def get_open_trades(
        cls,
        db: AsyncSession,
        user_id: int,
    ) -> List["Trade"]:
        """Get all open trades for a user."""
        result = await db.execute(
            select(cls)
            .where(cls.user_id == user_id, cls.status == "open")
            .order_by(cls.created_at.desc())
        )
        return list(result.scalars().all())


class TradeHistory(Base):
    """Closed trade history for tracking performance."""

    __tablename__ = "trade_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    
    symbol: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    side: Mapped[str] = mapped_column(String(10), nullable=False)
    quantity: Mapped[float] = mapped_column(Float, nullable=False)
    
    entry_price: Mapped[float] = mapped_column(Float, nullable=False)
    exit_price: Mapped[float] = mapped_column(Float, nullable=False)
    
    realized_pnl: Mapped[float] = mapped_column(Float, nullable=False)
    realized_pnl_percent: Mapped[float] = mapped_column(Float, nullable=False)
    
    # ML model prediction (for grading)
    predicted_outcome: Mapped[Optional[str]] = mapped_column(String(20))  # "win", "loss"
    prediction_confidence: Mapped[Optional[float]] = mapped_column(Float)
    was_prediction_correct: Mapped[Optional[bool]] = mapped_column()
    
    opened_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    closed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    @classmethod
    async def get_user_history(
        cls,
        db: AsyncSession,
        user_id: int,
        limit: int = 100,
    ) -> List["TradeHistory"]:
        """Get trade history for a user."""
        result = await db.execute(
            select(cls)
            .where(cls.user_id == user_id)
            .order_by(cls.closed_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())

    @classmethod
    async def get_user_stats(
        cls,
        db: AsyncSession,
        user_id: int,
    ) -> dict:
        """Calculate user trading statistics."""
        result = await db.execute(
            select(cls).where(cls.user_id == user_id)
        )
        trades = list(result.scalars().all())
        
        if not trades:
            return {
                "total_trades": 0,
                "win_rate": 0.0,
                "total_profit": 0.0,
                "avg_profit": 0.0,
            }
        
        total = len(trades)
        wins = sum(1 for t in trades if t.realized_pnl > 0)
        total_profit = sum(t.realized_pnl for t in trades)
        
        return {
            "total_trades": total,
            "win_rate": (wins / total) * 100 if total > 0 else 0.0,
            "total_profit": total_profit,
            "avg_profit": total_profit / total if total > 0 else 0.0,
        }
