import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, NavLink, useNavigate, useParams } from 'react-router';
import { Download, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { z } from 'zod';
import {
  CommitmentInput, GoalSchema, SETTINGS_SCHEMAS, type Commitment, type FitnessPrefs, type Goal, type HairPrefs, type ModuleId, type NutritionPrefs,
  type Profile, type Schedule, type SchoolPrefs, type SettingsBundle, type SkinPrefs, type SportsPrefs,
} from '@shared/schemas';
import { agePolicy } from '@shared/domain/age';
import { api, errorMessage, fieldErrors } from '@/lib/api';
import { useMe } from '@/app/App';
import { Dialog, useToast } from '@/ui/overlay';
import { Button, Callout, Card, Chips, ErrorState, Field, Input, PageHeader, PageSkeleton } from '@/ui/primitives';
import {
  CommitmentForm, FitnessForm, GoalsForm, HairForm, ModulesPicker, NutritionForm, ProfileForm, ScheduleForm, SchoolForm, SkinForm, SportsForm,
  emptyCommitment, validate, type Errors, type GoalDraft,
} from '@/features/forms/forms';
import { describeCommitment } from '@/features/onboarding/Onboarding';
import { IntegrationsList } from './Integrations';
import { SecuritySection } from './SecuritySection';
import { RemindersSection } from './RemindersSection';

const MODULE_DEFAULTS: Partial<Record<'fitness' | 'sports' | 'school' | 'nutrition' | 'skin' | 'hair', unknown>> = {
  fitness: { experience: 'some', sessionsPerWeek: 3, sessionMinutes: 45, locations: ['home'], equipment: [], accessNotes: '', limitations: [], limitationNotes: '' } satisfies FitnessPrefs,
  sports: { sports: [] } satisfies SportsPrefs,
  school: { stage: 'high_school', gradeLevel: '', dailyStudyMinutes: 30, academicGoal: '' } satisfies SchoolPrefs,
  nutrition: { diet: 'omnivore', allergies: [], avoid: [], kitchen: ['stove', 'oven', 'microwave'], cookingSkill: 'beginner', weekdayCookMinutes: 30, householdSize: 1, mealPrepDay: null, schoolLunch: 'pack' } satisfies NutritionPrefs,
  skin: { type: 'not_sure', concerns: [], fragranceSensitive: false, sensitivities: '', currentProducts: '', routineSize: 'minimal' } satisfies SkinPrefs,
  hair: { texture: 'not_sure', scalp: 'normal', washesPerWeek: 3, heat: 'never', chemicallyTreated: false, concerns: [], facialHair: 'not_applicable', currentProducts: '' } satisfies HairPrefs,
};
const MODULE_KEYS: Record<ModuleId, (keyof typeof MODULE_DEFAULTS)[]> = { fitness: ['fitness'], sports: ['fitness', 'sports'], school: ['school'], nutrition: ['nutrition'], skincare: ['skin'], haircare: ['hair'] };

interface SettingsData {
  settings: Partial<SettingsBundle>;
  goals: Goal[];
}

const SECTIONS = [
  { id: 'profile', label: 'Profile' },
  { id: 'areas', label: 'Areas & goals' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'reminders', label: 'Reminders' },
  { id: 'fitness', label: 'Fitness & sports', modules: ['fitness', 'sports'] },
  { id: 'school', label: 'School', modules: ['school'] },
  { id: 'food', label: 'Food', modules: ['nutrition'] },
  { id: 'care', label: 'Personal care', modules: ['skincare', 'haircare'] },
  { id: 'connections', label: 'Connections' },
  { id: 'security', label: 'Password' },
  { id: 'privacy', label: 'Privacy & data' },
  { id: 'about', label: 'About this version' },
];

export default function SettingsPage() {
  const { section = 'profile' } = useParams();
  const q = useQuery({ queryKey: ['settings'], queryFn: () => api.get<SettingsData>('/settings') });
  if (q.isPending) return <PageSkeleton />;
  if (q.error) return <div className="page"><ErrorState error={q.error} onRetry={() => q.refetch()} /></div>;
  const s = q.data.settings as SettingsBundle;
  const modules = s.profile.modules;
  const visible = SECTIONS.filter((x) => !x.modules || x.modules.some((m) => modules.includes(m as ModuleId)));
  const current = visible.some((x) => x.id === section) ? section : 'profile';
  return (
    <div className="page">
      <PageHeader title="Settings" />
      <div className="settings-layout">
        <aside className="settings-nav" aria-label="Settings sections">
          <nav className="nav">
            {visible.map((x) => <NavLink key={x.id} to={`/settings/${x.id}`} aria-current={current === x.id ? 'page' : undefined}>{x.label}</NavLink>)}
          </nav>
        </aside>
        <div className="stack-lg" key={current}>
          {current === 'profile' && <ProfileSection s={s} />}
          {current === 'areas' && <AreasSection s={s} goals={q.data.goals} />}
          {current === 'schedule' && <ScheduleSection s={s} />}
          {current === 'reminders' && <RemindersSection initial={s.reminders} />}
          {current === 'fitness' && <FitnessSection s={s} />}
          {current === 'school' && <SimpleSection<SchoolPrefs> title="School" settingsKey="school" initial={(s.school ?? MODULE_DEFAULTS.school) as SchoolPrefs} render={(v, on) => <SchoolForm value={v} onChange={on} />} />}
          {current === 'food' && <SimpleSection<NutritionPrefs> title="Food preferences" settingsKey="nutrition" initial={(s.nutrition ?? MODULE_DEFAULTS.nutrition) as NutritionPrefs} render={(v, on) => <NutritionForm value={v} onChange={on} />} note="To apply these to meals you’ve already planned, use “New meal plan” on the Food page." />}
          {current === 'care' && <CareSection s={s} />}
          {current === 'connections' && <IntegrationsList />}
          {current === 'security' && <SecuritySection />}
          {current === 'privacy' && <PrivacySection />}
          {current === 'about' && <AboutSection />}
        </div>
      </div>
    </div>
  );
}

function useSaveSetting() {
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: ({ key, value }: { key: string; value: unknown }) => api.put(`/settings/${key}`, value),
    onSuccess: () => {
      qc.invalidateQueries();
      toast({ message: 'Saved. Your plan will offer to adapt.', action: { label: 'Review plan', run: () => navigate('/plan') } });
    },
  });
}

function SaveBar({ onSave, loading, error }: { onSave: () => void; loading: boolean; error?: unknown }) {
  return (
    <div className="stack-sm">
      {!!error && !Object.keys(fieldErrors(error)).length && <Callout tone="danger">{errorMessage(error)}</Callout>}
      <div><Button variant="primary" loading={loading} onClick={onSave}>Save changes</Button></div>
    </div>
  );
}

function SimpleSection<T>({ title, settingsKey, initial, render, note }: { title: string; settingsKey: keyof typeof SETTINGS_SCHEMAS; initial: T; render: (v: T, on: (v: T) => void) => ReactNode; note?: string }) {
  const [v, setV] = useState<T>(initial);
  const save = useSaveSetting();
  return (
    <Card title={title}>
      <div className="stack-lg">
        {render(v, setV)}
        {note && <p className="xsmall subtle">{note}</p>}
        <SaveBar loading={save.isPending} error={save.error} onSave={() => save.mutate({ key: settingsKey, value: v })} />
      </div>
    </Card>
  );
}

function ProfileSection({ s }: { s: SettingsBundle }) {
  const [p, setP] = useState<Profile>(s.profile);
  const [errors, setErrors] = useState<Errors>({});
  const save = useSaveSetting();
  const policy = agePolicy(p.birthday, new Date().toISOString().slice(0, 10));
  return (
    <>
      <Card title="Profile">
        <div className="stack-lg">
          <Field label="Name" error={errors.displayName}>{(f) => <Input {...f} value={p.displayName} maxLength={60} onChange={(e) => setP({ ...p, displayName: e.target.value })} style={{ maxWidth: 320 }} />}</Field>
          <ProfileForm value={p} onChange={setP} errors={{ ...errors, ...fieldErrors(save.error) }} policy={policy} />
          <SaveBar loading={save.isPending} error={save.error} onSave={() => { const e = validate(SETTINGS_SCHEMAS.profile, p); setErrors(e); if (!Object.keys(e).length) save.mutate({ key: 'profile', value: p }); }} />
        </div>
      </Card>
    </>
  );
}

function AreasSection({ s, goals }: { s: SettingsBundle; goals: Goal[] }) {
  const [modules, setModules] = useState<ModuleId[]>(s.profile.modules);
  const [g, setG] = useState<GoalDraft[]>(goals.map(({ id: _id, ...rest }) => rest));
  const qc = useQueryClient();
  const toast = useToast();
  const policy = agePolicy(s.profile.birthday, new Date().toISOString().slice(0, 10));
  const save = useMutation({
    mutationFn: async () => {
      if (!modules.length) throw new Error('Choose at least one area.');
      // Newly enabled areas start with sensible defaults you can refine in their section.
      for (const m of modules) {
        for (const key of MODULE_KEYS[m]) if (!s[key as keyof SettingsBundle]) await api.put(`/settings/${key}`, MODULE_DEFAULTS[key]);
      }
      await api.put('/settings/profile', { ...s.profile, modules });
      await api.put('/goals', z.array(GoalSchema.omit({ id: true })).parse(g.filter((x) => modules.includes(x.module))));
    },
    onSuccess: () => {
      qc.invalidateQueries();
      toast({ message: 'Saved. New areas start with default preferences — refine them in their section.' });
    },
  });
  return (
    <>
      <Card title="Areas">
        <div className="stack">
          <ModulesPicker value={modules} onChange={setModules} />
          <p className="xsmall subtle">Turning an area off hides it and stops planning it. Its saved preferences are kept until you delete your data.</p>
        </div>
      </Card>
      <Card title="Goals">
        <GoalsForm modules={modules} value={g} onChange={setG} policy={policy} />
      </Card>
      <SaveBar loading={save.isPending} error={save.error} onSave={() => save.mutate()} />
    </>
  );
}

function ScheduleSection({ s }: { s: SettingsBundle }) {
  const [v, setV] = useState<Schedule>(s.schedule);
  const [errors, setErrors] = useState<Errors>({});
  const save = useSaveSetting();
  return (
    <>
      <Card title="Routine">
        <div className="stack-lg">
          <Chips label="Right now I’m…" value={v.lifeStage} onChange={(x) => setV({ ...v, lifeStage: x as Schedule['lifeStage'] })} options={[{ value: 'student', label: 'A student' }, { value: 'working', label: 'Working' }, { value: 'both', label: 'Both' }, { value: 'neither', label: 'Neither' }]} />
          <ScheduleForm value={v} onChange={setV} errors={errors} />
          <SaveBar loading={save.isPending} error={save.error} onSave={() => { const e = validate(SETTINGS_SCHEMAS.schedule, v); setErrors(e); if (!Object.keys(e).length) save.mutate({ key: 'schedule', value: v }); }} />
        </div>
      </Card>
      <CommitmentsSection />
    </>
  );
}

function CommitmentsSection() {
  const q = useQuery({ queryKey: ['commitments'], queryFn: () => api.get<{ commitments: Commitment[] }>('/commitments') });
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const [editing, setEditing] = useState<{ id: string | null; value: CommitmentInput } | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const done = (msg: string) => {
    qc.invalidateQueries();
    toast({ message: msg, action: { label: 'Review plan', run: () => navigate('/plan') } });
  };
  const save = useMutation({
    mutationFn: (e: { id: string | null; value: CommitmentInput }) => (e.id ? api.put(`/commitments/${e.id}`, e.value) : api.post('/commitments', e.value)),
    onSuccess: () => { setEditing(null); done('Commitment saved. Your plan will offer to adapt.'); },
    onError: (e) => setErrors(fieldErrors(e)),
  });
  const del = useMutation({ mutationFn: (id: string) => api.del(`/commitments/${id}`), onSuccess: () => done('Commitment removed.') });
  return (
    <Card title="Fixed commitments" action={<Button size="sm" icon={Plus} onClick={() => { setErrors({}); setEditing({ id: null, value: emptyCommitment() }); }}>Add</Button>} pad={false}>
      {q.isPending ? <div className="card-body"><span className="small muted">Loading…</span></div> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : q.data.commitments.length === 0 ? (
        <p className="card-body small muted">No commitments. Add school, work, practices or anything else that can’t move.</p>
      ) : (
        <ul style={{ listStyle: 'none' }}>
          {q.data.commitments.map((c) => (
            <li key={c.id} className="list-row">
              <div className="grow">
                <div className="small strong truncate">{c.title}</div>
                <div className="xsmall muted">{describeCommitment(c)}</div>
              </div>
              <Button size="sm" variant="ghost" iconOnly icon={Pencil} aria-label={`Edit ${c.title}`} onClick={() => { const { id, exceptions: _x, ...value } = c; setErrors({}); setEditing({ id, value }); }} />
              <Button size="sm" variant="ghost" iconOnly icon={Trash2} aria-label={`Delete ${c.title}`} onClick={() => { if (confirm(`Delete “${c.title}”?`)) del.mutate(c.id); }} />
            </li>
          ))}
        </ul>
      )}
      <Dialog
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Edit commitment' : 'Add commitment'}
        footer={<><Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button><Button variant="primary" loading={save.isPending} onClick={() => { if (!editing) return; const e = validate(CommitmentInput, editing.value); setErrors(e); if (!Object.keys(e).length) save.mutate(editing); }}>Save</Button></>}
      >
        {editing && <CommitmentForm value={editing.value} onChange={(v) => setEditing({ ...editing, value: v })} errors={errors} />}
      </Dialog>
    </Card>
  );
}

function FitnessSection({ s }: { s: SettingsBundle }) {
  const me = useMe();
  const modules = me.data?.profile?.modules ?? [];
  return (
    <>
      <SimpleSection<FitnessPrefs> title="Training setup" settingsKey="fitness" initial={(s.fitness ?? MODULE_DEFAULTS.fitness) as FitnessPrefs} render={(v, on) => <FitnessForm value={v} onChange={on} />} />
      {modules.includes('sports') && <SimpleSection<SportsPrefs> title="Sports" settingsKey="sports" initial={(s.sports ?? MODULE_DEFAULTS.sports) as SportsPrefs} render={(v, on) => <SportsForm value={v} onChange={on} />} />}
    </>
  );
}

function CareSection({ s }: { s: SettingsBundle }) {
  const m = s.profile.modules;
  return (
    <>
      {m.includes('skincare') && <SimpleSection<SkinPrefs> title="Skin" settingsKey="skin" initial={(s.skin ?? MODULE_DEFAULTS.skin) as SkinPrefs} render={(v, on) => <SkinForm value={v} onChange={on} />} />}
      {m.includes('haircare') && <SimpleSection<HairPrefs> title="Hair & grooming" settingsKey="hair" initial={(s.hair ?? MODULE_DEFAULTS.hair) as HairPrefs} render={(v, on) => <HairForm value={v} onChange={on} />} />}
    </>
  );
}

function PrivacySection() {
  const [confirming, setConfirming] = useState(false);
  const [text, setText] = useState('');
  const qc = useQueryClient();
  const navigate = useNavigate();
  const del = useMutation({
    mutationFn: () => api.post('/account/delete', { confirm: text }),
    onSuccess: () => {
      qc.clear();
      navigate('/welcome');
    },
  });
  return (
    <>
      <Card title="What Waypoint stores">
        <ul className="small stack-sm" style={{ paddingLeft: 18 }}>
          <li>Your account email, a salted password hash and your birthday (for age-appropriate plans).</li>
          <li>Only the preferences for the areas you turn on, plus your plan, check-ins, assignments and grades.</li>
          <li>No photos, no school passwords, no location tracking. Nothing is sent to AI providers in this version.</li>
          <li>Demo accounts are deleted automatically after 24 hours. Sign-in sessions expire after 30 days.</li>
        </ul>
      </Card>
      <Card title="Export your data">
        <div className="stack">
          <p className="small muted">Download everything stored in your account as a JSON file.</p>
          <div><a className="btn btn-secondary" href="/api/account/export" download><Download aria-hidden /> Download export</a></div>
        </div>
      </Card>
      <Card title="Delete account">
        <div className="stack">
          <p className="small muted">Permanently deletes your account and every record linked to it. This can’t be undone.</p>
          <div><Button variant="danger" icon={Trash2} onClick={() => setConfirming(true)}>Delete my account</Button></div>
        </div>
      </Card>
      <Dialog open={confirming} onClose={() => setConfirming(false)} title="Delete your account?" description="Type DELETE to confirm. All of your data will be removed immediately." footer={<><Button variant="ghost" onClick={() => setConfirming(false)}>Cancel</Button><Button variant="danger" disabled={text !== 'DELETE'} loading={del.isPending} onClick={() => del.mutate()}>Delete permanently</Button></>}>
        <div className="stack">
          {del.error && <Callout tone="danger">{errorMessage(del.error)}</Callout>}
          <Field label="Confirmation">{(p) => <Input {...p} value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" />}</Field>
        </div>
      </Dialog>
    </>
  );
}

function AboutSection() {
  const rows: [string, string, string][] = [
    ['Planner, Today, Plan, replanning', 'Working', 'Deterministic engine; changes are previewed before applying.'],
    ['Fitness & sports', 'Working', 'Curated exercise library, sourced sport drills and vetted videos, tryout mode, morning check-in that adapts the day’s training, team-schedule import with game-day meals and recovery, and the AI build planner (body photos 18+).'],
    ['School', 'Working', 'Manual entry, grade calculator, .ics import, Canvas by access token, study guides and AI study sets. HAC unsupported.'],
    ['Food & groceries', 'Working', 'Curated recipes with beginner step-by-step guides and timers; nutrition values are rough estimates.'],
    ['Personal care', 'Working', 'Rule-based routines plus the AI product finder (face photos 14+). Product names are examples; no prices or stock.'],
    ['AI features', 'Working', 'Study sets, product finder and build planner send what you choose to Anthropic (or Google Gemini if set up), only after you agree each time. Plan explanations are template-based.'],
    ['Reminders', 'Working', 'Web Push notifications (Chrome, Edge, Firefox; iPhone via Home Screen on the online version) plus the in-app bell.'],
  ];
  return (
    <Card title="What’s in this version" pad={false}>
      <ul style={{ listStyle: 'none' }}>
        {rows.map(([a, st, n]) => (
          <li key={a} className="list-row" style={{ alignItems: 'flex-start' }}>
            <div className="grow">
              <div className="small strong">{a}</div>
              <div className="xsmall muted">{n}</div>
            </div>
            <span className={`badge ${st === 'Working' ? 'badge-success' : 'badge-info'}`}>{st}</span>
          </li>
        ))}
      </ul>
      <div className="card-footer small"><Link to="/terms">Terms of use</Link></div>
    </Card>
  );
}
