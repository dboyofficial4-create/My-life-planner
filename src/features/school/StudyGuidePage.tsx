import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router';
import { ArrowLeft, BookOpen, Brain, CalendarClock, ExternalLink, FileUp, Layers, Lightbulb, Link2, ListChecks, Pencil, Plus, Sparkles, StickyNote, Trash2 } from 'lucide-react';
import { useState, type ChangeEvent } from 'react';
import { cardsFromNotes, topicsFromNotes, type CardDraft, type MethodId, type StudyMethod, type StudySource } from '@shared/domain/school/studyguide';
import { api, errorMessage, fieldErrors } from '@/lib/api';
import { dayLabel, relativeDay, relativeDayInline, timeRange } from '@/lib/format';
import { Dialog, useToast } from '@/ui/overlay';
import { Badge, Button, Callout, Card, EmptyState, ErrorState, Field, Input, PageHeader, PageSkeleton, Segmented, Textarea } from '@/ui/primitives';

interface Material { id: string; courseId: string | null; assignmentId: string | null; kind: 'notes' | 'link'; title: string; body: string; url: string | null; updatedAt: string }
interface Guide {
  today: string;
  clock: '12h' | '24h';
  scope: { courseId: string | null; assignmentId: string | null };
  course: { id: string; name: string } | null;
  assignment: null | { id: string; title: string; type: string; dueDate: string; daysLeft: number; isTest: boolean; status: string };
  steps: { name: string; minutes: number; methods: MethodId[] }[];
  sessions: { id: string; date: string; start: number; end: number; status: string }[];
  topics: { id: string; title: string; confidence: number }[];
  materials: Material[];
  cards: { total: number; due: number; mastered: number };
  next: { title: string; detail: string; method: MethodId }[];
  methods: StudyMethod[];
  sources: Record<string, StudySource>;
  lowUtilityNote: string;
}

const CONFIDENCE = [
  { value: '0', label: 'Not yet' },
  { value: '1', label: 'Shaky' },
  { value: '2', label: 'Got it' },
] as const;

export function reviewLink(scope: { courseId: string | null; assignmentId: string | null }) {
  return scope.assignmentId ? `/school/review?assignmentId=${scope.assignmentId}` : scope.courseId ? `/school/review?courseId=${scope.courseId}` : '/school/review';
}

export default function StudyGuidePage() {
  const [params] = useSearchParams();
  const assignmentId = params.get('assignmentId');
  const courseId = params.get('courseId');
  const qs = assignmentId ? `assignmentId=${assignmentId}` : `courseId=${courseId ?? ''}`;
  const q = useQuery({ queryKey: ['study-guide', qs], queryFn: () => api.get<Guide>(`/school/study/guide?${qs}`) });
  if (q.isPending) return <PageSkeleton />;
  if (q.error) return <div className="page"><ErrorState error={q.error} onRetry={() => q.refetch()} /></div>;
  return <GuideView g={q.data} qs={qs} />;
}

function useRefresh() {
  const qc = useQueryClient();
  return () => {
    for (const k of ['study-guide', 'study-overview', 'school', 'plan']) qc.invalidateQueries({ queryKey: [k] });
  };
}

function GuideView({ g, qs }: { g: Guide; qs: string }) {
  const a = g.assignment;
  const methodName = (id: MethodId) => g.methods.find((m) => m.id === id)?.name ?? id;
  const title = a ? `Study guide: ${a.title}` : `${g.course?.name ?? 'Course'} — study materials`;
  return (
    <div className="page">
      <Link to="/school" className="small row-sm" style={{ display: 'inline-flex' }}><ArrowLeft aria-hidden style={{ width: 14 }} /> School</Link>
      <PageHeader
        title={title}
        description={a ? `${g.course?.name ?? 'No course'} · ${a.type} · due ${relativeDayInline(a.dueDate, g.today)} (${dayLabel(a.dueDate, { weekday: 'short', month: 'short', day: 'numeric' })})` : 'Notes, links, topics and flashcards for the whole course.'}
        actions={
          <Link to={reviewLink(g.scope)} className={`btn ${g.cards.due ? 'btn-primary' : 'btn-secondary'}`}>
            <Layers aria-hidden /> {g.cards.due ? `Review ${g.cards.due} due card${g.cards.due === 1 ? '' : 's'}` : 'Practise flashcards'}
          </Link>
        }
      />
      {a && a.daysLeft < 0 && a.status === 'open' && <Callout tone="warning">This was due {Math.abs(a.daysLeft)} day{a.daysLeft === -1 ? '' : 's'} ago. Update the due date in School if it moved.</Callout>}

      <Card title={<span className="row-sm"><Lightbulb aria-hidden style={{ width: 16, color: 'var(--accent-text)' }} /> What to do next</span>}>
        <ol className="stack" style={{ listStyle: 'none' }}>
          {g.next.map((n, i) => (
            <li key={n.title} className="row" style={{ alignItems: 'flex-start' }}>
              <span className="step-num">{i + 1}</span>
              <div className="stack-sm grow" style={{ gap: 2 }}>
                <span className="strong small">{n.title}</span>
                <span className="small muted">{n.detail}</span>
                <span className="xsmall subtle">Method: {methodName(n.method)}</span>
              </div>
            </li>
          ))}
        </ol>
      </Card>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <Topics g={g} />
        <div className="stack-lg">
          {a && (
            <Card title={<span className="row-sm"><CalendarClock aria-hidden style={{ width: 16 }} /> Your study sessions</span>} action={<Link to="/plan" className="small">Plan</Link>} pad={false}>
              {g.sessions.length === 0 ? (
                <p className="card-body small muted">No sessions planned yet. If you just added this, open Plan and review changes to schedule them.</p>
              ) : (
                <ul style={{ listStyle: 'none' }}>
                  {g.sessions.map((s, i) => (
                    <li key={s.id} className="list-row small">
                      <span className="grow">{relativeDay(s.date, g.today)} · {timeRange(s.start, s.end, g.clock)}</span>
                      <span className="xsmall subtle truncate" style={{ maxWidth: 200 }}>{g.steps[Math.min(i, g.steps.length - 1)]?.name}</span>
                      {s.status === 'done' && <Badge tone="success">Done</Badge>}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
          {g.steps.length > 1 && (
            <Card title={<span className="row-sm"><ListChecks aria-hidden style={{ width: 16 }} /> Step by step</span>}>
              <ol className="stack-sm" style={{ paddingLeft: 18 }}>
                {g.steps.map((s) => (
                  <li key={s.name} className="small">
                    <span className="strong">{s.name}</span> <span className="subtle">(~{s.minutes} min)</span>
                    <div className="xsmall muted">Try: {s.methods.map(methodName).join(' · ')}</div>
                  </li>
                ))}
              </ol>
            </Card>
          )}
        </div>
      </div>

      <Materials g={g} />
      <Flashcards g={g} qs={qs} />
      <Methods g={g} />
    </div>
  );
}

/* ---------- topics ---------- */

function Topics({ g }: { g: Guide }) {
  const refresh = useRefresh();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const add = useMutation({
    mutationFn: (titles: string[]) => api.post<{ created: number }>('/school/study/topics', { ...g.scope, titles }),
    onSuccess: (r) => {
      setTitle('');
      refresh();
      if (r.created === 0) toast({ message: 'Those topics are already on the list.' });
    },
    onError: (e) => toast({ message: errorMessage(e), tone: 'error' }),
  });
  const rate = useMutation({ mutationFn: ({ id, confidence }: { id: string; confidence: number }) => api.patch(`/school/study/topics/${id}`, { confidence }), onSuccess: refresh });
  const del = useMutation({ mutationFn: (id: string) => api.del(`/school/study/topics/${id}`), onSuccess: refresh });
  const suggestions = g.materials.filter((m) => m.kind === 'notes').flatMap((m) => topicsFromNotes(m.body)).filter((t) => !g.topics.some((x) => x.title.toLowerCase() === t.toLowerCase()));
  const got = g.topics.filter((t) => t.confidence === 2).length;
  return (
    <Card title={<span className="row-sm"><Brain aria-hidden style={{ width: 16 }} /> Topics</span>} action={g.topics.length ? <span className="xsmall subtle">{got} of {g.topics.length} confident</span> : undefined}>
      <div className="stack">
        {g.topics.length === 0 ? (
          <p className="small muted">List what this covers — check the syllabus, the study sheet or ask your teacher. Then rate each one honestly.</p>
        ) : (
          <ul className="stack-sm" style={{ listStyle: 'none' }}>
            {g.topics.map((t) => (
              <li key={t.id} className="row-wrap between" style={{ gap: 'var(--s-2)' }}>
                <span className="small grow truncate" style={{ minWidth: 120 }}>{t.title}</span>
                <div className="row-sm">
                  <Segmented label={`How well you know ${t.title}`} value={String(t.confidence) as '0' | '1' | '2'} onChange={(v) => rate.mutate({ id: t.id, confidence: Number(v) })} options={CONFIDENCE.map((c) => ({ value: c.value, label: c.label }))} />
                  <Button size="sm" variant="ghost" iconOnly icon={Trash2} aria-label={`Remove ${t.title}`} onClick={() => del.mutate(t.id)} />
                </div>
              </li>
            ))}
          </ul>
        )}
        <form className="row-sm" onSubmit={(e) => { e.preventDefault(); if (title.trim()) add.mutate(title.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean)); }}>
          <Input aria-label="New topic" placeholder="Add topics (separate with commas)" value={title} maxLength={400} onChange={(e) => setTitle(e.target.value)} />
          <Button type="submit" icon={Plus} loading={add.isPending} disabled={!title.trim()}>Add</Button>
        </form>
        {suggestions.length > 0 && (
          <div className="row-wrap">
            <span className="xsmall subtle">From your notes’ headings:</span>
            <Button size="sm" variant="ghost" icon={Sparkles} onClick={() => add.mutate(suggestions.slice(0, 30))}>Add {suggestions.length} topic{suggestions.length === 1 ? '' : 's'}</Button>
          </div>
        )}
      </div>
    </Card>
  );
}

/* ---------- materials ---------- */

function Materials({ g }: { g: Guide }) {
  const refresh = useRefresh();
  const toast = useToast();
  const [editing, setEditing] = useState<null | { id: string | null; kind: 'notes' | 'link'; title: string; body: string; url: string; courseWide: boolean }>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [cardsFrom, setCardsFrom] = useState<Material | null>(null);
  const save = useMutation({
    mutationFn: () => {
      const e = editing!;
      const payload = { title: e.title, body: e.body, url: e.kind === 'link' ? e.url : null };
      if (e.id) return api.put(`/school/study/materials/${e.id}`, payload);
      const scope = e.courseWide && g.course ? { courseId: g.course.id, assignmentId: null } : g.scope;
      return api.post('/school/study/materials', { ...scope, kind: e.kind, ...payload });
    },
    onSuccess: () => {
      setEditing(null);
      refresh();
      toast({ message: 'Saved.' });
    },
  });
  const del = useMutation({ mutationFn: (id: string) => api.del(`/school/study/materials/${id}`), onSuccess: refresh });
  const f = fieldErrors(save.error);
  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !editing) return;
    if (file.size > 200_000) return toast({ message: 'That file is too large (max 200 KB of text).', tone: 'error' });
    if (!/\.(txt|md|markdown|csv)$/i.test(file.name) && !file.type.startsWith('text/')) return toast({ message: 'Choose a plain-text file (.txt or .md). For Word or PDF, copy the text and paste it.', tone: 'error' });
    const text = await file.text();
    setEditing({ ...editing, body: editing.body ? `${editing.body}\n\n${text}` : text, title: editing.title || file.name.replace(/\.[^.]+$/, '') });
  };
  const newItem = (kind: 'notes' | 'link') => {
    save.reset();
    setEditing({ id: null, kind, title: '', body: '', url: '', courseWide: false });
  };
  return (
    <Card
      title={<span className="row-sm"><BookOpen aria-hidden style={{ width: 16 }} /> Your review material</span>}
      action={<div className="row-sm"><Button size="sm" icon={StickyNote} onClick={() => newItem('notes')}>Add notes</Button><Button size="sm" icon={Link2} onClick={() => newItem('link')}>Add link</Button></div>}
      pad={false}
    >
      {g.materials.length === 0 ? (
        <EmptyState icon={StickyNote} title="Nothing added yet">Paste class notes or a teacher’s study guide, or save links to review sites and videos. Lines like “term: definition” can become flashcards.</EmptyState>
      ) : (
        <ul style={{ listStyle: 'none' }}>
          {g.materials.map((m) => (
            <li key={m.id} className="list-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 'var(--s-2)' }}>
              <div className="row">
                {m.kind === 'link' ? <Link2 aria-hidden style={{ width: 16, color: 'var(--text-3)' }} /> : <StickyNote aria-hidden style={{ width: 16, color: 'var(--text-3)' }} />}
                <div className="grow">
                  {m.kind === 'link' ? (
                    <a href={m.url!} target="_blank" rel="noopener noreferrer nofollow" className="small strong row-sm" style={{ display: 'inline-flex' }}>{m.title} <ExternalLink aria-hidden style={{ width: 12 }} /></a>
                  ) : (
                    <button className="link-button small strong" onClick={() => setOpen(open === m.id ? null : m.id)} aria-expanded={open === m.id}>{m.title}</button>
                  )}
                  <div className="xsmall subtle">
                    {m.kind === 'link' ? new URL(m.url!).hostname : `${m.body.length.toLocaleString()} characters`}
                    {g.assignment && !m.assignmentId ? ' · course-wide' : ''}
                  </div>
                </div>
                {m.kind === 'notes' && <Button size="sm" variant="ghost" icon={Layers} onClick={() => setCardsFrom(m)}>Make cards</Button>}
                <Button size="sm" variant="ghost" iconOnly icon={Pencil} aria-label={`Edit ${m.title}`} onClick={() => { save.reset(); setEditing({ id: m.id, kind: m.kind, title: m.title, body: m.body, url: m.url ?? '', courseWide: !m.assignmentId }); }} />
                <Button size="sm" variant="ghost" iconOnly icon={Trash2} aria-label={`Delete ${m.title}`} onClick={() => { if (confirm(`Delete “${m.title}”?`)) del.mutate(m.id); }} />
              </div>
              {open === m.id && m.kind === 'notes' && <div className="notes-body small">{m.body}</div>}
            </li>
          ))}
        </ul>
      )}
      <Dialog
        open={!!editing}
        wide={editing?.kind === 'notes'}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Edit' : editing?.kind === 'link' ? 'Add a link' : 'Add notes'}
        description={editing?.kind === 'link' ? 'Review sites, videos, practice tests, your teacher’s pages.' : 'Type, paste, or import a text file. Use “# Heading” lines for topics and “term: definition” lines for flashcards.'}
        footer={<><Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button><Button variant="primary" loading={save.isPending} onClick={() => save.mutate()}>Save</Button></>}
      >
        {editing && (
          <div className="stack">
            {save.error && !Object.keys(f).length && <Callout tone="danger">{errorMessage(save.error)}</Callout>}
            <Field label="Title" error={f.title}>{(p) => <Input {...p} value={editing.title} maxLength={140} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder={editing.kind === 'link' ? 'e.g. Khan Academy — cell structure' : 'e.g. Chapter 4 notes'} />}</Field>
            {editing.kind === 'link' ? (
              <Field label="Link" error={f.url}>{(p) => <Input {...p} type="url" inputMode="url" value={editing.url} onChange={(e) => setEditing({ ...editing, url: e.target.value })} placeholder="https://" />}</Field>
            ) : (
              <>
                <Field label="Notes" error={f.body}>{(p) => <Textarea {...p} value={editing.body} maxLength={50_000} rows={14} onChange={(e) => setEditing({ ...editing, body: e.target.value })} placeholder={'# Cell structure\nMitochondria: makes energy (ATP)\nRibosome - builds proteins\n\nQ: What does the nucleus contain?\nA: DNA'} />}</Field>
                <label className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }}>
                  <FileUp aria-hidden /> Import text file
                  <input type="file" accept=".txt,.md,.markdown,.csv,text/plain,text/markdown" className="sr-only" onChange={onFile} />
                </label>
              </>
            )}
            {!editing.id && g.assignment && g.course && (
              <label className="checkbox small"><input type="checkbox" checked={editing.courseWide} onChange={(e) => setEditing({ ...editing, courseWide: e.target.checked })} /> Use for every {g.course.name} test, not just this one</label>
            )}
          </div>
        )}
      </Dialog>
      {cardsFrom && <CardsFromNotes g={g} material={cardsFrom} onClose={() => setCardsFrom(null)} />}
    </Card>
  );
}

function CardsFromNotes({ g, material, onClose }: { g: Guide; material: Material; onClose: () => void }) {
  const drafts = cardsFromNotes(material.body);
  const [picked, setPicked] = useState<Set<number>>(new Set(drafts.map((_, i) => i)));
  const refresh = useRefresh();
  const toast = useToast();
  const create = useMutation({
    mutationFn: (cards: CardDraft[]) => api.post<{ created: number; skippedDuplicates: number }>('/school/study/cards', { ...g.scope, cards }),
    onSuccess: (r) => {
      refresh();
      toast({ message: `Added ${r.created} card${r.created === 1 ? '' : 's'}${r.skippedDuplicates ? ` (${r.skippedDuplicates} already existed)` : ''}.` });
      onClose();
    },
    onError: (e) => toast({ message: errorMessage(e), tone: 'error' }),
  });
  const chosen = drafts.filter((_, i) => picked.has(i));
  return (
    <Dialog open wide onClose={onClose} title={`Flashcards from “${material.title}”`} description="Found from lines like “term: definition”, “term - definition” and Q:/A: pairs. Untick any you don’t want."
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!chosen.length} loading={create.isPending} onClick={() => create.mutate(chosen)}>Add {chosen.length} card{chosen.length === 1 ? '' : 's'}</Button></>}>
      {drafts.length === 0 ? (
        <Callout tone="info">No term/definition lines found. Write lines like <span className="strong">Photosynthesis: how plants turn light into energy</span>, or add cards one at a time below the notes.</Callout>
      ) : (
        <ul className="card" style={{ listStyle: 'none', maxHeight: 380, overflowY: 'auto' }}>
          {drafts.map((d, i) => (
            <li key={i} className="list-row">
              <label className="checkbox grow" style={{ alignItems: 'flex-start' }}>
                <input type="checkbox" checked={picked.has(i)} onChange={(e) => { const n = new Set(picked); if (e.target.checked) n.add(i); else n.delete(i); setPicked(n); }} />
                <span><span className="small strong">{d.front}</span><span className="small muted" style={{ display: 'block' }}>{d.back}</span></span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}

/* ---------- flashcards ---------- */

interface CardRow { id: string; front: string; back: string; box: number; dueDate: string; correct: number; wrong: number }

function Flashcards({ g, qs }: { g: Guide; qs: string }) {
  const refresh = useRefresh();
  const toast = useToast();
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [showAll, setShowAll] = useState(false);
  const list = useQuery({ queryKey: ['study-cards', qs], queryFn: () => api.get<{ cards: CardRow[] }>(`/school/study/cards?${qs}`), enabled: showAll });
  const add = useMutation({
    mutationFn: () => api.post<{ created: number }>('/school/study/cards', { ...g.scope, cards: [{ front, back }] }),
    onSuccess: (r) => {
      setFront('');
      setBack('');
      refresh();
      list.refetch();
      if (!r.created) toast({ message: 'A card with that front already exists.' });
    },
    onError: (e) => toast({ message: errorMessage(e), tone: 'error' }),
  });
  const del = useMutation({ mutationFn: (id: string) => api.del(`/school/study/cards/${id}`), onSuccess: () => { refresh(); list.refetch(); } });
  return (
    <Card title={<span className="row-sm"><Layers aria-hidden style={{ width: 16 }} /> Flashcards</span>} action={<span className="xsmall subtle">{g.cards.total} total · {g.cards.due} due · {g.cards.mastered} well known</span>}>
      <div className="stack">
        <form className="grid-2" onSubmit={(e) => { e.preventDefault(); add.mutate(); }} style={{ alignItems: 'end' }}>
          <Field label="Front (question or term)">{(p) => <Input {...p} value={front} maxLength={500} onChange={(e) => setFront(e.target.value)} />}</Field>
          <Field label="Back (answer)">{(p) => <Input {...p} value={back} maxLength={2000} onChange={(e) => setBack(e.target.value)} />}</Field>
          <div><Button type="submit" icon={Plus} disabled={!front.trim() || !back.trim()} loading={add.isPending}>Add card</Button></div>
        </form>
        <p className="xsmall subtle">Cards you get right come back after 2, 4, 7, then 14 days; cards you miss come back tomorrow.</p>
        {g.cards.total > 0 && (
          <div>
            <Button size="sm" variant="ghost" onClick={() => setShowAll((x) => !x)}>{showAll ? 'Hide cards' : `Show all ${g.cards.total} cards`}</Button>
          </div>
        )}
        {showAll && list.data && (
          <ul className="card" style={{ listStyle: 'none', maxHeight: 400, overflowY: 'auto' }}>
            {list.data.cards.map((c) => (
              <li key={c.id} className="list-row" style={{ alignItems: 'flex-start' }}>
                <div className="grow">
                  <div className="small strong">{c.front}</div>
                  <div className="small muted">{c.back}</div>
                </div>
                <span className="xsmall subtle" style={{ whiteSpace: 'nowrap' }}>{c.dueDate <= g.today ? 'Due' : `Next ${relativeDayInline(c.dueDate, g.today)}`}</span>
                <Button size="sm" variant="ghost" iconOnly icon={Trash2} aria-label="Delete card" onClick={() => del.mutate(c.id)} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

/* ---------- methods ---------- */

function Methods({ g }: { g: Guide }) {
  return (
    <Card title="How to study (what the research says)" quiet>
      <div className="stack">
        <div className="grid-2">
          {g.methods.map((m) => (
            <div key={m.id} className="stack-sm" style={{ gap: 4 }}>
              <div className="row-sm"><span className="strong small">{m.name}</span><Badge tone={m.evidence === 'high' ? 'success' : 'info'}>{m.evidence === 'high' ? 'Strong evidence' : 'Moderate evidence'}</Badge></div>
              <p className="small muted">{m.what}</p>
              <ul className="xsmall" style={{ paddingLeft: 18 }}>{m.how.map((h) => <li key={h}>{h}</li>)}</ul>
            </div>
          ))}
        </div>
        <Callout tone="neutral">{g.lowUtilityNote}</Callout>
        <p className="xsmall subtle">
          Sources:{' '}
          {Object.values(g.sources).map((s, i) => (
            <span key={s.id}>{i > 0 && ' · '}<a href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a></span>
          ))}
        </p>
      </div>
    </Card>
  );
}
