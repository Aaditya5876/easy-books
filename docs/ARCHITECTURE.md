# Easy Books — Architecture & Technical Stack

**Version:** 1.0  
**Date:** April 17, 2026  
**Status:** Approved — In Development

---

## 1. Overview

Easy Books is a multi-tenant SaaS application for accounting and inventory management, targeting businesses in Nepal — from small shops to large organizations.

The system is built as a **monorepo** containing three packages:

```
easy-books/
├── frontend/        ← React SPA (user interface)
├── backend/         ← NestJS REST API (business logic)
├── shared/          ← Zod schemas + TypeScript types (shared by both)
└── package.json     ← npm workspaces root
```

---

## 2. Architecture — Hexagonal (Ports & Adapters)

We follow **Hexagonal Architecture** (also called Ports & Adapters). The core idea is simple:

> Business logic knows nothing about the outside world. It does not know about HTTP, databases, or queues. Those are all external details that plug into the core.

```
┌─────────────────────────────────────────────────────┐
│                    OUTSIDE WORLD                    │
│                                                     │
│   HTTP Requests      Job Queue        Database      │
│        │                 │                │         │
│   ┌────▼─────┐    ┌──────▼─────┐   ┌─────▼──────┐  │
│   │ Controller│    │  Job Handler│   │ Repository │  │
│   │ (Input   │    │  (Input    │   │ (Output    │  │
│   │ Adapter) │    │  Adapter)  │   │ Adapter)   │  │
│   └────┬─────┘    └──────┬─────┘   └─────▲──────┘  │
│        │                 │               │          │
│   ─────┼─────────────────┼───────────────┼─────── ← │ Ports (interfaces)
│        │                 │               │          │
│   ┌────▼─────────────────▼───────────────┴──────┐   │
│   │                  DOMAIN CORE                │   │
│   │                                             │   │
│   │   Entities   │   Services   │  Repositories │   │
│   │   (Business  │  (Use Cases) │  (Interfaces) │   │
│   │    Objects)  │              │               │   │
│   └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### Why Hexagonal?

- **Testable:** Business logic can be unit tested without a database or HTTP server
- **Replaceable:** Swap PostgreSQL for another DB without touching business logic
- **Scalable:** Each layer has a single responsibility — easier to maintain as the team grows
- **Familiar:** Mirrors the architecture used in our other internal systems

---

## 3. Full Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Monorepo** | npm workspaces | Single repo, three packages |
| **Frontend** | React 18 + Vite + TypeScript | User interface |
| **UI Components** | shadcn/ui + Radix UI + Tailwind CSS | Component library |
| **Frontend State** | TanStack React Query | Server state + caching |
| **Frontend Forms** | React Hook Form + Zod | Form state + validation |
| **Frontend Routing** | React Router v6 | Client-side navigation |
| **Shared** | Zod + TypeScript | DTOs and types shared between FE and BE |
| **Backend** | NestJS + TypeScript | REST API framework |
| **ORM** | Prisma | Database access + migrations |
| **Database** | PostgreSQL | Primary data store |
| **Job Queue** | BullMQ + Redis | Async jobs (payroll, reports, emails) |
| **Authentication** | JWT | Access token (15min) + Refresh token (7 days) |
| **Token Storage** | httpOnly cookies | Secure, not accessible via JavaScript |
| **Validation** | Zod (shared) + NestJS Pipes | Input validation at API boundary |
| **Logging** | Pino | Structured JSON logging |
| **Testing (FE)** | Vitest | Unit + integration tests |
| **Testing (BE)** | Jest | Unit + integration tests |
| **Containerization** | Docker + docker-compose | Local dev + production |

---

## 4. Backend Folder Structure

```
backend/
└── src/
    ├── adapter/
    │   ├── input/
    │   │   ├── api/
    │   │   │   └── v1/                        ← HTTP controllers (one per domain)
    │   │   │       └── example.controller.ts  ← @Controller() — handles HTTP only
    │   │   └── queue/
    │   │       └── example.job.ts             ← BullMQ job processors (async tasks)
    │   └── output/
    │       └── persistence/
    │           └── psql/
    │               └── example.psql.repository.ts  ← Prisma implementations
    │
    ├── application/
    │   └── services/
    │       └── example.service.impl.ts        ← Business logic (@Injectable())
    │
    ├── domain/
    │   ├── entities/                          ← Pure TypeScript business objects
    │   ├── services/                          ← Abstract service interfaces
    │   ├── repositories.ts                    ← Abstract repository contracts
    │   └── vo.ts                              ← Enums and value objects
    │
    ├── modules/                               ← NestJS wiring (DI, module declarations)
    │   ├── app.module.ts
    │   ├── inventory.module.ts
    │   └── sales.module.ts ...
    │
    ├── core/
    │   ├── db/psql/                           ← Prisma client singleton
    │   ├── queue/                             ← BullMQ client + Redis connection
    │   ├── utils/                             ← Logger, helpers
    │   └── config.ts                          ← Typed env config (Zod + @nestjs/config)
    │
    ├── prisma/
    │   ├── schema.prisma                      ← All 16 table definitions
    │   └── migrations/                        ← Auto-generated by Prisma
    │
    └── main.ts                                ← NestJS bootstrap entry point
```

### How a Request Flows Through the System

```
HTTP Request
    │
    ▼
Controller (adapter/input/api/v1/)
    │  Validates input via Zod pipe
    │
    ▼
Service Impl (application/services/)
    │  Pure business logic
    │  Calls repository interface (domain contract)
    │
    ▼
Prisma Repository (adapter/output/persistence/psql/)
    │  Implements the interface
    │  Talks to PostgreSQL via Prisma
    │
    ▼
PostgreSQL Database
```

---

## 5. Database Design

- **Engine:** PostgreSQL
- **ORM:** Prisma (schema-first, auto-generated migrations)
- **Multi-tenancy:** Every table has a `company_id` foreign key — data is fully isolated per company
- **Primary keys:** UUID (not auto-increment integers)
- **Timestamps:** `created_at`, `updated_at` on every table

### The 16 Domain Tables

| Table | Description |
|---|---|
| `Company` | Root tenant — every record belongs to a company |
| `Employee` | HR records |
| `Attendance` | Employee check-in/check-out |
| `Payroll` | Monthly salary records |
| `BankAccount` | Bank account management |
| `Transaction` | Cash, bank, QR, cheque movements |
| `LedgerAccount` | Chart of accounts (double-entry) |
| `LedgerEntry` | Journal entries (debit/credit) |
| `InventoryItem` | Stock with low-stock threshold alerts |
| `SalesOrder` | Customer invoices (VAT 13% support) |
| `PurchaseOrder` | Vendor purchase orders |
| `Client` | Customer CRM records |
| `Vendor` | Supplier management |
| `Quotation` | Quote-to-invoice pipeline |
| `MemoDocument` | Free-form internal documents |
| `Task` | Internal task management |

---

## 6. Authentication Flow

```
1. User submits login (email + password)
        │
        ▼
2. Backend validates credentials
        │
        ▼
3. Backend issues:
   ├── Access Token  (JWT, 15 minutes)   → stored in httpOnly cookie
   └── Refresh Token (JWT, 7 days)       → stored in httpOnly cookie
        │
        ▼
4. Frontend makes API calls with cookies (automatic)
        │
        ▼
5. When access token expires → silent refresh via /auth/refresh
        │
        ▼
6. When refresh token expires → redirect to login
```

**Why httpOnly cookies instead of localStorage?**  
Tokens in `localStorage` are accessible via JavaScript — vulnerable to XSS attacks. httpOnly cookies are invisible to JavaScript and sent automatically by the browser.

---

## 7. Async Job Queue

Some operations are too slow or too heavy to run inside an HTTP request. These are offloaded to **BullMQ** (backed by Redis):

| Job | Trigger | Why Async |
|---|---|---|
| Payroll processing | Month-end | Calculates for all employees — can take seconds |
| PDF report generation | On demand | CPU intensive |
| Email notifications | Invoice sent, low stock | Non-blocking, can retry on failure |
| Scheduled reminders | Monthly | Cron-like scheduling |

---

## 8. Shared Package

The `shared/` package is the key advantage of the monorepo. Zod schemas are defined once and imported by both frontend and backend:

```typescript
// shared/src/schemas/sales-order.schema.ts
export const CreateSalesOrderSchema = z.object({
  clientId: z.string().uuid(),
  items: z.array(SalesOrderItemSchema),
  isVat: z.boolean(),
  date: z.string(),
});

export type CreateSalesOrderDTO = z.infer<typeof CreateSalesOrderSchema>;
```

- **Backend** uses it in the NestJS validation pipe
- **Frontend** uses it in React Hook Form

No type drift. One source of truth.

---

## 9. Nepal-Specific Requirements

| Requirement | Implementation |
|---|---|
| **Nepali date (BS)** | Custom conversion utility in `shared/` |
| **VAT 13%** | Computed field on SalesOrder and PurchaseOrder |
| **Currency NPR** | Default currency on Company entity |
| **IRD compliance** | Planned — Phase 2 |

---

## 10. Local Development Setup

```bash
# Prerequisites
# - Node.js 20+
# - Docker + docker-compose
# - npm

# 1. Clone and install
git clone https://github.com/your-org/easy-books.git
cd easy-books
npm install

# 2. Start infrastructure (PostgreSQL + Redis)
docker-compose -f backend/docker/docker-compose.yml up -d

# 3. Run database migrations
cd backend && npx prisma migrate dev

# 4. Start backend
npm run dev --workspace=backend

# 5. Start frontend
npm run dev --workspace=frontend
```

---

## 11. Key Architectural Decisions

| Decision | Choice | Reason |
|---|---|---|
| Monorepo vs separate repos | Monorepo | Shared types, one git history, simpler for 4-person team |
| Backend framework | NestJS | Team familiarity, built-in DI, enterprise-grade at scale |
| Frontend framework | React + Vite | Already built, fast HMR, large ecosystem |
| ORM | Prisma | TypeScript-first, excellent migrations, readable schema |
| Auth storage | httpOnly cookie | More secure than localStorage (XSS protection) |
| Architecture | Hexagonal | Testable, maintainable, mirrors internal Misumi standards |
| Background jobs | BullMQ | Redis-backed, retries, scheduling — Node.js equivalent of Celery |

---

## 12. What is NOT in Scope (Phase 1)

- IRD / VAT filing API integration
- Mobile application
- Multi-language support
- Stripe payment processing (SDK present, not wired)
- OpenSearch / full-text search
- S3 file storage (local storage first)
- Multi-region deployment

---

*This document reflects the agreed architecture as of April 17, 2026. Any changes to stack or structure must be updated here.*