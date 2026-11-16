import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Clock, Lock, LockOpen, MoveRight, RotateCcw, SkipForward } from 'lucide-react';
import { useState } from 'react';
import type { ItemUpdateInput } from '@shared/schemas';
import { minToHhmm } from '@shared/domain/time';
import { api, errorMessage } from '@/lib/api';
import type { Item } from '@/lib/types';
import { CATEGORY, catColor, longDay, timeRange } from '@/lib/format';
import { Dialog, useToast } from '@/ui/overlay';
import { Badge, Button, Callout, Field, Input, Select, Textarea } from '@/ui/primitives';

export function useItemAction() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ItemUpdateInput }) => api.patch<{ item: Item }>(`/plan/items/${id}`, input),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['plan'] });
      qc.invalidateQueries({ queryKey: ['today'] });
      qc.invalidateQueries({ queryKey: ['progress'] });
      qc.invalidateQueries({ queryKey: ['fitness'] });
      const msg: Record<ItemUpdateInput['action'], string> = { complete: 'Marked done. Nice work.', skip: 'Skipped — no catch-up added.', reopen: 'Reopened.', lock: 'Updated.', move: 'Moved and locked in place.', shorten: 'Shortened.' };
      toast({
        message: msg[v.input.action],
        action: v.input.action === 'complete' || v.input.action === 'skip' ? { label: 'Undo', run: () => api.patch(`/plan/items/${v.id}`, { action: 'reopen' }).then(() => { qc.invalidateQueries({ queryKey: ['plan'] }); qc.invalidateQueries({ queryKey: ['today'] }); }) } : undefined,
      });
    },
    onError: (e) => toast({ message: errorMessage(e), tone: 'error' }),
  });
}

type Mode = 'view' | 'complete' | 'move' | 'shorten';

export function ItemDialog({ item, onClose, clock, weekDates }: { item: Item | null; onClose: () => void; clock: '12h' | '24h'; weekDates?: string[] }) {
  const [mode, setMode] = useState<Mode>('view');
  const [effort, setEffort] = useState(6);
  const [discomfort, setDiscomfort] = useState(0);
  const [note, setNote] = useState('');
  const [date, setDate] = useState('');
  const [start, setStart] = useState('');
  const [minutes, setMinutes] = useState(15);
  const action = useItemAction();
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setMode('view');
    setError(null);
    onClose();
  };
  if (!item) return <Dialog open={false} onClose={close} title="">{null}</Dialog>;

  const fixed = item.source === 'fixed';
  const duration = item.end - item.start;
  const training = ['workout', 'sport', 'recovery'].includes(item.category);
  const run = (input: ItemUpdateInput) =>
    action.mutate(
      { id: item.id, input },
      {
        onSuccess: close,
        onError: (e) => setError(errorMessage(e)),
      },
    );
  const Icon = CATEGORY[item.category].icon;

  let footer;
  if (mode === 'complete') {
    footer = (
      <>
        <Button variant="ghost" onClick={() => setMode('view')}>Back</Button>
        <Button variant="primary" icon={Check} loading={action.isPending} onClick={() => run({ action: 'complete', ...(training ? { effort, discomfort } : {}), note: note || undefined })}>Save</Button>
      </>
    );
  } else if (mode === 'move') {
    footer = (
      <>
        <Button variant="ghost" onClick={() => setMode('view')}>Back</Button>
        <Button variant="primary" loading={action.isPending} disabled={!date || !start} onClick={() => run({ action: 'move', date, start })}>Move</Button>
      </>
    );
  } else if (mode === 'shorten') {
    footer = (
      <>
        <Button variant="ghost" onClick={() => setMode('view')}>Back</Button>
        <Button variant="primary" loading={action.isPending} onClick={() => run({ action: 'shorten', minutes })}>Shorten</Button>
      </>
    );
  } else if (!fixed) {
    footer =
      item.status === 'planned' ? (
        <>
          <Button variant="ghost" icon={SkipForward} loading={action.isPending && action.variables?.input.action === 'skip'} onClick={() => run({ action: 'skip' })}>Skip</Button>
          <Button icon={MoveRight} onClick={() => { setDate(item.date); setStart(minToHhmm(item.start)); setMode('move'); }}>Move</Button>
          {duration > 10 && <Button icon={Clock} onClick={() => { setMinutes(Math.max(5, Math.round(duration / 2 / 5) * 5)); setMode('shorten'); }}>Shorten</Button>}
          <Button variant="primary" icon={Check} onClick={() => (training || item.category === 'study' ? setMode('complete') : run({ action: 'complete' }))}>Done</Button>
        </>
      ) : (
        <Button icon={RotateCcw} loading={action.isPending} onClick={() => run({ action: 'reopen' })}>Reopen</Button>
      );
  }

  return (
    <Dialog
      open
      onClose={close}
      title={item.title}
      description={`${longDay(item.date)} · ${timeRange(item.start, item.end, clock)}`}
      footer={footer}
    >
      <div className="stack">
        {error && <Callout tone="danger">{error}</Callout>}
        {mode === 'view' && (
          <>
            <div className="row-wrap">
              <Badge>
                <span className="cat-dot" style={{ background: catColor(item.category) }} />
                <Icon aria-hidden style={{ width: 12, height: 12 }} />
                {CATEGORY[item.category].label}
              </Badge>
              {fixed ? <Badge outline>Fixed commitment</Badge> : <Badge outline>Flexible</Badge>}
              {item.locked && <Badge tone="info" icon={Lock}>Locked</Badge>}
              {item.shortened && <Badge tone="warning">Shortened</Badge>}
              {item.displayStatus === 'done' && <Badge tone="success" icon={Check}>Done</Badge>}
              {item.displayStatus === 'skipped' && <Badge>Skipped</Badge>}
              {item.displayStatus === 'missed' && <Badge tone="warning">Missed</Badge>}
            </div>
            <div className="stack-sm">
              <div className="eyebrow">Why it’s here</div>
              <p className="small">{item.reason}</p>
            </div>
            {(item.travelBefore || item.travelAfter) ? (
              <p className="small muted">Includes {item.travelBefore} min travel before and {item.travelAfter} min after.</p>
            ) : null}
            {Array.isArray(item.meta?.steps) && (
              <div className="stack-sm">
                <div className="eyebrow">Suggested steps</div>
                <ol className="small" style={{ paddingLeft: 18 }}>
                  {(item.meta!.steps as string[]).map((s) => <li key={s}>{s}</li>)}
                </ol>
              </div>
            )}
            {item.effort !== null && (
              <p className="small muted">Logged effort {item.effort}/10{item.discomfort ? ` · discomfort ${item.discomfort}/10` : ''}{item.note ? ` · “${item.note}”` : ''}</p>
            )}
            {fixed ? (
              <Callout tone="info">Commitments are fixed constraints. To change one, edit it in Settings → Schedule; you’ll then review how the plan adapts.</Callout>
            ) : (
              <div className="row between">
                <span className="small muted">{item.locked ? 'Locked items stay put when you replan.' : 'Lock this to keep it in place when you replan.'}</span>
                <Button size="sm" variant="ghost" icon={item.locked ? LockOpen : Lock} onClick={() => run({ action: 'lock', locked: !item.locked })}>
                  {item.locked ? 'Unlock' : 'Lock'}
                </Button>
              </div>
            )}
          </>
        )}
        {mode === 'complete' && (
          <>
            {training && (
              <>
                <Field label={`How hard was it? ${effort}/10`} hint="1 = very easy, 10 = maximal effort">
                  {(p) => <input {...p} type="range" min={1} max={10} value={effort} onChange={(e) => setEffort(Number(e.target.value))} style={{ accentColor: 'var(--accent)' }} />}
                </Field>
                <Field label={`Any pain or discomfort? ${discomfort}/10`} hint="0 = none. Sharp or worsening pain is a reason to stop and get it checked.">
                  {(p) => <input {...p} type="range" min={0} max={10} value={discomfort} onChange={(e) => setDiscomfort(Number(e.target.value))} style={{ accentColor: 'var(--accent)' }} />}
                </Field>
                {discomfort >= 5 && <Callout tone="warning">That’s a notable amount of discomfort. Consider an easier variation next time, and talk to a clinician or physical therapist if it persists.</Callout>}
              </>
            )}
            <Field label="Note" optional>
              {(p) => <Textarea {...p} value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="What went well, what to change" />}
            </Field>
          </>
        )}
        {mode === 'move' && (
          <div className="grid-2">
            <Field label="Day">
              {(p) => (
                <Select {...p} value={date} onChange={(e) => setDate(e.target.value)}>
                  {(weekDates ?? [item.date]).map((d) => <option key={d} value={d}>{longDay(d)}</option>)}
                </Select>
              )}
            </Field>
            <Field label="Start time" hint={`Keeps the same length (${duration} min). Moved items are locked.`}>
              {(p) => <Input {...p} type="time" step={300} value={start} onChange={(e) => setStart(e.target.value)} />}
            </Field>
          </div>
        )}
        {mode === 'shorten' && (
          <Field label="New length" hint={`Currently ${duration} min.`}>
            {(p) => (
              <Select {...p} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
                {[5, 10, 15, 20, 25, 30, 40, 45, 60, 75, 90].filter((m) => m < duration).map((m) => <option key={m} value={m}>{m} minutes</option>)}
              </Select>
            )}
          </Field>
        )}
      </div>
    </Dialog>
  );
}
