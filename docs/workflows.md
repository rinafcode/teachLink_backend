# Common Workflows

## User Registration & Onboarding

```mermaid
sequenceDiagram
    Client->>API: POST /auth/register
    API->>Database: Create user
    API-->>Client: 201 Created (user data)
    Client->>API: POST /auth/login
    API-->>Client: 200 OK (accessToken, refreshToken)
    Client->>API: GET /users/me (Authorization: Bearer token)
    API-->>Client: 200 OK (profile data)
    Client->>API: PATCH /users/me/preferences
    API-->>Client: 200 OK (preferences updated)
```

### Steps:
1. **Register** — `POST /auth/register` with email, password, and name
2. **Login** — `POST /auth/login` to receive JWT tokens
3. **Get Profile** — `GET /users/me` with the access token
4. **Set Preferences** — `PATCH /users/me/preferences` for locale, timezone, notifications

## Course Creation & Publishing

```mermaid
sequenceDiagram
    Instructor->>API: POST /courses (Create course)
    API-->>Instructor: 201 Created
    Instructor->>API: POST /courses/:id/modules (Add modules)
    API-->>Instructor: 201 Created
    Instructor->>API: POST /courses/:id/modules/:modId/lessons (Add lessons)
    API-->>Instructor: 201 Created
    Instructor->>API: POST /courses/:id/submit-for-review
    API-->>Instructor: 200 OK
    Reviewer->>API: POST /courses/:id/review
    API-->>Reviewer: 200 OK
    Instructor->>API: PATCH /courses/:id (Set status to published)
    API-->>Instructor: 200 OK
```

### Steps:
1. **Create Course** — `POST /courses` with title, description, price
2. **Add Modules** — `POST /courses/:id/modules` for each module
3. **Add Lessons** — `POST /courses/:id/modules/:modId/lessons` for each lesson
4. **Submit for Review** — `POST /courses/:id/submit-for-review`
5. **Review** — Reviewer calls `POST /courses/:id/review`
6. **Publish** — `PATCH /courses/:id` with `status: published`

## Payment Flow

```mermaid
sequenceDiagram
    Student->>API: POST /payments/intent
    API-->>Student: 200 OK (clientSecret)
    Student->>Stripe: Confirm payment
    Stripe-->>Student: Success
    Student->>API: POST /payments/confirm (paymentIntentId)
    API-->>Student: 200 OK (receipt)
    Student->>API: GET /enrollments (verify enrollment)
    API-->>Student: 200 OK
```

### Steps:
1. **Create Payment Intent** — `POST /payments/intent` with courseId, amount, currency
2. **Confirm on Client** — Use Stripe.js to confirm the payment
3. **Confirm on Server** — `POST /payments/confirm` with the payment intent ID
4. **Verify Enrollment** — `GET /enrollments` to confirm access

## Search & Discovery

```mermaid
sequenceDiagram
    User->>API: GET /search?q=javascript&page=1&limit=20
    API->>Elasticsearch: Forward search query
    Elasticsearch-->>API: Results
    API-->>User: 200 OK (results + pagination)
    User->>API: GET /courses/:id
    API-->>User: 200 OK (course details)
    User->>API: POST /courses/:id/enroll
    API-->>User: 201 Created
```

### Steps:
1. **Search** — `GET /search?q=<term>` for full-text search
2. **Filter** — Add `?category=`, `?price[gte]=`, `?sort=` for refinement
3. **View Course** — `GET /courses/:id` for details
4. **Enroll** — `POST /courses/:id/enroll`

## Real-Time Collaboration

```mermaid
sequenceDiagram
    User->>WebSocket: Connect with JWT
    WebSocket-->>User: Connected
    User->>WebSocket: Join session { sessionId, userId, resourceType }
    WebSocket-->>User: Join acknowledged
    User->>WebSocket: Operation { type: 'edit', data: ... }
    WebSocket-->>OtherUsers: Broadcast operation
    User->>API: POST /collaboration/sessions (save snapshot)
    API-->>User: 201 Created
```

### Steps:
1. **Connect** — Open WebSocket connection with JWT in query params
2. **Join** — Send `JoinSession` message to start collaborating
3. **Operate** — Send `CollaborativeOperation` messages in real-time
4. **Save** — Periodically save to REST API via `POST /collaboration/sessions`

## Moderation Queue

```mermaid
sequenceDiagram
    User->>API: POST /moderation/reports (Report content)
    API-->>User: 201 Created
    Moderator->>API: GET /moderation/queue (View reports)
    API-->>Moderator: 200 OK (pending reports)
    Moderator->>API: PATCH /moderation/reports/:id/action
    API-->>Moderator: 200 OK
    API->>User: (Optional) Notification of resolution
```

### Steps:
1. **Report Content** — `POST /moderation/reports` with resource type, ID, and reason
2. **Review Queue** — `GET /moderation/queue` for pending reports (moderator role)
3. **Take Action** — `PATCH /moderation/reports/:id/action` to resolve
