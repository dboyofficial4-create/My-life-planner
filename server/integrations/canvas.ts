/**
 * Canvas LMS via a user-generated personal access token.
 *
 * Canvas documents personal access tokens for users who want to call the REST
 * API for their own account (Account → Settings → "+ New Access Token"). Some
 * institutions disable token creation; in that case only an institution-issued
 * Developer Key (OAuth) would work, which is not implemented here.
 *
 * Safety rules:
 *  - The token is only ever sent to the Canvas host the user entered (https only,
 *    no IP literals or localhost, no redirects followed, pagination stays on host).
 *  - The token is never logged or returned to the client.
 */

export class CanvasError extends Error {
  constructor(
    readonly kind: 'bad_url' | 'auth' | 'forbidden' | 'not_found' | 'network' | 'unexpected',
    message: string,
  ) {
    super(message);
  }
}

/** Normalise "school.instructure.com" / "https://canvas.school.edu/courses" → "https://host". */
export function normalizeBaseUrl(input: string): string {
  let raw = input.trim();
  if (!raw) throw new CanvasError('bad_url', 'Enter your school’s Canvas address.');
  if (!/^[a-z]+:\/\//i.test(raw)) raw = `https://${raw}`;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new CanvasError('bad_url', 'That doesn’t look like a web address. It usually looks like yourschool.instructure.com.');
  }
  if (url.protocol !== 'https:') throw new CanvasError('bad_url', 'Canvas addresses must start with https://.');
  if (url.username || url.password) throw new CanvasError('bad_url', 'Remove any username or password from the address.');
  const host = url.hostname.toLowerCase();
  const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':') || host.startsWith('[');
  if (isIp || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal') || !host.includes('.')) {
    throw new CanvasError('bad_url', 'Use your school’s public Canvas address (for example yourschool.instructure.com).');
  }
  return `https://${host}${url.port ? `:${url.port}` : ''}`;
}

export type FetchFn = typeof fetch;

export interface CanvasClient {
  baseUrl: string;
  get<T>(path: string, params?: Record<string, string | string[]>): Promise<T>;
  getAll<T>(path: string, params?: Record<string, string | string[]>, maxPages?: number): Promise<T[]>;
}

function buildUrl(baseUrl: string, path: string, params: Record<string, string | string[]> = {}): string {
  const u = new URL(path, baseUrl);
  for (const [k, v] of Object.entries(params)) {
    for (const item of Array.isArray(v) ? v : [v]) u.searchParams.append(k, item);
  }
  return u.toString();
}

function nextLink(header: string | null): string | null {
  if (!header) return null;
  for (const part of header.split(',')) {
    const m = /<([^>]+)>\s*;\s*rel="?next"?/.exec(part);
    if (m) return m[1]!;
  }
  return null;
}

export function canvasClient(baseUrl: string, token: string, fetchImpl: FetchFn = fetch): CanvasClient {
  const origin = new URL(baseUrl).origin;
  const request = async (url: string) => {
    if (new URL(url).origin !== origin) throw new CanvasError('unexpected', 'Canvas returned a link to a different site, so it was not followed.');
    let res: Response;
    try {
      res = await fetchImpl(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        redirect: 'manual',
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new CanvasError('network', `Couldn’t reach ${new URL(baseUrl).host}. Check the address and your internet connection.`);
    }
    if (res.status >= 300 && res.status < 400) {
      throw new CanvasError('bad_url', 'That address redirects somewhere else. Use the address shown in your browser when you’re logged in to Canvas.');
    }
    if (res.status === 401) throw new CanvasError('auth', 'Canvas rejected the access token. It may be mistyped, expired or deleted — create a new one in Canvas.');
    if (res.status === 403) {
      const text = await res.text().catch(() => '');
      if (/rate limit/i.test(text)) throw new CanvasError('forbidden', 'Canvas is rate-limiting requests. Try syncing again in a few minutes.');
      throw new CanvasError('forbidden', 'Canvas refused this request. Your school may restrict API access for students.');
    }
    if (res.status === 404) throw new CanvasError('not_found', 'Canvas API not found at that address. Check it’s your school’s Canvas site.');
    if (!res.ok) throw new CanvasError('unexpected', `Canvas responded with an error (${res.status}). Try again later.`);
    const ct = res.headers.get('content-type') ?? '';
    if (!ct.includes('json')) throw new CanvasError('not_found', 'That address didn’t respond like Canvas. Check it’s your school’s Canvas site.');
    // Canvas may prefix JSON with "while(1);" as an anti-hijacking measure.
    const body = (await res.text()).replace(/^while\(1\);/, '');
    let data: unknown;
    try {
      data = JSON.parse(body);
    } catch {
      throw new CanvasError('unexpected', 'Canvas sent a response that couldn’t be read.');
    }
    return { data, next: nextLink(res.headers.get('link')) };
  };
  return {
    baseUrl,
    async get<T>(path: string, params?: Record<string, string | string[]>) {
      return (await request(buildUrl(baseUrl, path, params))).data as T;
    },
    async getAll<T>(path: string, params: Record<string, string | string[]> = {}, maxPages = 20) {
      const out: T[] = [];
      let url: string | null = buildUrl(baseUrl, path, { per_page: '100', ...params });
      for (let i = 0; url && i < maxPages; i++) {
        const { data, next }: { data: unknown; next: string | null } = await request(url);
        if (!Array.isArray(data)) throw new CanvasError('unexpected', 'Canvas sent an unexpected response.');
        out.push(...(data as T[]));
        url = next;
      }
      return out;
    },
  };
}

/* ---------- Canvas API shapes (only the fields we use) ---------- */

export interface CanvasUser {
  id: number;
  name: string;
}
export interface CanvasCourse {
  id: number;
  name?: string;
  course_code?: string;
  access_restricted_by_date?: boolean;
  apply_assignment_group_weights?: boolean;
  enrollments?: { type: string; computed_current_score?: number | null }[];
}
export interface CanvasSubmission {
  workflow_state?: string;
  submitted_at?: string | null;
  score?: number | null;
  excused?: boolean | null;
}
export interface CanvasAssignment {
  id: number;
  name: string;
  due_at: string | null;
  points_possible: number | null;
  submission_types?: string[];
  published?: boolean;
  omit_from_final_grade?: boolean;
  submission?: CanvasSubmission;
}
export interface CanvasAssignmentGroup {
  id: number;
  name: string;
  group_weight: number | null;
  assignments?: CanvasAssignment[];
}
