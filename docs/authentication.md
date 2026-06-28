# Authentication

TeachLink API uses **JWT (JSON Web Tokens)** for authentication, validated via Passport strategies.

## Authentication Flow

### 1. Obtain a Token

```
POST /api/v1/auth/login

Request:
{
  "email": "user@example.com",
  "password": "secure-password"
}

Response 200:
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 3600
  }
}
```

### 2. Use the Token

Include the access token in the `Authorization` header for all protected endpoints:

```text
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

### 3. Registration

```
POST /api/v1/auth/register

Request:
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "name": "John Doe"
}

Response 201:
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

## Guards & Decorators

### `@UseGuards(JwtAuthGuard)`

Applied at the controller or method level. Returns 401 if the token is missing, expired, or invalid.

```typescript
@Controller('courses')
@UseGuards(JwtAuthGuard)
export class CoursesController { ... }
```

### `@Roles('admin', 'instructor')`

Restricts access to users with specific roles. Must be used with `JwtAuthGuard`.

```typescript
@Delete(':id')
@Roles('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
async deleteCourse(@Param('id') id: string) { ... }
```

Available roles: `USER`, `MODERATOR`, `ADMIN`

### `@Permissions('course:write', 'course:delete')`

Fine-grained permission-based access control.

```typescript
@Post()
@Permissions('course:create')
@UseGuards(JwtAuthGuard, PermissionsGuard)
async createCourse(@Body() dto: CreateCourseDto) { ... }
```

### `@CurrentUser()`

Param decorator to extract the authenticated user from the request:

```typescript
@Get('me')
@UseGuards(JwtAuthGuard)
async getProfile(@CurrentUser() user: User) { ... }
```

## Sessions

The API also supports session-based authentication via `express-session` with Redis store:

- Session data is stored in Redis
- Session fixation protection is enforced (User-Agent is validated)
- Sessions are configured in `src/config/cache.config.ts`

## API Versioning

The API uses header-based versioning:

```text
X-API-Version: 1
```

Requests without the header default to version `1`. Deprecated versions return warning headers (`Deprecation`, `Sunset`).

## Error Responses

| Status | Meaning | Resolution |
|--------|---------|-----------|
| 401 | Missing or invalid token | Check `Authorization` header format (`Bearer <token>`) |
| 401 | Invalid credentials | Verify email/password combination |
| 401 | Token expired | Use the refresh token to obtain a new access token |
| 403 | Insufficient permissions | Verify user has the required role/permission |
