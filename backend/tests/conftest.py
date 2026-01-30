from __future__ import annotations

import sys
from pathlib import Path
from typing import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from fastapi import FastAPI

from api import auth
from core.database import get_db


class FakeAsyncSession:
    def __init__(self) -> None:
        self.added = []
        self.committed = False

    def add(self, instance: object) -> None:
        self.added.append(instance)

    async def commit(self) -> None:
        self.committed = True

    async def refresh(self, instance: object) -> None:
        if getattr(instance, "id", None) is None:
            setattr(instance, "id", 1)
        if getattr(instance, "theme", None) is None:
            setattr(instance, "theme", "dark")
        if getattr(instance, "is_verified", None) is None:
            setattr(instance, "is_verified", False)
        if getattr(instance, "is_premium", None) is None:
            setattr(instance, "is_premium", False)


@pytest.fixture
def app_with_overrides():
    app = FastAPI()
    app.include_router(auth.router, prefix="/api/v1/auth")

    async def override_get_db() -> AsyncGenerator[FakeAsyncSession, None]:
        yield FakeAsyncSession()

    app.dependency_overrides[get_db] = override_get_db
    yield app
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def async_client(app_with_overrides):
    transport = ASGITransport(app=app_with_overrides)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
