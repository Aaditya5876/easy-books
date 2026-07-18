import { format } from 'date-fns';
import QRCode from 'qrcode';

export async function printFeeReceipt(inv) {
  const w = window.open('', '_blank');
  const fmt = (n) => Number(n).toLocaleString('en-NP', { minimumFractionDigits: 2 });
  const className = inv.student?.class
    ? `${inv.student.class.name}${inv.student.class.section ? ` (${inv.student.class.section})` : ''}`
    : '—';
  const receiptNo = inv.id.slice(-8).toUpperCase();

  // Demo-only QR: encodes receipt details for quick visual verification.
  // NOT a real payment/bank QR — no gateway or bank integration is wired to it.
  const qrPayload = [
    `${inv.company?.name || 'School'} — Fee Receipt`,
    `Receipt: ${receiptNo}`,
    `Student: ${inv.student?.name || '—'}`,
    `Amount Paid: Rs. ${fmt(inv.paidAmount)}`,
    `Month: ${inv.month}`,
  ].join('\n');
  let qrDataUrl = '';
  try {
    qrDataUrl = await QRCode.toDataURL(qrPayload, { width: 120, margin: 1 });
  } catch {
    // QR generation is a nice-to-have — receipt still prints without it
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
    <h2>${inv.company?.name || 'School'}</h2>
    ${inv.company?.address ? `<p style="text-align:center;color:#666;margin:4px 0">${inv.company.address}</p>` : ''}
    ${inv.company?.phone ? `<p style="text-align:center;color:#666;margin:4px 0">Phone: ${inv.company.phone}</p>` : ''}
    <div class="divider"></div>
    <div style="text-align:center;font-weight:bold;margin-bottom:8px">FEE RECEIPT</div>
    <div class="row"><span class="label">Receipt No:</span> <span>${receiptNo}</span></div>
    <div class="row"><span class="label">Date:</span> <span>${format(new Date(), 'dd MMM yyyy')}</span></div>
    <div class="divider"></div>
    <div class="row"><span class="label">Student:</span> <span>${inv.student?.name || '—'}</span></div>
    <div class="row"><span class="label">Roll No:</span> <span>${inv.student?.rollNumber || '—'}</span></div>
    <div class="row"><span class="label">Class:</span> <span>${className}</span></div>
    <div class="row"><span class="label">Month:</span> <span>${inv.month}</span></div>
    ${inv.description ? `<div class="row"><span class="label">Description:</span> <span>${inv.description}</span></div>` : ''}
    <div class="divider"></div>
    <div class="row"><span class="label">Total Amount:</span> <span>Rs. ${fmt(inv.totalAmount)}</span></div>
    ${Number(inv.discount) > 0 ? `<div class="row"><span class="label">Discount:</span> <span>- Rs. ${fmt(inv.discount)}</span></div>` : ''}
    <div class="row total"><span>Amount Paid:</span> <span>Rs. ${fmt(inv.paidAmount)}</span></div>
    ${Number(inv.totalAmount) - Number(inv.paidAmount) > 0 ? `<div class="row" style="color:#c00"><span>Balance Due:</span> <span>Rs. ${fmt(Number(inv.totalAmount) - Number(inv.paidAmount))}</span></div>` : ''}
    <div class="divider"></div>
    <div style="display:flex;justify-content:space-between;align-items:flex-end">
      ${qrDataUrl ? `
      <div style="text-align:center">
        <img src="${qrDataUrl}" width="90" height="90" alt="Receipt QR" />
        <p style="font-size:10px;color:#999;margin:2px 0 0">Scan to view receipt details (demo)</p>
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
