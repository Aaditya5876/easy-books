# Easy Books — Local Setup Guide

## Table of Contents
- [Prerequisites](#prerequisites)
- [General execution](#general-execution)
- [Local setup for a new device](#local-setup-for-a-new-device)
- [Production deployment guide](#production-deployment-guide)
- [Tea shop test guide](#tea-shop-test-guide)
- [Common issues](#common-issues)

## Prerequisites

Install these before starting:

- **Node.js** v18 or higher — https://nodejs.org
- **Git** — https://git-scm.com

> If you want the easiest setup for a new device, use Docker Desktop and the local setup steps below.

---

## General execution

From the repo root, use the following commands:

```bash
npm install
npm run dev
```

For backend only:

```bash
npm run dev:backend
```

For frontend only:

```bash
npm run dev:frontend
```

---

## Local setup for a new device

### Step 1 — Clone the repository

```bash
git clone https://github.com/Aaditya5876/easy-books.git
cd easy-books
```

---

### Step 2 — Create the backend environment file

Create a file called `.env` inside the `backend/` folder:

```
backend/.env
```

Paste this content into it and fill in your values:

```env
NODE_ENV=development
PORT=3000

# PostgreSQL
DATABASE_URL="postgresql://easybooksuser:easybookspass@localhost:5433/easybooks"

# JWT
JWT_ACCESS_SECRET=your_access_secret_change_this
JWT_REFRESH_SECRET=your_refresh_secret_change_this
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Redis (BullMQ queue)
REDIS_HOST=localhost
REDIS_PORT=6379

# Frontend URL
CORS_ORIGIN=http://localhost:5173
```

### Option A — Use Docker Desktop (recommended for a new device)

If your friend is non-technical, Docker Desktop is easiest because it provides PostgreSQL and Redis without installing them separately.

1. Install Docker Desktop for Windows: https://www.docker.com/products/docker-desktop
2. Start Docker Desktop.
3. From the repo root, run:

```powershell
npm install

docker compose -f backend/docker/docker-compose.yml up -d postgres redis
```

4. Wait until `easybooks-postgres` and `easybooks-redis` are healthy.

5. Run the migration:

```powershell
npm run migrate:dev --workspace=backend
```

### Option B — Install PostgreSQL and Redis manually

If you do not want to use Docker, you must install both PostgreSQL and Redis locally and make sure they are running before starting the app.

- PostgreSQL must be available at the same URL as `DATABASE_URL` in `backend/.env`.
- Redis must be available at `localhost:6379`.

If your local Postgres uses a different port or user, update `backend/.env` accordingly.

> **How to create the PostgreSQL database manually:**
> Open a terminal and run:
> ```bash
> psql -U postgres
> CREATE DATABASE easybooks;
> \q
> ```

---

### Step 3 — Install dependencies

Run this once from the root folder (installs everything for frontend, backend, and shared):

```bash
npm install
```

---

### Step 4 — Set up the database

Run these from the root folder:

```bash
npm run migrate:dev --workspace=backend
```

This creates all the tables in your database.

If it asks for a migration name, type anything like `init` and press Enter.

---

### Step 5 — Start the backend

Open a terminal and run:

```bash
npm run dev:backend
```

Backend runs at: `http://localhost:3000`

API docs (Swagger): `http://localhost:3000/api/docs`

---

### Step 6 — Start the frontend

Open a **second terminal** and run:

```bash
npm run dev:frontend
```

Frontend runs at: `http://localhost:5173`

Open `http://localhost:5173` in your browser.

---

### Step 7 — Register your first account

Go to `http://localhost:5173/register` and create an account. This also creates your first company.

---

## Running both at once (optional)

Instead of Steps 5 and 6 separately, you can run everything with one command:

```bash
npm run dev
```

This starts both backend and frontend together.

---

## Production deployment guide

For production deployment instructions, see `docs/PRODUCTION_DEPLOYMENT_GUIDE.md`.

## Tea shop test guide

For step-by-step tea shop testing, see `docs/TEA_SHOP_TEST_GUIDE.md`.

---

## Common issues

**"password authentication failed for user postgres"**
Your DATABASE_URL username/password doesn't match your PostgreSQL installation. Check what user you set during PostgreSQL install and update `backend/.env`.

**"database easybooks does not exist"**
You skipped creating the database. Run the `psql` commands in Step 2.

**"Cannot find module" or TypeScript errors in IDE**
These are IDE warnings — they don't affect running the app. The app will still work.

**Frontend shows blank page or login loops**
Make sure the backend is running on port 3000 before opening the frontend.

**Port 3000 already in use**
Add `PORT=3001` to `backend/.env` and update `frontend/src/api/client.ts` — change `http://localhost:3000` to `http://localhost:3001`.
