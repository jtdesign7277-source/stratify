"""Kafka consumer for arbitrage alerts."""

import asyncio
import json
from typing import Any, Dict, Optional

from aiokafka import AIOKafkaConsumer, AIOKafkaProducer

from core.config import settings
from core.redis import redis_client
from services.push_notification_service import push_service


class ArbitrageAlertConsumer:
    """Consumer for processing arbitrage alert events from Kafka."""

    def __init__(self) -> None:
        self.consumer: Optional[AIOKafkaConsumer] = None
        self.producer: Optional[AIOKafkaProducer] = None
        self._running = False

    async def start(self) -> None:
        """Initialize and start the Kafka consumer."""
        self.consumer = AIOKafkaConsumer(
            settings.kafka_topic_alerts,
            bootstrap_servers=settings.kafka_bootstrap_servers,
            group_id="arbitrage-alert-workers",
            value_deserializer=lambda m: json.loads(m.decode("utf-8")),
            auto_offset_reset="latest",
        )

        self.producer = AIOKafkaProducer(
            bootstrap_servers=settings.kafka_bootstrap_servers,
            value_serializer=lambda v: json.dumps(v).encode("utf-8"),
        )

        await self.consumer.start()
        await self.producer.start()
        self._running = True

        print(f"✅ Arbitrage Alert Consumer started on topic: {settings.kafka_topic_alerts}")

    async def stop(self) -> None:
        """Stop the Kafka consumer."""
        self._running = False
        if self.consumer:
            await self.consumer.stop()
        if self.producer:
            await self.producer.stop()
        print("🛑 Arbitrage Alert Consumer stopped")

    async def process_message(self, message: Dict[str, Any]) -> None:
        """
        Process an arbitrage alert message.
        
        Message format:
        {
            "type": "arbitrage",
            "symbol": "AAPL",
            "description": "Price discrepancy detected",
            "potential_profit": 2.5,
            "confidence": 0.85,
            "target_users": [1, 2, 3] or "all"
        }
        """
        print(f"Processing arbitrage alert: {message}")

        alert_data = {
            "type": "arbitrage",
            "data": message,
        }

        # Store in Redis for API access
        alerts_json = await redis_client.get("alerts:arbitrage:recent")
        alerts = json.loads(alerts_json) if alerts_json else []
        alerts.insert(0, message)
        alerts = alerts[:100]  # Keep last 100 alerts
        await redis_client.set(
            "alerts:arbitrage:recent",
            json.dumps(alerts),
            expire=3600,
        )

        # Publish to Redis pub/sub for real-time WebSocket delivery
        target_users = message.get("target_users", "all")
        
        if target_users == "all":
            # Broadcast to all connected users via topic
            await push_service.send_to_topic(
                topic="arbitrage_alerts",
                title="🎯 Arbitrage Opportunity",
                body=message.get("description", "New opportunity detected"),
                data={"symbol": message.get("symbol"), "type": "arbitrage"},
            )
        else:
            # Send to specific users
            for user_id in target_users:
                channel = f"alerts:user:{user_id}"
                await redis_client.publish(channel, json.dumps(alert_data))

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
                    # Could send to dead letter queue here

        except Exception as e:
            print(f"Consumer error: {e}")
        finally:
            await self.stop()


async def run_arbitrage_consumer() -> None:
    """Entry point for running the consumer."""
    # Connect Redis first
    await redis_client.connect()

    consumer = ArbitrageAlertConsumer()
    await consumer.run()


if __name__ == "__main__":
    asyncio.run(run_arbitrage_consumer())
