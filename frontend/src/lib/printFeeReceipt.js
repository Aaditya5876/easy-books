import { format } from 'date-fns';
import QRCode from 'qrcode';
import { formatBsYearMonth } from './nepaliDate';

// See printFeeInvoice.js's esc() for why this is needed — document.write()
// into a same-origin popup doesn't auto-escape like JSX does.
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// A receipt is proof of ONE payment, not a running "total paid so far" summary
// — a school can take several partial payments against the same invoice, and
// each one gets its own real receiptNo (R-<BSyear>-NNNN, from FeePayment,
// generated at payment time). `payment` picks which one this document is for;
// callers should always pass the specific FeePayment being printed. Falls
// back to the invoice's latest payment if omitted, for older call sites.
export async function printFeeReceipt(inv, payment) {
  const pay = payment || inv.payments?.[inv.payments.length - 1];
  const w = window.open('', '_blank');
  const fmt = (n) => Number(n).toLocaleString('en-NP', { minimumFractionDigits: 2 });
  const className = inv.student?.class
    ? `${inv.student.class.name}${inv.student.class.section ? ` (${inv.student.class.section})` : ''}`
    : '—';
  const receiptNo = pay?.receiptNo || inv.id.slice(-8).toUpperCase();
  const amountPaid = pay ? Number(pay.amount) : Number(inv.paidAmount);
  const paidDate = pay?.paidAt ? new Date(pay.paidAt) : new Date();
  const balanceDue = Number(inv.totalAmount) - Number(inv.paidAmount);

  // Encodes just the payment's verificationCode — not a URL, not the receipt
  // details — so scanning it (via the admin's in-app scanner) looks up the
  // transaction exactly as stored in the DB, as ground truth against a
  // possibly-edited screenshot or printed copy. Older/unconfirmed payments
  // have no code yet, so the QR is simply omitted for those.
  let qrDataUrl = '';
  if (pay?.verificationCode) {
    try {
      qrDataUrl = await QRCode.toDataURL(pay.verificationCode, { width: 120, margin: 1 });
    } catch {
      // QR generation is a nice-to-have — receipt still prints without it
    }
  }

  w.document.write(`
    <html><head><title>Fee Receipt</title>
    <style>
      body{font-family:sans-serif;max-width:500px;margin:30px auto;padding:0 20px;font-size:13px}
      h2{text-align:center;margin:0;font-size:18px}
      .divider{border-top:1px dashed #999;margin:12px 0}
      .row{display:flex;justify-content:space-between;margin:4px 0}
      .label{color:#666}
      .total{font-size:15px;font-weight:bold;margin-top:8px}
      .stamp{margin-top:40px;text-align:right;font-size:12px}
      @media print{button{display:none}}
    </style></head>
    <body>
    <h2>${esc(inv.company?.name || 'School')}</h2>
    ${inv.company?.address ? `<p style="text-align:center;color:#666;margin:4px 0">${esc(inv.company.address)}</p>` : ''}
    ${inv.company?.phone ? `<p style="text-align:center;color:#666;margin:4px 0">Phone: ${esc(inv.company.phone)}</p>` : ''}
    <div class="divider"></div>
    <div style="text-align:center;font-weight:bold;margin-bottom:8px">FEE RECEIPT</div>
    <div class="row"><span class="label">Receipt No:</span> <span>${esc(receiptNo)}</span></div>
    <div class="row"><span class="label">Date:</span> <span>${format(paidDate, 'dd MMM yyyy')}</span></div>
    ${pay?.method ? `<div class="row"><span class="label">Method:</span> <span>${esc(pay.method)}</span></div>` : ''}
    <div class="divider"></div>
    <div class="row"><span class="label">Student:</span> <span>${esc(inv.student?.name || '—')}</span></div>
    <div class="row"><span class="label">Roll No:</span> <span>${esc(inv.student?.rollNumber || '—')}</span></div>
    <div class="row"><span class="label">Class:</span> <span>${esc(className)}</span></div>
    <div class="row"><span class="label">Month:</span> <span>${esc(formatBsYearMonth(inv.month))}</span></div>
    ${inv.description ? `<div class="row"><span class="label">Description:</span> <span>${esc(inv.description)}</span></div>` : ''}
    <div class="divider"></div>
    <div class="row total"><span>Amount Paid (this receipt):</span> <span>Rs. ${fmt(amountPaid)}</span></div>
    <div class="row"><span class="label">Invoice Total:</span> <span>Rs. ${fmt(inv.totalAmount)}</span></div>
    ${Number(inv.discount) > 0 ? `<div class="row"><span class="label">Discount:</span> <span>- Rs. ${fmt(inv.discount)}</span></div>` : ''}
    <div class="row"><span class="label">Total Paid to Date:</span> <span>Rs. ${fmt(inv.paidAmount)}</span></div>
    ${balanceDue > 0 ? `<div class="row" style="color:#c00"><span>Balance Due:</span> <span>Rs. ${fmt(balanceDue)}</span></div>` : ''}
    <div class="divider"></div>
    <div style="display:flex;justify-content:space-between;align-items:flex-end">
      ${qrDataUrl ? `
      <div style="text-align:center">
        <img src="${qrDataUrl}" width="90" height="90" alt="Receipt QR" />
        <p style="font-size:10px;color:#999;margin:2px 0 0">Scan to verify this receipt</p>
        <p style="font-size:11px;font-family:monospace;font-weight:bold;margin:2px 0 0">${pay.verificationCode}</p>
      </div>` : '<div></div>'}
      <div class="stamp" style="margin-top:0">
        <p>_______________________</p>
        <p>Accountant / Cashier</p>
      </div>
    </div>
    <br><button onclick="window.print()">Print Receipt</button>
    </body></html>
  `);
  w.document.close();
  setTimeout(() => w.print(), 300);
}
