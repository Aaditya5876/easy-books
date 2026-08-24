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
  adjust: (id: string, data: { adjustmentType: string; quantityChange: number; reason: string }) =>
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
  // Name-only listing — safe for roles (TEACHER, LIBRARIAN, STAFF) that shouldn't
  // see salary/PAN/bank data but still need to resolve/pick an employee by name.
  directory: () => apiClient.get('/api/v1/employees/directory', { params: { companyId: companyId() } }),
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
  summary: (month: string) => apiClient.get('/api/v1/payroll/summary', { params: { companyId: companyId(), month } }),
  calculate: (employeeId: string, month: string) =>
    apiClient.post('/api/v1/payroll/calculate', { companyId: companyId(), employeeId, month }),
  process: (month: string) => apiClient.post('/api/v1/payroll/process', { companyId: companyId(), month }),
  markPaid: (id: string) => apiClient.patch(`/api/v1/payroll/${id}/mark-paid`, {}, { params: { companyId: companyId() } }),
  setHold: (id: string, isOnHold: boolean, holdReason?: string) =>
    apiClient.patch(`/api/v1/payroll/${id}/hold`, { isOnHold, holdReason }, { params: { companyId: companyId() } }),
  adjust: (id: string, otherDeductions: number) =>
    apiClient.patch(`/api/v1/payroll/${id}/adjust`, { otherDeductions }, { params: { companyId: companyId() } }),
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
    // Always a balanced double-entry pair — backend creates both the debit and credit rows atomically.
    createJournal: (data: { debitAccountId: string; creditAccountId: string; amount: number; dateAd: string; description?: string }) =>
      apiClient.post('/api/v1/ledger/entries', { ...data, companyId: companyId() }),
    remove: (id: string) => apiClient.delete(`/api/v1/ledger/entries/${id}`, { params: { companyId: companyId() } }),
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

// Notifications — user-scoped (resolved from the JWT server-side), unlike most
// resources above there is deliberately no companyId param here.
export const notificationsApi = {
  list: (params: { page?: number; pageSize?: number; unreadOnly?: boolean } = {}) =>
    apiClient.get('/api/v1/notifications', { params }),
  unreadCount: () => apiClient.get('/api/v1/notifications/unread-count'),
  markRead: (id: string) => apiClient.patch(`/api/v1/notifications/${id}/read`),
  markAllRead: () => apiClient.patch('/api/v1/notifications/mark-all-read'),
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
  list: (params?: { classId?: string; search?: string; page?: number; pageSize?: number } | string) => {
    // Back-compat: many call sites still pass a bare classId string
    const p = typeof params === 'string' ? { classId: params } : params;
    return apiClient.get('/api/v1/school/students', { params: { companyId: companyId(), ...p } });
  },
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
  list: (classId?: string) => apiClient.get('/api/v1/school/subjects', { params: { companyId: companyId(), classId: classId || undefined } }),
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
    apiClient.patch(`/api/v1/school/fee-invoices/${id}/payment`, data, { params: { companyId: companyId() } }),
  generateBulk: (data: object) => apiClient.post('/api/v1/school/fee-invoices/bulk', data),
  receipt: (id: string) =>
    apiClient.get(`/api/v1/school/fee-invoices/${id}/receipt`, { params: { companyId: companyId() } }),
  sendFeeReminderSms: (invoiceId: string) =>
    apiClient.post(`/api/v1/school/sms/fee-reminder/${invoiceId}`, { companyId: companyId() }),
  release: (id: string) =>
    apiClient.patch(`/api/v1/school/fee-invoices/${id}/release`, {}, { params: { companyId: companyId() } }),
  releaseBulk: () =>
    apiClient.post('/api/v1/school/fee-invoices/release-bulk', { companyId: companyId() }),
};

export const examResultsApi = {
  list: (params?: object) =>
    apiClient.get('/api/v1/school/exam-results', { params: { companyId: companyId(), ...params } }),
  reportCard: (studentId: string, examName: string) =>
    apiClient.get('/api/v1/school/exam-results/report-card', {
      params: { companyId: companyId(), studentId, examName },
    }),
  create: (data: object) => apiClient.post('/api/v1/school/exam-results', { ...data, companyId: companyId() }),
  update: (id: string, data: object) =>
    apiClient.put(`/api/v1/school/exam-results/${id}`, data, { params: { companyId: companyId() } }),
  remove: (id: string) =>
    apiClient.delete(`/api/v1/school/exam-results/${id}`, { params: { companyId: companyId() } }),
};

export const examsApi = {
  list: () => apiClient.get('/api/v1/school/exams', { params: { companyId: companyId() } }),
  create: (data: { name: string; examDate?: string; notes?: string }) =>
    apiClient.post('/api/v1/school/exams', { ...data, companyId: companyId() }),
  remove: (id: string) => apiClient.delete(`/api/v1/school/exams/${id}`, { params: { companyId: companyId() } }),
};

export const schoolFinanceApi = {
  listFeeHeads: () => apiClient.get('/api/v1/school/fee-heads', { params: { companyId: companyId() } }),
  createFeeHead: (data: object) => apiClient.post('/api/v1/school/fee-heads', { ...data, companyId: companyId() }),
  createDefaultFeeHeads: () => apiClient.post('/api/v1/school/fee-heads/defaults', { companyId: companyId() }),
  updateFeeHead: (id: string, data: object) =>
    apiClient.put(`/api/v1/school/fee-heads/${id}`, data, { params: { companyId: companyId() } }),
  removeFeeHead: (id: string) =>
    apiClient.delete(`/api/v1/school/fee-heads/${id}`, { params: { companyId: companyId() } }),

  studentFeeProfile: (studentId: string) =>
    apiClient.get(`/api/v1/school/students/${studentId}/fee-profile`, { params: { companyId: companyId() } }),
  addScholarship: (studentId: string, data: object) =>
    apiClient.post(`/api/v1/school/students/${studentId}/scholarships`, data, { params: { companyId: companyId() } }),
  removeScholarship: (id: string) =>
    apiClient.delete(`/api/v1/school/scholarships/${id}`, { params: { companyId: companyId() } }),

  listPackages: () => apiClient.get('/api/v1/school/fee-packages', { params: { companyId: companyId() } }),
  createPackage: (data: object) => apiClient.post('/api/v1/school/fee-packages', { ...data, companyId: companyId() }),
  updatePackage: (id: string, data: object) =>
    apiClient.put(`/api/v1/school/fee-packages/${id}`, data, { params: { companyId: companyId() } }),
  removePackage: (id: string) =>
    apiClient.delete(`/api/v1/school/fee-packages/${id}`, { params: { companyId: companyId() } }),
  assignPackage: (studentId: string, packageId: string | null) =>
    apiClient.patch(`/api/v1/school/students/${studentId}/package`, { packageId }, { params: { companyId: companyId() } }),

  billingRun: (data: { classId?: string; dueDate?: string; invoiceDate?: string }) =>
    apiClient.post('/api/v1/school/billing-run', { ...data, companyId: companyId() }),

  listInvoicePayments: (invoiceId: string) =>
    apiClient.get(`/api/v1/school/fee-invoices/${invoiceId}/payments`, { params: { companyId: companyId() } }),
};

export const schoolAnalyticsApi = {
  attendance: (month?: string, startDate?: string, endDate?: string) =>
    apiClient.get('/api/v1/school/analytics/attendance', { params: { companyId: companyId(), month, startDate, endDate } }),
  fees: (startDate?: string, endDate?: string) =>
    apiClient.get('/api/v1/school/analytics/fees', { params: { companyId: companyId(), startDate, endDate } }),
  academics: (examName?: string, startDate?: string, endDate?: string) =>
    apiClient.get('/api/v1/school/analytics/academics', { params: { companyId: companyId(), examName, startDate, endDate } }),
  operations: (startDate?: string, endDate?: string) =>
    apiClient.get('/api/v1/school/analytics/operations', { params: { companyId: companyId(), startDate, endDate } }),
};

export const bulkImportApi = {
  import: (entity: string, rows: object[]) =>
    apiClient.post(`/api/v1/bulk/${entity}`, { companyId: companyId(), rows }),
};

export const examSchedulesApi = {
  list: (params?: object) =>
    apiClient.get('/api/v1/school/exam-schedules', { params: { companyId: companyId(), ...params } }),
  create: (data: object) => apiClient.post('/api/v1/school/exam-schedules', data),
  createBulk: (data: { classId: string; examName: string; rows: object[] }) =>
    apiClient.post('/api/v1/school/exam-schedules/bulk', { ...data, companyId: companyId() }),
  update: (id: string, data: object) =>
    apiClient.put(`/api/v1/school/exam-schedules/${id}`, data, { params: { companyId: companyId() } }),
  remove: (id: string) =>
    apiClient.delete(`/api/v1/school/exam-schedules/${id}`, { params: { companyId: companyId() } }),
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
  broadcastSms: (id: string) =>
    apiClient.post(`/api/v1/school/notices/${id}/broadcast-sms`, { companyId: companyId() }),
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

export const studyMaterialsApi = {
  list: (classId?: string, subjectId?: string) =>
    apiClient.get('/api/v1/school/study-materials', { params: { companyId: companyId(), classId, subjectId } }),
  create: (data: object) => apiClient.post('/api/v1/school/study-materials', data),
  remove: (id: string) =>
    apiClient.delete(`/api/v1/school/study-materials/${id}`, { params: { companyId: companyId() } }),
};

export const homeworkApi = {
  list: (classId?: string, subjectId?: string) =>
    apiClient.get('/api/v1/school/homework', { params: { companyId: companyId(), classId, subjectId } }),
  create: (data: object) => apiClient.post('/api/v1/school/homework', data),
  update: (id: string, data: object) =>
    apiClient.put(`/api/v1/school/homework/${id}`, data, { params: { companyId: companyId() } }),
  remove: (id: string) =>
    apiClient.delete(`/api/v1/school/homework/${id}`, { params: { companyId: companyId() } }),
};

export const libraryApi = {
  listBooks: () => apiClient.get('/api/v1/school/library/books', { params: { companyId: companyId() } }),
  createBook: (data: object) => apiClient.post('/api/v1/school/library/books', data),
  updateBook: (id: string, data: object) =>
    apiClient.put(`/api/v1/school/library/books/${id}`, data, { params: { companyId: companyId() } }),
  removeBook: (id: string) =>
    apiClient.delete(`/api/v1/school/library/books/${id}`, { params: { companyId: companyId() } }),
  listIssues: (status?: string) =>
    apiClient.get('/api/v1/school/library/issues', { params: { companyId: companyId(), status } }),
  issueBook: (data: object) => apiClient.post('/api/v1/school/library/issues', data),
  returnBook: (id: string, fine?: number) =>
    apiClient.patch(`/api/v1/school/library/issues/${id}/return`, { fine }, { params: { companyId: companyId() } }),
};

export const hostelApi = {
  listRooms: () => apiClient.get('/api/v1/school/hostel/rooms', { params: { companyId: companyId() } }),
  createRoom: (data: object) => apiClient.post('/api/v1/school/hostel/rooms', data),
  updateRoom: (id: string, data: object) =>
    apiClient.put(`/api/v1/school/hostel/rooms/${id}`, data, { params: { companyId: companyId() } }),
  removeRoom: (id: string) =>
    apiClient.delete(`/api/v1/school/hostel/rooms/${id}`, { params: { companyId: companyId() } }),
  listAllocations: (roomId?: string) =>
    apiClient.get('/api/v1/school/hostel/allocations', { params: { companyId: companyId(), roomId } }),
  allocate: (data: object) => apiClient.post('/api/v1/school/hostel/allocations', data),
  deallocate: (id: string) =>
    apiClient.delete(`/api/v1/school/hostel/allocations/${id}`, { params: { companyId: companyId() } }),
};

export const transportApi = {
  listRoutes: () => apiClient.get('/api/v1/school/transport/routes', { params: { companyId: companyId() } }),
  createRoute: (data: object) => apiClient.post('/api/v1/school/transport/routes', data),
  updateRoute: (id: string, data: object) =>
    apiClient.put(`/api/v1/school/transport/routes/${id}`, data, { params: { companyId: companyId() } }),
  removeRoute: (id: string) =>
    apiClient.delete(`/api/v1/school/transport/routes/${id}`, { params: { companyId: companyId() } }),
  listAssignments: (routeId?: string) =>
    apiClient.get('/api/v1/school/transport/assignments', { params: { companyId: companyId(), routeId } }),
  assign: (data: object) => apiClient.post('/api/v1/school/transport/assignments', data),
  unassign: (id: string) =>
    apiClient.delete(`/api/v1/school/transport/assignments/${id}`, { params: { companyId: companyId() } }),
};

// Users (ADMIN only)
export const usersApi = {
  list: (cid: string) => apiClient.get('/api/v1/users', { params: { companyId: cid } }),
  invite: (cid: string, data: object) => apiClient.post('/api/v1/users/invite', data, { params: { companyId: cid } }),
  changeRole: (userId: string, cid: string, role: string) =>
    apiClient.patch(`/api/v1/users/${userId}/role`, { role }, { params: { companyId: cid } }),
  remove: (userId: string, cid: string) =>
    apiClient.delete(`/api/v1/users/${userId}`, { params: { companyId: cid } }),
};

// ── Portal API (parent/student token-based auth) ─────────────────────────────

const portalToken = () => localStorage.getItem('portal_token') || '';
const portalHeaders = () => ({ Authorization: `Bearer ${portalToken()}` });

export const portalApi = {
  login: (data: object) => apiClient.post('/api/v1/portal/login', data),
  setPassword: (data: object) => apiClient.post('/api/v1/portal/set-password', data),
  me: () => apiClient.get('/api/v1/portal/me', { headers: portalHeaders() }),
  attendance: () => apiClient.get('/api/v1/portal/attendance', { headers: portalHeaders() }),
  fees: () => apiClient.get('/api/v1/portal/fees', { headers: portalHeaders() }),
  feeReceipt: (invoiceId: string) => apiClient.get(`/api/v1/portal/fees/${invoiceId}/receipt`, { headers: portalHeaders() }),
  paymentQrCodes: () => apiClient.get('/api/v1/portal/payment-qr-codes', { headers: portalHeaders() }),
  notifications: () => apiClient.get('/api/v1/portal/notifications', { headers: portalHeaders() }),
  notificationsUnreadCount: () => apiClient.get('/api/v1/portal/notifications/unread-count', { headers: portalHeaders() }),
  markNotificationRead: (id: string) => apiClient.patch(`/api/v1/portal/notifications/${id}/read`, {}, { headers: portalHeaders() }),
  markAllNotificationsRead: () => apiClient.patch('/api/v1/portal/notifications/mark-all-read', {}, { headers: portalHeaders() }),
  results: () => apiClient.get('/api/v1/portal/results', { headers: portalHeaders() }),
  homework: (classId?: string) => apiClient.get('/api/v1/portal/homework', { headers: portalHeaders(), params: { classId } }),
  notices: () => apiClient.get('/api/v1/portal/notices', { headers: portalHeaders() }),
  timetable: (classId?: string) => apiClient.get('/api/v1/portal/timetable', { headers: portalHeaders(), params: { classId } }),
  studyMaterials: (classId?: string, subjectId?: string) =>
    apiClient.get('/api/v1/portal/study-materials', { headers: portalHeaders(), params: { classId, subjectId } }),
  examSchedule: (classId?: string) =>
    apiClient.get('/api/v1/portal/exam-schedule', { headers: portalHeaders(), params: { classId } }),
  events: () => apiClient.get('/api/v1/portal/events', { headers: portalHeaders() }),
  initiateEsewa: (invoiceId: string) =>
    apiClient.post(`/api/v1/portal/pay/esewa/${invoiceId}`, {}, { headers: portalHeaders() }),
  verifyEsewa: (data: { data: string; invoiceId: string; companyId: string }) =>
    apiClient.post('/api/v1/portal/pay/esewa/verify', data),
  initiateKhalti: (invoiceId: string) =>
    apiClient.post(`/api/v1/portal/pay/khalti/${invoiceId}`, {}, { headers: portalHeaders() }),
  verifyKhalti: (data: { pidx: string; invoiceId: string; companyId: string }) =>
    apiClient.post('/api/v1/portal/pay/khalti/verify', data),
};

// ── AI API (admin only, requires GEMINI_API_KEY on server) ───────────────────

export const aiApi = {
  generateNotice: (data: object) => apiClient.post('/api/v1/ai/generate-notice', data),
  reportCardComment: (data: object) => apiClient.post('/api/v1/ai/report-card-comment', data),
  classInsights: (data: object) => apiClient.post('/api/v1/ai/class-insights', data),
  feeReminder: (data: object) => apiClient.post('/api/v1/ai/fee-reminder', data),
  homeworkDescription: (data: object) => apiClient.post('/api/v1/ai/homework-description', data),
};

// ── Reports ──────────────────────────────────────────────────────────────────
// Trial Balance is the only one surfaced in the UI (Reports > Audit tab) — it's
// real, computed server-side from ledger entries (see backend ReportsService).
// Day Book / Party Statement / Balance Sheet / Cash Flow exist on the backend
// but have no frontend consumer right now.

export const reportsApi = {
  trialBalance: () => apiClient.get('/api/v1/reports/trial-balance', { params: { companyId: companyId() } }),
};
