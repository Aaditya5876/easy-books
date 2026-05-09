# Easy Books — Local Setup Guide

## Prerequisites

Install these before starting:

- **Node.js** v18 or higher — https://nodejs.org
- **PostgreSQL** v14 or higher — https://www.postgresql.org/download
- **Git** — https://git-scm.com

---

## Step 1 — Clone the repository

```bash
git clone https://github.com/Aaditya5876/easy-books.git
cd easy-books
```

---

## Step 2 — Create the backend environment file

Create a file called `.env` inside the `backend/` folder:

```
backend/.env
```

Paste this content into it and fill in your values:

```env
# Database — replace with your PostgreSQL connection string
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/easybooks"

# JWT Secrets — use any long random strings (keep these secret)
JWT_ACCESS_SECRET=your_access_secret_change_this
JWT_REFRESH_SECRET=your_refresh_secret_change_this

# Optional — defaults shown
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
PORT=3000
NODE_ENV=development
```

> **How to create the PostgreSQL database:**
> Open a terminal and run:
> ```bash
> psql -U postgres
> CREATE DATABASE easybooks;
> \q
> ```

---

## Step 3 — Install dependencies

Run this once from the root folder (installs everything for frontend, backend, and shared):

```bash
npm install
```

---

## Step 4 — Set up the database

Run these from the root folder:

```bash
npm run migrate:dev --workspace=backend
```

This creates all the tables in your database.

If it asks for a migration name, type anything like `init` and press Enter.

---

## Step 5 — Start the backend

Open a terminal and run:

```bash
npm run dev:backend
```

Backend runs at: `http://localhost:3000`

API docs (Swagger): `http://localhost:3000/api/docs`

---

## Step 6 — Start the frontend

Open a **second terminal** and run:

```bash
npm run dev:frontend
```

Frontend runs at: `http://localhost:5173`

Open `http://localhost:5173` in your browser.

---

## Step 7 — Register your first account

Go to `http://localhost:5173/register` and create an account. This also creates your first company.

---

## Running both at once (optional)

Instead of Steps 5 and 6 separately, you can run everything with one command:

```bash
npm run dev
```

This starts both backend and frontend together.

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
