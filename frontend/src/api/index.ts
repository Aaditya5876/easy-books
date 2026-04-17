import apiClient from './client';

const companyId = () => localStorage.getItem('activeCompanyId') || '';

// Auth
export const authApi = {
  login: (data: { email: string; password: string }) => apiClient.post('/api/v1/auth/login', data),
  register: (data: object) => apiClient.post('/api/v1/auth/register', data),
  logout: () => apiClient.post('/api/v1/auth/logout'),
  me: () => apiClient.get('/api/v1/auth/me'),
  refresh: () => apiClient.post('/api/v1/auth/refresh'),
};

// Inventory
export const inventoryApi = {
  list: () => apiClient.get('/api/v1/inventory', { params: { companyId: companyId() } }),
  get: (id: string) => apiClient.get(`/api/v1/inventory/${id}`, { params: { companyId: companyId() } }),
  create: (data: object) => apiClient.post('/api/v1/inventory', data),
  update: (id: string, data: object) => apiClient.put(`/api/v1/inventory/${id}`, data, { params: { companyId: companyId() } }),
  remove: (id: string) => apiClient.delete(`/api/v1/inventory/${id}`, { params: { companyId: companyId() } }),
};

// Sales
export const salesApi = {
  list: () => apiClient.get('/api/v1/sales', { params: { companyId: companyId() } }),
  get: (id: string) => apiClient.get(`/api/v1/sales/${id}`, { params: { companyId: companyId() } }),
  create: (data: object) => apiClient.post('/api/v1/sales', data),
  update: (id: string, data: object) => apiClient.put(`/api/v1/sales/${id}`, data, { params: { companyId: companyId() } }),
  remove: (id: string) => apiClient.delete(`/api/v1/sales/${id}`, { params: { companyId: companyId() } }),
};

// Purchases
export const purchaseApi = {
  list: () => apiClient.get('/api/v1/purchases', { params: { companyId: companyId() } }),
  get: (id: string) => apiClient.get(`/api/v1/purchases/${id}`, { params: { companyId: companyId() } }),
  create: (data: object) => apiClient.post('/api/v1/purchases', data),
  update: (id: string, data: object) => apiClient.put(`/api/v1/purchases/${id}`, data, { params: { companyId: companyId() } }),
  remove: (id: string) => apiClient.delete(`/api/v1/purchases/${id}`, { params: { companyId: companyId() } }),
};

// Clients
export const clientApi = {
  list: () => apiClient.get('/api/v1/clients', { params: { companyId: companyId() } }),
  get: (id: string) => apiClient.get(`/api/v1/clients/${id}`, { params: { companyId: companyId() } }),
  create: (data: object) => apiClient.post('/api/v1/clients', data),
  update: (id: string, data: object) => apiClient.put(`/api/v1/clients/${id}`, data, { params: { companyId: companyId() } }),
  remove: (id: string) => apiClient.delete(`/api/v1/clients/${id}`, { params: { companyId: companyId() } }),
};

// Vendors
export const vendorApi = {
  list: () => apiClient.get('/api/v1/vendors', { params: { companyId: companyId() } }),
  get: (id: string) => apiClient.get(`/api/v1/vendors/${id}`, { params: { companyId: companyId() } }),
  create: (data: object) => apiClient.post('/api/v1/vendors', data),
  update: (id: string, data: object) => apiClient.put(`/api/v1/vendors/${id}`, data, { params: { companyId: companyId() } }),
  remove: (id: string) => apiClient.delete(`/api/v1/vendors/${id}`, { params: { companyId: companyId() } }),
};

// Employees
export const employeeApi = {
  list: () => apiClient.get('/api/v1/employees', { params: { companyId: companyId() } }),
  get: (id: string) => apiClient.get(`/api/v1/employees/${id}`, { params: { companyId: companyId() } }),
  create: (data: object) => apiClient.post('/api/v1/employees', data),
  update: (id: string, data: object) => apiClient.put(`/api/v1/employees/${id}`, data, { params: { companyId: companyId() } }),
  remove: (id: string) => apiClient.delete(`/api/v1/employees/${id}`, { params: { companyId: companyId() } }),
};

// Attendance
export const attendanceApi = {
  list: (employeeId?: string) => apiClient.get('/api/v1/attendance', { params: { companyId: companyId(), employeeId } }),
  get: (id: string) => apiClient.get(`/api/v1/attendance/${id}`, { params: { companyId: companyId() } }),
  create: (data: object) => apiClient.post('/api/v1/attendance', data),
  update: (id: string, data: object) => apiClient.put(`/api/v1/attendance/${id}`, data, { params: { companyId: companyId() } }),
  remove: (id: string) => apiClient.delete(`/api/v1/attendance/${id}`, { params: { companyId: companyId() } }),
};

// Payroll
export const payrollApi = {
  list: (month?: string) => apiClient.get('/api/v1/payroll', { params: { companyId: companyId(), month } }),
  get: (id: string) => apiClient.get(`/api/v1/payroll/${id}`, { params: { companyId: companyId() } }),
  create: (data: object) => apiClient.post('/api/v1/payroll', data),
  update: (id: string, data: object) => apiClient.put(`/api/v1/payroll/${id}`, data, { params: { companyId: companyId() } }),
  process: (month: string) => apiClient.post('/api/v1/payroll/process', { companyId: companyId(), month }),
};

// Ledger
export const ledgerApi = {
  accounts: {
    list: () => apiClient.get('/api/v1/ledger/accounts', { params: { companyId: companyId() } }),
    get: (id: string) => apiClient.get(`/api/v1/ledger/accounts/${id}`, { params: { companyId: companyId() } }),
    create: (data: object) => apiClient.post('/api/v1/ledger/accounts', data),
    update: (id: string, data: object) => apiClient.put(`/api/v1/ledger/accounts/${id}`, data, { params: { companyId: companyId() } }),
    remove: (id: string) => apiClient.delete(`/api/v1/ledger/accounts/${id}`, { params: { companyId: companyId() } }),
  },
  entries: {
    list: (accountId?: string) => apiClient.get('/api/v1/ledger/entries', { params: { companyId: companyId(), accountId } }),
    get: (id: string) => apiClient.get(`/api/v1/ledger/entries/${id}`, { params: { companyId: companyId() } }),
    create: (data: object) => apiClient.post('/api/v1/ledger/entries', data),
  },
};

// Transactions
export const transactionApi = {
  list: () => apiClient.get('/api/v1/transactions', { params: { companyId: companyId() } }),
  get: (id: string) => apiClient.get(`/api/v1/transactions/${id}`, { params: { companyId: companyId() } }),
  create: (data: object) => apiClient.post('/api/v1/transactions', data),
  update: (id: string, data: object) => apiClient.put(`/api/v1/transactions/${id}`, data, { params: { companyId: companyId() } }),
  remove: (id: string) => apiClient.delete(`/api/v1/transactions/${id}`, { params: { companyId: companyId() } }),
};

// Quotations
export const quotationApi = {
  list: () => apiClient.get('/api/v1/quotations', { params: { companyId: companyId() } }),
  get: (id: string) => apiClient.get(`/api/v1/quotations/${id}`, { params: { companyId: companyId() } }),
  create: (data: object) => apiClient.post('/api/v1/quotations', data),
  update: (id: string, data: object) => apiClient.put(`/api/v1/quotations/${id}`, data, { params: { companyId: companyId() } }),
  remove: (id: string) => apiClient.delete(`/api/v1/quotations/${id}`, { params: { companyId: companyId() } }),
};

// Memos
export const memoApi = {
  list: () => apiClient.get('/api/v1/memos', { params: { companyId: companyId() } }),
  get: (id: string) => apiClient.get(`/api/v1/memos/${id}`, { params: { companyId: companyId() } }),
  create: (data: object) => apiClient.post('/api/v1/memos', data),
  update: (id: string, data: object) => apiClient.put(`/api/v1/memos/${id}`, data, { params: { companyId: companyId() } }),
  remove: (id: string) => apiClient.delete(`/api/v1/memos/${id}`, { params: { companyId: companyId() } }),
};

// Bank Accounts
export const bankAccountApi = {
  list: () => apiClient.get('/api/v1/bank-accounts', { params: { companyId: companyId() } }),
  get: (id: string) => apiClient.get(`/api/v1/bank-accounts/${id}`, { params: { companyId: companyId() } }),
  create: (data: object) => apiClient.post('/api/v1/bank-accounts', data),
  update: (id: string, data: object) => apiClient.put(`/api/v1/bank-accounts/${id}`, data, { params: { companyId: companyId() } }),
  remove: (id: string) => apiClient.delete(`/api/v1/bank-accounts/${id}`, { params: { companyId: companyId() } }),
};

// Tasks
export const taskApi = {
  list: () => apiClient.get('/api/v1/tasks', { params: { companyId: companyId() } }),
  get: (id: string) => apiClient.get(`/api/v1/tasks/${id}`, { params: { companyId: companyId() } }),
  create: (data: object) => apiClient.post('/api/v1/tasks', data),
  update: (id: string, data: object) => apiClient.put(`/api/v1/tasks/${id}`, data, { params: { companyId: companyId() } }),
  remove: (id: string) => apiClient.delete(`/api/v1/tasks/${id}`, { params: { companyId: companyId() } }),
};

// Companies
export const companyApi = {
  list: () => apiClient.get('/api/v1/companies'),
  get: (id: string) => apiClient.get(`/api/v1/companies/${id}`),
  create: (data: object) => apiClient.post('/api/v1/companies', data),
  update: (id: string, data: object) => apiClient.put(`/api/v1/companies/${id}`, data),
};
