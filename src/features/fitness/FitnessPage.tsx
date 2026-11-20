import { BuildPlanner } from '@/features/looks/BuildPlanner';
import { ProgressPhotos } from './ProgressPhotos';
import { GamesPanel } from './GamesPanel';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Activity, Dumbbell, History } from 'lucide-react';
import { useState } from 'react';
import type { Program, WorkoutPlan } from '@shared/domain/fitness/generator';
import { SportsPanel } from '@/features/sports/SportsPanel';
import { api } from '@/lib/api';
import { dayLabel } from '@/lib/format';
import { Badge, Callout, Card, EmptyState, ErrorState, PageHeader, PageSkeleton, Tabs } from '@/ui/primitives';

interface FitnessData {
  program: Program | null;
  equipment: string[];
  limitations: string[];
  hasSports: boolean;
  progressPhotos: boolean;
  history: { id: string; date: string; title: string; status: string; minutes: number; effort: number | null; discomfort: number | null; note: string | null }[];
  load: { date: string; load: number; sessions: string[] }[];
  loadCap: number;
  ageNotes: string[];
}

type Tab = 'program' | 'games' | 'build' | 'photos' | 'load' | 'history' | 'sports';

export default function FitnessPage() {
  const q = useQuery({ queryKey: ['fitness'], queryFn: () => api.get<FitnessData>('/fitness') });
  const [tab, setTab] = useState<Tab>('program');
  if (q.isPending) return <PageSkeleton />;
  if (q.error) return <div className="page"><ErrorState error={q.error} onRetry={() => q.refetch()} /></div>;
  const d = q.data;
  const tabs: { value: Tab; label: string }[] = [
    ...(d.program ? [{ value: 'program' as const, label: 'Program' }] : []),
    ...(d.hasSports ? [{ value: 'games' as const, label: 'Games' }] : []),
    { value: 'build', label: 'Build planner' },
    ...(d.progressPhotos ? [{ value: 'photos' as const, label: 'Progress photos' }] : []),
    { value: 'load', label: 'Training load' },
    { value: 'history', label: 'History' },
    ...(d.hasSports ? [{ value: 'sports' as const, label: 'Sport skills' }] : []),
  ];
  const active = tabs.some((t) => t.value === tab) ? tab : tabs[0]!.value;

  return (
    <div className="page">
      <PageHeader
        title="Fitness & Sports"
        description={d.program ? `${d.program.sessionsPerWeek} sessions a week · ${d.equipment.length ? d.equipment.join(', ') : 'bodyweight only'}` : 'Sport skill work and training load'}
        actions={<Link to="/settings/fitness" className="btn btn-secondary btn-sm">Edit equipment & preferences</Link>}
      />
      {d.program?.notes.map((n) => <Callout key={n} tone="info">{n}</Callout>)}
      <Tabs label="Fitness sections" tabs={tabs} value={active} onChange={setTab} />
      {active === 'program' && d.program && (
        <div className="stack-lg">
          {d.program.workouts.map((w) => <WorkoutCard key={w.key} w={w} />)}
        </div>
      )}
      {active === 'games' && <GamesPanel />}
      {active === 'build' && <BuildPlanner />}
      {active === 'photos' && <ProgressPhotos />}
      {active === 'load' && <LoadChart d={d} />}
      {active === 'history' && <HistoryList d={d} />}
      {active === 'sports' && <SportsPanel />}
    </div>
  );
}

function WorkoutCard({ w }: { w: WorkoutPlan }) {
  return (
    <Card
      title={<span className="row-sm"><Dumbbell aria-hidden style={{ width: 16, color: 'var(--cat-workout)' }} /> {w.title} <span className="subtle small">({w.key})</span></span>}
      action={<div className="row-sm"><Badge>{w.minutes} min</Badge>{w.expressMinutes < w.minutes && <Badge outline>Express {w.expressMinutes} min</Badge>}</div>}
      pad={false}
    >
      <div className="card-body stack-sm">
        <p className="small">{w.purpose}</p>
        {w.warmup.length > 0 && (
          <details className="details">
            <summary>Warm-up ({w.warmup.length} steps)</summary>
            <ul className="small muted" style={{ paddingLeft: 18 }}>{w.warmup.map((s) => <li key={s.name}>{s.name} — {s.detail}</li>)}</ul>
          </details>
        )}
      </div>
      {w.main.length > 0 && (
        <ol style={{ listStyle: 'none' }}>
          {w.main.map((m, i) => (
            <li key={m.exerciseId} className="exercise">
              <div className="stack-sm" style={{ gap: 4 }}>
                <div className="row-sm">
                  <span className="step-num">{i + 1}</span>
                  <span className="strong small">{m.name}</span>
                  {i >= w.expressCount && <Badge outline>Skip in express</Badge>}
                </div>
                <div className="dose">
                  <span>{m.sets} sets × {m.reps}</span>
                  <span>Rest {m.restSeconds >= 60 ? `${Math.round(m.restSeconds / 6) / 10} min` : `${m.restSeconds}s`}</span>
                  <span>{m.effort}</span>
                </div>
                <details className="details">
                  <summary>Technique & options</summary>
                  <div className="stack-sm small">
                    <ul className="muted" style={{ paddingLeft: 18 }}>{m.cues.map((c) => <li key={c}>{c}</li>)}</ul>
                    {m.easier && <div><span className="subtle">Easier:</span> {m.easier}</div>}
                    {m.harder && <div><span className="subtle">Harder:</span> {m.harder}</div>}
                    {m.substitutions.length > 0 && <div><span className="subtle">Swap with:</span> {m.substitutions.join(', ')}</div>}
                  </div>
                </details>
              </div>
            </li>
          ))}
        </ol>
      )}
      {w.blocks.length > 0 && (
        <ul className="card-body small stack-sm" style={{ listStyle: 'none', borderTop: '1px solid var(--border)' }}>
          {w.blocks.map((b) => <li key={b.name}><span className="strong">{b.name}</span> <span className="muted">— {b.detail}</span></li>)}
        </ul>
      )}
      <div className="card-footer stack-sm">
        {w.cooldown.length > 0 && <p className="xsmall muted"><span className="strong">Cool-down:</span> {w.cooldown.map((c) => `${c.name} (${c.detail})`).join(' · ')}</p>}
        <p className="xsmall muted"><span className="strong">How to progress:</span> {w.progression}</p>
      </div>
    </Card>
  );
}

function LoadChart({ d }: { d: FitnessData }) {
  const max = Math.max(d.loadCap + 1, ...d.load.map((l) => l.load));
  return (
    <Card title={<span className="row-sm"><Activity aria-hidden style={{ width: 16 }} /> Training load this week</span>}>
      <div className="stack">
        <p className="small muted">Practices, games and workouts each add load (light 1 · moderate 2 · hard 3). The planner keeps each day at or under {d.loadCap} so goals don’t stack into overtraining.</p>
        <div>
          <div className="bars" role="img" aria-label={`Daily training load: ${d.load.map((l) => `${dayLabel(l.date, { weekday: 'short' })} ${l.load}`).join(', ')}`}>
            <div className="bar-cap" style={{ bottom: `${(d.loadCap / max) * 100}%` }} aria-hidden />
            {d.load.map((l) => (
              <div key={l.date} className={`bar${l.load > d.loadCap ? ' bar-over' : ''}`} style={{ height: `${(l.load / max) * 100}%` }} title={l.sessions.join(', ') || 'Rest'} />
            ))}
          </div>
          <div className="bar-labels">{d.load.map((l) => <span key={l.date}>{dayLabel(l.date, { weekday: 'short' })}</span>)}</div>
        </div>
        <ul className="small stack-sm" style={{ listStyle: 'none' }}>
          {d.load.map((l) => (
            <li key={l.date} className="row">
              <span className="subtle" style={{ width: 44 }}>{dayLabel(l.date, { weekday: 'short' })}</span>
              <span className="num strong" style={{ width: 20 }}>{l.load}</span>
              <span className="muted truncate">{l.sessions.join(' · ') || 'Rest / no training'}</span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

function HistoryList({ d }: { d: FitnessData }) {
  const logged = d.history.filter((h) => h.status !== 'planned');
  if (!logged.length) {
    return <Card><EmptyState icon={History} title="No sessions logged yet">Mark workouts done from Today or Plan and log how hard they felt. Your history shows up here.</EmptyState></Card>;
  }
  return (
    <Card title="Last 4 weeks" pad={false}>
      <ul style={{ listStyle: 'none' }}>
        {logged.slice().reverse().map((h) => (
          <li key={h.id} className="list-row">
            <span className="subtle small" style={{ width: 84 }}>{dayLabel(h.date)}</span>
            <span className="grow small truncate">{h.title}</span>
            {h.effort !== null && <Badge>Effort {h.effort}/10</Badge>}
            {!!h.discomfort && <Badge tone={h.discomfort >= 5 ? 'warning' : 'neutral'}>Discomfort {h.discomfort}</Badge>}
            <Badge tone={h.status === 'done' ? 'success' : 'neutral'}>{h.status}</Badge>
          </li>
        ))}
      </ul>
    </Card>
  );
}
