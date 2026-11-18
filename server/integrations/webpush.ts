/**
 * Minimal Web Push sender (RFC 8030 + VAPID, RFC 8292) with no payload.
 *
 * Pushes carry no content: the service worker wakes up and fetches the
 * notification text from Waypoint itself, so the browser's push service
 * (Google, Mozilla, Microsoft, Apple) never sees what the reminder says.
 * That also means no payload encryption is needed.
 */
import { createPrivateKey, generateKeyPairSync, sign, type KeyObject } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { dirname } from 'node:path';

export interface VapidKeys {
  /** Uncompressed P-256 public key, base64url — what the browser needs as applicationServerKey. */
  publicKey: string;
  privateKeyPem: string;
}

const b64url = (b: Buffer) => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export function generateVapidKeys(): VapidKeys {
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const jwk = publicKey.export({ format: 'jwk' }) as { x: string; y: string };
  const raw = Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x, 'base64url'), Buffer.from(jwk.y, 'base64url')]);
  return { publicKey: b64url(raw), privateKeyPem: privateKey.export({ format: 'pem', type: 'pkcs8' }).toString() };
}

/** Load the server's VAPID keys from a file next to the database, creating them once. */
export function loadOrCreateVapidKeys(file: string): VapidKeys {
  if (existsSync(file)) {
    const k = JSON.parse(readFileSync(file, 'utf8')) as VapidKeys;
    if (k.publicKey && k.privateKeyPem) return k;
  }
  const keys = generateVapidKeys();
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(keys), { mode: 0o600 });
  try {
    chmodSync(file, 0o600);
  } catch {
    /* Windows ignores POSIX modes */
  }
  return keys;
}

/**
 * Push services we will send to. Restricting hosts stops a malicious
 * "subscription" from making the server call arbitrary URLs.
 */
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /(^|\.)notify\.windows\.com$/, /(^|\.)push\.apple\.com$/];

export function isAllowedEndpoint(endpoint: string): boolean {
  try {
    const u = new URL(endpoint);
    return u.protocol === 'https:' && !u.port && PUSH_HOSTS.some((re) => re.test(u.hostname));
  } catch {
    return false;
  }
}

let keyCache: { pem: string; key: KeyObject } | null = null;

export function vapidAuthorization(endpoint: string, keys: VapidKeys, subject: string, nowMs: number): string {
  const aud = new URL(endpoint).origin;
  const header = b64url(Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64url(Buffer.from(JSON.stringify({ aud, exp: Math.floor(nowMs / 1000) + 12 * 3600, sub: subject })));
  if (!keyCache || keyCache.pem !== keys.privateKeyPem) keyCache = { pem: keys.privateKeyPem, key: createPrivateKey(keys.privateKeyPem) };
  // ES256 JWTs need the raw r||s signature, not DER.
  const sig = sign('sha256', Buffer.from(`${header}.${claims}`), { key: keyCache.key, dsaEncoding: 'ieee-p1363' });
  return `vapid t=${header}.${claims}.${b64url(sig)}, k=${keys.publicKey}`;
}

export type PushResult = 'sent' | 'gone' | 'failed';

/** Send one content-free push. "gone" means the subscription expired and should be deleted. */
export async function sendPush(endpoint: string, keys: VapidKeys, subject: string, fetchImpl: typeof fetch = fetch, nowMs = Date.now()): Promise<PushResult> {
  if (!isAllowedEndpoint(endpoint)) return 'gone';
  try {
    const res = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { TTL: '3600', Urgency: 'normal', Authorization: vapidAuthorization(endpoint, keys, subject, nowMs), 'Content-Length': '0' },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status === 404 || res.status === 410) return 'gone';
    return res.ok ? 'sent' : 'failed';
  } catch {
    return 'failed';
  }
}
