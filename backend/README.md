th# Stratify Backend API

Finance/stock scanning API backend for the Stratify mobile apps (iOS/Android).

## Tech Stack

- **Framework**: FastAPI with WebSocket support
- **Database**: PostgreSQL with SQLAlchemy ORM
- **Cache**: Redis for real-time data
- **Message Queue**: Kafka for event streaming
- **ML**: PyTorch for trade grading engine
- **Auth**: JWT tokens
- **Deployment**: Railway + Cloudflare CDN

## Project Structure

```
backend/
├── api/                 # FastAPI routes
│   ├── auth.py         # Authentication endpoints
│   ├── users.py        # User management
│   ├── market.py       # Market data (Alpaca)
│   ├── social.py       # Social feed & leaderboard
│   ├── notifications.py # Push notifications
│   └── websocket.py    # Real-time WebSocket
├── core/               # Core configuration
│   ├── config.py       # Settings
│   ├── database.py     # PostgreSQL
│   ├── redis.py        # Redis client
│   └── security.py     # JWT & passwords
├── models/             # SQLAlchemy models
├── schemas/            # Pydantic schemas
├── services/           # Business logic
│   ├── alpaca_service.py
│   ├── push_notification_service.py
│   └── ml_inference_service.py
├── workers/            # Kafka consumers
├── ml/                 # ML training & models
└── main.py             # FastAPI app
```

## Quick Start

### Local Development with Docker

```bash
# Start all services (API, PostgreSQL, Redis, Kafka)
docker-compose up -d

# View logs
docker-compose logs -f api

# Run database migrations
docker-compose exec api alembic upgrade head
```

The API will be available at:
- **API**: http://localhost:8000
- **Docs**: http://localhost:8000/docs
- **Kafka UI**: http://localhost:8080

### Local Development without Docker

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -e ".[dev]"

# Copy environment file
cp .env.example .env
# Edit .env with your settings

# Run the server
uvicorn main:app --reload
```

## Configuration

Copy `.env.example` to `.env` and configure:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `ALPACA_API_KEY` | Alpaca Markets API key |
| `ALPACA_SECRET_KEY` | Alpaca Markets secret |
| `FIREBASE_CREDENTIALS_PATH` | Path to Firebase service account JSON |
| `JWT_SECRET_KEY` | Secret for JWT tokens |

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login and get tokens
- `POST /api/v1/auth/refresh` - Refresh access token
- `GET /api/v1/auth/me` - Get current user

### Market Data
- `GET /api/v1/market/quote/{symbol}` - Real-time quote
- `GET /api/v1/market/bars/{symbol}` - Historical bars
- `GET /api/v1/market/screener` - Stock screener
- `GET /api/v1/market/watchlist` - User's watchlist

### Social
- `GET /api/v1/social/feed` - Social feed
- `POST /api/v1/social/posts` - Create post
- `GET /api/v1/social/leaderboard` - Trading leaderboard

### WebSocket
- `WS /api/v1/ws/market` - Real-time market updates
- `WS /api/v1/ws/alerts` - Arbitrage alerts
- `WS /api/v1/ws/social` - Social feed updates

## Deployment

### Railway

1. Connect your GitHub repo to Railway
2. Add PostgreSQL and Redis services
3. Set environment variables
4. Deploy!

```bash
# Using Railway CLI
railway login
railway init
railway up
```

### Environment Variables for Railway

Set these in your Railway dashboard:
- `DATABASE_URL` - Auto-configured if using Railway PostgreSQL
- `REDIS_URL` - Auto-configured if using Railway Redis
- `ALPACA_API_KEY`
- `ALPACA_SECRET_KEY`
- `JWT_SECRET_KEY`
- `FIREBASE_CREDENTIALS_PATH`

## Mobile App Integration

### iOS (Swift/SwiftUI)

```swift
// API Client
let baseURL = "https://your-railway-app.up.railway.app/api/v1"

// WebSocket connection
let wsURL = "wss://your-railway-app.up.railway.app/api/v1/ws/market?token=\(token)"
```

### Android (Kotlin)

```kotlin
// Retrofit configuration
val baseUrl = "https://your-railway-app.up.railway.app/api/v1/"

// OkHttp WebSocket
val wsUrl = "wss://your-railway-app.up.railway.app/api/v1/ws/market?token=$token"
```

## Running Workers

Kafka consumers run as separate processes:

```bash
# Arbitrage alerts
python -m workers.arbitrage_consumer

# Line movements
python -m workers.line_movement_consumer
```

## ML Model Training

```bash
# Train the trade grading model
python -m ml.train
```

## License

Proprietary - All rights reserved
