import { daysBetween, formatDuration, formatLocalDate, type LocalDate } from '../time';
import type { ActivityRequest, DayCapacity, FixedBlock, Interval, PlanInput, PlanItem, PlanOutput, Unscheduled } from './types';

/* ------------------------------------------------------------------ */
/* Interval helpers                                                    */
/* ------------------------------------------------------------------ */

export function mergeIntervals(list: Interval[]): Interval[] {
  const sorted = list.filter((i) => i.end > i.start).sort((a, b) => a.start - b.start);
  const out: Interval[] = [];
  for (const iv of sorted) {
    const last = out[out.length - 1];
    if (last && iv.start <= last.end) last.end = Math.max(last.end, iv.end);
    else out.push({ ...iv });
  }
  return out;
}

export function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

const roundUp5 = (n: number) => Math.ceil(n / 5) * 5;

/* ------------------------------------------------------------------ */
/* Day state                                                           */
/* ------------------------------------------------------------------ */

interface Occupied extends Interval {
  /** Awake-edge blocks (before notBefore) don't need a transition buffer. */
  hard: boolean;
}

class DayState {
  occupied: Occupied[] = [];
  load = 0;
  plannedMinutes = 0;
  fixedMinutes = 0;
  keys = new Set<string>();
  groups = new Set<string>();

  constructor(
    readonly date: LocalDate,
    readonly awake: Interval,
    readonly busy: boolean,
    readonly rest: boolean,
  ) {}

  occupy(iv: Interval, hard = true) {
    this.occupied.push({ start: Math.max(0, iv.start), end: Math.min(1440, iv.end), hard });
  }

  /** Free gaps inside the waking window, keeping `transition` minutes from neighbours. */
  freeGaps(transition: number): Interval[] {
    const busy = mergeIntervals(this.occupied.map((o) => ({ start: o.start, end: o.end })));
    const gaps: Interval[] = [];
    let cursor = this.awake.start;
    let cursorIsBlock = false;
    for (const b of busy) {
      if (b.end <= this.awake.start) continue;
      if (b.start >= this.awake.end) break;
      if (b.start > cursor) {
        gaps.push({ start: cursor + (cursorIsBlock ? transition : 0), end: b.start - transition });
      }
      cursor = Math.max(cursor, b.end);
      cursorIsBlock = true;
    }
    if (cursor < this.awake.end) gaps.push({ start: cursor + (cursorIsBlock ? transition : 0), end: this.awake.end });
    return gaps.filter((g) => g.end > g.start);
  }
}

interface Slot {
  start: number;
  end: number;
  score: number;
}

function findSlot(day: DayState, req: ActivityRequest, minutes: number, transition: number): Slot | null {
  let best: Slot | null = null;
  for (const gap of day.freeGaps(transition)) {
    if (gap.end - gap.start < minutes) continue;
    let start: number;
    let score: number;
    if (req.hardWindow) {
      const s0 = roundUp5(Math.max(gap.start, req.window.start));
      const e0 = Math.min(gap.end, req.window.end);
      if (e0 - s0 < minutes) continue;
      start = s0;
      score = (start - req.window.start) / 120;
    } else {
      const latest = gap.end - minutes;
      start = roundUp5(Math.min(Math.max(req.window.start, gap.start), latest));
      if (start > latest) start = Math.floor(latest / 5) * 5;
      if (start < gap.start) continue;
      const end = start + minutes;
      const outside = Math.max(0, req.window.start - start) + Math.max(0, end - req.window.end);
      score = outside / 30 + (start - Math.max(req.window.start, gap.start)) / 600;
    }
    if (!best || score < best.score) best = { start, end: start + minutes, score };
  }
  return best;
}

/* ------------------------------------------------------------------ */
/* Engine                                                              */
/* ------------------------------------------------------------------ */

export function generatePlan(input: PlanInput): PlanOutput {
  const transition = input.transitionMinutes;
  const restSet = new Set(input.restDates);
  const busySet = new Set(input.busyDates);
  const days = new Map<LocalDate, DayState>();
  const warnings: string[] = [];
  const items: PlanItem[] = [];

  for (const date of input.dates) {
    const awake = input.awake[date];
    if (!awake) throw new Error(`Missing waking window for ${date}`);
    const day = new DayState(date, awake, busySet.has(date), restSet.has(date));
    if (input.notBefore) {
      const diff = daysBetween(input.notBefore.date, date);
      if (diff < 0) day.occupy({ start: 0, end: 1440 });
      else if (diff === 0) day.occupy({ start: 0, end: input.notBefore.minute });
    }
    days.set(date, day);
  }

  // 1. Fixed blocks are hard constraints.
  const fixedByDate = new Map<LocalDate, FixedBlock[]>();
  for (const f of input.fixed) {
    const day = days.get(f.date);
    if (!day) continue;
    day.occupy({ start: f.start - f.travelBefore, end: f.end + f.travelAfter });
    day.fixedMinutes += f.end - f.start;
    day.load += f.load;
    if (f.kind === 'locked' && f.refId) day.keys.add(f.refId);
    const list = fixedByDate.get(f.date) ?? [];
    list.push(f);
    fixedByDate.set(f.date, list);
    items.push({
      date: f.date,
      start: f.start,
      end: f.end,
      title: f.title,
      category: f.category,
      source: f.kind === 'locked' ? 'locked' : 'fixed',
      requestKey: f.kind === 'locked' ? f.refId : undefined,
      refId: f.kind === 'locked' ? undefined : f.refId,
      shortened: false,
      reason: f.kind === 'locked' ? 'You locked this, so replanning keeps it where it is.' : 'Fixed commitment — everything else is planned around it.',
      load: f.load,
      travelBefore: f.travelBefore,
      travelAfter: f.travelAfter,
    });
    if (f.start < day.awake.start || f.end > day.awake.end) {
      warnings.push(`${f.title} on ${formatLocalDate(f.date)} falls outside your waking hours.`);
    }
  }

  // Conflicts between fixed commitments (including travel time) are surfaced, never hidden.
  const conflicts: PlanOutput['conflicts'] = [];
  for (const [date, list] of fixedByDate) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i]!;
        const b = list[j]!;
        const ia = { start: a.start - a.travelBefore, end: a.end + a.travelAfter };
        const ib = { start: b.start - b.travelBefore, end: b.end + b.travelAfter };
        if (overlaps(ia, ib)) {
          conflicts.push({ a: a.title, b: b.title, date });
          const direct = overlaps(a, b);
          warnings.push(
            direct
              ? `${a.title} and ${b.title} overlap on ${formatLocalDate(date)}. Edit one of them so the day is possible.`
              : `${a.title} and ${b.title} on ${formatLocalDate(date)} leave no travel time between them.`,
          );
        }
      }
    }
  }

  // 2. Flexible requests, most important first; deadlines break ties.
  const ordered = [...input.requests].sort(
    (a, b) =>
      a.priority - b.priority ||
      (a.latestDate ?? '9999').localeCompare(b.latestDate ?? '9999') ||
      Number(!!b.perDay) - Number(!!a.perDay) ||
      b.idealMinutes - a.idealMinutes,
  );

  const unscheduled: Unscheduled[] = [];
  const groupDates = new Map<string, LocalDate[]>();

  const eligibleDates = (req: ActivityRequest): LocalDate[] =>
    input.dates.filter((d) => {
      if (req.eligibleDates && !req.eligibleDates.includes(d)) return false;
      if (req.avoidDates?.includes(d)) return false;
      if (req.earliestDate && d < req.earliestDate) return false;
      if (req.latestDate && d > req.latestDate) return false;
      if (input.notBefore && d < input.notBefore.date) return false;
      // A fixed-window item (e.g. breakfast) whose window has already passed today isn't "unfit" — it's just over.
      if (input.notBefore && req.hardWindow && d === input.notBefore.date && req.window.end <= input.notBefore.minute) return false;
      return true;
    });

  const place = (day: DayState, req: ActivityRequest, slot: Slot, shortened: boolean, note: string) => {
    day.occupy({ start: slot.start, end: slot.end }, false);
    day.plannedMinutes += slot.end - slot.start;
    day.load += req.load ?? 0;
    day.keys.add(req.key);
    if (req.group) {
      day.groups.add(req.group);
      groupDates.set(req.group, [...(groupDates.get(req.group) ?? []), day.date]);
    }
    const reasonParts = [req.explain];
    if (shortened) reasonParts.push(`Shortened to ${formatDuration(slot.end - slot.start)} (full version ${formatDuration(req.idealMinutes)}) ${day.busy ? 'because you marked this as a busy day' : 'to fit the time you have'}.`);
    if (note) reasonParts.push(note);
    items.push({
      date: day.date,
      start: slot.start,
      end: slot.end,
      title: req.title,
      category: req.category,
      source: 'generated',
      requestKey: req.key,
      refId: req.refId,
      shortened,
      reason: reasonParts.join(' '),
      load: req.load ?? 0,
      meta: req.meta,
    });
  };

  const tryDay = (day: DayState, req: ActivityRequest): { slot: Slot; shortened: boolean } | null => {
    const preferShort = day.busy && req.minMinutes < req.idealMinutes;
    const durations = preferShort ? [req.minMinutes] : req.minMinutes < req.idealMinutes ? [req.idealMinutes, req.minMinutes] : [req.idealMinutes];
    for (const minutes of durations) {
      const slot = findSlot(day, req, minutes, transition);
      if (slot) return { slot, shortened: minutes < req.idealMinutes };
    }
    return null;
  };

  for (const req of ordered) {
    const dates = eligibleDates(req);
    const loadAdds = (req.load ?? 0) > 0;

    if (req.perDay) {
      let placed = 0;
      let missedDates: LocalDate[] = [];
      for (const date of dates) {
        const day = days.get(date)!;
        if (day.keys.has(req.key)) {
          placed++;
          continue;
        }
        const r = tryDay(day, req);
        if (r) {
          place(day, req, r.slot, r.shortened, '');
          placed++;
        } else missedDates.push(date);
      }
      if (missedDates.length) {
        missedDates = missedDates.slice(0, 3);
        unscheduled.push({
          requestKey: req.key,
          title: req.title,
          category: req.category,
          priority: req.priority,
          wanted: dates.length,
          placed,
          reason: `No open ${formatDuration(req.minMinutes)} slot in its usual window on ${missedDates.map((d) => formatLocalDate(d, { weekday: 'long' })).join(', ')}.`,
          suggestion: req.category === 'meal' ? 'Plan something portable for those days.' : 'Do a quick version when you have a moment.',
        });
      }
      continue;
    }

    let placedCount = 0;
    let sawLoadBlock = false;
    let sawSpacingBlock = false;
    let sawRestBlock = false;
    let largestGap = 0;

    for (let n = 0; n < req.count; n++) {
      const candidates: { day: DayState; score: number }[] = [];
      for (const date of dates) {
        const day = days.get(date)!;
        if (day.keys.has(req.key)) continue;
        if (loadAdds && day.rest) {
          sawRestBlock = true;
          continue;
        }
        if (loadAdds && day.load + (req.load ?? 0) > input.dailyLoadCap) {
          sawLoadBlock = true;
          continue;
        }
        if (req.group && req.minGapDays !== undefined) {
          const others = groupDates.get(req.group) ?? [];
          if (others.some((o) => Math.abs(daysBetween(o, date)) <= req.minGapDays!)) {
            sawSpacingBlock = true;
            continue;
          }
        }
        let score = day.plannedMinutes / 60 + (day.busy ? 3 : 0) + (loadAdds ? day.load * 1.5 : 0);
        // Spread sessions of the same request across the week.
        for (const other of input.dates) {
          if (days.get(other)!.keys.has(req.key) && Math.abs(daysBetween(other, date)) === 1) score += 1;
        }
        // Avoid leaving deadline work to the last possible day.
        if (req.latestDate && date === req.latestDate) score += 1.5;
        candidates.push({ day, score });
      }
      candidates.sort((a, b) => a.score - b.score || a.day.date.localeCompare(b.day.date));

      let done = false;
      for (const { day } of candidates) {
        const r = tryDay(day, req);
        if (r) {
          const nth = req.count > 1 ? `Session ${n + 1} of ${req.count} this week.` : '';
          place(day, req, r.slot, r.shortened, nth);
          placedCount++;
          done = true;
          break;
        }
        for (const g of day.freeGaps(transition)) largestGap = Math.max(largestGap, g.end - g.start);
      }
      if (!done) break;
    }

    if (placedCount < req.count) {
      let reason: string;
      let suggestion: string;
      if (dates.length === 0) {
        reason = req.latestDate ? 'Its deadline is before the remaining days in this plan.' : 'None of the days in this plan are available for it.';
        suggestion = 'Adjust the dates or mark it done if it is finished.';
      } else if (sawLoadBlock || sawRestBlock) {
        reason = 'Practices, games and rest days already use the training load your days can safely take.';
        suggestion = 'This is intentional to avoid overtraining. Lower sessions per week, or count practice as training.';
      } else if (sawSpacingBlock && largestGap >= req.minMinutes) {
        reason = 'Not enough days left with recovery time between sessions.';
        suggestion = 'Lower the number of sessions per week.';
      } else {
        reason = largestGap > 0 ? `The longest open slot left is ${formatDuration(largestGap)}, and this needs at least ${formatDuration(req.minMinutes)}.` : 'There is no free time left on the eligible days.';
        suggestion = 'Free up time, shorten the session length, or lower its priority.';
      }
      unscheduled.push({
        requestKey: req.key,
        title: req.title,
        category: req.category,
        priority: req.priority,
        wanted: req.count,
        placed: placedCount,
        reason,
        suggestion,
      });
    }
  }

  // 3. Capacity & overall warnings.
  const capacity: DayCapacity[] = input.dates.map((date) => {
    const d = days.get(date)!;
    const awakeMinutes = d.awake.end - d.awake.start;
    const free = d.freeGaps(0).reduce((s, g) => s + (g.end - g.start), 0);
    return { date, awakeMinutes, fixedMinutes: d.fixedMinutes, plannedMinutes: d.plannedMinutes, freeMinutes: free, load: d.load };
  });

  const missingImportant = unscheduled.filter((u) => u.priority <= 2 && !u.requestKey.startsWith('meal'));
  if (missingImportant.length) {
    warnings.push(`Not everything important fits this week: ${missingImportant.map((u) => u.title).join(', ')}. See "Didn't fit" for options.`);
  }
  for (const c of capacity) {
    if (c.awakeMinutes > 0 && (c.fixedMinutes + c.plannedMinutes) / c.awakeMinutes > 0.85) {
      warnings.push(`${formatLocalDate(c.date, { weekday: 'long' })} is packed — consider protecting some downtime.`);
    }
  }

  items.sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start);
  return { items, unscheduled, warnings: [...new Set(warnings)], conflicts, capacity };
}

/**
 * Validates a plan against hard constraints. Used before any generated plan is
 * saved or shown as actionable, and by tests.
 */
export function validatePlan(
  items: PlanItem[],
  input: Pick<PlanInput, 'awake' | 'transitionMinutes'>,
  subjects: PlanItem[] = items.filter((i) => i.source === 'generated'),
): string[] {
  const errors: string[] = [];
  const subjectSet = new Set(subjects);
  const byDate = new Map<LocalDate, PlanItem[]>();
  for (const it of items) {
    if (it.end <= it.start) errors.push(`${it.title} on ${it.date} has no duration.`);
    const list = byDate.get(it.date) ?? [];
    list.push(it);
    byDate.set(it.date, list);
  }
  for (const [date, list] of byDate) {
    const awake = input.awake[date];
    for (const it of list) {
      if (!subjectSet.has(it)) continue;
      if (awake && (it.start < awake.start || it.end > awake.end)) errors.push(`${it.title} on ${date} is outside waking hours.`);
      for (const other of list) {
        if (other === it) continue;
        const span = { start: other.start - (other.travelBefore ?? 0), end: other.end + (other.travelAfter ?? 0) };
        if (overlaps(it, span)) errors.push(`${it.title} overlaps ${other.title} on ${date}.`);
      }
    }
  }
  return [...new Set(errors)];
}

/** Conflicts for a proposed manual move. */
export function conflictsFor<T extends PlanItem>(candidate: Interval & { date: LocalDate }, others: T[], ignoreTitle?: string): T[] {
  return others.filter(
    (o) =>
      o.date === candidate.date &&
      o.title !== ignoreTitle &&
      overlaps(candidate, { start: o.start - (o.travelBefore ?? 0), end: o.end + (o.travelAfter ?? 0) }),
  );
}
