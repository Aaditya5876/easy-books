// EasyBooks Seed Script
// Run: node seed.js [admin_email] [admin_password]
// Default credentials match SUPER_ADMIN in backend/.env
// Make sure backend is running on http://localhost:3000

const BASE = 'http://localhost:3000';
const ADMIN_EMAIL    = process.argv[2] || 'geoinfosys.np@gmail.com';
const ADMIN_PASSWORD = process.argv[3] || 'Test@123';

let cookies = '';
let teaId = '';
let pharmId = '';

let passed = 0;
let failed = 0;

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

function extractCookies(res) {
  const raw = typeof res.headers.getSetCookie === 'function'
    ? res.headers.getSetCookie()
    : (res.headers.get('set-cookie') || '').split(/,(?=[^ ])/);
  return raw.map(c => c.split(';')[0]).filter(Boolean).join('; ');
}

async function post(path, body, auth = true) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth && cookies) headers['Cookie'] = cookies;
  const res = await fetch(`${BASE}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  const newCookies = extractCookies(res);
  if (newCookies) cookies = newCookies;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`POST ${path} → ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

async function get(path, auth = true) {
  const headers = {};
  if (auth && cookies) headers['Cookie'] = cookies;
  const res = await fetch(`${BASE}${path}`, { headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

async function run(label, fn) {
  try {
    const result = await fn();
    console.log(`  ✅ ${label}`);
    passed++;
    return result;
  } catch (err) {
    console.log(`  ❌ ${label}: ${err.message}`);
    failed++;
    return null;
  }
}

// ─── Ledger account helpers (Transactions require a real debit/credit account pair) ──

// Mirrors the six system accounts the Transactions page auto-creates/resolves:
// Cash/Bank settle cash-type entries, Payable/Receivable carry credit-type debt,
// Sales Revenue/Purchase Expenses are the credit-type counter-account.
const SYSTEM_ACCOUNT_DEFS = {
  cash:            { accountName: 'Cash in Hand',        accountType: 'ASSET' },
  bank:            { accountName: 'Bank Account',        accountType: 'ASSET' },
  payable:         { accountName: 'Accounts Payable',    accountType: 'LIABILITY' },
  receivable:      { accountName: 'Accounts Receivable', accountType: 'ASSET' },
  salesRevenue:    { accountName: 'Sales Revenue',       accountType: 'INCOME' },
  purchaseExpense: { accountName: 'Purchase Expenses',   accountType: 'EXPENSE' },
};

async function ensureSystemAccounts(companyId) {
  const existing = await get(`/api/v1/ledger/accounts?companyId=${companyId}`);
  const byName = new Map(existing.map(a => [a.accountName.toLowerCase(), a.id]));
  const accounts = {};
  for (const [key, def] of Object.entries(SYSTEM_ACCOUNT_DEFS)) {
    const found = byName.get(def.accountName.toLowerCase());
    accounts[key] = found || (await post('/api/v1/ledger/accounts', { companyId, ...def, openingBalance: 0 })).id;
  }
  return accounts;
}

// Same debit/credit resolution the Transactions page uses: income debits the
// counter account (Cash/Bank, or Sales Revenue for credit) and credits Accounts
// Receivable; everything else debits Accounts Payable and credits the counter
// account (Cash/Bank, or Purchase Expenses for credit).
function resolveTransactionAccounts(accounts, type, category) {
  const counterKey = type === 'CASH' ? 'cash'
    : type === 'CREDIT' ? (category === 'INCOME' ? 'salesRevenue' : 'purchaseExpense')
    : 'bank'; // BANK, QR, CHEQUE
  const counterAccountId = accounts[counterKey];
  const ledgerAccountId = category === 'INCOME' ? accounts.receivable : accounts.payable;
  return category === 'INCOME'
    ? { debitAccountId: counterAccountId, creditAccountId: ledgerAccountId }
    : { debitAccountId: ledgerAccountId, creditAccountId: counterAccountId };
}

// ─── 1. Auth ──────────────────────────────────────────────────────────────────

async function seedAuth() {
  console.log('\n🔐 Auth');
  await run(`Login as ${ADMIN_EMAIL}`, async () => {
    await post('/api/v1/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }, false);
    if (!cookies) throw new Error('No cookies set — login failed');
  });
}

// ─── 2. Companies ─────────────────────────────────────────────────────────────

async function seedCompanies() {
  console.log('\n🏢 Companies');

  await run('Create Himalayan Tea House', async () => {
    const data = await post('/api/v1/companies', {
      name: 'Himalayan Tea House',
      address: 'Thamel, Kathmandu',
      phone: '9841000001',
      email: 'teahouse@himalayan.com',
      panVat: '123456789',
    });
    teaId = data.id;
    if (!teaId) throw new Error('No ID returned');
  });

  await run('Create Nepal Pharmacy', async () => {
    const data = await post('/api/v1/companies', {
      name: 'Nepal Pharmacy',
      address: 'Baneshwor, Kathmandu',
      phone: '9841000002',
      email: 'info@nepalpharmacy.com',
      panVat: '987654321',
    });
    pharmId = data.id;
    if (!pharmId) throw new Error('No ID returned');
  });
}

// ─── 3. Tea House ─────────────────────────────────────────────────────────────

async function seedTeaHouse() {
  console.log('\n🍵 Tea House — Vendors');
  const teaVendors = [
    { companyId: teaId, name: 'Ilam Tea Suppliers',    phone: '9800001111', email: 'ilam@tea.com',    address: 'Ilam, Province 1', panVat: '111222333' },
    { companyId: teaId, name: 'Dairy Fresh Pvt Ltd',   phone: '9800002222', email: 'dairy@fresh.com', address: 'Bhaktapur' },
    { companyId: teaId, name: 'Himalayan Sugar Mills', phone: '9800003333', address: 'Birgunj' },
    { companyId: teaId, name: 'Everest Snacks Co',     phone: '9800004444', address: 'Patan' },
    { companyId: teaId, name: 'Kathmandu Paper Cups',  phone: '9800005555', address: 'Koteshwor' },
  ];
  for (const v of teaVendors) await run(`Vendor: ${v.name}`, () => post('/api/v1/vendors', v));

  console.log('\n🍵 Tea House — Clients');
  const teaClients = [
    { companyId: teaId, name: 'Sunrise Hotel',      phone: '9801111001', email: 'sunrise@hotel.com',   address: 'Thamel' },
    { companyId: teaId, name: 'TU Students Canteen',phone: '9801111002', address: 'Kirtipur' },
    { companyId: teaId, name: 'Mount View Resort',  phone: '9801111003', email: 'mountview@resort.com', address: 'Nagarkot' },
    { companyId: teaId, name: 'Pokhara Tea Garden', phone: '9801111004', address: 'Pokhara' },
    { companyId: teaId, name: 'Boudha Coffee & Tea',phone: '9801111005', address: 'Boudha' },
  ];
  for (const c of teaClients) await run(`Client: ${c.name}`, () => post('/api/v1/clients', c));

  console.log('\n🍵 Tea House — Bank Account');
  await run('Bank: Nepal Bank Ltd', () => post('/api/v1/bank-accounts', {
    companyId: teaId,
    bankName: 'Nepal Bank Ltd',
    accountNumber: '0011020304050',
    branch: 'Thamel',
    currentBalance: 250000,
  }));

  console.log('\n🍵 Tea House — Inventory');
  const teaInventory = [
    { companyId: teaId, itemName: 'Ilam Premium Tea',    unit: 'Kg',    quantity: 50, lowStockThreshold: 10, unitPurchasePrice: 800,  unitSellingPrice: 1200 },
    { companyId: teaId, itemName: 'Milk (Full Cream)',    unit: 'Liter', quantity: 30, lowStockThreshold: 10, unitPurchasePrice: 90,   unitSellingPrice: 100 },
    { companyId: teaId, itemName: 'Sugar',                unit: 'Kg',    quantity: 40, lowStockThreshold: 5,  unitPurchasePrice: 75,   unitSellingPrice: 80 },
    { companyId: teaId, itemName: 'Masala Chai Mix',      unit: 'Kg',    quantity: 20, lowStockThreshold: 5,  unitPurchasePrice: 600,  unitSellingPrice: 900 },
    { companyId: teaId, itemName: 'Paper Cups (100pcs)',  unit: 'Set',   quantity: 100,lowStockThreshold: 20, unitPurchasePrice: 120,  unitSellingPrice: 150 },
    { companyId: teaId, itemName: 'Green Tea Bags',       unit: 'Set',   quantity: 60, lowStockThreshold: 15, unitPurchasePrice: 250,  unitSellingPrice: 400 },
    { companyId: teaId, itemName: 'Sel Roti Mix',         unit: 'Kg',    quantity: 25, lowStockThreshold: 5,  unitPurchasePrice: 150,  unitSellingPrice: 200 },
    { companyId: teaId, itemName: 'Honey (Local)',        unit: 'Liter', quantity: 15, lowStockThreshold: 3,  unitPurchasePrice: 700,  unitSellingPrice: 1000 },
  ];
  for (const i of teaInventory) await run(`Inventory: ${i.itemName}`, () => post('/api/v1/inventory', i));

  console.log('\n🍵 Tea House — Employees');
  const teaEmployees = [
    { companyId: teaId, employeeId: 'TEA-001', name: 'Ram Prasad Tamang', designation: 'Head Barista',  department: 'Operations', phone: '9802220001', email: 'ram@himalayan.com', basicSalary: 18000, dateOfJoining: '2024-01-15' },
    { companyId: teaId, employeeId: 'TEA-002', name: 'Sita Gurung',       designation: 'Cashier',       department: 'Finance',    phone: '9802220002', basicSalary: 14000, dateOfJoining: '2024-03-01' },
    { companyId: teaId, employeeId: 'TEA-003', name: 'Bikash Shrestha',   designation: 'Tea Maker',     department: 'Operations', phone: '9802220003', basicSalary: 13000, dateOfJoining: '2024-06-01' },
    { companyId: teaId, employeeId: 'TEA-004', name: 'Maya Lama',         designation: 'Cleaner',       department: 'Operations', phone: '9802220004', basicSalary: 11000, dateOfJoining: '2024-08-01' },
    { companyId: teaId, employeeId: 'TEA-005', name: 'Deepak Rai',        designation: 'Waiter',        department: 'Operations', phone: '9802220005', basicSalary: 12000, dateOfJoining: '2024-09-01' },
  ];
  for (const e of teaEmployees) await run(`Employee: ${e.name}`, () => post('/api/v1/employees', e));

  console.log('\n🍵 Tea House — Purchases');
  const teaPurchases = [
    { companyId: teaId, vendorName: 'Ilam Tea Suppliers',    dateAd: '2025-01-10', paymentMethod: 'CASH',   isVat: false, items: [{ description: 'Ilam Premium Tea',  quantity: 20, unit: 'Kg',    unitPrice: 800 }] },
    { companyId: teaId, vendorName: 'Dairy Fresh Pvt Ltd',   dateAd: '2025-01-15', paymentMethod: 'CASH',   isVat: false, items: [{ description: 'Full Cream Milk',    quantity: 50, unit: 'Liter', unitPrice: 90 }] },
    { companyId: teaId, vendorName: 'Himalayan Sugar Mills', dateAd: '2025-02-01', paymentMethod: 'CHEQUE', isVat: false, items: [{ description: 'Sugar',              quantity: 30, unit: 'Kg',    unitPrice: 75 }] },
    { companyId: teaId, vendorName: 'Everest Snacks Co',     dateAd: '2025-02-10', paymentMethod: 'CASH',   isVat: true,  items: [{ description: 'Sel Roti Mix',       quantity: 15, unit: 'Kg',    unitPrice: 150 }] },
    { companyId: teaId, vendorName: 'Ilam Tea Suppliers',    dateAd: '2025-03-01', paymentMethod: 'CASH',   isVat: false, items: [{ description: 'Masala Chai Mix',    quantity: 10, unit: 'Kg',    unitPrice: 600 }, { description: 'Green Tea Bags', quantity: 20, unit: 'Set', unitPrice: 250 }] },
    { companyId: teaId, vendorName: 'Kathmandu Paper Cups',  dateAd: '2025-03-15', paymentMethod: 'CASH',   isVat: false, items: [{ description: 'Paper Cups 100pcs', quantity: 50, unit: 'Set',   unitPrice: 120 }] },
  ];
  for (const p of teaPurchases) await run(`Purchase: ${p.vendorName} (${p.dateAd})`, () => post('/api/v1/purchases', p));

  console.log('\n🍵 Tea House — Sales');
  const teaSales = [
    { companyId: teaId, clientName: 'Sunrise Hotel',       dateAd: '2025-01-20', paymentMethod: 'CREDIT', isVat: true,  items: [{ description: 'Ilam Premium Tea',  quantity: 5,  unit: 'Kg',    unitPrice: 1200 }] },
    { companyId: teaId, clientName: 'TU Students Canteen', dateAd: '2025-02-05', paymentMethod: 'CASH',   isVat: false, items: [{ description: 'Masala Chai Mix',    quantity: 3,  unit: 'Kg',    unitPrice: 900 }] },
    { companyId: teaId, clientName: 'Mount View Resort',   dateAd: '2025-02-15', paymentMethod: 'CHEQUE', isVat: true,  items: [{ description: 'Ilam Premium Tea',  quantity: 8,  unit: 'Kg',    unitPrice: 1200 }, { description: 'Honey (Local)', quantity: 3, unit: 'Liter', unitPrice: 1000 }] },
    { companyId: teaId, clientName: 'Pokhara Tea Garden',  dateAd: '2025-02-28', paymentMethod: 'CASH',   isVat: false, items: [{ description: 'Green Tea Bags',     quantity: 10, unit: 'Set',   unitPrice: 400 }] },
    { companyId: teaId, clientName: 'Boudha Coffee & Tea', dateAd: '2025-03-10', paymentMethod: 'CREDIT', isVat: true,  items: [{ description: 'Masala Chai Mix',    quantity: 5,  unit: 'Kg',    unitPrice: 900 }, { description: 'Ilam Premium Tea', quantity: 3, unit: 'Kg', unitPrice: 1200 }] },
    { companyId: teaId, clientName: 'Sunrise Hotel',       dateAd: '2025-03-20', paymentMethod: 'CREDIT', isVat: true,  items: [{ description: 'Green Tea Bags',     quantity: 15, unit: 'Set',   unitPrice: 400 }] },
    { companyId: teaId, clientName: 'TU Students Canteen', dateAd: '2025-04-01', paymentMethod: 'CASH',   isVat: false, items: [{ description: 'Sel Roti Mix',       quantity: 5,  unit: 'Kg',    unitPrice: 200 }] },
    { companyId: teaId, clientName: 'Mount View Resort',   dateAd: '2025-04-15', paymentMethod: 'CHEQUE', isVat: true,  items: [{ description: 'Honey (Local)',      quantity: 5,  unit: 'Liter', unitPrice: 1000 }] },
  ];
  for (const s of teaSales) await run(`Sale: ${s.clientName} (${s.dateAd})`, () => post('/api/v1/sales', s));

  console.log('\n🍵 Tea House — Transactions');
  const teaAccounts = await ensureSystemAccounts(teaId);
  const teaTx = [
    { type: 'BANK',   category: 'INCOME',  dateAd: '2025-01-20', amount: 6780,  description: 'Payment from Sunrise Hotel INV-001', partyName: 'Sunrise Hotel' },
    { type: 'CASH',   category: 'INCOME',  dateAd: '2025-02-05', amount: 2700,  description: 'TU Canteen cash payment INV-002', partyName: 'TU Students Canteen' },
    { type: 'CASH',   category: 'EXPENSE', dateAd: '2025-01-10', amount: 16000, description: 'Ilam Tea purchase PO-001', partyName: 'Ilam Tea Suppliers' },
    { type: 'CASH',   category: 'EXPENSE', dateAd: '2025-01-15', amount: 4500,  description: 'Milk purchase PO-002', partyName: 'Dairy Fresh Pvt Ltd' },
    { type: 'BANK',   category: 'EXPENSE', dateAd: '2025-01-31', amount: 56000, description: 'January staff salaries' },
    { type: 'CASH',   category: 'EXPENSE', dateAd: '2025-02-01', amount: 15000, description: 'Thamel shop rent - February' },
    { type: 'CHEQUE', category: 'INCOME',  dateAd: '2025-02-15', amount: 14600, description: 'Mount View Resort payment INV-003', partyName: 'Mount View Resort' },
    { type: 'CASH',   category: 'EXPENSE', dateAd: '2025-03-01', amount: 5000,  description: 'Electricity bill March' },
    { type: 'QR',     category: 'INCOME',  dateAd: '2025-03-10', amount: 4000,  description: 'Pokhara Tea Garden INV-004', partyName: 'Pokhara Tea Garden' },
    { type: 'CHEQUE', category: 'EXPENSE', dateAd: '2025-02-01', amount: 2250,  description: 'Sugar purchase PO-003', partyName: 'Himalayan Sugar Mills' },
    { type: 'CREDIT', category: 'INCOME',  dateAd: '2025-03-20', amount: 8500,  description: 'Credit sale INV-005 — collection pending', partyName: 'Boudha Coffee & Tea', status: 'PENDING' },
    { type: 'CREDIT', category: 'EXPENSE', dateAd: '2025-03-15', amount: 9000,  description: 'Credit purchase PO-004 — payment pending', partyName: 'Everest Snacks Co', status: 'PENDING' },
  ];
  for (const t of teaTx) {
    const { debitAccountId, creditAccountId } = resolveTransactionAccounts(teaAccounts, t.type, t.category);
    await run(`Transaction: ${t.description.substring(0, 40)}`, () => post('/api/v1/transactions', { ...t, companyId: teaId, debitAccountId, creditAccountId }));
  }

  console.log('\n🍵 Tea House — Quotations');
  const teaQuotations = [
    { companyId: teaId, clientName: 'New Hotel Annapurna', quotationNumber: 'QT-001', dateAd: '2025-03-01', totalAmount: 24000, items: [{ description: 'Ilam Premium Tea',  quantity: 20, unit: 'Kg', unitPrice: 1200 }] },
    { companyId: teaId, clientName: 'Yak & Yeti Hotel',    quotationNumber: 'QT-002', dateAd: '2025-03-10', totalAmount: 17000, items: [{ description: 'Masala Chai Mix',    quantity: 10, unit: 'Kg', unitPrice: 900 }, { description: 'Green Tea Bags', quantity: 20, unit: 'Set', unitPrice: 400 }] },
    { companyId: teaId, clientName: 'KU Cafeteria',        quotationNumber: 'QT-003', dateAd: '2025-04-01', totalAmount: 5000,  items: [{ description: 'Sel Roti Mix',       quantity: 25, unit: 'Kg', unitPrice: 200 }] },
  ];
  for (const q of teaQuotations) await run(`Quotation: ${q.quotationNumber}`, () => post('/api/v1/quotations', q));

  console.log('\n🍵 Tea House — Tasks');
  const teaTasks = [
    { companyId: teaId, title: 'Follow up with Sunrise Hotel for payment',  description: 'INV-001 payment pending since Jan 20',         priority: 'HIGH',   status: 'PENDING',     dueDate: '2025-02-01', assignedTo: 'Sita Gurung' },
    { companyId: teaId, title: 'Reorder Ilam Tea stock',                    description: 'Stock below reorder level',                     priority: 'MEDIUM', status: 'IN_PROGRESS', dueDate: '2025-03-15', assignedTo: 'Ram Prasad Tamang' },
    { companyId: teaId, title: 'Renew Thamel shop lease',                   description: 'Lease expires June 2025',                       priority: 'HIGH',   status: 'PENDING',     dueDate: '2025-05-01', assignedTo: 'Admin' },
    { companyId: teaId, title: 'Train new barista on masala recipe',        description: 'Bikash needs training on new recipe',           priority: 'LOW',    status: 'COMPLETED',   dueDate: '2025-02-28', assignedTo: 'Ram Prasad Tamang' },
  ];
  for (const t of teaTasks) await run(`Task: ${t.title.substring(0, 40)}`, () => post('/api/v1/tasks', t));
}

// ─── 4. Pharmacy ──────────────────────────────────────────────────────────────

async function seedPharmacy() {
  console.log('\n💊 Pharmacy — Vendors');
  const pharmVendors = [
    { companyId: pharmId, name: 'Shangrila Pharma Distributors', phone: '9811110001', email: 'shangrila@pharma.com', address: 'Kalimati, Kathmandu', panVat: '444555666' },
    { companyId: pharmId, name: 'Nepal Drug House',              phone: '9811110002', address: 'New Road, Kathmandu', panVat: '777888999' },
    { companyId: pharmId, name: 'Himalayan Herbals Pvt Ltd',     phone: '9811110003', address: 'Budhanilkantha' },
    { companyId: pharmId, name: 'MediCare Imports',              phone: '9811110004', email: 'medicare@imports.com', address: 'Teku, Kathmandu' },
  ];
  for (const v of pharmVendors) await run(`Vendor: ${v.name}`, () => post('/api/v1/vendors', v));

  console.log('\n💊 Pharmacy — Clients');
  const pharmClients = [
    { companyId: pharmId, name: 'Dr. Suresh Clinic',        phone: '9822220001', email: 'drsuresh@clinic.com',    address: 'Baneshwor' },
    { companyId: pharmId, name: 'Patan Hospital Pharmacy',  phone: '9822220002', address: 'Patan' },
    { companyId: pharmId, name: 'Gramin Swastha Kendra',    phone: '9822220003', address: 'Bhaktapur' },
    { companyId: pharmId, name: 'Kathmandu Nursing Home',   phone: '9822220004', email: 'knursinghome@gmail.com', address: 'Chabahil' },
  ];
  for (const c of pharmClients) await run(`Client: ${c.name}`, () => post('/api/v1/clients', c));

  console.log('\n💊 Pharmacy — Bank Account');
  await run('Bank: Everest Bank Ltd', () => post('/api/v1/bank-accounts', {
    companyId: pharmId,
    bankName: 'Everest Bank Ltd',
    accountNumber: '0022030405060',
    branch: 'Baneshwor',
    currentBalance: 380000,
  }));

  console.log('\n💊 Pharmacy — Inventory');
  const pharmInventory = [
    { companyId: pharmId, itemName: 'Paracetamol 500mg',        unit: 'Piece', quantity: 500, lowStockThreshold: 100, unitPurchasePrice: 5,   unitSellingPrice: 8 },
    { companyId: pharmId, itemName: 'Amoxicillin 250mg',        unit: 'Piece', quantity: 300, lowStockThreshold: 50,  unitPurchasePrice: 12,  unitSellingPrice: 18 },
    { companyId: pharmId, itemName: 'ORS Packet',               unit: 'Piece', quantity: 200, lowStockThreshold: 50,  unitPurchasePrice: 15,  unitSellingPrice: 25 },
    { companyId: pharmId, itemName: 'Vitamin C 500mg',          unit: 'Piece', quantity: 400, lowStockThreshold: 80,  unitPurchasePrice: 8,   unitSellingPrice: 15 },
    { companyId: pharmId, itemName: 'Surgical Gloves (Box)',    unit: 'Set',   quantity: 50,  lowStockThreshold: 10,  unitPurchasePrice: 350, unitSellingPrice: 500 },
    { companyId: pharmId, itemName: 'Ibuprofen 400mg',          unit: 'Piece', quantity: 250, lowStockThreshold: 60,  unitPurchasePrice: 7,   unitSellingPrice: 12 },
    { companyId: pharmId, itemName: 'Antiseptic Solution 100ml',unit: 'Piece', quantity: 80,  lowStockThreshold: 20,  unitPurchasePrice: 120, unitSellingPrice: 180 },
    { companyId: pharmId, itemName: 'Diabetes Test Strips',     unit: 'Set',   quantity: 60,  lowStockThreshold: 15,  unitPurchasePrice: 800, unitSellingPrice: 1200 },
  ];
  for (const i of pharmInventory) await run(`Inventory: ${i.itemName}`, () => post('/api/v1/inventory', i));

  console.log('\n💊 Pharmacy — Employees');
  const pharmEmployees = [
    { companyId: pharmId, employeeId: 'PHA-001', name: 'Priya Maharjan', designation: 'Senior Pharmacist',    department: 'Operations', phone: '9833330001', basicSalary: 35000, dateOfJoining: '2023-05-01' },
    { companyId: pharmId, employeeId: 'PHA-002', name: 'Anil Thapa',     designation: 'Sales Staff',          department: 'Sales',      phone: '9833330002', basicSalary: 16000, dateOfJoining: '2024-01-15' },
    { companyId: pharmId, employeeId: 'PHA-003', name: 'Kamala Devi',    designation: 'Accountant',           department: 'Finance',    phone: '9833330003', basicSalary: 22000, dateOfJoining: '2023-08-01' },
    { companyId: pharmId, employeeId: 'PHA-004', name: 'Suresh Basnet',  designation: 'Pharmacist Assistant', department: 'Operations', phone: '9833330004', basicSalary: 18000, dateOfJoining: '2024-02-01' },
    { companyId: pharmId, employeeId: 'PHA-005', name: 'Nirmala Shrestha',designation: 'Billing Staff',       department: 'Finance',    phone: '9833330005', basicSalary: 15000, dateOfJoining: '2024-04-01' },
  ];
  for (const e of pharmEmployees) await run(`Employee: ${e.name}`, () => post('/api/v1/employees', e));

  console.log('\n💊 Pharmacy — Purchases');
  const pharmPurchases = [
    { companyId: pharmId, vendorName: 'Shangrila Pharma Distributors', dateAd: '2025-01-05', paymentMethod: 'CREDIT', isVat: true,  items: [{ description: 'Paracetamol 500mg',  quantity: 500, unit: 'Piece', unitPrice: 5 }, { description: 'Amoxicillin 250mg', quantity: 200, unit: 'Piece', unitPrice: 12 }] },
    { companyId: pharmId, vendorName: 'Nepal Drug House',              dateAd: '2025-01-20', paymentMethod: 'CASH',   isVat: true,  items: [{ description: 'ORS Packet',          quantity: 100, unit: 'Piece', unitPrice: 15 }, { description: 'Ibuprofen 400mg',   quantity: 200, unit: 'Piece', unitPrice: 7 }] },
    { companyId: pharmId, vendorName: 'Himalayan Herbals Pvt Ltd',     dateAd: '2025-02-10', paymentMethod: 'CHEQUE', isVat: false, items: [{ description: 'Vitamin C 500mg',     quantity: 300, unit: 'Piece', unitPrice: 8 }] },
    { companyId: pharmId, vendorName: 'MediCare Imports',              dateAd: '2025-02-25', paymentMethod: 'CREDIT', isVat: true,  items: [{ description: 'Surgical Gloves (Box)',quantity: 30, unit: 'Set',   unitPrice: 350 }, { description: 'Diabetes Test Strips', quantity: 30, unit: 'Set', unitPrice: 800 }] },
    { companyId: pharmId, vendorName: 'Shangrila Pharma Distributors', dateAd: '2025-03-10', paymentMethod: 'CREDIT', isVat: true,  items: [{ description: 'Antiseptic Solution 100ml', quantity: 50, unit: 'Piece', unitPrice: 120 }] },
  ];
  for (const p of pharmPurchases) await run(`Purchase: ${p.vendorName.substring(0, 25)} (${p.dateAd})`, () => post('/api/v1/purchases', p));

  console.log('\n💊 Pharmacy — Sales');
  const pharmSales = [
    { companyId: pharmId, clientName: 'Dr. Suresh Clinic',       dateAd: '2025-01-15', paymentMethod: 'CREDIT', isVat: true,  items: [{ description: 'Paracetamol 500mg',      quantity: 100, unit: 'Piece', unitPrice: 8 }, { description: 'Amoxicillin 250mg', quantity: 50, unit: 'Piece', unitPrice: 18 }] },
    { companyId: pharmId, clientName: 'Patan Hospital Pharmacy', dateAd: '2025-02-01', paymentMethod: 'CHEQUE', isVat: true,  items: [{ description: 'ORS Packet',              quantity: 80,  unit: 'Piece', unitPrice: 25 }, { description: 'Surgical Gloves (Box)', quantity: 10, unit: 'Set', unitPrice: 500 }] },
    { companyId: pharmId, clientName: 'Gramin Swastha Kendra',   dateAd: '2025-02-20', paymentMethod: 'CASH',   isVat: false, items: [{ description: 'Vitamin C 500mg',         quantity: 150, unit: 'Piece', unitPrice: 15 }, { description: 'Ibuprofen 400mg', quantity: 100, unit: 'Piece', unitPrice: 12 }] },
    { companyId: pharmId, clientName: 'Kathmandu Nursing Home',  dateAd: '2025-03-05', paymentMethod: 'CREDIT', isVat: true,  items: [{ description: 'Diabetes Test Strips',    quantity: 20,  unit: 'Set',   unitPrice: 1200 }] },
    { companyId: pharmId, clientName: 'Dr. Suresh Clinic',       dateAd: '2025-03-15', paymentMethod: 'CREDIT', isVat: true,  items: [{ description: 'Antiseptic Solution 100ml',quantity: 20, unit: 'Piece', unitPrice: 180 }] },
    { companyId: pharmId, clientName: 'Patan Hospital Pharmacy', dateAd: '2025-04-01', paymentMethod: 'CHEQUE', isVat: true,  items: [{ description: 'Paracetamol 500mg',      quantity: 200, unit: 'Piece', unitPrice: 8 }, { description: 'Amoxicillin 250mg', quantity: 100, unit: 'Piece', unitPrice: 18 }] },
  ];
  for (const s of pharmSales) await run(`Sale: ${s.clientName} (${s.dateAd})`, () => post('/api/v1/sales', s));

  console.log('\n💊 Pharmacy — Transactions');
  const pharmAccounts = await ensureSystemAccounts(pharmId);
  const pharmTx = [
    { type: 'BANK',   category: 'INCOME',  dateAd: '2025-01-15', amount: 1921,  description: 'Dr. Suresh Clinic PINV-001', partyName: 'Dr. Suresh Clinic' },
    { type: 'BANK',   category: 'EXPENSE', dateAd: '2025-01-05', amount: 5537,  description: 'Shangrila Pharma PPO-001', partyName: 'Shangrila Pharma Distributors' },
    { type: 'BANK',   category: 'EXPENSE', dateAd: '2025-01-31', amount: 73000, description: 'January staff salaries' },
    { type: 'CASH',   category: 'EXPENSE', dateAd: '2025-02-01', amount: 25000, description: 'Baneshwor shop rent' },
    { type: 'CHEQUE', category: 'INCOME',  dateAd: '2025-02-01', amount: 7910,  description: 'Patan Hospital PINV-002', partyName: 'Patan Hospital Pharmacy' },
    { type: 'CASH',   category: 'INCOME',  dateAd: '2025-02-20', amount: 3450,  description: 'Gramin Swastha PINV-003', partyName: 'Gramin Swastha Kendra' },
    { type: 'CHEQUE', category: 'EXPENSE', dateAd: '2025-02-10', amount: 2900,  description: 'Himalayan Herbals PPO-003', partyName: 'Himalayan Herbals Pvt Ltd' },
    { type: 'CASH',   category: 'EXPENSE', dateAd: '2025-03-01', amount: 8000,  description: 'Electricity + water bills' },
    { type: 'QR',     category: 'INCOME',  dateAd: '2025-03-15', amount: 5200,  description: 'Kathmandu Nursing Home PINV-004', partyName: 'Kathmandu Nursing Home' },
    { type: 'CREDIT', category: 'INCOME',  dateAd: '2025-04-05', amount: 6300,  description: 'Credit sale PINV-005 — collection pending', partyName: 'Dr. Suresh Clinic', status: 'PENDING' },
    { type: 'CREDIT', category: 'EXPENSE', dateAd: '2025-03-25', amount: 4800,  description: 'Credit purchase PPO-004 — payment pending', partyName: 'MediCare Imports', status: 'PENDING' },
  ];
  for (const t of pharmTx) {
    const { debitAccountId, creditAccountId } = resolveTransactionAccounts(pharmAccounts, t.type, t.category);
    await run(`Transaction: ${t.description.substring(0, 40)}`, () => post('/api/v1/transactions', { ...t, companyId: pharmId, debitAccountId, creditAccountId }));
  }

  console.log('\n💊 Pharmacy — Quotations');
  const pharmQuotations = [
    { companyId: pharmId, clientName: 'Gramin Swastha Kendra',  quotationNumber: 'PQT-001', dateAd: '2025-03-01', totalAmount: 9000,  items: [{ description: 'Paracetamol 500mg', quantity: 500, unit: 'Piece', unitPrice: 8 }, { description: 'ORS Packet', quantity: 200, unit: 'Piece', unitPrice: 25 }] },
    { companyId: pharmId, clientName: 'Kathmandu Nursing Home', quotationNumber: 'PQT-002', dateAd: '2025-03-20', totalAmount: 60000, items: [{ description: 'Diabetes Test Strips', quantity: 50, unit: 'Set', unitPrice: 1200 }] },
  ];
  for (const q of pharmQuotations) await run(`Quotation: ${q.quotationNumber}`, () => post('/api/v1/quotations', q));

  console.log('\n💊 Pharmacy — Tasks');
  const pharmTasks = [
    { companyId: pharmId, title: 'Collect payment from Kathmandu Nursing Home', description: 'PINV-004 worth NPR 27,120 outstanding', priority: 'HIGH',   status: 'PENDING',     dueDate: '2025-04-15', assignedTo: 'Kamala Devi' },
    { companyId: pharmId, title: 'Drug retail license renewal',                 description: 'Annual renewal due June 2025',          priority: 'HIGH',   status: 'PENDING',     dueDate: '2025-05-15', assignedTo: 'Priya Maharjan' },
    { companyId: pharmId, title: 'Monthly physical stock count',                description: 'Verify all medicine quantities',        priority: 'MEDIUM', status: 'IN_PROGRESS', dueDate: '2025-04-30', assignedTo: 'Anil Thapa' },
  ];
  for (const t of pharmTasks) await run(`Task: ${t.title.substring(0, 40)}`, () => post('/api/v1/tasks', t));
}

// ─── 5. Verification ──────────────────────────────────────────────────────────

async function verify() {
  console.log('\n📊 Verification');
  const checks = [
    { label: 'Tea House — Vendors',      path: `/api/v1/vendors?companyId=${teaId}`,        expected: 5 },
    { label: 'Tea House — Clients',      path: `/api/v1/clients?companyId=${teaId}`,        expected: 5 },
    { label: 'Tea House — Inventory',    path: `/api/v1/inventory?companyId=${teaId}`,      expected: 8 },
    { label: 'Tea House — Employees',    path: `/api/v1/employees?companyId=${teaId}`,      expected: 5 },
    { label: 'Tea House — Purchases',    path: `/api/v1/purchases?companyId=${teaId}`,      expected: 6 },
    { label: 'Tea House — Sales',        path: `/api/v1/sales?companyId=${teaId}`,          expected: 8 },
    { label: 'Tea House — Transactions', path: `/api/v1/transactions?companyId=${teaId}`,   expected: 12 },
    { label: 'Tea House — Quotations',   path: `/api/v1/quotations?companyId=${teaId}`,     expected: 3 },
    { label: 'Tea House — Tasks',        path: `/api/v1/tasks?companyId=${teaId}`,          expected: 4 },
    { label: 'Pharmacy — Vendors',       path: `/api/v1/vendors?companyId=${pharmId}`,      expected: 4 },
    { label: 'Pharmacy — Clients',       path: `/api/v1/clients?companyId=${pharmId}`,      expected: 4 },
    { label: 'Pharmacy — Inventory',     path: `/api/v1/inventory?companyId=${pharmId}`,    expected: 8 },
    { label: 'Pharmacy — Employees',     path: `/api/v1/employees?companyId=${pharmId}`,    expected: 5 },
    { label: 'Pharmacy — Purchases',     path: `/api/v1/purchases?companyId=${pharmId}`,    expected: 5 },
    { label: 'Pharmacy — Sales',         path: `/api/v1/sales?companyId=${pharmId}`,        expected: 6 },
    { label: 'Pharmacy — Transactions',  path: `/api/v1/transactions?companyId=${pharmId}`, expected: 10 },
    { label: 'Pharmacy — Quotations',    path: `/api/v1/quotations?companyId=${pharmId}`,   expected: 2 },
    { label: 'Pharmacy — Tasks',         path: `/api/v1/tasks?companyId=${pharmId}`,        expected: 3 },
  ];

  for (const c of checks) {
    await run(`${c.label} (≥${c.expected})`, async () => {
      const data = await get(c.path);
      const arr = Array.isArray(data) ? data : (data.data || data.items || []);
      if (arr.length < c.expected) throw new Error(`Got ${arr.length}, expected ${c.expected}`);
    });
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🚀 EasyBooks Seed Script');
  console.log('========================');

  try {
    await seedAuth();
    if (!cookies) { console.log('\n❌ Cannot continue without auth. Is the backend running?'); process.exit(1); }

    await seedCompanies();
    if (!teaId || !pharmId) { console.log('\n❌ Cannot continue without company IDs.'); process.exit(1); }

    console.log(`\n📌 Tea House ID: ${teaId}`);
    console.log(`📌 Pharmacy ID:  ${pharmId}`);

    await seedTeaHouse();
    await seedPharmacy();
    await verify();

  } catch (err) {
    console.error('\n💥 Fatal error:', err.message);
  }

  console.log('\n========================');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📦 Total:  ${passed + failed}`);
  console.log('========================\n');
}

main();
