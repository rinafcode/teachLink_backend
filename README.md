# 🧠 TeachLink Backend

[![CI](https://github.com/teachlink/backend/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/teachlink/backend/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/badge/coverage-70%25%20threshold-brightgreen)](#-ci--testing)
[![Branch Protection](https://img.shields.io/badge/branch%20protection-enabled-blue)](#-branch-protection)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen)](CONTRIBUTING.md)

> **Replace** `teachlink/backend` in the badge URLs above with your actual `org/repo` slug once the repository is on GitHub.

**TeachLink** is a decentralized platform built to enable technocrats to **share, analyze, and monetize knowledge, skills, and ideas**. This repository contains the **backend API** built with **NestJS**, **TypeORM**, and powered by **Starknet** and **PostgreSQL**, serving as the core of the TeachLink ecosystem.

This is the **NestJS** backend powering TeachLink — offering APIs, authentication, user management, notifications, and knowledge monetization features.

---

## 🔁 CI / Testing

Every pull request and every push to `main` / `develop` runs an automated pipeline defined in [`.github/workflows/ci.yml`](.github/workflows/ci.yml).

### Pipeline stages

| Stage          | Tool             | Fails on                                  |
| -------------- | ---------------- | ----------------------------------------- |
| **Install**    | `npm ci`         | Dependency resolution error               |
| **Lint**       | ESLint           | Any warning or error (`--max-warnings 0`) |
| **Format**     | Prettier         | Any file that would be reformatted        |
| **Type Check** | `tsc --noEmit`   | Any TypeScript error                      |
| **Build**      | NestJS CLI       | Compilation failure                       |
| **Unit Tests** | Jest + ts-jest   | Test failure or coverage below 70 %       |
| **E2E Tests**  | Jest + Supertest | Test failure (uses real Postgres + Redis) |

### Running checks locally

```bash
# Lint (auto-fix)
npm run lint

# Lint (CI-strict, no auto-fix)
npm run lint:ci

# Format check (no rewrite)
npm run format:check

# TypeScript type check only
npm run typecheck

# Unit tests with coverage report
npm run test:ci

# E2E tests (requires Postgres + Redis running locally)
npm run test:e2e
```

### Coverage thresholds

Configured in `jest.config.js`. The pipeline fails if **any** global metric falls below:

| Metric     | Threshold |
| ---------- | --------- |
| Statements | 70 %      |
| Branches   | 70 %      |
| Functions  | 70 %      |
| Lines      | 70 %      |

Coverage HTML report is uploaded as a GitHub Actions artifact (`coverage-report`) on every run.

---

## 🔒 Branch Protection

Both `main` and `develop` are protected. Direct pushes are disabled for **everyone including admins**.

| Rule                                | `main`                   | `develop`   |
| ----------------------------------- | ------------------------ | ----------- |
| Required PR approvals               | **2** (incl. code owner) | **1**       |
| Dismiss stale reviews on new commit | ✅                       | ✅          |
| Required status check               | `CI Passed`              | `CI Passed` |
| Branch must be up to date           | ✅                       | ✅          |
| All conversations resolved          | ✅                       | ✅          |
| Squash merge only                   | ✅                       | ✅          |
| Force push                          | ❌                       | ❌          |
| Branch deletion                     | ❌                       | ❌          |

Rules are defined in code in [`.github/workflows/branch-protection.yml`](.github/workflows/branch-protection.yml) and can be re-applied to any new repository by running the **Bootstrap Branch Protection** workflow manually from the Actions tab.

For the full contribution and review policy, see [CONTRIBUTING.md](CONTRIBUTING.md).

---

## 📁 Project Structure

```
src/
├── modules/
│   ├── auth/                 # JWT, session management, wallet login
│   ├── users/                # Profile management, roles, preferences
│   ├── courses/              # Course creation, enrollment, content
│   ├── payments/             # Stripe integration, transactions
│   ├── search/               # Elasticsearch integration, search APIs
│   ├── notifications/        # Real-time alerts, email, push notifications
│   ├── messaging/            # Real-time chat, discussions
│   ├── media/                # File upload, processing, CDN
│   ├── collaboration/        # Real-time collaboration features
│   ├── assessment/           # Quizzes, tests, grading
│   ├── learning-paths/       # Personalized learning journeys
│   ├── gamification/         # Points, badges, leaderboards
│   ├── moderation/           # Content moderation, reporting
│   ├── email-marketing/      # Campaign management, templates
│   ├── ab-testing/           # Feature experimentation
│   ├── data-warehouse/       # Analytics, reporting
│   ├── backup/               # Data backup and recovery
│   ├── sync/                 # Data synchronization
│   ├── tenancy/              # Multi-tenant support
│   ├── security/             # Security utilities, monitoring
│   ├── caching/              # Redis caching strategies
│   ├── rate-limiting/        # API rate limiting
│   ├── observability/        # Metrics, logging, tracing
│   ├── queue/                # Background job processing
│   └── health/               # Health checks, monitoring
├── common/
│   ├── database/             # Database configuration, connection
│   ├── decorators/           # Custom decorators
│   ├── guards/               # Authentication & authorization guards
│   ├── interceptors/         # Request/response interceptors
│   ├── pipes/                # Data validation pipes
│   ├── dto/                  # Data transfer objects
│   └── utils/                # Utility functions
├── config/                   # Environment configuration
├── graphql/                  # GraphQL schemas and resolvers
└── main.ts                   # Application entry point
```

## 🔧 Project Overview

TeachLink Backend provides secure and scalable APIs to power features such as:

- 🧾 Post creation, editing, and markdown parsing
- 🧠 Topic discovery and categorization
- 👥 User account management with wallet login
- 💸 On-chain tipping and transaction logging
- 🎖️ Gamified reputation and contribution tracking
- 🔔 Real-time notifications via WebSockets
- 📊 Analytics and activity insights
- 🧾 DAO integration for content moderation and governance

## 🔀 API Versioning

TeachLink uses a header-based API versioning strategy for application endpoints.

- Send `X-API-Version: 1` with every versioned API request.
- Supported versions are configured through `API_SUPPORTED_VERSIONS` and default to `1`.
- `API_DEFAULT_VERSION` controls the currently active route version and defaults to `1`.
- Health checks, metrics endpoints, the root route, and payment webhooks are version-neutral.
- Requests with a missing or invalid API version header return a client error before the request reaches the controller.

Example:

```bash
curl -H "X-API-Version: 1" http://localhost:3000/users
```

## 📊 Architecture

## ⚙️ Tech Stack

| Layer         | Technology                 |
| ------------- | -------------------------- |
| Framework     | NestJS                     |
| Database      | PostgreSQL + TypeORM       |
| Blockchain    | Starknet + Starknet.js     |
| Realtime      | WebSockets (Gateway)       |
| Queues/Async  | BullMQ + Redis (optional)  |
| File Uploads  | Cloudinary                 |
| Config Mgmt   | @nestjs/config             |
| Testing       | Jest + Supertest           |
| Auth          | JWT + Wallet Sign-In       |
| Deployment    | Docker, Railway, or Fly.io |
| File Upload   | Cloudinary                 |
| Security      | Helmet + bcrypt            | Security headers and password hashing |
### System Overview

TeachLink Backend follows a **modular microservices architecture** built on NestJS, designed for scalability and maintainability. The system uses a layered approach with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                    API Gateway Layer                        │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐ │
│  │   REST API  │ │   GraphQL   │ │    WebSocket Gateway    │ │
│  └─────────────┘ └─────────────┘ └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────┐
│                  Business Logic Layer                        │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐ │
│  │    Auth     │ │   Users     │ │      Courses            │ │
│  │   Module    │ │   Module    │ │      Module             │ │
│  └─────────────┘ └─────────────┘ └─────────────────────────┘ │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐ │
│  │  Payments   │ │   Search    │ │     Notifications       │ │
│  │   Module    │ │   Module    │ │      Module             │ │
│  └─────────────┘ └─────────────┘ └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────┐
│                   Infrastructure Layer                       │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐ │
│  │ PostgreSQL  │ │    Redis    │ │      File Storage       │ │
│  │ (Primary)   │ │  (Caching)  │ │     (AWS S3)            │ │
│  └─────────────┘ └─────────────┘ └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Key Architectural Patterns

- **Modular Design**: Each business domain is encapsulated in its own module
- **Dependency Injection**: Leverages NestJS DI for loose coupling
- **Repository Pattern**: Data access abstraction via TypeORM
- **Event-Driven Architecture**: Uses EventEmitter for inter-module communication
- **CQRS Pattern**: Separation of read/write operations in complex modules
- **Feature Flags**: Dynamic module loading based on configuration

### Data Flow

1. **Request Processing**: API Gateway → Authentication → Authorization → Business Logic
2. **Data Persistence**: Business Logic → Repository → PostgreSQL
3. **Caching Strategy**: Redis for frequently accessed data and session management
4. **Async Operations**: BullMQ for background jobs and email processing
5. **File Handling**: AWS S3/Cloudinary for media storage with CDN distribution

## 📦 Tech Stack

| Layer              | Technology                          | Purpose                               |
| ------------------ | ----------------------------------- | ------------------------------------- |
| **Framework**      | NestJS                              | Node.js application framework         |
| **Language**       | TypeScript                          | Type-safe JavaScript                  |
| **Database**       | PostgreSQL + TypeORM                | Primary data storage                  |
| **Caching**        | Redis + IORedis                     | Session store, caching, queues        |
| **Authentication** | JWT + Passport                      | Token-based authentication            |
| **GraphQL**        | Apollo Server                       | GraphQL API (optional)                |
| **Real-time**      | Socket.io                           | WebSocket connections                 |
| **File Storage**   | AWS S3 + Cloudinary                 | Media file storage and CDN            |
| **Email**          | SendGrid + Nodemailer               | Email delivery and marketing          |
| **Payments**       | Stripe                              | Payment processing                    |
| **Search**         | Elasticsearch                       | Full-text search capabilities         |
| **Queue**          | BullMQ                              | Background job processing             |
| **Monitoring**     | OpenTelemetry + Prometheus          | Metrics and observability             |
| **Testing**        | Jest + Supertest                    | Unit and integration tests            |
| **Documentation**  | Swagger                             | API documentation                     |
| **Validation**     | class-validator + class-transformer | DTO validation                        |
| **Security**       | Helmet + bcrypt                     | Security headers and password hashing |

## 🔐 Security

### Password Hashing Configuration

The application uses **bcrypt** for password hashing with configurable rounds via the `BCRYPT_ROUNDS` environment variable.

#### Recommended Bcrypt Rounds by Environment

| Environment | Recommended Rounds | Hash Time (ms) | Security Level | Performance Impact |
| ----------- | ----------------- | -------------- | -------------- | ------------------ |
| **Development** | 8-10 | 50-100 | Good | Low |
| **Staging** | 10-12 | 100-300 | High | Medium |
| **Production** | 12-14 | 300-1000 | Very High | High |

#### Security vs Performance Tradeoffs

**Lower Rounds (4-8):**
- ✅ Faster authentication
- ✅ Lower CPU usage
- ⚠️ Reduced security against brute force attacks
- ⚠️ May be vulnerable to GPU-based cracking

**Higher Rounds (12-15):**
- ✅ Strong resistance against brute force attacks
- ✅ Future-proof against computational advances
- ❌ Slower authentication (may impact user experience)
- ❌ Higher CPU usage (may affect scalability)

#### Configuration Example

```env
# Development (faster, less secure)
BCRYPT_ROUNDS=8

# Production (slower, more secure)
BCRYPT_ROUNDS=12
```

#### Security Best Practices

1. **Minimum 10 rounds** for production environments
2. **Monitor authentication performance** when increasing rounds
3. **Consider rate limiting** to prevent brute force attacks
4. **Use hardware security modules** for high-security applications
5. **Regular security audits** to assess adequate protection levels

#### Migration Considerations

When changing `BCRYPT_ROUNDS`:
- Existing passwords remain valid until users change them
- New passwords will use the configured rounds
- Consider forcing password reset for sensitive accounts
- Gradually increase rounds to monitor performance impact

## 🗄️ Database

### Index Strategy

The application uses strategic database indexes to optimize query performance, especially for frequently accessed data and pagination operations.

#### Single Column Indexes

- **User.email**: Unique index for authentication lookups
- **User.username**: Index for profile searches
- **User.tenantId**: Index for multi-tenant queries
- **Payment.status**: Index for payment status filtering
- **Payment.userId**: Index for user payment history
- **Payment.courseId**: Index for course revenue queries
- **Subscription.status**: Index for active subscription queries
- **Subscription.userId**: Index for user subscription management
- **Course.status**: Index for published course listings
- **Course.instructorId**: Index for instructor course queries
- **Enrollment.userId**: Index for user enrollment history
- **Enrollment.courseId**: Index for course enrollment counts
- **Enrollment.status**: Index for active enrollment filtering
- **CourseModule.courseId**: Index for course module queries
- **Lesson.moduleId**: Index for module lesson queries

#### Composite Indexes

- **Enrollment (userId, status)**: Optimized for user enrollment status queries
- **Enrollment (courseId, status)**: Optimized for course enrollment analytics
- **Payment (userId, status)**: Optimized for user payment status filtering
- **Subscription (userId, status)**: Optimized for user subscription status queries

#### Performance Considerations

- Indexes are added to foreign key columns to improve JOIN performance
- Composite indexes support common query patterns (e.g., filtering by user + status)
- Partial indexes are used where applicable for better selectivity
- Index maintenance overhead is monitored to ensure write performance is not negatively impacted

### Connection Pooling (TypeORM + PostgreSQL)

The backend supports explicit database pool tuning through environment variables:

- `DATABASE_POOL_MAX` (default: `30`)
- `DATABASE_POOL_MIN` (default: `5`)
- `DATABASE_POOL_ACQUIRE_TIMEOUT_MS` (default: `10000`)
- `DATABASE_POOL_IDLE_TIMEOUT_MS` (default: `30000`)

Recommended starting points:

| Environment | `DATABASE_POOL_MAX` | `DATABASE_POOL_MIN` | Acquire Timeout | Idle Timeout |
| ----------- | ------------------- | ------------------- | --------------- | ------------ |
| Development | 10                  | 2                   | 5000 ms         | 10000 ms     |
| Staging     | 20                  | 5                   | 10000 ms        | 30000 ms     |
| Production  | 30 to 60            | 5 to 10             | 10000 ms        | 30000 ms     |

Sizing rule:

- Keep total active connections across workers below PostgreSQL capacity.
- Formula: `DATABASE_POOL_MAX x app_instances x cluster_workers <= postgres_max_connections - reserved_connections`.
- Reserve at least 20 to 30 connections for migrations, admin access, and background jobs.

## �🚀 Getting Started

### Prerequisites

- **Node.js** 18+ with npm
- **PostgreSQL** 14+ (or Docker)
- **Redis** 6+ (for caching and queues)
- **Git** for version control

### Quick Start

1. **Clone the repository**

```bash
git clone https://github.com/teachlink/backend.git
cd teachlink_backend
```

2. **Install dependencies**

```bash
npm install
```

3. **Set up environment variables**

```bash
cp .env.example .env
# Edit .env with your configuration
```

4. **Start PostgreSQL and Redis**

```bash
# Using Docker (recommended)
docker-compose up -d postgres redis

# Or install locally and start services
# PostgreSQL: sudo systemctl start postgresql
# Redis: sudo systemctl start redis
```

5. **Run database migrations**

```bash
npm run typeorm migration:run
```

6. **Start the development server**

```bash
npm run start:dev
```

7. **Access the API**

- **REST API**: http://localhost:3000
- **API Documentation**: http://localhost:3000/api
- **Health Check**: http://localhost:3000/health

### Environment Configuration

Key environment variables to configure:

```env
# Database
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=yourpassword
DATABASE_NAME=teachlink

# Authentication
JWT_SECRET=your-super-secret-jwt-key
ENCRYPTION_SECRET=your-32-char-encryption-key

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# External Services (Optional)
STRIPE_SECRET_KEY=your_stripe_key
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
```

### Docker Setup

For complete development environment with Docker:

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## 🤝 Contributing

We welcome contributions from the community! Please follow our guidelines to ensure a smooth contribution process.

### Development Workflow

1. **Fork the repository** and clone locally
2. **Set up your environment** using `.env.example`
3. **Create a feature branch** from `develop`
4. **Make your changes** following our coding standards
5. **Run tests locally** to ensure everything works
6. **Submit a pull request** with a clear description

### Code Standards

- Use **conventional commits** (feat:, fix:, docs:, etc.)
- Follow **TypeScript** best practices
- Write **unit tests** for new features
- Update **documentation** as needed
- Ensure **linting** and **formatting** pass

### Pull Request Requirements

- [ ] Linked issue (`Closes #issue_number`)
- [ ] Clear title and description
- [ ] Tests pass locally (`npm run test:ci`)
- [ ] Code follows style guidelines (`npm run lint:ci`)
- [ ] Documentation updated if applicable

### Getting Help

- 📖 [Documentation](./docs/)
- 💬 [Telegram Community](https://t.me/teachlinkOD)
- 🐛 [Report Issues](https://github.com/teachlink/backend/issues)

---

## 📄 License

MIT © 2025 TeachLink DAO
