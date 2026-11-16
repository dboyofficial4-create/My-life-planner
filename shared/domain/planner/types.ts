import type { LocalDate } from '../time';
import type { PlanCategory, CommitmentKind } from '../../schemas';

export interface Interval {
  start: number; // minutes since local midnight
  end: number;
}

/** A block the planner must not move: a commitment occurrence or a user-locked item. */
export interface FixedBlock {
  id: string;
  date: LocalDate;
  start: number;
  end: number;
  title: string;
  category: PlanCategory;
  kind: CommitmentKind | 'locked';
  travelBefore: number;
  travelAfter: number;
  /** Training load (0–3) for practices, games, locked workouts. */
  load: number;
  refId?: string;
}

/** Something the planner should fit into free time. */
export interface ActivityRequest {
  key: string;
  title: string;
  category: PlanCategory;
  idealMinutes: number;
  /** Shortest version that is still worthwhile (used on busy days). */
  minMinutes: number;
  /** Number of sessions in the horizon. Ignored when `perDay` is set. */
  count: number;
  /** Place one per eligible day (meals, routines). */
  perDay?: boolean;
  /** 1 = highest. Lower-priority requests yield when time runs out. */
  priority: number;
  /** Preferred time window. */
  window: Interval;
  /** When true the item must sit inside `window` (e.g. breakfast). */
  hardWindow?: boolean;
  eligibleDates?: LocalDate[];
  avoidDates?: LocalDate[];
  /** Earliest / latest date (inclusive) — used for deadlines. */
  earliestDate?: LocalDate;
  latestDate?: LocalDate;
  /** Sessions in the same `group` must be at least this many days apart (1 = no back-to-back days). */
  minGapDays?: number;
  group?: string;
  /** Training load points this session adds to its day. */
  load?: number;
  /** Explanation of why this exists; shown to the user. */
  explain: string;
  refId?: string;
  meta?: Record<string, unknown>;
}

export interface PlanItem {
  date: LocalDate;
  start: number;
  end: number;
  title: string;
  category: PlanCategory;
  source: 'fixed' | 'generated' | 'locked';
  requestKey?: string;
  refId?: string;
  shortened: boolean;
  reason: string;
  load: number;
  travelBefore?: number;
  travelAfter?: number;
  meta?: Record<string, unknown>;
}

export interface Unscheduled {
  requestKey: string;
  title: string;
  category: PlanCategory;
  priority: number;
  wanted: number;
  placed: number;
  reason: string;
  suggestion: string;
}

export interface DayCapacity {
  date: LocalDate;
  awakeMinutes: number;
  fixedMinutes: number;
  plannedMinutes: number;
  freeMinutes: number;
  load: number;
}

export interface PlanInput {
  dates: LocalDate[];
  /** Waking window per date. */
  awake: Record<LocalDate, Interval>;
  fixed: FixedBlock[];
  requests: ActivityRequest[];
  /** Dates with no added training load. */
  restDates: LocalDate[];
  /** Dates the user flagged as busy: the planner prefers shorter / fewer items. */
  busyDates: LocalDate[];
  /** Max training load per day including practices and games. */
  dailyLoadCap: number;
  /** Gap kept between consecutive blocks. */
  transitionMinutes: number;
  /** Nothing is placed before this point (used when replanning mid-week). */
  notBefore?: { date: LocalDate; minute: number };
}

export interface PlanOutput {
  items: PlanItem[];
  unscheduled: Unscheduled[];
  warnings: string[];
  conflicts: { a: string; b: string; date: LocalDate }[];
  capacity: DayCapacity[];
}
