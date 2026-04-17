# Easy Books — Business Logic Review Document
**Purpose:** Review all system features against real Nepal business practices  
**Instructions for reviewer:** Read each section. In the "Real World Feedback" field, type your correction or write "CORRECT" if it matches real practice.

---

# HOW TO USE THIS DOCUMENT
1. Each service has: What it does → Our System Logic → Real World Feedback (you fill this)
2. If our logic is wrong → describe the correct Nepal business logic in the feedback field
3. If our logic is correct → just write "CORRECT ✓"
4. Priority: Mark any critical issue as ⚠️ CRITICAL

---

---

# 1. AUTHENTICATION & USER MANAGEMENT

## 1.1 Register (New Company Setup)
**API:** POST /api/v1/auth/register

**What it does:**  
Creates a new user account AND a new company at the same time. The first person to register becomes the Admin of that company.

**Our System Logic:**
- User provides: Full Name, Email, Password, Company Name
- System creates the Company first, then creates the User linked to that Company
- User role is set to ADMIN automatically
- System returns a login token (JWT) — user is immediately logged in after registration
- No email verification required (can be added later)

**Real World Feedback (reviewer fills here):**
> _[Type your feedback here. Example: In Nepal, a company must provide PAN/VAT number at registration. Should we make PAN/VAT required?]_

---

## 1.2 Login
**API:** POST /api/v1/auth/login

**What it does:**  
Logs in an existing user using email and password.

**Our System Logic:**
- User provides email + password
- System checks if email exists
- System verifies password
- Issues two tokens: Access Token (valid 15 minutes) + Refresh Token (valid 7 days)
- Tokens are stored in secure browser cookies (not visible to JavaScript — prevents hacking)
- If user is inactive for 7 days, they must log in again

**Real World Feedback (reviewer fills here):**
> _[Type your feedback here]_

---

## 1.3 Logout
**API:** POST /api/v1/auth/logout

**What it does:**  
Logs the user out and clears all login tokens from the browser.

**Real World Feedback (reviewer fills here):**
> _[Type your feedback here]_

---

---

# 2. COMPANY MANAGEMENT

## 2.1 Company Profile
**API:** GET/PUT /api/v1/companies/:id

**What it does:**  
Stores and manages the company's basic information. This information appears on all invoices and documents.

**Our System Logic:**
- Company fields: Name, Address, Phone, Email, PAN/VAT Number, Logo, Currency (NPR), Fiscal Year Start
- Currency defaults to NPR (Nepali Rupee)
- Multiple users can belong to the same company
- All data (inventory, sales, etc.) is linked to the company — companies cannot see each other's data

**Our Assumption on Fiscal Year:**
- We store the fiscal year start date but do not auto-close books at year end
- Reports can be filtered by date range manually

**Real World Feedback (reviewer fills here):**
> _[Does Nepal fiscal year (Shrawan 1 to Ashadh 31, i.e., mid-July to mid-July) affect how we should handle year-end reporting? Should the system auto-lock entries from the previous year?]_

---

---

# 3. INVENTORY MANAGEMENT

## 3.1 Add Inventory Item
**API:** POST /api/v1/inventory

**What it does:**  
Adds a new product or item to the stock list.

**Our System Logic:**
- Fields: Brand, Model Number, Description, Application/Use, Image, Quantity, Unit, Purchase Price, Selling Price, Storage Location, Low Stock Threshold, Supplier Name
- Units supported: Piece (PCS), Set, Liter, ML, Kilogram (KG), Gram (GM), NOS (Number of Sets)
- When quantity falls below the Low Stock Threshold → system flags it as "Low Stock"

**Our Assumption on Costing:**
- We store a fixed unit purchase price per item
- We do NOT currently calculate weighted average cost (WAC) automatically when new stock arrives at a different price
- Example: 10 items bought at Rs. 100, then 5 more at Rs. 120 — the system shows Rs. 120 as purchase price (last entered), not the average

**Real World Feedback (reviewer fills here):**
> _[Is weighted average costing important for your business? Or do you use FIFO (First In, First Out)? In Nepal, what is the standard for valuing stock?]_

---

## 3.2 Update Stock Quantity
**API:** PUT /api/v1/inventory/:id

**What it does:**  
Updates the quantity and price of an existing inventory item.

**Our System Logic:**
- Stock quantity must be manually updated
- System does NOT auto-deduct stock when a Sales Order is created (not linked yet)
- System does NOT auto-increase stock when a Purchase Order is created (not linked yet)
- This is a planned feature for Phase 2

**Real World Feedback (reviewer fills here):**
> _[Is auto stock deduction on sale critical for your first launch? Or is manual stock update acceptable initially?]_

---

## 3.3 Low Stock Alert
**What it does:**  
Shows which items are running low based on the threshold set.

**Our System Logic:**
- Dashboard shows items where: Current Quantity ≤ Low Stock Threshold
- No automatic SMS or email notification yet (planned for Phase 2)

**Real World Feedback (reviewer fills here):**
> _[Type your feedback here]_

---

---

# 4. SALES ORDERS (INVOICE / BILL)

## 4.1 Create Sales Invoice
**API:** POST /api/v1/sales

**What it does:**  
Creates a sales invoice for a customer. Can be with or without VAT.

**Our System Logic — Calculation:**

```
Step 1: Add all items
  Item Total = Quantity × Unit Selling Price

Step 2: Add all items together
  Subtotal = Sum of all Item Totals

Step 3: Add Labor Charges (if any)
  Taxable Amount = Subtotal + Labor Charges

Step 4: Apply VAT (if VAT bill)
  VAT Amount = Taxable Amount × 13%
  Total Amount = Taxable Amount + VAT Amount

Step 5: Without VAT
  Total Amount = Subtotal + Labor Charges
```

**Example:**
```
Item 1: Engine Oil × 5 liters × Rs. 500 = Rs. 2,500
Item 2: Oil Filter × 1 piece × Rs. 300 = Rs. 300
Subtotal = Rs. 2,800
Labor Charges = Rs. 200
Taxable Amount = Rs. 3,000
VAT (13%) = Rs. 390
TOTAL = Rs. 3,390
```

**Invoice Fields:**
- Invoice Number (manual entry — system does not auto-generate sequence yet)
- Client Name, Contact, Address
- Date (AD and BS)
- Items list
- Labor Charges
- Is VAT Bill? (Yes/No toggle)
- Status: Pending / Confirmed / Completed / Cancelled

**Our Assumption:**
- VAT rate is fixed at 13% (Nepal standard)
- Discount per item is NOT currently supported
- Invoice number must be entered manually (no auto-sequence like INV-0001)

**Real World Feedback (reviewer fills here):**
> _[Is 13% VAT correct for all your products/services? Some items in Nepal have different VAT rates or are VAT exempt. Please list any items you sell that are NOT 13% VAT.]_
> _[Should the system auto-generate invoice numbers? What format? Example: INV-2081-001?]_
> _[Do you give discounts per item or overall discount on invoice?]_

---

## 4.2 Invoice Status Flow
**What it does:**  
Tracks where the invoice is in its lifecycle.

**Our System Logic:**
```
PENDING → CONFIRMED → COMPLETED
                    → CANCELLED
```
- PENDING: Invoice created but not confirmed with customer
- CONFIRMED: Customer has agreed
- COMPLETED: Payment received / work done
- CANCELLED: Invoice cancelled

**Real World Feedback (reviewer fills here):**
> _[Is this status flow correct for Nepal? Some businesses use: Draft → Sent → Partially Paid → Paid. Do you need a PARTIALLY PAID status?]_

---

---

# 5. PURCHASE ORDERS

## 5.1 Create Purchase Order
**API:** POST /api/v1/purchases

**What it does:**  
Records a purchase from a vendor/supplier. Used for tracking what you bought and from whom.

**Our System Logic — Calculation:**
- Identical to Sales Invoice calculation
- Uses Vendor instead of Client
- Order Number instead of Invoice Number
- VAT calculation same: 13% if VAT purchase

**Real World Feedback (reviewer fills here):**
> _[When you receive goods from a supplier, do you always get a VAT bill? Or do small suppliers give cash bills (non-VAT)? How do you record both?]_

---

---

# 6. CLIENTS (CUSTOMERS)

## 6.1 Client Management
**API:** GET/POST/PUT/DELETE /api/v1/clients

**What it does:**  
Maintains a list of all your customers with their contact details.

**Our System Logic:**
- Fields: Name, Contact Person, Email, Phone, Address, Status (Active/Inactive/Prospect), Notes
- CRM Status:
  - ACTIVE: Current paying customer
  - INACTIVE: Past customer, not currently buying
  - PROSPECT: Potential customer, not yet bought

**Real World Feedback (reviewer fills here):**
> _[In Nepal business, clients often have PAN numbers for B2B transactions. Should we add a PAN/VAT field for clients?]_

---

---

# 7. VENDORS (SUPPLIERS)

## 7.1 Vendor Management
**API:** GET/POST/PUT/DELETE /api/v1/vendors

**What it does:**  
Maintains a list of all your suppliers with their contact and bank details.

**Our System Logic:**
- Fields: Name, Contact Person, Email, Phone, Address, Bank Details, Notes
- Bank Details field: stored as text (bank name, account number, branch)

**Real World Feedback (reviewer fills here):**
> _[Should vendors have PAN/VAT numbers for record keeping? Do you need to track vendor payment terms (e.g., 30 days credit)?]_

---

---

# 8. EMPLOYEES

## 8.1 Employee Records
**API:** GET/POST/PUT/DELETE /api/v1/employees

**What it does:**  
Maintains the HR database of all employees.

**Our System Logic:**
- Fields: Name, Employee ID, Department, Designation, Phone, Email, Address, Date of Joining, Monthly Salary, Status
- Status: ACTIVE / INACTIVE / ON_LEAVE
- Salary stored as monthly gross salary (before deductions)

**Our Assumption:**
- We store one salary figure — the monthly gross (total salary before any deductions)
- We do NOT currently break salary into: Basic + Allowances + Bonus

**Real World Feedback (reviewer fills here):**
> _[In Nepal, salary is often broken into: Basic Salary + Dearness Allowance + Grade + Other Allowances. Should we store these separately?]_
> _[Do you need to track Employee PAN number for tax purposes (PIT - Personal Income Tax)?]_

---

---

# 9. ATTENDANCE

## 9.1 Daily Attendance
**API:** GET/POST/PUT /api/v1/attendance

**What it does:**  
Records daily attendance for each employee.

**Our System Logic:**
- Fields: Employee, Date, Status, Check-In Time, Check-Out Time, Notes
- Attendance Status options:
  - PRESENT: Full day worked
  - ABSENT: Did not come
  - HALF_DAY: Worked half day (used in payroll calculation)
  - LEAVE: On approved leave
  - HOLIDAY: Public holiday (not counted as absent)

**Our Assumption:**
- Attendance is entered manually — no biometric integration
- One attendance record per employee per day

**Real World Feedback (reviewer fills here):**
> _[Do you have public holidays or Dashain/Tihar/other festival leave that should be pre-loaded into the calendar? How do you handle festival advance/bonus?]_
> _[In Nepal, some companies give Casual Leave (CL), Sick Leave (SL), Earned Leave (EL). Should we add leave types?]_

---

---

# 10. PAYROLL

## 10.1 Payroll Calculation Engine
**API:** POST /api/v1/payroll/process

**What it does:**  
Automatically calculates the salary for all active employees for a given month, based on their attendance.

**Our System Logic — Calculation:**

```
Step 1: Get employee's monthly gross salary
  e.g., Rs. 25,000

Step 2: Calculate working days in the month
  e.g., October 2081 = 31 days

Step 3: Calculate per-day salary
  Per Day = Monthly Salary ÷ Working Days
  Per Day = 25,000 ÷ 31 = Rs. 806.45

Step 4: Count attendance
  Present Days = days marked PRESENT + days marked HALF_DAY
  Absent Days = Working Days - Present Days
  Half Days = days marked HALF_DAY

Step 5: Calculate deductions
  Absent Deduction = Absent Days × Per Day Salary
  Half Day Deduction = Half Days × (Per Day Salary × 0.5)
  Total Deductions = Absent Deduction + Half Day Deduction

Step 6: Calculate net salary
  Net Salary = Monthly Salary - Total Deductions
```

**Example:**
```
Employee: Ram Bahadur
Monthly Salary: Rs. 25,000
Working Days in Month: 26 (excluding Saturdays)
Per Day Salary: Rs. 961.54

Attendance:
  Present: 22 days
  Half Day: 1 day
  Absent: 3 days
  Leave (paid): 0 days
  Holiday: 0 days

Deductions:
  Absent: 3 × 961.54 = Rs. 2,884.62
  Half Day: 1 × (961.54 × 0.5) = Rs. 480.77
  Total Deductions: Rs. 3,365.39

Net Salary = 25,000 - 3,365.39 = Rs. 21,634.61
```

**Our Assumptions:**
- LEAVE days are counted as ABSENT (deducted) — we do not yet separate paid leave from unpaid leave
- HOLIDAY days are NOT deducted
- No PF (Provident Fund), SSF (Social Security Fund), CIT (Citizen Investment Trust) deductions are calculated
- No Income Tax (PIT) deduction calculated
- No festival bonus (Dashain bonus, etc.) calculated

**Real World Feedback (reviewer fills here):**
> _[CRITICAL: In Nepal, many companies are registered with SSF (Social Security Fund). Employee contributes 11% and employer contributes 20% of basic salary. Should we include SSF calculation?]_
> _[CRITICAL: What is the standard for paid leave in your company? If an employee takes 15 days leave, is it fully paid, partially paid, or deducted?]_
> _[Do you give Dashain bonus (equivalent to one month salary)? When and how is it calculated?]_
> _[Do you deduct Personal Income Tax (PIT) from salary? Nepal has PIT slabs. Should we calculate this automatically?]_

---

## 10.2 View Payroll Summary
**API:** GET /api/v1/payroll?month=2081-07

**What it does:**  
Shows the payroll summary for all employees for a specific month.

**Output includes:**
- Each employee's: Gross Salary, Total Deductions, Net Amount
- Month totals: Total Gross, Total Deductions, Total Net
- Payroll status: PENDING → PROCESSED → PAID

**Real World Feedback (reviewer fills here):**
> _[Type your feedback here]_

---

---

# 11. LEDGER (ACCOUNTING)

## 11.1 Chart of Accounts
**API:** GET/POST/PUT /api/v1/ledger/accounts

**What it does:**  
Maintains the list of all accounts used in your bookkeeping (double-entry accounting system).

**Our System Logic:**
- Account Types:
  - ASSET: Things you own (cash, equipment, receivables)
  - LIABILITY: Things you owe (loans, payables)
  - EQUITY: Owner's capital
  - SALES: Revenue from selling products/services
  - PURCHASE: Cost of goods purchased
  - EXPENSE: Operating costs (rent, utilities, salaries)

- Each account has: Opening Balance + Current Balance
- Current Balance auto-updates when ledger entries are posted

**Real World Feedback (reviewer fills here):**
> _[In Nepal, do you use standard account names? For example, under Assets: Cash in Hand, Cash at Bank, Accounts Receivable, Stock/Inventory. Please list the accounts you commonly use so we can pre-load them.]_

---

## 11.2 Ledger Entries (Double-Entry Bookkeeping)
**API:** POST /api/v1/ledger/entries

**What it does:**  
Records every financial transaction using the double-entry method — every entry has a Debit and Credit side.

**Our System Logic:**
- Rule: Every transaction affects at least two accounts
- Debit = Credit always (this is the fundamental accounting rule)
- Entry fields: Account, Date (AD + BS), Description, Debit Amount, Credit Amount, Reference

**Example — Recording a Cash Sale:**
```
Sales Revenue Account  →  CREDIT Rs. 5,000 (income increases credit side)
Cash Account           →  DEBIT  Rs. 5,000 (asset increases debit side)
```

**Auto-Posting Logic:**
- When a Sales Order is marked COMPLETED → system auto-creates a ledger entry crediting Sales Revenue
- When a Purchase Order is marked COMPLETED → system auto-creates a ledger entry debiting Purchase Expenses
- Manual entries can also be created directly

**Real World Feedback (reviewer fills here):**
> _[Is double-entry bookkeeping used in your business? Or does your accountant use a simpler cash book + purchase/sales register format? In Nepal, many small businesses do not use formal double-entry. Please clarify what method your target customers use.]_

---

---

# 12. TRANSACTIONS (CASH BOOK)

## 12.1 Record a Transaction
**API:** POST /api/v1/transactions

**What it does:**  
Records day-to-day money movements — cash received, cash paid, bank transfers, QR payments, cheque payments.

**Our System Logic:**
- Transaction Type:
  - CASH: Physical cash in hand
  - BANK: Transfer via bank
  - QR: Digital payment via QR (eSewa, Khalti, etc.)
  - CHEQUE: Payment by cheque

- Transaction Category:
  - INCOME: Money coming in
  - EXPENSE: Money going out
  - TRANSFER: Moving money between accounts (e.g., cash to bank)

- Status: PENDING / COMPLETED / CANCELLED

**Example Transactions:**
```
Date: 2081-07-15 (AD: 2024-11-01)
Type: CASH
Category: INCOME
Amount: Rs. 15,000
Description: Cash received from customer Bikash Shrestha for invoice #INV-001
```

```
Date: 2081-07-15
Type: QR
Category: EXPENSE
Amount: Rs. 5,500
Description: Paid via eSewa for office supplies
```

**Our Assumption:**
- Transactions are NOT automatically linked to Sales/Purchase orders (planned for Phase 2)
- No auto bank reconciliation

**Real World Feedback (reviewer fills here):**
> _[In Nepal, QR payments go through eSewa, Khalti, IME Pay, Connectips. Should we track which QR platform was used? Do you need reconciliation with your bank statements?]_
> _[Do you issue receipts for cash transactions? Should the system generate a cash receipt/payment voucher?]_

---

---

# 13. QUOTATIONS

## 13.1 Create a Quotation
**API:** POST /api/v1/quotations

**What it does:**  
Creates a formal price quotation for a customer before they confirm the order.

**Our System Logic:**
- Fields: Client Name, Date (AD + BS), Quotation Number, Items List, Description/Notes, Total Amount
- Quotation Status (Remark):
  - QUOTED: Quotation sent to customer, waiting for response
  - WORK_DONE: Work has been completed for this quotation
  - REVISED: Quotation was updated with new prices/items
  - BILLED: Converted to invoice (Sales Order created)
  - CANCELLED: Customer rejected the quote

**Quotation Flow:**
```
QUOTED → WORK_DONE → BILLED (converted to invoice)
       → REVISED (new quotation sent)
       → CANCELLED
```

**Our Assumption:**
- No auto-conversion from Quotation to Invoice yet (manual)
- No expiry date on quotations
- No approval workflow

**Real World Feedback (reviewer fills here):**
> _[In your business, do quotations expire after a certain period? Nepal suppliers often write "Quote valid for 7 days" or "Quote valid for 30 days". Should we add a validity period?]_
> _[When a quotation is accepted, do you want one click to convert it directly to a Sales Invoice?]_

---

---

# 14. BANK ACCOUNTS

## 14.1 Bank Account Management
**API:** GET/POST/PUT/DELETE /api/v1/bank-accounts

**What it does:**  
Maintains records of all company bank accounts for reference and balance tracking.

**Our System Logic:**
- Fields: Bank Name, Account Number, Account Type (Current/Savings), Branch, Current Balance, Bank Portal URL
- Balance is manually maintained — no live bank feed
- Multiple bank accounts per company supported

**Our Assumption:**
- No integration with actual bank systems (NIC Asia, Global IME, Nabil, etc.)
- Balance must be manually updated after transactions

**Real World Feedback (reviewer fills here):**
> _[In Nepal, most businesses have current accounts. Do you need to track: Cheque Book details, Bank Guarantee details, Loan accounts separately?]_
> _[Should the system generate a Bank Reconciliation Statement — comparing our recorded transactions with the bank statement?]_

---

---

# 15. MEMO / INTERNAL DOCUMENTS

## 15.1 Memo Documents
**API:** GET/POST/PUT/DELETE /api/v1/memos

**What it does:**  
Creates and stores internal documents, letters, notes, and any other written records.

**Our System Logic:**
- Fields: Title, Content (rich text), Date (AD + BS), Document Type, Attachments (file list)
- Document Type: Free text (user defines — e.g., "Internal Memo", "Circular", "Notice", "Agreement")
- Attachments stored as file URL references
- No approval workflow or signature

**What the Memo feature is NOT:**
- Not a legal document system
- Not an e-signature platform
- Just a simple document store

**Real World Feedback (reviewer fills here):**
> _[What types of internal documents does your business create? Examples: Staff Notice, Supplier Agreement, Warranty Letter, Work Order. Should we add pre-defined document templates for common Nepal business documents?]_

---

---

# 16. TASKS

## 16.1 Task Management
**API:** GET/POST/PUT/DELETE /api/v1/tasks

**What it does:**  
Creates and tracks internal tasks and to-do items for the team.

**Our System Logic:**
- Fields: Title, Description, Assigned To (free text — name of person), Due Date, Priority, Status, Notes
- Priority: LOW / MEDIUM / HIGH
- Status: PENDING → IN_PROGRESS → COMPLETED / CANCELLED
- No notifications sent when a task is assigned (planned for Phase 2)
- Assigned To is a free text field — not linked to employee records

**Real World Feedback (reviewer fills here):**
> _[Is task management useful for your team? Or is this a low-priority feature for the first launch?]_

---

---

# 17. CALCULATOR (Frontend Tool)

## 17.1 Built-in Calculator
**What it does:**  
A standard calculator built into the app interface for quick calculations.

**Our System Logic:**
- Basic arithmetic: addition, subtraction, multiplication, division
- This is a UI-only tool — no backend API
- No VAT calculation built into the calculator (the VAT is calculated automatically in Sales/Purchase orders)

**Real World Feedback (reviewer fills here):**
> _[Should the calculator have a VAT mode? E.g., enter an amount and it shows the VAT-inclusive total automatically? Or a reverse VAT calculator (enter total, get pre-VAT amount)?]_

---

---

# 18. CURRENCY CONVERTER (Frontend Tool)

## 18.1 Currency Conversion
**What it does:**  
Converts between NPR and other currencies for reference purposes.

**Our System Logic:**
- UI-only tool
- Exchange rates are fetched from an external API (or hardcoded as fallback)
- Results are for reference only — not used in any transaction or invoice

**Our Assumption:**
- All invoices and transactions in the system use NPR only
- Currency converter is just an informational utility

**Real World Feedback (reviewer fills here):**
> _[Do you do business in foreign currencies? Do you need to raise USD or INR invoices? Should exchange rates be recorded when converting transactions?]_

---

---

# 19. CALENDAR (Frontend Tool)

## 19.1 Calendar View
**What it does:**  
Shows a calendar view. Currently displays date in Nepali Bikram Sambat (BS) format.

**Our System Logic:**
- Visual calendar showing current month
- Can navigate between months
- Planned: Show tasks, payment due dates, attendance on the calendar

**Real World Feedback (reviewer fills here):**
> _[Should the calendar show: Nepali public holidays? Payment due dates? Task deadlines? Payroll dates? What would be most useful?]_

---

---

# 20. DASHBOARD

## 20.1 Dashboard Overview
**API:** Multiple APIs called together

**What it does:**  
The first screen users see. Shows a quick overview of the business health.

**Our System Logic — Dashboard Cards:**
- Total Inventory Items and total stock value
- Recent Sales Orders (last 20)
- Recent Purchase Orders (last 20)
- Recent Transactions (last 20)
- Quotations summary
- Bank Accounts and balances
- Low Stock alerts

**Dashboard Charts:**
- Sales chart (bar graph — sales per month)
- Expense chart

**Our Assumption:**
- No real-time data — refreshes when page loads
- No profit/loss calculation on dashboard yet (planned)

**Real World Feedback (reviewer fills here):**
> _[What are the most important numbers you want to see immediately when you open the app? Examples: Today's cash in hand, This month's total sales, Outstanding receivables (who owes you money), Outstanding payables (who you owe money), Net profit this month]_

---

---

# NEPALI DATE (BS) — THROUGHOUT THE SYSTEM

**What it does:**  
Every date in the system supports both AD (English) and BS (Nepali Bikram Sambat) dates simultaneously.

**Our System Logic:**
- User enters a date in AD → system auto-converts to BS
- Both dates are stored and shown
- Conversion table covers years 2000 BS to 2016 BS (1943 AD to 2060 AD)

**Real World Feedback (reviewer fills here):**
> _[Is it sufficient to show both dates, or do all documents (invoices, receipts, memos) need to show ONLY the BS date? In Nepal, official documents use BS date. Should invoices print BS date by default?]_

---

---

# VAT SYSTEM — SUMMARY

**Nepal VAT Rules in Our System:**

| Item | Our Implementation |
|---|---|
| Standard VAT Rate | 13% |
| VAT on Sales | Calculated on Subtotal + Labor Charges |
| VAT on Purchases | Calculated on Subtotal + Labor Charges |
| VAT Invoice | Toggle on/off per invoice |
| VAT Report | Not yet implemented (Phase 2) |
| IRD Filing | Not yet integrated (Phase 2) |

**Real World Feedback (reviewer fills here):**
> _[CRITICAL: Which products/services you sell are VAT exempt in Nepal? Which are 0% rated? This is important for correct VAT billing.]_
> _[Do you need the system to generate a VAT report for IRD (Inland Revenue Department) submission? What format does IRD accept?]_

---

---

# FEATURES NOT YET BUILT (Phase 2 Roadmap)

Please mark priority for each:

| Feature | Description | Priority (reviewer marks: HIGH / MEDIUM / LOW / NOT NEEDED) |
|---|---|---|
| Auto stock deduction on sale | When invoice created, inventory reduces automatically | |
| Auto stock increase on purchase | When purchase order created, stock increases | |
| Email notifications | Send invoice to customer via email | |
| SMS notifications | Send payment reminders via SMS | |
| PDF invoice generation | Professional PDF invoice to share/print | |
| SSF / PF payroll deduction | Nepal SSF and PF auto calculation | |
| Personal Income Tax (PIT) | Auto calculate PIT from salary | |
| IRD VAT report | Monthly VAT report for tax office | |
| Role-based access | Different access for Admin, Accountant, Staff | |
| Profit & Loss Report | Monthly P&L statement | |
| Balance Sheet | Assets vs Liabilities report | |
| Bank Reconciliation | Match transactions with bank statement | |
| Dashain Bonus | Auto calculate festival bonus | |
| Multi-branch | Support multiple store/office locations | |
| Customer outstanding | Track who owes you money | |
| Vendor outstanding | Track who you owe money to | |
| Cheque management | Track issued and received cheques | |
| Barcode/QR scanning | Scan product barcode for inventory | |

---

---

# REVIEWER SIGN-OFF

**Reviewed by:** _________________________  
**Date:** _________________________  
**Overall comments:**  
> _[Type overall comments here]_

**Top 3 critical issues to fix before launch:**
1. _[Write here]_
2. _[Write here]_
3. _[Write here]_

---

*Document prepared by Easy Books technical team — April 2026*
