import { SetMetadata } from '@nestjs/common';

// Marks a staff route that is scoped to the logged-in user rather than a
// company (auth/me, notifications, the user's own company list, ...), so
// CompanyAccessGuard lets it through without a companyId. Every other staff
// route must name the company it touches.
export const NO_COMPANY_SCOPE_KEY = 'noCompanyScope';
export const NoCompanyScope = () => SetMetadata(NO_COMPANY_SCOPE_KEY, true);
