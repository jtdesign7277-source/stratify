from __future__ import annotations

import pytest

from core.security import create_access_token, create_refresh_token, get_password_hash
from models.user import User


@pytest.mark.asyncio
async def test_register_success(async_client, monkeypatch):
    async def fake_get_by_email(cls, db, email):
        return None

    monkeypatch.setattr(User, "get_by_email", classmethod(fake_get_by_email))

    payload = {
        "email": "user@example.com",
        "username": "newuser",
        "password": "password123",
    }
    response = await async_client.post("/api/v1/auth/register", json=payload)

    assert response.status_code == 201
    data = response.json()
    assert data["email"] == payload["email"]
    assert data["username"] == payload["username"]
    assert "id" in data


@pytest.mark.asyncio
async def test_register_duplicate_email(async_client, monkeypatch):
    existing_user = User(
        email="user@example.com",
        username="existing",
        hashed_password=get_password_hash("password123"),
    )

    async def fake_get_by_email(cls, db, email):
        return existing_user

    monkeypatch.setattr(User, "get_by_email", classmethod(fake_get_by_email))

    response = await async_client.post(
        "/api/v1/auth/register",
        json={
            "email": "user@example.com",
            "username": "newuser",
            "password": "password123",
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Email already registered"


@pytest.mark.asyncio
async def test_login_success(async_client, monkeypatch):
    hashed_password = get_password_hash("password123")
    user = User(
        id=1,
        email="user@example.com",
        username="user",
        hashed_password=hashed_password,
    )

    async def fake_get_by_email(cls, db, email):
        return user

    monkeypatch.setattr(User, "get_by_email", classmethod(fake_get_by_email))

    response = await async_client.post(
        "/api/v1/auth/login",
        data={"username": "user@example.com", "password": "password123"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["token_type"] == "bearer"
    assert "access_token" in data
    assert "refresh_token" in data


@pytest.mark.asyncio
async def test_login_invalid_password(async_client, monkeypatch):
    hashed_password = get_password_hash("password123")
    user = User(
        id=1,
        email="user@example.com",
        username="user",
        hashed_password=hashed_password,
    )

    async def fake_get_by_email(cls, db, email):
        return user

    monkeypatch.setattr(User, "get_by_email", classmethod(fake_get_by_email))

    response = await async_client.post(
        "/api/v1/auth/login",
        data={"username": "user@example.com", "password": "wrong"},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Incorrect email or password"


@pytest.mark.asyncio
async def test_refresh_success(async_client, monkeypatch):
    user = User(
        id=1,
        email="user@example.com",
        username="user",
        hashed_password=get_password_hash("password123"),
        theme="dark",
        is_verified=False,
        is_premium=False,
    )

    async def fake_get_by_id(cls, db, user_id):
        return user

    monkeypatch.setattr(User, "get_by_id", classmethod(fake_get_by_id))

    token = create_refresh_token(data={"sub": "1"})
    response = await async_client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": token},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["token_type"] == "bearer"
    assert "access_token" in data
    assert "refresh_token" in data


@pytest.mark.asyncio
async def test_refresh_invalid_token_type(async_client, monkeypatch):
    user = User(
        id=1,
        email="user@example.com",
        username="user",
        hashed_password=get_password_hash("password123"),
        theme="dark",
        is_verified=False,
        is_premium=False,
    )

    async def fake_get_by_id(cls, db, user_id):
        return user

    monkeypatch.setattr(User, "get_by_id", classmethod(fake_get_by_id))

    token = create_access_token(data={"sub": "1"})
    response = await async_client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": token},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid refresh token"


@pytest.mark.asyncio
async def test_me_success(async_client, monkeypatch):
    user = User(
        id=1,
        email="user@example.com",
        username="user",
        hashed_password=get_password_hash("password123"),
        theme="dark",
        is_verified=False,
        is_premium=False,
    )

    async def fake_get_by_id(cls, db, user_id):
        return user

    monkeypatch.setattr(User, "get_by_id", classmethod(fake_get_by_id))

    token = create_access_token(data={"sub": "1"})
    response = await async_client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    assert response.json()["email"] == "user@example.com"


@pytest.mark.asyncio
async def test_me_invalid_token(async_client):
    response = await async_client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer invalid.token.value"},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Could not validate credentials"
