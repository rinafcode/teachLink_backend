# TeachLink API Documentation

Welcome to the comprehensive API documentation for the TeachLink platform. This documentation provides detailed information about all available API endpoints, request/response formats, authentication, and usage examples.

## Quick Links

### Core APIs
- [**Authentication API**](./auth/auth-api.md) - User registration, login, and session management
- [**Users API**](./users/users-api.md) - User profile and account management
- [**Courses API**](./courses/courses-api.md) - Course creation, management, and enrollment
- [**Payments API**](./payments/payments-api.md) - Payment processing and subscriptions

### Additional APIs
- [Assessments API](./assessments/assessments-api.md) - Quizzes and assessments
- [Notifications API](./notifications/notifications-api.md) - User notifications
- [Search API](./search/search-api.md) - Search and discovery
- [Analytics API](./analytics/analytics-api.md) - Analytics and reporting

## API Overview

**Base URL**: 
- Development: `http://localhost:3000`
- Production: `https://api.teachlink.com`

**API Version**: v1.0.0

**Interactive Documentation**: 
- Swagger UI: http://localhost:3000/api/docs

## Authentication

Most API endpoints require authentication using JWT (JSON Web Tokens).

### Authentication Flow

1. **Register** a new account or **Login** with existing credentials
2. Receive an **access token** and **refresh token**
3. Include the access token in the `Authorization` header:
   ```
   Authorization: Bearer <your-access-token>
   ```
4. Tokens expire after 1 hour - use the refresh token to obtain new tokens

[Read full Authentication documentation →](./auth/auth-api.md)

### API Keys

For server-to-server communication, use API keys:
```
X-API-Key: your-api-key-here
```

## Request Format

### Headers

All API requests should include these headers:

```
Content-Type: application/json
Authorization: Bearer <token>
Accept: application/json
```

### Request Body

All request bodies should be JSON formatted:

```json
{
  "field1": "value1",
  "field2": "value2"
}
```

## Response Format

### Success Response

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {
    // Response data
  }
}
```

### Error Response

```json
{
  "success": false,
  "message": "Error description",
  "errors": [
    {
      "field": "fieldName",
      "message": "Specific error message"
    }
  ]
}
```

### Pagination

List endpoints support pagination:

```json
{
  "success": true,
  "data": [/* items */],
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "totalPages": 5
  }
}
```

## HTTP Status Codes

| Code | Description | Common Usage |
|------|-------------|--------------|
| 200 | OK | Successful request |
| 201 | Created | Resource created successfully |
| 400 | Bad Request | Validation errors, invalid input |
| 401 | Unauthorized | Missing or invalid authentication |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Resource already exists |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |

## Rate Limiting

API endpoints have rate limits to prevent abuse:

| Endpoint Type | Limit | Window |
|---------------|-------|--------|
| Authentication | 10 requests | 1 minute |
| General | 100 requests | 1 minute |
| Search | 60 requests | 1 minute |
| Payments | 10 requests | 1 hour |

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1609459200
```

## API Endpoints Summary

### Authentication (`/auth`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/auth/register` | Register new user | No |
| POST | `/auth/login` | Login user | No |
| POST | `/auth/refresh` | Refresh access token | No |
| POST | `/auth/logout` | Logout user | Yes |
| POST | `/auth/forgot-password` | Request password reset | No |
| POST | `/auth/reset-password` | Reset password | No |
| POST | `/auth/change-password` | Change password | Yes |
| POST | `/auth/verify-email` | Verify email | No |

### Users (`/users`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/users` | Create user (Admin) | Yes (Admin) |
| GET | `/users` | Get all users (Admin) | Yes (Admin) |
| GET | `/users/:id` | Get user by ID | Yes |
| PATCH | `/users/:id` | Update user | Yes |
| DELETE | `/users/:id` | Delete user (Admin) | Yes (Admin) |
| PATCH | `/users/bulk-update` | Bulk update users (Admin) | Yes (Admin) |
| DELETE | `/users/bulk-delete` | Bulk delete users (Admin) | Yes (Admin) |
| POST | `/users/me/export` | Export user data | Yes |
| GET | `/users/me/export/history` | Get export history | Yes |
| GET | `/users/me/export/:exportId` | Download export | Yes |

### Courses (`/courses`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/courses` | Create course | Yes (Instructor) |
| GET | `/courses` | List all courses | No |
| GET | `/courses/cursor` | List with cursor pagination | No |
| GET | `/courses/analytics` | Course analytics | Yes (Instructor) |
| GET | `/courses/:id` | Get course details | No |
| PATCH | `/courses/:id` | Update course | Yes (Owner/Admin) |
| DELETE | `/courses/:id` | Delete course | Yes (Owner/Admin) |
| POST | `/courses/:id/modules` | Create module | Yes (Owner/Admin) |
| POST | `/courses/modules/:moduleId/lessons` | Create lesson | Yes (Owner/Admin) |
| POST | `/courses/:id/enroll` | Enroll in course | Yes |

### Payments (`/payments`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/payments/create-intent` | Create payment intent | Yes |
| POST | `/payments/subscriptions` | Create subscription | Yes |
| POST | `/payments/refund` | Process refund | Yes (Admin/Teacher) |
| GET | `/payments/invoices/:paymentId` | Get invoice | Yes |
| GET | `/payments/user/payments` | Get payment history | Yes |
| GET | `/payments/user/subscriptions` | Get subscriptions | Yes |

## User Roles

The API supports role-based access control (RBAC):

| Role | Description | Permissions |
|------|-------------|-------------|
| `STUDENT` | Learner | Browse courses, enroll, submit assessments |
| `INSTRUCTOR` / `TEACHER` | Course creator | Create/manage courses, view analytics |
| `ADMIN` | Platform administrator | Full access to all features |

## SDKs & Libraries

### JavaScript/TypeScript

```javascript
// Install SDK
npm install @teachlink/sdk

// Initialize client
const TeachLink = require('@teachlink/sdk');

const client = new TeachLink({
  apiKey: 'your-api-key',
  baseUrl: 'https://api.teachlink.com'
});

// Example: Create course
const course = await client.courses.create({
  title: 'Web Development Bootcamp',
  description: 'Learn web development from scratch',
  category: 'Web Development',
  level: 'BEGINNER',
  price: 4999
});
```

### Python

```python
# Install SDK
pip install teachlink-python

# Initialize client
from teachlink import TeachLink

client = TeachLink(
    api_key='your-api-key',
    base_url='https://api.teachlink.com'
)

# Example: List courses
courses = client.courses.list(
    category='Web Development',
    level='BEGINNER',
    page=1,
    limit=20
)
```

## Code Examples

### Creating a Course (Node.js)

```javascript
const axios = require('axios');

async function createCourse(token, courseData) {
  try {
    const response = await axios.post(
      'http://localhost:3000/courses',
      courseData,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    return response.data;
  } catch (error) {
    console.error('Error creating course:', error.response?.data || error.message);
    throw error;
  }
}

// Usage
createCourse('your-jwt-token', {
  title: 'Complete JavaScript Course',
  description: 'Master JavaScript from basics to advanced',
  category: 'Web Development',
  level: 'BEGINNER',
  price: 3999,
  tags: ['javascript', 'web development', 'programming']
});
```

### Enrolling in a Course (Python)

```python
import requests

def enroll_in_course(token, course_id):
    url = f"http://localhost:3000/courses/{course_id}/enroll"
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    
    response = requests.post(url, headers=headers)
    
    if response.status_code == 200:
        print("Successfully enrolled!")
        return response.json()
    else:
        print(f"Enrollment failed: {response.json()['message']}")
        return None

# Usage
enroll_in_course('your-jwt-token', 'course-123456')
```

## Best Practices

### 1. Error Handling

Always implement proper error handling:

```javascript
async function apiCall(endpoint, options) {
  try {
    const response = await fetch(endpoint, options);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Request failed');
    }
    
    return data;
  } catch (error) {
    // Handle errors appropriately
    console.error('API Error:', error);
    throw error;
  }
}
```

### 2. Token Management

Store tokens securely and refresh them when expired:

```javascript
let accessToken = null;
let tokenExpiry = null;

async function getValidToken() {
  if (accessToken && tokenExpiry > Date.now()) {
    return accessToken;
  }
  
  // Token expired or doesn't exist, refresh it
  const response = await fetch('/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: getRefreshToken() })
  });
  
  const data = await response.json();
  accessToken = data.data.accessToken;
  tokenExpiry = Date.now() + (data.data.expiresIn * 1000);
  
  return accessToken;
}
```

### 3. Pagination

Handle pagination for large datasets:

```javascript
async function getAllItems(endpoint, token) {
  let allItems = [];
  let page = 1;
  let hasMore = true;
  
  while (hasMore) {
    const response = await fetch(
      `${endpoint}?page=${page}&limit=100`,
      {
        headers: { 'Authorization': `Bearer ${token}` }
      }
    );
    
    const data = await response.json();
    allItems = allItems.concat(data.data);
    
    hasMore = data.meta.page < data.meta.totalPages;
    page++;
  }
  
  return allItems;
}
```

### 4. Idempotency

For critical operations (payments, subscriptions), use idempotency keys:

```javascript
async function createPayment(paymentData) {
  const idempotencyKey = generateUniqueId();
  
  const response = await fetch('/payments/create-intent', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': idempotencyKey
    },
    body: JSON.stringify(paymentData)
  });
  
  return response.json();
}
```

## Testing

### Using cURL

```bash
# Login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'

# Get courses
curl http://localhost:3000/courses?page=1&limit=10

# Create course (with auth)
curl -X POST http://localhost:3000/courses \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Course","description":"A test","category":"Test","level":"BEGINNER","price":0}'
```

### Using Postman

1. Import the OpenAPI spec from [openapi-spec.yaml.md](./openapi-spec.yaml.md)
2. Set up environment variables:
   - `base_url`: http://localhost:3000
   - `access_token`: (auto-set after login)
3. Use pre-request scripts to handle authentication

## Interactive Documentation

Access the interactive Swagger UI at:
- **Local**: http://localhost:3000/api/docs
- **Production**: https://api.teachlink.com/api/docs

Features:
- Try out API endpoints directly
- View request/response schemas
- Test authentication flows
- Download OpenAPI spec

## API Changelog

### Version 1.0.0 (Current)

- Initial API release
- Authentication & authorization
- User management
- Course management
- Payment processing
- Subscription management
- Data export (GDPR compliance)

## Support & Resources

- **API Issues**: [GitHub Issues](https://github.com/teachlink/backend/issues)
- **Developer Forum**: [Community Forum](https://community.teachlink.com)
- **Email Support**: api-support@teachlink.com
- **Status Page**: https://status.teachlink.com

## License

This API is licensed under the MIT License. See [LICENSE](../../LICENSE) for details.

---

## Next Steps

1. [Set up Authentication](./auth/auth-api.md)
2. [Browse Available Courses](./courses/courses-api.md)
3. [Process Payments](./payments/payments-api.md)
4. [Explore Full OpenAPI Spec](./openapi-spec.yaml.md)

Happy coding! 🚀
