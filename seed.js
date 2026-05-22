// EasyBooks Seed Script
// Run: node seed.js
// Make sure backend is running on http://localhost:3000

const BASE = 'http://localhost:3000';
let token = '';
let teaId = '';
let pharmId = '';

let passed = 0;
let failed = 0;

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

async function post(path, body, auth = true) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`POST ${path} → ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

async function get(path, auth = true) {
  const headers = {};
  if (auth) headers['Authorization'] = `Bearer ${token}`;
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

// ─── 1. Auth ──────────────────────────────────────────────────────────────────

async function seedAuth() {
  console.log('\n🔐 Auth');

  await run('Register user', async () => {
    return post('/api/v1/auth/register', {
      name: 'Aaditya Joshi',
      email: 'demo@easybooks.com',
      password: 'Demo@1234',
    }, false).catch(() => null); // ignore if already exists
  });

  await run('Login', async () => {
    const data = await post('/api/v1/auth/login', {
      email: 'demo@easybooks.com',
      password: 'Demo@1234',
    }, false);
    token = data.accessToken || data.access_token || data.token;
    if (!token) throw new Error('No token in response: ' + JSON.stringify(data));
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
      pan: '123456789',
      type: 'Restaurant',
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
      pan: '987654321',
      type: 'Pharmacy',
    });
    pharmId = data.id;
    if (!pharmId) throw new Error('No ID returned');
  });
}

// ─── 3. Tea House Data ────────────────────────────────────────────────────────

async function seedTeaHouse() {
  console.log('\n🍵 Tea House — Vendors');
  const teaVendors = [
    { name: 'Ilam Tea Suppliers', phone: '9800001111', email: 'ilam@tea.com', address: 'Ilam, Province 1', pan_vat: '111222333', companyId: teaId },
    { name: 'Dairy Fresh Pvt Ltd', phone: '9800002222', email: 'dairy@fresh.com', address: 'Bhaktapur', companyId: teaId },
    { name: 'Himalayan Sugar Mills', phone: '9800003333', address: 'Birgunj', companyId: teaId },
    { name: 'Everest Snacks Co', phone: '9800004444', address: 'Patan', companyId: teaId },
    { name: 'Kathmandu Paper Cups', phone: '9800005555', address: 'Koteshwor', companyId: teaId },
  ];
  for (const v of teaVendors) await run(`Vendor: ${v.name}`, () => post('/api/v1/vendors', v));

  console.log('\n🍵 Tea House — Clients');
  const teaClients = [
    { name: 'Sunrise Hotel', phone: '9801111001', email: 'sunrise@hotel.com', address: 'Thamel', companyId: teaId },
    { name: 'TU Students Canteen', phone: '9801111002', address: 'Kirtipur', companyId: teaId },
    { name: 'Mount View Resort', phone: '9801111003', email: 'mountview@resort.com', address: 'Nagarkot', companyId: teaId },
    { name: 'Pokhara Tea Garden', phone: '9801111004', address: 'Pokhara', companyId: teaId },
    { name: 'Boudha Coffee & Tea', phone: '9801111005', address: 'Boudha', companyId: teaId },
  ];
  for (const c of teaClients) await run(`Client: ${c.name}`, () => post('/api/v1/clients', c));

  console.log('\n🍵 Tea House — Bank Account');
  await run('Bank: Nepal Bank Ltd', () => post('/api/v1/bank-accounts', {
    bank_name: 'Nepal Bank Ltd', account_number: '0011020304050',
    account_holder: 'Himalayan Tea House', branch: 'Thamel',
    current_balance: 250000, companyId: teaId,
  }));

  console.log('\n🍵 Tea House — Inventory');
  const teaInventory = [
    { name: 'Ilam Premium Tea', unit: 'Kg', quantity: 50, reorder_level: 10, cost_price: 800, selling_price: 1200, category: 'Tea', companyId: teaId },
    { name: 'Milk (Full Cream)', unit: 'Liter', quantity: 30, reorder_level: 10, cost_price: 90, selling_price: 100, category: 'Dairy', companyId: teaId },
    { name: 'Sugar', unit: 'Kg', quantity: 40, reorder_level: 5, cost_price: 75, selling_price: 80, category: 'Ingredient', companyId: teaId },
    { name: 'Masala Chai Mix', unit: 'Kg', quantity: 20, reorder_level: 5, cost_price: 600, selling_price: 900, category: 'Tea', companyId: teaId },
    { name: 'Paper Cups (100pcs)', unit: 'Set', quantity: 100, reorder_level: 20, cost_price: 120, selling_price: 150, category: 'Packaging', companyId: teaId },
    { name: 'Green Tea Bags', unit: 'Set', quantity: 60, reorder_level: 15, cost_price: 250, selling_price: 400, category: 'Tea', companyId: teaId },
    { name: 'Sel Roti Mix', unit: 'Kg', quantity: 25, reorder_level: 5, cost_price: 150, selling_price: 200, category: 'Snacks', companyId: teaId },
    { name: 'Honey (Local)', unit: 'Liter', quantity: 15, reorder_level: 3, cost_price: 700, selling_price: 1000, category: 'Ingredient', companyId: teaId },
  ];
  for (const i of teaInventory) await run(`Inventory: ${i.name}`, () => post('/api/v1/inventory', i));

  console.log('\n🍵 Tea House — Employees');
  const teaEmployees = [
    { name: 'Ram Prasad Tamang', designation: 'Head Barista', department: 'Operations', phone: '9802220001', email: 'ram@himalayan.com', salary: 18000, join_date: '2024-01-15', companyId: teaId },
    { name: 'Sita Gurung', designation: 'Cashier', department: 'Finance', phone: '9802220002', salary: 14000, join_date: '2024-03-01', companyId: teaId },
    { name: 'Bikash Shrestha', designation: 'Tea Maker', department: 'Operations', phone: '9802220003', salary: 13000, join_date: '2024-06-01', companyId: teaId },
    { name: 'Maya Lama', designation: 'Cleaner', department: 'Operations', phone: '9802220004', salary: 11000, join_date: '2024-08-01', companyId: teaId },
    { name: 'Deepak Rai', designation: 'Waiter', department: 'Operations', phone: '9802220005', salary: 12000, join_date: '2024-09-01', companyId: teaId },
  ];
  for (const e of teaEmployees) await run(`Employee: ${e.name}`, () => post('/api/v1/employees', e));

  console.log('\n🍵 Tea House — Purchases');
  const teaPurchases = [
    { vendor_name: 'Ilam Tea Suppliers', order_number: 'PO-001', date_ad: '2025-01-10', payment_type: 'cash', is_vat: false, notes: '', items: [{ description: 'Ilam Premium Tea', quantity: 20, unit: 'Kg', unit_price: 800, total: 16000 }], labor_items: [], companyId: teaId },
    { vendor_name: 'Dairy Fresh Pvt Ltd', order_number: 'PO-002', date_ad: '2025-01-15', payment_type: 'cash', is_vat: false, notes: '', items: [{ description: 'Full Cream Milk', quantity: 50, unit: 'Liter', unit_price: 90, total: 4500 }], labor_items: [], companyId: teaId },
    { vendor_name: 'Himalayan Sugar Mills', order_number: 'PO-003', date_ad: '2025-02-01', payment_type: 'cheque', is_vat: false, notes: '', items: [{ description: 'Sugar', quantity: 30, unit: 'Kg', unit_price: 75, total: 2250 }], labor_items: [], companyId: teaId },
    { vendor_name: 'Everest Snacks Co', order_number: 'PO-004', date_ad: '2025-02-10', payment_type: 'cash', is_vat: true, notes: '', items: [{ description: 'Sel Roti Mix', quantity: 15, unit: 'Kg', unit_price: 150, total: 2250 }], labor_items: [], companyId: teaId },
    { vendor_name: 'Ilam Tea Suppliers', order_number: 'PO-005', date_ad: '2025-03-01', payment_type: 'cash', is_vat: false, notes: '', items: [{ description: 'Masala Chai Mix', quantity: 10, unit: 'Kg', unit_price: 600, total: 6000 }, { description: 'Green Tea Bags', quantity: 20, unit: 'Set', unit_price: 250, total: 5000 }], labor_items: [], companyId: teaId },
    { vendor_name: 'Kathmandu Paper Cups', order_number: 'PO-006', date_ad: '2025-03-15', payment_type: 'cash', is_vat: false, notes: '', items: [{ description: 'Paper Cups 100pcs', quantity: 50, unit: 'Set', unit_price: 120, total: 6000 }], labor_items: [], companyId: teaId },
  ];
  for (const p of teaPurchases) await run(`Purchase: ${p.order_number}`, () => post('/api/v1/purchases', p));

  console.log('\n🍵 Tea House — Sales');
  const teaSales = [
    { client_name: 'Sunrise Hotel', invoice_number: 'INV-001', date_ad: '2025-01-20', payment_type: 'credit', is_vat: true, notes: '', items: [{ description: 'Ilam Premium Tea', quantity: 5, unit: 'Kg', unit_price: 1200, total: 6000 }], labor_items: [], companyId: teaId },
    { client_name: 'TU Students Canteen', invoice_number: 'INV-002', date_ad: '2025-02-05', payment_type: 'cash', is_vat: false, notes: '', items: [{ description: 'Masala Chai Mix', quantity: 3, unit: 'Kg', unit_price: 900, total: 2700 }], labor_items: [], companyId: teaId },
    { client_name: 'Mount View Resort', invoice_number: 'INV-003', date_ad: '2025-02-15', payment_type: 'cheque', is_vat: true, notes: '', items: [{ description: 'Ilam Premium Tea', quantity: 8, unit: 'Kg', unit_price: 1200, total: 9600 }, { description: 'Honey (Local)', quantity: 3, unit: 'Liter', unit_price: 1000, total: 3000 }], labor_items: [], companyId: teaId },
    { client_name: 'Pokhara Tea Garden', invoice_number: 'INV-004', date_ad: '2025-02-28', payment_type: 'cash', is_vat: false, notes: '', items: [{ description: 'Green Tea Bags', quantity: 10, unit: 'Set', unit_price: 400, total: 4000 }], labor_items: [], companyId: teaId },
    { client_name: 'Boudha Coffee & Tea', invoice_number: 'INV-005', date_ad: '2025-03-10', payment_type: 'credit', is_vat: true, notes: '', items: [{ description: 'Masala Chai Mix', quantity: 5, unit: 'Kg', unit_price: 900, total: 4500 }, { description: 'Ilam Premium Tea', quantity: 3, unit: 'Kg', unit_price: 1200, total: 3600 }], labor_items: [], companyId: teaId },
    { client_name: 'Sunrise Hotel', invoice_number: 'INV-006', date_ad: '2025-03-20', payment_type: 'credit', is_vat: true, notes: '', items: [{ description: 'Green Tea Bags', quantity: 15, unit: 'Set', unit_price: 400, total: 6000 }], labor_items: [], companyId: teaId },
    { client_name: 'TU Students Canteen', invoice_number: 'INV-007', date_ad: '2025-04-01', payment_type: 'cash', is_vat: false, notes: '', items: [{ description: 'Sel Roti Mix', quantity: 5, unit: 'Kg', unit_price: 200, total: 1000 }], labor_items: [], companyId: teaId },
    { client_name: 'Mount View Resort', invoice_number: 'INV-008', date_ad: '2025-04-15', payment_type: 'cheque', is_vat: true, notes: '', items: [{ description: 'Honey (Local)', quantity: 5, unit: 'Liter', unit_price: 1000, total: 5000 }], labor_items: [], companyId: teaId },
  ];
  for (const s of teaSales) await run(`Sale: ${s.invoice_number}`, () => post('/api/v1/sales', s));

  console.log('\n🍵 Tea House — Transactions');
  const teaTx = [
    { type: 'income', amount: 6780, date: '2025-01-20', description: 'Payment from Sunrise Hotel INV-001', party_name: 'Sunrise Hotel', category: 'Sales', payment_method: 'bank_transfer', companyId: teaId },
    { type: 'income', amount: 2700, date: '2025-02-05', description: 'TU Canteen cash payment INV-002', party_name: 'TU Students Canteen', category: 'Sales', payment_method: 'cash', companyId: teaId },
    { type: 'expense', amount: 16000, date: '2025-01-10', description: 'Ilam Tea purchase PO-001', party_name: 'Ilam Tea Suppliers', category: 'Purchases', payment_method: 'cash', companyId: teaId },
    { type: 'expense', amount: 4500, date: '2025-01-15', description: 'Milk purchase PO-002', party_name: 'Dairy Fresh Pvt Ltd', category: 'Purchases', payment_method: 'cash', companyId: teaId },
    { type: 'expense', amount: 56000, date: '2025-01-31', description: 'January staff salaries', party_name: 'Staff Payroll', category: 'Salaries', payment_method: 'bank_transfer', companyId: teaId },
    { type: 'expense', amount: 15000, date: '2025-02-01', description: 'Thamel shop rent - February', party_name: 'Landlord', category: 'Rent', payment_method: 'cash', companyId: teaId },
    { type: 'income', amount: 14600, date: '2025-02-15', description: 'Mount View Resort payment INV-003', party_name: 'Mount View Resort', category: 'Sales', payment_method: 'cheque', companyId: teaId },
    { type: 'expense', amount: 5000, date: '2025-03-01', description: 'Electricity bill March', party_name: 'NEA', category: 'Utilities', payment_method: 'cash', companyId: teaId },
    { type: 'income', amount: 4000, date: '2025-03-10', description: 'Pokhara Tea Garden INV-004', party_name: 'Pokhara Tea Garden', category: 'Sales', payment_method: 'cash', companyId: teaId },
    { type: 'expense', amount: 2250, date: '2025-02-01', description: 'Sugar purchase PO-003', party_name: 'Himalayan Sugar Mills', category: 'Purchases', payment_method: 'cheque', companyId: teaId },
  ];
  for (const t of teaTx) await run(`Transaction: ${t.description.substring(0, 35)}`, () => post('/api/v1/transactions', t));

  console.log('\n🍵 Tea House — Quotations');
  const teaQuotations = [
    { client_name: 'New Hotel Annapurna', quotation_number: 'QT-001', date_ad: '2025-03-01', valid_until: '2025-04-01', payment_type: 'credit', is_vat: true, status: 'pending', notes: 'Bulk tea supply contract', items: [{ description: 'Ilam Premium Tea', quantity: 20, unit: 'Kg', unit_price: 1200, total: 24000 }], labor_items: [], companyId: teaId },
    { client_name: 'Yak & Yeti Hotel', quotation_number: 'QT-002', date_ad: '2025-03-10', valid_until: '2025-04-10', payment_type: 'cheque', is_vat: true, status: 'accepted', notes: '', items: [{ description: 'Masala Chai Mix', quantity: 10, unit: 'Kg', unit_price: 900, total: 9000 }, { description: 'Green Tea Bags', quantity: 20, unit: 'Set', unit_price: 400, total: 8000 }], labor_items: [], companyId: teaId },
    { client_name: 'KU Cafeteria', quotation_number: 'QT-003', date_ad: '2025-04-01', valid_until: '2025-05-01', payment_type: 'cash', is_vat: false, status: 'pending', notes: '', items: [{ description: 'Sel Roti Mix', quantity: 25, unit: 'Kg', unit_price: 200, total: 5000 }], labor_items: [], companyId: teaId },
  ];
  for (const q of teaQuotations) await run(`Quotation: ${q.quotation_number}`, () => post('/api/v1/quotations', q));

  console.log('\n🍵 Tea House — Tasks');
  const teaTasks = [
    { title: 'Follow up with Sunrise Hotel for payment', description: 'INV-001 payment pending since Jan 20', priority: 'High', status: 'Pending', due_date: '2025-02-01', category: 'Finance', assigned_to: 'Sita Gurung', companyId: teaId },
    { title: 'Reorder Ilam Tea stock', description: 'Stock below reorder level — contact Ilam Tea Suppliers', priority: 'Medium', status: 'In Progress', due_date: '2025-03-15', category: 'Operations', assigned_to: 'Ram Prasad Tamang', companyId: teaId },
    { title: 'Renew Thamel shop lease', description: 'Lease expires June 2025', priority: 'High', status: 'Pending', due_date: '2025-05-01', category: 'Admin', assigned_to: 'Aaditya Joshi', companyId: teaId },
    { title: 'Train new barista on masala recipe', description: 'Bikash needs training on new recipe', priority: 'Low', status: 'Done', due_date: '2025-02-28', category: 'HR', assigned_to: 'Ram Prasad Tamang', companyId: teaId },
  ];
  for (const t of teaTasks) await run(`Task: ${t.title.substring(0, 40)}`, () => post('/api/v1/tasks', t));
}

// ─── 4. Pharmacy Data ─────────────────────────────────────────────────────────

async function seedPharmacy() {
  console.log('\n💊 Pharmacy — Vendors');
  const pharmVendors = [
    { name: 'Shangrila Pharma Distributors', phone: '9811110001', email: 'shangrila@pharma.com', address: 'Kalimati, Kathmandu', pan_vat: '444555666', companyId: pharmId },
    { name: 'Nepal Drug House', phone: '9811110002', address: 'New Road, Kathmandu', pan_vat: '777888999', companyId: pharmId },
    { name: 'Himalayan Herbals Pvt Ltd', phone: '9811110003', address: 'Budhanilkantha', companyId: pharmId },
    { name: 'MediCare Imports', phone: '9811110004', email: 'medicare@imports.com', address: 'Teku, Kathmandu', companyId: pharmId },
  ];
  for (const v of pharmVendors) await run(`Vendor: ${v.name}`, () => post('/api/v1/vendors', v));

  console.log('\n💊 Pharmacy — Clients');
  const pharmClients = [
    { name: 'Dr. Suresh Clinic', phone: '9822220001', email: 'drsuresh@clinic.com', address: 'Baneshwor', companyId: pharmId },
    { name: 'Patan Hospital Pharmacy', phone: '9822220002', address: 'Patan', companyId: pharmId },
    { name: 'Gramin Swastha Kendra', phone: '9822220003', address: 'Bhaktapur', companyId: pharmId },
    { name: 'Kathmandu Nursing Home', phone: '9822220004', email: 'knursinghome@gmail.com', address: 'Chabahil', companyId: pharmId },
  ];
  for (const c of pharmClients) await run(`Client: ${c.name}`, () => post('/api/v1/clients', c));

  console.log('\n💊 Pharmacy — Bank Account');
  await run('Bank: Everest Bank Ltd', () => post('/api/v1/bank-accounts', {
    bank_name: 'Everest Bank Ltd', account_number: '0022030405060',
    account_holder: 'Nepal Pharmacy', branch: 'Baneshwor',
    current_balance: 380000, companyId: pharmId,
  }));

  console.log('\n💊 Pharmacy — Inventory');
  const pharmInventory = [
    { name: 'Paracetamol 500mg', unit: 'Piece', quantity: 500, reorder_level: 100, cost_price: 5, selling_price: 8, category: 'Medicine', companyId: pharmId },
    { name: 'Amoxicillin 250mg', unit: 'Piece', quantity: 300, reorder_level: 50, cost_price: 12, selling_price: 18, category: 'Antibiotic', companyId: pharmId },
    { name: 'ORS Packet', unit: 'Piece', quantity: 200, reorder_level: 50, cost_price: 15, selling_price: 25, category: 'Medicine', companyId: pharmId },
    { name: 'Vitamin C 500mg', unit: 'Piece', quantity: 400, reorder_level: 80, cost_price: 8, selling_price: 15, category: 'Supplement', companyId: pharmId },
    { name: 'Surgical Gloves (Box)', unit: 'Set', quantity: 50, reorder_level: 10, cost_price: 350, selling_price: 500, category: 'Equipment', companyId: pharmId },
    { name: 'Ibuprofen 400mg', unit: 'Piece', quantity: 250, reorder_level: 60, cost_price: 7, selling_price: 12, category: 'Medicine', companyId: pharmId },
    { name: 'Antiseptic Solution 100ml', unit: 'Piece', quantity: 80, reorder_level: 20, cost_price: 120, selling_price: 180, category: 'Medicine', companyId: pharmId },
    { name: 'Diabetes Test Strips', unit: 'Set', quantity: 60, reorder_level: 15, cost_price: 800, selling_price: 1200, category: 'Equipment', companyId: pharmId },
  ];
  for (const i of pharmInventory) await run(`Inventory: ${i.name}`, () => post('/api/v1/inventory', i));

  console.log('\n💊 Pharmacy — Employees');
  const pharmEmployees = [
    { name: 'Priya Maharjan', designation: 'Senior Pharmacist', department: 'Operations', phone: '9833330001', salary: 35000, join_date: '2023-05-01', companyId: pharmId },
    { name: 'Anil Thapa', designation: 'Sales Staff', department: 'Sales', phone: '9833330002', salary: 16000, join_date: '2024-01-15', companyId: pharmId },
    { name: 'Kamala Devi', designation: 'Accountant', department: 'Finance', phone: '9833330003', salary: 22000, join_date: '2023-08-01', companyId: pharmId },
    { name: 'Suresh Basnet', designation: 'Pharmacist Assistant', department: 'Operations', phone: '9833330004', salary: 18000, join_date: '2024-02-01', companyId: pharmId },
    { name: 'Nirmala Shrestha', designation: 'Billing Staff', department: 'Finance', phone: '9833330005', salary: 15000, join_date: '2024-04-01', companyId: pharmId },
  ];
  for (const e of pharmEmployees) await run(`Employee: ${e.name}`, () => post('/api/v1/employees', e));

  console.log('\n💊 Pharmacy — Purchases');
  const pharmPurchases = [
    { vendor_name: 'Shangrila Pharma Distributors', order_number: 'PPO-001', date_ad: '2025-01-05', payment_type: 'credit', is_vat: true, notes: '', items: [{ description: 'Paracetamol 500mg', quantity: 500, unit: 'Piece', unit_price: 5, total: 2500 }, { description: 'Amoxicillin 250mg', quantity: 200, unit: 'Piece', unit_price: 12, total: 2400 }], labor_items: [], companyId: pharmId },
    { vendor_name: 'Nepal Drug House', order_number: 'PPO-002', date_ad: '2025-01-20', payment_type: 'cash', is_vat: true, notes: '', items: [{ description: 'ORS Packet', quantity: 100, unit: 'Piece', unit_price: 15, total: 1500 }, { description: 'Ibuprofen 400mg', quantity: 200, unit: 'Piece', unit_price: 7, total: 1400 }], labor_items: [], companyId: pharmId },
    { vendor_name: 'Himalayan Herbals Pvt Ltd', order_number: 'PPO-003', date_ad: '2025-02-10', payment_type: 'cheque', is_vat: false, notes: '', items: [{ description: 'Vitamin C 500mg', quantity: 300, unit: 'Piece', unit_price: 8, total: 2400 }], labor_items: [], companyId: pharmId },
    { vendor_name: 'MediCare Imports', order_number: 'PPO-004', date_ad: '2025-02-25', payment_type: 'credit', is_vat: true, notes: '', items: [{ description: 'Surgical Gloves (Box)', quantity: 30, unit: 'Set', unit_price: 350, total: 10500 }, { description: 'Diabetes Test Strips', quantity: 30, unit: 'Set', unit_price: 800, total: 24000 }], labor_items: [], companyId: pharmId },
    { vendor_name: 'Shangrila Pharma Distributors', order_number: 'PPO-005', date_ad: '2025-03-10', payment_type: 'credit', is_vat: true, notes: '', items: [{ description: 'Antiseptic Solution 100ml', quantity: 50, unit: 'Piece', unit_price: 120, total: 6000 }], labor_items: [], companyId: pharmId },
  ];
  for (const p of pharmPurchases) await run(`Purchase: ${p.order_number}`, () => post('/api/v1/purchases', p));

  console.log('\n💊 Pharmacy — Sales');
  const pharmSales = [
    { client_name: 'Dr. Suresh Clinic', invoice_number: 'PINV-001', date_ad: '2025-01-15', payment_type: 'credit', is_vat: true, notes: '', items: [{ description: 'Paracetamol 500mg', quantity: 100, unit: 'Piece', unit_price: 8, total: 800 }, { description: 'Amoxicillin 250mg', quantity: 50, unit: 'Piece', unit_price: 18, total: 900 }], labor_items: [], companyId: pharmId },
    { client_name: 'Patan Hospital Pharmacy', invoice_number: 'PINV-002', date_ad: '2025-02-01', payment_type: 'cheque', is_vat: true, notes: '', items: [{ description: 'ORS Packet', quantity: 80, unit: 'Piece', unit_price: 25, total: 2000 }, { description: 'Surgical Gloves (Box)', quantity: 10, unit: 'Set', unit_price: 500, total: 5000 }], labor_items: [], companyId: pharmId },
    { client_name: 'Gramin Swastha Kendra', invoice_number: 'PINV-003', date_ad: '2025-02-20', payment_type: 'cash', is_vat: false, notes: '', items: [{ description: 'Vitamin C 500mg', quantity: 150, unit: 'Piece', unit_price: 15, total: 2250 }, { description: 'Ibuprofen 400mg', quantity: 100, unit: 'Piece', unit_price: 12, total: 1200 }], labor_items: [], companyId: pharmId },
    { client_name: 'Kathmandu Nursing Home', invoice_number: 'PINV-004', date_ad: '2025-03-05', payment_type: 'credit', is_vat: true, notes: '', items: [{ description: 'Diabetes Test Strips', quantity: 20, unit: 'Set', unit_price: 1200, total: 24000 }], labor_items: [], companyId: pharmId },
    { client_name: 'Dr. Suresh Clinic', invoice_number: 'PINV-005', date_ad: '2025-03-15', payment_type: 'credit', is_vat: true, notes: '', items: [{ description: 'Antiseptic Solution 100ml', quantity: 20, unit: 'Piece', unit_price: 180, total: 3600 }], labor_items: [], companyId: pharmId },
    { client_name: 'Patan Hospital Pharmacy', invoice_number: 'PINV-006', date_ad: '2025-04-01', payment_type: 'cheque', is_vat: true, notes: '', items: [{ description: 'Paracetamol 500mg', quantity: 200, unit: 'Piece', unit_price: 8, total: 1600 }, { description: 'Amoxicillin 250mg', quantity: 100, unit: 'Piece', unit_price: 18, total: 1800 }], labor_items: [], companyId: pharmId },
  ];
  for (const s of pharmSales) await run(`Sale: ${s.invoice_number}`, () => post('/api/v1/sales', s));

  console.log('\n💊 Pharmacy — Transactions');
  const pharmTx = [
    { type: 'income', amount: 1921, date: '2025-01-15', description: 'Dr. Suresh Clinic PINV-001', party_name: 'Dr. Suresh Clinic', category: 'Sales', payment_method: 'bank_transfer', companyId: pharmId },
    { type: 'expense', amount: 5537, date: '2025-01-05', description: 'Shangrila Pharma PPO-001', party_name: 'Shangrila Pharma Distributors', category: 'Purchases', payment_method: 'credit', companyId: pharmId },
    { type: 'expense', amount: 73000, date: '2025-01-31', description: 'January staff salaries', party_name: 'Staff Payroll', category: 'Salaries', payment_method: 'bank_transfer', companyId: pharmId },
    { type: 'expense', amount: 25000, date: '2025-02-01', description: 'Baneshwor shop rent', party_name: 'Landlord', category: 'Rent', payment_method: 'cash', companyId: pharmId },
    { type: 'income', amount: 7910, date: '2025-02-01', description: 'Patan Hospital PINV-002', party_name: 'Patan Hospital Pharmacy', category: 'Sales', payment_method: 'cheque', companyId: pharmId },
    { type: 'income', amount: 3450, date: '2025-02-20', description: 'Gramin Swastha PINV-003', party_name: 'Gramin Swastha Kendra', category: 'Sales', payment_method: 'cash', companyId: pharmId },
    { type: 'expense', amount: 2900, date: '2025-02-10', description: 'Himalayan Herbals PPO-003', party_name: 'Himalayan Herbals Pvt Ltd', category: 'Purchases', payment_method: 'cheque', companyId: pharmId },
    { type: 'expense', amount: 8000, date: '2025-03-01', description: 'Electricity + water bills', party_name: 'NEA / KUKL', category: 'Utilities', payment_method: 'cash', companyId: pharmId },
  ];
  for (const t of pharmTx) await run(`Transaction: ${t.description.substring(0, 35)}`, () => post('/api/v1/transactions', t));

  console.log('\n💊 Pharmacy — Quotations');
  const pharmQuotations = [
    { client_name: 'Gramin Swastha Kendra', quotation_number: 'PQT-001', date_ad: '2025-03-01', valid_until: '2025-04-01', payment_type: 'credit', is_vat: false, status: 'pending', notes: 'Monthly medicine supply', items: [{ description: 'Paracetamol 500mg', quantity: 500, unit: 'Piece', unit_price: 8, total: 4000 }, { description: 'ORS Packet', quantity: 200, unit: 'Piece', unit_price: 25, total: 5000 }], labor_items: [], companyId: pharmId },
    { client_name: 'Kathmandu Nursing Home', quotation_number: 'PQT-002', date_ad: '2025-03-20', valid_until: '2025-04-20', payment_type: 'cheque', is_vat: true, status: 'accepted', notes: '', items: [{ description: 'Diabetes Test Strips', quantity: 50, unit: 'Set', unit_price: 1200, total: 60000 }], labor_items: [], companyId: pharmId },
  ];
  for (const q of pharmQuotations) await run(`Quotation: ${q.quotation_number}`, () => post('/api/v1/quotations', q));

  console.log('\n💊 Pharmacy — Tasks');
  const pharmTasks = [
    { title: 'Collect payment from Kathmandu Nursing Home', description: 'PINV-004 worth NPR 27,120 outstanding', priority: 'High', status: 'Pending', due_date: '2025-04-15', category: 'Finance', assigned_to: 'Kamala Devi', companyId: pharmId },
    { title: 'Drug retail license renewal', description: 'Annual renewal due June 2025', priority: 'High', status: 'Pending', due_date: '2025-05-15', category: 'Legal', assigned_to: 'Priya Maharjan', companyId: pharmId },
    { title: 'Monthly physical stock count', description: 'Verify all medicine quantities', priority: 'Medium', status: 'In Progress', due_date: '2025-04-30', category: 'Operations', assigned_to: 'Anil Thapa', companyId: pharmId },
  ];
  for (const t of pharmTasks) await run(`Task: ${t.title.substring(0, 40)}`, () => post('/api/v1/tasks', t));
}

// ─── 5. Verification ──────────────────────────────────────────────────────────

async function verify() {
  console.log('\n📊 Verification');

  const checks = [
    { label: 'Companies', path: '/api/v1/companies', expected: 2 },
    { label: 'Tea House — Vendors',      path: `/api/v1/vendors?companyId=${teaId}`,       expected: 5 },
    { label: 'Tea House — Clients',      path: `/api/v1/clients?companyId=${teaId}`,       expected: 5 },
    { label: 'Tea House — Inventory',    path: `/api/v1/inventory?companyId=${teaId}`,     expected: 8 },
    { label: 'Tea House — Purchases',    path: `/api/v1/purchases?companyId=${teaId}`,     expected: 6 },
    { label: 'Tea House — Sales',        path: `/api/v1/sales?companyId=${teaId}`,         expected: 8 },
    { label: 'Tea House — Transactions', path: `/api/v1/transactions?companyId=${teaId}`,  expected: 10 },
    { label: 'Tea House — Employees',    path: `/api/v1/employees?companyId=${teaId}`,     expected: 5 },
    { label: 'Tea House — Quotations',   path: `/api/v1/quotations?companyId=${teaId}`,    expected: 3 },
    { label: 'Tea House — Tasks',        path: `/api/v1/tasks?companyId=${teaId}`,         expected: 4 },
    { label: 'Tea House — Banks',        path: `/api/v1/bank-accounts?companyId=${teaId}`, expected: 1 },
    { label: 'Pharmacy — Vendors',       path: `/api/v1/vendors?companyId=${pharmId}`,     expected: 4 },
    { label: 'Pharmacy — Clients',       path: `/api/v1/clients?companyId=${pharmId}`,     expected: 4 },
    { label: 'Pharmacy — Inventory',     path: `/api/v1/inventory?companyId=${pharmId}`,   expected: 8 },
    { label: 'Pharmacy — Purchases',     path: `/api/v1/purchases?companyId=${pharmId}`,   expected: 5 },
    { label: 'Pharmacy — Sales',         path: `/api/v1/sales?companyId=${pharmId}`,       expected: 6 },
    { label: 'Pharmacy — Transactions',  path: `/api/v1/transactions?companyId=${pharmId}`,expected: 8 },
    { label: 'Pharmacy — Employees',     path: `/api/v1/employees?companyId=${pharmId}`,   expected: 5 },
    { label: 'Pharmacy — Quotations',    path: `/api/v1/quotations?companyId=${pharmId}`,  expected: 2 },
    { label: 'Pharmacy — Tasks',         path: `/api/v1/tasks?companyId=${pharmId}`,       expected: 3 },
    { label: 'Pharmacy — Banks',         path: `/api/v1/bank-accounts?companyId=${pharmId}`,expected: 1 },
  ];

  for (const c of checks) {
    await run(`${c.label} (expected ${c.expected})`, async () => {
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
    if (!token) { console.log('\n❌ Cannot continue without auth token. Is the backend running?'); process.exit(1); }

    await seedCompanies();
    if (!teaId || !pharmId) { console.log('\n❌ Cannot continue without company IDs.'); process.exit(1); }

    console.log(`\n📌 Tea House ID:  ${teaId}`);
    console.log(`📌 Pharmacy ID:   ${pharmId}`);

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
