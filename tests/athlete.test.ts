import { describe, expect, it } from 'vitest';
import { Db } from '../server/db';
import { createApp } from '../server/app';
import { readiness, type ReadinessInput } from '../shared/domain/fitness/readiness';
import { classifyEvent, gameDayRequests, parseTeamIcs } from '../shared/domain/sports/schedule';
import { fetchCalendar, normalizeCalendarUrl, _isPrivate } from '../server/integrations/calendarFetch';
import type { ActivityRequest, FixedBlock } from '../shared/domain/planner/types';

const fine: ReadinessInput = { sleepHours: 9, sleepQuality: 4, soreness: 2, energy: 4, stress: 2, pain: false, painNote: '' };

describe('readiness check-in', () => {
  it('green, yellow and red, with reasons', () => {
    expect(readiness(fine, { adult: false })).toMatchObject({ level: 'green', plan: 'normal', reasons: [] });
    const tired = readiness({ ...fine, sleepHours: 6, soreness: 4 }, { adult: false });
    expect(tired.level).toBe('yellow');
    expect(tired.reasons).toEqual(expect.arrayContaining(['6 hours of sleep', 'Sore']));
    expect(readiness({ ...fine, sleepHours: 4.5, energy: 1, soreness: 5 }, { adult: false })).toMatchObject({ level: 'red', plan: 'recovery' });
  });
  it('pain always means a recovery day and a "get it checked" message', () => {
    const r = readiness({ ...fine, pain: true }, { adult: true });
    expect(r).toMatchObject({ level: 'red', plan: 'recovery' });
    expect(r.advice.join(' ')).toMatch(/Don’t train through pain/);
  });
  it('teens need more sleep than adults', () => {
    expect(readiness({ ...fine, sleepHours: 7 }, { adult: true }).score).toBe(100);
    expect(readiness({ ...fine, sleepHours: 7 }, { adult: false }).score).toBeLessThan(100);
  });
});

const ICS = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:g1@team
SUMMARY:Varsity Basketball vs Central High
DTSTART:20261124T000000Z
DTEND:20261124T020000Z
LOCATION:Home gym
END:VEVENT
BEGIN:VEVENT
UID:g2@team
SUMMARY:@ Westfield
DTSTART;TZID=America/Chicago:20261128T140000
DTEND;TZID=America/Chicago:20261128T160000
END:VEVENT
BEGIN:VEVENT
UID:p1@team
SUMMARY:Practice
DTSTART;TZID=America/Chicago:20261124T153000
DTEND;TZID=America/Chicago:20261124T171500
END:VEVENT
BEGIN:VEVENT
UID:c1@team
SUMMARY:Scrimmage vs North
STATUS:CANCELLED
DTSTART:20261130T230000Z
END:VEVENT
BEGIN:VEVENT
UID:a1@team
SUMMARY:Team banquet
DTSTART;VALUE=DATE:20261205
END:VEVENT
END:VCALENDAR`;

describe('team schedule', () => {
  it('reads times in the student’s time zone and skips cancelled events', () => {
    const { events, skipped } = parseTeamIcs(ICS, 'America/Chicago');
    expect(skipped).toBe(1);
    const g1 = events.find((e) => e.uid === 'g1@team')!;
    expect(g1).toMatchObject({ date: '2026-11-23', start: 18 * 60, end: 20 * 60, location: 'Home gym' }); // 00:00Z = 6 pm Chicago the day before
    expect(events.find((e) => e.uid === 'g2@team')).toMatchObject({ date: '2026-11-28', start: 14 * 60, end: 16 * 60 });
    expect(events.find((e) => e.uid === 'a1@team')).toMatchObject({ start: null, end: null });
  });
  it('tells games from practices, and away from home', () => {
    expect(classifyEvent('Varsity Basketball vs Central High')).toEqual({ kind: 'game', away: false });
    expect(classifyEvent('@ Westfield')).toEqual({ kind: 'game', away: true });
    expect(classifyEvent('Soccer at Lincoln HS')).toEqual({ kind: 'game', away: true });
    expect(classifyEvent('Practice')).toEqual({ kind: 'practice', away: false });
    expect(classifyEvent('Conditioning')).toEqual({ kind: 'practice', away: false });
  });

  it('adds a pre-game meal, snack, recovery snack and next-day recovery', () => {
    const game: FixedBlock = { id: 'g:2026-11-24', date: '2026-11-24', start: 19 * 60, end: 21 * 60, title: 'Game', category: 'sport', kind: 'game', travelBefore: 60, travelAfter: 60, load: 3 };
    const dates = ['2026-11-24', '2026-11-25'];
    const awake = { '2026-11-24': { start: 390, end: 1350 }, '2026-11-25': { start: 390, end: 1350 } };
    const out = gameDayRequests([game], dates, awake, []);
    const meal = out.find((r) => r.title === 'Pre-game meal')!;
    expect(meal.window).toEqual({ start: 14 * 60, end: 16 * 60 }); // 4 to 2 hours before leaving at 6 pm
    expect(out.find((r) => r.title === 'Pre-game snack')!.window).toEqual({ start: 16 * 60 + 30, end: 17 * 60 + 40 });
    expect(out.find((r) => r.title === 'Recovery snack')!.window.start).toBe(21 * 60);
    expect(out.find((r) => r.category === 'recovery')!.eligibleDates).toEqual(['2026-11-25']);
  });

  it('turns an overlapping lunch into the pre-game meal instead of adding a second meal', () => {
    const game: FixedBlock = { id: 'g:2026-11-28', date: '2026-11-28', start: 16 * 60, end: 18 * 60, title: 'Game', category: 'sport', kind: 'game', travelBefore: 0, travelAfter: 0, load: 3 };
    const lunch: ActivityRequest = { key: 'meal:lunch:2026-11-28', title: 'Lunch: Turkey tomato pasta', category: 'meal', idealMinutes: 30, minMinutes: 15, count: 1, perDay: true, eligibleDates: ['2026-11-28'], priority: 1, window: { start: 690, end: 870 }, hardWindow: true, explain: 'Midday fuel.' };
    const out = gameDayRequests([game], ['2026-11-28'], { '2026-11-28': { start: 480, end: 1380 } }, [lunch]);
    expect(out.some((r) => r.title === 'Pre-game meal')).toBe(false);
    expect(lunch.title).toBe('Lunch (pre-game meal): Turkey tomato pasta');
    expect(lunch.window).toEqual({ start: 720, end: 840 });
  });
});

describe('calendar links are fetched safely', () => {
  it('only https/webcal to public addresses', async () => {
    expect(normalizeCalendarUrl('webcal://example.com/team.ics').protocol).toBe('https:');
    expect(() => normalizeCalendarUrl('http://example.com/team.ics')).toThrow(/https/);
    expect(() => normalizeCalendarUrl('file:///etc/passwd')).toThrow();
    for (const ip of ['127.0.0.1', '10.1.2.3', '192.168.0.4', '172.20.0.1', '169.254.169.254', '::1', 'fd00::1', '::ffff:127.0.0.1']) expect(_isPrivate(ip), ip).toBe(true);
    for (const ip of ['8.8.8.8', '151.101.1.1']) expect(_isPrivate(ip), ip).toBe(false);
    await expect(fetchCalendar('https://127.0.0.1/cal.ics')).rejects.toMatchObject({ status: 422 });
    await expect(fetchCalendar('https://169.254.169.254/latest/meta-data')).rejects.toMatchObject({ status: 422 });
  });
  it('re-checks every redirect', async () => {
    const fake = (async () => new Response(null, { status: 302, headers: { location: 'https://10.0.0.5/secret.ics' } })) as unknown as typeof fetch;
    await expect(fetchCalendar('https://8.8.8.8/cal.ics', fake)).rejects.toMatchObject({ status: 422 });
  });
});

/* ---------- API ---------- */

function demoClient(now: Date) {
  const db = new Db(':memory:');
  const app = createApp(db, { secureCookies: false, now: () => now });
  let cookie = '';
  const req = async (method: string, path: string, body?: unknown) => {
    const res = await app.request(path, { method, headers: { host: 'localhost', ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0]!;
    const text = await res.text();
    return { status: res.status, json: text ? JSON.parse(text) : null, text };
  };
  return { get: (p: string) => req('GET', p), post: (p: string, b: unknown = {}) => req('POST', p, b) };
}

describe('readiness and team schedule API', () => {
  // A Wednesday morning in New York (the demo account's time zone); the demo plans a workout that day.
  const NOW = new Date('2026-11-18T13:00:00Z');

  it('a red check-in moves today’s training and adds recovery', async () => {
    const c = demoClient(NOW);
    expect((await c.post('/api/auth/demo')).status).toBe(201);
    expect((await c.get('/api/readiness')).json).toMatchObject({ today: '2026-11-18', entry: null });
    type Change = { type: string; title: string; category: string; source: string; to?: { date: string } };
    const onToday = (changes: Change[]) => changes.filter((ch) => ch.type !== 'removed' && ch.to?.date === '2026-11-18');
    const before = onToday((await c.post('/api/plan/preview', { weekStart: '2026-11-16' })).json.changes);
    expect(before.some((ch) => ch.category === 'workout')).toBe(true); // there is something to move
    const r = await c.post('/api/readiness', { ...fine, sleepHours: 4, energy: 1, soreness: 5 });
    expect(r.status, r.text).toBe(201);
    expect(r.json).toMatchObject({ result: { level: 'red', plan: 'recovery' }, planChanged: true });
    const p = await c.post('/api/plan/preview', { weekStart: '2026-11-16' });
    expect(p.status, p.text).toBe(200);
    const today = onToday(p.json.changes);
    expect(today.some((ch) => ch.category === 'recovery')).toBe(true);
    // no generated workout or skill session left on today (team practice is fixed and stays)
    expect(today.filter((ch) => ch.source !== 'fixed' && (ch.category === 'workout' || ch.category === 'sport')).map((ch) => ch.title)).toEqual([]);
    expect(p.json.notes.join(' ')).toMatch(/recover today/);
  });

  it('imports a team calendar once, updates on re-import, and lists the games', async () => {
    const c = demoClient(NOW);
    await c.post('/api/auth/demo');
    const prev = await c.post('/api/sports/schedule/preview', { text: ICS.replaceAll('America/Chicago', 'America/New_York') });
    expect(prev.status, prev.text).toBe(200);
    const timed = prev.json.events.filter((e: { start: number | null }) => e.start !== null);
    expect(timed.map((e: { kind: string }) => e.kind)).toEqual(['game', 'practice', 'game']);
    const first = await c.post('/api/sports/schedule/import', { events: timed, travelAway: 45, travelHome: 10 });
    expect(first.json).toEqual({ added: 3, updated: 0 });
    const again = await c.post('/api/sports/schedule/import', { events: timed, travelAway: 45, travelHome: 10 });
    expect(again.json).toEqual({ added: 0, updated: 3 });
    expect((await c.post('/api/sports/schedule/preview', { text: ICS })).json.events.filter((e: { alreadyImported: boolean }) => e.alreadyImported)).toHaveLength(3);
    const games = (await c.get('/api/sports/games')).json.games;
    expect(games.some((g: { title: string }) => g.title === 'Varsity Basketball vs Central High')).toBe(true);
    expect(games.find((g: { title: string }) => g.title === '@ Westfield')).toMatchObject({ travelBefore: 45 });
  });
});

describe('early games', () => {
  it('turn breakfast into the pre-game meal when there’s no time for a separate one', () => {
    const game: FixedBlock = { id: 'g:2026-11-21', date: '2026-11-21', start: 10 * 60, end: 12 * 60, title: 'Game', category: 'sport', kind: 'game', travelBefore: 30, travelAfter: 30, load: 3 };
    const breakfast: ActivityRequest = { key: 'meal:breakfast:2026-11-21', title: 'Breakfast: Greek yogurt berry bowl', category: 'meal', idealMinutes: 20, minMinutes: 10, count: 1, perDay: true, eligibleDates: ['2026-11-21'], priority: 1, window: { start: 480, end: 580 }, hardWindow: true, explain: 'A regular breakfast.' };
    const out = gameDayRequests([game], ['2026-11-21'], { '2026-11-21': { start: 480, end: 1380 } }, [breakfast]);
    expect(out.some((r) => r.title === 'Pre-game meal')).toBe(false);
    expect(breakfast.title).toBe('Breakfast (pre-game meal): Greek yogurt berry bowl');
    expect(breakfast.window).toEqual({ start: 480, end: 510 }); // eaten by 8:30, an hour before leaving at 9:30
    expect(out.find((r) => r.title === 'Pre-game snack')).toBeTruthy();
  });
});
