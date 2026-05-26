# Users API Documentation

Complete documentation for TeachLink user management endpoints.

## Table of Contents
- [Create User](#create-user)
- [Get All Users](#get-all-users)
- [Get User by ID](#get-user-by-id)
- [Update User](#update-user)
- [Delete User](#delete-user)
- [Bulk Update Users](#bulk-update-users)
- [Bulk Delete Users](#bulk-delete-users)
- [Export User Data](#export-user-data)
- [Get Export History](#get-export-history)
- [Download Export](#download-export)

---

## Create User

Create a new user account (Admin only).

### Endpoint
```
POST /users
```

### Authentication
**Required**: Bearer Token  
**Role**: `ADMIN`

### Headers

```
Authorization: Bearer <access-token>
Content-Type: application/json
```

### Request Body

**Content-Type**: `application/json`

| Field | Type | Required | Description | Validation |
|-------|------|----------|-------------|------------|
| email | string | Yes | User's email address | Valid email format, unique |
| password | string | Yes | User's password | Min 8 chars, uppercase, lowercase, number, special char |
| firstName | string | Yes | User's first name | 1-50 characters |
| lastName | string | Yes | User's last name | 1-50 characters |
| role | string | No | User role | Enum: `STUDENT`, `INSTRUCTOR`, `ADMIN` |
| isEmailVerified | boolean | No | Email verification status | Default: `false` |

### Example Request

```bash
curl -X POST http://localhost:3000/users \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "email": "jane.smith@example.com",
    "password": "SecurePass123!",
    "firstName": "Jane",
    "lastName": "Smith",
    "role": "INSTRUCTOR",
    "isEmailVerified": true
  }'
```

### Example Response

**Success (201 Created)**

```json
{
  "success": true,
  "message": "User created successfully",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "email": "jane.smith@example.com",
    "firstName": "Jane",
    "lastName": "Smith",
    "role": "INSTRUCTOR",
    "isEmailVerified": true,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
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
      "message": "Email already exists"
    }
  ]
}
```

**Error (403 Forbidden)**

```json
{
  "success": false,
  "message": "Forbidden: Admin access required",
  "errors": []
}
```

---

## Get All Users

Retrieve a list of all users (Admin only).

### Endpoint
```
GET /users
```

### Authentication
**Required**: Bearer Token  
**Role**: `ADMIN`

### Headers

```
Authorization: Bearer <access-token>
```

### Query Parameters

| Parameter | Type | Required | Description | Default |
|-----------|------|----------|-------------|---------|
| page | number | No | Page number | 1 |
| limit | number | No | Items per page | 20 |
| role | string | No | Filter by role | All roles |
| search | string | No | Search by name or email | - |
| sortBy | string | No | Sort field | `createdAt` |
| sortOrder | string | No | Sort order | `DESC` |

### Example Request

```bash
curl http://localhost:3000/users?page=1&limit=10&role=INSTRUCTOR \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Example Response

**Success (200 OK)**

```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "email": "jane.smith@example.com",
      "firstName": "Jane",
      "lastName": "Smith",
      "role": "INSTRUCTOR",
      "isEmailVerified": true,
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440002",
      "email": "john.doe@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "STUDENT",
      "isEmailVerified": true,
      "createdAt": "2024-01-14T08:20:00.000Z",
      "updatedAt": "2024-01-14T08:20:00.000Z"
    }
  ],
  "meta": {
    "total": 150,
    "page": 1,
    "limit": 10,
    "totalPages": 15
  }
}
```

---

## Get User by ID

Retrieve a specific user's information.

### Endpoint
```
GET /users/:id
```

### Authentication
**Required**: Bearer Token

### Headers

```
Authorization: Bearer <access-token>
```

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string | Yes | User UUID |

### Example Request

```bash
curl http://localhost:3000/users/550e8400-e29b-41d4-a716-446655440001 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Example Response

**Success (200 OK)**

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "email": "jane.smith@example.com",
    "firstName": "Jane",
    "lastName": "Smith",
    "role": "INSTRUCTOR",
    "isEmailVerified": true,
    "profilePicture": "https://cdn.teachlink.com/profiles/jane-smith.jpg",
    "bio": "Experienced educator with 10+ years in online teaching",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z",
    "lastLoginAt": "2024-01-20T14:45:00.000Z"
  }
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

---

## Update User

Update user information.

### Endpoint
```
PATCH /users/:id
```

### Authentication
**Required**: Bearer Token

### Headers

```
Authorization: Bearer <access-token>
Content-Type: application/json
```

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string | Yes | User UUID |

### Request Body

**Content-Type**: `application/json`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| firstName | string | No | User's first name |
| lastName | string | No | User's last name |
| role | string | No | User role (Admin only) |
| bio | string | No | User biography |
| profilePicture | string | No | Profile picture URL |
| isEmailVerified | boolean | No | Email verification status (Admin only) |

### Example Request

```bash
curl -X PATCH http://localhost:3000/users/550e8400-e29b-41d4-a716-446655440001 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Jane",
    "lastName": "Smith-Doe",
    "bio": "Updated bio with more details about teaching experience"
  }'
```

### Example Response

**Success (200 OK)**

```json
{
  "success": true,
  "message": "User updated successfully",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "email": "jane.smith@example.com",
    "firstName": "Jane",
    "lastName": "Smith-Doe",
    "role": "INSTRUCTOR",
    "bio": "Updated bio with more details about teaching experience",
    "updatedAt": "2024-01-20T15:30:00.000Z"
  }
}
```

---

## Delete User

Delete a user account (Admin only).

### Endpoint
```
DELETE /users/:id
```

### Authentication
**Required**: Bearer Token  
**Role**: `ADMIN`

### Headers

```
Authorization: Bearer <access-token>
```

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string | Yes | User UUID |

### Example Request

```bash
curl -X DELETE http://localhost:3000/users/550e8400-e29b-41d4-a716-446655440001 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Example Response

**Success (200 OK)**

```json
{
  "success": true,
  "message": "User deleted successfully"
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

### Important Notes

- User deletion is **permanent** and cannot be undone
- All associated data (courses, enrollments, etc.) may be affected
- Consider soft delete implementation for data retention

---

## Bulk Update Users

Update multiple users at once (Admin only).

### Endpoint
```
PATCH /users/bulk-update
```

### Authentication
**Required**: Bearer Token  
**Role**: `ADMIN`

### Headers

```
Authorization: Bearer <access-token>
Content-Type: application/json
```

### Request Body

**Content-Type**: `application/json`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| ids | string[] | Yes | Array of user UUIDs |
| data | object | Yes | Fields to update |

### Example Request

```bash
curl -X PATCH http://localhost:3000/users/bulk-update \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "ids": [
      "550e8400-e29b-41d4-a716-446655440001",
      "550e8400-e29b-41d4-a716-446655440002",
      "550e8400-e29b-41d4-a716-446655440003"
    ],
    "data": {
      "role": "INSTRUCTOR"
    }
  }'
```

### Example Response

**Success (200 OK)**

```json
{
  "success": true,
  "message": "3 users updated successfully",
  "data": {
    "updatedCount": 3,
    "updatedIds": [
      "550e8400-e29b-41d4-a716-446655440001",
      "550e8400-e29b-41d4-a716-446655440002",
      "550e8400-e29b-41d4-a716-446655440003"
    ]
  }
}
```

---

## Bulk Delete Users

Delete multiple users at once (Admin only).

### Endpoint
```
DELETE /users/bulk-delete
```

### Authentication
**Required**: Bearer Token  
**Role**: `ADMIN`

### Headers

```
Authorization: Bearer <access-token>
Content-Type: application/json
```

### Request Body

**Content-Type**: `application/json`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| ids | string[] | Yes | Array of user UUIDs to delete |

### Example Request

```bash
curl -X DELETE http://localhost:3000/users/bulk-delete \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "ids": [
      "550e8400-e29b-41d4-a716-446655440001",
      "550e8400-e29b-41d4-a716-446655440002"
    ]
  }'
```

### Example Response

**Success (200 OK)**

```json
{
  "success": true,
  "message": "2 users deleted successfully",
  "data": {
    "deletedCount": 2,
    "deletedIds": [
      "550e8400-e29b-41d4-a716-446655440001",
      "550e8400-e29b-41d4-a716-446655440002"
    ]
  }
}
```

---

## Export User Data

Request an export of your user data (GDPR compliance).

### Endpoint
```
POST /users/me/export
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

| Field | Type | Required | Description | Default |
|-------|------|----------|-------------|---------|
| format | string | No | Export format | `json` |

**Supported Formats**:
- `json` - JSON format
- `pdf` - PDF document

### Example Request

```bash
curl -X POST http://localhost:3000/users/me/export \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "format": "json"
  }'
```

### Example Response

**Success (200 OK)**

```json
{
  "success": true,
  "message": "Export request queued. You will be notified when ready.",
  "data": {
    "exportId": "export-123456",
    "status": "pending",
    "format": "json",
    "requestedAt": "2024-01-20T16:00:00.000Z"
  }
}
```

---

## Get Export History

View your data export request history.

### Endpoint
```
GET /users/me/export/history
```

### Authentication
**Required**: Bearer Token

### Headers

```
Authorization: Bearer <access-token>
```

### Example Request

```bash
curl http://localhost:3000/users/me/export/history \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Example Response

**Success (200 OK)**

```json
{
  "success": true,
  "data": [
    {
      "exportId": "export-123456",
      "format": "json",
      "status": "completed",
      "requestedAt": "2024-01-20T16:00:00.000Z",
      "completedAt": "2024-01-20T16:05:00.000Z",
      "fileName": "user-data-export-123456.json"
    },
    {
      "exportId": "export-123455",
      "format": "pdf",
      "status": "completed",
      "requestedAt": "2024-01-15T10:00:00.000Z",
      "completedAt": "2024-01-15T10:08:00.000Z",
      "fileName": "user-data-export-123455.pdf"
    }
  ]
}
```

---

## Download Export

Download a completed data export file.

### Endpoint
```
GET /users/me/export/:exportId
```

### Authentication
**Required**: Bearer Token

### Headers

```
Authorization: Bearer <access-token>
```

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| exportId | string | Yes | Export request ID |

### Example Request

```bash
curl http://localhost:3000/users/me/export/export-123456 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  --output user-data-export.json
```

### Example Response

**Success (200 OK)**

Returns the exported file as a download.

**Headers**:
```
Content-Type: application/json
Content-Disposition: attachment; filename="user-data-export-123456.json"
```

**Error (404 Not Found)**

```json
{
  "success": false,
  "message": "Export not found or not yet completed",
  "errors": []
}
```

---

## User Roles

### Role Definitions

| Role | Description | Permissions |
|------|-------------|-------------|
| `STUDENT` | Learner | Browse courses, enroll, submit assessments |
| `INSTRUCTOR` | Course creator | Create/manage courses, view student progress |
| `ADMIN` | Platform administrator | Full access to all features and user management |

### Role-Based Access Control

- **Public endpoints**: No authentication required
- **Authenticated endpoints**: Any authenticated user
- **Admin endpoints**: Requires `ADMIN` role
- **User-specific endpoints**: User can only access their own data

---

## Best Practices

### User Data Privacy

1. **Never expose passwords** in API responses
2. **Use UUIDs** instead of sequential IDs
3. **Implement data minimization** - only return necessary fields
4. **Respect GDPR** - provide data export and deletion capabilities
5. **Audit logging** - track all user data changes

### Pagination

Always use pagination for list endpoints to improve performance:

```javascript
// Example: Fetching all users with pagination
async function getAllUsers(page = 1, limit = 20) {
  const response = await fetch(`/users?page=${page}&limit=${limit}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const data = await response.json();
  
  if (data.meta.page < data.meta.totalPages) {
    // Fetch next page
    return getAllUsers(page + 1, limit);
  }
  
  return data.data;
}
```

---

## Testing

### Test with cURL

```bash
# 1. Get user profile
curl http://localhost:3000/users/me \
  -H "Authorization: Bearer YOUR_TOKEN"

# 2. Update user profile
curl -X PATCH http://localhost:3000/users/me \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"firstName":"Updated","lastName":"Name"}'

# 3. Request data export
curl -X POST http://localhost:3000/users/me/export \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"format":"json"}'
```

---

## Related Documentation

- [Authentication API](../auth/auth-api.md)
- [Courses API](../courses/courses-api.md)
- [OpenAPI Specification](../../openapi-spec.yaml.md)
- [API Index](../../README.md)
