# Authentication API Documentation

Complete documentation for TeachLink authentication endpoints.

## Table of Contents
- [Register User](#register-user)
- [Login User](#login-user)
- [Refresh Token](#refresh-token)
- [Logout](#logout)
- [Forgot Password](#forgot-password)
- [Reset Password](#reset-password)
- [Change Password](#change-password)
- [Verify Email](#verify-email)

---

## Register User

Create a new user account in the TeachLink platform.

### Endpoint
```
POST /auth/register
```

### Rate Limiting
- **Limit**: 10 requests per minute
- **Header**: `X-RateLimit-Limit: 10`

### Request Body

**Content-Type**: `application/json`

| Field | Type | Required | Description | Validation |
|-------|------|----------|-------------|------------|
| email | string | Yes | User's email address | Valid email format |
| password | string | Yes | User's password | Min 8 chars, uppercase, lowercase, number, special char |
| firstName | string | Yes | User's first name | 1-50 characters |
| lastName | string | Yes | User's last name | 1-50 characters |
| role | string | No | User role | Enum: `STUDENT`, `INSTRUCTOR`, `ADMIN` (default: `STUDENT`) |

### Example Request

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john.doe@example.com",
    "password": "StrongPass123!",
    "firstName": "John",
    "lastName": "Doe",
    "role": "STUDENT"
  }'
```

### Example Response

**Success (201 Created)**

```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "email": "john.doe@example.com",
    "verificationEmailSent": true
  }
}
```

**Error (400 Bad Request)**

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "email",
      "message": "Must be a valid email address"
    },
    {
      "field": "password",
      "message": "Password must contain uppercase, lowercase, number, and special character"
    }
  ]
}
```

**Error (409 Conflict)**

```json
{
  "success": false,
  "message": "Email already registered",
  "errors": []
}
```

---

## Login User

Authenticate user and receive access/refresh tokens.

### Endpoint
```
POST /auth/login
```

### Rate Limiting
- **Limit**: 10 requests per minute
- **Header**: `X-RateLimit-Limit: 10`

### Request Body

**Content-Type**: `application/json`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| email | string | Yes | User's email address |
| password | string | Yes | User's password |

### Example Request

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john.doe@example.com",
    "password": "StrongPass123!"
  }'
```

### Example Response

**Success (200 OK)**

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NTBlODQwMC1lMjliLTQxZDQtYTcxNi00NDY2NTU0NDAwMDAiLCJlbWFpbCI6ImpvaG4uZG9lQGV4YW1wbGUuY29tIiwicm9sZSI6IlNUVURFTlQiLCJpYXQiOjE2MDk0NTkyMDAsImV4cCI6MTYwOTQ2MjgwMH0.abc123",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NTBlODQwMC1lMjliLTQxZDQtYTcxNi00NDY2NTU0NDAwMDAiLCJ0eXBlIjoicmVmcmVzaCIsImlhdCI6MTYwOTQ1OTIwMCwiZXhwIjoxNjEyMDUxMjAwfQ.xyz789",
    "expiresIn": 3600,
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "john.doe@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "STUDENT",
      "isEmailVerified": true
    }
  }
}
```

**Error (401 Unauthorized)**

```json
{
  "success": false,
  "message": "Invalid email or password",
  "errors": []
}
```

### Using the Access Token

Include the access token in subsequent requests:

```bash
curl http://localhost:3000/users/profile \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

## Refresh Token

Obtain a new access token using a refresh token.

### Endpoint
```
POST /auth/refresh
```

### Rate Limiting
- **Limit**: 30 requests per minute

### Request Body

**Content-Type**: `application/json`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| refreshToken | string | Yes | Valid refresh token |

### Example Request

```bash
curl -X POST http://localhost:3000/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }'
```

### Example Response

**Success (200 OK)**

```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.new-token...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.new-refresh...",
    "expiresIn": 3600
  }
}
```

**Error (401 Unauthorized)**

```json
{
  "success": false,
  "message": "Invalid or expired refresh token",
  "errors": []
}
```

---

## Logout

Invalidate the current session and refresh token.

### Endpoint
```
POST /auth/logout
```

### Authentication
**Required**: Bearer Token

### Headers

```
Authorization: Bearer <access-token>
Content-Type: application/json
```

### Example Request

```bash
curl -X POST http://localhost:3000/auth/logout \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json"
```

### Example Response

**Success (200 OK)**

```json
{
  "success": true,
  "message": "Logout successful"
}
```

**Error (401 Unauthorized)**

```json
{
  "success": false,
  "message": "Unauthorized",
  "errors": []
}
```

---

## Forgot Password

Request a password reset email.

### Endpoint
```
POST /auth/forgot-password
```

### Rate Limiting
- **Limit**: 5 requests per hour per email

### Request Body

**Content-Type**: `application/json`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| email | string | Yes | User's registered email address |

### Example Request

```bash
curl -X POST http://localhost:3000/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john.doe@example.com"
  }'
```

### Example Response

**Success (200 OK)**

```json
{
  "success": true,
  "message": "Password reset email sent. Please check your inbox."
}
```

**Error (404 Not Found)**

```json
{
  "success": false,
  "message": "User not found",
  "errors": []
}
```

### Security Note

For security reasons, the API returns the same response whether the email exists or not to prevent email enumeration attacks.

---

## Reset Password

Reset password using the token received via email.

### Endpoint
```
POST /auth/reset-password
```

### Rate Limiting
- **Limit**: 5 requests per hour

### Request Body

**Content-Type**: `application/json`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| token | string | Yes | Reset token from email |
| newPassword | string | Yes | New password |

### Example Request

```bash
curl -X POST http://localhost:3000/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "token": "reset-token-from-email-abc123",
    "newPassword": "NewStrongPass456!"
  }'
```

### Example Response

**Success (200 OK)**

```json
{
  "success": true,
  "message": "Password reset successful. You can now login with your new password."
}
```

**Error (400 Bad Request)**

```json
{
  "success": false,
  "message": "Invalid or expired reset token",
  "errors": []
}
```

### Token Expiration

Reset tokens expire after **1 hour** for security purposes.

---

## Change Password

Change password for an authenticated user.

### Endpoint
```
POST /auth/change-password
```

### Authentication
**Required**: Bearer Token

### Headers

```
Authorization: Bearer <access-token>
Content-Type: application/json
```

### Request Body

**Content-Type**: `application/json`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| currentPassword | string | Yes | Current password |
| newPassword | string | Yes | New password |

### Example Request

```bash
curl -X POST http://localhost:3000/auth/change-password \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "currentPassword": "OldPass123!",
    "newPassword": "NewPass456!"
  }'
```

### Example Response

**Success (200 OK)**

```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

**Error (401 Unauthorized)**

```json
{
  "success": false,
  "message": "Current password is incorrect",
  "errors": []
}
```

---

## Verify Email

Verify user's email address using the verification token.

### Endpoint
```
POST /auth/verify-email
```

### Rate Limiting
- **Limit**: 10 requests per hour

### Request Body

**Content-Type**: `application/json`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| token | string | Yes | Email verification token |

### Example Request

```bash
curl -X POST http://localhost:3000/auth/verify-email \
  -H "Content-Type: application/json" \
  -d '{
    "token": "email-verification-token-xyz789"
  }'
```

### Example Response

**Success (200 OK)**

```json
{
  "success": true,
  "message": "Email verified successfully"
}
```

**Error (400 Bad Request)**

```json
{
  "success": false,
  "message": "Invalid or expired verification token",
  "errors": []
}
```

---

## Authentication Flow

### Complete Registration & Login Flow

1. **Register**: `POST /auth/register`
   - User provides email, password, and profile info
   - System sends verification email

2. **Verify Email**: `POST /auth/verify-email`
   - User clicks link in email or submits token
   - Email status becomes verified

3. **Login**: `POST /auth/login`
   - User provides credentials
   - System returns access and refresh tokens

4. **Access Protected Resources**
   - Include access token in Authorization header
   - Token valid for 1 hour (configurable)

5. **Refresh Token**: `POST /auth/refresh`
   - When access token expires, use refresh token
   - Get new access and refresh tokens

6. **Logout**: `POST /auth/logout`
   - Invalidate session and tokens

### Password Reset Flow

1. **Request Reset**: `POST /auth/forgot-password`
   - User enters email
   - System sends reset email with token

2. **Reset Password**: `POST /auth/reset-password`
   - User submits token and new password
   - Password updated, token invalidated

---

## Best Practices

### Token Storage

**Client-Side (Browser)**:
- Store refresh token in HTTP-only, secure cookie
- Store access token in memory (not localStorage)
- Use CSRF protection

**Mobile Apps**:
- Use secure storage (Keychain for iOS, Keystore for Android)
- Never store tokens in plain text

### Token Refresh Strategy

```javascript
// Example: Automatic token refresh
async function apiCall(endpoint, options) {
  let token = getAccessToken();
  
  let response = await fetch(endpoint, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`
    }
  });
  
  if (response.status === 401) {
    // Token expired, refresh it
    const newTokens = await refreshAccessToken();
    token = newTokens.accessToken;
    
    // Retry original request
    response = await fetch(endpoint, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token}`
      }
    });
  }
  
  return response;
}
```

### Security Recommendations

1. **Always use HTTPS** in production
2. **Implement token rotation** on each refresh
3. **Set appropriate token expiration** times
4. **Validate tokens server-side** on every request
5. **Implement rate limiting** to prevent brute force attacks
6. **Use strong password policies**
7. **Log authentication events** for auditing
8. **Implement account lockout** after failed attempts

---

## Testing

### Test with cURL

```bash
# 1. Register
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test1234!","firstName":"Test","lastName":"User"}'

# 2. Login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test1234!"}'

# 3. Use token (replace TOKEN with actual access token)
curl http://localhost:3000/users/profile \
  -H "Authorization: Bearer TOKEN"
```

### Test with Postman

1. Import the OpenAPI spec from `/docs/api/openapi-spec.yaml.md`
2. Use the collection to test all endpoints
3. Set up environment variables for:
   - `base_url`: http://localhost:3000
   - `access_token`: (auto-set after login)
   - `refresh_token`: (auto-set after login)

---

## Troubleshooting

### Common Issues

**Issue**: `401 Unauthorized`
- **Cause**: Missing or invalid token
- **Solution**: Check Authorization header format and token validity

**Issue**: `Token expired`
- **Cause**: Access token lifetime exceeded
- **Solution**: Use refresh token endpoint to get new token

**Issue**: `Invalid credentials`
- **Cause**: Wrong email or password
- **Solution**: Verify credentials or use forgot password flow

**Issue**: `Email already registered`
- **Cause**: Attempting to register with existing email
- **Solution**: Use login flow instead

---

## Related Documentation

- [User API](./users-api.md)
- [OpenAPI Specification](../openapi-spec.yaml.md)
- [API Index](../README.md)
