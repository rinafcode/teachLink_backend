# Courses API Documentation

Complete documentation for TeachLink course management endpoints.

## Table of Contents
- [Create Course](#create-course)
- [Get All Courses](#get-all-courses)
- [Get Courses with Cursor Pagination](#get-courses-with-cursor-pagination)
- [Get Course Analytics](#get-course-analytics)
- [Get Course by ID](#get-course-by-id)
- [Update Course](#update-course)
- [Delete Course](#delete-course)
- [Create Module](#create-module)
- [Create Lesson](#create-lesson)
- [Enroll in Course](#enroll-in-course)

---

## Create Course

Create a new course (Instructors and Admins only).

### Endpoint
```
POST /courses
```

### Authentication
**Required**: Bearer Token  
**Role**: `INSTRUCTOR` or `ADMIN`

### Headers

```
Authorization: Bearer <access-token>
Content-Type: application/json
```

### Request Body

**Content-Type**: `application/json`

| Field | Type | Required | Description | Validation |
|-------|------|----------|-------------|------------|
| title | string | Yes | Course title | 3-100 characters |
| description | string | Yes | Course description | Min 10 characters |
| category | string | Yes | Course category | Valid category |
| level | string | Yes | Difficulty level | `BEGINNER`, `INTERMEDIATE`, `ADVANCED` |
| price | number | No | Course price (0 for free) | Non-negative number |
| tags | string[] | No | Course tags | Array of strings |
| thumbnailUrl | string | No | Course thumbnail URL | Valid URL |
| isPublished | boolean | No | Publication status | Default: `false` |

### Example Request

```bash
curl -X POST http://localhost:3000/courses \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Complete Web Development Bootcamp",
    "description": "Learn web development from scratch with HTML, CSS, JavaScript, React, Node.js and more!",
    "category": "Web Development",
    "level": "BEGINNER",
    "price": 49.99,
    "tags": ["web development", "javascript", "react", "nodejs"],
    "thumbnailUrl": "https://cdn.teachlink.com/courses/web-dev-bootcamp.jpg",
    "isPublished": false
  }'
```

### Example Response

**Success (201 Created)**

```json
{
  "success": true,
  "message": "Course created successfully",
  "data": {
    "id": "course-123456",
    "title": "Complete Web Development Bootcamp",
    "description": "Learn web development from scratch with HTML, CSS, JavaScript, React, Node.js and more!",
    "category": "Web Development",
    "level": "BEGINNER",
    "price": 49.99,
    "tags": ["web development", "javascript", "react", "nodejs"],
    "thumbnailUrl": "https://cdn.teachlink.com/courses/web-dev-bootcamp.jpg",
    "instructorId": "instructor-789",
    "isPublished": false,
    "enrollmentCount": 0,
    "rating": 0,
    "createdAt": "2024-01-20T10:00:00.000Z",
    "updatedAt": "2024-01-20T10:00:00.000Z"
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
      "field": "title",
      "message": "Title must be at least 3 characters"
    }
  ]
}
```

---

## Get All Courses

Retrieve a list of all published courses with search and filtering.

### Endpoint
```
GET /courses
```

### Authentication
**Not Required** (Public endpoint)

### Query Parameters

| Parameter | Type | Required | Description | Default |
|-----------|------|----------|-------------|---------|
| page | number | No | Page number | 1 |
| limit | number | No | Items per page | 20 |
| search | string | No | Search in title/description | - |
| category | string | No | Filter by category | All |
| level | string | No | Filter by level | All |
| minPrice | number | No | Minimum price | 0 |
| maxPrice | number | No | Maximum price | ∞ |
| instructorId | string | No | Filter by instructor | All |
| tags | string[] | No | Filter by tags (comma-separated) | - |
| sortBy | string | No | Sort field | `createdAt` |
| sortOrder | string | No | Sort order (`ASC`/`DESC`) | `DESC` |

### Example Request

```bash
curl "http://localhost:3000/courses?category=Web+Development&level=BEGINNER&sortBy=rating&page=1&limit=10"
```

### Example Response

**Success (200 OK)**

```json
{
  "success": true,
  "data": [
    {
      "id": "course-123456",
      "title": "Complete Web Development Bootcamp",
      "description": "Learn web development from scratch...",
      "category": "Web Development",
      "level": "BEGINNER",
      "price": 49.99,
      "tags": ["web development", "javascript", "react"],
      "thumbnailUrl": "https://cdn.teachlink.com/courses/web-dev-bootcamp.jpg",
      "instructorId": "instructor-789",
      "instructorName": "John Doe",
      "isPublished": true,
      "enrollmentCount": 1250,
      "rating": 4.8,
      "reviewCount": 342,
      "createdAt": "2024-01-15T10:00:00.000Z"
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

## Get Courses with Cursor Pagination

Retrieve courses using cursor-based pagination for infinite scroll.

### Endpoint
```
GET /courses/cursor
```

### Authentication
**Not Required** (Public endpoint)

### Query Parameters

| Parameter | Type | Required | Description | Default |
|-----------|------|----------|-------------|---------|
| limit | number | No | Items per page | 20 |
| cursor | string | No | Cursor for next page | - |
| search | string | No | Search query | - |
| category | string | No | Filter by category | - |

### Example Request

```bash
# First page
curl "http://localhost:3000/courses/cursor?limit=10"

# Next page (using cursor from previous response)
curl "http://localhost:3000/courses/cursor?limit=10&cursor=eyJpZCI6ImNvdXJzZS0xMjM0NTYiLCJjcmVhdGVkQXQiOiIyMDI0LTAxLTIwIn0="
```

### Example Response

**Success (200 OK)**

```json
{
  "success": true,
  "data": [
    {
      "id": "course-123456",
      "title": "Complete Web Development Bootcamp",
      "description": "Learn web development from scratch...",
      "category": "Web Development",
      "level": "BEGINNER",
      "price": 49.99,
      "rating": 4.8,
      "enrollmentCount": 1250
    }
  ],
  "meta": {
    "hasMore": true,
    "nextCursor": "eyJpZCI6ImNvdXJzZS0xMjM0NTciLCJjcmVhdGVkQXQiOiIyMDI0LTAxLTE5In0=",
    "limit": 10
  }
}
```

---

## Get Course Analytics

Get analytics data for courses (Instructors and Admins).

### Endpoint
```
GET /courses/analytics
```

### Authentication
**Required**: Bearer Token  
**Role**: `INSTRUCTOR` or `ADMIN`

### Headers

```
Authorization: Bearer <access-token>
```

### Example Request

```bash
curl http://localhost:3000/courses/analytics \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Example Response

**Success (200 OK)**

```json
{
  "success": true,
  "data": {
    "totalCourses": 25,
    "totalEnrollments": 5420,
    "totalRevenue": 125430.50,
    "averageRating": 4.6,
    "topCourses": [
      {
        "courseId": "course-123456",
        "title": "Complete Web Development Bootcamp",
        "enrollments": 1250,
        "revenue": 62375.00,
        "rating": 4.8
      }
    ],
    "enrollmentTrend": [
      {
        "date": "2024-01-01",
        "enrollments": 150
      },
      {
        "date": "2024-01-02",
        "enrollments": 175
      }
    ]
  }
}
```

---

## Get Course by ID

Retrieve detailed information about a specific course.

### Endpoint
```
GET /courses/:id
```

### Authentication
**Not Required** (Public endpoint)

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string | Yes | Course ID |

### Example Request

```bash
curl http://localhost:3000/courses/course-123456
```

### Example Response

**Success (200 OK)**

```json
{
  "success": true,
  "data": {
    "id": "course-123456",
    "title": "Complete Web Development Bootcamp",
    "description": "Learn web development from scratch with HTML, CSS, JavaScript, React, Node.js and more!",
    "category": "Web Development",
    "level": "BEGINNER",
    "price": 49.99,
    "tags": ["web development", "javascript", "react", "nodejs"],
    "thumbnailUrl": "https://cdn.teachlink.com/courses/web-dev-bootcamp.jpg",
    "instructorId": "instructor-789",
    "instructor": {
      "id": "instructor-789",
      "firstName": "John",
      "lastName": "Doe",
      "profilePicture": "https://cdn.teachlink.com/profiles/john-doe.jpg",
      "bio": "Senior Full Stack Developer"
    },
    "modules": [
      {
        "id": "module-001",
        "title": "Introduction to HTML",
        "order": 1,
        "lessonsCount": 5
      },
      {
        "id": "module-002",
        "title": "CSS Fundamentals",
        "order": 2,
        "lessonsCount": 7
      }
    ],
    "isPublished": true,
    "enrollmentCount": 1250,
    "rating": 4.8,
    "reviewCount": 342,
    "createdAt": "2024-01-15T10:00:00.000Z",
    "updatedAt": "2024-01-20T15:30:00.000Z"
  }
}
```

**Error (404 Not Found)**

```json
{
  "success": false,
  "message": "Course not found",
  "errors": []
}
```

---

## Update Course

Update course information (Course instructor or Admin only).

### Endpoint
```
PATCH /courses/:id
```

### Authentication
**Required**: Bearer Token  
**Authorization**: Course instructor or Admin

### Headers

```
Authorization: Bearer <access-token>
Content-Type: application/json
```

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string | Yes | Course ID |

### Request Body

**Content-Type**: `application/json`

All fields are optional. Only provided fields will be updated.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| title | string | No | Course title |
| description | string | No | Course description |
| category | string | No | Course category |
| level | string | No | Difficulty level |
| price | number | No | Course price |
| tags | string[] | No | Course tags |
| thumbnailUrl | string | No | Course thumbnail URL |
| isPublished | boolean | No | Publication status |

### Example Request

```bash
curl -X PATCH http://localhost:3000/courses/course-123456 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Complete Web Development Bootcamp 2024",
    "price": 59.99,
    "isPublished": true
  }'
```

### Example Response

**Success (200 OK)**

```json
{
  "success": true,
  "message": "Course updated successfully",
  "data": {
    "id": "course-123456",
    "title": "Complete Web Development Bootcamp 2024",
    "description": "Learn web development from scratch...",
    "category": "Web Development",
    "level": "BEGINNER",
    "price": 59.99,
    "isPublished": true,
    "updatedAt": "2024-01-20T16:00:00.000Z"
  }
}
```

**Error (403 Forbidden)**

```json
{
  "success": false,
  "message": "You are not authorized to update this course",
  "errors": []
}
```

---

## Delete Course

Delete a course (Course instructor or Admin only).

### Endpoint
```
DELETE /courses/:id
```

### Authentication
**Required**: Bearer Token  
**Authorization**: Course instructor or Admin

### Headers

```
Authorization: Bearer <access-token>
```

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string | Yes | Course ID |

### Example Request

```bash
curl -X DELETE http://localhost:3000/courses/course-123456 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Example Response

**Success (200 OK)**

```json
{
  "success": true,
  "message": "Course deleted successfully"
}
```

**Warning**: This action is irreversible and will:
- Remove all modules and lessons
- Cancel all enrollments
- Delete associated analytics data

---

## Create Module

Add a new module to a course (Course instructor or Admin only).

### Endpoint
```
POST /courses/:id/modules
```

### Authentication
**Required**: Bearer Token  
**Authorization**: Course instructor or Admin

### Headers

```
Authorization: Bearer <access-token>
Content-Type: application/json
```

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string | Yes | Course ID |

### Request Body

**Content-Type**: `application/json`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| title | string | Yes | Module title |
| description | string | No | Module description |
| order | number | Yes | Module order in course |

### Example Request

```bash
curl -X POST http://localhost:3000/courses/course-123456/modules \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Introduction to HTML",
    "description": "Learn the basics of HTML5",
    "order": 1
  }'
```

### Example Response

**Success (201 Created)**

```json
{
  "success": true,
  "message": "Module created successfully",
  "data": {
    "id": "module-001",
    "courseId": "course-123456",
    "title": "Introduction to HTML",
    "description": "Learn the basics of HTML5",
    "order": 1,
    "lessonsCount": 0,
    "createdAt": "2024-01-20T10:30:00.000Z"
  }
}
```

---

## Create Lesson

Add a new lesson to a module (Course instructor or Admin only).

### Endpoint
```
POST /courses/modules/:moduleId/lessons
```

### Authentication
**Required**: Bearer Token  
**Authorization**: Course instructor or Admin

### Headers

```
Authorization: Bearer <access-token>
Content-Type: application/json
```

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| moduleId | string | Yes | Module ID |

### Request Body

**Content-Type**: `application/json`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| title | string | Yes | Lesson title |
| content | string | Yes | Lesson content (HTML/Markdown) |
| type | string | Yes | Lesson type | `VIDEO`, `TEXT`, `QUIZ`, `ASSIGNMENT` |
| order | number | Yes | Lesson order in module |
| videoUrl | string | No | Video URL (for VIDEO type) |
| duration | number | No | Duration in minutes |
| resources | string[] | No | Additional resource URLs |

### Example Request

```bash
curl -X POST http://localhost:3000/courses/modules/module-001/lessons \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "title": "HTML Document Structure",
    "content": "# HTML Document Structure\n\nLearn about the basic structure of an HTML document...",
    "type": "TEXT",
    "order": 1,
    "duration": 15,
    "resources": [
      "https://example.com/html-cheatsheet.pdf"
    ]
  }'
```

### Example Response

**Success (201 Created)**

```json
{
  "success": true,
  "message": "Lesson created successfully",
  "data": {
    "id": "lesson-001",
    "moduleId": "module-001",
    "title": "HTML Document Structure",
    "content": "# HTML Document Structure...",
    "type": "TEXT",
    "order": 1,
    "duration": 15,
    "resources": ["https://example.com/html-cheatsheet.pdf"],
    "createdAt": "2024-01-20T11:00:00.000Z"
  }
}
```

---

## Enroll in Course

Enroll in a course (Authenticated users only).

### Endpoint
```
POST /courses/:id/enroll
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
| id | string | Yes | Course ID |

### Example Request

```bash
curl -X POST http://localhost:3000/courses/course-123456/enroll \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Example Response

**Success (200 OK)**

```json
{
  "success": true,
  "message": "Successfully enrolled in course",
  "data": {
    "enrollmentId": "enrollment-789012",
    "courseId": "course-123456",
    "userId": "user-345678",
    "enrolledAt": "2024-01-20T12:00:00.000Z",
    "status": "ACTIVE",
    "progress": 0
  }
}
```

**Error (400 Bad Request)**

```json
{
  "success": false,
  "message": "You are already enrolled in this course",
  "errors": []
}
```

**Error (402 Payment Required)**

For paid courses, payment must be completed first:

```json
{
  "success": false,
  "message": "Payment required for this course",
  "paymentUrl": "/payments/checkout?courseId=course-123456"
}
```

---

## Course Levels

| Level | Description | Target Audience |
|-------|-------------|-----------------|
| `BEGINNER` | Foundational concepts | New learners with no prior experience |
| `INTERMEDIATE` | Building on basics | Learners with basic knowledge |
| `ADVANCED` | Complex topics | Experienced learners |

---

## Course Categories

Common course categories include:
- Web Development
- Data Science
- Mobile Development
- Design
- Business
- Marketing
- Personal Development
- IT & Software

---

## Best Practices

### Course Creation

1. **Write compelling titles** - Clear and descriptive
2. **Provide detailed descriptions** - At least 100 words
3. **Use high-quality thumbnails** - 1280x720 pixels recommended
4. **Add relevant tags** - Improves discoverability
5. **Structure modules logically** - Progressive difficulty
6. **Include diverse content types** - Video, text, quizzes

### Pagination Strategy

**Offset-based pagination** (`GET /courses`):
- Best for traditional page navigation
- Supports jumping to specific pages
- Total count available

**Cursor-based pagination** (`GET /courses/cursor`):
- Best for infinite scroll
- Better performance on large datasets
- Consistent results with frequent updates

### Content Organization

```
Course
├── Module 1
│   ├── Lesson 1.1
│   ├── Lesson 1.2
│   └── Quiz 1
├── Module 2
│   ├── Lesson 2.1
│   ├── Lesson 2.2
│   └── Assignment 2
└── Final Exam
```

---

## Testing

### Test with cURL

```bash
# 1. Create a course
curl -X POST http://localhost:3000/courses \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Course","description":"A test course","category":"Testing","level":"BEGINNER","price":0}'

# 2. Get all courses
curl http://localhost:3000/courses

# 3. Enroll in a course
curl -X POST http://localhost:3000/courses/COURSE_ID/enroll \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Related Documentation

- [Authentication API](../auth/auth-api.md)
- [Payments API](../payments/payments-api.md)
- [Assessments API](../assessments/assessments-api.md)
- [OpenAPI Specification](../../openapi-spec.yaml.md)
- [API Index](../../README.md)
