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
│   ├── auth/             # JWT, Google OAuth, Refresh tokens
│   ├── users/            # Profile, roles, preferences
│   ├── knowledge/        # Courses, content, categories
│   ├── consulting/       # 1:1 sessions, scheduling, payments
│   ├── messaging/        # Real-time chat, discussions
│   ├── notifications/    # In-app/email alerts
│   ├── analytics/        # Insights, course tracking
│   ├── web3/             # Wallet connection, token gating
│   └── file-upload/      # Cloudinary upload, avatar, files
├── config/              # TypeORM, validation, ENV configs
├── common/              # DTOs, guards, interceptors, pipes
└── main.ts              # Entry point
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

The backend now supports explicit database pool tuning through environment variables:

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

Load testing checklist:

```bash
# 1) Start API
npm run start:dev

# 2) In another terminal, run concurrent load against a DB-backed endpoint
npx autocannon -c 100 -d 60 http://localhost:3000/health

# 3) Observe active connections in PostgreSQL (replace DB name)
psql -d teachlink -c "select count(*) as active_connections from pg_stat_activity where datname='teachlink';"
```

Expected result: no connection-acquire timeouts, stable latency under sustained concurrency, and active connections staying within configured pool bounds.

## �🚀 Deployment

### Prerequisites

- Node.js 18+
- PostgreSQL
- Redis
- Docker (optional)

### Steps

1. Set up `.env`
2. Run `npm i`
3. Start: `npm run start:dev` or Docker Compose
4. Swagger: `http://localhost:3000/api`

## 🤝 Contribution

# 🤝 Contributing to TeachLink

## 🛠 Development Workflow

1. Fork the repo and clone locally.
2. Set up your environment using `.env.example`
3. Use conventional commits.
4. Run tests locally before PR.
5. Open a PR with title like: `✨ Add: Tutor Booking API`

## 🧪 PR Must Include:

- [ ] Linked issue (`Closes #issue_number`)
- [ ] Clear title and description
- [ ] Screenshots (if UI)
- [ ] Tests (if backend)

## 📬 Join the Community

- [Telegram](t.me/teachlinkOD)

## 📁 Folder Structure

/src
/auth → Wallet-based login, JWT, refresh tokens
/posts → CRUD for markdown posts
/topics → Topic entities and filtering
/users → Profiles, roles, reputation
/tipping → On-chain tipping integrations
/notifications → Real-time alerts (email, WebSocket)
/analytics → Activity tracking & metrics
/dao → Governance logic for post moderation
/common → DTOs, decorators, interceptors, guards

yaml
Copy
Edit

---

## 🛠 Setup Instructions

1. **Clone the repository**

```bash
git clone https://github.com/teachlink/backend.git
cd backend
Install dependencies

bash
Copy
Edit
npm install
Create .env file

env
Copy
Edit
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=yourpassword
DB_NAME=teachlink

JWT_SECRET=your_jwt_secret
ENCRYPTION_SECRET=your_32_char_encryption_secret
JWT_EXPIRATION=3600

CLOUDINARY_API_KEY=your_key
CLOUDINARY_API_SECRET=your_secret
CLOUDINARY_CLOUD_NAME=your_name
Run PostgreSQL locally or connect to remote DB

Start the development server

bash
Copy
Edit
npm run start:dev
Database Migration (if applicable)

bash
Copy
Edit
npm run typeorm migration:run
📌 Key Development Milestones
✅ PostgreSQL + TypeORM setup

✅ JWT-based auth with Starknet wallet login

✅ Post CRUD with markdown support

✅ Topic categorization + filtering

✅ Tipping logic integration

✅ Real-time notifications setup

🚧 Governance API for moderation

🚧 Contribution analytics and scoring

🔐 API Modules
Module	Description
Auth Module	Wallet login, JWT, refresh tokens
Post Module	Markdown post management
User Module	Profile management and reputation
Topic Module	Knowledge categories & filtering
Tip Module	Send/receive tips on-chain
Notif Module	In-app + external notifications
DAO Module	Voting and governance decisions
File Module	Upload and serve media via Cloudinary

✅ Contribution Guidelines
Fork the repo and create a feature branch

All PRs must link to a GitHub Issue (Close #5)

Follow NestJS best practices and clean code principles

Include unit tests for services/controllers

Join our Telegram Group for support

🧪 Testing
Run unit and integration tests:

bash
Copy
Edit
npm run test
📜 License
MIT © 2025 TeachLink DAO
```
