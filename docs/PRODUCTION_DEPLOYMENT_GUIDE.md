# Easy Books Production Deployment Guide

## Table of Contents
- [Architecture](#architecture)
- [Production environment variables](#production-environment-variables)
- [Production Docker Compose flow](#production-docker-compose-flow)
- [Manual production setup](#manual-production-setup)
- [Production notes](#production-notes)
- [Checklist](#checklist)

## Architecture
A production deployment for Easy Books requires:

- Backend Node/Nest application
- Frontend static app
- PostgreSQL database
- Redis service
- Domain and HTTPS
- Optional reverse proxy (Nginx, Traefik, Caddy, etc.)

This app uses Redis for Bull queue support, so Redis is required in production.

## Production environment variables
Use a secure `backend/.env` in production:

```env
NODE_ENV=production
PORT=3000
DATABASE_URL="postgresql://easybooksuser:easybookspass@postgres:5432/easybooks"
JWT_ACCESS_SECRET=some-long-secret
JWT_REFRESH_SECRET=some-long-secret
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
REDIS_HOST=redis
REDIS_PORT=6379
CORS_ORIGIN=https://your-domain.com
```

If frontend and backend are hosted separately, set frontend environment for API URL:

```env
VITE_API_URL=https://api.your-domain.com
```

## Production Docker Compose flow

1. Build the backend image:
   ```bash
   docker compose -f backend/docker/docker-compose.yml build
   ```
2. Start PostgreSQL and Redis:
   ```bash
   docker compose -f backend/docker/docker-compose.yml up -d postgres redis
   ```
3. Run production migrations:
   ```bash
   docker compose -f backend/docker/docker-compose.yml run --rm api npx prisma migrate deploy
   ```
4. Start the API service:
   ```bash
   docker compose -f backend/docker/docker-compose.yml up -d api
   ```

## Manual production setup

If you do not use Docker in production, install these services manually:

- PostgreSQL
- Redis
- Node.js

Then:

1. Install dependencies:
   ```bash
   npm install
   ```
2. Build backend:
   ```bash
   npm run build --workspace=backend
   ```
3. Build frontend:
   ```bash
   npm run build --workspace=frontend
   ```
4. Run migrations:
   ```bash
   npm run migrate:deploy --workspace=backend
   ```
5. Start backend:
   ```bash
   node backend/dist/main
   ```
6. Serve frontend from a static host such as Nginx, Vercel, Netlify, or another static file server.

## Production notes

- Redis is required because the backend registers Bull queues.
- The domain does not replace database or Redis services.
- Use HTTPS in production.
- Use a reverse proxy if you want to serve frontend and backend from the same domain.
- Use strong JWT secrets and keep `.env` out of source control.

## Checklist

- [ ] PostgreSQL is running and accessible
- [ ] Redis is running and accessible
- [ ] `backend/.env` is configured for production
- [ ] Migrations have been deployed
- [ ] Backend is running under a process manager or Docker
- [ ] Frontend is served from a static host
- [ ] Domain and DNS point to the correct services
- [ ] HTTPS is configured
