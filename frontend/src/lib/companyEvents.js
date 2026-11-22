// One app-wide signal for "the list of companies, or the active company,
// changed" (created, deleted, renamed, (de)activated, package/subscription
// changed, switched into). Company data lives in three places that load once:
// AuthContext (user.defaultCompany → sidebar, school/business routing), the
// TopBar (company dropdown + search) and Settings. Without this they stayed
// stale until a full page reload — e.g. a deleted company still sat in the
// header dropdown.
export const COMPANIES_CHANGED = 'easybooks:companies-changed';

export function notifyCompaniesChanged() {
  window.dispatchEvent(new Event(COMPANIES_CHANGED));
}

export function onCompaniesChanged(handler) {
  window.addEventListener(COMPANIES_CHANGED, handler);
  return () => window.removeEventListener(COMPANIES_CHANGED, handler);
}
