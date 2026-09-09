// Simple company state management using localStorage
const COMPANY_KEY = 'easybooks_active_company';

export function getActiveCompanyId() {
  return localStorage.getItem(COMPANY_KEY) || null;
}

export function setActiveCompanyId(companyId) {
  localStorage.setItem(COMPANY_KEY, companyId);
}

export function clearActiveCompany() {
  localStorage.removeItem(COMPANY_KEY);
}

// Mirrors the backend's isCompanyAccessible (core/modules/company-access.ts) —
// a company is usable only when it's active AND (if it has one) its
// subscription hasn't expired yet. Accepts either casing since callers read
// company objects from two differently-shaped API clients: adapter.js's
// snake_case (is_active/subscription_expires_at) and index.ts's raw
// camelCase (isActive/subscriptionExpiresAt).
export function isCompanyAccessible(company) {
  if (!company) return false;
  const isActive = company.is_active ?? company.isActive;
  if (isActive === false) return false;
  const expiresAt = company.subscription_expires_at ?? company.subscriptionExpiresAt;
  if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) return false;
  return true;
}