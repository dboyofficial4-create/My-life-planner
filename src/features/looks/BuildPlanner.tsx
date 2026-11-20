import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { CalendarDays, Clock, Images, HeartPulse, RotateCcw, ShieldAlert, Target, TrendingUp, Utensils } from 'lucide-react';
import { type BuildPlan, type LookReport } from '@shared/schemas/looks';
import { archetypeById, BUILD_ARCHETYPES } from '@shared/domain/fitness/builds';
import clsx from 'clsx';
import { VaultPicker } from './VaultPicker';
import { api, errorMessage } from '@/lib/api';
import { useToast } from '@/ui/overlay';
import { Button, Callout, Card, Field, Skeleton, Textarea } from '@/ui/primitives';
import { AiNotReady, consentText, PhotoPrivacy, PhotoSlot, PhotoRulesCheck, when, type PickedPhoto, type Provider } from './shared';

type Info = { provider: Provider; report: LookReport<BuildPlan> | null; photosAllowed: boolean; goalPhotoAllowed: boolean; aiReady: boolean };

export function BuildPlanner() {
  const q = useQuery({ queryKey: ['looks', 'build'], queryFn: () => api.get<Info>('/looks/build') });
  const [editing, setEditing] = useState(false);
  if (q.isPending) return <Card><Skeleton h={120} /></Card>;
  if (q.error) return <Callout tone="danger">{errorMessage(q.error)}</Callout>;
  const d = q.data;
  if (!d.aiReady) return <AiNotReady />;
  return d.report && !editing ? <BuildResult r={d.report} onAgain={() => setEditing(true)} /> : <BuildForm photosAllowed={d.photosAllowed} goalAllowed={d.goalPhotoAllowed} provider={d.provider} onDone={() => setEditing(false)} />;
}

function BuildForm({ photosAllowed, goalAllowed, provider, onDone }: { photosAllowed: boolean; goalAllowed: boolean; provider: Provider; onDone: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [archetype, setArchetype] = useState<string | null>(null);
  const [current, setCurrent] = useState<PickedPhoto | null>(null);
  const [goal, setGoal] = useState<PickedPhoto | null>(null);
  const [fromVault, setFromVault] = useState(false);
  const [description, setDescription] = useState('');
  const [consent, setConsent] = useState(false);
  const [photoRules, setPhotoRules] = useState(false);
  const strip = (p: PickedPhoto | null) => (p ? { mediaType: p.mediaType, data: p.data } : null);
  const go = useMutation({
    mutationFn: () => api.post('/looks/build', { currentPhoto: strip(current), goalPhoto: strip(goal), archetype, goals: [], description, consent, photoRules }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['looks', 'build'] }); onDone(); },
    onError: (e) => toast({ message: errorMessage(e), tone: 'error' }),
  });
  const hasPhoto = !!(current || goal);
  const ready = !!archetype || !!goal || description.trim().length > 0;
  const chosen = archetypeById(archetype);
  const pick = (id: string) => { setArchetype((a) => (a === id ? null : id)); setGoal(null); };
  return (
    <Card>
      <form className="stack-lg" onSubmit={(e) => { e.preventDefault(); go.mutate(); }}>
        <p className="small muted">Pick the build you want, tell us where you’re starting, and get a weekly plan built around your equipment, schedule, injuries and sport, with an honest timeline.</p>

        <section className="stack">
          <h3 className="build-step"><span>1</span> Choose your goal build</h3>
          {(['sport', 'everyday'] as const).map((group) => (
            <div key={group} className="stack-sm">
              <span className="xsmall subtle">{group === 'sport' ? 'Built like an athlete' : 'Popular everyday looks'}</span>
              <div className="build-grid" role="radiogroup" aria-label={group === 'sport' ? 'Athlete builds' : 'Everyday builds'}>
                {BUILD_ARCHETYPES.filter((a) => a.group === group).map((a) => (
                  <button key={a.id} type="button" role="radio" aria-checked={archetype === a.id} className={clsx('build-card', archetype === a.id && 'is-on')} onClick={() => pick(a.id)}>
                    <span className="build-card__name">{a.name}</span>
                    <span className="xsmall subtle">{a.seenIn}</span>
                    <ul className="build-card__look">{a.look.map((l) => <li key={l}>{l}</li>)}</ul>
                  </button>
                ))}
              </div>
            </div>
          ))}
          {chosen && (
            <div className="build-chosen">
              <span className="strong">{chosen.name}: how they train</span>
              <ul className="small" style={{ paddingLeft: 18 }}>{chosen.training.map((t) => <li key={t}>{t}</li>)}</ul>
              <span className="xsmall muted">{chosen.realityCheck}</span>
            </div>
          )}
          {goalAllowed && (
            <div className="stack-sm">
              <span className="xsmall subtle">Or use your own picture of the build you want</span>
              <div className="photo-row photo-row--two">
                <PhotoSlot label="Goal build photo" hint="Any photo of the look you’re aiming for, fully clothed" value={goal} onChange={(p) => { setGoal(p); if (p) setArchetype(null); }} />
              </div>
            </div>
          )}
        </section>

        <section className="stack">
          <h3 className="build-step"><span>2</span> Where you’re starting</h3>
          {photosAllowed ? (
            <div className="stack-sm">
              <div className="photo-row photo-row--two">
                <PhotoSlot label="You now" hint="Fitted athletic clothes, front-on, good light" capture="environment" value={current} onChange={setCurrent} />
              </div>
              {!current && !fromVault && <div><Button size="sm" variant="ghost" icon={Images} onClick={() => setFromVault(true)}>Use one of my progress photos</Button></div>}
              {!current && fromVault && <VaultPicker onPick={(p) => { setCurrent(p); setFromVault(false); }} onCancel={() => setFromVault(false)} />}
            </div>
          ) : (
            <p className="xsmall subtle">{goalAllowed ? 'Photos of yourself are for ages 18 and up, so describe where you’re starting. Your Progress photos stay on your device to track changes.' : 'Describe where you’re starting.'}</p>
          )}
          <Field label="In your words" optional={!!archetype || !!goal}>{(p) => <Textarea {...p} rows={2} value={description} maxLength={600} placeholder="e.g. 5’10”, skinny arms, decent legs from soccer; want more upper body and a faster first step" onChange={(e) => setDescription(e.target.value)} />}</Field>
        </section>

        {hasPhoto && (
          <div className="stack-sm">
            <PhotoPrivacy photosAllowed provider={provider} />
            <PhotoRulesCheck checked={photoRules} onChange={setPhotoRules} rule={current ? 'me, fully clothed in athletic wear, nothing revealing.' : 'a clothed person in sportswear, nothing revealing.'} />
          </div>
        )}
        <label className="checkbox">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span className="small">{consentText(provider, hasPhoto, 'plan')}</span>
        </label>
        <div className="row-wrap">
          <Button type="submit" variant="primary" icon={Target} loading={go.isPending} disabled={!consent || !ready || (hasPhoto && !photoRules)}>{go.isPending ? 'Planning… (about 30 seconds)' : 'Make my plan'}</Button>
          {!ready && <span className="xsmall subtle">Choose a build, add a goal photo, or describe it.</span>}
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
