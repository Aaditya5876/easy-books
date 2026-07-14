# Report Updates Notes

## School Reports Audit Enhancements

### What changed
- Added an Audit tab to the school reports experience.
- Added a date filter with From, To, Filter, and Reset controls.
- Reworked the audit area into printable financial statement cards.
- Replaced static placeholder values with live values derived from transactions and ledger data.
- Added quick navigation buttons to Ledger and Transactions.
- Updated the report tables to show comparison columns for fiscal years.
- Changed the fiscal-year headers to Nepali-style labels such as 2081/082 and 2082/083.

### Implementation notes
- The main UI changes are in frontend/src/pages/school/SchoolReports.jsx.
- Fiscal-year labels use the Nepali helper from frontend/src/lib/nepaliDate.js.
- The report cards support browser-based print export.

### Current behavior
- Each financial statement row shows a previous fiscal year value and a current fiscal year value side by side.
- The print output preserves the same comparison layout.
