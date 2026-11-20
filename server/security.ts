/**
 * Content-Security-Policy: the browser itself refuses to let a page send data anywhere except
 * Waypoint's own server (connect-src 'self', form-action 'self'), load scripts from anywhere else,
 * or be framed by another site. This is what keeps on-device data such as progress photos from
 * being sent out even if a hostile script somehow got onto the page.
 */
const join = (d: Record<string, string>) => Object.entries(d).map(([k, v]) => `${k} ${v}`).join('; ');

const BASE = {
  'default-src': "'self'",
  'connect-src': "'self'",
  'img-src': "'self' data: blob: https://i.ytimg.com",
  'media-src': "'self' blob:",
  'font-src': "'self'",
  'worker-src': "'self'",
  'manifest-src': "'self'",
  'object-src': "'none'",
  'base-uri': "'none'",
  'form-action': "'self'",
  'frame-ancestors': "'none'",
  'frame-src': "'none'",
};

/** The app (everything except the static welcome page). */
export function appCsp(opts: { dev?: boolean } = {}) {
  return join({
    ...BASE,
    // Vite's dev server injects one inline script for hot reload and talks to the page over a websocket.
    'script-src': opts.dev ? "'self' 'unsafe-inline'" : "'self'",
    'style-src': "'self' 'unsafe-inline'",
    ...(opts.dev ? { 'connect-src': "'self' ws://localhost:* ws://127.0.0.1:*", 'font-src': "'self' https://fonts.gstatic.com", 'style-src': "'self' 'unsafe-inline' https://fonts.googleapis.com" } : {}),
  });
}

/** The static welcome page (public/start): its fonts come from Google Fonts and it has small inline scripts. */
export function welcomeCsp() {
  return join({
    ...BASE,
    'script-src': "'self' 'unsafe-inline'",
    'style-src': "'self' 'unsafe-inline' https://fonts.googleapis.com",
    'font-src': 'https://fonts.gstatic.com',
  });
}

export const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(self), microphone=(), geolocation=(), payment=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
};
