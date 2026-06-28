import apiClient from './client';

const companyId = () => localStorage.getItem('easybooks_active_company') || '';

// Auth
export const authApi = {
  login: (data: { email: string; password: string }) => apiClient.post('/api/v1/auth/login', data),
  register: (data: object) => apiClient.post('/api/v1/auth/register', data),
  verifyOtp: (email: string, otp: string) => apiClient.post('/api/v1/auth/verify-otp', { email, otp }),
  resendOtp: (email: string) => apiClient.post('/api/v1/auth/resend-otp', { email }),
  changePassword: (currentPassword: string, newPassword: string) =>
    apiClient.post('/api/v1/auth/change-password', { currentPassword, newPassword }),
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
  adjust: (id: string, data: { adjustmentType: string; quantity: number; reason: string }) =>
    apiClient.patch(`/api/v1/inventory/${id}/adjust`, data, { params: { companyId: companyId() } }),
  getAdjustments: (id: string) =>
    apiClient.get(`/api/v1/inventory/${id}/adjustments`, { params: { companyId: companyId() } }),
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
  gratuity: (employeeId: string) => apiClient.get('/api/v1/payroll/gratuity', { params: { companyId: companyId(), employeeId } }),
};

// Ledger
export const ledgerApi = {
  accounts: {
    list: () => apiClient.get('/api/v1/ledger/accounts', { params: { companyId: companyId() } }),
    get: (id: string) => apiClient.get(`/api/v1/ledger/accounts/${id}`, { params: { companyId: companyId() } }),
    create: (data: object) => apiClient.post('/api/v1/ledger/accounts', data),
    update: (id: string, data: object) => apiClient.put(`/api/v1/ledger/accounts/${id}`, data, { params: { companyId: companyId() } }),
    remove: (id: string) => apiClient.delete(`/api/v1/ledger/accounts/${id}`, { params: { companyId: companyId() } }),
    toggleHidden: (id: string, password: string) =>
      apiClient.post(`/api/v1/ledger/accounts/${id}/toggle-hidden`, { password }, { params: { companyId: companyId() } }),
    searchHidden: (accountName: string, password: string) =>
      apiClient.post('/api/v1/ledger/accounts/hidden/search', { accountName, password }, { params: { companyId: companyId() } }),
    removeHidden: (id: string, password: string) =>
      apiClient.delete(`/api/v1/ledger/accounts/${id}/hidden`, { data: { password }, params: { companyId: companyId() } }),
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
  convert: (id: string) => apiClient.post(`/api/v1/quotations/${id}/convert`, {}, { params: { companyId: companyId() } }),
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

// Dashboard
export const dashboardApi = {
  salesTrend: (cid: string) => apiClient.get('/api/v1/dashboard/sales-trend', { params: { companyId: cid } }),
  alerts: (cid: string) => apiClient.get('/api/v1/dashboard/alerts', { params: { companyId: cid } }),
  hrSummary: (cid: string) => apiClient.get('/api/v1/dashboard/hr-summary', { params: { companyId: cid } }),
  recentActivity: (cid: string) => apiClient.get('/api/v1/dashboard/recent-activity', { params: { companyId: cid } }),
  vatSummary: (cid: string) => apiClient.get('/api/v1/dashboard/vat-summary', { params: { companyId: cid } }),
};

// Companies
export const companyApi = {
  list: () => apiClient.get('/api/v1/companies'),
  userCompanies: () => apiClient.get('/api/v1/companies/user-companies'),
  getDefault: () => apiClient.get('/api/v1/companies/default'),
  get: (id: string) => apiClient.get(`/api/v1/companies/${id}`),
  create: (data: object) => apiClient.post('/api/v1/companies', data),
  update: (id: string, data: object) => apiClient.put(`/api/v1/companies/${id}`, data),
  getPayrollSettings: (id: string) => apiClient.get(`/api/v1/companies/${id}/payroll-settings`),
  upsertPayrollSettings: (id: string, data: object) => apiClient.patch(`/api/v1/companies/${id}/payroll-settings`, data),
};

// File Upload
export const uploadApi = {
  upload: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post('/api/v1/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

// Recycle Bin (ADMIN only)
export const recycleBinApi = {
  verify: (password: string) => apiClient.post('/api/v1/recycle-bin/verify', { password }),
  list: (cid: string) => apiClient.get('/api/v1/recycle-bin', { params: { companyId: cid } }),
  restore: (id: string, type: string, cid: string) =>
    apiClient.post('/api/v1/recycle-bin/restore', { id, type, companyId: cid }),
  permanentDelete: (id: string, type: string, cid: string) =>
    apiClient.delete(`/api/v1/recycle-bin/${id}`, { params: { type, companyId: cid } }),
  emptyBin: (cid: string) => apiClient.delete('/api/v1/recycle-bin/empty', { params: { companyId: cid } }),
  cleanup: (cid: string, days: number) =>
    apiClient.post('/api/v1/recycle-bin/cleanup', { companyId: cid, days }),
};

// ── School APIs ──────────────────────────────────────────────────────────────

export const schoolDashboardApi = {
  summary: () => apiClient.get('/api/v1/school/dashboard', { params: { companyId: companyId() } }),
};

export const academicYearsApi = {
  list: () => apiClient.get('/api/v1/school/academic-years', { params: { companyId: companyId() } }),
  create: (data: object) => apiClient.post('/api/v1/school/academic-years', data),
  update: (id: string, data: object) =>
    apiClient.put(`/api/v1/school/academic-years/${id}`, data, { params: { companyId: companyId() } }),
  remove: (id: string) =>
    apiClient.delete(`/api/v1/school/academic-years/${id}`, { params: { companyId: companyId() } }),
};

export const studentsApi = {
  list: (classId?: string) => apiClient.get('/api/v1/school/students', { params: { companyId: companyId(), classId } }),
  get: (id: string) => apiClient.get(`/api/v1/school/students/${id}`, { params: { companyId: companyId() } }),
  create: (data: object) => apiClient.post('/api/v1/school/students', data),
  update: (id: string, data: object) => apiClient.put(`/api/v1/school/students/${id}`, data),
  remove: (id: string) => apiClient.delete(`/api/v1/school/students/${id}`, { params: { companyId: companyId() } }),
  promote: (data: object) => apiClient.post('/api/v1/school/students/promote', data),
};

export const classesApi = {
  list: () => apiClient.get('/api/v1/school/classes', { params: { companyId: companyId() } }),
  create: (data: object) => apiClient.post('/api/v1/school/classes', data),
  update: (id: string, data: object) => apiClient.put(`/api/v1/school/classes/${id}`, data),
  remove: (id: string) => apiClient.delete(`/api/v1/school/classes/${id}`, { params: { companyId: companyId() } }),
};

export const subjectsApi = {
  list: () => apiClient.get('/api/v1/school/subjects', { params: { companyId: companyId() } }),
  create: (data: object) => apiClient.post('/api/v1/school/subjects', data),
  update: (id: string, data: object) => apiClient.put(`/api/v1/school/subjects/${id}`, data),
  remove: (id: string) => apiClient.delete(`/api/v1/school/subjects/${id}`, { params: { companyId: companyId() } }),
};

export const studentAttendanceApi = {
  get: (classId: string, date: string) =>
    apiClient.get('/api/v1/school/attendance', { params: { companyId: companyId(), classId, date } }),
  save: (data: object) => apiClient.post('/api/v1/school/attendance', data),
  report: (classId: string, startDate: string, endDate: string) =>
    apiClient.get('/api/v1/school/attendance/report', { params: { companyId: companyId(), classId, startDate, endDate } }),
  summary: (studentId: string, month?: string) =>
    apiClient.get('/api/v1/school/attendance/summary', { params: { companyId: companyId(), studentId, month } }),
};

export const feesApi = {
  listStructures: (classId?: string) =>
    apiClient.get('/api/v1/school/fee-structures', { params: { companyId: companyId(), classId } }),
  createStructure: (data: object) => apiClient.post('/api/v1/school/fee-structures', data),
  updateStructure: (id: string, data: object) => apiClient.put(`/api/v1/school/fee-structures/${id}`, data),
  removeStructure: (id: string) =>
    apiClient.delete(`/api/v1/school/fee-structures/${id}`, { params: { companyId: companyId() } }),
  listInvoices: (params?: object) =>
    apiClient.get('/api/v1/school/fee-invoices', { params: { companyId: companyId(), ...params } }),
  createInvoice: (data: object) => apiClient.post('/api/v1/school/fee-invoices', data),
  recordPayment: (id: string, data: object) =>
    apiClient.patch(`/api/v1/school/fee-invoices/${id}/payment`, data),
  generateBulk: (data: object) => apiClient.post('/api/v1/school/fee-invoices/bulk', data),
  receipt: (id: string) =>
    apiClient.get(`/api/v1/school/fee-invoices/${id}/receipt`, { params: { companyId: companyId() } }),
};

export const examResultsApi = {
  list: (params?: object) =>
    apiClient.get('/api/v1/school/exam-results', { params: { companyId: companyId(), ...params } }),
  reportCard: (studentId: string, examName: string) =>
    apiClient.get('/api/v1/school/exam-results/report-card', {
      params: { companyId: companyId(), studentId, examName },
    }),
  create: (data: object) => apiClient.post('/api/v1/school/exam-results', data),
  update: (id: string, data: object) => apiClient.put(`/api/v1/school/exam-results/${id}`, data),
  remove: (id: string) =>
    apiClient.delete(`/api/v1/school/exam-results/${id}`, { params: { companyId: companyId() } }),
};

export const timetableApi = {
  get: (classId: string) =>
    apiClient.get('/api/v1/school/timetable', { params: { companyId: companyId(), classId } }),
  upsert: (data: object) => apiClient.post('/api/v1/school/timetable', data),
  remove: (id: string) =>
    apiClient.delete(`/api/v1/school/timetable/${id}`, { params: { companyId: companyId() } }),
};

export const noticesApi = {
  list: () => apiClient.get('/api/v1/school/notices', { params: { companyId: companyId() } }),
  create: (data: object) => apiClient.post('/api/v1/school/notices', data),
  update: (id: string, data: object) =>
    apiClient.put(`/api/v1/school/notices/${id}`, data, { params: { companyId: companyId() } }),
  remove: (id: string) =>
    apiClient.delete(`/api/v1/school/notices/${id}`, { params: { companyId: companyId() } }),
};

export const schoolEventsApi = {
  list: (month?: string) =>
    apiClient.get('/api/v1/school/events', { params: { companyId: companyId(), month } }),
  create: (data: object) => apiClient.post('/api/v1/school/events', data),
  update: (id: string, data: object) =>
    apiClient.put(`/api/v1/school/events/${id}`, data, { params: { companyId: companyId() } }),
  remove: (id: string) =>
    apiClient.delete(`/api/v1/school/events/${id}`, { params: { companyId: companyId() } }),
};

// Users (ADMIN only)
export const usersApi = {
  list: (cid: string) => apiClient.get('/api/v1/users', { params: { companyId: cid } }),
  invite: (cid: string, data: object) => apiClient.post('/api/v1/users/invite', data, { params: { companyId: cid } }),
  changeRole: (userId: string, cid: string, role: string) =>
    apiClient.patch(`/api/v1/users/${userId}/role`, { role }, { params: { companyId: cid } }),
};
