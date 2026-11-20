/**
 * Team schedules and game days.
 *
 * - parseTeamIcs: reads a team calendar (.ics export or feed from TeamSnap, GameChanger, a school's
 *   athletics site, Google Calendar…) keeping times and places, in the student's time zone.
 * - classifyEvent: game or practice, and home or away, from the event's words.
 * - gameDayRequests: what a game day adds to the plan: a pre-game meal 2.5 to 4 hours before, a small
 *   pre-game snack, a recovery snack within about an hour after, and easy recovery the next day.
 *   Timing follows common sports-nutrition guidance (e.g. ACSM / Australian Institute of Sport).
 */
import { addDays, zonedParts, type LocalDate } from '../time';
import type { ActivityRequest, FixedBlock, Interval } from '../planner/types';

export interface TeamEvent {
  uid: string;
  title: string;
  date: LocalDate;
  /** Minutes since local midnight; null for all-day events. */
  start: number | null;
  end: number | null;
  location: string;
}

function unfold(text: string): string[] {
  return text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '').split('\n');
}
const unescape = (v: string) => v.replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1').replace(/\s+/g, ' ').trim();

/** A DTSTART/DTEND value as a local date and minute in `tz`. UTC times are converted; TZID and floating times are taken as wall-clock. */
function when(value: string, tz: string): { date: LocalDate; minute: number | null } | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d, hh, mi, ss, z] = m;
  if (!hh) return { date: `${y}-${mo}-${d}`, minute: null };
  if (z) {
    const p = zonedParts(new Date(Date.UTC(+y!, +mo! - 1, +d!, +hh, +mi!, +(ss ?? 0))), tz);
    return { date: p.date, minute: p.minute };
  }
  return { date: `${y}-${mo}-${d}`, minute: +hh * 60 + +mi! };
}

export function parseTeamIcs(text: string, tz: string, maxEvents = 400): { events: TeamEvent[]; skipped: number } {
  if (!/BEGIN:VCALENDAR/.test(text)) throw new Error('That isn’t a calendar (.ics) file or link.');
  const events: TeamEvent[] = [];
  let skipped = 0;
  let cur: Record<string, string> | null = null;
  for (const line of unfold(text)) {
    if (line === 'BEGIN:VEVENT') cur = {};
    else if (line === 'END:VEVENT') {
      if (cur) {
        const s = cur.DTSTART ? when(cur.DTSTART, tz) : null;
        const e = cur.DTEND ? when(cur.DTEND, tz) : null;
        const title = cur.SUMMARY ? unescape(cur.SUMMARY) : '';
        if (title && s && !/^CANCELL?ED\b/i.test(cur.STATUS ?? '') && events.length < maxEvents) {
          let end = e && e.date === s.date ? e.minute : null;
          if (s.minute !== null && (end === null || end <= s.minute)) end = Math.min(1439, s.minute + 120);
          events.push({ uid: (cur.UID ?? '').trim() || `${s.date}:${s.minute}:${title}`, title: title.slice(0, 80), date: s.date, start: s.minute, end: s.minute === null ? null : end, location: cur.LOCATION ? unescape(cur.LOCATION).slice(0, 80) : '' });
        } else skipped++;
      }
      cur = null;
    } else if (cur) {
      const idx = line.indexOf(':');
      if (idx < 0) continue;
      cur[line.slice(0, idx).split(';')[0]!.toUpperCase()] = line.slice(idx + 1);
    }
  }
  events.sort((a, b) => (a.date === b.date ? (a.start ?? 0) - (b.start ?? 0) : a.date < b.date ? -1 : 1));
  return { events, skipped };
}

const GAME = /\b(vs\.?|v\.|versus|game|match|meet|tournament|tourney|invitational|scrimmage|playoffs?|championships?|finals?|semi-?finals?|regionals?|sectionals?|districts?|state|showcase|jamboree|classic|cup|bowl)\b|@/i;
const PRACTICE = /\b(practice|training|trainings|workout|conditioning|lift(ing)?|film|walk-?through|tryouts?|skills? session|open gym)\b/i;
const AWAY = /(^|\s)@|\bat\s+[A-Z]|\baway\b/;

export function classifyEvent(title: string): { kind: 'game' | 'practice'; away: boolean } {
  const kind = PRACTICE.test(title) && !/\b(vs\.?|game|match|meet)\b|@/i.test(title) ? 'practice' : GAME.test(title) || AWAY.test(title) ? 'game' : 'practice';
  return { kind, away: kind === 'game' && AWAY.test(title) };
}

/* ---------- game days in the plan ---------- */

const overlap = (a: Interval, b: Interval) => Math.min(a.end, b.end) - Math.max(a.start, b.start);

/**
 * Requests a game adds, and changes to that day's meals: when the pre-game meal window overlaps
 * breakfast or lunch, that meal *becomes* the pre-game meal instead of adding a second one.
 */
export function gameDayRequests(games: FixedBlock[], dates: LocalDate[], awake: Record<LocalDate, Interval>, requests: ActivityRequest[]): ActivityRequest[] {
  const out: ActivityRequest[] = [];
  const gameDates = new Set(games.map((g) => g.date));
  for (const g of games) {
    const a = awake[g.date];
    if (!a) continue;
    const leave = g.start - g.travelBefore;
    const ref = { gameRef: g.id, gameDay: true };

    // Pre-game meal: about 2.5 to 4 hours before the game (before leaving, if travelling).
    const meal: Interval = { start: Math.max(a.start, leave - 240), end: leave - 120 };
    const breakfast = requests.find((r) => r.category === 'meal' && r.eligibleDates?.[0] === g.date && r.title.startsWith('Breakfast'));
    if (meal.end - meal.start < 20 && breakfast && leave - breakfast.window.start >= 45) {
      // An early game: there's no time for a full meal 3 hours before, so breakfast is the pre-game meal, eaten early.
      breakfast.title = `Breakfast (pre-game meal)${breakfast.title.includes(':') ? `:${breakfast.title.split(':').slice(1).join(':')}` : ''}`;
      breakfast.window = { start: breakfast.window.start, end: Math.max(breakfast.window.start + breakfast.minMinutes, Math.min(breakfast.window.end, leave - 60)) };
      breakfast.explain = `Early game: eat as soon as you’re up, at least an hour before you leave. Keep it light and familiar: toast or a bagel, oatmeal, a banana, yogurt. ${breakfast.explain}`;
      breakfast.meta = { ...breakfast.meta, ...ref };
    } else if (meal.end - meal.start >= 20) {
      const existing = requests.find((r) => r.category === 'meal' && r.eligibleDates?.[0] === g.date && /^(Breakfast|Lunch)/.test(r.title) && overlap(r.window, meal) >= 20);
      if (existing) {
        existing.title = `${existing.title.split(':')[0]} (pre-game meal)${existing.title.includes(':') ? `:${existing.title.split(':').slice(1).join(':')}` : ''}`;
        existing.window = { start: Math.max(existing.window.start, meal.start), end: Math.min(existing.window.end, meal.end) };
        existing.explain = `Your pre-game meal: mostly carbs (rice, pasta, bread, potatoes) with some lean protein, and not too much fat or fiber so it digests by game time. ${existing.explain}`;
        existing.meta = { ...existing.meta, ...ref };
      } else {
        out.push({ key: `game:meal:${g.id}`, title: 'Pre-game meal', category: 'meal', idealMinutes: 30, minMinutes: 15, count: 1, perDay: true, eligibleDates: [g.date], priority: 1, window: meal, hardWindow: true, explain: 'About 3 hours before the game: mostly carbs (rice, pasta, bread, potatoes) with some lean protein, and not too much fat or fiber so it digests in time.', meta: ref });
      }
    }
    // Pre-game snack: about an hour before.
    const snack: Interval = { start: Math.max(a.start, leave - 90), end: leave - 20 };
    if (snack.end - snack.start >= 10) {
      out.push({ key: `game:snack:${g.id}`, title: 'Pre-game snack', category: 'meal', idealMinutes: 10, minMinutes: 5, count: 1, perDay: true, eligibleDates: [g.date], priority: 2, window: snack, hardWindow: true, explain: 'Something small and easy: a banana, a granola bar or toast with jam, plus water.', meta: ref });
    }
    // Recovery snack: within about an hour after the game.
    const back = g.end + g.travelAfter;
    const recover: Interval = { start: g.end, end: Math.min(a.end, back + 60) };
    if (recover.end - recover.start >= 15) {
      out.push({ key: `game:recover:${g.id}`, title: 'Recovery snack', category: 'meal', idealMinutes: 10, minMinutes: 5, count: 1, perDay: true, eligibleDates: [g.date], priority: 2, window: recover, hardWindow: true, explain: 'Protein and carbs within about an hour (chocolate milk, a sandwich, yogurt and fruit), and drink to replace what you sweated out.', meta: ref });
    }
    // Easy recovery the next day (unless that's a game day too).
    const next = addDays(g.date, 1);
    if (dates.includes(next) && !gameDates.has(next) && awake[next]) {
      out.push({ key: `game:nextday:${g.id}`, title: 'Recovery: easy movement & mobility', category: 'recovery', idealMinutes: 20, minMinutes: 10, count: 1, perDay: true, eligibleDates: [next], priority: 2, window: { start: awake[next]!.start + 60, end: awake[next]!.end - 60 }, load: 0, explain: 'The day after a game: a walk or easy bike, then stretching and mobility. It clears soreness faster than doing nothing.', meta: { gameRef: g.id, recovery: true } });
    }
  }
  return out;
}
