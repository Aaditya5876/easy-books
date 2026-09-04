// Reads claims off the portal JWT for UI routing only (e.g. mustChangePassword) —
// never trust this for anything security-sensitive, the backend re-verifies
// the signature on every request.
export function decodePortalToken(token) {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
}
