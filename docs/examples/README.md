# API Examples

This directory contains example code for calling TeachLink API endpoints in multiple programming languages.

## Table of Contents

- [Login](#login)
- [Register](#register)
- [List Courses](#listCourses)
- [Create Course](#createCourse)
- [Search Courses](#searchCourses)
- [Create Payment Intent](#createPaymentIntent)

## Languages Supported

- **cURL** - Command line HTTP requests
- **TypeScript/Node.js** - Modern async/await pattern
- **Python** - Native HTTP requests library
- **JavaScript** - Fetch API (browser & Node.js 18+)
- **Go** - Native net/http package
- **Java** - HttpURLConnection
- **C#** - HttpClient

---


## Login

**POST** /auth/login

Authenticate user and get access token

**Requires Authentication:** No

### cURL

```bash
curl -X POST "http://localhost:3000/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"learner@example.com","password":"Password123!"}'
```

### Response

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "refresh_01JZ0D4R8R2Y3R9H2W6E5R4T1P",
    "user": {
      "id": "2f4d8b5f-91d2-43a1-bd1e-877b4f97d7b9",
      "email": "learner@example.com",
      "firstName": "Ada",
      "lastName": "Lovelace",
      "role": "student",
      "status": "active"
    }
  }
}
```


## Register

**POST** /auth/register

Create a new user account

**Requires Authentication:** No

### cURL

```bash
curl -X POST "http://localhost:3000/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"newuser@example.com","password":"SecurePass123!","firstName":"Grace","lastName":"Hopper","role":"student"}'
```

### Response

```json
{
  "success": true,
  "message": "Registration successful",
  "data": {
    "id": "2f4d8b5f-91d2-43a1-bd1e-877b4f97d7b9",
    "email": "learner@example.com",
    "firstName": "Ada",
    "lastName": "Lovelace",
    "role": "student",
    "status": "active"
  }
}
```


## List Courses

**GET** /courses?page=1&limit=20

Retrieve paginated list of courses

**Requires Authentication:** No

### cURL

```bash
curl -X GET "http://localhost:3000/courses?page=1&limit=20" \
  -H "Content-Type: application/json"
```

### Response

```json
{
  "success": true,
  "message": "Courses found",
  "data": [
    {
      "id": "8e4fd4f8-d8f3-46b5-8786-6f7167a654f4",
      "title": "JavaScript Foundations",
      "description": "Learn modern JavaScript from first principles.",
      "category": "programming",
      "level": "beginner",
      "price": 3999,
      "status": "published"
    }
  ]
}
```


## Create Course

**POST** /courses

Create a new course

**Requires Authentication:** Yes

### cURL

```bash
curl -X POST "http://localhost:3000/courses" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{"title":"Advanced TypeScript","description":"Master TypeScript type system and advanced patterns.","category":"programming","level":"advanced","price":5999}'
```

### Response

```json
{
  "success": true,
  "message": "Course created",
  "data": {
    "id": "8e4fd4f8-d8f3-46b5-8786-6f7167a654f4",
    "title": "Advanced TypeScript",
    "description": "Learn modern JavaScript from first principles.",
    "category": "programming",
    "level": "beginner",
    "price": 5999,
    "status": "published"
  }
}
```


## Search Courses

**GET** /search?q=javascript&filters={"category":"programming","level":"beginner"}

Search and filter courses

**Requires Authentication:** No

### cURL

```bash
curl -X GET "http://localhost:3000/search?q=javascript&filters={"category":"programming","level":"beginner"}" \
  -H "Content-Type: application/json"
```

### Response

```json
{
  "results": [
    {
      "id": "8e4fd4f8-d8f3-46b5-8786-6f7167a654f4",
      "title": "JavaScript Foundations",
      "description": "Learn modern JavaScript from first principles.",
      "category": "programming",
      "level": "beginner",
      "price": 3999,
      "status": "published"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20,
  "filters": {
    "category": "programming",
    "level": "beginner"
  },
  "query": "javascript"
}
```


## Create Payment Intent

**POST** /payments/create-intent

Create a payment intent for course purchase

**Requires Authentication:** Yes

### cURL

```bash
curl -X POST "http://localhost:3000/payments/create-intent" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "X-Idempotency-Key: payment-8e4fd4f8-d8f3-46b5" \
  -d '{"courseId":"8e4fd4f8-d8f3-46b5-8786-6f7167a654f4","amount":3999,"currency":"USD"}'
```

### Response

```json
{
  "success": true,
  "message": "Payment intent created",
  "data": {
    "id": "pay_01JZ0D4R8R2Y3R9H2W6E5R4T1P",
    "amount": 3999,
    "currency": "USD",
    "status": "pending",
    "providerClientSecret": "pi_123_secret_456"
  }
}
```

