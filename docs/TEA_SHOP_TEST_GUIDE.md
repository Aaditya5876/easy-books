# Easy Books Tea Shop Test Guide

## Table of Contents
- [Overview](#overview)
- [Register the tea shop](#register-the-tea-shop)
- [Inventory testing](#inventory-testing)
- [Purchase testing](#purchase-testing)
- [Sales testing](#sales-testing)
- [Clients and vendors](#clients-and-vendors)
- [Ledger testing](#ledger-testing)
- [Transactions testing](#transactions-testing)
- [Memo documents testing](#memo-documents-testing)
- [Payroll and attendance](#payroll-and-attendance)
- [Nepal-specific checks](#nepal-specific-checks)

## Overview
This guide walks through testing Easy Books for a small tea shop in Nepal.

Use it after the app is running locally or on a staging server.

## Register the tea shop
1. Open `http://localhost:5173`.
2. Click `Register`.
3. Enter:
   - Name: `Ram Bahadur`
   - Company Name: `Nepal Tea Ghar`
   - Email and password
4. Submit to create the first company and user.
5. Confirm the company is active in the top bar.

## Inventory testing
1. Open `Inventory`.
2. Add tea shop items:
   - `Local Tea Leaves`, qty `50`, purchase `250`, selling `320`, location `Counter`
   - `Milk 1L`, qty `20`, purchase `160`, selling `220`
   - `Sugar 1kg`, qty `10`, purchase `120`, selling `150`
3. Set low-stock thresholds on items.
4. Update item prices or location and save.
5. Delete a test item and confirm removal.

## Purchase testing
1. Open `Purchase`.
2. Click `New Purchase`.
3. Add vendor details:
   - Vendor: `Bharat Tea Supplier`
   - Contact: `9801234567`
   - Address: `New Road, Kathmandu`
4. Add purchased items:
   - `Tea Leaves 250g`, qty `20`, price `250`
   - `Milk 1L`, qty `10`, price `160`
5. Enable VAT for a taxable purchase if required.
6. Add labor or delivery charges if needed.
7. Save the purchase.
8. Verify:
   - vendor appears in `Vendors`
   - inventory values updated
   - totals include VAT if enabled

## Sales testing
1. Open `Sales`.
2. Click `New Sale`.
3. Add client details:
   - `Client Name`: `Tea Stall Customer`
   - Contact and address
4. Choose inventory items or enter sale items.
5. Turn on `VAT` for taxable sales.
6. Enter payment type and save.
7. Verify:
   - client appears in `Clients`
   - inventory quantity updated
   - invoice number generated
   - totals include VAT

## Clients and vendors
1. Open `Clients` and create a customer:
   - `Client Name`: `Ramailo Customer`
   - PAN/VAT No., phone, address
2. Open `Vendors` and create a supplier:
   - `Vendor Name`: `Milk Supplier`
   - Phone, address
3. Use filters and confirm total sales / purchase information.

## Ledger testing
1. Open `Ledger`.
2. Create accounts for:
   - purchase
   - sales
   - expense
3. Open an account and add ledger entries:
   - debit and credit records
   - reference numbers
4. Confirm account balances update correctly.

## Transactions testing
1. Open `Transactions`.
2. Create a cash income record:
   - description: `Tea sales cash`
   - category: `income`
3. Create an expense record:
   - description: `Electricity bill`
   - category: `expense`
4. Confirm transaction totals and categories.

## Memo documents testing
1. Open `Memo`.
2. Add documents for:
   - `quotation`
   - `sales_bill`
   - `purchase_bill`
3. Set document status and attach files.
4. Confirm documents appear in the correct tabs and are searchable.

## Payroll and attendance
1. Open `Attendance` and mark employee attendance.
2. Open `Payroll` and generate payroll for a selected month.
3. Confirm payroll summary and payslip generation.

## Nepal-specific checks
- Use `NPR` values for currency.
- Use local company names and addresses.
- Test VAT mode on purchase and sales.
- Check BS date display if available.
