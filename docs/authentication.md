# Authentication

TeachLink API uses **JWT (JSON Web Tokens)** for authentication, validated via Passport strategies.

## Signing Algorithms

The API supports two JWT signing algorithms:

| Algorithm | Type | Configuration |
|-----------|------|---------------|
| **HS256** (default) | Symmetric (HMAC + SHA-256) | `JWT_SECRET` — single shared secret |
| **RS256** | Asymmetric (RSA + SHA-256) | `JWT_PRIVATE_KEY` + `JWT_PUBLIC_KEY` — PEM key pair |

### HS256 (Symmetric)

HS256 uses a single shared secret to both sign and verify tokens. Simple to set up but any service that verifies tokens must also possess the signing secret.

```env
JWT_SECRET=your-super-secret-key-min-32-chars
```

### RS256 (Asymmetric)

RS256 uses a private key to sign tokens and a separate public key to verify them. This allows verification services to use a public key without access to the private signing key.

```env
JWT_PRIVATE_KEY=-----BEGIN RSA PRIVATE KEY-----\n...
JWT_PUBLIC_KEY=-----BEGIN PUBLIC KEY-----\n...
```

PEM values can be provided inline (as shown above) or as file paths pointing to `.pem` files.

### Key Generation

Generate an RS256 key pair for development:

```bash
# Generate a 2048-bit RSA private key
openssl genrsa -out private.pem 2048

# Extract the corresponding public key
openssl rsa -in private.pem -pubout -out public.pem
```

Then reference the files in your `.env`:

```env
JWT_PRIVATE_KEY=./private.pem
JWT_PUBLIC_KEY=./public.pem
```

Or use the raw PEM content directly (for `.env` files, replace newlines with `\n`):

```env
JWT_PRIVATE_KEY=-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA...
JWT_PUBLIC_KEY=-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0B...
```

> **Production recommendation:** Use a key management service (AWS KMS, HashiCorp Vault) to store private keys. Set `SECRET_PROVIDER=aws` or `SECRET_PROVIDER=vault` to load secrets from external providers.

### Key Rotation

The `JwtStrategy` uses `secretOrKeyProvider` (a callback invoked on every request) rather than a static `secretOrKey`. This design allows key rotation without restarting services:

1. Deploy the new public key to all verification services.
2. Update the signing service to use the new private key.
3. Tokens signed with the old key remain valid until expiration.

For HS256 key rotation, use the `JWT_SECRETS` (comma-separated) and `JWT_SECRET_CURRENT_VERSION` environment variables (legacy support).

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
