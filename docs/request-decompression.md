# Request Decompression Handling

## Overview

The request decompression middleware automatically handles compressed request payloads sent by clients. This allows the API to accept requests with compressed bodies, reducing bandwidth usage while maintaining full compatibility with uncompressed requests.

## Supported Compression Formats

The middleware supports the following Content-Encoding values:

- **gzip** / **x-gzip**: The most common compression format, widely supported by browsers and HTTP clients
- **deflate**: The raw DEFLATE algorithm, sometimes used by legacy clients
- **br (Brotli)**: Modern compression format with better compression ratios, supported by modern browsers

## How It Works

1. **Detection**: The middleware checks the `Content-Encoding` header on incoming requests
2. **Decompression**: If a supported encoding is detected, the request body is automatically decompressed using the appropriate Node.js zlib decompression stream
3. **Cleanup**: The `Content-Encoding` header is removed after decompression to prevent downstream handlers from attempting to decompress again
4. **Transparent Processing**: The rest of the application sees uncompressed request data and operates normally

## Implementation Details

### Architecture

```
Request with Content-Encoding: gzip
           ↓
DecompressionMiddleware
           ↓
    Detect encoding
           ↓
   Create decompressor stream
           ↓
   Pipe request through decompressor
           ↓
   Remove Content-Encoding header
           ↓
Uncompressed request → Application
```

### Key Features

- **No External Dependencies**: Uses Node.js built-in `zlib` module
- **Error Handling**: Graceful error handling with appropriate HTTP 400 responses for decompression failures
- **Pass-through**: Requests without compression or with unsupported encodings are passed through unchanged
- **Safe Skip**: GET, HEAD, and DELETE requests are skipped (they shouldn't have bodies)
- **Case-Insensitive**: Encoding values are normalized to lowercase for compatibility

## Usage Examples

### Client-Side (JavaScript/Node.js)

```typescript
// Using node-fetch or axios with gzip compression
const response = await fetch('https://api.example.com/endpoint', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Encoding': 'gzip',
  },
  body: gzipCompressedBuffer, // Pre-compressed payload
});
```

### Using curl

```bash
# Send gzip-compressed data
curl -X POST https://api.example.com/endpoint \
  -H "Content-Encoding: gzip" \
  -H "Content-Type: application/json" \
  --data-binary @compressed_payload.gz

# Send brotli-compressed data
curl -X POST https://api.example.com/endpoint \
  -H "Content-Encoding: br" \
  -H "Content-Type: application/json" \
  --compressed
```

### Using Python

```python
import gzip
import requests

data = b'{"key": "value"}'
compressed = gzip.compress(data)

response = requests.post(
    'https://api.example.com/endpoint',
    headers={
        'Content-Encoding': 'gzip',
        'Content-Type': 'application/json'
    },
    data=compressed
)
```

## Error Handling

The middleware implements comprehensive error handling:

### Decompression Errors
If decompression fails (e.g., corrupted compressed data), the middleware returns:

```json
{
  "statusCode": 400,
  "message": "Failed to decompress request body with encoding: gzip",
  "error": "Bad Request"
}
```

### Unsupported Encodings
Unsupported encodings are logged and the request passes through unchanged. If the client expects the server to handle an unsupported encoding, the downstream application will handle it appropriately.

## Performance Considerations

### Bandwidth Savings
- **gzip**: Typically achieves 40-70% size reduction for JSON payloads
- **brotli**: Typically achieves 45-75% size reduction for JSON payloads (better than gzip)
- **deflate**: Similar compression to gzip, usually 40-70% reduction

### CPU Impact
- Decompression is generally faster than compression and has minimal CPU impact
- Node.js zlib module is highly optimized and uses native bindings

### Example Bandwidth Reduction

```
Original payload: 100 KB
Gzip compressed: 30 KB (70% reduction)
Network transfer: 30 KB instead of 100 KB
Decompression time: ~5ms (CPU cost)
Bandwidth saved: 70 KB per request
```

## Testing

The middleware includes comprehensive unit tests covering:

- All supported compression formats
- Case-insensitive encoding detection
- Proper header removal
- Error handling and edge cases
- Request method filtering (GET, HEAD, DELETE)

Run tests with:

```bash
npm test -- src/common/middleware/decompression.middleware.spec.ts
```

## Configuration

### Environment Variables

Currently, the middleware doesn't require any environment variables. It automatically supports all standard compression formats.

### Future Enhancements

Potential configuration options for future versions:

```typescript
// Example future configuration
export interface DecompressionConfig {
  // Maximum decompressed size (default: 10MB)
  maxDecompressedSize?: number;
  
  // Compression formats to support
  supportedFormats?: ('gzip' | 'deflate' | 'br')[];
  
  // Timeout for decompression
  decompressionTimeoutMs?: number;
}
```

## Middleware Ordering

The `DecompressionMiddleware` is positioned:

```
Request
   ↓
helmet (security headers)
   ↓
DecompressionMiddleware ← YOU ARE HERE
   ↓
express.json()
   ↓
express.urlencoded()
   ↓
correlation middleware
   ↓
session middleware
   ↓
[Rest of application]
```

This ordering ensures:
1. Security headers are set first
2. Decompression happens before body parsing
3. Decompressed data is properly parsed as JSON/URL-encoded
4. Correlation IDs and sessions work with decompressed requests

## Troubleshooting

### Issue: "Failed to decompress request body with encoding: gzip"

**Cause**: The compressed data is corrupted or not actually gzip-compressed

**Solution**:
1. Verify the data is properly compressed with the specified algorithm
2. Check for network transmission issues
3. Ensure no intermediate proxies are double-compressing

### Issue: Request body is still compressed after decompression

**Cause**: The middleware might not have been applied or the encoding header is missing

**Solution**:
1. Verify the middleware is registered in main.ts
2. Check that the `Content-Encoding` header is set correctly
3. Ensure no other middleware is intercepting requests

### Issue: Performance degradation with large payloads

**Cause**: Decompression of very large payloads consumes CPU

**Solution**:
1. Consider compression on client-side only for payloads > 1KB
2. Monitor decompression times in production
3. Scale horizontally if decompression CPU usage is high

## Security Considerations

- **Decompression Bomb Protection**: While the middleware doesn't implement explicit limits, consider setting `REQUEST_BODY_LIMIT` environment variable
- **Denial of Service**: Monitor for patterns of excessive decompression requests
- **Content-Encoding Attacks**: The middleware safely handles invalid/corrupted compression

## Related Documentation

- [Node.js zlib documentation](https://nodejs.org/api/zlib.html)
- [HTTP Content-Encoding header (MDN)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Encoding)
- [Request Body Size Limits](./request-body-limits.md)
- [Performance Optimization Guide](./performance-guide.md)

## Implementation Status

✅ Gzip decompression
✅ Brotli decompression  
✅ Deflate decompression
✅ Content-Encoding header handling
✅ Error handling
✅ Unit tests
✅ Documentation

## References

- **Issue**: #651 - Implement request decompression handling
- **Module**: `src/common/middleware/decompression.middleware.ts`
- **Tests**: `src/common/middleware/decompression.middleware.spec.ts`
- **Integration**: `src/main.ts` (lines for middleware registration)
