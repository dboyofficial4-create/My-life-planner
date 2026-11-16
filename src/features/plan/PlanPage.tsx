import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CalendarRange, ChevronLeft, ChevronRight, Lock, RefreshCcw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { addDays, startOfWeek } from '@shared/domain/time';
import { api, errorMessage } from '@/lib/api';
import type { Item, PlanResponse, Preview } from '@/lib/types';
import { CATEGORY, catColor, dayLabel, pluralize, time, timeRange } from '@/lib/format';
import { useToast } from '@/ui/overlay';
import { Badge, Button, Callout, Card, EmptyState, ErrorState, PageHeader, PageSkeleton, Segmented } from '@/ui/primitives';
import { ItemDialog } from './ItemDialog';
import { ReplanDialog, usePreview } from './ReplanDialog';

const HOUR_PX = 44;

export default function PlanPage() {
  const [week, setWeek] = useState<string | null>(null);
  const q = useQuery({ queryKey: ['plan', week], queryFn: () => api.get<PlanResponse>(`/plan${week ? `?week=${week}` : ''}`) });
  const [view, setView] = useState<'week' | 'list'>(() => (typeof window !== 'undefined' && window.innerWidth < 900 ? 'list' : 'week'));
  const [selected, setSelected] = useState<Item | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const previewMut = usePreview();
  const toast = useToast();

  if (q.isPending) return <PageSkeleton />;
  if (q.error) return <div className="page"><ErrorState error={q.error} onRetry={() => q.refetch()} /></div>;
  const data = q.data;
  const clock = data.clock;
  const thisWeek = startOfWeek(data.today);
  const runPreview = () =>
    previewMut.mutate(data.weekStart, {
      onSuccess: setPreview,
      onError: (e) => toast({ message: errorMessage(e), tone: 'error' }),
    });

  return (
    <div className="page">
      <PageHeader
        title="Plan"
        description={`Week of ${dayLabel(data.weekStart, { month: 'long', day: 'numeric' })}`}
        actions={
          <>
            <div className="row-sm">
              <Button size="sm" iconOnly icon={ChevronLeft} aria-label="Previous week" onClick={() => setWeek(addDays(data.weekStart, -7))} />
              <Button size="sm" onClick={() => setWeek(null)} disabled={data.weekStart === thisWeek}>
                This week
              </Button>
              <Button size="sm" iconOnly icon={ChevronRight} aria-label="Next week" onClick={() => setWeek(addDays(data.weekStart, 7))} disabled={!data.canPlan && data.weekStart > thisWeek} />
            </div>
            <Segmented label="View" value={view} onChange={setView} options={[{ value: 'week', label: 'Week' }, { value: 'list', label: 'List' }]} />
            {data.canPlan && (
              <Button size="sm" variant={data.plan?.stale || !data.items.length ? 'primary' : 'secondary'} icon={RefreshCcw} loading={previewMut.isPending} onClick={runPreview}>
                {data.items.length ? 'Replan' : 'Build this week'}
              </Button>
            )}
          </>
        }
      />

      {data.plan?.stale && (
        <Callout tone="info" title="Your inputs changed" action={<Button size="sm" variant="primary" onClick={runPreview} loading={previewMut.isPending}>Review changes</Button>}>
          Settings, commitments or assignments were updated. Review how the plan would adapt before anything moves.
        </Callout>
      )}
      {data.plan?.warnings.map((w) => (
        <Callout key={w} tone="warning">
          {w}
        </Callout>
      ))}

      {!data.items.length ? (
        <Card>
          <EmptyState
            icon={CalendarRange}
            title={data.canPlan ? 'No plan for this week yet' : 'No plan for this week'}
            action={data.canPlan ? <Button variant="primary" onClick={runPreview} loading={previewMut.isPending}>Build this week</Button> : undefined}
          >
            {data.canPlan ? 'Build it now to see a preview first.' : 'This week is outside the planning window.'}
          </EmptyState>
        </Card>
      ) : view === 'week' ? (
        <WeekGrid data={data} onSelect={setSelected} />
      ) : (
        <WeekList data={data} onSelect={setSelected} />
      )}

      {data.plan && data.plan.unscheduled.length > 0 && <Unscheduled data={data} />}
      {data.plan && data.plan.notes.length > 0 && (
        <Card title="How this plan was built" quiet>
          <ul className="small muted stack-sm" style={{ paddingLeft: 18 }}>
            {data.plan.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </Card>
      )}
      <Legend />

      <ItemDialog item={selected} onClose={() => setSelected(null)} clock={clock} weekDates={data.dates} />
      <ReplanDialog preview={preview} onClose={() => setPreview(null)} clock={clock} />
    </div>
  );
}

function Unscheduled({ data }: { data: PlanResponse }) {
  return (
    <Card title={<span className="row-sm"><AlertTriangle aria-hidden style={{ width: 16, color: 'var(--warning)' }} /> Didn’t fit this week</span>}>
      <ul className="stack" style={{ listStyle: 'none' }}>
        {data.plan!.unscheduled.map((u) => (
          <li key={u.requestKey} className="stack-sm" style={{ gap: 2 }}>
            <div className="row-sm">
              <span className="cat-dot" style={{ background: catColor(u.category) }} />
              <span className="strong small">{u.title}</span>
              <Badge>{u.placed} of {u.wanted} placed</Badge>
            </div>
            <p className="small muted">{u.reason}</p>
            <p className="xsmall subtle">{u.suggestion}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Legend() {
  const cats = ['commitment', 'sport', 'workout', 'recovery', 'study', 'meal', 'care'] as const;
  return (
    <div className="row-wrap xsmall subtle" aria-label="Legend">
      {cats.map((c) => (
        <span key={c} className="row-sm">
          <span className="cat-dot" style={{ background: catColor(c) }} />
          {CATEGORY[c].label}
        </span>
      ))}
      <span className="row-sm"><Lock aria-hidden style={{ width: 12 }} /> Locked</span>
      <span className="row-sm"><span className="legend-fixed" /> Fixed</span>
    </div>
  );
}

function itemClass(it: Item) {
  return clsx('block', `status-${it.displayStatus}`, it.source === 'fixed' && 'block-fixed');
}

function WeekGrid({ data, onSelect }: { data: PlanResponse; onSelect: (i: Item) => void }) {
  const range = useMemo(() => {
    const starts = Object.values(data.awake).map((a) => a.start);
    const ends = Object.values(data.awake).map((a) => a.end);
    const itemStarts = data.items.map((i) => i.start - (i.travelBefore ?? 0));
    const itemEnds = data.items.map((i) => i.end + (i.travelAfter ?? 0));
    const lo = Math.floor(Math.min(...starts, ...itemStarts) / 60) * 60;
    const hi = Math.ceil(Math.max(...ends, ...itemEnds) / 60) * 60;
    return { lo, hi: Math.min(hi, 1440) };
  }, [data]);
  const hours = Array.from({ length: (range.hi - range.lo) / 60 }, (_, i) => range.lo + i * 60);
  const y = (m: number) => ((m - range.lo) / 60) * HOUR_PX;
  return (
    <div className="card week" role="region" aria-label="Week calendar">
      <div className="week-head">
        <div />
        {data.dates.map((d) => (
          <div key={d} className={clsx('week-day', d === data.today && 'is-today')}>
            <span>{dayLabel(d, { weekday: 'short' })}</span>
            <strong className="num">{d.slice(8)}</strong>
          </div>
        ))}
      </div>
      <div className="week-body" style={{ height: hours.length * HOUR_PX }}>
        <div className="week-hours" aria-hidden>
          {hours.map((h) => (
            <div key={h} style={{ top: y(h) }}>
              {time(h, data.clock).replace(':00', '')}
            </div>
          ))}
        </div>
        {data.dates.map((d) => {
          const awake = data.awake[d]!;
          return (
            <div key={d} className={clsx('week-col', d === data.today && 'is-today')}>
              <div className="asleep" style={{ top: 0, height: Math.max(0, y(awake.start)) }} />
              <div className="asleep" style={{ top: y(awake.end), bottom: 0 }} />
              {hours.map((h) => (
                <div key={h} className="hour-line" style={{ top: y(h) }} />
              ))}
              {d === data.today && data.nowMinute >= range.lo && data.nowMinute <= range.hi && <div className="now-line" style={{ top: y(data.nowMinute) }} aria-hidden />}
              {data.items
                .filter((i) => i.date === d)
                .map((it) => (
                  <div key={it.id}>
                    {!!it.travelBefore && <div className="travel" style={{ top: y(it.start - it.travelBefore), height: (it.travelBefore / 60) * HOUR_PX }} aria-hidden />}
                    {!!it.travelAfter && <div className="travel" style={{ top: y(it.end), height: (it.travelAfter / 60) * HOUR_PX }} aria-hidden />}
                    <button
                      className={itemClass(it)}
                      style={{ top: y(it.start), height: Math.max(18, ((it.end - it.start) / 60) * HOUR_PX - 2), ['--c' as string]: catColor(it.category) }}
                      onClick={() => onSelect(it)}
                      aria-label={`${it.title}, ${dayLabel(d, { weekday: 'long' })} ${timeRange(it.start, it.end, data.clock)}${it.displayStatus !== 'planned' ? `, ${it.displayStatus}` : ''}`}
                    >
                      <span className="block-title">
                        {it.locked && <Lock aria-hidden />}
                        {it.title}
                      </span>
                      {it.end - it.start >= 40 && <span className="block-time">{timeRange(it.start, it.end, data.clock)}</span>}
                    </button>
                  </div>
                ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekList({ data, onSelect }: { data: PlanResponse; onSelect: (i: Item) => void }) {
  return (
    <div className="stack">
      {data.dates.map((d) => {
        const items = data.items.filter((i) => i.date === d);
        return (
          <Card key={d} title={<span className="row-sm">{dayLabel(d, { weekday: 'long', month: 'short', day: 'numeric' })}{d === data.today && <Badge tone="accent">Today</Badge>}</span>} action={<span className="xsmall subtle">{pluralize(items.filter((i) => i.source !== 'fixed').length, 'activity', 'activities')}</span>} pad={false}>
            {items.length === 0 ? (
              <p className="card-body small muted">Nothing planned — a free day.</p>
            ) : (
              <ul style={{ listStyle: 'none' }}>
                {items.map((it) => (
                  <li key={it.id}>
                    <AgendaRow item={it} clock={data.clock} onSelect={onSelect} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        );
      })}
    </div>
  );
}

export function AgendaRow({ item, clock, onSelect, emphasize }: { item: Item; clock: '12h' | '24h'; onSelect: (i: Item) => void; emphasize?: boolean }) {
  const Icon = CATEGORY[item.category].icon;
  return (
    <button className={clsx('list-row list-row-button agenda-row', `status-${item.displayStatus}`, emphasize && 'is-next')} onClick={() => onSelect(item)}>
      <span className="agenda-time num">{time(item.start, clock)}</span>
      <span className="agenda-icon" style={{ color: catColor(item.category) }}>
        <Icon aria-hidden />
      </span>
      <span className="grow">
        <span className="agenda-title truncate" style={{ display: 'block' }}>{item.title}</span>
        <span className="xsmall subtle">
          {item.end - item.start} min
          {item.source === 'fixed' ? ' · fixed' : ''}
          {item.shortened ? ' · shortened' : ''}
        </span>
      </span>
      {item.locked && <Lock aria-label="Locked" style={{ width: 14, color: 'var(--text-3)' }} />}
      {item.displayStatus === 'done' && <Badge tone="success">Done</Badge>}
      {item.displayStatus === 'skipped' && <Badge>Skipped</Badge>}
      {item.displayStatus === 'missed' && <Badge tone="warning">Missed</Badge>}
    </button>
  );
}
