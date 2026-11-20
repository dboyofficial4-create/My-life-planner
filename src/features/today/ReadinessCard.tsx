import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Activity, HeartPulse, Pencil } from 'lucide-react';
import clsx from 'clsx';
import { LEVEL_LABEL, PLAN_LABEL, readiness, type ReadinessInput, type ReadinessLevel } from '@shared/domain/fitness/readiness';
import { api, errorMessage } from '@/lib/api';
import { useToast } from '@/ui/overlay';
import { Button, Chips, Switch, Input } from '@/ui/primitives';

interface Entry { date: string; answers: Partial<ReadinessInput>; score: number; level: ReadinessLevel; plan: 'normal' | 'lighter' | 'recovery' }
interface Data { today: string; entry: Entry | null; recent: { date: string; score: number; level: ReadinessLevel }[] }

const five = (labels: [string, string]) => [1, 2, 3, 4, 5].map((v) => ({ value: v, label: v === 1 ? `1 ${labels[0]}` : v === 5 ? `5 ${labels[1]}` : String(v) }));
const SLEEP = [5, 6, 7, 8, 9, 10];
const DEFAULT: ReadinessInput = { sleepHours: 8, sleepQuality: 3, soreness: 2, energy: 3, stress: 2, pain: false, painNote: '' };

/** Morning check-in for athletes: 20 seconds, and today's training adapts. */
export function ReadinessCard({ onAdapt, adult }: { onAdapt: () => void; adult: boolean }) {
  const q = useQuery({ queryKey: ['readiness'], queryFn: () => api.get<Data>('/readiness') });
  const [editing, setEditing] = useState(false);
  if (!q.data) return null;
  const { entry, recent } = q.data;
  return (
    <section className={clsx('readiness', entry && `readiness--${entry.level}`)} aria-labelledby="readiness-h">
      <div className="readiness__head">
        <h2 id="readiness-h" className="row-sm"><HeartPulse aria-hidden style={{ width: 18 }} /> Morning check-in</h2>
        <Week recent={recent} today={q.data.today} />
      </div>
      {entry && !editing ? <Result entry={entry} adult={adult} onEdit={() => setEditing(true)} /> : <Form initial={entry?.answers} onDone={(changed) => { setEditing(false); if (changed) onAdapt(); }} />}
    </section>
  );
}

function Week({ recent, today }: { recent: Data['recent']; today: string }) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(`${today}T12:00:00`);
    d.setDate(d.getDate() - 6 + i);
    const iso = d.toLocaleDateString('en-CA');
    return { iso, label: d.toLocaleDateString(undefined, { weekday: 'narrow' }), r: recent.find((x) => x.date === iso) };
  });
  return (
    <ol className="readiness__week" aria-label="Last 7 days">
      {days.map((d) => (
        <li key={d.iso} title={d.r ? `${d.iso}: ${LEVEL_LABEL[d.r.level]} (${d.r.score})` : `${d.iso}: no check-in`}>
          <span className={clsx('readiness__dot', d.r && `is-${d.r.level}`)} />
          <span className="xsmall subtle">{d.label}</span>
        </li>
      ))}
    </ol>
  );
}

function Result({ entry, adult, onEdit }: { entry: Entry; adult: boolean; onEdit: () => void }) {
  const r = readiness({ ...DEFAULT, ...entry.answers } as ReadinessInput, { adult });
  return (
    <div className="stack">
      <div className="readiness__result">
        <span className="readiness__score num">{entry.score}</span>
        <div className="stack-sm" style={{ gap: 2 }}>
          <span className="strong">{LEVEL_LABEL[entry.level]}</span>
          <span className="small muted">{PLAN_LABEL[entry.plan]}</span>
          {r.reasons.length > 0 && <span className="xsmall subtle">{r.reasons.join(' · ')}</span>}
        </div>
      </div>
      <ul className="small stack-sm" style={{ paddingLeft: 18 }}>{r.advice.map((a) => <li key={a}>{a}</li>)}</ul>
      <div><Button size="sm" variant="ghost" icon={Pencil} onClick={onEdit}>Change my answers</Button></div>
    </div>
  );
}

function Form({ initial, onDone }: { initial?: Partial<ReadinessInput>; onDone: (planChanged: boolean) => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [v, setV] = useState<ReadinessInput>({ ...DEFAULT, ...initial });
  const set = (p: Partial<ReadinessInput>) => setV((x) => ({ ...x, ...p }));
  const save = useMutation({
    mutationFn: () => api.post<{ planChanged: boolean }>('/readiness', v),
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ['readiness'] }); qc.invalidateQueries({ queryKey: ['today'] }); onDone(r.planChanged); },
    onError: (e) => toast({ message: errorMessage(e), tone: 'error' }),
  });
  return (
    <form className="stack" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
      <p className="small muted">20 seconds. Your training today adapts to how you actually feel.</p>
      <Chips<number> label="Hours of sleep" value={Math.min(10, Math.max(5, Math.round(v.sleepHours)))} onChange={(x) => set({ sleepHours: x as number })} options={SLEEP.map((h) => ({ value: h, label: h === 5 ? '5 or less' : h === 10 ? '10+' : String(h) }))} />
      <div className="readiness__grid">
        <Chips<number> label="Sleep quality" value={v.sleepQuality} onChange={(x) => set({ sleepQuality: x as number })} options={five(['bad', 'great'])} />
        <Chips<number> label="Energy" value={v.energy} onChange={(x) => set({ energy: x as number })} options={five(['drained', 'full'])} />
        <Chips<number> label="Muscle soreness" value={v.soreness} onChange={(x) => set({ soreness: x as number })} options={five(['none', 'very'])} />
        <Chips<number> label="Stress" value={v.stress} onChange={(x) => set({ stress: x as number })} options={five(['calm', 'very'])} />
      </div>
      <Switch label="Something hurts (not just sore)" description="Sharp pain, a joint, or something that changes how you move." checked={v.pain} onChange={(pain) => set({ pain })} />
      {v.pain && <Input aria-label="Where it hurts" placeholder="Where? e.g. left ankle" maxLength={200} value={v.painNote} onChange={(e) => set({ painNote: e.target.value })} style={{ maxWidth: 360 }} />}
      <div><Button type="submit" variant="primary" icon={Activity} loading={save.isPending}>Check in</Button></div>
    </form>
  );
}
