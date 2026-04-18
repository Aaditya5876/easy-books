# Easy Books — Partner Questionnaire
**Purpose:** Understand real Nepal business practices to build the software correctly
**Instructions:** Read each question. Answer in as much detail as possible. If you don't know, write "Don't know" — that is also useful.

---

# SESSION 1: SALES & INVOICING

## How a Sale Happens

---

**Q1. Walk me through a complete sale from start to finish.**
> Example: Customer walks in → you check stock → you quote a price → customer agrees → you make the bill → customer pays → you give a receipt. Is this how it works? What is different in your case?

**Why we ask:** We need to build the exact flow in the software — if we miss a step, the software won't match reality.

**Partner's Answer:**
> _[Write here]_

---

**Q2. Do you give a quotation (estimate) before making the final bill?**
> Or do you directly make the bill?

**Why we ask:** We have a Quotation feature — we need to know if it's used before or after the sale.

**Partner's Answer:**
> _[Write here]_

---

**Q3. How is your invoice/bill numbered?**
> Examples:
> - Manual: You write INV-001, INV-002 yourself
> - By year: INV-2081-001 (reset every fiscal year)
> - By date: INV-20811015-001
> - Something else?

**Why we ask:** The system needs to generate invoice numbers in the correct format.

**Partner's Answer:**
> _[Write here]_

---

**Q4. Do you give discounts? If yes, how?**
> - Discount on each item separately (e.g., 10% off on oil filter)
> - Discount on the total bill at the end (e.g., Rs. 500 off the total)
> - Both?

**Why we ask:** We need to add a discount field in the right place on the invoice.

**Partner's Answer:**
> _[Write here]_

---

**Q5. Do you give VAT bills to all customers? Or only some?**
> - All customers get VAT bills
> - Only businesses (B2B) get VAT bills
> - Only when the customer asks
> - Never — you are not VAT registered

**Why we ask:** The VAT toggle on the invoice must match how you actually use it.

**Partner's Answer:**
> _[Write here]_

---

**Q6. What items or services do you sell that are NOT 13% VAT?**
> In Nepal, some goods are VAT exempt or zero-rated. Examples: basic food items, medicines, agricultural products.

**Why we ask:** If some items are 0% VAT, the system must handle mixed VAT on one invoice.

**Partner's Answer:**
> _[Write here]_

---

**Q7. How does the customer pay you?**
> Tick all that apply:
> - Cash
> - Bank transfer (online banking)
> - Cheque
> - QR code (eSewa / Khalti / IME Pay / Connectips)
> - Credit (they pay later — you give them credit)
> - Part payment (some now, some later)

**Why we ask:** We need to build all payment methods the system tracks.

**Partner's Answer:**
> _[Write here]_

---

**Q8. If a customer pays partially (not full amount), how do you record it?**
> Example: Bill is Rs. 50,000. Customer pays Rs. 30,000 today and promises Rs. 20,000 next week.
> - Do you record Rs. 30,000 received and mark the bill as "partially paid"?
> - Do you wait until full payment to record anything?
> - Something else?

**Why we ask:** We need a "partial payment" or "outstanding balance" feature if this is common.

**Partner's Answer:**
> _[Write here]_

---

**Q9. Do you track which customers owe you money (outstanding receivables)?**
> If yes, how do you currently track it? (Excel, notebook, memory, etc.)

**Why we ask:** This is a major feature — Accounts Receivable. We need to build it if it's important.

**Partner's Answer:**
> _[Write here]_

---

**Q10. What happens when a customer returns a product?**
> - Do you give a refund?
> - Do you give a credit note (they can use it for next purchase)?
> - Do you issue a new invoice?

**Why we ask:** Returns and refunds need a separate flow in the system (credit notes / return invoices).

**Partner's Answer:**
> _[Write here]_

---

---

# SESSION 1 CONTINUED: PURCHASING

## How a Purchase Happens

---

**Q11. Walk me through a complete purchase from your supplier.**
> From: You decide to buy something → contact supplier → get goods → pay → record it.

**Why we ask:** Same as Q1 — we need the exact flow to build the software correctly.

**Partner's Answer:**
> _[Write here]_

---

**Q12. Do you get a VAT bill from your suppliers?**
> - Always
> - Sometimes (some suppliers give VAT bill, some don't)
> - Never (all cash bill purchases)

**Why we ask:** VAT on purchases affects your tax calculation — you can claim back VAT paid on purchases (input VAT).

**Partner's Answer:**
> _[Write here]_

---

**Q13. Do you pay your suppliers immediately or on credit?**
> Example: You receive goods today but pay in 30 days.

**Why we ask:** Accounts Payable tracking — how much you owe suppliers.

**Partner's Answer:**
> _[Write here]_

---

**Q14. How do you track what you owe to suppliers?**
> - You remember it / write in notebook
> - Excel
> - You always pay immediately — no credit

**Partner's Answer:**
> _[Write here]_

---

---

# SESSION 2: INVENTORY

## How Stock is Managed

---

**Q15. When you receive new stock, what information do you record?**
> Examples: Supplier name, quantity received, purchase price, condition of goods, expiry date (if applicable)

**Why we ask:** The system records this in a Purchase Order — we need to know every field that matters.

**Partner's Answer:**
> _[Write here]_

---

**Q16. When you sell something, does your stock count reduce automatically?**
> Current situation: In our system, stock must be manually updated. Is this acceptable, or do you need it to reduce automatically when a sale is recorded?

**Why we ask:** Auto stock deduction requires linking Sales Order → Inventory. It is more complex to build.

**Partner's Answer:**
> _[Write here]_

---

**Q17. How do you value your stock when prices change?**
> Example: You bought 100 units at Rs. 500 each (total Rs. 50,000). Later you bought 50 more at Rs. 600 each.
> - Do you use the new price (Rs. 600) for all units in stock?
> - Do you calculate the average price: (100×500 + 50×600) ÷ 150 = Rs. 533.33?
> - Do you sell the oldest stock first (FIFO — First In First Out)?

**Why we ask:** Stock valuation method directly affects your profit calculation. This is a critical accounting decision.

**Partner's Answer:**
> _[Write here]_

---

**Q18. Do any of your products have expiry dates?**
> If yes, do you need to track expiry dates per batch?

**Why we ask:** Expiry tracking is a separate feature — important for food, medicine, chemicals.

**Partner's Answer:**
> _[Write here]_

---

**Q19. Do you have products that come in batches with different serial numbers or batch numbers?**
> Example: Electronics with serial numbers, medicines with batch/lot numbers.

**Why we ask:** Batch/serial tracking requires significant additional work.

**Partner's Answer:**
> _[Write here]_

---

**Q20. What units do you use for your products?**
> Our system currently supports: Piece, Set, Liter, ML, Kilogram, Gram, NOS
> Are there other units you use? Examples: Dozen, Box, Meter, Foot, Quintal, Bag, Roll

**Partner's Answer:**
> _[Write here]_

---

---

# SESSION 3: ACCOUNTING & LEDGER

## How Books Are Maintained

---

**Q21. Does your business currently use an accountant?**
> - Full-time accountant (in-house)
> - Part-time accountant
> - External CA visits monthly/quarterly
> - You maintain accounts yourself
> - No formal accounting

**Why we ask:** The software must match the skill level of who will use it.

**Partner's Answer:**
> _[Write here]_

---

**Q22. How are your books currently maintained?**
> - Manual ledger books (haath ko kitab)
> - Excel spreadsheets
> - Tally software
> - Other software
> - Not maintained formally

**Why we ask:** We need to understand what the user is used to, so our system is not too different.

**Partner's Answer:**
> _[Write here]_

---

**Q23. Do you know what "double-entry accounting" means?**
> Double-entry means every transaction is recorded twice — once as a debit and once as a credit.
> Example: Cash Sale of Rs. 10,000:
> - Sales Account → Credit Rs. 10,000
> - Cash Account → Debit Rs. 10,000

> - Yes, we use double-entry
> - We use single-entry (just income and expense columns)
> - We don't do formal accounting
> - Our CA handles this — we don't need to know

**Why we ask:** Our Ledger module uses double-entry. If your users don't need this, we should hide it or simplify it.

**Partner's Answer:**
> _[Write here]_

---

**Q24. What financial reports do you need at the end of each month?**
> Tick all that apply:
> - Cash book summary (total cash in, total cash out, closing balance)
> - Sales report (total sales this month)
> - Purchase report (total purchases this month)
> - Profit and Loss statement
> - Balance sheet
> - VAT report (for IRD submission)
> - Stock valuation report
> - Outstanding receivables (who owes you)
> - Outstanding payables (who you owe)
> - Bank reconciliation statement

**Why we ask:** Each of these is a separate report to build. We prioritize based on what you actually need.

**Partner's Answer:**
> _[Write here]_

---

**Q25. Do you submit VAT returns to IRD (Inland Revenue Department)?**
> - Yes, monthly
> - Yes, quarterly
> - No — not VAT registered
> - Our CA handles it, we don't know the details

**Why we ask:** If yes, the system must generate a VAT report in the format IRD accepts.

**Partner's Answer:**
> _[Write here]_

---

**Q26. What format does IRD require for VAT filing?**
> - Online submission on IRD portal (e-filing)
> - Paper form submission
> - Excel file upload

**Partner's Answer:**
> _[Write here]_

---

**Q27. What is your fiscal year?**
> In Nepal the fiscal year runs from Shrawan 1 to Ashadh 31 (approximately mid-July to mid-July).
> - Do your accounts reset at the start of each fiscal year?
> - Do invoice numbers restart each year?
> - Does the system need to prevent editing entries from the previous year?

**Partner's Answer:**
> _[Write here]_

---

---

# SESSION 3 CONTINUED: PAYROLL & HR

## How Salary and HR Works

---

**Q28. Is your company registered with SSF (Social Security Fund)?**
> SSF rules: Employee contributes 11% of gross salary. Employer contributes 20% of gross salary.
> - Yes, registered with SSF
> - No, using old PF/Gratuity system
> - No contribution scheme at all

**Why we ask:** SSF calculation is complex and significantly changes the payroll engine.

**Partner's Answer:**
> _[Write here]_

---

**Q29. What does an employee's salary consist of?**
> Example structure:
> - Basic Salary: Rs. 20,000
> - Dearness Allowance (DA): Rs. 2,000
> - House Rent Allowance (HRA): Rs. 3,000
> - Transport Allowance: Rs. 1,000
> - Grade (increment for years of service): Rs. 500
> - Total Gross: Rs. 26,500

> Please describe how salary is structured in your business.

**Why we ask:** If salary has components, we need separate fields for each. SSF is calculated on basic salary only — not total gross.

**Partner's Answer:**
> _[Write here]_

---

**Q30. Do you deduct Personal Income Tax (PIT / Aaya Kar) from employee salary?**
> Nepal PIT slabs (approximate):
> - Up to Rs. 5,00,000/year → 1%
> - Rs. 5,00,001 to Rs. 7,00,000/year → 10%
> - Rs. 7,00,001 to Rs. 20,00,000/year → 20%
> - Above Rs. 20,00,000/year → 30%

> - Yes, we deduct PIT from salary and deposit to IRD
> - No — employees handle their own tax
> - Some employees (above threshold) get PIT deducted, others don't

**Why we ask:** PIT deduction is a legal requirement for employees above the threshold. The system must calculate and deduct it.

**Partner's Answer:**
> _[Write here]_

---

**Q31. How many working days are in a month for your business?**
> Examples:
> - 26 days (6 days/week, Saturdays off)
> - 25 days (some Saturdays off, some public holidays)
> - 22 days (5 days/week, Saturday and Sunday off)
> - It varies each month

**Why we ask:** Per-day salary calculation depends on working days. This directly affects absent-day deductions.

**Partner's Answer:**
> _[Write here]_

---

**Q32. How do you handle public holidays for salary?**
> - Public holidays are paid — employees don't lose salary for them
> - Public holidays are not paid — treated as absent
> - Only gazetted holidays are paid

**Why we ask:** Our current system marks holidays as "no deduction" — we need to confirm this is correct.

**Partner's Answer:**
> _[Write here]_

---

**Q33. What types of leave do you give employees?**
> In Nepal, common leave types:
> - Casual Leave (CL): Usually 12 days per year
> - Sick Leave (SL): Usually 12 days per year
> - Earned/Annual Leave (EL): 1 day per 20 working days
> - Maternity Leave: 98 days
> - Mourning/Bereavement Leave

> - Are all these leaves PAID (no salary deduction)?
> - What happens when an employee uses more leave than their balance?
> - Do unused leaves carry forward to next year? Or are they paid out?

**Partner's Answer:**
> _[Write here]_

---

**Q34. Do you give a Dashain bonus (Teej bonus / festival bonus)?**
> In Nepal, most companies give one month's basic salary as Dashain bonus.
> - Yes, we give Dashain bonus
> - How much? (One month basic? One month gross? Fixed amount?)
> - When is it paid? (Before Dashain? Specific date?)
> - Do contract staff get Dashain bonus? Part-time?

**Why we ask:** The system needs a Dashain bonus calculation feature if you use it.

**Partner's Answer:**
> _[Write here]_

---

**Q35. How do you currently process payroll each month?**
> Walk through the steps:
> Step 1: ___
> Step 2: ___
> Etc.

> Also: Who approves payroll before salaries are paid? Is there an approval process?

**Why we ask:** We need to build the exact payroll workflow — not just the calculation.

**Partner's Answer:**
> _[Write here]_

---

**Q36. Do you give salary slips to employees?**
> If yes, what information is on the salary slip?

**Why we ask:** The system should generate printable/shareable salary slips.

**Partner's Answer:**
> _[Write here]_

---

---

# SESSION 4: BANK & CASH MANAGEMENT

---

**Q37. How many bank accounts does your business have?**
> And which banks? (NIC Asia, Nabil, Global IME, Sanima, etc.)

**Partner's Answer:**
> _[Write here]_

---

**Q38. How do you currently reconcile your bank statement?**
> Reconciliation means: comparing what the bank shows vs. what you recorded in your books.
> - We do it manually every month
> - Our CA does it
> - We don't do formal reconciliation

**Partner's Answer:**
> _[Write here]_

---

**Q39. Do you receive or issue cheques?**
> If yes:
> - How do you track cheques given to suppliers (pending clearance)?
> - How do you track cheques received from customers?
> - What happens when a cheque bounces?

**Partner's Answer:**
> _[Write here]_

---

**Q40. How do you manage petty cash (saano rokad)?**
> - Is there a cash box with a fixed float?
> - Who manages it?
> - How often do you replenish the petty cash?
> - What is the maximum a single petty cash expense can be?

**Partner's Answer:**
> _[Write here]_

---

---

# SESSION 5: GENERAL BUSINESS OPERATIONS

---

**Q41. Do you have multiple branches or locations?**
> - No, single location
> - Yes, multiple branches
>   - Do branches share inventory?
>   - Do branches have separate accounts?
>   - Does head office see all branch data?

**Partner's Answer:**
> _[Write here]_

---

**Q42. Who will use this software in your business?**
> List each type of user and what they should be able to do:
> Example:
> - Owner/Manager: See everything, approve payroll, see reports
> - Accountant: Enter invoices, manage ledger, run reports
> - Sales staff: Create invoices only, cannot see payroll
> - Warehouse: Update stock only

**Why we ask:** Role-based access — different users see different parts of the system.

**Partner's Answer:**
> _[Write here]_

---

**Q43. What is the most painful thing about your current accounting/inventory process?**
> What wastes the most time? What causes the most errors?

**Why we ask:** This tells us what to build first — the thing that saves the most pain.

**Partner's Answer:**
> _[Write here]_

---

**Q44. What software or tools do you currently use for accounting/inventory?**
> - Tally ERP
> - Excel
> - Busy Accounting
> - Manually (notebooks)
> - Other software
> - Nothing formal

**Partner's Answer:**
> _[Write here]_

---

**Q45. If you currently use Tally or another software, why are you looking for an alternative?**

**Partner's Answer:**
> _[Write here]_

---

**Q46. What is the ONE feature that would make you immediately switch to Easy Books?**

**Partner's Answer:**
> _[Write here]_

---

---

# PRIORITY CHECK

After all the answers above, please rank these features for the FIRST LAUNCH:

| Feature | Must Have | Nice to Have | Not Needed |
|---|---|---|---|
| Sales Invoice with VAT | | | |
| Purchase Order | | | |
| Inventory management | | | |
| Auto stock deduction on sale | | | |
| Client/Vendor management | | | |
| Cash/Bank transaction recording | | | |
| Payroll with SSF/PIT | | | |
| Leave management | | | |
| Double-entry ledger | | | |
| Profit & Loss report | | | |
| VAT report for IRD | | | |
| Bank reconciliation | | | |
| Outstanding receivables | | | |
| Outstanding payables | | | |
| PDF invoice generation | | | |
| Email invoice to customer | | | |
| Dashain bonus | | | |
| Multi-branch support | | | |
| Role-based user access | | | |
| Nepali date (BS) throughout | | | |

---

# END OF QUESTIONNAIRE

**Reviewed by:** _________________________
**Business Name:** _________________________
**Date:** _________________________

**Additional notes or anything we missed:**
> _[Write here]_

---
*Easy Books Technical Team — April 2026*
