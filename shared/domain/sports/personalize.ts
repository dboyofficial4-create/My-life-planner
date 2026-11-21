/**
 * Personalised sport sessions.
 *
 * Instead of one generic list per sport, each athlete gets skills ranked by what THEY need:
 *  - their position(s) (a receiver needs route running, a center needs post moves),
 *  - the skills they picked,
 *  - what their coach said and their own goal (matched by keywords),
 *  - their own test results (a score that dropped or stalled moves up; one that's improving moves down).
 * Then each session picks drills at the right difficulty for them, rotating week to week so it
 * doesn't get stale, and says why it was chosen.
 */
import type { SportsPrefs } from '../../schemas';
import type { Drill, SportInfo } from './catalog';
import { positionInfo } from './positions';
import { isDevelopmentMode } from './tryout';

type SportPrefs = SportsPrefs['sports'][number];
export type TestRow = { test_id: string; date: string; value: number };
export type Trend = 'down' | 'flat' | 'up' | 'none';

export interface SkillPriority {
  skill: string;
  label: string;
  score: number;
  reasons: string[];
  trend: Trend;
  /** Drill difficulty that fits them for this skill (1 basic – 3 advanced). */
  level: 1 | 2 | 3;
}

const BASE_LEVEL: Record<SportPrefs['level'], 1 | 2 | 3> = { recreational: 1, school_team: 2, club: 2, competitive: 3 };

const words = (s: string) => s.toLowerCase();

/** Words in coach feedback or goals that point at common skills (lowercase stems). */
const KEYWORDS: Record<string, string[]> = {
  shooting: ['shot', 'shoot', 'jumper', 'free throw', 'three', '3s', 'range'],
  ball_handling: ['dribbl', 'handle', 'handles', 'turnover', 'weak hand', 'left hand'],
  finishing: ['layup', 'finish', 'rim', 'contact', 'and-one'],
  passing: ['pass', 'vision', 'assist', 'distribution', 'serve receive', 'platform'],
  defense: ['defen', 'slide', 'closeout', 'stay in front', 'on-ball'],
  catching: ['catch', 'drop', 'hands', 'contested', 'jump ball'],
  footwork: ['footwork', 'agility', 'quick', 'first step', 'change of direction', 'feet'],
  tackling: ['tackl', 'missed tackle', 'wrap up'],
  throwing: ['throw', 'accuracy', 'arm', 'release', 'spiral'],
  stance_start: ['stance', 'get off', 'get-off', 'first step', 'false start', 'explosive'],
  first_touch: ['touch', 'control', 'receiv', 'trap'],
  dribbling: ['dribbl', '1v1', 'one on one', 'take on', 'beat players'],
  defending: ['defend', 'tackle', 'jockey', 'marking', '1v1'],
  hitting: ['hit', 'swing', 'bat', 'strike', 'contact', 'barrel'],
  fielding: ['field', 'ground ball', 'grounder', 'error', 'glove', 'fly ball'],
  pitching: ['pitch', 'command', 'walk', 'velocity', 'strike zone'],
  serving: ['serve', 'serving', 'ace'],
  setting: ['set', 'setting', 'hands'],
  attacking: ['attack', 'hit', 'kill', 'spike', 'approach', 'arm swing'],
  blocking: ['block'],
  starts: ['start', 'blocks', 'reaction', 'acceleration', 'drive phase'],
  mechanics: ['form', 'mechanic', 'stride', 'posture', 'arm action'],
  speed_endurance: ['finish', 'fade', 'last 100', 'speed endurance', 'tired at the end'],
  aerobic: ['endurance', 'mileage', 'aerobic', 'stamina', 'base'],
  freestyle: ['freestyle', 'catch', 'pull', 'stroke'],
  kick: ['kick', 'legs', 'underwater'],
  starts_turns: ['start', 'turn', 'flip', 'dive', 'streamline', 'wall'],
  endurance: ['endurance', 'stamina', 'distance', 'tired'],
  forehand: ['forehand'],
  backhand: ['backhand'],
  serve: ['serve', 'double fault', 'toss'],
};

function keywordsFor(skill: SportInfo['skills'][number]): string[] {
  const own = [...(skill.keywords ?? []), ...(KEYWORDS[skill.id] ?? [])];
  const fromLabel = skill.label
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((w) => w.length > 3 && !['your', 'skill', 'technique', 'work'].includes(w))
    .map((w) => w.replace(/(ing|s)$/, ''));
  return [...own, ...fromLabel];
}

/** How a skill's own test results are going: from the athlete's last results, compared with themselves only. */
export function skillTrend(info: SportInfo, skill: string, tests: TestRow[]): { trend: Trend; streak: number; testName: string | null } {
  const defs = info.tests.filter((t) => t.skill === skill);
  let best: { trend: Trend; streak: number; testName: string | null } = { trend: 'none', streak: 0, testName: defs[0]?.name ?? null };
  for (const def of defs) {
    const vals = tests.filter((r) => r.test_id === def.id).sort((a, b) => a.date.localeCompare(b.date)).map((r) => r.value);
    if (vals.length < 2) continue;
    const better = (a: number, b: number) => (def.better === 'higher' ? b > a : b < a);
    const last = vals[vals.length - 1]!;
    const prev = vals[vals.length - 2]!;
    let trend: Trend = better(prev, last) ? 'up' : better(last, prev) ? 'down' : 'flat';
    // Not better than three results ago counts as stalled.
    if (trend === 'up' && vals.length >= 4 && !better(vals[vals.length - 4]!, last)) trend = 'flat';
    let streak = 0;
    for (let i = vals.length - 1; i > 0 && better(vals[i - 1]!, vals[i]!); i--) streak++;
    // A drop matters most; report the worst-going test for the skill.
    const rank = { down: 3, flat: 2, up: 1, none: 0 } as const;
    if (rank[trend] > rank[best.trend]) best = { trend, streak, testName: def.name };
  }
  return best;
}

/** Skills ranked by what this athlete needs most. */
export function sportPriorities(prefs: SportPrefs, info: SportInfo, tests: TestRow[]): SkillPriority[] {
  const positions = [prefs.position, prefs.secondaryPosition].map((p) => positionInfo(prefs.sport, p)).filter((p) => !!p);
  const feedback = words(prefs.coachFeedback ?? '');
  const goal = words(prefs.goal ?? '');
  const base = BASE_LEVEL[prefs.level];
  const out: SkillPriority[] = info.skills.map((skill) => {
    let score = 0;
    const reasons: string[] = [];
    // Position: first skill matters most.
    let posBonus = 0;
    let posName = '';
    for (const p of positions) {
      const i = p.skills.indexOf(skill.id);
      const bonus = i === 0 ? 3 : i === 1 ? 2 : i >= 2 ? 1 : 0;
      if (bonus > posBonus) {
        posBonus = bonus;
        posName = p.name;
      }
    }
    if (posBonus) {
      score += posBonus;
      reasons.push(`key for a ${posName.toLowerCase()}`);
    }
    if (prefs.skills.includes(skill.id)) {
      score += 4;
      reasons.push('you chose it');
    }
    const kws = keywordsFor(skill);
    if (feedback && kws.some((k) => feedback.includes(k))) {
      score += 4;
      reasons.push('your coach’s feedback');
    }
    if (goal && kws.some((k) => goal.includes(k))) {
      score += 2;
      reasons.push('your goal');
    }
    const t = skillTrend(info, skill.id, tests);
    const hasTest = info.tests.some((x) => x.skill === skill.id);
    if (t.trend === 'down') {
      score += 3;
      reasons.push(`your ${t.testName ?? 'test'} result dropped`);
    } else if (t.trend === 'flat') {
      score += 2;
      reasons.push(`your ${t.testName ?? 'test'} result has stalled`);
    } else if (t.trend === 'up') {
      score -= 1;
      reasons.push(`improving on ${t.testName ?? 'your test'}`);
    } else if (hasTest && score > 0) {
      // A small nudge to test it, never enough to outrank what the position needs.
      score += 0.5;
      reasons.push('not tested yet');
    }
    let level = base;
    if (t.trend === 'up' && t.streak >= 2) level = Math.min(3, base + 1) as 1 | 2 | 3;
    if (t.trend === 'down') level = Math.max(1, base - 1) as 1 | 2 | 3;
    return { skill: skill.id, label: skill.label, score, reasons, trend: t.trend, level };
  });
  return out.sort((a, b) => b.score - a.score || info.skills.findIndex((s) => s.id === a.skill) - info.skills.findIndex((s) => s.id === b.skill));
}

export interface SessionDrill {
  id: string;
  name: string;
  minutes: number;
  howTo: string;
  measure: string;
  level: 1 | 2 | 3;
  solo: boolean;
}

export interface SessionPlan {
  skill: string;
  label: string;
  drills: SessionDrill[];
  /** Why this session, in one sentence. */
  why: string;
  /** Lines for the plan item's "Suggested steps". */
  steps: string[];
}

/** Week number used to rotate drills (stable for a given week start). */
function weekIndex(weekStart: string): number {
  return Math.floor(Date.parse(`${weekStart}T00:00:00Z`) / (7 * 86_400_000));
}

/** Order of skills across the week's sessions: the top need gets the most sessions. */
export function sessionSkills(priorities: SkillPriority[], sessions: number): SkillPriority[] {
  const top = priorities.filter((p) => p.score > 0).slice(0, 3);
  const pool = top.length ? top : priorities.slice(0, 2);
  const pattern = [0, 1, 0, 2, 1, 0, 2];
  const out: SkillPriority[] = [];
  for (let i = 0; i < sessions; i++) out.push(pool[pattern[i % pattern.length]! % pool.length]!);
  return out;
}

function pickDrills(all: Drill[], skill: string, level: 1 | 2 | 3, minutes: number, rotate: number, prefer: 'solo' | 'any'): Drill[] {
  const fit = all.filter((d) => d.skill === skill && d.level <= level);
  const pool = (fit.length ? fit : all.filter((d) => d.skill === skill)).slice().sort((a, b) => {
    const solo = prefer === 'solo' ? Number(b.solo) - Number(a.solo) : 0;
    return Math.abs(level - a.level) - Math.abs(level - b.level) || solo || a.minutes - b.minutes;
  });
  if (!pool.length) return [];
  const start = rotate % pool.length;
  const ordered = [...pool.slice(start), ...pool.slice(0, start)];
  const picked: Drill[] = [];
  let used = 0;
  for (const d of ordered) {
    if (picked.length && used + d.minutes > minutes) continue;
    picked.push(d);
    used += d.minutes;
    if (used >= minutes - 4) break;
  }
  return picked;
}

const WARMUP_MIN = 6;

/** Concrete sessions for one sport this week. */
export function planSportSessions(prefs: SportPrefs, info: SportInfo, tests: TestRow[], opts: { weekStart: string; sessions: number; minutes: number }): SessionPlan[] {
  const priorities = sportPriorities(prefs, info, tests);
  const order = sessionSkills(priorities, opts.sessions);
  const week = weekIndex(opts.weekStart);
  const dev = isDevelopmentMode(prefs.teamStatus);
  const position = positionInfo(prefs.sport, prefs.position);
  const seen = new Map<string, number>();
  return order.map((p, n) => {
    const nth = seen.get(p.skill) ?? 0;
    seen.set(p.skill, nth + 1);
    const work = Math.max(8, opts.minutes - WARMUP_MIN);
    // The main skill gets most of the time; a second need gets a short finisher when there's room.
    const second = priorities.find((x) => x.skill !== p.skill && x.score > 0);
    const finisherRoom = second && work >= 24 ? 8 : 0;
    const main = pickDrills(info.drills, p.skill, p.level, work - finisherRoom, week + nth, dev ? 'any' : 'solo');
    const finisher = finisherRoom && second ? pickDrills(info.drills, second.skill, second.level, finisherRoom, week + n, 'solo').slice(0, 1) : [];
    const drills = [...main, ...finisher].map((d) => ({ id: d.id, name: d.name, minutes: d.minutes, howTo: d.howTo, measure: d.measure, level: d.level, solo: d.solo }));
    const why = p.reasons.length ? `Focus on ${p.label.toLowerCase()}: ${p.reasons.slice(0, 2).join(' and ')}.` : `Focus on ${p.label.toLowerCase()}.`;
    const steps = [
      `Warm-up (${WARMUP_MIN} min): easy movement, then a few game-speed reps${position ? ` of ${position.name.toLowerCase()} footwork` : ''}.`,
      ...drills.map((d) => `${d.name} (${d.minutes} min${d.solo ? '' : ', with a partner'}): ${d.howTo} Track: ${d.measure}.`),
    ];
    return { skill: p.skill, label: p.label, drills, why, steps };
  });
}
