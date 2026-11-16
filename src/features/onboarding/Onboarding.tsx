import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { ArrowLeft, ArrowRight, BookOpen, CalendarPlus, Check, Navigation, Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { z } from 'zod';
import {
  ASSIGNMENT_TYPES, CommitmentInput, CourseInput, FitnessSchema, HairSchema, NutritionSchema, ProfileSchema, ScheduleSchema, SchoolSchema, SkinSchema, SportsSchema,
  type CommitmentInput as Commitment, type FitnessPrefs, type HairPrefs, type ModuleId, type NutritionPrefs, type Profile, type Schedule, type SchoolPrefs, type SkinPrefs, type SportsPrefs,
} from '@shared/schemas';
import { AssessmentInput, HoursBlock as HoursSchema, type OnboardingStep } from '@shared/schemas/onboarding';
import { agePolicy } from '@shared/domain/age';
import { WEEKDAY_SHORT, formatMinutes, hhmmToMin } from '@shared/domain/time';
import { api, errorMessage, fieldErrors } from '@/lib/api';
import { useMe } from '@/app/App';
import { Dialog, useToast } from '@/ui/overlay';
import { Button, Callout, Card, Chips, ErrorState, Field, Input, PageSkeleton, ProgressBar, Select } from '@/ui/primitives';
import {
  CommitmentForm, FitnessForm, GoalsForm, HairForm, HoursForm, MODULE_INFO, ModulesPicker, NutritionForm, ProfileForm, ScheduleForm, SchoolForm, SkinForm, SportsForm, Why,
  emptyCommitment, validate, type Errors, type GoalDraft, type HoursBlock,
} from '@/features/forms/forms';

interface Draft {
  profile: Profile;
  goals: GoalDraft[];
  schedule: Schedule;
  schoolHours: HoursBlock;
  workHours: HoursBlock;
  commitments: Commitment[];
  fitness: FitnessPrefs;
  sports: SportsPrefs;
  school: SchoolPrefs;
  courses: { name: string; difficulty: number; targetGrade: number | null }[];
  assessments: { title: string; courseName: string; type: (typeof ASSIGNMENT_TYPES)[number]; dueDate: string }[];
  nutrition: NutritionPrefs;
  skin: SkinPrefs;
  hair: HairPrefs;
}

function defaults(birthday: string): Draft {
  let tz = 'UTC';
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    /* keep UTC */
  }
  const us = /^America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Detroit|Indiana)/.test(tz) || tz.startsWith('Pacific/Honolulu');
  return {
    profile: { displayName: '', birthday, timezone: tz, units: us ? 'imperial' : 'metric', clock: us ? '12h' : '24h', heightCm: null, weightKg: null, activityLevel: 'moderate', budget: 'moderate', accessibilityNotes: '', modules: [] },
    goals: [],
    schedule: { lifeStage: 'student', wakeWeekday: '06:30', sleepWeekday: '22:30', wakeWeekend: '08:00', sleepWeekend: '23:00', preferredWorkoutTime: 'any', preferredStudyTime: 'any', restDays: [0], busyDays: [], commuteMinutes: 15 },
    schoolHours: { enabled: true, days: [1, 2, 3, 4, 5], start: '08:00', end: '15:00' },
    workHours: { enabled: true, days: [1, 2, 3, 4, 5], start: '09:00', end: '17:00' },
    commitments: [],
    fitness: { experience: 'some', sessionsPerWeek: 3, sessionMinutes: 45, locations: ['home'], equipment: [], accessNotes: '', limitations: [], limitationNotes: '' },
    sports: { sports: [] },
    school: { stage: 'high_school', gradeLevel: '', dailyStudyMinutes: 30, academicGoal: '' },
    courses: [],
    assessments: [],
    nutrition: { diet: 'omnivore', allergies: [], avoid: [], kitchen: ['stove', 'oven', 'microwave'], cookingSkill: 'beginner', weekdayCookMinutes: 30, householdSize: 1, mealPrepDay: null, schoolLunch: 'pack' },
    skin: { type: 'not_sure', concerns: [], fragranceSensitive: false, sensitivities: '', currentProducts: '', routineSize: 'minimal' },
    hair: { texture: 'not_sure', scalp: 'normal', washesPerWeek: 3, heat: 'never', chemicallyTreated: false, concerns: [], facialHair: 'not_applicable', currentProducts: '' },
  };
}

const STEP_META: Record<OnboardingStep, { title: string; lead: string }> = {
  welcome: { title: 'Let’s set up your plan', lead: 'Pick the areas you want help with. Waypoint only asks about what you choose, and you can change this any time.' },
  about: { title: 'A bit about you', lead: 'Used to keep recommendations realistic and age-appropriate. Optional fields can be skipped.' },
  goals: { title: 'What are you working toward?', lead: 'Choose a few goals and put them in order. The planner gives time to the top ones first.' },
  schedule: { title: 'Your typical week', lead: 'Sleep, school and work become the fixed frame everything else fits around.' },
  commitments: { title: 'Other fixed commitments', lead: 'Practices, games, lessons, jobs, appointments — anything that can’t move.' },
  fitness: { title: 'Training setup', lead: 'Where and how you can train. Workouts adapt to the equipment you actually have.' },
  sports: { title: 'Your sports', lead: 'Skill work and training load are planned around your season.' },
  school: { title: 'School', lead: 'Courses and upcoming assessments. You can import a calendar file or connect services later.' },
  food: { title: 'Food', lead: 'Meals that suit your diet, kitchen and schedule — with a grocery list that adds everything up.' },
  care: { title: 'Personal care', lead: 'A simple routine that fits your time. This is cosmetic guidance, not a diagnosis.' },
  review: { title: 'Review and build your plan', lead: 'Check everything looks right. You can edit any of this later in Settings.' },
};

function stepsFor(modules: ModuleId[]): OnboardingStep[] {
  const has = (...m: ModuleId[]) => m.some((x) => modules.includes(x));
  return [
    'welcome', 'about', 'goals', 'schedule', 'commitments',
    ...(has('fitness', 'sports') ? (['fitness'] as const) : []),
    ...(has('sports') ? (['sports'] as const) : []),
    ...(has('school') ? (['school'] as const) : []),
    ...(has('nutrition') ? (['food'] as const) : []),
    ...(has('skincare', 'haircare') ? (['care'] as const) : []),
    'review',
  ];
}

function validateStep(step: OnboardingStep, d: Draft): Errors {
  switch (step) {
    case 'welcome':
      return validate(ProfileSchema.pick({ displayName: true, modules: true }), d.profile);
    case 'about':
      return validate(ProfileSchema, d.profile);
    case 'goals':
      return {};
    case 'schedule': {
      const e = validate(ScheduleSchema, d.schedule);
      if (d.schedule.lifeStage === 'student' || d.schedule.lifeStage === 'both') Object.assign(e, validate(HoursSchema, d.schoolHours, 'schoolHours'));
      if (d.schedule.lifeStage === 'working' || d.schedule.lifeStage === 'both') Object.assign(e, validate(HoursSchema, d.workHours, 'workHours'));
      return e;
    }
    case 'fitness':
      return validate(FitnessSchema, d.fitness);
    case 'sports':
      return validate(SportsSchema, d.sports);
    case 'school':
      return { ...validate(SchoolSchema, d.school), ...validate(z.array(CourseInput), d.courses, 'courses'), ...validate(z.array(AssessmentInput), d.assessments, 'assessments') };
    case 'food':
      return validate(NutritionSchema, d.nutrition);
    case 'care':
      return { ...(d.profile.modules.includes('skincare') ? validate(SkinSchema, d.skin) : {}), ...(d.profile.modules.includes('haircare') ? validate(HairSchema, d.hair) : {}) };
    default:
      return {};
  }
}

function payload(d: Draft) {
  const m = new Set(d.profile.modules);
  return {
    profile: d.profile,
    goals: d.goals.filter((g) => m.has(g.module)),
    schedule: d.schedule,
    schoolHours: d.schoolHours,
    workHours: d.workHours,
    commitments: d.commitments,
    fitness: m.has('fitness') || m.has('sports') ? d.fitness : undefined,
    sports: m.has('sports') ? d.sports : undefined,
    school: m.has('school') ? d.school : undefined,
    courses: m.has('school') ? d.courses : undefined,
    assessments: m.has('school') ? d.assessments : undefined,
    nutrition: m.has('nutrition') ? d.nutrition : undefined,
    skin: m.has('skincare') ? d.skin : undefined,
    hair: m.has('haircare') ? d.hair : undefined,
  };
}

export default function Onboarding() {
  const me = useMe();
  const saved = useQuery({ queryKey: ['onboarding'], queryFn: () => api.get<{ step: OnboardingStep; draft: Partial<Draft> }>('/onboarding') });
  if (saved.isPending || me.isPending) return <PageSkeleton />;
  if (saved.error) return <ErrorState error={saved.error} onRetry={() => saved.refetch()} />;
  const base = defaults(me.data!.user.birthday);
  const draft = { ...base, ...saved.data.draft, profile: { ...base.profile, ...(saved.data.draft.profile ?? {}) } } as Draft;
  return <Wizard initial={draft} initialStep={saved.data.step} />;
}

function Wizard({ initial, initialStep }: { initial: Draft; initialStep: OnboardingStep }) {
  const [d, setD] = useState<Draft>(initial);
  const steps = useMemo(() => stepsFor(d.profile.modules), [d.profile.modules]);
  const [step, setStep] = useState<OnboardingStep>(steps.includes(initialStep) ? initialStep : 'welcome');
  const [errors, setErrors] = useState<Errors>({});
  const toast = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const idx = steps.indexOf(step);
  const today = new Date().toISOString().slice(0, 10);
  const policy = agePolicy(d.profile.birthday, today);

  useEffect(() => {
    headingRef.current?.focus();
    window.scrollTo({ top: 0 });
  }, [step]);

  const save = useMutation({ mutationFn: (s: OnboardingStep) => api.put('/onboarding', { step: s, draft: d }) });
  const finish = useMutation({
    mutationFn: () => api.post('/onboarding/complete', payload(d)),
    onSuccess: async () => {
      await qc.invalidateQueries();
      navigate('/');
    },
  });

  const go = async (dir: 1 | -1) => {
    if (dir === 1) {
      const e = validateStep(step, d);
      setErrors(e);
      if (Object.keys(e).length) {
        toast({ message: 'A few fields need attention.', tone: 'error' });
        return;
      }
    } else setErrors({});
    const next = steps[idx + dir];
    if (!next) return;
    try {
      await save.mutateAsync(next);
    } catch {
      toast({ message: 'Couldn’t save your progress — your answers are kept on this page.', tone: 'error' });
    }
    setStep(next);
  };

  const up = <K extends keyof Draft>(k: K) => (v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const isStudent = d.schedule.lifeStage === 'student' || d.schedule.lifeStage === 'both';
  const isWorking = d.schedule.lifeStage === 'working' || d.schedule.lifeStage === 'both';

  let body: ReactNode = null;
  switch (step) {
    case 'welcome':
      body = (
        <>
          <Field label="What should we call you?" error={errors.displayName}>
            {(p) => <Input {...p} value={d.profile.displayName} maxLength={60} autoComplete="given-name" onChange={(e) => up('profile')({ ...d.profile, displayName: e.target.value })} style={{ maxWidth: 360 }} />}
          </Field>
          <div className="stack-sm">
            <div className="field-label">Areas to plan</div>
            <ModulesPicker value={d.profile.modules} onChange={(modules) => up('profile')({ ...d.profile, modules })} />
            {errors.modules && <div className="field-error">{errors.modules}</div>}
          </div>
        </>
      );
      break;
    case 'about':
      body = <ProfileForm value={d.profile} onChange={up('profile')} errors={errors} policy={policy} />;
      break;
    case 'goals':
      body = (
        <>
          <GoalsForm modules={d.profile.modules} value={d.goals} onChange={up('goals')} policy={policy} />
          {d.goals.length === 0 && <Callout tone="info">You can skip this — the plan will balance your chosen areas evenly.</Callout>}
        </>
      );
      break;
    case 'schedule':
      body = (
        <>
          <Chips
            label="Right now I’m…"
            value={d.schedule.lifeStage}
            onChange={(v) => up('schedule')({ ...d.schedule, lifeStage: v as Schedule['lifeStage'] })}
            options={[{ value: 'student', label: 'A student' }, { value: 'working', label: 'Working' }, { value: 'both', label: 'Both' }, { value: 'neither', label: 'Neither' }]}
          />
          {isStudent && !d.profile.modules.includes('school') && (
            <Callout tone="info" icon={BookOpen} action={<Button size="sm" onClick={() => up('profile')({ ...d.profile, modules: [...d.profile.modules, 'school'] })}>Turn on School</Button>}>
              Turn on School to plan study sessions around your assignments and tests.
            </Callout>
          )}
          {isStudent && <HoursForm label="School hours" value={d.schoolHours} onChange={up('schoolHours')} errors={errors} prefix="schoolHours" />}
          {isWorking && <HoursForm label="Work hours" value={d.workHours} onChange={up('workHours')} errors={errors} prefix="workHours" />}
          {(isStudent || isWorking) && (
            <Field label="Commute each way" hint="Minutes. Added before and after school/work.">
              {(p) => <Input {...p} type="number" min={0} max={180} value={d.schedule.commuteMinutes} onChange={(e) => up('schedule')({ ...d.schedule, commuteMinutes: Number(e.target.value) || 0 })} style={{ maxWidth: 160 }} />}
            </Field>
          )}
          <ScheduleForm value={d.schedule} onChange={up('schedule')} errors={errors} />
        </>
      );
      break;
    case 'commitments':
      body = <CommitmentsEditor value={d.commitments} onChange={up('commitments')} sports={d.profile.modules.includes('sports')} />;
      break;
    case 'fitness':
      body = <FitnessForm value={d.fitness} onChange={up('fitness')} />;
      break;
    case 'sports':
      body = <SportsForm value={d.sports} onChange={up('sports')} />;
      break;
    case 'school':
      body = (
        <>
          <SchoolForm value={d.school} onChange={up('school')} />
          <CoursesEditor courses={d.courses} assessments={d.assessments} onCourses={up('courses')} onAssessments={up('assessments')} errors={errors} />
        </>
      );
      break;
    case 'food':
      body = <NutritionForm value={d.nutrition} onChange={up('nutrition')} />;
      break;
    case 'care':
      body = (
        <>
          {d.profile.modules.includes('skincare') && (
            <section className="ob-section">
              <h2>Skin</h2>
              <SkinForm value={d.skin} onChange={up('skin')} />
            </section>
          )}
          {d.profile.modules.includes('haircare') && (
            <section className="ob-section">
              <h2>Hair & grooming</h2>
              <HairForm value={d.hair} onChange={up('hair')} />
            </section>
          )}
          <Why>Photos aren’t needed and aren’t collected. Routines use product categories, not brands.</Why>
        </>
      );
      break;
    case 'review':
      body = <Review d={d} onEdit={setStep} />;
      break;
  }

  return (
    <div className="ob">
      <header className="ob-top">
        <div className="brand" style={{ padding: 0 }}>
          <span className="brand-mark">
            <Navigation aria-hidden />
          </span>
        </div>
        <div className="ob-progress">
          <div className="row between xsmall subtle">
            <span>
              Step {idx + 1} of {steps.length}
            </span>
            <span>{save.isPending ? 'Saving…' : 'Progress saved'}</span>
          </div>
          <ProgressBar value={idx + 1} max={steps.length} label="Setup progress" />
        </div>
      </header>
      <main className="ob-body">
        <div className="ob-head">
          <h1 ref={headingRef} tabIndex={-1} style={{ outline: 'none' }}>
            {STEP_META[step].title}
          </h1>
          <p>{STEP_META[step].lead}</p>
        </div>
        {body}
        {finish.error && (
          <Callout tone="danger" title="Couldn’t finish setup">
            {errorMessage(finish.error)}
            {Object.entries(fieldErrors(finish.error)).map(([k, v]) => (
              <div key={k} className="xsmall">
                {k}: {v}
              </div>
            ))}
          </Callout>
        )}
      </main>
      <footer className="ob-foot">
        <div className="ob-foot-inner">
          <Button variant="ghost" icon={ArrowLeft} onClick={() => go(-1)} disabled={idx === 0}>
            Back
          </Button>
          {step === 'review' ? (
            <Button variant="primary" icon={Check} loading={finish.isPending} onClick={() => finish.mutate()}>
              Build my plan
            </Button>
          ) : (
            <Button variant="primary" onClick={() => go(1)} loading={save.isPending}>
              Continue <ArrowRight aria-hidden />
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}

/* ---------- Commitments ---------- */

export function describeCommitment(c: Commitment) {
  const when = c.recurrence.type === 'weekly' ? c.recurrence.days.map((x) => WEEKDAY_SHORT[x]).join(', ') : c.recurrence.date;
  return `${when} · ${formatMinutes(hhmmToMin(c.start))}–${formatMinutes(hhmmToMin(c.end))}${c.travelBefore || c.travelAfter ? ` · +${c.travelBefore + c.travelAfter} min travel` : ''}`;
}

function CommitmentsEditor({ value, onChange, sports }: { value: Commitment[]; onChange: (v: Commitment[]) => void; sports: boolean }) {
  const [editing, setEditing] = useState<{ index: number | null; value: Commitment } | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const save = () => {
    if (!editing) return;
    const e = validate(CommitmentInput, editing.value);
    setErrors(e);
    if (Object.keys(e).length) return;
    onChange(editing.index === null ? [...value, editing.value] : value.map((c, i) => (i === editing.index ? editing.value : c)));
    setEditing(null);
  };
  return (
    <div className="stack">
      {value.length === 0 ? (
        <Card quiet>
          <p className="muted small">
            Nothing added yet. {sports ? 'Add your practices and games so workouts don’t pile on top of them.' : 'You can skip this step if school or work covers your fixed time.'}
          </p>
        </Card>
      ) : (
        <ul className="card" style={{ listStyle: 'none' }}>
          {value.map((c, i) => (
            <li key={i} className="list-row">
              <div className="grow">
                <div className="strong truncate">{c.title}</div>
                <div className="small muted">{describeCommitment(c)}</div>
              </div>
              <Button size="sm" variant="ghost" iconOnly icon={Pencil} aria-label={`Edit ${c.title}`} onClick={() => setEditing({ index: i, value: c })} />
              <Button size="sm" variant="ghost" iconOnly icon={Trash2} aria-label={`Remove ${c.title}`} onClick={() => onChange(value.filter((_, j) => j !== i))} />
            </li>
          ))}
        </ul>
      )}
      <div className="row-wrap">
        <Button icon={Plus} onClick={() => { setErrors({}); setEditing({ index: null, value: emptyCommitment() }); }}>
          Add commitment
        </Button>
        {sports && (
          <Button icon={CalendarPlus} onClick={() => { setErrors({}); setEditing({ index: null, value: { ...emptyCommitment(), kind: 'practice', title: 'Practice', intensity: 2, start: '15:30', end: '17:30' } }); }}>
            Add practice
          </Button>
        )}
      </div>
      <Dialog
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.index === null ? 'Add commitment' : 'Edit commitment'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={save}>
              Save
            </Button>
          </>
        }
      >
        {editing && <CommitmentForm value={editing.value} onChange={(v) => setEditing({ ...editing, value: v })} errors={errors} />}
      </Dialog>
    </div>
  );
}

/* ---------- Courses & assessments ---------- */

function CoursesEditor({ courses, assessments, onCourses, onAssessments, errors }: { courses: Draft['courses']; assessments: Draft['assessments']; onCourses: (v: Draft['courses']) => void; onAssessments: (v: Draft['assessments']) => void; errors: Errors }) {
  return (
    <>
      <section className="ob-section">
        <div>
          <h2>Courses</h2>
          <p className="small muted">Difficulty helps the planner give harder classes a little more study time.</p>
        </div>
        {courses.map((c, i) => (
          <div key={i} className="row-wrap" style={{ alignItems: 'flex-end' }}>
            <Field label="Course" error={errors[`courses.${i}.name`]} className="grow">
              {(p) => <Input {...p} value={c.name} maxLength={80} onChange={(e) => onCourses(courses.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />}
            </Field>
            <Field label="Difficulty for you">
              {(p) => (
                <Select {...p} value={c.difficulty} onChange={(e) => onCourses(courses.map((x, j) => (j === i ? { ...x, difficulty: Number(e.target.value) } : x)))}>
                  <option value={1}>Easy</option>
                  <option value={2}>Fairly easy</option>
                  <option value={3}>Medium</option>
                  <option value={4}>Hard</option>
                  <option value={5}>Very hard</option>
                </Select>
              )}
            </Field>
            <Button variant="ghost" iconOnly icon={Trash2} aria-label={`Remove ${c.name || 'course'}`} onClick={() => onCourses(courses.filter((_, j) => j !== i))} />
          </div>
        ))}
        <div>
          <Button icon={Plus} onClick={() => onCourses([...courses, { name: '', difficulty: 3, targetGrade: null }])}>
            Add course
          </Button>
        </div>
      </section>
      <section className="ob-section">
        <div>
          <h2>Upcoming tests and big assignments</h2>
          <p className="small muted">Study time is spread out before each due date.</p>
        </div>
        {assessments.map((a, i) => (
          <div key={i} className="card card-pad stack">
            <div className="grid-2">
              <Field label="Title" error={errors[`assessments.${i}.title`]}>
                {(p) => <Input {...p} value={a.title} maxLength={140} onChange={(e) => onAssessments(assessments.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />}
              </Field>
              <Field label="Course" optional>
                {(p) => (
                  <Select {...p} value={a.courseName} onChange={(e) => onAssessments(assessments.map((x, j) => (j === i ? { ...x, courseName: e.target.value } : x)))}>
                    <option value="">No course</option>
                    {courses.filter((c) => c.name).map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Type">
                {(p) => (
                  <Select {...p} value={a.type} onChange={(e) => onAssessments(assessments.map((x, j) => (j === i ? { ...x, type: e.target.value as typeof a.type } : x)))}>
                    {ASSIGNMENT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t[0]!.toUpperCase() + t.slice(1)}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Due date" error={errors[`assessments.${i}.dueDate`]}>
                {(p) => <Input {...p} type="date" value={a.dueDate} onChange={(e) => onAssessments(assessments.map((x, j) => (j === i ? { ...x, dueDate: e.target.value } : x)))} />}
              </Field>
            </div>
            <div>
              <Button size="sm" variant="ghost" icon={Trash2} onClick={() => onAssessments(assessments.filter((_, j) => j !== i))}>
                Remove
              </Button>
            </div>
          </div>
        ))}
        <div>
          <Button icon={Plus} onClick={() => onAssessments([...assessments, { title: '', courseName: '', type: 'test', dueDate: '' }])}>
            Add test or assignment
          </Button>
        </div>
        <Why>Waypoint never asks for your school password. Canvas and calendar-file import are available from School after setup.</Why>
      </section>
    </>
  );
}

/* ---------- Review ---------- */

function Review({ d, onEdit }: { d: Draft; onEdit: (s: OnboardingStep) => void }) {
  const rows: { step: OnboardingStep; label: string; value: ReactNode }[] = [
    { step: 'welcome', label: 'Areas', value: d.profile.modules.map((m) => MODULE_INFO[m].label).join(', ') },
    { step: 'about', label: 'Time zone & units', value: `${d.profile.timezone.replace(/_/g, ' ')} · ${d.profile.units}` },
    { step: 'goals', label: 'Goals', value: d.goals.length ? d.goals.map((g, i) => `${i + 1}. ${g.title}`).join('  ') : 'None — balanced plan' },
    { step: 'schedule', label: 'Sleep', value: `Weekdays ${d.schedule.wakeWeekday}–${d.schedule.sleepWeekday}, weekends ${d.schedule.wakeWeekend}–${d.schedule.sleepWeekend}` },
    { step: 'commitments', label: 'Commitments', value: d.commitments.length ? d.commitments.map((c) => c.title).join(', ') : 'None added' },
  ];
  const m = d.profile.modules;
  if (m.includes('fitness') || m.includes('sports')) rows.push({ step: 'fitness', label: 'Training', value: `${d.fitness.sessionsPerWeek}× ${d.fitness.sessionMinutes} min · ${d.fitness.equipment.length ? `${d.fitness.equipment.length} equipment items` : 'bodyweight'}` });
  if (m.includes('school')) rows.push({ step: 'school', label: 'School', value: `${d.courses.length} courses · ${d.assessments.length} upcoming` });
  if (m.includes('nutrition')) rows.push({ step: 'food', label: 'Food', value: `${d.nutrition.diet}${d.nutrition.allergies.length ? ` · avoids ${d.nutrition.allergies.join(', ')}` : ''}` });
  return (
    <div className="stack">
      <dl className="card" style={{ margin: 0 }}>
        {rows.map((r) => (
          <div key={r.step + r.label} className="list-row" style={{ alignItems: 'flex-start' }}>
            <dt className="small subtle" style={{ width: 130, flex: 'none' }}>
              {r.label}
            </dt>
            <dd className="grow small" style={{ margin: 0 }}>
              {r.value}
            </dd>
            <Button size="sm" variant="ghost" onClick={() => onEdit(r.step)}>
              Edit
            </Button>
          </div>
        ))}
      </dl>
      <Callout tone="accent" title="What happens next">
        Waypoint builds this week’s plan around your fixed commitments. Anything that doesn’t fit is listed with the reason, so nothing is silently dropped.
      </Callout>
    </div>
  );
}
