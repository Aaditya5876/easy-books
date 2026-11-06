import apiClient from '@/api/client';

// Uploaded files are stored as API-relative links (/uploads/<name>) and served
// by the API behind a session check; the browser sends the session cookie, so
// only the API origin needs adding.
export function fileUrl(url = '') {
  if (!url || /^(https?:|blob:|data:)/i.test(url)) return url;
  return `${apiClient.defaults.baseURL}${url}`;
}
