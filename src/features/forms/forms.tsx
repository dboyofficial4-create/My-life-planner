import { ArrowDown, ArrowUp, BookOpen, Dumbbell, HelpCircle, Lock, Shirt, Sparkles, Trophy, Utensils, Wind, X } from 'lucide-react';
import type { ZodType } from 'zod';
import {
  ALLERGENS, AVAILABLE_MODULES, COMMITMENT_KINDS, EQUIPMENT, EQUIPMENT_LABELS, GOAL_KINDS, GOAL_LABELS, LIMITATIONS, SPORTS,
  type CommitmentInput, type FitnessPrefs, type Goal, type HairPrefs, type ModuleId, type NutritionPrefs, type Profile,
  type Schedule, type SchoolPrefs, type SkinPrefs, type SportsPrefs,
} from '@shared/schemas';
import { WEEK_ORDER, WEEKDAY_SHORT } from '@shared/domain/time';
import { SPORT_LABELS } from '@shared/domain/fitness/sports';
import { SPORTS_CATALOG } from '@shared/domain/sports/catalog';
import { cmToFeetInches, feetInchesToCm, kgToLb, lbToKg } from '@shared/domain/nutrition/units';
import type { AgePolicy } from '@shared/domain/age';
import { Button, Chips, Field, Input, NumberInput, OptionCards, Select, Switch, Textarea, type ChoiceOption } from '@/ui/primitives';
import type { ReactNode } from 'react';

export type Errors = Record<string, string>;

/** Validate with a shared zod schema and map issues to field paths. */
export function validate<T>(schema: ZodType<T>, value: unknown, prefix = ''): Errors {
  const r = schema.safeParse(value);
  if (r.success) return {};
  const out: Errors = {};
  for (const i of r.error.issues) {
    const k = [prefix, ...i.path.map(String)].filter(Boolean).join('.') || '_';
    out[k] ??= i.message;
  }
  return out;
}

export function Why({ children }: { children: ReactNode }) {
  return (
    <p className="why">
      <HelpCircle aria-hidden />
      <span>{children}</span>
    </p>
  );
}

const set = <T,>(v: T, onChange: (v: T) => void) => <K extends keyof T>(k: K, x: T[K]) => onChange({ ...v, [k]: x });

/* ---------- Shared pickers ---------- */

export function DaysPicker({ label, value, onChange, error }: { label: string; value: number[]; onChange: (v: number[]) => void; error?: string }) {
  return (
    <Chips<number>
      label={label}
      multiple
      error={error}
      value={value}
      onChange={(v) => onChange([...(v as number[])].sort())}
      options={WEEK_ORDER.map((d) => ({ value: d, label: WEEKDAY_SHORT[d] }))}
    />
  );
}

export function TimeField({ label, value, onChange, error, hint }: { label: string; value: string; onChange: (v: string) => void; error?: string; hint?: string }) {
  return (
    <Field label={label} error={error} hint={hint}>
      {(p) => <Input {...p} type="time" step={300} value={value} onChange={(e) => onChange(e.target.value)} />}
    </Field>
  );
}

/* ---------- Modules ---------- */

export const MODULE_INFO: Record<ModuleId, { label: string; description: string; icon: typeof Dumbbell }> = {
  fitness: { label: 'Fitness', description: 'Workouts that fit your equipment and schedule', icon: Dumbbell },
  sports: { label: 'Sports', description: 'Skill work planned around practices and games', icon: Trophy },
  school: { label: 'School', description: 'Assignments, study sessions and grades', icon: BookOpen },
  nutrition: { label: 'Food', description: 'Meal plans, recipes and a grocery list', icon: Utensils },
  skincare: { label: 'Skincare', description: 'A simple routine that’s easy to keep', icon: Sparkles },
  haircare: { label: 'Hair & grooming', description: 'Wash-day and daily routines', icon: Wind },
  style: { label: 'Style', description: 'Wardrobe and outfits — coming in a later release', icon: Shirt },
};

export function ModulesPicker({ value, onChange }: { value: ModuleId[]; onChange: (v: ModuleId[]) => void }) {
  return (
    <OptionCards<ModuleId>
      label="Areas to plan"
      multiple
      value={value}
      onChange={(v) => onChange(v as ModuleId[])}
      options={(Object.keys(MODULE_INFO) as ModuleId[]).map((m) => ({
        value: m,
        label: MODULE_INFO[m].label,
        description: MODULE_INFO[m].description,
        icon: AVAILABLE_MODULES.includes(m) ? MODULE_INFO[m].icon : Lock,
        disabled: !AVAILABLE_MODULES.includes(m),
      }))}
    />
  );
}

/* ---------- Profile ---------- */

const TIMEZONES: string[] = (() => {
  try {
    return (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone') ?? [];
  } catch {
    return [];
  }
})();

export function ProfileForm({ value, onChange, errors, policy }: { value: Profile; onChange: (v: Profile) => void; errors: Errors; policy: AgePolicy }) {
  const s = set(value, onChange);
  const imperial = value.units === 'imperial';
  const fi = value.heightCm ? cmToFeetInches(value.heightCm) : null;
  return (
    <div className="stack-lg">
      <div className="grid-2">
        <Field label="Birthday" error={errors.birthday} hint="Keeps plans age-appropriate.">
          {(p) => <Input {...p} type="date" value={value.birthday ?? ''} onChange={(e) => s('birthday', e.target.value || null)} />}
        </Field>
        <Field label="Time zone" error={errors.timezone} hint="Your plan follows this, including daylight-saving changes.">
          {(p) => (
            <Select {...p} value={value.timezone} onChange={(e) => s('timezone', e.target.value)}>
              {(TIMEZONES.length ? TIMEZONES : [value.timezone]).map((tz) => (
                <option key={tz} value={tz}>
                  {tz.replace(/_/g, ' ')}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <div className="row-wrap" style={{ gap: 'var(--s-6)' }}>
        <Chips label="Units" value={value.units} onChange={(v) => s('units', v as Profile['units'])} options={[{ value: 'imperial', label: 'lb, ft, cups' }, { value: 'metric', label: 'kg, cm, grams' }]} />
        <Chips label="Clock" value={value.clock} onChange={(v) => s('clock', v as Profile['clock'])} options={[{ value: '12h', label: '12-hour' }, { value: '24h', label: '24-hour' }]} />
      </div>
      <div className="stack-sm">
        <div className="grid-2">
          {imperial ? (
            <Field label="Height" optional error={errors.heightCm}>
              {(p) => (
                <div className="input-group">
                  <NumberInput {...p} aria-label="Feet" value={fi?.feet ?? null} min={3} max={8} onChange={(ft) => s('heightCm', ft === null ? null : feetInchesToCm(ft, fi?.inches ?? 0))} />
                  <span className="input-suffix">ft</span>
                  <NumberInput aria-label="Inches" value={fi?.inches ?? null} min={0} max={11} onChange={(inch) => s('heightCm', fi || inch !== null ? feetInchesToCm(fi?.feet ?? 5, inch ?? 0) : null)} />
                  <span className="input-suffix">in</span>
                </div>
              )}
            </Field>
          ) : (
            <Field label="Height" optional error={errors.heightCm}>
              {(p) => (
                <div className="input-group">
                  <NumberInput {...p} value={value.heightCm} min={90} max={250} onChange={(v) => s('heightCm', v)} />
                  <span className="input-suffix">cm</span>
                </div>
              )}
            </Field>
          )}
          <Field label="Weight" optional error={errors.weightKg}>
            {(p) => (
              <div className="input-group">
                <NumberInput {...p} value={value.weightKg === null ? null : imperial ? kgToLb(value.weightKg) : value.weightKg} onChange={(v) => s('weightKg', v === null ? null : imperial ? lbToKg(v) : v)} />
                <span className="input-suffix">{imperial ? 'lb' : 'kg'}</span>
              </div>
            )}
          </Field>
        </div>
        <Why>
          Height and weight are optional and never required for a plan. {policy.band !== 'adult' ? 'For your age, Waypoint doesn’t use weight for calorie targets.' : 'They’re only used if you set a body-composition goal.'}
        </Why>
      </div>
      <div className="grid-2">
        <Field label="Current activity level">
          {(p) => (
            <Select {...p} value={value.activityLevel} onChange={(e) => s('activityLevel', e.target.value as Profile['activityLevel'])}>
              <option value="low">Mostly sitting, little exercise</option>
              <option value="moderate">Active a few days a week</option>
              <option value="high">Training or sport most days</option>
              <option value="very_high">Hard training daily / physical job</option>
            </Select>
          )}
        </Field>
        <Field label="Budget for food and products">
          {(p) => (
            <Select {...p} value={value.budget} onChange={(e) => s('budget', e.target.value as Profile['budget'])}>
              <option value="tight">Tight — keep costs low</option>
              <option value="moderate">Moderate</option>
              <option value="flexible">Flexible</option>
            </Select>
          )}
        </Field>
      </div>
      <Field label="Accessibility needs or anything we should plan around" optional error={errors.accessibilityNotes}>
        {(p) => <Textarea {...p} value={value.accessibilityNotes} maxLength={500} onChange={(e) => s('accessibilityNotes', e.target.value)} placeholder="For example: I use a wheelchair, or I need extra time between activities." />}
      </Field>
    </div>
  );
}

/* ---------- Goals ---------- */

export type GoalDraft = Omit<Goal, 'id'>;

export function GoalsForm({ modules, value, onChange, policy }: { modules: ModuleId[]; value: GoalDraft[]; onChange: (v: GoalDraft[]) => void; policy: AgePolicy }) {
  const has = (kind: string, module: ModuleId) => value.some((g) => g.kind === kind && g.module === module);
  const toggle = (module: ModuleId, kind: string) => {
    if (has(kind, module)) onChange(value.filter((g) => !(g.kind === kind && g.module === module)).map((g, i) => ({ ...g, priority: i + 1 })));
    else onChange([...value, { module, kind, title: GOAL_LABELS[kind] ?? kind, targetDate: null, priority: value.length + 1 }]);
  };
  const move = (i: number, d: -1 | 1) => {
    const next = [...value];
    const [g] = next.splice(i, 1);
    next.splice(i + d, 0, g!);
    onChange(next.map((x, idx) => ({ ...x, priority: idx + 1 })));
  };
  return (
    <div className="stack-lg">
      {modules
        .filter((m) => AVAILABLE_MODULES.includes(m))
        .map((m) => (
          <Chips<string>
            key={m}
            label={MODULE_INFO[m].label}
            multiple
            value={value.filter((g) => g.module === m).map((g) => g.kind)}
            onChange={(v) => {
              const kinds = v as string[];
              const changed = [...GOAL_KINDS[m]].find((k) => kinds.includes(k) !== has(k, m));
              if (changed) toggle(m, changed);
            }}
            options={GOAL_KINDS[m]
              .filter((k) => k !== 'body_composition' || policy.allowWeightLossGoal)
              .map((k) => ({ value: k, label: GOAL_LABELS[k] }))}
          />
        ))}
      {policy.band !== 'adult' && <Why>Body-composition goals aren’t offered for your age. Strength, fitness and sport goals build the same healthy habits.</Why>}
      {value.length > 0 && (
        <div className="stack-sm">
          <div className="field-label">Priority order</div>
          <p className="field-hint">When everything can’t fit in a week, higher goals get time first.</p>
          <ol className="card" style={{ listStyle: 'none' }}>
            {value.map((g, i) => (
              <li key={`${g.module}:${g.kind}`} className="list-row" style={{ padding: 'var(--s-3) var(--s-4)', flexWrap: 'wrap' }}>
                <span className="badge badge-accent num">{i + 1}</span>
                <Input aria-label={`Goal ${i + 1} name`} value={g.title} maxLength={120} onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} className="grow" style={{ minWidth: 160, flex: 1 }} />
                <Input aria-label={`Target date for ${g.title}`} type="date" value={g.targetDate ?? ''} onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, targetDate: e.target.value || null } : x)))} style={{ width: 160 }} title="Target date (optional)" />
                <div className="row-sm">
                  <Button size="sm" variant="ghost" iconOnly icon={ArrowUp} aria-label={`Move ${g.title} up`} disabled={i === 0} onClick={() => move(i, -1)} />
                  <Button size="sm" variant="ghost" iconOnly icon={ArrowDown} aria-label={`Move ${g.title} down`} disabled={i === value.length - 1} onClick={() => move(i, 1)} />
                  <Button size="sm" variant="ghost" iconOnly icon={X} aria-label={`Remove ${g.title}`} onClick={() => toggle(g.module, g.kind)} />
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

/* ---------- Schedule ---------- */

export interface HoursBlock {
  enabled: boolean;
  days: number[];
  start: string;
  end: string;
}

export function ScheduleForm({ value, onChange, errors }: { value: Schedule; onChange: (v: Schedule) => void; errors: Errors }) {
  const s = set(value, onChange);
  return (
    <div className="stack-lg">
      <div className="grid-2">
        <TimeField label="Weekday wake-up" value={value.wakeWeekday} onChange={(v) => s('wakeWeekday', v)} error={errors.wakeWeekday} />
        <TimeField label="Weekday bedtime" value={value.sleepWeekday} onChange={(v) => s('sleepWeekday', v)} error={errors.sleepWeekday} />
        <TimeField label="Weekend wake-up" value={value.wakeWeekend} onChange={(v) => s('wakeWeekend', v)} error={errors.wakeWeekend} />
        <TimeField label="Weekend bedtime" value={value.sleepWeekend} onChange={(v) => s('sleepWeekend', v)} error={errors.sleepWeekend} />
      </div>
      <Why>Nothing gets scheduled outside these hours. Teens generally need 8–10 hours of sleep and adults 7–9.</Why>
      <div className="grid-2">
        <Chips label="Best time for workouts" value={value.preferredWorkoutTime} onChange={(v) => s('preferredWorkoutTime', v as Schedule['preferredWorkoutTime'])} options={timePrefs} />
        <Chips label="Best time to study or focus" value={value.preferredStudyTime} onChange={(v) => s('preferredStudyTime', v as Schedule['preferredStudyTime'])} options={timePrefs} />
      </div>
      <DaysPicker label="Rest days (no added training)" value={value.restDays} onChange={(v) => s('restDays', v)} />
      <DaysPicker label="Usually busy days (shorter versions are planned)" value={value.busyDays} onChange={(v) => s('busyDays', v)} />
    </div>
  );
}
const timePrefs: ChoiceOption<string>[] = [
  { value: 'morning', label: 'Morning' },
  { value: 'afternoon', label: 'Afternoon' },
  { value: 'evening', label: 'Evening' },
  { value: 'any', label: 'No preference' },
];

export function HoursForm({ label, value, onChange, errors, prefix }: { label: string; value: HoursBlock; onChange: (v: HoursBlock) => void; errors: Errors; prefix: string }) {
  const s = set(value, onChange);
  return (
    <div className="stack">
      <Switch label={label} checked={value.enabled} onChange={(v) => s('enabled', v)} />
      {value.enabled && (
        <>
          <DaysPicker label="Days" value={value.days} onChange={(v) => s('days', v)} error={errors[`${prefix}.days`]} />
          <div className="grid-2">
            <TimeField label="Starts" value={value.start} onChange={(v) => s('start', v)} />
            <TimeField label="Ends" value={value.end} onChange={(v) => s('end', v)} error={errors[`${prefix}.end`]} />
          </div>
        </>
      )}
    </div>
  );
}

/* ---------- Commitment ---------- */

const KIND_LABELS: Record<CommitmentInput['kind'], string> = { school: 'School', work: 'Work', class: 'Class / lesson', practice: 'Sport practice', game: 'Game / meet', appointment: 'Appointment', other: 'Other' };

export const emptyCommitment = (): CommitmentInput => ({ kind: 'other', title: '', recurrence: { type: 'weekly', days: [] }, start: '16:00', end: '17:00', travelBefore: 0, travelAfter: 0, location: '', intensity: 0 });

export function CommitmentForm({ value, onChange, errors }: { value: CommitmentInput; onChange: (v: CommitmentInput) => void; errors: Errors }) {
  const s = set(value, onChange);
  const sport = value.kind === 'practice' || value.kind === 'game';
  return (
    <div className="stack">
      <div className="grid-2">
        <Field label="Type">
          {(p) => (
            <Select
              {...p}
              value={value.kind}
              onChange={(e) => {
                const kind = e.target.value as CommitmentInput['kind'];
                onChange({ ...value, kind, intensity: kind === 'practice' ? 2 : kind === 'game' ? 3 : 0 });
              }}
            >
              {COMMITMENT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABELS[k]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Title" error={errors.title}>
          {(p) => <Input {...p} value={value.title} maxLength={80} onChange={(e) => s('title', e.target.value)} placeholder="e.g. Soccer practice" />}
        </Field>
      </div>
      <Chips
        label="Repeats"
        value={value.recurrence.type}
        onChange={(v) => s('recurrence', v === 'once' ? { type: 'once', date: new Date().toISOString().slice(0, 10) } : { type: 'weekly', days: [] })}
        options={[{ value: 'weekly', label: 'Every week' }, { value: 'once', label: 'One time' }]}
      />
      {value.recurrence.type === 'weekly' ? (
        <DaysPicker label="On" value={value.recurrence.days} onChange={(days) => s('recurrence', { type: 'weekly', days })} error={errors['recurrence.days']} />
      ) : (
        <Field label="Date" error={errors['recurrence.date']}>
          {(p) => <Input {...p} type="date" value={value.recurrence.type === 'once' ? value.recurrence.date : ''} onChange={(e) => s('recurrence', { type: 'once', date: e.target.value })} />}
        </Field>
      )}
      <div className="grid-2">
        <TimeField label="Starts" value={value.start} onChange={(v) => s('start', v)} />
        <TimeField label="Ends" value={value.end} onChange={(v) => s('end', v)} error={errors.end} />
        <Field label="Travel time before" hint="Minutes">
          {(p) => <NumberInput {...p} min={0} max={180} value={value.travelBefore} onChange={(v) => s('travelBefore', v ?? 0)} />}
        </Field>
        <Field label="Travel time after" hint="Minutes">
          {(p) => <NumberInput {...p} min={0} max={180} value={value.travelAfter} onChange={(v) => s('travelAfter', v ?? 0)} />}
        </Field>
      </div>
      {sport && (
        <>
          <Chips<number> label="How demanding is it usually?" value={value.intensity} onChange={(v) => s('intensity', v as number)} options={[{ value: 1, label: 'Light' }, { value: 2, label: 'Moderate' }, { value: 3, label: 'Hard' }]} />
          <Why>Practices and games count toward your training load, so extra workouts aren’t stacked on top of hard days.</Why>
        </>
      )}
      <Field label="Location" optional>
        {(p) => <Input {...p} value={value.location} maxLength={80} onChange={(e) => s('location', e.target.value)} />}
      </Field>
    </div>
  );
}

/* ---------- Fitness ---------- */

export function FitnessForm({ value, onChange }: { value: FitnessPrefs; onChange: (v: FitnessPrefs) => void }) {
  const s = set(value, onChange);
  return (
    <div className="stack-lg">
      <Chips label="Training experience" value={value.experience} onChange={(v) => s('experience', v as FitnessPrefs['experience'])} options={[{ value: 'new', label: 'New to it' }, { value: 'some', label: 'Some experience' }, { value: 'experienced', label: 'Experienced' }]} />
      <div className="grid-2">
        <Field label="Workouts per week" hint="Not counting practices or games">
          {(p) => <NumberInput {...p} min={1} max={6} value={value.sessionsPerWeek} onChange={(v) => s('sessionsPerWeek', Math.max(1, Math.min(6, v ?? 1)))} />}
        </Field>
        <Field label="Usual session length" hint="Minutes, including warm-up">
          {(p) => (
            <Select {...p} value={value.sessionMinutes} onChange={(e) => s('sessionMinutes', Number(e.target.value))}>
              {[20, 30, 45, 60, 75, 90].map((m) => (
                <option key={m} value={m}>
                  {m} minutes
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <Chips label="Where you can train" multiple value={value.locations} onChange={(v) => s('locations', v as FitnessPrefs['locations'])} options={[{ value: 'home', label: 'Home' }, { value: 'gym', label: 'Gym' }, { value: 'school_gym', label: 'School gym' }, { value: 'outdoors', label: 'Outdoors' }]} />
      <div className="stack-sm">
        <Chips label="Equipment you can use" multiple value={value.equipment} onChange={(v) => s('equipment', v as FitnessPrefs['equipment'])} options={EQUIPMENT.map((e) => ({ value: e, label: EQUIPMENT_LABELS[e] }))} />
        <Why>Workouts only use what you select. Choose nothing and you’ll get bodyweight sessions.</Why>
      </div>
      <Field label="Access hours or restrictions" optional>
        {(p) => <Input {...p} value={value.accessNotes} maxLength={300} onChange={(e) => s('accessNotes', e.target.value)} placeholder="e.g. School gym open until 6 pm on weekdays" />}
      </Field>
      <div className="stack-sm">
        <Chips label="Any areas to go easy on?" multiple value={value.limitations} onChange={(v) => s('limitations', v as FitnessPrefs['limitations'])} options={LIMITATIONS.map((l) => ({ value: l, label: l.replace('_', ' ').replace(/^\w/, (c) => c.toUpperCase()) }))} />
        <Why>Optional. Exercises that heavily load these areas are left out. This isn’t a medical assessment — check with a clinician about pain or injuries.</Why>
      </div>
    </div>
  );
}

/* ---------- Sports ---------- */

export function SportsForm({ value, onChange }: { value: SportsPrefs; onChange: (v: SportsPrefs) => void }) {
  const update = (i: number, patch: Partial<SportsPrefs['sports'][number]>) => onChange({ sports: value.sports.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  return (
    <div className="stack-lg">
      {value.sports.map((sp, i) => {
        const info = SPORTS_CATALOG[sp.sport];
        const dev = sp.teamStatus !== 'on_team';
        return (
          <div key={i} className="card card-pad stack">
            <div className="row between">
              <h3>{info.label}</h3>
              <Button size="sm" variant="ghost" icon={X} onClick={() => onChange({ sports: value.sports.filter((_, j) => j !== i) })}>
                Remove
              </Button>
            </div>
            <div className="grid-2">
              <Field label="Sport">
                {(p) => (
                  <Select {...p} value={sp.sport} onChange={(e) => update(i, { sport: e.target.value as typeof sp.sport, skills: [], position: '' })}>
                    {SPORTS.map((x) => (
                      <option key={x} value={x}>
                        {SPORT_LABELS[x]}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Position or event" optional>
                {(p) => (
                  <>
                    <Input {...p} value={sp.position} maxLength={40} list={`positions-${i}`} onChange={(e) => update(i, { position: e.target.value })} />
                    <datalist id={`positions-${i}`}>{info.positions.map((x) => <option key={x} value={x} />)}</datalist>
                  </>
                )}
              </Field>
            </div>
            <Chips
              label="Team situation"
              value={sp.teamStatus}
              onChange={(v) => update(i, { teamStatus: v as typeof sp.teamStatus })}
              options={[
                { value: 'on_team', label: 'On a team' },
                { value: 'cut', label: 'Got cut' },
                { value: 'tryout_prep', label: 'Preparing for tryouts' },
                { value: 'no_team', label: 'No team right now' },
              ]}
            />
            {sp.teamStatus === 'cut' && (
              <Why>Getting cut is common, and it isn’t the end. Without team practice, your plan adds more skill sessions, regular skills checks and a countdown to the next tryout.</Why>
            )}
            {dev ? (
              <Field label="Next tryout date" optional hint="Gives you a build → sharpen → peak → taper plan, and keeps hard training off tryout day and the day before.">
                {(p) => <Input {...p} type="date" value={sp.tryoutDate ?? ''} onChange={(e) => update(i, { tryoutDate: e.target.value || null })} style={{ maxWidth: 200 }} />}
              </Field>
            ) : (
              <>
                <Chips label="Level" value={sp.level} onChange={(v) => update(i, { level: v as typeof sp.level })} options={[{ value: 'recreational', label: 'Recreational' }, { value: 'school_team', label: 'School team' }, { value: 'club', label: 'Club' }, { value: 'competitive', label: 'Competitive' }]} />
                <Chips label="Season" value={sp.seasonPhase} onChange={(v) => update(i, { seasonPhase: v as typeof sp.seasonPhase })} options={[{ value: 'off', label: 'Off-season' }, { value: 'pre', label: 'Pre-season' }, { value: 'in', label: 'In season' }, { value: 'post', label: 'Post-season' }]} />
              </>
            )}
            <div className="stack-sm">
              <Chips<string>
                label="Skills to focus on (up to 3)"
                multiple
                value={sp.skills}
                onChange={(v) => update(i, { skills: (v as string[]).slice(-3) })}
                options={info.skills.map((s) => ({ value: s.id, label: s.label }))}
              />
              <Why>Each planned session focuses on one of these, rotating through them. Pick none and the plan starts with the basics.</Why>
            </div>
            <Field label={dev ? 'What did the coach say to work on?' : 'What does your coach want you to improve?'} optional hint="Shown with every planned session as a reminder.">
              {(p) => <Textarea {...p} value={sp.coachFeedback} maxLength={500} onChange={(e) => update(i, { coachFeedback: e.target.value })} placeholder="e.g. Weak-hand finishing and getting back on defense" />}
            </Field>
            <Field label="Your goal" optional>
              {(p) => <Input {...p} value={sp.goal} maxLength={140} onChange={(e) => update(i, { goal: e.target.value })} placeholder={dev ? 'e.g. Make the JV team in February' : 'e.g. Faster first step'} />}
            </Field>
          </div>
        );
      })}
      {value.sports.length < 3 && (
        <Button icon={Trophy} onClick={() => onChange({ sports: [...value.sports, { sport: 'soccer', position: '', level: 'school_team', seasonPhase: 'in', goal: '', teamStatus: 'on_team', tryoutDate: null, skills: [], coachFeedback: '' }] })}>
          Add a sport
        </Button>
      )}
      <Why>Add practice and game times as commitments so the plan can work around them.</Why>
    </div>
  );
}

/* ---------- School ---------- */

export function SchoolForm({ value, onChange }: { value: SchoolPrefs; onChange: (v: SchoolPrefs) => void }) {
  const s = set(value, onChange);
  return (
    <div className="stack-lg">
      <div className="grid-2">
        <Field label="Stage">
          {(p) => (
            <Select {...p} value={value.stage} onChange={(e) => s('stage', e.target.value as SchoolPrefs['stage'])}>
              <option value="middle_school">Middle school</option>
              <option value="high_school">High school</option>
              <option value="college">College / university</option>
              <option value="graduate">Graduate school</option>
              <option value="other">Other</option>
            </Select>
          )}
        </Field>
        <Field label="Grade or year" optional>
          {(p) => <Input {...p} value={value.gradeLevel} maxLength={20} onChange={(e) => s('gradeLevel', e.target.value)} placeholder="e.g. 11" />}
        </Field>
      </div>
      <Field label="Study time on school days" hint="Minutes for homework and review, on top of class.">
        {(p) => (
          <Select {...p} value={value.dailyStudyMinutes} onChange={(e) => s('dailyStudyMinutes', Number(e.target.value))}>
            {[0, 20, 30, 45, 60, 90, 120].map((m) => (
              <option key={m} value={m}>
                {m === 0 ? 'Only when work is due' : `${m} minutes`}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Academic goal" optional>
        {(p) => <Input {...p} value={value.academicGoal} maxLength={200} onChange={(e) => s('academicGoal', e.target.value)} placeholder="e.g. B or better in every class" />}
      </Field>
    </div>
  );
}

/* ---------- Nutrition ---------- */

export function NutritionForm({ value, onChange }: { value: NutritionPrefs; onChange: (v: NutritionPrefs) => void }) {
  const s = set(value, onChange);
  const label = (a: string) => a.replace('_', ' ').replace(/^\w/, (c) => c.toUpperCase());
  return (
    <div className="stack-lg">
      <Chips label="Eating pattern" value={value.diet} onChange={(v) => s('diet', v as NutritionPrefs['diet'])} options={[{ value: 'omnivore', label: 'Eat everything' }, { value: 'pescatarian', label: 'Pescatarian' }, { value: 'vegetarian', label: 'Vegetarian' }, { value: 'vegan', label: 'Vegan' }]} />
      <div className="stack-sm">
        <Chips label="Allergies or intolerances" multiple value={value.allergies} onChange={(v) => s('allergies', v as NutritionPrefs['allergies'])} options={ALLERGENS.map((a) => ({ value: a, label: label(a) }))} />
        <Why>Recipes containing these are never suggested. Always check labels — recipes can’t account for cross-contamination.</Why>
      </div>
      <Chips label="Also avoid (cultural or religious)" multiple value={value.avoid} onChange={(v) => s('avoid', v as NutritionPrefs['avoid'])} options={[{ value: 'pork', label: 'Pork' }, { value: 'beef', label: 'Beef' }, { value: 'alcohol', label: 'Alcohol' }, { value: 'gelatin', label: 'Gelatin' }]} />
      <Chips
        label="Kitchen access"
        multiple
        value={value.kitchen}
        onChange={(v) => {
          const list = v as NutritionPrefs['kitchen'];
          const added = list.find((x) => !value.kitchen.includes(x));
          s('kitchen', added === 'no_kitchen' ? ['no_kitchen'] : list.filter((x) => x !== 'no_kitchen'));
        }}
        options={[{ value: 'stove', label: 'Stove' }, { value: 'oven', label: 'Oven' }, { value: 'microwave', label: 'Microwave' }, { value: 'blender', label: 'Blender' }, { value: 'no_kitchen', label: 'No kitchen' }]}
      />
      <Chips label="Cooking experience" value={value.cookingSkill} onChange={(v) => s('cookingSkill', v as NutritionPrefs['cookingSkill'])} options={[{ value: 'beginner', label: 'Beginner' }, { value: 'comfortable', label: 'Comfortable' }, { value: 'confident', label: 'Confident' }]} />
      <div className="grid-2">
        <Field label="Time to cook on weeknights">
          {(p) => (
            <Select {...p} value={value.weekdayCookMinutes} onChange={(e) => s('weekdayCookMinutes', Number(e.target.value))}>
              {[15, 20, 30, 40, 60].map((m) => (
                <option key={m} value={m}>
                  Up to {m} minutes
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="People you cook for" hint="Including you">
          {(p) => <NumberInput {...p} min={1} max={10} value={value.householdSize} onChange={(v) => s('householdSize', Math.max(1, Math.min(10, v ?? 1)))} />}
        </Field>
        <Field label="Meal-prep day" optional>
          {(p) => (
            <Select {...p} value={value.mealPrepDay ?? ''} onChange={(e) => s('mealPrepDay', e.target.value === '' ? null : Number(e.target.value))}>
              <option value="">No meal prep</option>
              {WEEK_ORDER.map((d) => (
                <option key={d} value={d}>
                  {WEEKDAY_SHORT[d]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Lunch on school or work days">
          {(p) => (
            <Select {...p} value={value.schoolLunch} onChange={(e) => s('schoolLunch', e.target.value as NutritionPrefs['schoolLunch'])}>
              <option value="pack">I pack lunch</option>
              <option value="buy">I buy lunch there</option>
              <option value="not_applicable">Not applicable</option>
            </Select>
          )}
        </Field>
      </div>
    </div>
  );
}

/* ---------- Skin & hair ---------- */

export function SkinForm({ value, onChange }: { value: SkinPrefs; onChange: (v: SkinPrefs) => void }) {
  const s = set(value, onChange);
  return (
    <div className="stack-lg">
      <Chips label="Skin type" value={value.type} onChange={(v) => s('type', v as SkinPrefs['type'])} options={[{ value: 'oily', label: 'Oily' }, { value: 'dry', label: 'Dry' }, { value: 'combination', label: 'Combination' }, { value: 'normal', label: 'Normal' }, { value: 'not_sure', label: 'Not sure' }]} />
      <Chips label="What would you like help with?" multiple value={value.concerns} onChange={(v) => s('concerns', v as SkinPrefs['concerns'])} options={[{ value: 'acne', label: 'Breakouts' }, { value: 'dryness', label: 'Dryness' }, { value: 'oiliness', label: 'Shine / oil' }, { value: 'sensitivity', label: 'Sensitivity' }, { value: 'uneven_tone', label: 'Uneven tone / marks' }, { value: 'sun_protection', label: 'Sun protection' }]} />
      <Switch label="My skin reacts to fragrance" checked={value.fragranceSensitive} onChange={(v) => s('fragranceSensitive', v)} />
      <Field label="Known sensitivities or allergies" optional>
        {(p) => <Input {...p} value={value.sensitivities} maxLength={300} onChange={(e) => s('sensitivities', e.target.value)} />}
      </Field>
      <Field label="Products you already use" optional hint="So the routine can build on what you have.">
        {(p) => <Textarea {...p} value={value.currentProducts} maxLength={500} onChange={(e) => s('currentProducts', e.target.value)} />}
      </Field>
      <Chips label="Routine size" value={value.routineSize} onChange={(v) => s('routineSize', v as SkinPrefs['routineSize'])} options={[{ value: 'minimal', label: 'Minimal (3 steps)' }, { value: 'standard', label: 'Standard (adds targeted care)' }]} />
    </div>
  );
}

export function HairForm({ value, onChange }: { value: HairPrefs; onChange: (v: HairPrefs) => void }) {
  const s = set(value, onChange);
  return (
    <div className="stack-lg">
      <Chips label="Hair texture" value={value.texture} onChange={(v) => s('texture', v as HairPrefs['texture'])} options={[{ value: 'straight', label: 'Straight' }, { value: 'wavy', label: 'Wavy' }, { value: 'curly', label: 'Curly' }, { value: 'coily', label: 'Coily' }, { value: 'not_sure', label: 'Not sure' }]} />
      <Chips label="Scalp" value={value.scalp} onChange={(v) => s('scalp', v as HairPrefs['scalp'])} options={[{ value: 'normal', label: 'Normal' }, { value: 'oily', label: 'Oily' }, { value: 'dry', label: 'Dry' }, { value: 'flaky_or_itchy', label: 'Flaky or itchy' }]} />
      <div className="grid-2">
        <Field label="Washes per week">
          {(p) => <NumberInput {...p} min={0} max={7} value={value.washesPerWeek} onChange={(v) => s('washesPerWeek', Math.max(0, Math.min(7, v ?? 0)))} />}
        </Field>
        <Field label="Heat styling">
          {(p) => (
            <Select {...p} value={value.heat} onChange={(e) => s('heat', e.target.value as HairPrefs['heat'])}>
              <option value="never">Never</option>
              <option value="sometimes">Sometimes</option>
              <option value="often">Often</option>
            </Select>
          )}
        </Field>
      </div>
      <Switch label="Colour, relaxer, perm or other chemical treatment" checked={value.chemicallyTreated} onChange={(v) => s('chemicallyTreated', v)} />
      <Chips label="Main struggles" multiple value={value.concerns} onChange={(v) => s('concerns', v as HairPrefs['concerns'])} options={[{ value: 'frizz', label: 'Frizz' }, { value: 'dryness', label: 'Dryness' }, { value: 'breakage', label: 'Breakage' }, { value: 'oily_scalp', label: 'Oily scalp' }, { value: 'definition', label: 'Curl definition' }, { value: 'tangles', label: 'Tangles' }]} />
      <Chips label="Facial hair" value={value.facialHair} onChange={(v) => s('facialHair', v as HairPrefs['facialHair'])} options={[{ value: 'none', label: 'None' }, { value: 'shave', label: 'I shave' }, { value: 'beard', label: 'I keep a beard' }, { value: 'not_applicable', label: 'Skip' }]} />
    </div>
  );
}
