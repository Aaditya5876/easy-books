// A company is reachable only when BOTH switches allow it: isActive (manual
// suspend, toggled by SUPER_ADMIN) and subscriptionExpiresAt (automatic,
// time-based — null means no expiry). Shared by CompanyAccessGuard (blocks
// companyId-scoped API calls) and AuthServiceImpl.assertHasActiveCompany
// (blocks sign-in once every company a user belongs to fails this) so the
// two can't drift out of sync.
export function isCompanyAccessible(company: { isActive: boolean; subscriptionExpiresAt: Date | null }): boolean {
  if (!company.isActive) return false;
  if (company.subscriptionExpiresAt && company.subscriptionExpiresAt.getTime() <= Date.now()) return false;
  return true;
}
