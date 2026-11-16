import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LineChart, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { api, errorMessage, fieldErrors } from '@/lib/api';
import { dayLabel } from '@/lib/format';
import { useToast } from '@/ui/overlay';
import { Badge, Button, Card, Chips, EmptyState, ErrorState, Field, Input, NumberInput, PageHeader, PageSkeleton } from '@/ui/primitives';

interface ProgressData {
  today: string;
  consistency: { weekStart: string; done: number; due: number; byCategory: Record<string, { done: number; due: number }> }[];
  effort: { date: string; title: string; effort: number; discomfort: number | null }[];
  logs: { id: string; date: string; metric: string; value: number; note: string }[];
  allowBodyWeight: boolean;
}

const METRICS: Record<string, string> = { energy: 'Energy', sleep_quality: 'Sleep quality', mood: 'Mood', stamina: 'Stamina', strength_note: 'Strength (top set, kg or lb)', body_weight: 'Body weight' };
const RATING = ['', 'Very low', 'Low', 'OK', 'Good', 'Great'];

export default function ProgressPage() {
  const q = useQuery({ queryKey: ['progress'], queryFn: () => api.get<ProgressData>('/progress') });
  if (q.isPending) return <PageSkeleton />;
  if (q.error) return <div className="page"><ErrorState error={q.error} onRetry={() => q.refetch()} /></div>;
  const d = q.data;
  const max = Math.max(1, ...d.consistency.map((c) => c.due));
  const anyData = d.consistency.some((c) => c.due > 0);
  return (
    <div className="page">
      <PageHeader title="Progress" description="Consistency, energy and performance — not just the scale." />
      <div className="grid-2">
        <Card title="Consistency, last 4 weeks">
          {anyData ? (
            <div className="stack">
              <ul className="stack" style={{ listStyle: 'none' }}>
                {d.consistency.map((c) => (
                  <li key={c.weekStart} className="stack-sm" style={{ gap: 4 }}>
                    <div className="row between small">
                      <span>Week of {dayLabel(c.weekStart, { month: 'short', day: 'numeric' })}</span>
                      <span className="num subtle">{c.done} of {c.due} done so far</span>
                    </div>
                    <div className="progress" style={{ height: 10 }} role="img" aria-label={`${c.done} of ${c.due} planned activities done`}>
                      <span style={{ width: `${(c.done / max) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
              <p className="xsmall subtle">Counts workouts, study, sport practice and meal prep whose time has passed. Meals and routines aren’t counted.</p>
            </div>
          ) : (
            <EmptyState icon={LineChart} title="Nothing to show yet">As planned activities come and go, your consistency appears here.</EmptyState>
          )}
        </Card>
        <LogForm d={d} />
      </div>
      <Card title="Recent check-ins" pad={false}>
        {d.logs.length === 0 ? (
          <p className="card-body small muted">No check-ins yet. A quick daily energy or sleep rating helps spot patterns.</p>
        ) : (
          <LogList d={d} />
        )}
      </Card>
      {d.effort.length > 0 && (
        <Card title="Logged training effort" pad={false}>
          <ul style={{ listStyle: 'none' }}>
            {d.effort.slice().reverse().slice(0, 12).map((e, i) => (
              <li key={i} className="list-row">
                <span className="subtle small" style={{ width: 84 }}>{dayLabel(e.date)}</span>
                <span className="grow small truncate">{e.title}</span>
                <Badge>Effort {e.effort}/10</Badge>
                {!!e.discomfort && <Badge tone={e.discomfort >= 5 ? 'warning' : 'neutral'}>Discomfort {e.discomfort}</Badge>}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function LogForm({ d }: { d: ProgressData }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [metric, setMetric] = useState('energy');
  const [value, setValue] = useState<number | null>(null);
  const [date, setDate] = useState(d.today);
  const [note, setNote] = useState('');
  const rated = !['strength_note', 'body_weight'].includes(metric);
  const save = useMutation({
    mutationFn: () => api.post('/progress/logs', { metric, value, date, note }),
    onSuccess: () => {
      setValue(null);
      setNote('');
      qc.invalidateQueries({ queryKey: ['progress'] });
      toast({ message: 'Saved.' });
    },
  });
  const errs = fieldErrors(save.error);
  const metrics = Object.keys(METRICS).filter((m) => m !== 'body_weight' || d.allowBodyWeight);
  return (
    <Card title="Log a check-in">
      <form className="stack" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <Chips label="What" value={metric} onChange={(v) => { setMetric(v as string); setValue(null); }} options={metrics.map((m) => ({ value: m, label: METRICS[m]!.replace(/ \(.*\)/, '') }))} />
        {rated ? (
          <Chips<number> label="Rating" value={value} onChange={(v) => setValue(v as number)} options={[1, 2, 3, 4, 5].map((n) => ({ value: n, label: RATING[n] }))} error={errs.value} />
        ) : (
          <Field label={METRICS[metric]!} error={errs.value}>{(p) => <NumberInput {...p} min={0} max={1000} value={value} onChange={setValue} style={{ maxWidth: 160 }} />}</Field>
        )}
        <div className="grid-2">
          <Field label="Date" error={errs.date}>{(p) => <Input {...p} type="date" max={d.today} value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
          <Field label="Note" optional>{(p) => <Input {...p} value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />}</Field>
        </div>
        {save.error && !Object.keys(errs).length && <p className="field-error">{errorMessage(save.error)}</p>}
        <div><Button type="submit" variant="primary" disabled={value === null} loading={save.isPending}>Save</Button></div>
      </form>
    </Card>
  );
}

function LogList({ d }: { d: ProgressData }) {
  const qc = useQueryClient();
  const del = useMutation({ mutationFn: (id: string) => api.del(`/progress/logs/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['progress'] }) });
  return (
    <ul style={{ listStyle: 'none' }}>
      {d.logs.slice().reverse().slice(0, 20).map((l) => (
        <li key={l.id} className="list-row">
          <span className="subtle small" style={{ width: 84 }}>{dayLabel(l.date)}</span>
          <span className="small" style={{ width: 120 }}>{METRICS[l.metric]?.replace(/ \(.*\)/, '') ?? l.metric}</span>
          <span className="small strong grow">{['strength_note', 'body_weight'].includes(l.metric) ? l.value : RATING[l.value]}{l.note && <span className="muted"> — {l.note}</span>}</span>
          <Button size="sm" variant="ghost" iconOnly icon={Trash2} aria-label="Delete check-in" onClick={() => del.mutate(l.id)} />
        </li>
      ))}
    </ul>
  );
}
