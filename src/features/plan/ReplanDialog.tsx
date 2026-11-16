import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Check, Minus, Plus, Scissors } from 'lucide-react';
import { useState } from 'react';
import type { PlanChange } from '@shared/domain/planner/replan';
import { api, errorMessage } from '@/lib/api';
import type { Preview } from '@/lib/types';
import { catColor, dayLabel, pluralize, timeRange } from '@/lib/format';
import { Dialog, useToast } from '@/ui/overlay';
import { Badge, Button, Callout, EmptyState } from '@/ui/primitives';

export function usePreview() {
  return useMutation({ mutationFn: (weekStart: string) => api.post<Preview>('/plan/preview', { weekStart }) });
}

const ICON = { added: Plus, removed: Minus, moved: ArrowRight, shortened: Scissors, unchanged: Check };
const TONE = { added: 'success', removed: 'danger', moved: 'info', shortened: 'warning', unchanged: 'neutral' } as const;

function ChangeRow({ c, clock }: { c: PlanChange; clock: '12h' | '24h' }) {
  const Icon = ICON[c.type];
  const at = (x?: { date: string; start: number; end: number }) => (x ? `${dayLabel(x.date)} ${timeRange(x.start, x.end, clock)}` : '');
  return (
    <li className="list-row" style={{ padding: 'var(--s-3) 0' }}>
      <span className="cat-dot" style={{ background: catColor(c.category) }} />
      <div className="grow">
        <div className="small strong truncate">{c.title}</div>
        <div className="xsmall muted">
          {c.type === 'added' && at(c.to)}
          {c.type === 'removed' && <s>{at(c.from)}</s>}
          {(c.type === 'moved' || c.type === 'shortened') && (
            <>
              <s>{at(c.from)}</s> → {at(c.to)}
            </>
          )}
        </div>
      </div>
      <Badge tone={TONE[c.type]} icon={Icon}>
        {c.type}
      </Badge>
    </li>
  );
}

export function ReplanDialog({ preview, onClose, clock }: { preview: Preview | null; onClose: () => void; clock: '12h' | '24h' }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [showAll, setShowAll] = useState(false);
  const apply = useMutation({
    mutationFn: (proposalId: string) => api.post('/plan/apply', { proposalId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plan'] });
      qc.invalidateQueries({ queryKey: ['today'] });
      toast({ message: 'Plan updated.' });
      onClose();
    },
  });
  if (!preview) return null;
  const visible = preview.changes.filter((c) => c.type !== 'unchanged' && (showAll || !(c.category === 'meal' || c.category === 'care')));
  const hiddenRoutine = preview.changes.filter((c) => c.type !== 'unchanged' && (c.category === 'meal' || c.category === 'care')).length;
  const total = preview.summary.added + preview.summary.removed + preview.summary.moved + preview.summary.shortened;
  return (
    <Dialog
      open
      wide
      onClose={onClose}
      title="Review plan changes"
      description="Nothing changes until you apply. Completed, skipped and locked items are never touched."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Keep current plan
          </Button>
          <Button variant="primary" icon={Check} loading={apply.isPending} disabled={total === 0} onClick={() => apply.mutate(preview.proposalId)}>
            Apply {pluralize(total, 'change')}
          </Button>
        </>
      }
    >
      <div className="stack">
        {apply.error && <Callout tone="danger">{errorMessage(apply.error)}</Callout>}
        <div className="row-wrap">
          <Badge tone="success">{preview.summary.added} added</Badge>
          <Badge tone="info">{preview.summary.moved} moved</Badge>
          <Badge tone="warning">{preview.summary.shortened} shortened</Badge>
          <Badge tone="danger">{preview.summary.removed} removed</Badge>
          <Badge>{preview.summary.unchanged} unchanged</Badge>
        </div>
        {preview.carryOver.length > 0 && (
          <Callout tone="info" title="Missed sessions">
            {preview.carryOver.map((c) => (
              <div key={c.title}>
                {c.title}: {c.carried ? `${c.carried} rescheduled` : ''}
                {c.carried && c.dropped ? ', ' : ''}
                {c.dropped ? `${c.dropped} let go so you don’t build a backlog` : ''}.
              </div>
            ))}
          </Callout>
        )}
        {preview.warnings.map((w) => (
          <Callout key={w} tone="warning">
            {w}
          </Callout>
        ))}
        {total === 0 ? (
          <EmptyState icon={Check} title="Your plan is already up to date">
            Nothing would change.
          </EmptyState>
        ) : (
          <ul className="list" style={{ listStyle: 'none' }}>
            {visible.map((c, i) => (
              <ChangeRow key={i} c={c} clock={clock} />
            ))}
          </ul>
        )}
        {!showAll && hiddenRoutine > 0 && (
          <Button size="sm" variant="ghost" onClick={() => setShowAll(true)}>
            Show {pluralize(hiddenRoutine, 'meal or routine time change')}
          </Button>
        )}
        {preview.unscheduled.length > 0 && (
          <div className="stack-sm">
            <div className="eyebrow">Still won’t fit</div>
            {preview.unscheduled.map((u) => (
              <p key={u.requestKey} className="small">
                <span className="strong">{u.title}</span> — {u.reason}
              </p>
            ))}
          </div>
        )}
      </div>
    </Dialog>
  );
}
