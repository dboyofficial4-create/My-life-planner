import { SkinFinder } from '@/features/looks/SkinFinder';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Moon, Stethoscope, Sun, CalendarDays, AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import type { Routine, RoutineStep } from '@shared/domain/care/routines';
import { api, errorMessage } from '@/lib/api';
import { dayLabel } from '@/lib/format';
import { useToast } from '@/ui/overlay';
import { Badge, Button, Callout, Card, Chips, ErrorState, Input, PageHeader, PageSkeleton } from '@/ui/primitives';

interface CareData {
  skin: Routine | null;
  hair: Routine | null;
  checkins: { id: string; date: string; metric: string; value: number; note: string }[];
  today: string;
}

function Steps({ steps }: { steps: RoutineStep[] }) {
  return (
    <ol style={{ listStyle: 'none' }}>
      {steps.map((s, i) => (
        <li key={s.category} className="routine-step">
          <span className="step-num">{i + 1}</span>
          <div className="stack-sm" style={{ gap: 2 }}>
            <div className="row-wrap">
              <span className="small strong">{s.category}</span>
              {s.optional && <Badge outline>Optional</Badge>}
              {s.startWeek > 1 && <Badge tone="info">Add in week {s.startWeek}</Badge>}
            </div>
            <p className="small muted">{s.purpose}</p>
            <p className="xsmall">{s.how} <span className="subtle">· {s.frequency}</span></p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function RoutineCard({ r }: { r: Routine }) {
  return (
    <div className="stack-lg">
      <div className="grid-2">
        {r.am.length > 0 && <Card title={<span className="row-sm"><Sun aria-hidden style={{ width: 16 }} /> Morning</span>} action={<Badge>~{r.minutesAm} min</Badge>}><Steps steps={r.am} /></Card>}
        {r.pm.length > 0 && <Card title={<span className="row-sm"><Moon aria-hidden style={{ width: 16 }} /> Evening</span>} action={<Badge>~{r.minutesPm} min</Badge>}><Steps steps={r.pm} /></Card>}
        {r.weekly.length > 0 && <Card title={<span className="row-sm"><CalendarDays aria-hidden style={{ width: 16 }} /> Wash day</span>}><Steps steps={r.weekly} /></Card>}
      </div>
      <div className="grid-2">
        <Card title={<span className="row-sm"><AlertTriangle aria-hidden style={{ width: 16, color: 'var(--warning)' }} /> Good to know</span>} quiet>
          <ul className="small stack-sm" style={{ paddingLeft: 18 }}>{r.cautions.map((c) => <li key={c}>{c}</li>)}</ul>
        </Card>
        <Card title={<span className="row-sm"><Stethoscope aria-hidden style={{ width: 16 }} /> See a clinician if</span>} quiet>
          <ul className="small stack-sm" style={{ paddingLeft: 18 }}>{r.seeAClinicianIf.map((c) => <li key={c}>{c}</li>)}</ul>
        </Card>
      </div>
      <p className="xsmall subtle">{r.basis}</p>
    </div>
  );
}

export default function CarePage() {
  const q = useQuery({ queryKey: ['care'], queryFn: () => api.get<CareData>('/care') });
  if (q.isPending) return <PageSkeleton />;
  if (q.error) return <div className="page"><ErrorState error={q.error} onRetry={() => q.refetch()} /></div>;
  const d = q.data;
  return (
    <div className="page">
      <PageHeader title="Personal Care" description="Simple routines, introduced gradually. Recommendations are product categories — use what you already own where you can." actions={<Link to="/settings/care" className="btn btn-secondary btn-sm">Edit preferences</Link>} />
      <Callout tone="info">Waypoint doesn’t diagnose skin conditions or promise results. For anything painful, spreading or changing, see a doctor.</Callout>
      {d.skin && <SkinFinder />}
      {d.skin && (
        <section className="stack">
          <h2>{d.skin.title}</h2>
          <RoutineCard r={d.skin} />
        </section>
      )}
      {d.hair && (
        <section className="stack">
          <h2>{d.hair.title}</h2>
          <RoutineCard r={d.hair} />
        </section>
      )}
      <CheckIn d={d} />
    </div>
  );
}

function CheckIn({ d }: { d: CareData }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [kind, setKind] = useState<'skin' | 'hair'>(d.skin ? 'skin' : 'hair');
  const [rating, setRating] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const save = useMutation({
    mutationFn: () => api.post('/care/checkin', { kind, rating, note }),
    onSuccess: () => {
      setRating(null);
      setNote('');
      qc.invalidateQueries({ queryKey: ['care'] });
      toast({ message: 'Check-in saved.' });
    },
    onError: (e) => toast({ message: errorMessage(e), tone: 'error' }),
  });
  const recent = d.checkins.slice(-6).reverse();
  return (
    <Card title="Weekly check-in">
      <div className="stack">
        <p className="small muted">A quick note each week shows whether the routine is helping. Changes usually take several weeks.</p>
        {d.skin && d.hair && <Chips label="For" value={kind} onChange={(v) => setKind(v as 'skin' | 'hair')} options={[{ value: 'skin', label: 'Skin' }, { value: 'hair', label: 'Hair' }]} />}
        <Chips<number> label="How does it feel compared to last week?" value={rating} onChange={(v) => setRating(v as number)} options={[{ value: 1, label: 'Worse' }, { value: 2, label: 'A bit worse' }, { value: 3, label: 'Same' }, { value: 4, label: 'A bit better' }, { value: 5, label: 'Better' }]} />
        <Input aria-label="Note" placeholder="Optional note (e.g. new product started)" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
        <div><Button variant="primary" disabled={!rating} loading={save.isPending} onClick={() => save.mutate()}>Save check-in</Button></div>
        {recent.length > 0 && (
          <ul className="small stack-sm" style={{ listStyle: 'none' }}>
            {recent.map((c) => (
              <li key={c.id} className="row">
                <span className="subtle" style={{ width: 80 }}>{dayLabel(c.date)}</span>
                <Badge>{c.metric.startsWith('skin') ? 'Skin' : 'Hair'}</Badge>
                <span>{['', 'Worse', 'A bit worse', 'Same', 'A bit better', 'Better'][c.value]}</span>
                {c.note && <span className="muted truncate">— {c.note}</span>}
              </li>
            ))}
          </ul>
        )}
        {recent.filter((c) => c.value <= 2).length >= 2 && <Callout tone="warning">Two or more recent check-ins say things are getting worse. Consider pausing the newest product, and see a clinician if it continues.</Callout>}
      </div>
    </Card>
  );
}
