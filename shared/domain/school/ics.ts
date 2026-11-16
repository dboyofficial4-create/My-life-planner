import { zonedParts, type LocalDate } from '../time';

/**
 * Minimal iCalendar (RFC 5545) reader for importing assignment due dates from
 * a calendar export file — e.g. the calendar feed many LMSs (including Canvas)
 * offer. This only reads a file the user chooses; it never logs in anywhere.
 */
export interface IcsEvent {
  uid: string;
  summary: string;
  description: string;
  date: LocalDate;
  /** Course name if the summary ends with "[Course]" (a common LMS convention). */
  course: string | null;
}

function unfold(text: string): string[] {
  return text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '').split('\n');
}

function unescape(v: string): string {
  return v.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1').trim();
}

function parseDate(prop: string, value: string, tz: string): LocalDate | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d, hh, mi, ss, z] = m;
  if (!hh) return `${y}-${mo}-${d}`;
  if (z) {
    const instant = new Date(Date.UTC(+y!, +mo! - 1, +d!, +hh, +mi!, +ss!));
    return zonedParts(instant, tz).date;
  }
  // Floating or TZID-local time (`prop` carries TZID): the wall-clock date is what matters for a due date.
  void prop;
  return `${y}-${mo}-${d}`;
}

export interface IcsParseResult {
  events: IcsEvent[];
  skipped: number;
}

export function parseIcs(text: string, tz: string, maxEvents = 500): IcsParseResult {
  if (!/BEGIN:VCALENDAR/.test(text)) throw new Error('This file is not an iCalendar (.ics) file.');
  const events: IcsEvent[] = [];
  let skipped = 0;
  let cur: Record<string, { prop: string; value: string }> | null = null;
  for (const line of unfold(text)) {
    if (line === 'BEGIN:VEVENT') cur = {};
    else if (line === 'END:VEVENT') {
      if (cur) {
        const summary = cur.SUMMARY ? unescape(cur.SUMMARY.value) : '';
        const start = cur.DTSTART ? parseDate(cur.DTSTART.prop, cur.DTSTART.value, tz) : null;
        if (summary && start && events.length < maxEvents) {
          const courseMatch = /\s*\[([^\]]+)\]\s*$/.exec(summary);
          events.push({
            uid: cur.UID?.value.trim() || `${start}:${summary}`,
            summary: courseMatch ? summary.slice(0, courseMatch.index).trim() : summary,
            description: cur.DESCRIPTION ? unescape(cur.DESCRIPTION.value).slice(0, 500) : '',
            date: start,
            course: courseMatch?.[1]?.trim() ?? null,
          });
        } else skipped++;
      }
      cur = null;
    } else if (cur) {
      const idx = line.indexOf(':');
      if (idx < 0) continue;
      const prop = line.slice(0, idx);
      const name = prop.split(';')[0]!.toUpperCase();
      cur[name] = { prop, value: line.slice(idx + 1) };
    }
  }
  return { events, skipped };
}

export function guessAssignmentType(title: string): 'homework' | 'project' | 'essay' | 'quiz' | 'test' | 'exam' | 'reading' | 'other' {
  const t = title.toLowerCase();
  if (/\bexam|final|midterm/.test(t)) return 'exam';
  if (/\btest\b/.test(t)) return 'test';
  if (/\bquiz/.test(t)) return 'quiz';
  if (/essay|paper|report/.test(t)) return 'essay';
  if (/project|presentation|lab report/.test(t)) return 'project';
  if (/read|chapter/.test(t)) return 'reading';
  if (/homework|hw|worksheet|problem set|assignment/.test(t)) return 'homework';
  return 'other';
}
