# Easy Books Nepal — Pricing & Tier Model

## Tier Names

| Tier | English | Nepali | Target Customer |
|------|---------|--------|-----------------|
| Free | **Free** | सुरु (Suru) | Solo owner, first-time user, trying out |
| Mid | **Pro** | व्यापार (Byapar) | Small business with staff and accountant |
| Top | **Business** | उन्नति (Unnati) | Growing business, multi-branch, CA firm |

---

## Pricing (Nepal Market)

| Plan | Monthly | Annual | Annual Savings |
|------|---------|--------|----------------|
| **Free** | NPR 0 | NPR 0 | — |
| **Pro** | NPR 799 / mo | NPR 7,990 / yr | ~NPR 1,598 (2 months free) |
| **Business** | NPR 1,999 / mo | NPR 19,990 / yr | ~NPR 3,998 (2 months free) |

> USD reference (1 USD ≈ 134 NPR): Pro ~$6/mo · Business ~$15/mo

---

## Feature Matrix

### Access & Users

| Feature | Free | Pro | Business |
|---------|------|-----|----------|
| Companies | 1 | 1 | Up to 3 |
| Users per company | 1 (owner only) | Up to 5 | Unlimited |
| Roles (Admin, Accountant, Staff) | Admin only | All roles | All roles |
| User invite via email | — | ✓ | ✓ |

### Sales & Purchases

| Feature | Free | Pro | Business |
|---------|------|-----|----------|
| Sales invoices | 20 / month | Unlimited | Unlimited |
| Purchase bills | 20 / month | Unlimited | Unlimited |
| Payments (record against invoices) | — | ✓ | ✓ |
| Quotations | — | ✓ | ✓ |
| Convert quotation → invoice | — | ✓ | ✓ |
| Credit notes | — | — | ✓ |
| Debit notes | — | — | ✓ |

### Inventory

| Feature | Free | Pro | Business |
|---------|------|-----|----------|
| Inventory items | 50 items | Unlimited | Unlimited |
| Stock adjustments | — | ✓ | ✓ |
| Low stock alerts | — | ✓ | ✓ |

### Clients & Vendors

| Feature | Free | Pro | Business |
|---------|------|-----|----------|
| Clients | 25 | Unlimited | Unlimited |
| Vendors | 25 | Unlimited | Unlimited |

### HR & Payroll

| Feature | Free | Pro | Business |
|---------|------|-----|----------|
| Employees | — | Up to 15 | Unlimited |
| Attendance tracking | — | ✓ | ✓ |
| Leave management | — | ✓ | ✓ |
| Payroll processing | — | ✓ | ✓ |
| Gratuity calculator | — | ✓ | ✓ |

### Accounting & Finance

| Feature | Free | Pro | Business |
|---------|------|-----|----------|
| Bank accounts | — | Up to 3 | Unlimited |
| Transaction ledger (cash/bank/QR) | — | ✓ | ✓ |
| Ledger accounts (chart of accounts) | — | — | ✓ |
| Ledger entries (double-entry) | — | — | ✓ |
| Hidden/confidential accounts | — | — | ✓ |
| Cheque management | — | — | ✓ |
| Bank guarantees | — | — | ✓ |
| Petty cash book | — | — | ✓ |

### Reports & Export

| Feature | Free | Pro | Business |
|---------|------|-----|----------|
| Dashboard (sales trend, alerts) | Basic | Full | Full |
| VAT summary report | — | ✓ | ✓ |
| HR summary | — | ✓ | ✓ |
| PDF invoice export | — | ✓ | ✓ |
| Excel/CSV data export | — | — | ✓ |
| Advanced analytics | — | — | ✓ |

### Productivity

| Feature | Free | Pro | Business |
|---------|------|-----|----------|
| Memos | 10 | Unlimited | Unlimited |
| Tasks | 10 | Unlimited | Unlimited |
| File uploads | — | ✓ | ✓ |

### Data Safety

| Feature | Free | Pro | Business |
|---------|------|-----|----------|
| Recycle bin | — | 30-day | 90-day |
| Auto-delete timer | — | ✓ | ✓ |
| Admin password gate | — | ✓ | ✓ |

### Support

| Feature | Free | Pro | Business |
|---------|------|-----|----------|
| Support channel | Community (Facebook group) | Email (72h response) | Priority email (24h response) |
| Onboarding help | — | — | ✓ (1 video call) |

---

## Nepal Market Context

### Why these prices work

| Segment | Monthly Revenue (est.) | Can afford | Recommended plan |
|---------|------------------------|------------|-----------------|
| Kirana / Tea shop / Solo | NPR 30,000 – 150,000 | NPR 0–500 | Free |
| Pharmacy / Electronics / Retail | NPR 150,000 – 800,000 | NPR 500–2,000 | Pro |
| Restaurant chain / Distributor / Services firm | NPR 800,000+ | NPR 2,000–8,000 | Business |
| CA firm (managing multiple clients) | — | NPR 2,000–6,000 | Business (3 companies) |

### Competitor landscape

| Competitor | Price | Notes |
|------------|-------|-------|
| Tally ERP (pirated) | NPR 0 | Widespread illegal use — biggest competitor |
| Tally ERP (official) | ~NPR 18,000 one-time | One-time purchase, no cloud, complex |
| Hamro Hisab | NPR 500–1,500/mo | Basic, limited features |
| BizCase | NPR 800–2,500/mo | More complete but dated UI |
| Excel / paper | NPR 0 | Default for most small businesses |

**EasyBooks advantage:** Cloud-based, modern UI, Nepali tax-aware (VAT 13%), bilingual-ready, payroll + inventory + accounting in one platform, at a price between Tally and manual spreadsheets.

### Conversion strategy

1. **Free → Pro trigger points:** User hits 20 invoices/month, or wants to add a second staff user, or needs payroll
2. **Pro → Business trigger points:** Second branch/company, needs ledger for audits, CA firm use case
3. **Annual billing discount:** Offer 2 months free on annual — reduces churn, improves cash flow

---

## Implementation Notes (for gating in code)

When you're ready to enforce limits, the plan can be stored on the `Company` model:

```prisma
model Company {
  // ... existing fields
  plan         CompanyPlan @default(FREE)
  planExpiresAt DateTime?
}

enum CompanyPlan {
  FREE
  PRO
  BUSINESS
}
```

Then each service checks the plan before allowing the operation:

```typescript
// Example: gate invoice creation at 20/month for FREE
const count = await prisma.salesOrder.count({
  where: { companyId, createdAt: { gte: startOfMonth() } }
});
if (company.plan === 'FREE' && count >= 20) {
  throw new ForbiddenException('Free plan limit reached. Upgrade to Pro for unlimited invoices.');
}
```

The frontend shows an upgrade prompt instead of an error when possible.

---

*Last updated: 2026-05-23*
