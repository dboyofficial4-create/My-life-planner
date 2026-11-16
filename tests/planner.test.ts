import { describe, expect, it } from 'vitest';
import { generatePlan, validatePlan } from '../shared/domain/planner/engine';
import { buildPlanInput, expandCommitments } from '../shared/domain/planner/build';
import { replan, type StoredItem } from '../shared/domain/planner/replan';
import type { ActivityRequest, PlanInput } from '../shared/domain/planner/types';
import { agePolicy } from '../shared/domain/age';
import { generateProgram } from '../shared/domain/fitness/generator';
import type { Commitment } from '../shared/schemas';
import { WEEK, fitness, goal, school, settings } from './fixtures';

const awakeAll = (start = 7 * 60, end = 22 * 60) => Object.fromEntries(WEEK.map((d) => [d, { start, end }]));

const baseInput = (o: Partial<PlanInput> = {}): PlanInput => ({
  dates: WEEK,
  awake: awakeAll(),
  fixed: [],
  requests: [],
  restDates: [],
  busyDates: [],
  dailyLoadCap: 3,
  transitionMinutes: 10,
  ...o,
});

const req = (o: Partial<ActivityRequest> = {}): ActivityRequest => ({
  key: 'workout:A',
  title: 'Workout',
  category: 'workout',
  idealMinutes: 60,
  minMinutes: 30,
  count: 3,
  priority: 2,
  window: { start: 17 * 60, end: 20 * 60 },
  explain: 'test',
  ...o,
});

describe('planning engine', () => {
  it('never schedules flexible activities over fixed commitments or their travel time', () => {
    const fixed = expandCommitments([school()], WEEK);
    const input = baseInput({ fixed, requests: [req({ window: { start: 8 * 60, end: 12 * 60 }, count: 5 })] });
    const out = generatePlan(input);
    expect(validatePlan(out.items, input)).toEqual([]);
    for (const it of out.items.filter((i) => i.source === 'generated')) {
      const f = fixed.find((x) => x.date === it.date);
      if (f) expect(it.end <= f.start - f.travelBefore || it.start >= f.end + f.travelAfter).toBe(true);
    }
  });

  it('keeps a transition buffer between consecutive blocks', () => {
    const fixed = expandCommitments([school()], WEEK);
    const out = generatePlan(baseInput({ fixed, requests: [req({ window: { start: 15 * 60, end: 18 * 60 }, count: 1, eligibleDates: [WEEK[0]!] })] }));
    const w = out.items.find((i) => i.source === 'generated')!;
    expect(w.start).toBeGreaterThanOrEqual(15 * 60 + 20 + 10);
  });

  it('flags overlapping fixed commitments instead of hiding them', () => {
    const a: Commitment = { ...school('a'), title: 'Work shift', kind: 'work', recurrence: { type: 'weekly', days: [1] }, start: '14:00', end: '18:00', travelBefore: 0, travelAfter: 0 };
    const fixed = expandCommitments([school(), a], WEEK);
    const out = generatePlan(baseInput({ fixed }));
    expect(out.conflicts).toHaveLength(1);
    expect(out.warnings.join(' ')).toMatch(/overlap/);
  });

  it('reports what did not fit and why when availability is insufficient', () => {
    const out = generatePlan(baseInput({ awake: awakeAll(7 * 60, 7 * 60 + 40), requests: [req({ count: 3, minMinutes: 45 })] }));
    expect(out.items.filter((i) => i.source === 'generated')).toHaveLength(0);
    expect(out.unscheduled[0]).toMatchObject({ requestKey: 'workout:A', placed: 0, wanted: 3 });
    expect(out.unscheduled[0]!.reason).toMatch(/longest open slot|no free time/i);
    expect(out.warnings.join(' ')).toMatch(/Not everything important fits/);
  });

  it('shortens sessions when only a short slot is available', () => {
    const fixed = [{ id: 'x', date: WEEK[0]!, start: 17 * 60 + 40, end: 21 * 60, title: 'Job', category: 'commitment' as const, kind: 'work' as const, travelBefore: 0, travelAfter: 0, load: 0 }];
    const out = generatePlan(baseInput({ dates: [WEEK[0]!], awake: { [WEEK[0]!]: { start: 17 * 60, end: 22 * 60 } }, fixed, requests: [req({ count: 1 })] }));
    const w = out.items.find((i) => i.source === 'generated');
    expect(w?.shortened).toBe(true);
    expect(w!.end - w!.start).toBe(30);
  });

  it('uses the shorter version on busy days', () => {
    const out = generatePlan(baseInput({ busyDates: [...WEEK], requests: [req({ count: 2 })] }));
    for (const it of out.items) expect(it.end - it.start).toBe(30);
  });

  it('prioritises higher-priority goals when time is scarce', () => {
    const awake = { [WEEK[0]!]: { start: 17 * 60, end: 18 * 60 + 10 } };
    const out = generatePlan(
      baseInput({
        dates: [WEEK[0]!],
        awake,
        requests: [req({ key: 'low', title: 'Low', priority: 4, count: 1, minMinutes: 60 }), req({ key: 'high', title: 'High', priority: 1, count: 1, minMinutes: 60 })],
      }),
    );
    expect(out.items.map((i) => i.title)).toEqual(['High']);
    expect(out.unscheduled.map((u) => u.title)).toEqual(['Low']);
  });

  it('respects the daily training-load cap and rest days', () => {
    const practice = { id: 'p', kind: 'practice' as const, title: 'Practice', recurrence: { type: 'weekly' as const, days: [1, 2, 3, 4, 5] }, start: '15:30', end: '17:30', travelBefore: 0, travelAfter: 0, location: '', intensity: 2, exceptions: [] };
    const fixed = expandCommitments([practice], WEEK);
    const out = generatePlan(baseInput({ fixed, restDates: [WEEK[6]!], requests: [req({ count: 3, load: 2, group: 'strength', minGapDays: 0 })] }));
    const placed = out.items.filter((i) => i.source === 'generated');
    // Weekdays are at load 2 already; only Saturday is open (Sunday is a rest day).
    expect(placed.map((p) => p.date)).toEqual([WEEK[5]]);
    expect(out.unscheduled[0]!.reason).toMatch(/training load/);
  });

  it('spaces strength sessions with recovery days', () => {
    const out = generatePlan(baseInput({ requests: ['A', 'B', 'C'].map((k) => req({ key: `w:${k}`, count: 1, group: 'strength', minGapDays: 1, load: 2 })) }));
    const days = out.items.map((i) => WEEK.indexOf(i.date)).sort();
    for (let i = 1; i < days.length; i++) expect(days[i]! - days[i - 1]!).toBeGreaterThanOrEqual(2);
  });

  it('does not place items before "now" when replanning mid-day', () => {
    const out = generatePlan(baseInput({ notBefore: { date: WEEK[2]!, minute: 18 * 60 }, requests: [req({ count: 5, window: { start: 9 * 60, end: 12 * 60 } })] }));
    for (const it of out.items) {
      expect(it.date >= WEEK[2]!).toBe(true);
      if (it.date === WEEK[2]) expect(it.start).toBeGreaterThanOrEqual(18 * 60);
    }
  });

  it('handles a cancelled occurrence of a recurring commitment', () => {
    const c = { ...school(), exceptions: [WEEK[2]!] };
    const fixed = expandCommitments([c], WEEK);
    expect(fixed.map((f) => f.date)).not.toContain(WEEK[2]);
    expect(fixed).toHaveLength(4);
  });
});

describe('plan builder', () => {
  it('builds a valid full week for a student athlete and skips lunch during school', () => {
    const s = settings({ profile: { ...settings().profile, modules: ['fitness', 'school'] }, fitness: fitness() });
    const policy = agePolicy(s.profile.birthday, '2026-11-16');
    const program = generateProgram({ fitness: s.fitness!, goals: [goal('fitness', 'strength', 1)], policy });
    const { input, notes } = buildPlanInput({ dates: WEEK, today: WEEK[0]!, settings: s, goals: [goal('fitness', 'strength', 1)], commitments: [school()], policy, program });
    const out = generatePlan(input);
    expect(validatePlan(out.items, input)).toEqual([]);
    expect(out.items.some((i) => i.title.startsWith('Lunch') && i.date === WEEK[0])).toBe(false);
    expect(out.items.some((i) => i.title.startsWith('Lunch') && i.date === WEEK[5])).toBe(true);
    expect(notes.join(' ')).toMatch(/Lunch on school/);
    expect(out.items.filter((i) => i.category === 'workout')).toHaveLength(3);
    // Sunday is a rest day: no load-bearing workouts.
    expect(out.items.some((i) => i.date === WEEK[6] && i.category === 'workout')).toBe(false);
  });

  it('keeps hard training off game days and the day before', () => {
    const s = settings({ profile: { ...settings().profile, modules: ['fitness'] }, fitness: fitness({ sessionsPerWeek: 3 }) });
    const game: Commitment = { ...school('g'), kind: 'game', title: 'Game', recurrence: { type: 'once', date: WEEK[4]! }, start: '18:00', end: '20:00', intensity: 3 };
    const policy = agePolicy(s.profile.birthday, WEEK[0]!);
    const program = generateProgram({ fitness: s.fitness!, goals: [], policy });
    const { input } = buildPlanInput({ dates: WEEK, today: WEEK[0]!, settings: s, goals: [], commitments: [game], policy, program });
    const out = generatePlan(input);
    const hard = out.items.filter((i) => i.source === 'generated' && i.load > 0);
    expect(hard.some((i) => i.date === WEEK[3] || i.date === WEEK[4])).toBe(false);
  });
});

describe('replanning', () => {
  const now = { date: WEEK[2]!, minute: 12 * 60 };
  const input = baseInput({ requests: [req({ count: 3 }), req({ key: 'w:low', title: 'Low', priority: 4, count: 2, window: { start: 9 * 60, end: 11 * 60 } })] });
  const first = generatePlan(input);
  const stored: StoredItem[] = first.items.map((it, i) => ({ ...it, id: `i${i}`, status: 'planned', locked: false }));

  it('never moves locked items, even if they would be better elsewhere', () => {
    const target = stored.find((s) => s.date > now.date && s.requestKey === 'workout:A')!;
    const locked = { ...target, locked: true, start: 13 * 60, end: 14 * 60 };
    const current = stored.map((s) => (s.id === target.id ? locked : s));
    const r = replan(current, input, now);
    expect(r.kept).toContainEqual(locked);
    expect(r.changes.some((c) => c.from?.id === target.id)).toBe(false);
    for (const p of r.proposed) {
      if (p.date === locked.date) expect(p.end <= locked.start || p.start >= locked.end).toBe(true);
    }
    expect(r.validationErrors).toEqual([]);
  });

  it('keeps completed and past items and counts completed sessions toward the week', () => {
    const current = stored.map((s) => (s.date < now.date && s.requestKey === 'workout:A' ? { ...s, status: 'done' as const } : s));
    const doneCount = current.filter((c) => c.status === 'done').length;
    const r = replan(current, input, now);
    const future = r.proposed.filter((p) => p.requestKey === 'workout:A').length;
    expect(doneCount + future).toBeLessThanOrEqual(3);
    expect(r.kept.filter((k) => k.status === 'done')).toHaveLength(doneCount);
  });

  it('carries over missed high-priority sessions but limits the backlog', () => {
    const many = baseInput({
      requests: ['a', 'b', 'c', 'd'].map((k) => req({ key: k, title: k, count: 1, priority: 1, eligibleDates: undefined })),
    });
    const plan = generatePlan({ ...many, dates: WEEK });
    const cur: StoredItem[] = plan.items.map((it, i) => ({ ...it, id: `m${i}`, status: 'missed', locked: false, date: WEEK[0]! }));
    const r = replan(cur, many, { date: WEEK[1]!, minute: 0 }, 2);
    const carried = r.carryOver.reduce((s, c) => s + c.carried, 0);
    const dropped = r.carryOver.reduce((s, c) => s + c.dropped, 0);
    expect(carried).toBe(2);
    expect(dropped).toBe(2);
    expect(r.proposed).toHaveLength(2);
  });

  it('does not carry over missed low-priority sessions', () => {
    const lowOnly = baseInput({ requests: [req({ key: 'low', priority: 4, count: 1 })] });
    const cur: StoredItem[] = [{ ...generatePlan(lowOnly).items[0]!, id: 'x', status: 'missed', locked: false, date: WEEK[0]! }];
    const r = replan(cur, lowOnly, { date: WEEK[1]!, minute: 0 });
    expect(r.proposed).toHaveLength(0);
    expect(r.carryOver[0]).toMatchObject({ carried: 0, dropped: 1 });
  });

  it('produces a diff describing moves when a new commitment appears', () => {
    const blocker = { id: 'new', date: WEEK[3]!, start: 16 * 60, end: 21 * 60, title: 'Rehearsal', category: 'commitment' as const, kind: 'other' as const, travelBefore: 0, travelAfter: 0, load: 0 };
    const r = replan(stored, { ...input, fixed: [blocker] }, now);
    expect(r.changes.some((c) => c.type === 'added' && c.title === 'Rehearsal')).toBe(true);
    for (const p of r.proposed.filter((p) => p.date === WEEK[3] && p.source === 'generated')) {
      expect(p.end <= 16 * 60 - 10 || p.start >= 21 * 60 + 10).toBe(true);
    }
  });
});
