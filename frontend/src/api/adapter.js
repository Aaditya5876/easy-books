/**
 * API Adapter — bridges the snake_case UI layer to our camelCase REST backend.
 * Pages use api.Client.filter(), api.SalesOrder.create(), etc.
 * New pages should import directly from @/api instead of using this adapter.
 */
import apiClient from './client';

function toCamel(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(toCamel);
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [
      k.replace(/_([a-z])/g, (_, c) => c.toUpperCase()),
      toCamel(v),
    ])
  );
}

function toSnake(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(toSnake);
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [
      k.replace(/[A-Z]/g, m => '_' + m.toLowerCase()),
      toSnake(v),
    ])
  );
}

function unwrap(res) {
  const d = res.data;
  return d?.data ?? d;
}

const ENDPOINTS = {
  SalesOrder:    '/api/v1/sales',
  PurchaseOrder: '/api/v1/purchases',
  InventoryItem: '/api/v1/inventory',
  Client:        '/api/v1/clients',
  Vendor:        '/api/v1/vendors',
  Employee:      '/api/v1/employees',
  Attendance:    '/api/v1/attendance',
  Payroll:       '/api/v1/payroll',
  LedgerAccount: '/api/v1/ledger/accounts',
  LedgerEntry:   '/api/v1/ledger/entries',
  Transaction:   '/api/v1/transactions',
  Memo:          '/api/v1/memos',
  BankAccount:   '/api/v1/bank-accounts',
  Task:          '/api/v1/tasks',
  Quotation:     '/api/v1/quotations',
  Company:       '/api/v1/companies',
  AuditLog:      '/api/v1/audit-logs',
};

function makeEntity(endpoint) {
  return {
    async filter(where = {}) {
      const res = await apiClient.get(endpoint, { params: toCamel(where) });
      const data = unwrap(res);
      return toSnake(Array.isArray(data) ? data : data ? [data] : []);
    },
    async list(params = {}) {
      const res = await apiClient.get(endpoint, { params: toCamel(params) });
      const data = unwrap(res);
      return toSnake(Array.isArray(data) ? data : data ? [data] : []);
    },
    async get(id) {
      const res = await apiClient.get(`${endpoint}/${id}`);
      return toSnake(unwrap(res));
    },
    async create(data) {
      const res = await apiClient.post(endpoint, toCamel(data));
      return toSnake(unwrap(res));
    },
    async update(id, data) {
      const res = await apiClient.put(`${endpoint}/${id}`, toCamel(data));
      return toSnake(unwrap(res));
    },
    async delete(id) {
      await apiClient.delete(`${endpoint}/${id}`);
    },
  };
}

export const api = Object.fromEntries(
  Object.entries(ENDPOINTS).map(([name, ep]) => [name, makeEntity(ep)])
);

export const apiAuth = {
  async me() {
    const res = await apiClient.get('/api/v1/auth/me');
    const user = toSnake(res.data);
    return { ...user, full_name: user.name };
  },
  async logout() {
    try { await apiClient.post('/api/v1/auth/logout'); } catch {}
    localStorage.removeItem('activeCompanyId');
    window.location.href = '/login';
  },
};
