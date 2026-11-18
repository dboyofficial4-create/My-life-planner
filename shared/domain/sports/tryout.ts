import { addDays, daysBetween, type LocalDate } from '../time';

export type TeamStatus = 'on_team' | 'cut' | 'tryout_prep' | 'no_team';
export type SeasonPhase = 'off' | 'pre' | 'in' | 'post';
export type TryoutPhase = 'build' | 'sharpen' | 'peak' | 'taper' | 'tryout_week_done' | 'no_date';

export const TEAM_STATUS_LABELS: Record<TeamStatus, string> = {
  on_team: 'On a team',
  cut: 'Got cut — working to make it next time',
  tryout_prep: 'Preparing for tryouts',
  no_team: 'Not on a team right now',
};

/** True when there's no team practice doing the work, so the plan carries more skill volume. */
export const isDevelopmentMode = (s: TeamStatus) => s !== 'on_team';

export function tryoutPhase(today: LocalDate, tryoutDate: LocalDate | null): { phase: TryoutPhase; daysLeft: number | null } {
  if (!tryoutDate) return { phase: 'no_date', daysLeft: null };
  const daysLeft = daysBetween(today, tryoutDate);
  if (daysLeft < 0) return { phase: 'tryout_week_done', daysLeft };
  if (daysLeft <= 7) return { phase: 'taper', daysLeft };
  if (daysLeft <= 21) return { phase: 'peak', daysLeft };
  if (daysLeft <= 42) return { phase: 'sharpen', daysLeft };
  return { phase: 'build', daysLeft };
}

export const PHASE_INFO: Record<TryoutPhase, { label: string; focus: string }> = {
  build: { label: 'Build', focus: 'Lots of quality reps on your weakest skills, plus strength and conditioning. This is where most improvement happens.' },
  sharpen: { label: 'Sharpen', focus: 'Practise skills at game speed and under fatigue. Add game-like drills and play as much real competition as you can.' },
  peak: { label: 'Peak', focus: 'Keep intensity high but cut total volume a little. Re-test your skills and rehearse what tryouts will ask for.' },
  taper: { label: 'Taper', focus: 'Short, sharp sessions only. Sleep, eat well and arrive fresh — you can’t cram fitness in the last week.' },
  tryout_week_done: { label: 'After tryouts', focus: 'Update your status. Whatever happened, ask the coach what to work on next.' },
  no_date: { label: 'Development', focus: 'Steady skill work and strength. Add a tryout date when you know it to get a countdown plan.' },
};

export interface SkillDose {
  sessions: number;
  minutes: number;
  minMinutes: number;
  /** Plan a "skills check" re-test this week. */
  skillsCheck: boolean;
  /** Dates (within the plan) to keep free of hard training. */
  restBefore: LocalDate[];
}

/**
 * Weekly solo skill-practice dose. On a team, practice already provides most
 * skill volume. Without a team (cut, tryout prep), the plan provides it.
 */
export function skillDose(o: { status: TeamStatus; season: SeasonPhase; today: LocalDate; tryoutDate: LocalDate | null; weekStart: LocalDate }): SkillDose {
  if (!isDevelopmentMode(o.status)) {
    return { sessions: o.season === 'in' ? 1 : 2, minutes: 30, minMinutes: 20, skillsCheck: false, restBefore: [] };
  }
  const { phase } = tryoutPhase(o.weekStart > o.today ? o.weekStart : o.today, o.tryoutDate);
  const restBefore = o.tryoutDate ? [addDays(o.tryoutDate, -1), o.tryoutDate] : [];
  const weekIndex = Math.floor(new Date(`${o.weekStart}T00:00:00Z`).getTime() / 604_800_000);
  switch (phase) {
    case 'taper':
      return { sessions: 3, minutes: 25, minMinutes: 15, skillsCheck: false, restBefore };
    case 'peak':
      return { sessions: 4, minutes: 40, minMinutes: 25, skillsCheck: true, restBefore };
    case 'sharpen':
      return { sessions: 4, minutes: 45, minMinutes: 25, skillsCheck: weekIndex % 2 === 0, restBefore };
    default:
      return { sessions: 4, minutes: 45, minMinutes: 25, skillsCheck: weekIndex % 3 === 0, restBefore };
  }
}

/** Rotate focus skills across sessions and weeks so each gets regular work. */
export function focusFor(skills: string[], weekStart: LocalDate, session: number): string | null {
  if (!skills.length) return null;
  const weekIndex = Math.floor(new Date(`${weekStart}T00:00:00Z`).getTime() / 604_800_000);
  return skills[(weekIndex + session) % skills.length]!;
}

/** Practical steps after being cut. Written as guidance, not promises. */
export const CUT_STEPS: { title: string; detail: string }[] = [
  { title: 'Ask the coach for specifics', detail: 'Politely ask: “What are the two or three things I need to improve to make the team next time?” Write the answers into your coach feedback in Settings so your plan focuses on them.' },
  { title: 'Test yourself now', detail: 'Record your baseline on the skill tests below. Re-testing every few weeks shows real progress, not guesses.' },
  { title: 'Find game reps', detail: 'Solo drills build skills; games teach you when to use them. Look for rec leagues, club teams, open gyms or pickup games.' },
  { title: 'Get stronger and fitter', detail: 'Strength and conditioning help in almost every sport. Your workouts in Fitness are planned alongside skill work so you don’t overload.' },
  { title: 'Film yourself', detail: 'A phone video from the side shows technique problems you can’t feel. Compare clips a few weeks apart.' },
  { title: 'Show up ready', detail: 'In the last week, rest more, sleep 8–10 hours and keep sessions short. Coaches notice effort, attitude and coachability as well as skill.' },
];
