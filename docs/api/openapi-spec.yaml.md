# TeachLink OpenAPI Specification

This document contains the complete OpenAPI 3.0 specification for the TeachLink API.

## OpenAPI Specification (YAML)

```yaml
openapi: 3.0.0
info:
  title: TeachLink API
  description: |
    TeachLink is a decentralized knowledge marketplace enabling educators and learners to connect through blockchain technology.
    
    ## Features
    - User authentication and authorization
    - Course management
    - Payment processing
    - Assessment and feedback
    - Real-time collaboration
    - Multi-tenancy support
    - Analytics and reporting
    
    ## Authentication
    All protected endpoints require a JWT Bearer token in the Authorization header:
    ```
    Authorization: Bearer <your-jwt-token>
    ```
    
    Obtain tokens via the `/auth/login` endpoint.
  version: 1.0.0
  contact:
    name: TeachLink Support
    email: support@teachlink.com
    url: https://teachlink.com/support
  license:
    name: MIT
    url: https://opensource.org/licenses/MIT

servers:
  - url: http://localhost:3000
    description: Local Development
  - url: https://api.teachlink.com
    description: Production
  - url: https://staging.api.teachlink.com
    description: Staging

tags:
  - name: Auth
    description: Authentication and authorization endpoints
  - name: Users
    description: User management and profile endpoints
  - name: Courses
    description: Course creation, management, and enrollment
  - name: Payments
    description: Payment processing and subscription management
  - name: Assessments
    description: Quiz and assessment management
  - name: Notifications
    description: User notification system
  - name: Search
    description: Search and discovery endpoints
  - name: Analytics
    description: Analytics and reporting

paths:
  /auth/register:
    post:
      tags:
        - Auth
      summary: Register a new user
      description: Create a new user account with email and password
      operationId: registerUser
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/RegisterDto'
            example:
              email: "john.doe@example.com"
              password: "StrongPass123!"
              firstName: "John"
              lastName: "Doe"
              role: "STUDENT"
      responses:
        '201':
          description: User successfully registered
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/AuthResponse'
              example:
                success: true
                message: "User registered successfully"
                data:
                  userId: "uuid-string"
                  email: "john.doe@example.com"
                  verificationEmailSent: true
        '400':
          description: Bad request - Validation error
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
              example:
                success: false
                message: "Validation failed"
                errors:
                  - field: "email"
                    message: "Must be a valid email address"
                  - field: "password"
                    message: "Password must be stronger"
        '409':
          description: Conflict - Email already exists
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
              example:
                success: false
                message: "Email already registered"

  /auth/login:
    post:
      tags:
        - Auth
      summary: Login user
      description: Authenticate user and receive access/refresh tokens
      operationId: loginUser
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/LoginDto'
            example:
              email: "john.doe@example.com"
              password: "StrongPass123!"
      responses:
        '200':
          description: Login successful
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/LoginResponse'
              example:
                success: true
                message: "Login successful"
                data:
                  accessToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  refreshToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  expiresIn: 3600
                  user:
                    id: "uuid-string"
                    email: "john.doe@example.com"
                    firstName: "John"
                    lastName: "Doe"
                    role: "STUDENT"
        '401':
          description: Unauthorized - Invalid credentials
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
              example:
                success: false
                message: "Invalid email or password"

  /auth/refresh:
    post:
      tags:
        - Auth
      summary: Refresh access token
      description: Use refresh token to obtain a new access token
      operationId: refreshToken
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/RefreshTokenDto'
      responses:
        '200':
          description: Token refreshed successfully
        '401':
          description: Unauthorized - Invalid or expired refresh token

  /auth/logout:
    post:
      tags:
        - Auth
      summary: Logout user
      description: Invalidate the current session and refresh token
      operationId: logoutUser
      security:
        - bearerAuth: []
      responses:
        '200':
          description: Logout successful
        '401':
          description: Unauthorized

  /auth/forgot-password:
    post:
      tags:
        - Auth
      summary: Request password reset
      description: Send password reset email to user
      operationId: forgotPassword
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ForgotPasswordDto'
      responses:
        '200':
          description: Password reset email sent
        '404':
          description: User not found

  /auth/reset-password:
    post:
      tags:
        - Auth
      summary: Reset password
      description: Reset password using token from email
      operationId: resetPassword
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ResetPasswordDto'
      responses:
        '200':
          description: Password reset successful
        '400':
          description: Invalid or expired token

  /auth/change-password:
    post:
      tags:
        - Auth
      summary: Change password
      description: Change password for authenticated user
      operationId: changePassword
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ChangePasswordDto'
      responses:
        '200':
          description: Password changed successfully
        '401':
          description: Unauthorized

  /auth/verify-email:
    post:
      tags:
        - Auth
      summary: Verify email
      description: Verify user email address using token
      operationId: verifyEmail
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/VerifyEmailDto'
      responses:
        '200':
          description: Email verified successfully
        '400':
          description: Invalid or expired token

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
      description: Enter your JWT access token

  schemas:
    RegisterDto:
      type: object
      required:
        - email
        - password
        - firstName
        - lastName
      properties:
        email:
          type: string
          format: email
          example: "john.doe@example.com"
        password:
          type: string
          format: password
          minLength: 8
          example: "StrongPass123!"
          description: Must contain uppercase, lowercase, number, and special character
        firstName:
          type: string
          minLength: 1
          maxLength: 50
          example: "John"
        lastName:
          type: string
          minLength: 1
          maxLength: 50
          example: "Doe"
        role:
          type: string
          enum: [STUDENT, INSTRUCTOR, ADMIN]
          default: STUDENT
          example: "STUDENT"

    LoginDto:
      type: object
      required:
        - email
        - password
      properties:
        email:
          type: string
          format: email
          example: "john.doe@example.com"
        password:
          type: string
          format: password
          example: "StrongPass123!"

    RefreshTokenDto:
      type: object
      required:
        - refreshToken
      properties:
        refreshToken:
          type: string
          example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

    ForgotPasswordDto:
      type: object
      required:
        - email
      properties:
        email:
          type: string
          format: email
          example: "john.doe@example.com"

    ResetPasswordDto:
      type: object
      required:
        - token
        - newPassword
      properties:
        token:
          type: string
          example: "reset-token-from-email"
        newPassword:
          type: string
          format: password
          minLength: 8
          example: "NewStrongPass123!"

    ChangePasswordDto:
      type: object
      required:
        - currentPassword
        - newPassword
      properties:
        currentPassword:
          type: string
          format: password
          example: "OldPass123!"
        newPassword:
          type: string
          format: password
          minLength: 8
          example: "NewPass123!"

    VerifyEmailDto:
      type: object
      required:
        - token
      properties:
        token:
          type: string
          example: "email-verification-token"

    AuthResponse:
      type: object
      properties:
        success:
          type: boolean
          example: true
        message:
          type: string
          example: "User registered successfully"
        data:
          type: object
          properties:
            userId:
              type: string
              format: uuid
            email:
              type: string
            verificationEmailSent:
              type: boolean

    LoginResponse:
      type: object
      properties:
        success:
          type: boolean
          example: true
        message:
          type: string
          example: "Login successful"
        data:
          type: object
          properties:
            accessToken:
              type: string
            refreshToken:
              type: string
            expiresIn:
              type: integer
              description: Token expiration time in seconds
            user:
              $ref: '#/components/schemas/User'

    User:
      type: object
      properties:
        id:
          type: string
          format: uuid
        email:
          type: string
        firstName:
          type: string
        lastName:
          type: string
        role:
          type: string
          enum: [STUDENT, INSTRUCTOR, ADMIN]

    ErrorResponse:
      type: object
      properties:
        success:
          type: boolean
          example: false
        message:
          type: string
          example: "Validation failed"
        errors:
          type: array
          items:
            type: object
            properties:
              field:
                type: string
              message:
                type: string
```

## Interactive Documentation

Access the interactive Swagger UI at:
- **Local**: http://localhost:3000/api/docs
- **Production**: https://api.teachlink.com/api/docs

The interactive documentation provides:
- Try-it-out functionality for all endpoints
- Request/response schemas
- Authentication management
- Real API testing capabilities

## API Versioning

Current API version: **v1.0.0**

All API endpoints are versioned. The version is included in the base URL:
```
https://api.teachlink.com/v1/{endpoint}
```

## Rate Limiting

API endpoints have rate limits applied:
- **Authentication endpoints**: 10 requests per minute
- **General endpoints**: 100 requests per minute
- **Search endpoints**: 60 requests per minute

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1609459200
```

## Error Handling

All errors follow a consistent format:

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

### HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request (Validation errors)
- `401` - Unauthorized (Invalid/missing authentication)
- `403` - Forbidden (Insufficient permissions)
- `404` - Not Found
- `409` - Conflict (Resource already exists)
- `429` - Too Many Requests (Rate limit exceeded)
- `500` - Internal Server Error
