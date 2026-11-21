import type { AgePolicy } from '../age';
import type { EquipmentId, FitnessPrefs, Goal, SportsPrefs } from '../../schemas';
import { COOLDOWN, EXERCISES, MOBILITY_FLOW, WARMUP, type Exercise, type Pattern } from './exercises';
import { positionEmphasis, positionInfo, type Emphasis } from '../sports/positions';

export type Focus = 'strength' | 'muscle' | 'general' | 'endurance' | 'mobility' | 'athletic';

export interface PrescribedExercise {
  exerciseId: string;
  name: string;
  sets: number;
  reps: string;
  restSeconds: number;
  effort: string;
  cues: string[];
  easier: string | null;
  harder: string | null;
  substitutions: string[];
}

export interface WorkoutPlan {
  key: string; // stable id, e.g. "A"
  title: string;
  focus: Focus;
  purpose: string;
  minutes: number;
  expressMinutes: number;
  /** Number of main exercises kept in the express version. */
  expressCount: number;
  warmup: { name: string; detail: string }[];
  main: PrescribedExercise[];
  /** Free-form blocks for conditioning / mobility sessions. */
  blocks: { name: string; detail: string }[];
  cooldown: { name: string; detail: string }[];
  progression: string;
  load: number; // training load points (1 light – 3 hard)
  notes: string[];
}

export interface Program {
  sessionsPerWeek: number;
  workouts: WorkoutPlan[];
  notes: string[];
  /** Patterns we could not cover with the available equipment. */
  gaps: string[];
}

export interface ProgramInput {
  fitness: FitnessPrefs;
  sports?: SportsPrefs;
  goals: Goal[];
  policy: AgePolicy;
}

export function hasEquipmentFor(ex: Exercise, owned: ReadonlySet<EquipmentId>): boolean {
  return ex.equipment.some((set) => set.every((e) => owned.has(e)));
}

const LEVEL_FOR = { new: 1, some: 2, experienced: 3 } as const;

/** Candidate exercises for a pattern, filtered by equipment, limitations and experience. Best first. */
export function candidatesFor(pattern: Pattern, owned: ReadonlySet<EquipmentId>, fitness: FitnessPrefs): Exercise[] {
  const maxLevel = LEVEL_FOR[fitness.experience];
  const limits = new Set(fitness.limitations);
  return EXERCISES.filter((e) => e.pattern === pattern && hasEquipmentFor(e, owned) && !e.stresses.some((s) => limits.has(s)))
    .filter((e) => e.level <= maxLevel)
    .sort((a, b) => {
      // Prefer loadable equipment-based options (more progression room), then the user's level.
      const loadA = a.equipment[0]?.length ? 1 : 0;
      const loadB = b.equipment[0]?.length ? 1 : 0;
      return loadB - loadA || Math.abs(maxLevel - b.level) - Math.abs(maxLevel - a.level) || b.level - a.level;
    });
}

function primaryFocus(goals: Goal[], sports?: SportsPrefs): Focus {
  const kinds = [...goals].filter((g) => g.module === 'fitness' || g.module === 'sports').sort((a, b) => a.priority - b.priority).map((g) => g.kind);
  const first = kinds[0];
  if (first === 'sport_performance' || (!first && sports?.sports.length)) return 'athletic';
  switch (first) {
    case 'strength':
      return 'strength';
    case 'muscle':
      return 'muscle';
    case 'endurance':
      return 'endurance';
    case 'mobility':
      return 'mobility';
    default:
      return 'general';
  }
}

interface Dose {
  sets: number;
  reps: string;
  rest: number;
  effort: string;
}

function doseFor(focus: Focus, fitness: FitnessPrefs, policy: AgePolicy, inSeason: boolean): Dose {
  const newbie = fitness.experience === 'new';
  const cap = policy.maxRpe;
  const rpe = (lo: number, hi: number) => `RPE ${Math.min(lo, cap)}–${Math.min(hi, cap)} (about ${10 - Math.min(hi, cap)}–${10 - Math.min(lo, cap)} reps left in the tank)`;
  if (inSeason) return { sets: 2, reps: '5–8', rest: 90, effort: rpe(6, 7) };
  switch (focus) {
    case 'strength':
      if (newbie || policy.band !== 'adult') return { sets: 3, reps: '6–10', rest: 120, effort: rpe(6, 8) };
      return { sets: 4, reps: '4–6', rest: 150, effort: rpe(7, 8) };
    case 'muscle':
      return { sets: newbie ? 2 : 3, reps: '8–12', rest: 90, effort: rpe(7, 8) };
    case 'athletic':
      return { sets: 3, reps: '5–8', rest: 120, effort: rpe(6, 8) };
    default:
      return { sets: newbie ? 2 : 3, reps: '10–15', rest: 60, effort: rpe(6, 7) };
  }
}

const SECONDS_PER_SET = 45;

function minutesFor(main: PrescribedExercise[], extraMinutes: number): number {
  const work = main.reduce((s, e) => s + e.sets * (SECONDS_PER_SET * (e.reps.includes('side') ? 2 : 1) + e.restSeconds), 0) / 60;
  return Math.round(work + extraMinutes);
}

function prescribe(pattern: Pattern, owned: ReadonlySet<EquipmentId>, fitness: FitnessPrefs, dose: Dose, used: Set<string>): PrescribedExercise | null {
  const cands = candidatesFor(pattern, owned, fitness);
  const pick = cands.find((c) => !used.has(c.id)) ?? cands[0];
  if (!pick) return null;
  used.add(pick.id);
  const allInPattern = EXERCISES.filter((e) => e.pattern === pattern && hasEquipmentFor(e, owned) && !e.stresses.some((s) => fitness.limitations.includes(s)));
  const easier = allInPattern.filter((e) => e.level < pick.level).sort((a, b) => b.level - a.level)[0] ?? null;
  const harder = allInPattern.filter((e) => e.level > pick.level).sort((a, b) => a.level - b.level)[0] ?? null;
  const reps = pick.unit === 'seconds' ? (pattern === 'core' ? '20–40 sec' : '30–45 sec') : pick.unit === 'per side' ? `${dose.reps} per side` : dose.reps;
  return {
    exerciseId: pick.id,
    name: pick.name,
    sets: dose.sets,
    reps,
    restSeconds: pattern === 'core' ? Math.min(dose.rest, 60) : dose.rest,
    effort: dose.effort,
    cues: pick.cues,
    easier: easier?.name ?? null,
    harder: harder && harder.level <= LEVEL_FOR[fitness.experience] + 1 ? harder.name : null,
    substitutions: cands.filter((c) => c.id !== pick.id).slice(0, 3).map((c) => c.name),
  };
}

const PROGRESSION: Record<Focus, string> = {
  strength: 'Double progression: when every set reaches the top of the rep range at the target effort, add the smallest weight jump next session. If you have no heavier weight, use the harder variation or slow the lowering phase to 3 seconds.',
  muscle: 'Add a rep or two each week within the range; once you reach the top on all sets, increase load slightly and drop back to the bottom of the range.',
  general: 'Each week add one rep per set or 5 minutes of total activity — not both. Repeat a week whenever you feel run down.',
  endurance: 'Increase total weekly conditioning time by roughly 10% at most, and keep most sessions conversational.',
  mobility: 'Aim for slightly more range with the same comfort each week. Mobility should never be painful.',
  athletic: 'Keep power work crisp and low-rep. Progress strength slowly; sport practice is the priority, so this work stays supportive.',
};

export function generateProgram(input: ProgramInput): Program {
  const { fitness, sports, goals, policy } = input;
  const owned = new Set<EquipmentId>(fitness.equipment);
  const focus = primaryFocus(goals, sports);
  const inSeason = !!sports?.sports.some((s) => s.seasonPhase === 'in');
  const notes: string[] = [...policy.notes.filter((n) => /training|lift/i.test(n))];
  const gaps: string[] = [];

  let sessions = fitness.sessionsPerWeek;
  let sessionMinutes = fitness.sessionMinutes;
  if (inSeason) {
    if (sessions > 2) notes.push(`You're in season, so gym work is capped at 2 short sessions a week. Practices and games already count as training.`);
    sessions = Math.min(sessions, 2);
    sessionMinutes = Math.min(sessionMinutes, 40);
  }

  const dose = doseFor(focus, fitness, policy, inSeason);
  const hasStrengthEquipment = fitness.equipment.length > 0;
  if (!hasStrengthEquipment) notes.push('No equipment selected, so workouts use bodyweight. Add equipment in Settings and workouts update automatically.');

  const strengthDay = (key: string, patterns: Pattern[], title: string, purpose: string): WorkoutPlan => {
    const used = new Set<string>();
    const main: PrescribedExercise[] = [];
    for (const p of patterns) {
      const ex = prescribe(p, owned, fitness, dose, used);
      if (ex) main.push(ex);
      else if (!gaps.includes(p)) gaps.push(p);
    }
    // Trim to fit the session length, keeping order of importance.
    while (main.length > 3 && minutesFor(main, 13) > sessionMinutes) main.pop();
    while (minutesFor(main, 13) > sessionMinutes && main.some((m) => m.sets > 2)) {
      for (const m of main) if (m.sets > 2) m.sets--;
    }
    const minutes = Math.max(20, minutesFor(main, 13));
    const expressCount = Math.min(3, main.length);
    const expressMain = main.slice(0, expressCount).map((m) => ({ ...m, sets: 2 }));
    return {
      key,
      title,
      focus,
      purpose,
      minutes,
      expressMinutes: Math.max(15, minutesFor(expressMain, 6)),
      expressCount,
      warmup: WARMUP,
      main,
      blocks: [],
      cooldown: COOLDOWN,
      progression: PROGRESSION[focus],
      load: inSeason ? 1 : focus === 'strength' || focus === 'athletic' ? 2 : 2,
      notes: [],
    };
  };

  const conditioningDay = (key: string): WorkoutPlan => {
    const options = EXERCISES.filter((e) => e.pattern === 'conditioning' && hasEquipmentFor(e, owned) && !e.stresses.some((s) => fitness.limitations.includes(s)));
    const pick = options.find((o) => o.id !== 'brisk_walk_intervals') ?? options[0]!;
    const minutes = Math.min(sessionMinutes, 40);
    const work = Math.max(10, minutes - 12);
    return {
      key,
      title: 'Conditioning',
      focus: 'endurance',
      purpose: role ? `Conditioning for a ${role.name.toLowerCase()}: ${role.conditioning.charAt(0).toLowerCase()}${role.conditioning.slice(1)}` : 'Build your aerobic base and work capacity so you recover faster between efforts.',
      minutes,
      expressMinutes: 15,
      expressCount: 0,
      warmup: WARMUP.slice(0, 3),
      main: [],
      blocks: [
        { name: pick.name, detail: `${work} minutes. ${pick.cues.join(' ')}` },
        { name: 'Dead bug', detail: '2 × 8 per side' },
      ],
      cooldown: COOLDOWN.slice(0, 2),
      progression: PROGRESSION.endurance,
      load: 2,
      notes: [],
    };
  };

  const mobilityDay = (key: string): WorkoutPlan => ({
    key,
    title: 'Mobility & recovery',
    focus: 'mobility',
    purpose: 'Restore range of motion and help you recover. This is light and should feel good.',
    minutes: Math.min(25, sessionMinutes),
    expressMinutes: 10,
    expressCount: 0,
    warmup: [],
    main: [],
    blocks: MOBILITY_FLOW,
    cooldown: [],
    progression: PROGRESSION.mobility,
    load: 0,
    notes: [],
  });

  const workouts: WorkoutPlan[] = [];
  const first = sports?.sports[0];
  const emphasis: Emphasis = focus === 'athletic' && first ? positionEmphasis(first.sport, first.position) : 'balanced';
  const role = first ? positionInfo(first.sport, first.position) : undefined;
  const athleticA: Record<Emphasis, [Pattern[], string]> = {
    speed: [['power', 'hinge', 'lunge', 'pull', 'core'], 'Acceleration and hamstring strength for top speed: jumps first while fresh, then hinge and single-leg work.'],
    size: [['squat', 'push', 'hinge', 'pull', 'core'], 'Heavy compound lifts to build the strength and mass your position needs to win contact.'],
    jump: [['power', 'squat', 'lunge', 'pull', 'core'], 'Jump power and landing strength: explosive work first, then squats and single-leg strength.'],
    rotation: [['power', 'core', 'squat', 'pull', 'push'], 'Rotational power from the hips and core, with extra pulling to keep throwing and hitting shoulders healthy.'],
    endurance: [['lunge', 'hinge', 'pull', 'core', 'push'], 'Strength that keeps you injury-free under a high running or swimming load. Kept short.'],
    balanced: [['power', 'squat', 'pull', 'push', 'core'], 'Power and strength to support your sport, kept short so practice stays the priority.'],
  };
  const athleticB: Record<Emphasis, Pattern[]> = {
    speed: ['power', 'squat', 'pull', 'push', 'core'],
    size: ['hinge', 'lunge', 'push', 'pull', 'core'],
    jump: ['power', 'hinge', 'push', 'pull', 'core'],
    rotation: ['lunge', 'pull', 'hinge', 'core', 'push'],
    endurance: ['squat', 'pull', 'push', 'core'],
    balanced: ['lunge', 'hinge', 'push', 'pull', 'core'],
  };
  const forRole = role ? ` Built for a ${role.name.toLowerCase()}: ${role.strength.charAt(0).toLowerCase()}${role.strength.slice(1)}` : '';
  const A = strengthDay('A', focus === 'athletic' ? athleticA[emphasis][0] : ['squat', 'push', 'hinge', 'pull', 'core'], 'Full body A', focus === 'athletic' ? `${athleticA[emphasis][1]}${forRole}` : 'Build strength through the main movement patterns: squat, push, hinge, pull.');
  const B = strengthDay('B', focus === 'athletic' ? athleticB[emphasis] : ['lunge', 'hinge', 'push', 'pull', 'core'], 'Full body B', focus === 'athletic' && role ? `Single-leg strength and the other half of your ${role.name.toLowerCase()} work.` : 'Single-leg strength and posterior chain work to balance session A.');

  switch (focus) {
    case 'endurance':
      workouts.push(conditioningDay('C'), A, conditioningDay('C2'), mobilityDay('M'));
      break;
    case 'mobility':
      workouts.push(mobilityDay('M'), A, mobilityDay('M2'), B);
      break;
    default:
      workouts.push(A, B, A, conditioningDay('C'), B, mobilityDay('M'));
  }
  // Repeated templates get distinct keys (A, B, A2 …) so each session is tracked separately.
  const seen = new Map<string, number>();
  const chosen = workouts.slice(0, sessions).map((w) => {
    const base = w.key.replace(/\d+$/, '');
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return { ...w, key: n > 1 ? `${base}${n}` : base };
  });

  if (gaps.length) {
    notes.push(`With your current equipment there isn't a safe option for: ${gaps.join(', ')}. Those slots were left out rather than replaced with something unsuitable.`);
  }
  if (fitness.limitations.length) {
    notes.push(`Exercises that heavily load your ${fitness.limitations.join(', ').replace('_', ' ')} were left out. Stop any movement that causes sharp or worsening pain and check with a clinician or physical therapist.`);
  }

  return { sessionsPerWeek: chosen.length, workouts: chosen, notes, gaps };
}
