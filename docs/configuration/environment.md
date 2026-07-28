# Environment & Configuration Guide

This document serves as the unified reference for environment variables and configuration settings across environments.

## ⚙️ Environment Variables Reference

| Variable | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | `string` | `development` | Application execution environment (`development`, `test`, `production`). |
| `PORT` | `number` | `3000` | Port on which the HTTP server listens. |
| `DATABASE_URL` | `string` | - | PostgreSQL connection URI. |
| `REDIS_URL` | `string` | - | Redis instance connection string for queue processing. |

## 🚀 Setup & Local Configuration
Copy `.env.example` to `.env` in the project root and populate the required secrets before launching the application.