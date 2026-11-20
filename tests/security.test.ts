import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { Db } from '../server/db';
import { createApp } from '../server/app';
import { appCsp, welcomeCsp } from '../server/security';

describe('page lock (Content-Security-Policy)', () => {
  it('only lets the app talk to its own server and run its own scripts', () => {
    const csp = appCsp();
    expect(csp).toContain("connect-src 'self';");
    expect(csp).toContain("script-src 'self';");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
    expect(welcomeCsp()).toContain("connect-src 'self';");
  });

  it('is sent with HTML pages, and security headers with every response', async () => {
    const app = createApp(new Db(':memory:'), { secureCookies: false });
    app.get('/page', (c) => c.html('<p>hi</p>'));
    const page = await app.request('/page', { headers: { host: 'localhost' } });
    expect(page.headers.get('content-security-policy')).toBe(appCsp());
    const api = await app.request('/api/health', { headers: { host: 'localhost' } });
    expect(api.headers.get('x-content-type-options')).toBe('nosniff');
    expect(api.headers.get('referrer-policy')).toBe('no-referrer');
  });

  it('the app page has no inline scripts for the policy to have to allow', () => {
    expect(readFileSync('index.html', 'utf8')).not.toMatch(/<script>(?!\s*<\/script>)/);
  });
});

describe('progress photos never reach the server', () => {
  it('there is no route that accepts them', async () => {
    const app = createApp(new Db(':memory:'), { secureCookies: false });
    for (const path of ['/api/progress-photos', '/api/fitness/photos', '/api/photos', '/api/vault']) {
      const r = await app.request(path, { method: 'POST', headers: { host: 'localhost', 'content-type': 'application/json' }, body: '{}' });
      expect([401, 404]).toContain(r.status);
    }
    const src = ['server/routes/modules.ts', 'server/routes/account.ts', 'server/repos/store.ts'].map((f) => readFileSync(f, 'utf8')).join('\n');
    expect(src).not.toMatch(/vault|progress_photo/i);
  });
});
