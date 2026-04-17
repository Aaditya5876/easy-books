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