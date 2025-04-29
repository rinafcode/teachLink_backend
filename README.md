# TeachLink Backend

Teachlink is a decentralized learning and knowledge-sharing platform built for creators, learners, consultants, and Web3 enthusiasts.

This repository contains the core backend logic using **NestJS**, **TypeORM**, and **modular architecture**, supporting scalable features like real-time messaging, tokenized knowledge, consulting, analytics, and wallet-based authentication.

---

## 🧑‍💻 Tech Stack

- **NestJS** (modular backend framework)
- **TypeORM** with MongoDB/PostgreSQL
- **Cloudinary** for file uploads
- **WebSockets** for real-time messaging
- **Bull + Redis** for notifications/queue jobs
- **Web3.js** or **ethers.js** for blockchain integration
- 
 Project Structure
src/ ├── auth/ ├── users/ ├── knowledge/ ├── notifications/ ├── messaging/ ├── file-upload/ └── common/

bash
Copy
Edit

## 🧪 Running Locally

```bash
git clone https://github.com/your-org/teachlink-backend.git
cd teachlink-backend
cp .env.example .env
npm install
npm run start:dev
📌 Features
User authentication (JWT + refresh tokens)

Knowledge sharing module

Real-time messaging with file uploads

Notification system

Role-based access control

API documentation with Swagger

## 📊 Modules Overview by User Type

| User Type                  | Modules Involved                             |
|---------------------------|-----------------------------------------------|
| Creators & Educators      | `knowledge/`, `users/`, `file-upload/`       |
| Learners                  | `knowledge/`, `analytics/`, `auth/`          |
| Innovators & Entrepreneurs| `messaging/`, `notifications/`               |
| Influencers               | `users/`, `file-upload/`, `analytics/`       |
| Web3 Enthusiasts          | `web3/`, `wallet/`, `knowledge/`             |
| Consultants               | `consulting/`, `users/`, `auth/`             |
| Students                  | `knowledge/`, `users/`, `notifications/`     |
| Investors                 | `analytics/`, `web3/`, `config/`             |

📌 See the attached diagram for a visual reference.

---

## 📁 File Structure (Simplified)

```txt
src/
├── auth/              # JWT, refresh tokens
├── users/             # Profiles, roles
├── knowledge/         # Courses, paid content
├── messaging/         # WebSocket real-time chat
├── file-upload/       # Cloudinary integration
├── notifications/     # Email, SMS, push
├── consulting/        # Paid consulting sessions
├── web3/              # Wallet connect & blockchain logic
├── analytics/         # User/content stats
├── common/            # Guards, interceptors, decorators
├── config/            # Central app configuration
teachlink-backend/
├── src/
│   ├── auth/                         # JWT auth, guards, refresh tokens
│   │   ├── dto/
│   │   ├── strategies/
│   │   └── auth.module.ts
│
│   ├── users/                        # User profiles, roles, onboarding
│   │   ├── dto/
│   │   ├── entities/
│   │   └── users.module.ts
│
│   ├── knowledge/                   # Courses, content, tagging, pricing
│   │   ├── dto/
│   │   ├── entities/
│   │   ├── controllers/
│   │   ├── services/
│   │   └── knowledge.module.ts
│
│   ├── messaging/                   # Real-time chat, WebSocket gateway
│   │   ├── gateway/
│   │   ├── dto/
│   │   ├── entities/
│   │   └── messaging.module.ts
│
│   ├── file-upload/                 # Uploads to Cloudinary
│   │   ├── cloudinary.service.ts
│   │   └── file-upload.module.ts
│
│   ├── notifications/              # Email, SMS, push (Bull + Redis)
│   │   ├── jobs/
│   │   ├── templates/
│   │   └── notifications.module.ts
│
│   ├── consulting/                 # 1-on-1 sessions, availability, booking
│   │   ├── dto/
│   │   ├── entities/
│   │   └── consulting.module.ts
│
│   ├── web3/                       # Wallet connect, blockchain interactions
│   │   ├── services/
│   │   ├── dto/
│   │   └── web3.module.ts
│
│   ├── analytics/                  # Engagement stats, token rewards, insights
│   │   └── analytics.module.ts
│
│   ├── common/                     # Interceptors, decorators, pipes, guards
│   │   ├── decorators/
│   │   ├── interceptors/
│   │   ├── guards/
│   │   └── pipes/
│
│   ├── config/                     # Centralized app config
│   │   └── configuration.ts
│
│   ├── app.module.ts
│   ├── main.ts
│   └── constants.ts
│
├── test/                           # Unit & e2e tests
├── prisma/ or migrations/         # Schema or TypeORM migrations
├── .env.example
├── tsconfig.json
├── package.json
└── README.md

TEACHLINK ROADMAP
PHASE 1: Core MVC Development
🎯 Goal: Build the foundational structure and core user flows.

Auth (JWT, roles), Users module

Knowledge module (upload, access control)

File upload integration (Cloudinary/S3)

Token-based content restriction
PHASE 2: Advanced Features & Web3 Integration
🎯 Goal: Add interaction, monetization, and decentralized logic.

Messaging (WebSocket) & Notifications (Bull + Redis)

Analytics (engagement, views, purchases)

Consulting module (booking, calendar sync)

Web3 wallet auth & transaction logging
PHASE 3: Launch, Scaling & Optimization
🎯 Goal: Polish UX, secure platform, and deploy to production.

CI/CD pipelines for all apps

End-to-end testing and security audits

API docs (Swagger), frontend docs

Deploy contracts to mainnet

App store deployment (iOS/Android)

Community launch & onboarding flow

Web3 rewards & referral program (optional)


Let make our code clean, maintainable, scalable and up to standard