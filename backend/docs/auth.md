# Authentication (JWT)

Stratify uses JSON Web Tokens (JWT) for authentication. Clients obtain an access
token and refresh token via `/api/v1/auth/login`. The access token is sent on
protected routes using the `Authorization: Bearer <token>` header.

## Token model

- Access tokens include `type=access` and expire after
  `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` (default: 30).
- Refresh tokens include `type=refresh` and expire after
  `JWT_REFRESH_TOKEN_EXPIRE_DAYS` (default: 7).
- Tokens are signed using `JWT_SECRET_KEY` and `JWT_ALGORITHM` (default: HS256).

## Endpoints

### Register

`POST /api/v1/auth/register`

Creates a new user. Passwords must be at least 8 characters.

Request body (JSON):

```json
{
  "email": "user@example.com",
  "username": "newuser",
  "password": "password123"
}
```

Responses:
- `201` with user profile (no password).
- `400` if the email is already registered.

### Login

`POST /api/v1/auth/login`

OAuth2 password flow with form-encoded payload. Use the email as `username`.

Request body (form):

```
Content-Type: application/x-www-form-urlencoded

username=user@example.com&password=password123
```

Response (`200`):

```json
{
  "access_token": "<jwt>",
  "refresh_token": "<jwt>",
  "token_type": "bearer"
}
```

### Refresh

`POST /api/v1/auth/refresh`

Exchanges a refresh token for a new access/refresh pair.

Request body (JSON):

```json
{
  "refresh_token": "<refresh_jwt>"
}
```

Responses:
- `200` with new tokens.
- `401` if the token is invalid or not a refresh token.

### Current User

`GET /api/v1/auth/me`

Requires a valid access token.

Example:

```
Authorization: Bearer <access_jwt>
```

Response (`200`):

```json
{
  "id": 123,
  "email": "user@example.com",
  "username": "newuser",
  "display_name": null,
  "avatar_url": null,
  "theme": "dark",
  "is_verified": false,
  "is_premium": false
}
```

## Example curl

```bash
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","username":"newuser","password":"password123"}'

curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=user@example.com&password=password123"

curl http://localhost:8000/api/v1/auth/me \
  -H "Authorization: Bearer <access_jwt>"
```
