import { format } from 'date-fns';
import { adToBs, formatBsYearMonth } from './nepaliDate';
import apiClient from '@/api/client';

// Same pattern as PortalFees.jsx's local resolveFileUrl — qrCodeUrl comes back
// as a relative /uploads/... path from the backend, and this print template
// opens a bare popup window outside the app's routing/proxy, so it needs the
// API origin prefixed to actually load.
function resolveFileUrl(url = '') {
  return url.startsWith('http') ? url : `${apiClient.defaults.baseURL}${url}`;
}

// This document is built with document.write() into a same-origin popup —
// unlike JSX, nothing here auto-escapes. Every value that ultimately traces
// back to something a user typed (student/guardian names, notes, item
// descriptions, company info, bank names…) must be escaped before going into
// the HTML string, or a student named `<img src=x onerror=...>` becomes
// script that runs in whoever prints/views this invoice's browser.
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// The bill presented before payment — itemized charges, invoice/due dates,
// balance owed. Distinct from printFeeReceipt.js, which is proof of payment
// already made. See printFeeReceipt.js for the sibling document.
export function printFeeInvoice(inv) {
  const w = window.open('', '_blank');
  const fmt = (n) => Number(n).toLocaleString('en-NP', { minimumFractionDigits: 2 });
  const className = inv.student?.class
    ? `${inv.student.class.name}${inv.student.class.section ? ` (${inv.student.class.section})` : ''}`
    : '—';
  const invoiceNo = inv.invoiceNo || `INV-${inv.id.slice(-8).toUpperCase()}`;
  const subtotal = (inv.items ?? []).reduce((sum, it) => sum + Number(it.amount), 0);
  const balance = Number(inv.totalAmount) - Number(inv.paidAmount);

  const bsDate = (d) => {
    if (!d) return '';
    try { const b = adToBs(d); return `${b.day} ${b.monthName} ${b.year}`; } catch { return ''; }
  };

  const itemRows = (inv.items ?? []).map((it, i) => `
    <tr>
      <td style="padding:7px 10px;border-bottom:1px solid #e5e5e5">${i + 1}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #e5e5e5">${esc(it.feeHead?.name || it.inventoryItem?.itemName || it.description)}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #e5e5e5;text-align:right">Rs. ${fmt(it.amount)}</td>
    </tr>
  `).join('');

  const STATUS_STYLE = {
    PENDING: 'background:#fef3c7;color:#92400e',
    PARTIAL: 'background:#dbeafe;color:#1e40af',
    PAID: 'background:#d1fae5;color:#065f46',
    WAIVED: 'background:#e5e7eb;color:#374151',
  };
  const STATUS_LABEL = { PENDING: 'Pending', PARTIAL: 'Partially Paid', PAID: 'Paid', WAIVED: 'Waived' };

  const qrAccounts = (inv.company?.bankAccounts ?? []).filter(b => b.qrCodeUrl);
  const qrSection = balance > 0.005 && qrAccounts.length > 0 ? `
    <p class="section-title">Scan to Pay</p>
    <div class="qr-grid">
      ${qrAccounts.map(b => `
        <div class="qr-card">
          <img src="${esc(resolveFileUrl(b.qrCodeUrl))}" alt="${esc(b.bankName)} QR" />
          <p style="margin:4px 0 0">${esc(b.bankName)}</p>
        </div>
      `).join('')}
    </div>
  ` : '';

  w.document.write(`
    <html><head><title>${invoiceNo}</title>
    <style>
      * { box-sizing: border-box; }
      body{font-family:Arial,Helvetica,sans-serif;max-width:680px;margin:30px auto;padding:0 24px;font-size:13px;color:#1f2937}
      .head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px}
      .school-name{font-size:20px;font-weight:bold;margin:0}
      .muted{color:#6b7280}
      .meta-box{border:1px solid #d1d5db;border-radius:6px;padding:12px 16px;min-width:230px}
      .meta-box h1{font-size:16px;margin:0 0 8px;letter-spacing:0.5px}
      .meta-row{display:flex;justify-content:space-between;gap:12px;margin:3px 0}
      .badge{display:inline-block;padding:2px 10px;border-radius:999px;font-size:11px;font-weight:600}
      .section-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.4px;color:#6b7280;margin:22px 0 8px}
      .bill-to{display:flex;justify-content:space-between;gap:24px}
      table{width:100%;border-collapse:collapse;margin-top:6px}
      th{text-align:left;padding:8px 10px;background:#f3f4f6;font-size:11px;text-transform:uppercase;letter-spacing:0.3px;color:#4b5563}
      th:last-child, td:last-child{text-align:right}
      .summary{margin-top:14px;margin-left:auto;width:280px}
      .summary .row{display:flex;justify-content:space-between;margin:5px 0}
      .summary .total{font-size:15px;font-weight:bold;border-top:1px solid #d1d5db;padding-top:8px;margin-top:8px}
      .notes{margin-top:20px;padding:10px 12px;background:#f9fafb;border-radius:6px;font-size:12px}
      .qr-grid{display:flex;gap:16px;flex-wrap:wrap;margin-top:8px}
      .qr-card{text-align:center;font-size:11px;color:#4b5563}
      .qr-card img{width:110px;height:110px;object-fit:contain;border:1px solid #e5e7eb;border-radius:6px;padding:4px}
      .footer{margin-top:40px;display:flex;justify-content:space-between;align-items:flex-end}
      .sign-line{text-align:center;font-size:12px}
      .disclaimer{margin-top:30px;text-align:center;font-size:11px;color:#9ca3af}
      @media print{button{display:none}}
    </style></head>
    <body>
    <div class="head">
      <div>
        <p class="school-name">${esc(inv.company?.name || 'School')}</p>
        ${inv.company?.address ? `<p class="muted" style="margin:4px 0">${esc(inv.company.address)}</p>` : ''}
        ${inv.company?.phone ? `<p class="muted" style="margin:2px 0">Phone: ${esc(inv.company.phone)}</p>` : ''}
        ${inv.company?.email ? `<p class="muted" style="margin:2px 0">${esc(inv.company.email)}</p>` : ''}
      </div>
      <div class="meta-box">
        <h1>FEE INVOICE</h1>
        <div class="meta-row"><span class="muted">Invoice No</span><span><strong>${invoiceNo}</strong></span></div>
        <div class="meta-row"><span class="muted">Invoice Date</span><span>${inv.invoiceDate ? format(new Date(inv.invoiceDate), 'dd MMM yyyy') : '—'}${bsDate(inv.invoiceDate) ? ` (${bsDate(inv.invoiceDate)} BS)` : ''}</span></div>
        ${inv.dueDate ? `<div class="meta-row"><span class="muted">Due Date</span><span>${format(new Date(inv.dueDate), 'dd MMM yyyy')}</span></div>` : ''}
        <div class="meta-row"><span class="muted">Status</span><span class="badge" style="${STATUS_STYLE[inv.status] || ''}">${STATUS_LABEL[inv.status] || inv.status}</span></div>
      </div>
    </div>

    <p class="section-title">Bill To</p>
    <div class="bill-to">
      <div>
        <p style="margin:2px 0"><strong>${esc(inv.student?.name || '—')}</strong></p>
        <p class="muted" style="margin:2px 0">Roll No: ${esc(inv.student?.rollNumber || '—')} &nbsp;·&nbsp; Class: ${esc(className)}</p>
        ${inv.student?.guardianName ? `<p class="muted" style="margin:2px 0">Guardian: ${esc(inv.student.guardianName)}${inv.student.guardianPhone ? ` (${esc(inv.student.guardianPhone)})` : ''}</p>` : ''}
      </div>
      <div style="text-align:right">
        <p class="muted" style="margin:2px 0">Billing Period</p>
        <p style="margin:2px 0"><strong>${formatBsYearMonth(inv.month)}</strong></p>
      </div>
    </div>
    ${inv.description ? `<p class="muted" style="margin-top:10px">${esc(inv.description)}</p>` : ''}

    <p class="section-title">Charges</p>
    <table>
      <thead><tr><th style="width:36px">#</th><th>Description</th><th style="width:130px">Amount</th></tr></thead>
      <tbody>${itemRows}</tbody>
    </table>

    <div class="summary">
      <div class="row"><span class="muted">Subtotal</span><span>Rs. ${fmt(subtotal)}</span></div>
      ${Number(inv.discount) > 0 ? `<div class="row"><span class="muted">Discount</span><span>- Rs. ${fmt(inv.discount)}</span></div>` : ''}
      ${Number(inv.fine) > 0 ? `<div class="row"><span class="muted">Fine</span><span>+ Rs. ${fmt(inv.fine)}</span></div>` : ''}
      <div class="row"><span class="muted">Total Payable</span><span>Rs. ${fmt(inv.totalAmount)}</span></div>
      <div class="row"><span class="muted">Paid Till Date</span><span>Rs. ${fmt(inv.paidAmount)}</span></div>
      <div class="row total"><span>Balance Due</span><span>Rs. ${fmt(balance)}</span></div>
    </div>

    ${qrSection}

    ${inv.notes ? `<div class="notes"><strong>Notes:</strong> ${esc(inv.notes)}</div>` : ''}

    <div class="footer">
      <div></div>
      <div class="sign-line">
        <p>_______________________</p>
        <p>Authorized Signature</p>
      </div>
    </div>
    <p class="disclaimer">This is a computer-generated invoice.</p>
    <br><button onclick="window.print()">Print Invoice</button>
    </body></html>
  `);
  w.document.close();
  setTimeout(() => w.print(), 300);
}
