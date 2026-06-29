# Frequently Asked Questions

## General

### What is the base URL?

| Environment | URL |
|-------------|-----|
| Local | `http://localhost:3000` |
| Staging | `https://api.staging.teachlink.com` |
| Production | `https://api.teachlink.com` |

### What API version should I use?

Send the `X-API-Version` header with your requests. The current version is `1`. If omitted, version `1` is used by default.

```bash
curl -H "X-API-Version: 1" https://api.teachlink.com/users
```

### How do I authenticate?

Include a Bearer token in the `Authorization` header:

```bash
curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." https://api.teachlink.com/users/me
```

See [authentication.md](./authentication.md) for details.

## Pagination

### How does pagination work?

List endpoints support two pagination modes:

**Offset-based** (default):
```
GET /users?page=1&limit=20
```

**Cursor-based** (for large datasets):
```
GET /users?cursor=eyJpZCI6MTIzfQ&limit=20
```

### What's the maximum page size?

The maximum page size is `100` items per request. Mobile endpoints are limited to `20`.

## Rate Limiting

### What happens if I exceed the rate limit?

You'll receive a `429 Too Many Requests` response with a `Retry-After` header indicating how many seconds to wait before retrying.

See [rate-limiting.md](./rate-limiting.md) for the full list of rate limit presets.

## Errors

### What's the error response format?

All errors follow a consistent envelope:

```json
{
  "success": false,
  "statusCode": 404,
  "message": "Resource not found",
  "path": "/api/v1/courses/abc-123",
  "timestamp": "2026-06-24T10:00:00.000Z",
  "correlationId": "req-abc-123-def"
}
```

The `correlationId` can be used when contacting support to trace the request.

See [error-codes.md](./error-codes.md) for all error codes.

## File Uploads

### What's the maximum file size?

File uploads are limited to **10 MB** by default. Files exceeding this limit receive a `413 Payload Too Large` response.

### What formats are supported?

Image processing (via Sharp) supports: JPEG, PNG, WebP, AVIF, TIFF. Video processing (via fluent-ffmpeg) supports common codecs.

## SDK

### Is there an SDK?

Yes! SDKs are auto-generated from the OpenAPI spec:

- **TypeScript**: `sdk/typescript/`
- **Python**: `sdk/python/`

Generate them with:
```bash
npm run sdk:generate
```

## WebSockets

### How do I connect to WebSocket?

Connect to the Socket.io endpoint and pass the JWT as a query parameter:

```javascript
const socket = io('wss://api.teachlink.com', {
  auth: { token: 'eyJhbGciOiJIUzI1NiIs...' }
});
```

## Support

### Where can I get help?

- **Documentation**: Check the `docs/` directory
- **Issues**: Open a GitHub issue in the repository
- **Community**: Join the Telegram community (see README)
