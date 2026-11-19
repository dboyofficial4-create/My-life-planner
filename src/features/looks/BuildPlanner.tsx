import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { CalendarDays, Clock, HeartPulse, RotateCcw, ShieldAlert, Target, TrendingUp, Utensils } from 'lucide-react';
import { BUILD_GOAL_LABELS, BUILD_GOALS, type BuildPlan, type LookReport } from '@shared/schemas/looks';
import { api, errorMessage } from '@/lib/api';
import { useToast } from '@/ui/overlay';
import { Button, Callout, Card, Chips, Field, Skeleton, Textarea } from '@/ui/primitives';
import { AiNotReady, PhotoPrivacy, PhotoSlot, UnderEighteen, when, type PickedPhoto } from './shared';

type Info = { report: LookReport<BuildPlan> | null; photosAllowed: boolean; aiReady: boolean };

export function BuildPlanner() {
  const q = useQuery({ queryKey: ['looks', 'build'], queryFn: () => api.get<Info>('/looks/build') });
  const [editing, setEditing] = useState(false);
  if (q.isPending) return <Card><Skeleton h={120} /></Card>;
  if (q.error) return <Callout tone="danger">{errorMessage(q.error)}</Callout>;
  const d = q.data;
  if (!d.aiReady) return <AiNotReady />;
  return d.report && !editing ? <BuildResult r={d.report} onAgain={() => setEditing(true)} /> : <BuildForm photosAllowed={d.photosAllowed} onDone={() => setEditing(false)} />;
}

function BuildForm({ photosAllowed, onDone }: { photosAllowed: boolean; onDone: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [current, setCurrent] = useState<PickedPhoto | null>(null);
  const [goal, setGoal] = useState<PickedPhoto | null>(null);
  const [goals, setGoals] = useState<(typeof BUILD_GOALS)[number][]>([]);
  const [description, setDescription] = useState('');
  const [consent, setConsent] = useState(false);
  const strip = (p: PickedPhoto | null) => (p ? { mediaType: p.mediaType, data: p.data } : null);
  const go = useMutation({
    mutationFn: () => api.post('/looks/build', { currentPhoto: strip(current), goalPhoto: strip(goal), goals, description, consent }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['looks', 'build'] }); onDone(); },
    onError: (e) => toast({ message: errorMessage(e), tone: 'error' }),
  });
  const ready = goals.length > 0 || description.trim().length > 0 || (photosAllowed && !!goal);
  return (
    <Card>
      <form className="stack-lg" onSubmit={(e) => { e.preventDefault(); go.mutate(); }}>
        <p className="small muted">Get a weekly plan built around your equipment, schedule, injuries and sport, with an honest timeline for the build you want.</p>
        {photosAllowed ? (
          <div className="stack-sm">
            <div className="photo-row photo-row--two">
              <PhotoSlot label="You now" hint="Fitted athletic clothes, front-on, good light" capture="environment" value={current} onChange={setCurrent} />
              <PhotoSlot label="The build you want" hint="Any photo of the look you’re aiming for" value={goal} onChange={setGoal} />
            </div>
            <PhotoPrivacy photosAllowed />
          </div>
        ) : (
          <UnderEighteen what="plan" />
        )}
        <Chips<(typeof BUILD_GOALS)[number]> label="What are you going for?" multiple options={BUILD_GOALS.map((v) => ({ value: v, label: BUILD_GOAL_LABELS[v] }))} value={goals} onChange={(v) => setGoals(v as typeof goals)} />
        <Field label="Describe it in your words" optional>{(p) => <Textarea {...p} rows={2} value={description} maxLength={600} placeholder="e.g. a point guard’s build: quick, strong legs, more shoulder muscle" onChange={(e) => setDescription(e.target.value)} />}</Field>
        <label className="checkbox">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span className="small">Send {photosAllowed && (current || goal) ? 'these photos and answers' : 'these answers'} to the AI service (Anthropic) to make my plan.</span>
        </label>
        <div className="row-wrap">
          <Button type="submit" variant="primary" icon={Target} loading={go.isPending} disabled={!consent || !ready}>{go.isPending ? 'Planning… (about 30 seconds)' : 'Make my plan'}</Button>
        </div>
      </form>
    </Card>
  );
}

function List({ title, icon: Icon, items }: { title: string; icon: typeof Clock; items: string[] }) {
  if (!items.length) return null;
  return (
    <Card title={<span className="row-sm"><Icon aria-hidden style={{ width: 16 }} /> {title}</span>}>
      <ul className="small stack-sm" style={{ paddingLeft: 18 }}>{items.map((s) => <li key={s}>{s}</li>)}</ul>
    </Card>
  );
}

function BuildResult({ r, onAgain }: { r: LookReport<BuildPlan>; onAgain: () => void }) {
  const qc = useQueryClient();
  const clear = useMutation({ mutationFn: () => api.del('/looks/build'), onSuccess: () => qc.invalidateQueries({ queryKey: ['looks', 'build'] }) });
  const p = r.result;
  return (
    <div className="stack-lg">
      <div className="look-summary">
        <p>{p.summary}</p>
        <div className="look-real">
          <Clock aria-hidden />
          <div className="stack-sm" style={{ gap: 4 }}>
            <span className="strong">{p.timeline}</span>
            <span className="small muted">{p.realistic}</span>
          </div>
        </div>
        <p className="xsmall subtle">{r.usedPhotos ? 'From your photos and answers' : 'From your answers'} · {when(r.createdAt)} · Built around your training settings.</p>
        <div className="row-wrap">
          <Button size="sm" icon={RotateCcw} onClick={onAgain}>Start again</Button>
          <Button size="sm" variant="ghost" loading={clear.isPending} onClick={() => clear.mutate()}>Delete this plan</Button>
        </div>
      </div>
      {p.focusAreas.length > 0 && (
        <Card title={<span className="row-sm"><Target aria-hidden style={{ width: 16 }} /> What to focus on</span>} pad={false}>
          <div className="table-wrap">
            <table className="look-table">
              <thead><tr><th>Area</th><th>Now</th><th>Goal</th><th>Focus</th></tr></thead>
              <tbody>{p.focusAreas.map((f) => <tr key={f.area}><td className="strong">{f.area}</td><td>{f.now}</td><td>{f.goal}</td><td>{f.focus}</td></tr>)}</tbody>
            </table>
          </div>
        </Card>
      )}
      <section className="stack">
        <h3 className="row-sm"><CalendarDays aria-hidden style={{ width: 16 }} /> Your week</h3>
        <div className="grid-2">
          {p.days.map((d) => (
            <Card key={d.day} title={`${d.day}: ${d.focus}`} pad={false}>
              <ul style={{ listStyle: 'none' }}>
                {d.exercises.map((e) => (
                  <li key={e.name} className="list-row" style={{ alignItems: 'flex-start' }}>
                    <div className="grow">
                      <div className="small strong">{e.name}</div>
                      {e.notes && <div className="xsmall subtle">{e.notes}</div>}
                    </div>
                    <span className="small num" style={{ whiteSpace: 'nowrap' }}>{e.sets} × {e.reps}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </section>
      <div className="grid-2">
        <List title="Making progress" icon={TrendingUp} items={p.progression} />
        <List title="Food" icon={Utensils} items={p.nutrition} />
        <List title="Recovery" icon={HeartPulse} items={p.recovery} />
        <List title="Stay safe" icon={ShieldAlert} items={p.safety} />
      </div>
    </div>
  );
}
