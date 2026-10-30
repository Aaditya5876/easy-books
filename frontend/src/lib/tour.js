import { TOUR_VERSION } from './guideContent';

// The tour runs once per user per product ("platform" | "school" | "business"),
// so a super admin who later switches into a school still gets the school tour.
// Remembered per browser; the Help & Guide page can always replay it.
const START_EVENT = 'onebook:start-tour';

export function tourMode(user) {
  if (user?.role === 'SUPER_ADMIN' && !user?.defaultCompanyId) return 'platform';
  return user?.defaultCompany?.businessType === 'SCHOOL' ? 'school' : 'business';
}

const seenKey = (userKey, mode) => `onebook.tour.v${TOUR_VERSION}.${userKey}.${mode}`;

export function hasSeenTour(userKey, mode) {
  try { return localStorage.getItem(seenKey(userKey, mode)) === 'done'; } catch { return false; }
}

export function markTourSeen(userKey, mode) {
  try { localStorage.setItem(seenKey(userKey, mode), 'done'); } catch { /* storage blocked */ }
}

export function startTour() {
  window.dispatchEvent(new Event(START_EVENT));
}

export function onStartTour(handler) {
  window.addEventListener(START_EVENT, handler);
  return () => window.removeEventListener(START_EVENT, handler);
}
