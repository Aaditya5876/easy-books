# Backend Services Audit — Easy Books

**Date:** 2026-05-15  
**Scope:** All 27 backend services + ledger posting + payroll engine  
**Purpose:** Document current behaviour vs expected behaviour for every service. Identify bugs, missing logic, and broken accounting flows.

---

## Table of Contents

1. [Summary Matrix](#1-summary-matrix)
2. [Critical Bugs — Fix Immediately](#2-critical-bugs--fix-immediately)
3. [Service-by-Service Analysis](#3-service-by-service-analysis)
4. [Ledger Posting Analysis](#4-ledger-posting-analysis)
5. [Payroll Engine Analysis](#5-payroll-engine-analysis)
6. [Auth Service Analysis](#6-auth-service-analysis)
7. [Database Integrity Issues](#7-database-integrity-issues)
8. [Role & Permissions System](#8-role--permissions-system)
9. [Dashboard Requirements](#9-dashboard-requirements)
10. [Priority Fix List](#10-priority-fix-list)

---

## 1. Summary Matrix

| Service | Status | Severity |
|---------|--------|----------|
| Auth | Working — security gaps | MEDIUM |
| Inventory | Basic CRUD works | LOW |
| Employee | Basic CRUD — risky deletes | MEDIUM |
| Attendance | Basic CRUD — no leave deduction | MEDIUM |
| Client / Vendor | Basic CRUD | LOW |
| Sales Orders | Stock deduction works — ledger buggy | HIGH |
| Purchase Orders | Stock increase works — payment not posted | HIGH |
| Payroll Engine | Calculates — wrong ledger signs, missing Dashain bonus | CRITICAL |
| Leave Requests | Approval works — fiscal year bug, no carryover | HIGH |
| Ledger Accounts | CRUD — no system account protection | MEDIUM |
| Ledger Entries | No debit/credit validation | CRITICAL |
| Ledger Posting | Sales OK — payroll reversed, purchase payment missing | CRITICAL |
| Credit Notes | Created — NOT posted to GL | HIGH |
| Debit Notes | Created — NOT posted to GL | HIGH |
| Cheques | Status transitions work — no clearing posting | MEDIUM |
| Bank Guarantees | Tracking only — no liability in GL | MEDIUM |
| Petty Cash | CRUD + summary — NOT posted to GL | MEDIUM |
| Company / Settings | Works | LOW |
| Bank Accounts | Basic CRUD | LOW |
| Tasks | Basic CRUD | LOW |
| Quotations | Basic CRUD — no conversion to sales order | MEDIUM |
| Memos | Basic CRUD | LOW |
| VAT Service | Works — rate hardcoded | LOW |
| Payment Service | Read-only by design | OK |

---

## 2. Critical Bugs — Fix Immediately

### BUG-1: Payroll ledger entry reverses cash flow
**File:** `backend/src/application/services/ledger-posting.service.ts`  
**Current behaviour:** When salary is paid, the entry credits Cash (increases it).  
**Expected behaviour:** Paying salary means Cash goes OUT — must debit Cash.  
**Impact:** Cash balance on the balance sheet shows money increasing every time payroll runs. Every financial statement is wrong.

```
Current:  DR Salary Expense | CR Cash  ← WRONG (Cash increases)
Expected: DR Salary Expense | CR SSF Payable
          DR Net Salary Payable | CR Cash  ← Cash decreases
```

---

### BUG-2: Purchase payment never posted to GL
**File:** `backend/src/application/services/purchase.service.impl.ts` — `recordPayment()`  
**Current behaviour:** Payment record is created in the `payments` table. No ledger entry is created.  
**Expected behaviour:** Every payment to a vendor must post:
```
DR Accounts Payable | CR Cash/Bank
```
**Impact:** Accounts Payable balance never goes down even after paying suppliers. GL is unbalanced.

---

### BUG-3: Sales VAT double-posted to Accounts Receivable
**File:** `backend/src/application/services/ledger-posting.service.ts` — `postSalesOrder()`  
**Current behaviour:** Accounts Receivable is debited with `subtotal` only. VAT is debited to AR again as a separate entry — but VAT should be part of the same AR debit (the customer owes total = subtotal + VAT).  
**Expected behaviour:**
```
DR Accounts Receivable (subtotal + VAT) | CR Sales Revenue (subtotal)
                                         | CR VAT Payable (VAT amount)
```

---

### BUG-4: No debit/credit validation in LedgerEntry
**File:** `backend/src/application/services/ledger-entry.service.impl.ts`  
**Current behaviour:** Any combination of debit and credit values is accepted. Both can be non-zero. Locked entries can be edited/deleted.  
**Expected behaviour:** Each ledger entry must have exactly one non-zero side (either debit OR credit, not both). Locked entries must be immutable.

---

### BUG-5: Dashain bonus not implemented in Payroll Engine
**File:** `backend/src/application/services/payroll.engine.ts`  
**Current behaviour:** `CompanyPayrollSettings` has `dashainBonusApplicable` and `dashainBonusMonth` fields but they are never read during payroll calculation.  
**Expected behaviour:** In the configured Dashain month, each employee receives 1 additional month of basic salary as Dashain bonus. This is mandatory under Nepal Labour Act.

---

### BUG-6: BS/AD fiscal year conversion is wrong
**Files:** `payroll.engine.ts`, `sales.service.impl.ts`, `leave.service.impl.ts`  
**Current behaviour:** All services use `year ± 57` to convert between BS and AD (e.g., `new Date(\`${bsYear - 57}-${month}\`)`). This is a crude approximation. The actual offset varies month by month because the Nepali calendar does not align cleanly with the Gregorian calendar.  
**Expected behaviour:** Use the proper BS↔AD conversion library already available in `@easy-books/shared` (`adToBs` / `bsToAd`). Never do `year ± 57` directly.  
**Impact:** Attendance for the first month of a fiscal year is counted from the wrong date range. Payroll figures are wrong.

---

## 3. Service-by-Service Analysis

---

### 3.1 Inventory Service

| Method | Current Behaviour | Expected Behaviour | Gap |
|--------|------------------|-------------------|-----|
| `findAll` | Returns all items for company | Same | None |
| `findOne` | Returns item or 404 | Same | None |
| `create` | Creates item | Should validate: no negative initial stock | No negative quantity check |
| `update` | Updates any field | Should validate: stock quantity cannot go below 0 | No floor validation |
| `remove` | Hard deletes | Should block if item has sales/purchase history | No reference check |

**Missing:**
- Inventory adjustment log (who changed stock, when, why)
- Low stock threshold / alert
- Reorder quantity suggestion

---

### 3.2 Employee Service

| Method | Current Behaviour | Expected Behaviour | Gap |
|--------|------------------|-------------------|-----|
| `create` | Creates employee | Same | None for basic case |
| `remove` | Hard deletes employee | Should soft-delete or block if they have payroll/attendance records | Will crash if records exist |

**Missing:**
- Soft delete / deactivation (set status = RESIGNED/TERMINATED)
- Audit log of salary changes
- PAN/Citizenship document validation

---

### 3.3 Attendance Service

| Method | Current Behaviour | Expected Behaviour | Gap |
|--------|------------------|-------------------|-----|
| `create` | Creates attendance record | Should: (1) block duplicate dates, (2) deduct from leave balance if status = LEAVE | No duplicate error message, no leave deduction |
| `update` | Updates freely | If status changes FROM PRESENT to LEAVE, should deduct balance | No deduction |

**Missing:**
- Automatic late/early deduction rules
- Overtime calculation trigger

---

### 3.4 Sales Service

| Method | Current Behaviour | Expected Behaviour | Gap |
|--------|------------------|-------------------|-----|
| `create` | Validates stock, generates invoice number, creates order + items atomically, deducts stock, posts to ledger | Same — but ledger posting has VAT bug (see BUG-3) | Ledger bug |
| `recordPayment` | Creates payment record, updates order status | **Must also post: DR Cash/Bank \| CR Accounts Receivable** | Ledger posting present but VAT amount mis-calculated |
| `remove` | Blocks if COMPLETED, restores stock | Should also REVERSE ledger entries | No GL reversal |

**Invoice Number Format:** `{abbr}/{fiscalYear}/{sequence}` — sequence is global per company, does not reset each fiscal year.  
**Expected:** Reset sequence at start of each fiscal year (Shrawan 1).

---

### 3.5 Purchase Service

| Method | Current Behaviour | Expected Behaviour | Gap |
|--------|------------------|-------------------|-----|
| `create` | Generates PO number, creates order + items, increases stock | Same | None for basic case |
| `recordPayment` | Creates payment record only | **Must post: DR Accounts Payable \| CR Cash/Bank** | **No ledger posting at all (BUG-2)** |
| `remove` | Blocks if COMPLETED, reverses stock | Should also reverse ledger entries | No GL reversal |

---

### 3.6 Leave Service

| Method | Current Behaviour | Expected Behaviour | Gap |
|--------|------------------|-------------------|-----|
| `createRequest` | Validates overlap with existing requests | Good | None for basic case |
| `approveRequest` | Sets APPROVED, deducts from leave balance | Correct | None |
| `cancelRequest` | Restores leave balance | Correct | None |
| `allocateLeave` | Upserts balance — **resets `usedDays` on update** | Should only reset `totalDays`, preserve `usedDays` | Loses leave history on reallocation |

**Missing:**
- Year-end carryover (unused days carried to next fiscal year up to a maximum)
- Leave encashment on final settlement
- Half-day leave handling in balance deduction

---

### 3.7 Credit Note / Debit Note Services

**Current behaviour:** Creates the note record. Transitions status (OPEN → APPLIED → CLOSED). No ledger entries created.

**Expected behaviour for Credit Note:**
```
On create:   DR Sales Revenue (amount) | CR Accounts Receivable (amount)
On apply:    Link to specific invoice, reduce outstanding balance
```

**Expected behaviour for Debit Note:**
```
On create:   DR Accounts Payable (amount) | CR Purchase Expenses (amount)
On apply:    Link to specific PO, reduce outstanding payable
```

**Gap:** Zero GL entries for either. Revenue and AP are permanently misstated.

---

### 3.8 Cheque Service

**Current behaviour:** Status transitions (ISSUED → DEPOSITED → CLEARED / BOUNCED) are correctly enforced.

**Expected behaviour (ledger posting):**
```
On ISSUED (payment cheque):   Record in memo — do NOT post to GL yet
On CLEARED:                   DR Accounts Payable | CR Bank Account
On BOUNCED:                   Reverse the original payment entry
On DEPOSITED (receipt cheque): Record in memo
On CLEARED:                    DR Bank Account | CR Accounts Receivable
```

**Gap:** No ledger posting at any status change.

---

### 3.9 Petty Cash Service

**Current behaviour:** CRUD + date-range summary report. No GL integration.

**Expected behaviour:** Every petty cash voucher must post:
```
DR Expense Account (mapped by category) | CR Petty Cash in Hand
```

**Gap:** Cash never decreases, expenses are never recognised in GL.

---

### 3.10 Bank Guarantee Service

**Current behaviour:** Tracks BG records, can find expiring ones. No financial entries.

**Expected behaviour:**
```
On create:   DR Bank Guarantee (contingent asset) | CR Contingent Liability
On expire/close: Reverse the above
```

**Gap:** Contingent liabilities are invisible to the balance sheet.

---

### 3.11 Quotation Service

**Current behaviour:** Full CRUD + status/remark management.

**Missing:**
- `convertToSalesOrder(quotationId)` — create a sales order from an approved quotation
- Auto-expire quotations past their validity date
- Version history when a quotation is revised

---

### 3.12 Ledger Account Service

| Risk | Current | Expected |
|------|---------|----------|
| Deleting system account | Allowed | Must block deletion of `isSystem = true` accounts |
| Duplicate account codes | DB constraint only — no friendly error | Catch constraint violation and return 400 |
| Account code format | Free text | Should enforce: 4–6 digit numeric code matching chart of accounts standard |

---

## 4. Ledger Posting Analysis

**File:** `backend/src/application/services/ledger-posting.service.ts`

### What Works
- Sales invoice posting (debit AR, credit Sales Revenue) — VAT line has a bug
- Sales payment posting (debit Cash/Bank, credit AR) — works

### What Is Broken

| Scenario | Current | Expected |
|----------|---------|----------|
| Payroll posting | Credits Cash (wrong sign) | Must debit Cash / credit Bank to pay salary |
| Purchase payment | Not called at all | `postPaymentMade()` must be added |
| Credit note | Not called | Must reverse revenue and AR |
| Debit note | Not called | Must reverse AP and expense |
| Cheque clearing | Not called | Must post on CLEARED status |
| Petty cash | Not called | Must post expense per voucher |
| Sales order deleted | Entries not reversed | Must create reversal journal |
| Purchase order deleted | Entries not reversed | Must create reversal journal |

### Journal Entry Rules (Nepal Standard)

```
Sales Invoice:
  DR Accounts Receivable (total incl. VAT)
  CR Sales Revenue (subtotal)
  CR VAT Payable (13% of taxable amount)

Purchase Invoice:
  DR Purchase/Expense Account (subtotal)
  DR VAT Receivable (13% of taxable amount)
  CR Accounts Payable (total incl. VAT)

Payment Received (from customer):
  DR Cash or Bank
  CR Accounts Receivable

Payment Made (to vendor):
  DR Accounts Payable
  CR Cash or Bank

Salary Payment:
  DR Salary Expense (gross)
  CR SSF Payable (employee contribution)
  CR Tax Payable (PIT)
  CR Cash/Bank (net salary paid)

Employer SSF:
  DR SSF Expense (employer contribution)
  CR SSF Payable
```

---

## 5. Payroll Engine Analysis

**File:** `backend/src/application/services/payroll.engine.ts`

### What Works
- Basic salary calculation
- SSF employee and employer contribution
- PIT (Personal Income Tax) with progressive slabs
- Absent day deduction
- Overtime calculation
- BullMQ async processing

### What Is Broken / Missing

| Feature | Current | Expected |
|---------|---------|----------|
| Dashain bonus | Not implemented | 1 month basic salary in configured Dashain month |
| Married PIT slabs | Never used | Must check `employee.maritalStatus` and apply higher thresholds |
| Other deductions | `otherDeductions` field ignored | Loan EMI, advance recovery, etc. must be deducted |
| Fiscal year (BS/AD) | `year ± 57` approximation | Use `bsToAd()` from `@easy-books/shared` |
| Leave without pay | Not handled | Absent days should also be counted for approved unpaid leave |
| Ledger posting after PAID | Not called | Must call `LedgerPostingService.postPayroll()` when marking as PAID |
| Gratuity | Not calculated | Must accrue gratuity (33 days per year of service under Labour Act) |
| Advance salary | Not handled | Advance issued should be recovered in payroll |

### Nepal-Specific Requirements Missing
1. **Dashain Bonus:** Mandatory. Must equal 1 month basic salary. Paid before Dashain (Kartik).
2. **Married PIT slabs:** Higher threshold (Rs 600,000 vs Rs 500,000 for unmarried).
3. **Retirement fund:** Some companies have CIT (Citizen Investment Trust) in addition to SSF.
4. **Gratuity:** 8.33% of basic salary per month accrued.
5. **Festival allowance:** May vary by company policy.

---

## 6. Auth Service Analysis

### What Works
- Registration, login, token refresh, logout, me endpoint
- httpOnly cookie-based tokens
- Password hashing with bcrypt
- UserCompany join table for multi-company support

### Security Gaps

| Gap | Current | Expected |
|-----|---------|----------|
| All users are ADMIN | Role hardcoded to 'ADMIN' on register | First user = ADMIN, subsequent users = STAFF unless promoted |
| No email verification | Account active immediately | Send OTP or verification link |
| No rate limiting | Unlimited login attempts | Max 5 failed attempts then 15-minute lockout |
| No password strength | Min 6 chars only | Require at least 1 uppercase, 1 number, 1 special char |
| No refresh token rotation | Refresh token reusable until expiry | Rotate refresh token on each use |

---

## 7. Database Integrity Issues

### Cascade Delete Risks

These deletions will crash with a foreign key violation unless records are cleaned up first:

| If you delete | Will crash because of |
|---------------|----------------------|
| Employee | Attendance, Payroll, LeaveRequest, LeaveBalance |
| Client | SalesOrder, Quotation, CreditNote |
| Vendor | PurchaseOrder, DebitNote |
| LedgerAccount | LedgerEntry |
| Company | Everything |

**Fix:** Add `onDelete: Cascade` in Prisma schema for child relations, OR implement soft delete on all entities.

### Missing Audit Trail

No `updatedBy` field on any model. No event log for:
- Who changed a salary
- Who approved a leave
- Who deleted a sales order
- Who modified a ledger entry

---

## 8. Role & Permissions System

### Current Behaviour

The `UserRole` enum exists in `backend/prisma/schema.prisma` with four values:

```
enum UserRole {
  SUPER_ADMIN
  ADMIN
  ACCOUNTANT
  STAFF
}
```

**All four values are unused.** Every user who registers is assigned `ADMIN` hardcoded in `auth.service.impl.ts`:

```typescript
role: 'ADMIN',  // ← hardcoded for every single registration
```

There are no guards, no decorators, and no enforcement on any endpoint. Any authenticated user can call any API — delete ledger entries, process payroll, change company settings, view all salaries.

---

### Expected Behaviour — Role Definitions

#### SUPER_ADMIN
Platform-level operator (Easy Books team only). Never assigned to a business user.

| Access | Details |
|--------|---------|
| All companies | Can view, impersonate, manage billing |
| Platform settings | Full control |
| All modules of all tenants | For support/debugging only |

---

#### ADMIN
The business owner or company manager. Full access within their own company.

| Module | Access |
|--------|--------|
| Sales & Purchase | Full — create, edit, delete, void |
| Inventory | Full |
| HR & Payroll | Full — view all salaries, process payroll |
| Ledger & Accounting | Full — journal entries, reports |
| Settings | Full — company settings, payroll config |
| Users | Full — invite users, assign/change roles, remove users |
| Leave | Approve / reject |
| Reports | All financial reports |

---

#### ACCOUNTANT
Hired accountant or finance staff. Can do all financial work but cannot manage the company or its users.

| Module | Access |
|--------|--------|
| Sales & Purchase | Full — create, edit, record payment |
| Inventory | View + update stock |
| HR & Payroll | Process payroll, view all salaries, approve leave |
| Ledger & Accounting | Full — journal entries, reconciliation, reports |
| Settings | View only — cannot change |
| Users | None — cannot invite or modify users |
| Credit / Debit Notes | Full |
| Cheques & Bank Guarantees | Full |
| VAT Reports | Full |

---

#### STAFF
Day-to-day operations — salesperson, storekeeper, receptionist, field worker.

| Module | Access |
|--------|--------|
| Sales orders | Create and view own orders |
| Purchase orders | Create and view |
| Inventory | View only — no price editing |
| Attendance | Log their own attendance only |
| Leave | Submit leave request (cannot approve) |
| Memos / Tasks / Quotations | Create and edit |
| Payroll | None — cannot see anyone's salary |
| Ledger / Accounting | None |
| Settings | None |
| Users | None |
| Financial reports | None |

---

### Permission Matrix

| Action | SUPER_ADMIN | ADMIN | ACCOUNTANT | STAFF |
|--------|-------------|-------|------------|-------|
| View financial reports | ✓ | ✓ | ✓ | ✗ |
| Create sales / purchase orders | ✓ | ✓ | ✓ | ✓ |
| Delete completed orders | ✓ | ✓ | ✗ | ✗ |
| Record payments | ✓ | ✓ | ✓ | ✗ |
| Create ledger / journal entries | ✓ | ✓ | ✓ | ✗ |
| View all salaries | ✓ | ✓ | ✓ | ✗ |
| Process payroll | ✓ | ✓ | ✓ | ✗ |
| Approve leave | ✓ | ✓ | ✓ | ✗ |
| Manage users (invite / roles) | ✓ | ✓ | ✗ | ✗ |
| Change company settings | ✓ | ✓ | ✗ | ✗ |
| Access other companies | ✓ | ✗ | ✗ | ✗ |
| Credit notes / debit notes | ✓ | ✓ | ✓ | ✗ |
| Cheques / bank guarantees | ✓ | ✓ | ✓ | ✗ |
| View inventory | ✓ | ✓ | ✓ | ✓ |
| Edit inventory prices | ✓ | ✓ | ✓ | ✗ |
| Log own attendance | ✓ | ✓ | ✓ | ✓ |
| Submit leave request | ✓ | ✓ | ✓ | ✓ |
| Create memos / tasks | ✓ | ✓ | ✓ | ✓ |

---

### What Needs to Be Built

#### 1. RolesGuard (NestJS Guard)
A guard that reads `req.user.role` from the JWT and checks it against allowed roles for that endpoint.

```typescript
// Usage on a controller method:
@Roles('ADMIN', 'ACCOUNTANT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Delete(':id')
async remove(...) { }
```

#### 2. Fix Registration
- First user to register for a company → `ADMIN`
- Subsequent users added via invite → role assigned by the ADMIN who invites them
- `SUPER_ADMIN` can only be set directly in the database (never via API)

#### 3. User Invite Flow (currently missing entirely)
```
POST /api/v1/users/invite
Body: { email, role }
Auth: ADMIN only
```
- Sends invite link or temporary password
- On accept, user is created with the assigned role and linked to the inviting company via `UserCompany`

#### 4. Role Change Endpoint
```
PATCH /api/v1/users/:id/role
Body: { role: 'ACCOUNTANT' | 'STAFF' }
Auth: ADMIN only — cannot change own role, cannot create SUPER_ADMIN
```

---

### Security Risks of Current State

| Risk | Impact |
|------|--------|
| Every user is ADMIN | A staff member can delete sales orders, void payroll, change company settings |
| No endpoint guards | Any valid JWT token can call any endpoint |
| No invite system | The only way to add a second user is directly in the database |
| SUPER_ADMIN role unused | No platform-level operations are possible |

---

## 9. Dashboard Requirements

The dashboard should answer the 5 most important daily questions for a Nepal business owner:

---

### Row 1 — Financial Snapshot (4 cards)

| Card | Data | Source |
|------|------|--------|
| Revenue (This Month) | Sum of completed + partially paid sales orders | SalesOrder |
| Expenses (This Month) | Sum of completed purchase orders + payroll | PurchaseOrder + Payroll |
| Net Profit | Revenue − Expenses | Calculated |
| Cash & Bank | Sum of all bank account balances | BankAccount |

---

### Row 2 — Outstanding (2 cards)

| Card | Data | Source |
|------|------|--------|
| Receivables (AR) | Total unpaid / partially paid sales invoices | SalesOrder where status != COMPLETED |
| Payables (AP) | Total unpaid / partially paid purchase orders | PurchaseOrder where status != COMPLETED |

---

### Row 3 — Sales Trend Chart

- Line/bar chart: Last 6 months of sales revenue vs expenses
- Source: SalesOrder grouped by month

---

### Row 4 — Operational Alerts (3 cards)

| Card | Data | Source |
|------|------|--------|
| Low Stock Items | Items where currentStock <= reorderLevel | InventoryItem |
| Expiring Bank Guarantees | BGs expiring within 30 days | BankGuarantee |
| Overdue Cheques | Cheques in DEPOSITED state older than 7 days | Cheque |

---

### Row 5 — HR Summary (3 cards)

| Card | Data | Source |
|------|------|--------|
| Employees Present Today | Count of PRESENT attendance today | Attendance |
| Pending Leave Requests | Count of PENDING leave requests | LeaveRequest |
| Payroll Due | Employees whose payroll is unprocessed this month | Payroll |

---

### Row 6 — Recent Activity (2 tables)

| Table | Columns | Source |
|-------|---------|--------|
| Recent Sales | Invoice #, Client, Amount, Status | SalesOrder last 5 |
| Recent Purchases | PO #, Vendor, Amount, Status | PurchaseOrder last 5 |

---

### VAT Summary (Bottom — for VAT-registered companies)

| Field | Value |
|-------|-------|
| VAT Collected (this month) | Sum of VAT on completed sales | LedgerEntry — VAT Payable |
| VAT Paid on Purchases (this month) | Sum of VAT on completed purchases | LedgerEntry — VAT Receivable |
| Net VAT Payable | Collected − Paid | Calculated |

---

## 10. Priority Fix List

### P0 — Critical (breaks financial statements)
- [x] Fix payroll ledger entry sign (BUG-1) — `ledger-posting.service.ts` rewritten: effectiveGross + SSF Expense + Tax Payable
- [x] Add purchase payment ledger posting (BUG-2) — `postPaymentMade()` added; called from `purchase.service.impl.ts`
- [x] Fix sales VAT ledger entry (BUG-3) — Sales Revenue now credited with `netTaxable` (subtotal − discounts + labor)
- [x] Add debit/credit validation in LedgerEntry (BUG-4) — validation + auto-posted entry protection in `ledger-entry.service.impl.ts`
- [x] Implement Dashain bonus in payroll engine (BUG-5) — month-match logic + `isDashainBonus` field saved in `payroll.engine.ts`
- [x] Fix BS/AD fiscal year conversion (BUG-6) — all `±57` replaced with `adToBs()` / `bsToAd()` across all services

### P1 — High (data is lost or wrong)
- [ ] Implement RolesGuard and annotate all endpoints with required roles
- [ ] Fix registration: first user = ADMIN, invited users get assigned role
- [ ] Build user invite endpoint (`POST /api/v1/users/invite`) — ADMIN only
- [ ] Build role change endpoint (`PATCH /api/v1/users/:id/role`) — ADMIN only
- [ ] Credit note and debit note GL posting
- [x] `postPayroll()` called after marking payroll PAID — `markAsPaid()` in `payroll.engine.ts` now calls `ledgerPosting.postPayroll()`
- [x] Leave reallocation must not reset `usedDays` — `allocateLeave()` in `leave.service.impl.ts` now preserves `usedDays`
- [x] Protect `isSystem` ledger accounts from deletion — `ledger-account.service.impl.ts` now blocks update/delete on system accounts
- [ ] Fix cascade delete or add soft delete for Employee, Client, Vendor

### P2 — Medium (features incomplete)
- [ ] Cheque clearing GL posting
- [ ] Petty cash GL posting
- [ ] Quotation → Sales Order conversion
- [ ] Invoice sequence reset per fiscal year
- [ ] Dashboard endpoints (see Section 8)
- [x] Married PIT slabs in payroll — `calculateMonthlyPIT()` now accepts `isMarried` and applies Rs 600,000 first slab for married employees

### P3 — Low (nice to have)
- [ ] Email verification on registration
- [ ] Rate limiting on login
- [ ] Inventory adjustment log
- [ ] Leave carryover at year-end
- [ ] Gratuity accrual
- [ ] Bank guarantee contingent liability tracking
