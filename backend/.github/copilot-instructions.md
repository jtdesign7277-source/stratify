# Stratify Backend - Copilot Instructions

## Project Overview
Stratify is a finance/stock scanning application with native iOS and Android mobile apps.
This is the Python FastAPI backend that powers the mobile apps.

## Tech Stack
- **Framework**: FastAPI with WebSocket support
- **Database**: PostgreSQL with SQLAlchemy ORM
- **Cache**: Redis for real-time data and notifications
- **Message Queue**: Kafka for event streaming
- **ML**: PyTorch for bet grading engine
- **Auth**: JWT tokens
- **Deployment**: Railway + Cloudflare CDN

## Project Structure
```
/api          - FastAPI routes and endpoints
/models       - SQLAlchemy database models
/services     - Business logic (alpaca, notifications, ml_engine)
/ml           - PyTorch model training and inference
/workers      - Kafka consumers for background processing
/core         - Config, security, database connections
/schemas      - Pydantic schemas for request/response
```

## External APIs
- Alpaca API for real-time market data
- Firebase Cloud Messaging for push notifications

## Code Style
- Use Python 3.11+
- Follow PEP 8 guidelines
- Use type hints for all functions
- Use async/await for I/O operations
- Document all API endpoints with OpenAPI schemas
