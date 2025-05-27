
# 🧠 TeachLink Backend
**TeachLink** is a decentralized platform built to enable technocrats to **share, analyze, and monetize knowledge, skills, and ideas**. This repository contains the **backend API** built with **NestJS**, **TypeORM**, and powered by **Starknet** and **PostgreSQL**, serving as the core of the TeachLink ecosystem.

This is the **NestJS** backend powering TeachLink — offering APIs, authentication, user management, notifications, and knowledge monetization features. 


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

| Layer          | Technology                      |
|----------------|----------------------------------|
| Framework      | NestJS                          |
| Database       | PostgreSQL + TypeORM            |
| Blockchain     | Starknet + Starknet.js          |
| Realtime       | WebSockets (Gateway)            |
| Queues/Async   | BullMQ + Redis (optional)       |
| File Uploads   | Cloudinary                      |
| Config Mgmt    | @nestjs/config                  |
| Testing        | Jest + Supertest                |
| Auth           | JWT + Wallet Sign-In            |
| Deployment     | Docker, Railway, or Fly.io      |
|File Upload     | Cloudinary                      |
|Documentation   | Swagger                         |


## 🚀 Deployment

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