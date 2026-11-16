import type { ItemStatus } from '../../schemas';
import { generatePlan, validatePlan } from './engine';
import type { FixedBlock, PlanInput, PlanItem, PlanOutput } from './types';
import type { LocalDate } from '../time';

export interface StoredItem extends PlanItem {
  id: string;
  status: ItemStatus;
  locked: boolean;
}

export interface Moment {
  date: LocalDate;
  minute: number;
}

export type ChangeType = 'added' | 'removed' | 'moved' | 'shortened' | 'unchanged';

export interface PlanChange {
  type: ChangeType;
  title: string;
  category: PlanItem['category'];
  source: PlanItem['source'];
  from?: { date: LocalDate; start: number; end: number; id: string };
  to?: { date: LocalDate; start: number; end: number };
}

export interface ReplanResult {
  /** Settled items that are kept verbatim (past, completed, skipped, locked, in progress). */
  kept: StoredItem[];
  /** New future items to insert. */
  proposed: PlanItem[];
  changes: PlanChange[];
  unscheduled: PlanOutput['unscheduled'];
  warnings: string[];
  conflicts: PlanOutput['conflicts'];
  capacity: PlanOutput['capacity'];
  carryOver: { title: string; carried: number; dropped: number }[];
  validationErrors: string[];
}

const before = (d: LocalDate, m: number, now: Moment) => d < now.date || (d === now.date && m < now.minute);

/**
 * Replan the remaining part of a plan.
 *
 * Guarantees:
 *  - Past items, completed/skipped items and locked items are never changed.
 *  - Missed sessions are carried over only for high-priority requests and only
 *    up to `carryOverLimit` per week, so a bad day doesn't create a backlog.
 *  - The result is validated against hard constraints before it is returned.
 */
export function replan(current: StoredItem[], input: PlanInput, now: Moment, carryOverLimit = 2): ReplanResult {
  const settled = (it: StoredItem) => it.locked || it.status !== 'planned' || before(it.date, it.start, now);
  const kept = current.filter(settled);
  const replaceable = current.filter((it) => !settled(it));

  // Kept items that still occupy future time become hard blocks.
  const blocking: FixedBlock[] = kept
    .filter((it) => it.status !== 'skipped' && !before(it.date, it.end, now))
    .map((it) => ({
      id: `keep:${it.id}`,
      date: it.date,
      start: it.start,
      end: it.end,
      title: it.title,
      category: it.category,
      kind: 'locked',
      travelBefore: it.travelBefore ?? 0,
      travelAfter: it.travelAfter ?? 0,
      load: it.status === 'done' || it.locked ? it.load : 0,
      refId: it.requestKey,
    }));
  // Commitment occurrences already represented by kept items must not be duplicated.
  const keptFixedKeys = new Set(kept.filter((k) => k.source === 'fixed').map((k) => `${k.refId}:${k.date}:${k.start}`));

  const carryOver: ReplanResult['carryOver'] = [];
  let carryBudget = carryOverLimit;
  const keptKeys = new Set(kept.map((k) => k.requestKey).filter(Boolean));
  const requests = input.requests
    .map((r) => {
      if (r.perDay) return keptKeys.has(r.key) ? null : r;
      const mine = kept.filter((k) => k.requestKey === r.key);
      if (!mine.length) return r;
      const finished = mine.filter((k) => k.status === 'done' || k.status === 'skipped' || k.locked || (k.status === 'planned' && !before(k.date, k.end, now))).length;
      const missed = mine.filter((k) => !k.locked && (k.status === 'missed' || (k.status === 'planned' && before(k.date, k.end, now)))).length;
      let carried = 0;
      if (missed && r.priority <= 2) {
        carried = Math.min(missed, carryBudget);
        carryBudget -= carried;
      }
      if (missed) carryOver.push({ title: r.title, carried, dropped: missed - carried });
      const remaining = r.count - finished - (missed - carried);
      return remaining > 0 ? { ...r, count: remaining } : null;
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  const fresh: PlanInput = {
    ...input,
    fixed: [...input.fixed.filter((f) => !keptFixedKeys.has(`${f.refId}:${f.date}:${f.start}`)), ...blocking],
    requests,
    notBefore: now,
  };
  const out = generatePlan(fresh);
  // Commitment occurrences are always included (even earlier today) so the day reads correctly.
  const proposed = out.items.filter((it) => it.source !== 'locked' && (it.source === 'fixed' || !before(it.date, it.start, now)));

  const validationErrors = validatePlan([...proposed, ...kept.filter((k) => k.status !== 'skipped')], input, proposed.filter((p) => p.source === 'generated'));

  return {
    kept,
    proposed,
    changes: diff(replaceable, proposed),
    unscheduled: out.unscheduled,
    warnings: out.warnings,
    conflicts: out.conflicts,
    capacity: out.capacity,
    carryOver,
    validationErrors,
  };
}

function identity(it: PlanItem): string {
  return it.source === 'fixed' ? `fixed:${it.refId}:${it.date}` : `gen:${it.requestKey ?? it.title}`;
}

export function diff(oldItems: StoredItem[], newItems: PlanItem[]): PlanChange[] {
  const changes: PlanChange[] = [];
  const groupsOld = new Map<string, StoredItem[]>();
  const groupsNew = new Map<string, PlanItem[]>();
  for (const it of oldItems) groupsOld.set(identity(it), [...(groupsOld.get(identity(it)) ?? []), it]);
  for (const it of newItems) groupsNew.set(identity(it), [...(groupsNew.get(identity(it)) ?? []), it]);
  const keys = new Set([...groupsOld.keys(), ...groupsNew.keys()]);
  for (const key of keys) {
    const olds = [...(groupsOld.get(key) ?? [])].sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start);
    const news = [...(groupsNew.get(key) ?? [])].sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start);
    // Exact matches first.
    for (let i = olds.length - 1; i >= 0; i--) {
      const o = olds[i]!;
      const j = news.findIndex((n) => n.date === o.date && n.start === o.start && n.end === o.end);
      if (j >= 0) {
        changes.push({ type: 'unchanged', title: news[j]!.title, category: o.category, source: o.source, from: { date: o.date, start: o.start, end: o.end, id: o.id }, to: { date: o.date, start: o.start, end: o.end } });
        olds.splice(i, 1);
        news.splice(j, 1);
      }
    }
    const pairs = Math.min(olds.length, news.length);
    for (let i = 0; i < pairs; i++) {
      const o = olds[i]!;
      const n = news[i]!;
      const sameSpot = o.date === n.date && o.start === n.start;
      changes.push({
        type: sameSpot && n.end < o.end ? 'shortened' : 'moved',
        title: n.title,
        category: n.category,
        source: n.source,
        from: { date: o.date, start: o.start, end: o.end, id: o.id },
        to: { date: n.date, start: n.start, end: n.end },
      });
    }
    for (const o of olds.slice(pairs)) changes.push({ type: 'removed', title: o.title, category: o.category, source: o.source, from: { date: o.date, start: o.start, end: o.end, id: o.id } });
    for (const n of news.slice(pairs)) changes.push({ type: 'added', title: n.title, category: n.category, source: n.source, to: { date: n.date, start: n.start, end: n.end } });
  }
  const order: Record<ChangeType, number> = { removed: 0, moved: 1, shortened: 2, added: 3, unchanged: 4 };
  return changes.sort((a, b) => order[a.type] - order[b.type] || (a.to?.date ?? a.from!.date).localeCompare(b.to?.date ?? b.from!.date));
}

/** A change set is "significant" if it alters anything beyond meal/care timing. */
export function isSignificant(changes: PlanChange[]): boolean {
  return changes.some((c) => c.type !== 'unchanged' && !['meal', 'care'].includes(c.category));
}
