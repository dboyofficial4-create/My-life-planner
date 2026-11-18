import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Calculator, Check, FileUp, GraduationCap, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { useState, type ChangeEvent } from 'react';
import { Link } from 'react-router';
import { clsx } from 'clsx';
import { ASSIGNMENT_TYPES, AssignmentInput, type AssignmentInput as AssignmentForm } from '@shared/schemas';
import type { CurrentGrade, NeededResult } from '@shared/domain/school/grades';
import { api, errorMessage, fieldErrors } from '@/lib/api';
import { dayLabel, relativeDay } from '@/lib/format';
import { Dialog, useToast } from '@/ui/overlay';
import { Badge, Button, Callout, Card, EmptyState, ErrorState, Field, Input, NumberInput, PageHeader, PageSkeleton, Select, Switch, Tabs, Textarea } from '@/ui/primitives';
import { validate, type Errors } from '@/features/forms/forms';
import { IntegrationsList } from '@/features/settings/Integrations';

interface Assignment {
  id: string;
  courseId: string | null;
  courseName: string | null;
  title: string;
  type: AssignmentForm['type'];
  dueDate: string;
  estimatedMinutes: number;
  completedMinutes: number;
  status: 'open' | 'done';
  notes: string;
  source: string;
  updatedAt: string;
  steps: { name: string; minutes: number }[];
}
interface Course {
  id: string;
  name: string;
  difficulty: number;
  targetGrade: number | null;
  source: string;
  updatedAt: string;
  externalGrade: number | null;
  externalGradeAt: string | null;
  categories: { id: string; name: string; weight: number; confirmed: boolean; source: string }[];
  entries: { id: string; categoryId: string; title: string; pointsEarned: number | null; pointsPossible: number; source: string; updatedAt: string }[];
  grade: CurrentGrade;
}
interface SchoolData {
  today: string;
  courses: Course[];
  assignments: Assignment[];
}

type Tab = 'assignments' | 'study' | 'courses' | 'connections';

function SourceTag({ source }: { source: string }) {
  if (source.startsWith('import')) return <Badge tone="info" outline>Imported</Badge>;
  if (source === 'canvas') return <Badge tone="info" outline>From Canvas</Badge>;
  return <span className="source">You entered</span>;
}

export default function SchoolPage() {
  const q = useQuery({ queryKey: ['school'], queryFn: () => api.get<SchoolData>('/school') });
  const [tab, setTab] = useState<Tab>('assignments');
  const [editing, setEditing] = useState<{ id: string | null; value: AssignmentForm } | null>(null);
  const [importing, setImporting] = useState(false);
  if (q.isPending) return <PageSkeleton />;
  if (q.error) return <div className="page"><ErrorState error={q.error} onRetry={() => q.refetch()} /></div>;
  const d = q.data;
  const newAssignment = () => setEditing({ id: null, value: { courseId: d.courses[0]?.id ?? null, title: '', type: 'homework', dueDate: d.today, estimatedMinutes: 45, notes: '' } });

  return (
    <div className="page">
      <PageHeader
        title="School"
        description="Deadlines, study time and grades in one place. Study sessions are scheduled automatically before each due date."
        actions={
          <>
            <Button size="sm" icon={Upload} onClick={() => setImporting(true)}>Import calendar file</Button>
            <Button size="sm" variant="primary" icon={Plus} onClick={newAssignment}>Add assignment</Button>
          </>
        }
      />
      <Tabs label="School sections" value={tab} onChange={setTab} tabs={[{ value: 'assignments', label: 'Assignments' }, { value: 'study', label: 'Study' }, { value: 'courses', label: 'Courses & grades' }, { value: 'connections', label: 'Connections' }]} />
      {tab === 'assignments' && <AssignmentsList d={d} onEdit={(a) => setEditing({ id: a.id, value: { courseId: a.courseId, title: a.title, type: a.type, dueDate: a.dueDate, estimatedMinutes: a.estimatedMinutes, notes: a.notes } })} onAdd={newAssignment} />}
      {tab === 'study' && <StudyOverview d={d} />}
      {tab === 'courses' && <Courses d={d} />}
      {tab === 'connections' && <IntegrationsList module="school" />}
      <AssignmentDialog editing={editing} courses={d.courses} onClose={() => setEditing(null)} />
      <ImportDialog open={importing} onClose={() => setImporting(false)} />
    </div>
  );
}

function useInvalidateSchool() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['school'] });
    qc.invalidateQueries({ queryKey: ['today'] });
    qc.invalidateQueries({ queryKey: ['plan'] });
  };
}

function AssignmentsList({ d, onEdit, onAdd }: { d: SchoolData; onEdit: (a: Assignment) => void; onAdd: () => void }) {
  const invalidate = useInvalidateSchool();
  const toast = useToast();
  const status = useMutation({ mutationFn: ({ id, s }: { id: string; s: 'open' | 'done' }) => api.patch(`/school/assignments/${id}/status`, { status: s }), onSuccess: invalidate, onError: (e) => toast({ message: errorMessage(e), tone: 'error' }) });
  const del = useMutation({ mutationFn: (id: string) => api.del(`/school/assignments/${id}`), onSuccess: () => { invalidate(); toast({ message: 'Assignment deleted.' }); } });
  const [showDone, setShowDone] = useState(false);
  if (!d.assignments.length) {
    return <Card><EmptyState icon={BookOpen} title="No assignments yet" action={<Button variant="primary" icon={Plus} onClick={onAdd}>Add assignment</Button>}>Add homework, tests and projects — or import a calendar file — and study time is planned automatically.</EmptyState></Card>;
  }
  const weekEnd = new Date(new Date(`${d.today}T00:00:00Z`).getTime() + 7 * 86_400_000).toISOString().slice(0, 10);
  const open = d.assignments.filter((a) => a.status === 'open');
  const groups = [
    { label: 'Past due', items: open.filter((a) => a.dueDate < d.today) },
    { label: 'Next 7 days', items: open.filter((a) => a.dueDate >= d.today && a.dueDate <= weekEnd) },
    { label: 'Later', items: open.filter((a) => a.dueDate > weekEnd) },
  ].filter((g) => g.items.length);
  const done = d.assignments.filter((a) => a.status === 'done');
  const row = (a: Assignment) => (
    <li key={a.id} className="list-row" style={{ alignItems: 'flex-start' }}>
      <button className="check" style={{ marginTop: 2 }} data-checked={a.status === 'done'} aria-label={a.status === 'done' ? `Reopen ${a.title}` : `Mark ${a.title} done`} onClick={() => status.mutate({ id: a.id, s: a.status === 'done' ? 'open' : 'done' })}>
        <Check aria-hidden />
      </button>
      <div className="grow stack-sm" style={{ gap: 4 }}>
        <div className="row-wrap">
          <span className={clsx('small strong', a.status === 'done' && 'subtle')} style={{ textDecoration: a.status === 'done' ? 'line-through' : undefined }}>{a.title}</span>
          <Badge outline>{a.type}</Badge>
          <SourceTag source={a.source} />
        </div>
        <div className="xsmall muted">
          {a.courseName ?? 'No course'} · about {a.estimatedMinutes} min{a.completedMinutes > 0 ? ` · ${a.completedMinutes} min done` : ''}
        </div>
        {a.steps.length > 1 && a.status === 'open' && (
          <details className="details">
            <summary className="xsmall">Break it into steps</summary>
            <ol className="xsmall muted" style={{ paddingLeft: 18 }}>{a.steps.map((s) => <li key={s.name}>{s.name} (~{s.minutes} min)</li>)}</ol>
          </details>
        )}
      </div>
      <Badge tone={a.status === 'open' && a.dueDate < d.today ? 'danger' : a.dueDate === d.today ? 'warning' : 'neutral'}>{relativeDay(a.dueDate, d.today)}</Badge>
      {a.status === 'open' && <Link className="btn btn-secondary btn-sm" to={`/school/study?assignmentId=${a.id}`}>Study guide</Link>}
      <Button size="sm" variant="ghost" iconOnly icon={Pencil} aria-label={`Edit ${a.title}`} onClick={() => onEdit(a)} />
      <Button size="sm" variant="ghost" iconOnly icon={Trash2} aria-label={`Delete ${a.title}`} onClick={() => { if (confirm(`Delete “${a.title}”?`)) del.mutate(a.id); }} />
    </li>
  );
  return (
    <div className="stack-lg">
      {groups.map((g) => (
        <Card key={g.label} title={g.label} pad={false}>
          <ul style={{ listStyle: 'none' }}>{g.items.map(row)}</ul>
        </Card>
      ))}
      {done.length > 0 && (
        <div className="stack">
          <Button variant="ghost" size="sm" onClick={() => setShowDone((x) => !x)}>{showDone ? 'Hide' : 'Show'} {done.length} completed</Button>
          {showDone && <Card pad={false}><ul style={{ listStyle: 'none' }}>{done.map(row)}</ul></Card>}
        </div>
      )}
    </div>
  );
}

function AssignmentDialog({ editing, courses, onClose }: { editing: { id: string | null; value: AssignmentForm } | null; courses: Course[]; onClose: () => void }) {
  const [v, setV] = useState<AssignmentForm | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const invalidate = useInvalidateSchool();
  const toast = useToast();
  const value = v ?? editing?.value ?? null;
  const save = useMutation({
    mutationFn: (x: AssignmentForm) => (editing?.id ? api.put(`/school/assignments/${editing.id}`, x) : api.post('/school/assignments', x)),
    onSuccess: () => {
      invalidate();
      toast({ message: editing?.id ? 'Assignment updated. Review your plan to fit the changes.' : 'Assignment added. Your plan will offer to fit study time.' });
      close();
    },
    onError: (e) => setErrors(fieldErrors(e)),
  });
  const close = () => {
    setV(null);
    setErrors({});
    onClose();
  };
  if (!editing || !value) return null;
  const s = <K extends keyof AssignmentForm>(k: K, x: AssignmentForm[K]) => setV({ ...value, [k]: x });
  const submit = () => {
    const e = validate(AssignmentInput, value);
    setErrors(e);
    if (!Object.keys(e).length) save.mutate(value);
  };
  return (
    <Dialog open onClose={close} title={editing.id ? 'Edit assignment' : 'Add assignment'} footer={<><Button variant="ghost" onClick={close}>Cancel</Button><Button variant="primary" loading={save.isPending} onClick={submit}>Save</Button></>}>
      <div className="stack">
        {save.error && !Object.keys(fieldErrors(save.error)).length && <Callout tone="danger">{errorMessage(save.error)}</Callout>}
        <Field label="Title" error={errors.title}>{(p) => <Input {...p} value={value.title} maxLength={140} onChange={(e) => s('title', e.target.value)} />}</Field>
        <div className="grid-2">
          <Field label="Course">
            {(p) => (
              <Select {...p} value={value.courseId ?? ''} onChange={(e) => s('courseId', e.target.value || null)}>
                <option value="">No course</option>
                {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Type">
            {(p) => (
              <Select {...p} value={value.type} onChange={(e) => s('type', e.target.value as AssignmentForm['type'])}>
                {ASSIGNMENT_TYPES.map((t) => <option key={t} value={t}>{t[0]!.toUpperCase() + t.slice(1)}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Due date" error={errors.dueDate}>{(p) => <Input {...p} type="date" value={value.dueDate} onChange={(e) => s('dueDate', e.target.value)} />}</Field>
          <Field label="Estimated time" hint="Total minutes of work" error={errors.estimatedMinutes}>{(p) => <NumberInput {...p} min={10} max={1200} value={value.estimatedMinutes} onChange={(x) => s('estimatedMinutes', x ?? 10)} />}</Field>
        </div>
        <Field label="Notes" optional>{(p) => <Textarea {...p} value={value.notes} maxLength={500} onChange={(e) => s('notes', e.target.value)} />}</Field>
      </div>
    </Dialog>
  );
}

function ImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState('');
  const invalidate = useInvalidateSchool();
  const toast = useToast();
  const preview = useMutation({ mutationFn: (t: string) => api.post<{ events: { uid: string; summary: string; date: string; course: string | null; type: string; duplicate: boolean }[]; skipped: number; past: number; scheduleDays?: number }>('/school/import-ics', { text: t, dryRun: true }) });
  const commit = useMutation({
    mutationFn: () => api.post<{ created: number }>('/school/import-ics', { text, dryRun: false }),
    onSuccess: (r) => {
      invalidate();
      toast({ message: `Imported ${r.created} item${r.created === 1 ? '' : 's'}.` });
      close();
    },
  });
  const close = () => {
    setText('');
    setFileName('');
    preview.reset();
    commit.reset();
    onClose();
  };
  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 400_000) {
      toast({ message: 'That file is too large (max 400 KB).', tone: 'error' });
      return;
    }
    const t = await f.text();
    setFileName(f.name);
    setText(t);
    preview.mutate(t);
  };
  const fresh = preview.data?.events.filter((e) => !e.duplicate) ?? [];
  return (
    <Dialog
      open={open}
      onClose={close}
      wide
      title="Import from a calendar file"
      description="Download your class calendar as an .ics file (in Canvas: Calendar → Calendar Feed), then choose it here. Nothing is imported until you confirm."
      footer={<><Button variant="ghost" onClick={close}>Cancel</Button><Button variant="primary" disabled={!fresh.length} loading={commit.isPending} onClick={() => commit.mutate()}>Import {fresh.length || ''} item{fresh.length === 1 ? '' : 's'}</Button></>}
    >
      <div className="stack">
        <label className="btn btn-secondary" style={{ alignSelf: 'flex-start' }}>
          <FileUp aria-hidden /> {fileName || 'Choose .ics file'}
          <input type="file" accept=".ics,text/calendar" className="sr-only" onChange={onFile} />
        </label>
        <p className="xsmall subtle">The file is read once to find due dates. Grades and weights aren’t in calendar files, so add those manually.</p>
        {preview.isPending && <p className="small muted">Reading file…</p>}
        {preview.error && <Callout tone="danger">{errorMessage(preview.error)}</Callout>}
        {commit.error && <Callout tone="danger">{errorMessage(commit.error)}</Callout>}
        {!!preview.data?.scheduleDays && (
          <p className="xsmall subtle">Skipped {preview.data.scheduleDays} schedule note{preview.data.scheduleDays === 1 ? '' : 's'} (like “A Day”, “B Day” or “No School”) — they aren’t work.</p>
        )}
        {preview.data && (
          preview.data.events.length === 0 ? (
            <Callout tone="info">No upcoming items found in this file{preview.data.past ? ` (${preview.data.past} past items were ignored)` : ''}.</Callout>
          ) : (
            <ul className="card" style={{ listStyle: 'none', maxHeight: 320, overflowY: 'auto' }}>
              {preview.data.events.map((e) => (
                <li key={e.uid} className="list-row">
                  <div className="grow">
                    <div className="small strong truncate">{e.summary}</div>
                    <div className="xsmall subtle">{e.course ?? 'No course'} · guessed type: {e.type}</div>
                  </div>
                  <span className="xsmall">{dayLabel(e.date)}</span>
                  {e.duplicate && <Badge>Already imported</Badge>}
                </li>
              ))}
            </ul>
          )
        )}
      </div>
    </Dialog>
  );
}

/* ---------- Courses & grades ---------- */

function Courses({ d }: { d: SchoolData }) {
  const invalidate = useInvalidateSchool();
  const [name, setName] = useState('');
  const add = useMutation({ mutationFn: () => api.post('/school/courses', { name, difficulty: 3, targetGrade: null }), onSuccess: () => { setName(''); invalidate(); } });
  return (
    <div className="stack-lg">
      {d.courses.length === 0 && <Card><EmptyState icon={GraduationCap} title="No courses yet">Add a course to track grades and plan study by difficulty.</EmptyState></Card>}
      {d.courses.map((c) => <CourseCard key={c.id} c={c} />)}
      <form className="row-wrap" onSubmit={(e) => { e.preventDefault(); if (name.trim()) add.mutate(); }}>
        <Input aria-label="New course name" placeholder="New course name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} style={{ maxWidth: 280 }} />
        <Button type="submit" icon={Plus} loading={add.isPending} disabled={!name.trim()}>Add course</Button>
      </form>
    </div>
  );
}

function CourseCard({ c }: { c: Course }) {
  const invalidate = useInvalidateSchool();
  const toast = useToast();
  const [cat, setCat] = useState({ name: '', weight: 0 as number | null, confirmed: false });
  const [entry, setEntry] = useState({ categoryId: c.categories[0]?.id ?? '', title: '', pointsEarned: null as number | null, pointsPossible: 100 as number | null });
  const [calcOpen, setCalcOpen] = useState(false);
  const onErr = (e: unknown) => toast({ message: errorMessage(e), tone: 'error' });
  const addCat = useMutation({ mutationFn: () => api.post('/school/categories', { courseId: c.id, name: cat.name, weight: cat.weight ?? 0, confirmed: cat.confirmed }), onSuccess: () => { setCat({ name: '', weight: 0, confirmed: false }); invalidate(); }, onError: onErr });
  const delCat = useMutation({ mutationFn: (id: string) => api.del(`/school/categories/${id}`), onSuccess: invalidate });
  const addEntry = useMutation({ mutationFn: () => api.post('/school/grades', { courseId: c.id, categoryId: entry.categoryId || c.categories[0]?.id, title: entry.title, pointsEarned: entry.pointsEarned, pointsPossible: entry.pointsPossible ?? 0 }), onSuccess: () => { setEntry({ ...entry, title: '', pointsEarned: null }); invalidate(); }, onError: onErr });
  const delEntry = useMutation({ mutationFn: (id: string) => api.del(`/school/grades/${id}`), onSuccess: invalidate });
  const delCourse = useMutation({ mutationFn: () => api.del(`/school/courses/${c.id}`), onSuccess: invalidate });
  const g = c.grade;
  return (
    <Card
      title={<span className="row-sm">{c.name}{c.source !== 'manual' && <Badge tone="info" outline>{c.source === 'canvas' ? 'From Canvas' : 'Imported'}</Badge>}</span>}
      action={
        <div className="row-sm">
          {c.externalGrade !== null && <span title={c.externalGradeAt ? `Reported by Canvas, synced ${new Date(c.externalGradeAt).toLocaleString()}` : 'Reported by Canvas'}><Badge tone="info">Canvas {c.externalGrade.toFixed(1)}%</Badge></span>}
          {g.percent !== null && <Badge tone={g.isEstimate ? 'warning' : 'accent'}>{c.externalGrade !== null ? 'Calculated ' : ''}{g.percent.toFixed(1)}%{g.isEstimate ? ' · estimate' : ''}</Badge>}
          <Link className="btn btn-ghost btn-sm" to={`/school/study?courseId=${c.id}`}>Study materials</Link>
          <Button size="sm" variant="ghost" iconOnly icon={Trash2} aria-label={`Delete ${c.name}`} onClick={() => { if (confirm(`Delete ${c.name} and its grades?`)) delCourse.mutate(); }} />
        </div>
      }
    >
      <div className="stack">
        {g.caveats.length > 0 && <Callout tone="warning" title="Why this is an estimate">{g.caveats.map((x) => <div key={x}>{x}</div>)}</Callout>}
        {c.externalGrade !== null && g.percent !== null && Math.abs(c.externalGrade - g.percent) >= 1 && (
          <p className="xsmall subtle">Canvas’s grade can differ from Waypoint’s calculation (e.g. dropped lowest scores, missing-work rules or extra credit). Your teacher’s gradebook is the official record.</p>
        )}
        <div className="stack-sm">
          <div className="eyebrow">Grading categories</div>
          {c.categories.length === 0 ? <p className="small muted">Add the categories and weights from your syllabus (e.g. Tests 50%).</p> : (
            <ul style={{ listStyle: 'none' }} className="stack-sm">
              {g.categories.map((x) => {
                const meta = c.categories.find((y) => y.id === x.id)!;
                return (
                  <li key={x.id} className="row small">
                    <span className="grow">{x.name}</span>
                    <span className="subtle num">{x.weight}%</span>
                    <span className="num" style={{ width: 64, textAlign: 'right' }}>{x.percent === null ? '—' : `${x.percent.toFixed(1)}%`}</span>
                    {meta.source === 'canvas' ? <Badge tone="info">From Canvas</Badge> : meta.confirmed ? <Badge tone="success">Confirmed</Badge> : <Badge>Unconfirmed</Badge>}
                    <Button size="sm" variant="ghost" iconOnly icon={Trash2} aria-label={`Remove ${x.name}`} onClick={() => delCat.mutate(x.id)} />
                  </li>
                );
              })}
            </ul>
          )}
          <form className="row-wrap" onSubmit={(e) => { e.preventDefault(); addCat.mutate(); }}>
            <Input aria-label="Category name" placeholder="Category" value={cat.name} maxLength={60} onChange={(e) => setCat({ ...cat, name: e.target.value })} style={{ maxWidth: 180 }} />
            <div className="input-group" style={{ width: 120 }}>
              <NumberInput aria-label="Weight percent" min={0} max={100} value={cat.weight} onChange={(w) => setCat({ ...cat, weight: w })} />
              <span className="input-suffix">%</span>
            </div>
            <Switch label="From syllabus" checked={cat.confirmed} onChange={(v) => setCat({ ...cat, confirmed: v })} />
            <Button type="submit" size="sm" icon={Plus} disabled={!cat.name.trim()} loading={addCat.isPending}>Add</Button>
          </form>
        </div>
        {c.categories.length > 0 && (
          <div className="stack-sm">
            <div className="eyebrow">Grades</div>
            {c.entries.length > 0 && (
              <ul style={{ listStyle: 'none' }} className="stack-sm">
                {c.entries.map((e) => (
                  <li key={e.id} className="row small">
                    <span className="grow truncate">{e.title}</span>
                    <span className="subtle">{c.categories.find((x) => x.id === e.categoryId)?.name}</span>
                    <span className="num">{e.pointsEarned ?? '—'} / {e.pointsPossible}</span>
                    <SourceTag source={e.source} />
                    <Button size="sm" variant="ghost" iconOnly icon={Trash2} aria-label={`Remove ${e.title}`} onClick={() => delEntry.mutate(e.id)} />
                  </li>
                ))}
              </ul>
            )}
            <form className="row-wrap" onSubmit={(e) => { e.preventDefault(); addEntry.mutate(); }}>
              <Input aria-label="Grade item" placeholder="e.g. Quiz 3" value={entry.title} maxLength={100} onChange={(e) => setEntry({ ...entry, title: e.target.value })} style={{ maxWidth: 160 }} />
              <Select aria-label="Category" value={entry.categoryId || c.categories[0]?.id} onChange={(e) => setEntry({ ...entry, categoryId: e.target.value })} style={{ maxWidth: 150 }}>
                {c.categories.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </Select>
              <NumberInput aria-label="Points earned" placeholder="Score" min={0} value={entry.pointsEarned} onChange={(v) => setEntry({ ...entry, pointsEarned: v })} style={{ width: 90 }} />
              <span className="subtle">/</span>
              <NumberInput aria-label="Points possible" min={1} value={entry.pointsPossible} onChange={(v) => setEntry({ ...entry, pointsPossible: v })} style={{ width: 90 }} />
              <Button type="submit" size="sm" icon={Plus} disabled={!entry.title.trim() || !entry.pointsPossible} loading={addEntry.isPending}>Add</Button>
            </form>
            <div>
              <Button size="sm" icon={Calculator} onClick={() => setCalcOpen(true)}>What do I need?</Button>
            </div>
          </div>
        )}
      </div>
      {calcOpen && <GradeCalculator c={c} onClose={() => setCalcOpen(false)} />}
    </Card>
  );
}

function GradeCalculator({ c, onClose }: { c: Course; onClose: () => void }) {
  const [target, setTarget] = useState<number | null>(c.targetGrade ?? 90);
  const [rows, setRows] = useState([{ categoryId: c.categories[0]!.id, pointsPossible: 100 as number | null }]);
  const calc = useMutation({ mutationFn: () => api.post<NeededResult>('/school/grade-needed', { courseId: c.id, target: target ?? 0, remaining: rows.map((r) => ({ categoryId: r.categoryId, pointsPossible: r.pointsPossible ?? 0 })) }) });
  const r = calc.data;
  return (
    <Dialog open onClose={onClose} title={`What do I need in ${c.name}?`} description="Add the graded work that’s still to come. The result is exact for the weights you entered." footer={<><Button variant="ghost" onClick={onClose}>Close</Button><Button variant="primary" icon={Calculator} loading={calc.isPending} onClick={() => calc.mutate()}>Calculate</Button></>}>
      <div className="stack">
        <Field label="Target final grade">{(p) => <div className="input-group" style={{ maxWidth: 140 }}><NumberInput {...p} min={0} max={110} value={target} onChange={setTarget} /><span className="input-suffix">%</span></div>}</Field>
        <div className="stack-sm">
          <div className="field-label">Remaining work</div>
          {rows.map((row, i) => (
            <div key={i} className="row-wrap">
              <Select aria-label="Category" value={row.categoryId} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, categoryId: e.target.value } : x)))} style={{ maxWidth: 180 }}>
                {c.categories.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </Select>
              <div className="input-group" style={{ width: 150 }}><NumberInput aria-label="Points possible" min={1} value={row.pointsPossible} onChange={(v) => setRows(rows.map((x, j) => (j === i ? { ...x, pointsPossible: v } : x)))} /><span className="input-suffix">pts</span></div>
              {rows.length > 1 && <Button size="sm" variant="ghost" iconOnly icon={Trash2} aria-label="Remove row" onClick={() => setRows(rows.filter((_, j) => j !== i))} />}
            </div>
          ))}
          <div><Button size="sm" variant="ghost" icon={Plus} onClick={() => setRows([...rows, { categoryId: c.categories[0]!.id, pointsPossible: 100 }])}>Add item</Button></div>
        </div>
        {calc.error && <Callout tone="danger">{errorMessage(calc.error)}</Callout>}
        {r && (
          <Callout tone={r.status === 'out_of_reach' ? 'warning' : 'accent'} title={
            r.status === 'ok' ? `You need an average of ${r.requiredPercent}% on the remaining work.` :
            r.status === 'secured' ? 'You’ll reach your target even with zero on the remaining work.' :
            r.status === 'out_of_reach' ? `The highest possible final grade is about ${r.maxPossible}%.` : 'Add some remaining work to calculate.'
          }>
            {r.isEstimate ? <>This is an estimate: {r.caveats.join(' ')}</> : 'Based on confirmed weights. Your teacher’s gradebook is the official record.'}
          </Callout>
        )}
      </div>
    </Dialog>
  );
}

/* ---------- study overview ---------- */

function StudyOverview({ d }: { d: SchoolData }) {
  const q = useQuery({ queryKey: ['study-overview'], queryFn: () => api.get<{ totalDue: number; totalCards: number; courses: { id: string; name: string; materials: number; cards: number; due: number }[] }>('/school/study/overview') });
  const upcoming = d.assignments.filter((a) => a.status === 'open' && a.dueDate >= d.today && ['test', 'exam', 'quiz', 'essay', 'project'].includes(a.type)).slice(0, 6);
  return (
    <div className="stack-lg">
      <Card>
        <div className="row-wrap between">
          <div className="stack-sm" style={{ gap: 2 }}>
            <h2>Flashcards</h2>
            <p className="small muted">{q.data ? (q.data.totalCards ? `${q.data.totalDue} due today across ${q.data.totalCards} cards.` : 'No cards yet — add them from any study guide.') : 'Loading…'}</p>
          </div>
          {!!q.data?.totalDue && <Link className="btn btn-primary" to="/school/review">Review all due cards</Link>}
        </div>
      </Card>
      <Card title="Study guides for what’s coming up" pad={false}>
        {upcoming.length === 0 ? (
          <p className="card-body small muted">No upcoming tests, essays or projects. Add one in Assignments to get a study guide.</p>
        ) : (
          <ul style={{ listStyle: 'none' }}>
            {upcoming.map((a) => (
              <li key={a.id} className="list-row">
                <div className="grow">
                  <div className="small strong truncate">{a.title}</div>
                  <div className="xsmall subtle">{a.courseName ?? 'No course'} · {a.type}</div>
                </div>
                <Badge>{relativeDay(a.dueDate, d.today)}</Badge>
                <Link className="btn btn-secondary btn-sm" to={`/school/study?assignmentId=${a.id}`}>Open guide</Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title="Course materials" pad={false}>
        {!q.data ? <p className="card-body small muted">Loading…</p> : q.data.courses.length === 0 ? (
          <p className="card-body small muted">Add a course to keep notes, links and flashcards for it.</p>
        ) : (
          <ul style={{ listStyle: 'none' }}>
            {q.data.courses.map((co) => (
              <li key={co.id} className="list-row">
                <div className="grow">
                  <div className="small strong">{co.name}</div>
                  <div className="xsmall subtle">{co.materials} note{co.materials === 1 ? '' : 's'}/link{co.materials === 1 ? '' : 's'} · {co.cards} card{co.cards === 1 ? '' : 's'}{co.due ? ` · ${co.due} due` : ''}</div>
                </div>
                {co.due > 0 && <Link className="btn btn-ghost btn-sm" to={`/school/review?courseId=${co.id}`}>Review</Link>}
                <Link className="btn btn-secondary btn-sm" to={`/school/study?courseId=${co.id}`}>Open</Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
