// The portal token lives in an HttpOnly cookie that page scripts can't read
// (so an injected script can't steal it). The page keeps only this non-secret
// marker for routing: "logged in" and "must change password first". The
// backend still decides on every request.
const KEY = 'portal_session';

export function getPortalSession() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || 'null');
  } catch {
    return null;
  }
}

export function setPortalSession({ mustChangePassword }) {
  localStorage.setItem(KEY, JSON.stringify({ mustChangePassword: !!mustChangePassword }));
}

export function clearPortalSession() {
  localStorage.removeItem(KEY);
  localStorage.removeItem('portal_student');
  localStorage.removeItem('portal_token'); // left over from the old Bearer login
}
