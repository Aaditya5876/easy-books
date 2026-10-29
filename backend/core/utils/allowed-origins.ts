// Frontends allowed to call the API (CORS) — also the only places a payment
// gateway may send a parent back to after paying.
const DEFAULT_ORIGINS = [
  'https://onebooknp.com',
  'https://www.onebooknp.com',
  'http://localhost:5173',
  'http://localhost:3000',
];

export function allowedOrigins(): string[] {
  return process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean)
    : DEFAULT_ORIGINS;
}

// Where to send a parent back to after an online payment: FRONTEND_URL when
// configured, otherwise the requesting page's origin if it's a trusted one.
// Never a value the browser can freely choose.
export function frontendBaseUrl(requestOrigin?: string): string | null {
  if (process.env.FRONTEND_URL) return process.env.FRONTEND_URL.replace(/\/+$/, '');
  if (requestOrigin && allowedOrigins().includes(requestOrigin)) return requestOrigin;
  return null;
}
