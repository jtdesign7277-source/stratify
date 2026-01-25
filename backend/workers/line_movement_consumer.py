"""Kafka consumer for line/price movement events."""

import asyncio
import json
from typing import Any, Dict, Optional

from aiokafka import AIOKafkaConsumer

from core.config import settings
from core.redis import redis_client
from services.push_notification_service import push_service


class LineMovementConsumer:
    """Consumer for processing price/line movement events."""

    def __init__(self) -> None:
        self.consumer: Optional[AIOKafkaConsumer] = None
        self._running = False

    async def start(self) -> None:
        """Initialize and start the Kafka consumer."""
        self.consumer = AIOKafkaConsumer(
            settings.kafka_topic_lines,
            bootstrap_servers=settings.kafka_bootstrap_servers,
            group_id="line-movement-workers",
            value_deserializer=lambda m: json.loads(m.decode("utf-8")),
            auto_offset_reset="latest",
        )

        await self.consumer.start()
        self._running = True

        print(f"✅ Line Movement Consumer started on topic: {settings.kafka_topic_lines}")

    async def stop(self) -> None:
        """Stop the Kafka consumer."""
        self._running = False
        if self.consumer:
            await self.consumer.stop()
        print("🛑 Line Movement Consumer stopped")

    async def process_message(self, message: Dict[str, Any]) -> None:
        """
        Process a line movement message.
        
        Message format:
        {
            "type": "price_movement",
            "symbol": "AAPL",
            "old_price": 150.00,
            "new_price": 152.50,
            "change_percent": 1.67,
            "timestamp": "2026-01-25T10:00:00Z"
        }
        """
        print(f"Processing line movement: {message}")

        symbol = message.get("symbol", "")
        change_percent = message.get("change_percent", 0)

        # Cache the latest price in Redis
        price_data = json.dumps({
            "price": message.get("new_price"),
            "change": message.get("new_price", 0) - message.get("old_price", 0),
            "change_percent": change_percent,
            "timestamp": message.get("timestamp"),
        })
        await redis_client.cache_market_data(symbol, price_data, ttl=60)

        # Check if significant movement (> 2%)
        if abs(change_percent) >= 2.0:
            direction = "📈" if change_percent > 0 else "📉"
            
            # Send push notification to users watching this symbol
            await push_service.send_to_topic(
                topic=f"symbol_{symbol.lower()}",
                title=f"{direction} {symbol} Alert",
                body=f"{symbol} moved {change_percent:+.2f}% to ${message.get('new_price', 0):.2f}",
                data={
                    "symbol": symbol,
                    "type": "price_alert",
                    "change_percent": str(change_percent),
                },
            )

        # Publish to Redis for WebSocket delivery
        ws_message = {
            "type": "price_update",
            "symbol": symbol,
            "data": message,
        }
        await redis_client.publish(f"prices:{symbol}", json.dumps(ws_message))

    async def run(self) -> None:
        """Main consumer loop."""
        await self.start()

        try:
            async for msg in self.consumer:
                if not self._running:
                    break
                
                try:
                    await self.process_message(msg.value)
                except Exception as e:
                    print(f"Error processing message: {e}")

        except Exception as e:
            print(f"Consumer error: {e}")
        finally:
            await self.stop()


async def run_line_movement_consumer() -> None:
    """Entry point for running the consumer."""
    await redis_client.connect()

    consumer = LineMovementConsumer()
    await consumer.run()


if __name__ == "__main__":
    asyncio.run(run_line_movement_consumer())
