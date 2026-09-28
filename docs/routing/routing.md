# Routing & API Gateway Architecture

Unified architecture and status reference for request routing within `teachLink_backend`.

## 🛣️ Route Architecture

- **API Prefix**: All public endpoints are mounted under `/api/v1`.
- **Middleware Order**:
  1. Rate Limiter Middleware
  2. Authentication / JWT Validation
  3. Context / Correlation ID Injector
  4. Controller Dispatcher

## 📌 Endpoint Groups

- `/api/v1/auth` — User authentication, token refresh, and password recovery.
- `/api/v1/assignments` — Assignment management and submission workflows.
- `/api/v1/users` — User profile management and role assignments.
