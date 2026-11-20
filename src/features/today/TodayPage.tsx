import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { ArrowRight, BookOpen, Check, CircleCheck, Coffee, Dumbbell, RefreshCcw, SkipForward, Sparkles, Utensils } from 'lucide-react';
import { useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import type { Item, Preview } from '@/lib/types';
import { CATEGORY, catColor, greeting, longDay, pluralize, relativeDay, relativeDayInline, time, timeRange } from '@/lib/format';
import { useToast } from '@/ui/overlay';
import { Badge, Button, Callout, Card, EmptyState, ErrorState, PageSkeleton, ProgressBar } from '@/ui/primitives';
import { ItemDialog, useItemAction } from '@/features/plan/ItemDialog';
import { AgendaRow } from '@/features/plan/PlanPage';
import { ReplanDialog, usePreview } from '@/features/plan/ReplanDialog';
import { ReminderPrompt } from './ReminderPrompt';
import { RecoveryPrompt } from './RecoveryPrompt';
import { ReadinessCard } from './ReadinessCard';
import { useMe } from '@/app/App';
import { agePolicy } from '@shared/domain/age';

interface TodayData {
  today: string;
  nowMinute: number;
  clock: '12h' | '24h';
  name: string;
  modules: string[];
  stale: boolean;
  warnings: string[];
  items: Item[];
  next: Item | null;
  upcoming: { id: string; title: string; dueDate: string; type: string; courseName: string | null; source: string }[];
  overdue: number;
  workout: null | { itemId: string; title: string; purpose: string; minutes: number; shortened: boolean; exercises: string[]; blocks: string[] };
  week: { start: string; categories: { category: string; done: number; total: number }[] };
}

export default function TodayPage() {
  const q = useQuery({ queryKey: ['today'], queryFn: () => api.get<TodayData>('/today'), refetchInterval: 5 * 60_000 });
  const [selected, setSelected] = useState<Item | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const previewMut = usePreview();
  const action = useItemAction();
  const toast = useToast();
  const me = useMe();

  if (q.isPending) return <PageSkeleton />;
  if (q.error) return <div className="page"><ErrorState error={q.error} onRetry={() => q.refetch()} /></div>;
  const d = q.data;
  const flexible = d.items.filter((i) => i.source !== 'fixed');
  const focus = flexible.filter((i) => !['meal', 'care'].includes(i.category));
  const meals = d.items.filter((i) => i.category === 'meal' || i.category === 'meal_prep');
  const care = d.items.filter((i) => i.category === 'care');
  const doneToday = flexible.filter((i) => i.status === 'done').length;
  const replan = () => previewMut.mutate(d.week.start, { onSuccess: setPreview, onError: (e) => toast({ message: errorMessage(e), tone: 'error' }) });

  const nextDue = d.upcoming[0];
  const adult = agePolicy(me.data?.user.birthday ?? null, d.today).band === 'adult';
  return (
    <div className="page today-page">
      <section className="today-hero" aria-labelledby="today-h">
        <div className="today-hero__text enter">
          <p className="today-kicker"><span className="live-dot" aria-hidden />{longDay(d.today)}</p>
          <h1 id="today-h" className="display">{greeting(d.nowMinute)}, {d.name}</h1>
          <p className="today-lead">
            {flexible.length
              ? `${doneToday} of ${pluralize(flexible.length, 'planned activity', 'planned activities')} done today.`
              : 'Nothing flexible planned today.'}
            {nextDue ? ` Next due: ${nextDue.title}, ${relativeDayInline(nextDue.dueDate, d.today)}.` : ''}
          </p>
          {flexible.length > 0 && <ProgressBar value={doneToday} max={flexible.length} label="Today's activities done" />}
          <div className="row-wrap">
            <Button variant="primary" icon={RefreshCcw} loading={previewMut.isPending} onClick={replan}>
              Replan rest of week
            </Button>
            <Link to="/plan" className="btn btn-secondary">Week view</Link>
          </div>
        </div>
        <div className="today-frame enter">
          <NextCard d={d} onOpen={setSelected} onDone={(it) => action.mutate({ id: it.id, input: { action: 'complete' } })} onSkip={(it) => action.mutate({ id: it.id, input: { action: 'skip' } })} busy={action.isPending} />
          {nextDue && (
            <Link to="/school" className="today-float">
              <span className="today-float__row"><span className="live-label">Due {relativeDayInline(nextDue.dueDate, d.today)}</span><span>{nextDue.courseName ?? nextDue.type}</span></span>
              <span className="today-float__title">{nextDue.title}</span>
            </Link>
          )}
        </div>
      </section>

      <ReminderPrompt />
      <RecoveryPrompt />

      {(d.modules.includes('fitness') || d.modules.includes('sports')) && <ReadinessCard onAdapt={replan} adult={adult} />}

      {d.stale && (
        <Callout tone="info" title="Something changed" action={<Button size="sm" variant="primary" onClick={replan} loading={previewMut.isPending}>Review</Button>}>
          Your settings or assignments changed. Review how your plan would adapt.
        </Callout>
      )}

      <div className="today-grid">
        <div className="stack-lg">
          <div className="app-window" role="region" aria-labelledby="agenda-h">
            <div className="app-window__bar">
              <span className="app-window__dots" aria-hidden><i /><i /><i /></span>
              <span className="app-window__crumb">Waypoint <i>/</i> <b id="agenda-h">Today’s agenda</b></span>
              <span className="grow" />
              <Link to="/plan" className="small">Week view</Link>
            </div>
            {d.items.length === 0 ? (
              <EmptyState icon={Coffee} title="A clear day">Nothing is scheduled. Enjoy the space, or add a commitment in Settings.</EmptyState>
            ) : (
              <ul style={{ listStyle: 'none' }}>
                {d.items.map((it) => (
                  <li key={it.id}>
                    <AgendaRow item={it} clock={d.clock} onSelect={setSelected} emphasize={d.next?.id === it.id} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="stack-lg">
          {focus.length > 0 && (
            <Card title="Focus for today">
              <ul className="stack-sm" style={{ listStyle: 'none' }}>
                {focus.slice(0, 4).map((it) => (
                  <li key={it.id} className="row">
                    <button
                      className="check"
                      data-checked={it.status === 'done'}
                      aria-label={it.status === 'done' ? `Mark ${it.title} not done` : `Mark ${it.title} done`}
                      onClick={() => action.mutate({ id: it.id, input: { action: it.status === 'done' ? 'reopen' : 'complete' } })}
                    >
                      <Check aria-hidden />
                    </button>
                    <button className="link-button grow truncate small" onClick={() => setSelected(it)} style={{ textDecoration: it.status === 'done' ? 'line-through' : undefined }}>
                      {it.title}
                    </button>
                    <span className="xsmall subtle num">{time(it.start, d.clock)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {d.workout && (
            <Card title={<span className="row-sm"><Dumbbell aria-hidden style={{ width: 16, color: catColor('workout') }} /> Today’s workout</span>} action={<Link to="/fitness" className="small">Details</Link>}>
              <div className="stack-sm">
                <div className="row between">
                  <span className="strong">{d.workout.title}</span>
                  <Badge>{d.workout.minutes} min{d.workout.shortened ? ' · express' : ''}</Badge>
                </div>
                <p className="small muted">{d.workout.purpose}</p>
                <p className="xsmall subtle">{[...d.workout.exercises, ...d.workout.blocks].join(' · ')}</p>
              </div>
            </Card>
          )}

          {d.modules.includes('school') && (
            <Card title={<span className="row-sm"><BookOpen aria-hidden style={{ width: 16, color: catColor('study') }} /> Coming up</span>} action={<Link to="/school" className="small">School</Link>} pad={false}>
              {d.overdue > 0 && (
                <div className="card-body" style={{ paddingBottom: 0 }}>
                  <Callout tone="warning">{pluralize(d.overdue, 'item is', 'items are')} past due. Mark them done or update the date in School.</Callout>
                </div>
              )}
              {d.upcoming.length === 0 ? (
                <p className="card-body small muted">Nothing due in the next 7 days.</p>
              ) : (
                <ul style={{ listStyle: 'none' }}>
                  {d.upcoming.map((a) => (
                    <li key={a.id} className="list-row">
                      <div className="grow">
                        <div className="small strong truncate">{a.title}</div>
                        <div className="xsmall subtle">{a.courseName ?? 'No course'}</div>
                      </div>
                      <Badge tone={a.dueDate === d.today ? 'danger' : 'neutral'}>{relativeDay(a.dueDate, d.today)}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          {meals.length > 0 && (
            <Card title={<span className="row-sm"><Utensils aria-hidden style={{ width: 16, color: catColor('meal') }} /> Meals</span>} action={d.modules.includes('nutrition') ? <Link to="/food" className="small">Food</Link> : undefined}>
              <ul className="stack-sm" style={{ listStyle: 'none' }}>
                {meals.map((m) => (
                  <li key={m.id} className="row small">
                    <span className="subtle num" style={{ width: 64 }}>{time(m.start, d.clock)}</span>
                    <span className="truncate grow">{m.title}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {care.length > 0 && (
            <Card title={<span className="row-sm"><Sparkles aria-hidden style={{ width: 16, color: catColor('care') }} /> Personal care</span>} action={<Link to="/care" className="small">Routines</Link>}>
              <ul className="stack-sm" style={{ listStyle: 'none' }}>
                {care.map((c) => (
                  <li key={c.id} className="row small">
                    <button className="check" data-checked={c.status === 'done'} aria-label={c.status === 'done' ? `Mark ${c.title} not done` : `Mark ${c.title} done`} onClick={() => action.mutate({ id: c.id, input: { action: c.status === 'done' ? 'reopen' : 'complete' } })}>
                      <Check aria-hidden />
                    </button>
                    <span className="grow truncate">{c.title}</span>
                    <span className="subtle num xsmall">{time(c.start, d.clock)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

        </div>
      </div>

      {d.week.categories.length > 0 && (
        <section className="week-band" aria-labelledby="week-h">
          <div className="week-band__head">
            <h2 id="week-h" className="display-sm">This week so far</h2>
            <p>Counts only what’s planned this week. Skipping is fine: consistency beats perfection.</p>
            <Link to="/progress" className="week-band__link">See progress <ArrowRight aria-hidden /></Link>
          </div>
          <div className="week-band__grid">
            {d.week.categories.map((c) => (
              <div key={c.category} className="week-stat">
                <span className="week-stat__label">{CATEGORY[c.category as keyof typeof CATEGORY]?.label ?? c.category}</span>
                <span className="week-stat__num num">{c.done}<small> / {c.total}</small></span>
                <ProgressBar value={c.done} max={c.total} label={`${c.category} completed`} />
              </div>
            ))}
          </div>
        </section>
      )}

      <ItemDialog item={selected} onClose={() => setSelected(null)} clock={d.clock} />
      <ReplanDialog preview={preview} onClose={() => setPreview(null)} clock={d.clock} />
    </div>
  );
}

function NextCard({ d, onOpen, onDone, onSkip, busy }: { d: TodayData; onOpen: (i: Item) => void; onDone: (i: Item) => void; onSkip: (i: Item) => void; busy: boolean }) {
  const n = d.next;
  if (!n) {
    return (
      <div className="card next-card">
        <div className="row">
          <CircleCheck aria-hidden style={{ width: 28, height: 28, color: 'var(--accent)' }} />
          <div>
            <h2>That’s everything for today</h2>
            <p className="small muted">Rest up. Tomorrow’s plan is ready in the Plan view.</p>
          </div>
        </div>
      </div>
    );
  }
  const Icon = CATEGORY[n.category].icon;
  const inProgress = n.start <= d.nowMinute;
  return (
    <div className="card next-card" style={{ ['--c' as string]: catColor(n.category) }}>
      <div className="eyebrow">{inProgress ? 'Happening now' : `Up next · ${time(n.start, d.clock)}`}</div>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <span className="next-icon">
          <Icon aria-hidden />
        </span>
        <div className="grow stack-sm" style={{ gap: 4 }}>
          <h2 style={{ fontSize: 'var(--text-lg)' }}>{n.title}</h2>
          <p className="small muted">{timeRange(n.start, n.end, d.clock)} · {n.end - n.start} min{n.source === 'fixed' ? ' · fixed commitment' : ''}</p>
          <p className="small">{n.reason}</p>
        </div>
      </div>
      <div className="row-wrap">
        {n.source !== 'fixed' && (
          <>
            <Button variant="primary" icon={Check} onClick={() => onDone(n)} disabled={busy}>
              Mark done
            </Button>
            <Button icon={SkipForward} onClick={() => onSkip(n)} disabled={busy}>
              Skip
            </Button>
          </>
        )}
        <Button variant="ghost" onClick={() => onOpen(n)}>
          {n.source === 'fixed' ? 'Details' : 'Move or shorten'} <ArrowRight aria-hidden />
        </Button>
      </div>
    </div>
  );
}
