/**
 * Time primitives used by the planner.
 *
 * The planner works in *local wall-clock* time: a LocalDate (YYYY-MM-DD) in the
 * user's time zone plus minutes since local midnight. This keeps recurring
 * commitments stable across daylight-saving transitions ("practice is at 4pm"
 * stays at 4pm). Conversion to absolute instants happens only at the edges
 * (e.g. "what is today / now for this user") and is DST-aware.
 */

export type LocalDate = string; // YYYY-MM-DD
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday, like Date#getUTCDay

export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
/** Monday-first display order. */
export const WEEK_ORDER: Weekday[] = [1, 2, 3, 4, 5, 6, 0];

export const MINUTES_PER_DAY = 1440;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const HHMM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isLocalDate(s: string): s is LocalDate {
  if (!DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** "07:30" -> 450. Accepts "24:00" as end-of-day. */
export function hhmmToMin(hhmm: string): number {
  if (hhmm === '24:00') return MINUTES_PER_DAY;
  const m = HHMM_RE.exec(hhmm);
  if (!m) throw new Error(`Invalid time "${hhmm}" (expected HH:MM)`);
  return Number(m[1]) * 60 + Number(m[2]);
}

export function minToHhmm(min: number): string {
  const clamped = Math.max(0, Math.min(MINUTES_PER_DAY, Math.round(min)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** 450 -> "7:30 AM" */
export function formatMinutes(min: number, clock: '12h' | '24h' = '12h'): string {
  if (clock === '24h') return minToHhmm(min);
  const total = ((Math.round(min) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const h = Math.floor(total / 60);
  const m = total % 60;
  const suffix = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

export function formatDuration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

function parse(date: LocalDate): Date {
  if (!isLocalDate(date)) throw new Error(`Invalid date "${date}"`);
  return new Date(`${date}T00:00:00Z`);
}

export function addDays(date: LocalDate, n: number): LocalDate {
  const d = parse(date);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function weekdayOf(date: LocalDate): Weekday {
  return parse(date).getUTCDay() as Weekday;
}

export function daysBetween(a: LocalDate, b: LocalDate): number {
  return Math.round((parse(b).getTime() - parse(a).getTime()) / 86_400_000);
}

/** Monday of the week containing `date`. */
export function startOfWeek(date: LocalDate): LocalDate {
  const wd = weekdayOf(date);
  const offset = wd === 0 ? -6 : 1 - wd;
  return addDays(date, offset);
}

export function weekDates(weekStart: LocalDate): LocalDate[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

interface ZonedParts {
  date: LocalDate;
  minute: number;
}

const partsFormatterCache = new Map<string, Intl.DateTimeFormat>();
function partsFormatter(tz: string): Intl.DateTimeFormat {
  let f = partsFormatterCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    partsFormatterCache.set(tz, f);
  }
  return f;
}

/** Wall-clock date and minute for an instant in a time zone. */
export function zonedParts(instant: Date, tz: string): ZonedParts {
  const parts = partsFormatter(tz).formatToParts(instant);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    minute: Number(get('hour')) * 60 + Number(get('minute')),
  };
}

export function todayIn(tz: string, now: Date = new Date()): LocalDate {
  return zonedParts(now, tz).date;
}

export function nowMinuteIn(tz: string, now: Date = new Date()): number {
  return zonedParts(now, tz).minute;
}

/** Offset (minutes east of UTC) of `tz` at `instant`. */
function offsetAt(instant: Date, tz: string): number {
  const p = zonedParts(instant, tz);
  const asUtc = parse(p.date).getTime() + p.minute * 60_000;
  const truncated = Math.floor(instant.getTime() / 60_000) * 60_000;
  return Math.round((asUtc - truncated) / 60_000);
}

export interface ResolvedInstant {
  instant: Date;
  /** True when the wall-clock time does not exist (spring-forward gap) and was shifted later. */
  shifted: boolean;
}

/**
 * Convert a local wall-clock time to an absolute instant, DST-aware.
 * Times inside a spring-forward gap are moved forward by the gap length;
 * ambiguous fall-back times resolve to the first occurrence.
 */
export function zonedToInstant(date: LocalDate, minute: number, tz: string): ResolvedInstant {
  const naive = parse(date).getTime() + minute * 60_000;
  // Two passes handle offsets that differ either side of a transition.
  const o1 = offsetAt(new Date(naive), tz);
  let candidate = naive - o1 * 60_000;
  const o2 = offsetAt(new Date(candidate), tz);
  if (o2 !== o1) {
    const alt = naive - o2 * 60_000;
    const altParts = zonedParts(new Date(alt), tz);
    if (altParts.date === date && altParts.minute === minute) candidate = alt;
  }
  // Prefer the earliest valid instant for ambiguous (fall-back) times.
  const earlier = candidate - 60 * 60_000;
  const ep = zonedParts(new Date(earlier), tz);
  if (ep.date === date && ep.minute === minute) candidate = earlier;

  const check = zonedParts(new Date(candidate), tz);
  const shifted = !(check.date === date && check.minute === minute);
  return { instant: new Date(candidate), shifted };
}

/** Real length of a local day in minutes (1380 / 1440 / 1500 around DST changes). */
export function dayLengthMinutes(date: LocalDate, tz: string): number {
  const start = zonedToInstant(date, 0, tz).instant.getTime();
  const end = zonedToInstant(addDays(date, 1), 0, tz).instant.getTime();
  return Math.round((end - start) / 60_000);
}

/** Age in whole years on `onDate`. */
export function ageOn(birthday: LocalDate, onDate: LocalDate): number {
  const [by, bm, bd] = birthday.split('-').map(Number) as [number, number, number];
  const [y, m, d] = onDate.split('-').map(Number) as [number, number, number];
  let age = y - by;
  if (m < bm || (m === bm && d < bd)) age -= 1;
  return age;
}

export function formatLocalDate(date: LocalDate, opts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' }): string {
  return new Intl.DateTimeFormat('en-US', { ...opts, timeZone: 'UTC' }).format(parse(date));
}
