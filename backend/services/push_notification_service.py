"""Push notification service using Firebase Cloud Messaging."""

import json
from typing import Any, Dict, Optional

import firebase_admin
from firebase_admin import credentials, messaging

from core.config import settings


class PushNotificationService:
    """Service for sending push notifications via Firebase Cloud Messaging."""

    def __init__(self) -> None:
        self._initialized = False

    def _initialize(self) -> None:
        """Initialize Firebase Admin SDK."""
        if self._initialized:
            return

        try:
            cred = credentials.Certificate(settings.firebase_credentials_path)
            firebase_admin.initialize_app(cred)
            self._initialized = True
        except Exception as e:
            print(f"Failed to initialize Firebase: {e}")

    async def send_notification(
        self,
        device_token: str,
        title: str,
        body: str,
        data: Optional[Dict[str, Any]] = None,
        image_url: Optional[str] = None,
    ) -> bool:
        """
        Send a push notification to a specific device.
        
        Args:
            device_token: FCM device token
            title: Notification title
            body: Notification body
            data: Optional data payload
            image_url: Optional image URL
            
        Returns:
            True if sent successfully, False otherwise
        """
        self._initialize()

        notification = messaging.Notification(
            title=title,
            body=body,
            image=image_url,
        )

        # Build the message
        message = messaging.Message(
            notification=notification,
            token=device_token,
            data={k: str(v) for k, v in (data or {}).items()},
            # iOS specific
            apns=messaging.APNSConfig(
                payload=messaging.APNSPayload(
                    aps=messaging.Aps(
                        sound="default",
                        badge=1,
                    ),
                ),
            ),
            # Android specific
            android=messaging.AndroidConfig(
                priority="high",
                notification=messaging.AndroidNotification(
                    sound="default",
                    priority="high",
                    channel_id="stratify_alerts",
                ),
            ),
        )

        try:
            response = messaging.send(message)
            print(f"Successfully sent message: {response}")
            return True
        except Exception as e:
            print(f"Failed to send notification: {e}")
            return False

    async def send_to_topic(
        self,
        topic: str,
        title: str,
        body: str,
        data: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """
        Send a push notification to all subscribers of a topic.
        
        Args:
            topic: Topic name (e.g., "arbitrage_alerts")
            title: Notification title
            body: Notification body
            data: Optional data payload
            
        Returns:
            True if sent successfully
        """
        self._initialize()

        message = messaging.Message(
            notification=messaging.Notification(
                title=title,
                body=body,
            ),
            topic=topic,
            data={k: str(v) for k, v in (data or {}).items()},
        )

        try:
            response = messaging.send(message)
            print(f"Successfully sent topic message: {response}")
            return True
        except Exception as e:
            print(f"Failed to send topic notification: {e}")
            return False

    async def send_multicast(
        self,
        device_tokens: list[str],
        title: str,
        body: str,
        data: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Send a push notification to multiple devices.
        
        Args:
            device_tokens: List of FCM device tokens
            title: Notification title
            body: Notification body
            data: Optional data payload
            
        Returns:
            Dict with success/failure counts
        """
        self._initialize()

        message = messaging.MulticastMessage(
            notification=messaging.Notification(
                title=title,
                body=body,
            ),
            tokens=device_tokens,
            data={k: str(v) for k, v in (data or {}).items()},
        )

        try:
            response = messaging.send_multicast(message)
            return {
                "success_count": response.success_count,
                "failure_count": response.failure_count,
            }
        except Exception as e:
            print(f"Failed to send multicast: {e}")
            return {"success_count": 0, "failure_count": len(device_tokens)}

    async def subscribe_to_topic(
        self,
        device_tokens: list[str],
        topic: str,
    ) -> bool:
        """Subscribe devices to a topic."""
        self._initialize()

        try:
            response = messaging.subscribe_to_topic(device_tokens, topic)
            return response.success_count > 0
        except Exception as e:
            print(f"Failed to subscribe to topic: {e}")
            return False

    async def unsubscribe_from_topic(
        self,
        device_tokens: list[str],
        topic: str,
    ) -> bool:
        """Unsubscribe devices from a topic."""
        self._initialize()

        try:
            response = messaging.unsubscribe_from_topic(device_tokens, topic)
            return response.success_count > 0
        except Exception as e:
            print(f"Failed to unsubscribe from topic: {e}")
            return False


# Global service instance
push_service = PushNotificationService()
