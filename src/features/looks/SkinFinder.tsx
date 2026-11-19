import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Moon, RotateCcw, Sparkles, Stethoscope, Sun } from 'lucide-react';
import { SKIN_CONCERN_LABELS, SKIN_CONCERNS, SKIN_TYPES, type LookReport, type SkinAdvice } from '@shared/schemas/looks';
import { api, errorMessage } from '@/lib/api';
import { useToast } from '@/ui/overlay';
import { Badge, Button, Callout, Card, Chips, Field, Input, Skeleton, Textarea } from '@/ui/primitives';
import { AiNotReady, consentText, PhotoPrivacy, PhotoSlot, UnderEighteen, when, type PickedPhoto, type Provider } from './shared';

type Info = { provider: Provider; report: LookReport<SkinAdvice> | null; photosAllowed: boolean; aiReady: boolean };
const TYPE_LABELS: Record<(typeof SKIN_TYPES)[number], string> = { oily: 'Oily', dry: 'Dry', combination: 'Combination', normal: 'Normal', sensitive: 'Sensitive', not_sure: 'Not sure' };

export function SkinFinder() {
  const q = useQuery({ queryKey: ['looks', 'skin'], queryFn: () => api.get<Info>('/looks/skin') });
  const [editing, setEditing] = useState(false);
  if (q.isPending) return <Card><Skeleton h={120} /></Card>;
  if (q.error) return <Callout tone="danger">{errorMessage(q.error)}</Callout>;
  const d = q.data;
  return (
    <section className="stack" aria-labelledby="skin-finder-h">
      <h2 id="skin-finder-h" className="row-sm"><Sparkles aria-hidden style={{ width: 18 }} /> Product finder</h2>
      {!d.aiReady ? <AiNotReady /> : d.report && !editing ? <SkinResult r={d.report} onAgain={() => setEditing(true)} /> : <SkinForm photosAllowed={d.photosAllowed} provider={d.provider} onDone={() => setEditing(false)} />}
    </section>
  );
}

function SkinForm({ photosAllowed, provider, onDone }: { photosAllowed: boolean; provider: Provider; onDone: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [photos, setPhotos] = useState<(PickedPhoto | null)[]>([null, null, null]);
  const [skinType, setSkinType] = useState<(typeof SKIN_TYPES)[number]>('not_sure');
  const [concerns, setConcerns] = useState<(typeof SKIN_CONCERNS)[number][]>([]);
  const [budget, setBudget] = useState<'low' | 'medium' | 'high'>('low');
  const [currentProducts, setCurrent] = useState('');
  const [notes, setNotes] = useState('');
  const [consent, setConsent] = useState(false);
  const go = useMutation({
    mutationFn: () => api.post('/looks/skin', { photos: photos.filter(Boolean).map((p) => ({ mediaType: p!.mediaType, data: p!.data })), skinType, concerns, budget, currentProducts, notes, consent }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['looks', 'skin'] }); onDone(); },
    onError: (e) => toast({ message: errorMessage(e), tone: 'error' }),
  });
  return (
    <Card>
      <form className="stack-lg" onSubmit={(e) => { e.preventDefault(); go.mutate(); }}>
        <p className="small muted">Get a morning and evening routine with the product types, ingredients to look for and examples that fit your budget.</p>
        {photosAllowed ? (
          <div className="stack-sm">
            <div className="photo-row">
              {photos.map((p, i) => (
                <PhotoSlot key={i} label={['Front', 'Left side', 'Right side'][i]!} hint={i === 0 ? 'Daylight, no filter, no makeup' : 'Optional'} capture="user" value={p} onChange={(v) => setPhotos((all) => all.map((x, j) => (j === i ? v : x)))} />
              ))}
            </div>
            <PhotoPrivacy photosAllowed provider={provider} />
          </div>
        ) : (
          <UnderEighteen what="routine" />
        )}
        <Chips<(typeof SKIN_TYPES)[number]> label="How would you describe your skin?" options={SKIN_TYPES.map((v) => ({ value: v, label: TYPE_LABELS[v] }))} value={skinType} onChange={(v) => setSkinType(v as typeof skinType)} />
        <Chips<(typeof SKIN_CONCERNS)[number]> label="What do you want help with?" multiple options={SKIN_CONCERNS.map((v) => ({ value: v, label: SKIN_CONCERN_LABELS[v] }))} value={concerns} onChange={(v) => setConcerns(v as typeof concerns)} />
        <Chips<'low' | 'medium' | 'high'> label="Budget" options={[{ value: 'low', label: 'Low (drugstore)' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'Higher' }]} value={budget} onChange={(v) => setBudget(v as typeof budget)} />
        <Field label="What do you use now?" optional>{(p) => <Input {...p} value={currentProducts} maxLength={500} placeholder="e.g. bar soap and nothing else" onChange={(e) => setCurrent(e.target.value)} />}</Field>
        <Field label="Anything else?" optional>{(p) => <Textarea {...p} rows={2} value={notes} maxLength={500} placeholder="e.g. breakouts get worse before games" onChange={(e) => setNotes(e.target.value)} />}</Field>
        <label className="checkbox">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span className="small">{consentText(provider, photosAllowed && photos.some(Boolean), 'routine')}</span>
        </label>
        <div className="row-wrap">
          <Button type="submit" variant="primary" icon={Sparkles} loading={go.isPending} disabled={!consent}>{go.isPending ? 'Looking… (about 30 seconds)' : 'Find my products'}</Button>
        </div>
      </form>
    </Card>
  );
}

function Routine({ title, icon: Icon, steps }: { title: string; icon: typeof Sun; steps: SkinAdvice['morning'] }) {
  if (!steps.length) return null;
  return (
    <Card title={<span className="row-sm"><Icon aria-hidden style={{ width: 16 }} /> {title}</span>}>
      <ol className="look-steps">
        {steps.map((s, i) => (
          <li key={i}>
            <span className="cook-step__num">{i + 1}</span>
            <div className="stack-sm grow" style={{ gap: 6 }}>
              <div><span className="strong">{s.step}:</span> {s.productType}</div>
              <p className="small muted">{s.why}</p>
              {s.lookFor.length > 0 && <div className="row-wrap" style={{ gap: 6 }}><span className="xsmall subtle">Look for</span>{s.lookFor.map((x) => <Badge key={x} tone="success">{x}</Badge>)}</div>}
              {s.avoid.length > 0 && <div className="row-wrap" style={{ gap: 6 }}><span className="xsmall subtle">Avoid</span>{s.avoid.map((x) => <Badge key={x} tone="warning">{x}</Badge>)}</div>}
              {s.examples.length > 0 && <p className="xsmall subtle">Examples: {s.examples.join(' · ')}</p>}
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function SkinResult({ r, onAgain }: { r: LookReport<SkinAdvice>; onAgain: () => void }) {
  const qc = useQueryClient();
  const clear = useMutation({ mutationFn: () => api.del('/looks/skin'), onSuccess: () => qc.invalidateQueries({ queryKey: ['looks', 'skin'] }) });
  const a = r.result;
  return (
    <div className="stack-lg">
      <div className="look-summary">
        <p>{a.summary}</p>
        {a.observations.length > 0 && (
          <ul className="look-obs">{a.observations.map((o) => <li key={o.area}><span className="strong">{o.area}:</span> {o.note}</li>)}</ul>
        )}
        <p className="xsmall subtle">{r.usedPhotos ? 'From your photos and answers' : 'From your answers'} · {when(r.createdAt)} · Examples are common products, not endorsements; check the ingredients on what you buy.</p>
        <div className="row-wrap">
          <Button size="sm" icon={RotateCcw} onClick={onAgain}>Start again</Button>
          <Button size="sm" variant="ghost" loading={clear.isPending} onClick={() => clear.mutate()}>Delete this result</Button>
        </div>
      </div>
      <div className="grid-2">
        <Routine title="Morning" icon={Sun} steps={a.morning} />
        <Routine title="Evening" icon={Moon} steps={a.evening} />
      </div>
      {(a.weekly.length > 0 || a.habits.length > 0) && (
        <Card title="Habits that help">
          <ul className="small stack-sm" style={{ paddingLeft: 18 }}>{[...a.habits, ...a.weekly].map((h) => <li key={h}>{h}</li>)}</ul>
        </Card>
      )}
      {a.seeADoctorIf.length > 0 && (
        <Callout tone="warning" icon={Stethoscope} title="See a doctor or dermatologist if">
          <ul style={{ paddingLeft: 18 }}>{a.seeADoctorIf.map((s) => <li key={s}>{s}</li>)}</ul>
        </Callout>
      )}
    </div>
  );
}
