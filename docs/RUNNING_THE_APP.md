# Running Easy Books — Complete Guide

## Step 1 — Environment Variables

All env vars live in one file: `backend/.env`

Open it and fill in your values:

```env
# ── Database (required) ───────────────────────────────────
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DBNAME"

# ── JWT (both required — use any two different random strings) ──
JWT_ACCESS_SECRET="change-this-to-a-long-random-string"
JWT_REFRESH_SECRET="change-this-to-another-long-random-string"

# ── Server (defaults are fine for local dev) ─────────────
PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173

# ── Redis (required for background jobs) ─────────────────
REDIS_HOST=localhost
REDIS_PORT=6379

# ── Gemini AI — optional, free tier works ────────────────
GEMINI_API_KEY=

# ── Sparrow SMS Nepal — optional ─────────────────────────
SMS_API_KEY=
SMS_SENDER_ID=

# ── eSewa — optional, blank = auto sandbox mode ──────────
ESEWA_SECRET_KEY=
ESEWA_PRODUCT_CODE=

# ── Khalti — optional, test_ prefix = sandbox mode ───────
KHALTI_SECRET_KEY=
```

| Variable | Required? | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` | Yes | Any random string, 20+ chars |
| `JWT_REFRESH_SECRET` | Yes | Different from access secret |
| `REDIS_HOST` / `REDIS_PORT` | Yes | Default `localhost:6379` works |
| `GEMINI_API_KEY` | No | AI features — free tier works |
| `SMS_API_KEY` + `SMS_SENDER_ID` | No | Sparrow SMS Nepal |
| `ESEWA_SECRET_KEY` + `ESEWA_PRODUCT_CODE` | No | Blank = eSewa sandbox |
| `KHALTI_SECRET_KEY` | No | `test_` prefix = Khalti sandbox |

---

## Step 2 — Install Dependencies (first time only)

```powershell
cd "C:\Users\AadityaJoshi\Desktop\easy-books"
npm install
```

---

## Step 3 — Apply Database Migrations

```powershell
cd "C:\Users\AadityaJoshi\Desktop\easy-books"
npm run migrate
```

This runs `prisma migrate deploy` — applies all pending migrations to your database. Safe to run multiple times, no data is lost.

### Check migration status (optional)

```powershell
cd "C:\Users\AadityaJoshi\Desktop\easy-books\backend"
npx prisma migrate status
```

Shows which migrations are applied and which are pending.

---

## Step 4 — Run Everything

```powershell
cd "C:\Users\AadityaJoshi\Desktop\easy-books"
npm run dev
```

This starts both servers concurrently:

| Server   | URL                   |
| -------- | --------------------- |
| Backend  | http://localhost:3000 |
| Frontend | http://localhost:5173 |

---

## What Works Without API Keys

| Feature                         | Needs Key?               |
| ------------------------------- | ------------------------ |
| All 16 admin modules            | No — works now          |
| Full parent/student portal      | No — works now          |
| Attendance, fees, results, etc. | No — works now          |
| AI features (5 total)           | Yes —`GEMINI_API_KEY` |
| SMS sending (Sparrow)           | Yes —`SMS_API_KEY`    |
| eSewa payments                  | No — auto sandbox mode  |
| Khalti payments                 | No — auto sandbox mode  |

---

## Useful Commands

```powershell
# Run only the backend
npm run dev:backend --prefix "C:\Users\AadityaJoshi\Desktop\easy-books"

# Run only the frontend
npm run dev:frontend --prefix "C:\Users\AadityaJoshi\Desktop\easy-books"

# Open Prisma Studio (visual DB browser)
cd "C:\Users\AadityaJoshi\Desktop\easy-books\backend"
npx prisma studio

# Reset DB completely (WARNING: deletes all data)
cd "C:\Users\AadityaJoshi\Desktop\easy-books\backend"
npx prisma migrate reset
```
