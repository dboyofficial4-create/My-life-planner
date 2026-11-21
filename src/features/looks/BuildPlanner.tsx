import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { CalendarDays, Clock, Images, HeartPulse, RotateCcw, ShieldAlert, Target, TrendingUp, Utensils } from 'lucide-react';
import { MAX_GOAL_PHOTOS, MIN_GOAL_PHOTOS, type BuildPlan, type LookReport } from '@shared/schemas/looks';
import { archetypeById, BUILD_ARCHETYPES, type BuildArchetype } from '@shared/domain/fitness/builds';
import { POSITIONS, buildsForPositions, positionInfo, type PositionInfo } from '@shared/domain/sports/positions';
import type { SportId } from '@shared/domain/sports/catalog';
import { SPORT_LABELS } from '@shared/domain/fitness/sports';
import { BuildFigure } from './BuildFigure';
import clsx from 'clsx';
import { VaultPicker } from './VaultPicker';
import { api, errorMessage } from '@/lib/api';
import { useToast } from '@/ui/overlay';
import { Button, Callout, Card, Field, Select, Skeleton, Textarea } from '@/ui/primitives';
import { AiNotReady, consentText, PhotoPrivacy, PhotoSlot, PhotoRulesCheck, when, type PickedPhoto, type Provider } from './shared';

type SportRef = { sport: SportId; position: string; secondaryPosition: string };
type Info = { provider: Provider; report: LookReport<BuildPlan> | null; photosAllowed: boolean; goalPhotoAllowed: boolean; aiReady: boolean; sports: SportRef[] };

export function BuildPlanner() {
  const q = useQuery({ queryKey: ['looks', 'build'], queryFn: () => api.get<Info>('/looks/build') });
  const [editing, setEditing] = useState(false);
  if (q.isPending) return <Card><Skeleton h={120} /></Card>;
  if (q.error) return <Callout tone="danger">{errorMessage(q.error)}</Callout>;
  const d = q.data;
  if (!d.aiReady) return <AiNotReady />;
  return d.report && !editing ? <BuildResult r={d.report} onAgain={() => setEditing(true)} /> : <BuildForm info={d} onDone={() => setEditing(false)} />;
}

const SPORT_IDS = (Object.keys(POSITIONS) as SportId[]).filter((s) => POSITIONS[s].length > 0);
const GOAL_SLOTS = ['Goal photo 1', 'Goal photo 2', 'Goal photo 3 (optional)', 'Goal photo 4 (optional)'];
const CURRENT_SLOTS = [
  { label: 'Front', hint: 'Facing the camera, arms relaxed' },
  { label: 'Side (optional)', hint: 'Turned sideways' },
  { label: 'Back (optional)', hint: 'Facing away' },
];

function BuildForm({ info, onDone }: { info: Info; onDone: () => void }) {
  const { photosAllowed, goalPhotoAllowed: goalAllowed, provider } = info;
  const qc = useQueryClient();
  const toast = useToast();
  const mine = info.sports.find((s) => POSITIONS[s.sport]?.length);
  const [mode, setMode] = useState<'sport' | 'everyday' | 'photos'>(mine ? 'sport' : 'everyday');
  const [sport, setSport] = useState<SportId>(mine?.sport ?? 'american_football');
  const [position, setPosition] = useState(positionInfo(sport, mine?.position)?.name ?? '');
  const [position2, setPosition2] = useState(positionInfo(sport, mine?.secondaryPosition)?.name ?? '');
  const [archetype, setArchetype] = useState<string | null>(null);
  const [goals, setGoals] = useState<(PickedPhoto | null)[]>([null, null, null, null]);
  const [current, setCurrent] = useState<(PickedPhoto | null)[]>([null, null, null]);
  const [fromVault, setFromVault] = useState(false);
  const [description, setDescription] = useState('');
  const [consent, setConsent] = useState(false);
  const [photoRules, setPhotoRules] = useState(false);
  const goalPhotos = mode === 'photos' ? goals.filter((p): p is PickedPhoto => !!p) : [];
  const currentPhotos = current.filter((p): p is PickedPhoto => !!p);
  const strip = (p: PickedPhoto) => ({ mediaType: p.mediaType, data: p.data });
  const options = mode === 'sport' && position ? buildsForPositions(sport, [position, position2]) : [];
  const chosenOption = options.find((o) => o.id === archetype);
  const forPosition = mode === 'sport' && chosenOption ? `${SPORT_LABELS[sport]}: ${[position, position2].filter(Boolean).join(' + ')}` : '';
  const go = useMutation({
    mutationFn: () =>
      api.post('/looks/build', {
        currentPhotos: currentPhotos.map(strip),
        goalPhotos: goalPhotos.map(strip),
        archetype: mode === 'photos' ? null : archetype,
        forPosition,
        goals: [],
        description,
        consent,
        photoRules,
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['looks', 'build'] }); onDone(); },
    onError: (e) => toast({ message: errorMessage(e), tone: 'error' }),
  });
  const hasPhoto = goalPhotos.length > 0 || currentPhotos.length > 0;
  const goalShort = mode === 'photos' && goalPhotos.length > 0 && goalPhotos.length < MIN_GOAL_PHOTOS;
  const ready = mode === 'photos' ? goalPhotos.length >= MIN_GOAL_PHOTOS || (goalPhotos.length === 0 && description.trim().length > 0) : !!archetype || description.trim().length > 0;
  const chosen = archetypeById(archetype);
  const pick = (id: string) => setArchetype((a) => (a === id ? null : id));
  const setSlot = (list: (PickedPhoto | null)[], set: (v: (PickedPhoto | null)[]) => void, i: number, p: PickedPhoto | null) => set(list.map((x, j) => (j === i ? p : x)));
  const sportPositions = POSITIONS[sport];
  return (
    <Card>
      <form className="stack-lg" onSubmit={(e) => { e.preventDefault(); go.mutate(); }}>
        <p className="small muted">Pick the build you want, tell us where you’re starting, and get a weekly plan built around your equipment, schedule, injuries and sport, with an honest timeline.</p>

        <section className="stack">
          <h3 className="build-step"><span>1</span> Choose your goal build</h3>
          <div className="tabs" role="tablist" aria-label="How to choose">
            {([['sport', 'For my sport and position'], ['everyday', 'Popular looks'], ...(goalAllowed ? [['photos', 'From my own photos']] : [])] as [typeof mode, string][]).map(([m, label]) => (
              <button key={m} type="button" role="tab" aria-selected={mode === m} className={clsx('tab', mode === m && 'is-active')} onClick={() => { setMode(m); setArchetype(null); }}>{label}</button>
            ))}
          </div>

          {mode === 'sport' && (
            <div className="stack">
              <div className="grid-3 build-pickers">
                <Field label="Sport">
                  {(p) => (
                    <Select {...p} value={sport} onChange={(e) => { const sp = e.target.value as SportId; setSport(sp); setPosition(''); setPosition2(''); setArchetype(null); }}>
                      {SPORT_IDS.map((x) => <option key={x} value={x}>{SPORT_LABELS[x]}</option>)}
                    </Select>
                  )}
                </Field>
                <Field label="Position">
                  {(p) => (
                    <Select {...p} value={position} onChange={(e) => { setPosition(e.target.value); setArchetype(null); }}>
                      <option value="">Choose…</option>
                      <PositionOptions list={sportPositions} exclude={position2} />
                    </Select>
                  )}
                </Field>
                <Field label="Second position" optional hint="If you play both ways">
                  {(p) => (
                    <Select {...p} value={position2} disabled={!position} onChange={(e) => { setPosition2(e.target.value); setArchetype(null); }}>
                      <option value="">None</option>
                      <PositionOptions list={sportPositions} exclude={position} />
                    </Select>
                  )}
                </Field>
              </div>
              {position && <p className="xsmall subtle">{[position, position2].filter(Boolean).map((n) => positionInfo(sport, n)?.blurb).filter(Boolean).join(' ')}</p>}
              {options.length > 0 ? (
                <>
                  <p className="small"><span className="strong">The 5 best builds for {[position, position2].filter(Boolean).join(' + ').toLowerCase()}</span><span className="muted">, best first. Blue shows where each build carries its muscle; the dashed line is average height.</span></p>
                  <div className="build-grid build-grid--figs" role="radiogroup" aria-label="Builds for your position">
                    {options.map((o, i) => {
                      const b = archetypeById(o.id)!;
                      return <BuildOption key={o.id} b={b} rank={i + 1} why={o.why} on={archetype === o.id} onPick={() => pick(o.id)} />;
                    })}
                  </div>
                </>
              ) : (
                <p className="small muted">Choose your position to see the builds that suit it.</p>
              )}
            </div>
          )}

          {mode === 'everyday' && (
            <div className="build-grid build-grid--figs" role="radiogroup" aria-label="Popular looks">
              {BUILD_ARCHETYPES.filter((a) => a.group === 'everyday' || a.id === 'gymnast').map((b) => (
                <BuildOption key={b.id} b={b} on={archetype === b.id} onPick={() => pick(b.id)} />
              ))}
            </div>
          )}

          {mode !== 'photos' && chosen && (
            <div className="build-chosen">
              <span className="strong">{chosen.name}: how they train</span>
              <ul className="small" style={{ paddingLeft: 18 }}>{chosen.training.map((t) => <li key={t}>{t}</li>)}</ul>
              <span className="xsmall muted">{chosen.realityCheck}</span>
            </div>
          )}

          {mode === 'photos' && goalAllowed && (
            <div className="stack-sm">
              <p className="small">Add <span className="strong">at least {MIN_GOAL_PHOTOS}</span> photos of the build you want (up to {MAX_GOAL_PHOTOS}). Different angles, or a few people with the same build, show the AI what’s real and what’s just one good pose or lighting.</p>
              <div className="photo-row photo-row--four">
                {GOAL_SLOTS.map((label, i) => (
                  <PhotoSlot key={label} label={label} hint={i < 2 ? 'Fully clothed sportswear' : undefined} value={goals[i] ?? null} onChange={(p) => setSlot(goals, setGoals, i, p)} />
                ))}
              </div>
              {goalShort && <p className="xsmall" style={{ color: 'var(--danger)' }}>Add {MIN_GOAL_PHOTOS - goalPhotos.length} more photo to continue.</p>}
            </div>
          )}
        </section>

        <section className="stack">
          <h3 className="build-step"><span>2</span> Where you’re starting</h3>
          {photosAllowed ? (
            <div className="stack-sm">
              <p className="xsmall subtle">Optional. More angles give a better read; a front photo alone works too.</p>
              <div className="photo-row">
                {CURRENT_SLOTS.map((s, i) => (
                  <PhotoSlot key={s.label} label={s.label} hint={s.hint} capture="environment" value={current[i] ?? null} onChange={(p) => setSlot(current, setCurrent, i, p)} />
                ))}
              </div>
              {current.some((p) => !p) && !fromVault && <div><Button size="sm" variant="ghost" icon={Images} onClick={() => setFromVault(true)}>Use one of my progress photos</Button></div>}
              {fromVault && <VaultPicker onPick={(p) => { const i = current.findIndex((x) => !x); if (i >= 0) setSlot(current, setCurrent, i, p); setFromVault(false); }} onCancel={() => setFromVault(false)} />}
            </div>
          ) : (
            <p className="xsmall subtle">{goalAllowed ? 'Photos of yourself are for ages 18 and up, so describe where you’re starting. Your Progress photos stay on your device to track changes.' : 'Describe where you’re starting.'}</p>
          )}
          <Field label="In your words" optional={ready && mode !== 'photos' ? true : goalPhotos.length >= MIN_GOAL_PHOTOS}>{(p) => <Textarea {...p} rows={2} value={description} maxLength={600} placeholder="e.g. 5’10”, skinny arms, decent legs from soccer; want more upper body and a faster first step" onChange={(e) => setDescription(e.target.value)} />}</Field>
        </section>

        {hasPhoto && (
          <div className="stack-sm">
            <PhotoPrivacy photosAllowed provider={provider} />
            <PhotoRulesCheck checked={photoRules} onChange={setPhotoRules} rule={currentPhotos.length ? 'me, fully clothed in athletic wear, nothing revealing.' : 'clothed people in sportswear, nothing revealing.'} />
          </div>
        )}
        <label className="checkbox">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span className="small">{consentText(provider, hasPhoto, 'plan')}</span>
        </label>
        <div className="row-wrap">
          <Button type="submit" variant="primary" icon={Target} loading={go.isPending} disabled={!consent || !ready || goalShort || (hasPhoto && !photoRules)}>{go.isPending ? 'Planning… (about 30 seconds)' : 'Make my plan'}</Button>
          {!ready && <span className="xsmall subtle">{mode === 'photos' ? `Add at least ${MIN_GOAL_PHOTOS} goal photos, or describe the build.` : 'Choose a build or describe it.'}</span>}
        </div>
      </form>
    </Card>
  );
}

function PositionOptions({ list, exclude }: { list: PositionInfo[]; exclude?: string }) {
  const keep = list.filter((x) => x.name !== exclude);
  return (
    <>
      <optgroup label="Positions">{keep.filter((x) => !x.advanced).map((x) => <option key={x.name} value={x.name}>{x.name}</option>)}</optgroup>
      {keep.some((x) => x.advanced) && <optgroup label="Advanced and modern roles">{keep.filter((x) => x.advanced).map((x) => <option key={x.name} value={x.name}>{x.name}</option>)}</optgroup>}
    </>
  );
}

function BuildOption({ b, rank, why, on, onPick }: { b: BuildArchetype; rank?: number; why?: string; on: boolean; onPick: () => void }) {
  return (
    <button type="button" role="radio" aria-checked={on} className={clsx('build-card build-card--fig', on && 'is-on')} onClick={onPick}>
      <BuildFigure build={b} />
      <span className="build-card__body">
        {rank && <span className="build-card__rank mono">No. {rank}</span>}
        <span className="build-card__name">{b.name}</span>
        <span className="xsmall subtle">{b.seenIn}</span>
        {why && <span className="small build-card__why">{why}</span>}
        <span className="build-card__label">What it gives you</span>
        <ul className="build-card__look">{b.benefits.map((l) => <li key={l}>{l}</li>)}</ul>
        <span className="build-card__label">Trade-off</span>
        <span className="xsmall muted">{b.tradeoffs[0]}</span>
      </span>
    </button>
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
