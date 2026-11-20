import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { useState } from 'react';
import { CalendarPlus, Link2, MapPin, Trophy, Upload } from 'lucide-react';
import clsx from 'clsx';
import { api, errorMessage } from '@/lib/api';
import { relativeDay, time } from '@/lib/format';
import { Dialog, useToast } from '@/ui/overlay';
import { Badge, Button, Callout, Card, EmptyState, Field, Input, Skeleton, Tabs } from '@/ui/primitives';

interface Game { id: string; commitmentId: string; title: string; date: string; start: number; end: number; travelBefore: number; travelAfter: number }
interface GamesData { today: string; games: Game[]; nextGameDay: { title: string; date: string; start: number; end: number; category: string; reason: string }[] }
interface PreviewEvent { uid: string; title: string; date: string; start: number | null; end: number | null; location: string; kind: 'game' | 'practice'; away: boolean; alreadyImported: boolean }

export function GamesPanel() {
  const q = useQuery({ queryKey: ['games'], queryFn: () => api.get<GamesData>('/sports/games') });
  const [importing, setImporting] = useState(false);
  if (q.isPending) return <Card><Skeleton h={160} /></Card>;
  if (q.error) return <Callout tone="danger">{errorMessage(q.error)}</Callout>;
  const d = q.data;
  const next = d.games[0];
  return (
    <div className="stack-lg">
      <div className="row-wrap between">
        <p className="small muted" style={{ maxWidth: '60ch' }}>Game days get a pre-game meal and snack at the right times, a recovery snack after, lighter training the day before and easy recovery the day after.</p>
        <div className="row-wrap">
          <Button variant="primary" icon={CalendarPlus} onClick={() => setImporting(true)}>Import team schedule</Button>
          <Link to="/settings/schedule" className="btn btn-secondary">Add a game by hand</Link>
        </div>
      </div>

      {!next ? (
        <Card><EmptyState icon={Trophy} title="No games coming up">Import your team’s schedule (most team apps and school athletics sites have a calendar link), or add games by hand.</EmptyState></Card>
      ) : (
        <>
          <Card title={<span className="row-sm"><Trophy aria-hidden style={{ width: 16 }} /> Next game: {relativeDay(next.date, d.today)}</span>}>
            <div className="stack">
              <div>
                <div className="strong">{next.title}</div>
                <div className="small muted">{time(next.start)} to {time(next.end)}{next.travelBefore ? ` · leave about ${time(next.start - next.travelBefore)}` : ''}</div>
              </div>
              {d.nextGameDay.length ? (
                <ol className="gameday">
                  {d.nextGameDay.map((i) => (
                    <li key={`${i.date}-${i.start}-${i.title}`} className={clsx('gameday__item', `is-${i.category}`)}>
                      <span className="gameday__time num">{i.date === next.date ? time(i.start) : relativeDay(i.date, d.today)}</span>
                      <div>
                        <div className="small strong">{i.title}</div>
                        {i.reason && <div className="xsmall muted">{i.reason}</div>}
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <Callout tone="info" action={<Link to="/plan" className="btn btn-sm btn-primary">Review plan</Link>}>Review your plan to add the game-day meals and recovery.</Callout>
              )}
            </div>
          </Card>
          <Card title="Upcoming games" pad={false}>
            <ul style={{ listStyle: 'none' }}>
              {d.games.map((g) => (
                <li key={g.id} className="list-row">
                  <div className="grow">
                    <div className="small strong">{g.title}</div>
                    <div className="xsmall subtle">{time(g.start)} to {time(g.end)}{g.travelBefore ? ` · ${g.travelBefore} min travel` : ''}</div>
                  </div>
                  <Badge tone={g.date === d.today ? 'accent' : 'neutral'}>{relativeDay(g.date, d.today)}</Badge>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
      {importing && <ImportDialog onClose={() => setImporting(false)} />}
    </div>
  );
}

function ImportDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [how, setHow] = useState<'link' | 'file'>('link');
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState<PreviewEvent[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [travelAway, setTravelAway] = useState(45);
  const [travelHome, setTravelHome] = useState(10);
  const preview = useMutation({
    mutationFn: (body: { url?: string; text?: string }) => api.post<{ events: PreviewEvent[]; past: number; skipped: number }>('/sports/schedule/preview', body),
    onSuccess: (r) => { setEvents(r.events); setPicked(new Set(r.events.filter((e) => e.start !== null).map((e) => e.uid))); },
  });
  const save = useMutation({
    mutationFn: () => api.post<{ added: number; updated: number }>('/sports/schedule/import', {
      events: events!.filter((e) => picked.has(e.uid) && e.start !== null).map((e) => ({ uid: e.uid, title: e.title, date: e.date, start: e.start!, end: e.end ?? e.start! + 120, location: e.location, kind: e.kind, away: e.away })),
      travelAway,
      travelHome,
    }),
    onSuccess: (r) => {
      qc.invalidateQueries();
      toast({ message: `${r.added} added${r.updated ? `, ${r.updated} updated` : ''}. Review your plan to fit them in.` });
      onClose();
    },
    onError: (e) => toast({ message: errorMessage(e), tone: 'error' }),
  });
  const update = (uid: string, p: Partial<PreviewEvent>) => setEvents((all) => all!.map((e) => (e.uid === uid ? { ...e, ...p } : e)));

  return (
    <Dialog open onClose={onClose} title="Import team schedule" description="From your team app or school athletics site. Only future events are shown." wide>
      {!events ? (
        <div className="stack">
          <Tabs label="Import from" value={how} onChange={setHow} tabs={[{ value: 'link', label: 'Calendar link' }, { value: 'file', label: '.ics file' }]} />
          {preview.error && <Callout tone="danger">{errorMessage(preview.error)}</Callout>}
          {how === 'link' ? (
            <form className="stack" onSubmit={(e) => { e.preventDefault(); preview.mutate({ url }); }}>
              <Field label="Calendar link" hint="Look for “Subscribe”, “Sync to calendar” or “iCal” in your team app (TeamSnap, GameChanger, SportsEngine…) or on the school’s athletics page. It starts with webcal:// or https://.">
                {(p) => <Input {...p} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="webcal://…" />}
              </Field>
              <div><Button type="submit" variant="primary" icon={Link2} loading={preview.isPending} disabled={!url.trim()}>Get events</Button></div>
            </form>
          ) : (
            <label className="btn btn-secondary" style={{ width: 'fit-content' }}>
              <Upload aria-hidden /> Choose .ics file
              <input type="file" accept=".ics,text/calendar" hidden onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) preview.mutate({ text: await f.text() }); }} />
            </label>
          )}
        </div>
      ) : events.length === 0 ? (
        <EmptyState icon={Trophy} title="No upcoming events">That calendar has nothing in the next six months.</EmptyState>
      ) : (
        <div className="stack">
          <div className="row-wrap">
            <Field label="Travel to away games (min each way)">{(p) => <Input {...p} type="number" min={0} max={180} value={travelAway} onChange={(e) => setTravelAway(Math.max(0, Math.min(180, Number(e.target.value) || 0)))} style={{ width: 110 }} />}</Field>
            <Field label="Travel to home games (min)">{(p) => <Input {...p} type="number" min={0} max={180} value={travelHome} onChange={(e) => setTravelHome(Math.max(0, Math.min(180, Number(e.target.value) || 0)))} style={{ width: 110 }} />}</Field>
          </div>
          <ul className="import-list">
            {events.map((e) => (
              <li key={e.uid} className={clsx(!picked.has(e.uid) && 'is-off')}>
                <label className="checkbox grow" style={{ minWidth: 0 }}>
                  <input type="checkbox" disabled={e.start === null} checked={picked.has(e.uid)} onChange={(x) => setPicked((s) => { const n = new Set(s); if (x.target.checked) n.add(e.uid); else n.delete(e.uid); return n; })} />
                  <span className="grow" style={{ minWidth: 0 }}>
                    <span className="small strong" style={{ display: 'block' }}>{e.title}{e.alreadyImported && <span className="xsmall subtle"> · already added (will update)</span>}</span>
                    <span className="xsmall subtle">{new Date(`${e.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} · {e.start === null ? 'no time (all day), skipped' : `${time(e.start)} to ${time(e.end ?? e.start + 120)}`}{e.location && <> · <MapPin aria-hidden style={{ width: 11, display: 'inline' }} /> {e.location}</>}</span>
                  </span>
                </label>
                {e.start !== null && (
                  <div className="row-sm">
                    <select className="select" aria-label={`Type of ${e.title}`} value={e.kind} onChange={(x) => update(e.uid, { kind: x.target.value as PreviewEvent['kind'] })} style={{ width: 'auto' }}>
                      <option value="game">Game</option>
                      <option value="practice">Practice</option>
                    </select>
                    {e.kind === 'game' && (
                      <label className="checkbox xsmall"><input type="checkbox" checked={e.away} onChange={(x) => update(e.uid, { away: x.target.checked })} /> Away</label>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
          <div className="row-wrap">
            <Button variant="primary" loading={save.isPending} disabled={!picked.size} onClick={() => save.mutate()}>Add {picked.size} event{picked.size === 1 ? '' : 's'}</Button>
            <Button variant="ghost" onClick={() => setEvents(null)}>Back</Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
