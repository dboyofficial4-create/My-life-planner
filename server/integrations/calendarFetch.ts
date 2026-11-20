/**
 * Fetch a team calendar feed the student pasted (webcal:// or https://), safely:
 * https only, no private or local addresses (checked after DNS, and again after every redirect),
 * at most 3 redirects, 10 seconds, 2 MB. The server never sends cookies or credentials with it.
 */
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { HttpError } from '../http';

const MAX_BYTES = 2 * 1024 * 1024;

function isPrivate(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split('.').map(Number) as [number, number];
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  if (v === 6) {
    const s = ip.toLowerCase();
    if (s.startsWith('::ffff:')) return isPrivate(s.slice(7));
    return s === '::1' || s === '::' || s.startsWith('fc') || s.startsWith('fd') || s.startsWith('fe8') || s.startsWith('fe9') || s.startsWith('fea') || s.startsWith('feb') || s.startsWith('ff');
  }
  return true;
}

export function normalizeCalendarUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw.trim().replace(/^webcals?:\/\//i, 'https://'));
  } catch {
    throw new HttpError(422, 'validation', 'That doesn’t look like a calendar link.', { fields: { url: 'Not a link' } });
  }
  if (u.protocol !== 'https:') throw new HttpError(422, 'validation', 'Use the https:// or webcal:// calendar link.', { fields: { url: 'Needs https' } });
  if (u.username || u.password || (u.port && u.port !== '443')) throw new HttpError(422, 'validation', 'That calendar link isn’t supported.', { fields: { url: 'Not supported' } });
  return u;
}

async function assertPublicHost(host: string) {
  const h = host.replace(/^\[|\]$/g, '');
  if (isIP(h)) {
    if (isPrivate(h)) throw new HttpError(422, 'validation', 'That calendar link points to a private address.', { fields: { url: 'Private address' } });
    return;
  }
  let addrs: { address: string }[];
  try {
    addrs = await lookup(h, { all: true });
  } catch {
    throw new HttpError(422, 'calendar_unreachable', 'Couldn’t find that calendar’s website. Check the link.');
  }
  if (!addrs.length || addrs.some((a) => isPrivate(a.address))) throw new HttpError(422, 'validation', 'That calendar link points to a private address.', { fields: { url: 'Private address' } });
}

export async function fetchCalendar(raw: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  let url = normalizeCalendarUrl(raw);
  for (let hop = 0; hop <= 3; hop++) {
    await assertPublicHost(url.hostname);
    let res: Response;
    try {
      res = await fetchImpl(url, { redirect: 'manual', signal: AbortSignal.timeout(10_000), headers: { accept: 'text/calendar, text/plain, */*' }, credentials: 'omit' });
    } catch {
      throw new HttpError(422, 'calendar_unreachable', 'Couldn’t download that calendar. Check the link, or download the .ics file and upload it instead.');
    }
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      url = normalizeCalendarUrl(new URL(res.headers.get('location')!, url).toString());
      continue;
    }
    if (!res.ok) throw new HttpError(422, 'calendar_unreachable', `The calendar site answered ${res.status}. If it needs a login, download the .ics file and upload it instead.`);
    if (Number(res.headers.get('content-length') ?? 0) > MAX_BYTES) throw new HttpError(413, 'too_large', 'That calendar is too large.');
    const reader = res.body?.getReader();
    if (!reader) return '';
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) {
        await reader.cancel();
        throw new HttpError(413, 'too_large', 'That calendar is too large.');
      }
      chunks.push(value);
    }
    return new TextDecoder().decode(Buffer.concat(chunks));
  }
  throw new HttpError(422, 'calendar_unreachable', 'That calendar link redirects too many times.');
}

export const _isPrivate = isPrivate;
