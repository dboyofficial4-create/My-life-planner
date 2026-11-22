import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { BookOpen, ExternalLink, Flag, Compass as CompassIcon, PlayCircle, ShieldCheck, Sparkles, Target, Trash2, TrendingDown, TrendingUp, Trophy } from 'lucide-react';
import { useState } from 'react';
import type { Drill, Skill, SkillTest, SourceRef } from '@shared/domain/sports/catalog';
import { pitchSmartRest } from '@shared/domain/sports/catalog';
import type { SportsPrefs } from '@shared/schemas';
import { api, errorMessage, fieldErrors } from '@/lib/api';
import { askCoach } from '@/lib/coach';
import { dayLabel } from '@/lib/format';
import { useToast } from '@/ui/overlay';
import { Badge, Button, Callout, Card, Chips, EmptyState, ErrorState, Field, Input, NumberInput, Skeleton } from '@/ui/primitives';

interface TestView extends SkillTest {
  results: { id: string; date: string; value: number; note: string }[];
  summary: null | { baseline: { date: string; value: number }; latest: { date: string; value: number }; best: number; change: number | null; improved: boolean | null };
}
interface SportView {
  prefs: SportsPrefs['sports'][number];
  label: string;
  skills: Skill[];
  focus: string[];
  drills: (Drill & { source: SourceRef | null })[];
  tests: TestView[];
  sources: SourceRef[];
  channels: { name: string; url: string; official: boolean }[];
  safety: string[];
  status: { value: string; label: string; development: boolean };
  tryout: { phase: string; daysLeft: number | null; label: string; focus: string };
  dose: { sessions: number; minutes: number };
  cutSteps: { title: string; detail: string }[];
  priorities: { skill: string; label: string; score: number; reasons: string[]; trend: 'down' | 'flat' | 'up' | 'none'; level: 1 | 2 | 3 }[];
  week: { skill: string; label: string; why: string; drills: { id: string; name: string; minutes: number; solo: boolean; level: number }[] }[];
  positionInfo: { name: string; blurb: string; conditioning: string; strength: string; advanced: boolean }[];
}
interface SportsData {
  today: string;
  age: number | null;
  youtube: boolean;
  sports: SportView[];
}
interface Video {
  videoId: string;
  title: string;
  channelName: string;
  official: boolean;
  publishedAt: string;
  thumbnail: string | null;
  url: string;
}

export function SportsPanel() {
  const q = useQuery({ queryKey: ['sports'], queryFn: () => api.get<SportsData>('/sports') });
  if (q.isPending) return <Skeleton h={320} r={12} />;
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (!q.data.sports.length) {
    return <Card><EmptyState icon={Trophy} title="No sport added yet" action={<Link className="btn btn-primary" to="/settings/fitness">Add a sport</Link>}>Add your sport, position and team situation to get a focused skill plan.</EmptyState></Card>;
  }
  return (
    <div className="stack-lg">
      {q.data.sports.map((s) => <SportCard key={s.prefs.sport} s={s} data={q.data} />)}
    </div>
  );
}

function SportCard({ s, data }: { s: SportView; data: SportsData }) {
  const [skill, setSkill] = useState<string>(s.priorities[0]?.skill ?? s.focus[0] ?? s.skills[0]!.id);
  const drills = s.drills.filter((d) => d.skill === skill);
  const dev = s.status.development;
  return (
    <section className="stack-lg" aria-label={s.label}>
      <div className="row-wrap between">
        <div className="stack-sm" style={{ gap: 2 }}>
          <h2 className="row-sm"><Trophy aria-hidden style={{ width: 18, color: 'var(--cat-sport)' }} />{s.label}{s.prefs.position && <span className="subtle small">· {[s.prefs.position, s.prefs.secondaryPosition].filter(Boolean).join(' + ')}</span>}</h2>
          <p className="small muted">{s.status.label} · this week: {s.dose.sessions} skill session{s.dose.sessions === 1 ? '' : 's'} of about {s.dose.minutes} min</p>
        </div>
        <Link to="/settings/fitness" className="btn btn-secondary btn-sm">Edit</Link>
      </div>

      {dev && (
        <Card title={<span className="row-sm"><Flag aria-hidden style={{ width: 16 }} /> {s.prefs.teamStatus === 'cut' ? 'Your comeback plan' : 'Tryout plan'}</span>} action={s.tryout.daysLeft !== null && s.tryout.daysLeft >= 0 ? <Badge tone="accent">{s.tryout.daysLeft} days to tryouts</Badge> : undefined}>
          <div className="stack">
            <div className="row-wrap">
              <Badge tone="info">{s.tryout.label} phase</Badge>
              {s.prefs.tryoutDate && <span className="small muted">Tryout: {dayLabel(s.prefs.tryoutDate, { weekday: 'short', month: 'long', day: 'numeric' })}</span>}
            </div>
            <p className="small">{s.tryout.focus}</p>
            {s.prefs.coachFeedback && <Callout tone="neutral" title="Coach feedback you’re working on">{s.prefs.coachFeedback}</Callout>}
            <ol className="stack-sm" style={{ paddingLeft: 18 }}>
              {s.cutSteps.map((st) => (
                <li key={st.title} className="small"><span className="strong">{st.title}.</span> <span className="muted">{st.detail}</span></li>
              ))}
            </ol>
          </div>
        </Card>
      )}

      <ForYou s={s} onPick={setSkill} />

      <Card title={<span className="row-sm"><Target aria-hidden style={{ width: 16 }} /> Skills & drills</span>}>
        <div className="stack">
          <Chips<string> label="Skill" hideLabel value={skill} onChange={(v) => setSkill(v as string)} options={s.skills.map((k) => ({ value: k.id, label: s.focus.includes(k.id) ? `★ ${k.label}` : k.label }))} />
          {s.focus.length === 0 && <p className="xsmall subtle">Tip: choose focus skills in Edit so your planned sessions rotate through them.</p>}
          <ul className="stack" style={{ listStyle: 'none' }}>
            {drills.map((d) => (
              <li key={d.id} className="stack-sm" style={{ gap: 4, paddingTop: 'var(--s-3)', borderTop: '1px solid var(--border)' }}>
                <div className="row-wrap">
                  <span className="strong small">{d.name}</span>
                  <Badge outline>{['', 'Beginner', 'Intermediate', 'Advanced'][d.level]}</Badge>
                  {!d.solo && <Badge outline>Needs a partner</Badge>}
                </div>
                <p className="small muted">{d.howTo}</p>
                <div className="dose">
                  <span>{d.minutes} min</span>
                  <span>Space: {d.space}</span>
                  <span>Equipment: {d.equipment}</span>
                </div>
                <p className="xsmall"><span className="subtle">Focus:</span> {d.cues.join(' · ')}</p>
                <p className="xsmall"><span className="subtle">Track:</span> {d.measure}</p>
                <p className="xsmall subtle">
                  {d.source ? <>Basis: <a href={d.source.url} target="_blank" rel="noopener noreferrer">{d.source.publisher}</a></> : 'Basis: widely used coaching drill (general guidance)'}
                </p>
              </li>
            ))}
          </ul>
          <Videos sport={s.prefs.sport} skill={skill} skillLabel={s.skills.find((k) => k.id === skill)?.label ?? ''} channels={s.channels} connected={data.youtube} />
        </div>
      </Card>

      <SkillTests s={s} today={data.today} />

      {s.prefs.sport === 'baseball_softball' && <PitchCalculator age={data.age} />}

      <div className="grid-2">
        <Card title={<span className="row-sm"><BookOpen aria-hidden style={{ width: 16 }} /> Trusted resources</span>} quiet>
          <ul className="stack-sm" style={{ listStyle: 'none' }}>
            {s.sources.map((src) => (
              <li key={src.id} className="small">
                <a href={src.url} target="_blank" rel="noopener noreferrer" className="row-sm" style={{ display: 'inline-flex' }}>{src.title} <ExternalLink aria-hidden style={{ width: 12 }} /></a>
                <div className="xsmall subtle">{src.publisher} · {src.kind === 'research' ? 'Research' : src.kind === 'governing_body' ? 'Governing body' : 'Coaching site'}</div>
                <div className="xsmall muted">{src.note}</div>
              </li>
            ))}
          </ul>
        </Card>
        <Card title={<span className="row-sm"><ShieldCheck aria-hidden style={{ width: 16 }} /> Stay healthy</span>} quiet>
          <ul className="small stack-sm" style={{ paddingLeft: 18 }}>
            {s.safety.map((x) => <li key={x}>{x}</li>)}
            <li>Strength work follows the NSCA youth guidance: technique first, gradual progress.</li>
            <li>Pain that’s sharp, swelling, or that changes how you move means stop and get it checked.</li>
          </ul>
        </Card>
      </div>
    </section>
  );
}

function Videos({ sport, skill, skillLabel, channels, connected }: { sport: string; skill: string; skillLabel: string; channels: SportView['channels']; connected: boolean }) {
  const q = useQuery({
    queryKey: ['sport-videos', sport, skill],
    queryFn: () => api.get<{ connected: boolean; videos: Video[]; channels: number }>(`/sports/videos?sport=${encodeURIComponent(sport)}&skill=${encodeURIComponent(skill)}`),
    enabled: connected && channels.length > 0,
    staleTime: 3_600_000,
  });
  return (
    <div className="stack-sm" style={{ paddingTop: 'var(--s-3)', borderTop: '1px solid var(--border)' }}>
      <div className="eyebrow row-sm"><PlayCircle aria-hidden style={{ width: 14 }} /> Videos for {skillLabel.toLowerCase()}</div>
      {channels.length === 0 ? (
        <p className="small muted">No vetted video channel is set up for this sport yet, so none are shown. Use the trusted resources below.</p>
      ) : !connected ? (
        <div className="stack-sm">
          <p className="small muted">
            Add a free YouTube API key in <Link to="/settings/connections">Settings → Connections</Link> to see videos picked from these vetted channels. Until then, you can browse them directly:
          </p>
          <div className="row-wrap">
            {channels.map((c) => (
              <a key={c.url} className="btn btn-secondary btn-sm" href={c.url} target="_blank" rel="noopener noreferrer">{c.name}{c.official ? ' (official)' : ''} <ExternalLink aria-hidden /></a>
            ))}
          </div>
        </div>
      ) : q.isPending ? (
        <Skeleton h={90} />
      ) : q.error ? (
        <Callout tone="warning">{errorMessage(q.error)}</Callout>
      ) : q.data.videos.length === 0 ? (
        <p className="small muted">No videos found on the vetted channels for this skill.</p>
      ) : (
        <ul className="video-grid" style={{ listStyle: 'none' }}>
          {q.data.videos.map((v) => (
            <li key={v.videoId}>
              <a href={v.url} target="_blank" rel="noopener noreferrer" className="video-card">
                {v.thumbnail ? <img src={v.thumbnail} alt="" loading="lazy" width={320} height={180} /> : <div className="video-thumb-empty" />}
                <span className="small strong video-title">{v.title}</span>
                <span className="xsmall subtle">{v.channelName}{v.official ? ' · official' : ''}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
      {connected && channels.length > 0 && <p className="xsmall subtle">Only from vetted channels: {channels.map((c) => c.name).join(', ')}. Opens on YouTube.</p>}
    </div>
  );
}

function SkillTests({ s, today }: { s: SportView; today: string }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [testId, setTestId] = useState(s.tests[0]?.id ?? '');
  const [value, setValue] = useState<number | null>(null);
  const [date, setDate] = useState(today);
  const add = useMutation({
    mutationFn: () => api.post('/sports/tests', { sport: s.prefs.sport, testId, date, value, note: '' }),
    onSuccess: () => {
      setValue(null);
      qc.invalidateQueries({ queryKey: ['sports'] });
      toast({ message: 'Result saved.' });
    },
  });
  const del = useMutation({ mutationFn: (id: string) => api.del(`/sports/tests/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['sports'] }) });
  if (!s.tests.length) return null;
  const errs = fieldErrors(add.error);
  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));
  return (
    <Card title="Skill tests — your own progress" pad={false}>
      <div className="card-body stack-sm">
        <p className="small muted">Test the same way each time. Results are compared with your own first try, not with anyone else.</p>
      </div>
      <ul style={{ listStyle: 'none' }}>
        {s.tests.map((t) => (
          <li key={t.id} className="list-row" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div className="grow" style={{ minWidth: 200 }}>
              <div className="small strong">{t.name}</div>
              <div className="xsmall subtle">{t.howTo} ({t.unit}, {t.better === 'higher' ? 'higher is better' : 'lower is better'})</div>
            </div>
            {t.summary ? (
              <div className="row-wrap small">
                <span className="subtle">First {fmt(t.summary.baseline.value)}</span>
                <span>Latest <span className="strong">{fmt(t.summary.latest.value)}</span></span>
                <span className="subtle">Best {fmt(t.summary.best)}</span>
                {t.summary.change !== null && (
                  <Badge tone={t.summary.improved ? 'success' : 'neutral'} icon={t.summary.improved ? (t.better === 'higher' ? TrendingUp : TrendingDown) : undefined}>
                    {t.summary.change > 0 ? '+' : ''}{fmt(t.summary.change)}
                  </Badge>
                )}
                <Button size="sm" variant="ghost" iconOnly icon={Trash2} aria-label={`Delete latest ${t.name} result`} onClick={() => del.mutate(t.results[t.results.length - 1]!.id)} />
              </div>
            ) : (
              <span className="xsmall subtle">No results yet — log a baseline</span>
            )}
          </li>
        ))}
      </ul>
      <form className="card-footer row-wrap" style={{ alignItems: 'flex-end' }} onSubmit={(e) => { e.preventDefault(); add.mutate(); }}>
        <Field label="Test">
          {(p) => (
            <select {...p} className="select" value={testId} onChange={(e) => setTestId(e.target.value)} style={{ maxWidth: 240 }}>
              {s.tests.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          )}
        </Field>
        <Field label="Result" error={errs.value}>
          {(p) => <NumberInput {...p} min={0} step={0.01} value={value} onChange={setValue} style={{ width: 120 }} />}
        </Field>
        <Field label="Date" error={errs.date}>
          {(p) => <Input {...p} type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} />}
        </Field>
        <Button type="submit" variant="primary" disabled={value === null} loading={add.isPending}>Log result</Button>
        {add.error && !Object.keys(errs).length && <span className="field-error">{errorMessage(add.error)}</span>}
      </form>
    </Card>
  );
}

function PitchCalculator({ age }: { age: number | null }) {
  const [pitches, setPitches] = useState<number | null>(null);
  const r = pitches === null ? null : pitchSmartRest(age, pitches);
  return (
    <Card title="Pitch count & rest (Pitch Smart)">
      <div className="stack">
        <div className="row-wrap" style={{ alignItems: 'flex-end' }}>
          <Field label="Pitches thrown in a day">{(p) => <NumberInput {...p} min={0} max={200} value={pitches} onChange={setPitches} style={{ width: 140 }} />}</Field>
        </div>
        {r && (r.ok ? (
          <Callout tone={r.overMax ? 'danger' : r.restDays >= 3 ? 'warning' : 'accent'} title={r.overMax ? `Over the daily maximum of ${r.dailyMax} for your age.` : r.restDays === 0 ? 'No required rest day.' : `${r.restDays} day${r.restDays === 1 ? '' : 's'} of rest before pitching again.`}>
            Daily maximum for your age: {r.dailyMax} pitches. Also: don’t pitch on three consecutive days, don’t pitch for more than one team at a time, and take several months off from competitive pitching each year.
          </Callout>
        ) : (
          <Callout tone="info">{r.reason}</Callout>
        ))}
        <p className="xsmall subtle">
          From the MLB & USA Baseball Pitch Smart guidelines — <a href="https://www.mlb.com/pitch-smart/pitching-guidelines" target="_blank" rel="noopener noreferrer">check the official tables</a>. If your league’s rules are stricter, follow your league.
        </p>
      </div>
    </Card>
  );
}

const TREND_TEXT = { down: 'Dropping', flat: 'Stalled', up: 'Improving', none: '' } as const;


function ForYou({ s, onPick }: { s: SportView; onPick: (skill: string) => void }) {
  const top = s.priorities.filter((p) => p.score > 0);
  const pos = [s.prefs.position, s.prefs.secondaryPosition].filter(Boolean).join(' and ');
  const weakest = top[0];
  return (
    <Card title={<span className="row-sm"><Sparkles aria-hidden style={{ width: 16 }} /> Built for you</span>}>
      <div className="stack-lg">
        {s.positionInfo.length > 0 ? (
          <div className="grid-2">
            {s.positionInfo.map((p) => (
              <div key={p.name} className="stack-sm foryou-pos">
                <span className="eyebrow">{p.advanced ? 'Advanced role' : 'Position'}</span>
                <span className="strong">{p.name}</span>
                <p className="small muted">{p.blurb}</p>
                <p className="xsmall"><span className="subtle">Conditioning:</span> {p.conditioning}</p>
                <p className="xsmall"><span className="subtle">Strength focus:</span> {p.strength}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="small muted">Add your position in <Link to="/settings/fitness">Edit</Link> to get skills and drills for your role.</p>
        )}

        {top.length > 0 && (
          <div className="stack-sm">
            <span className="eyebrow">What you need most right now</span>
            <ol className="foryou-list">
              {top.map((p) => (
                <li key={p.skill}>
                  <button type="button" className="foryou-skill" onClick={() => onPick(p.skill)}>
                    <span className="strong small">{p.label}</span>
                    {p.trend !== 'none' && <Badge tone={p.trend === 'down' ? 'danger' : p.trend === 'flat' ? 'warning' : 'success'} outline>{TREND_TEXT[p.trend]}</Badge>}
                    <Badge outline>{['', 'Basic', 'Intermediate', 'Advanced'][p.level]} drills</Badge>
                  </button>
                  <span className="xsmall subtle">{p.reasons.join(' · ')}</span>
                </li>
              ))}
            </ol>
            <p className="xsmall subtle">Ranked from your position, the skills you picked, your coach’s feedback and your own test results. Log tests below and this updates.</p>
          </div>
        )}

        {s.week.length > 0 && (
          <div className="stack-sm">
            <span className="eyebrow">This week’s sessions</span>
            <ol className="foryou-week">
              {s.week.map((w, i) => (
                <li key={i}>
                  <span className="strong small">{w.label}</span>
                  <span className="small muted">{w.drills.map((d) => `${d.name} (${d.minutes} min)`).join(' → ')}</span>
                  <span className="xsmall subtle">{w.why}</span>
                </li>
              ))}
            </ol>
            <p className="xsmall subtle">Drills rotate each week and get harder as your test results improve. Planned sessions in your week use exactly these.</p>
          </div>
        )}

        {weakest && (
          <div className="row-wrap">
            <Link className="btn btn-secondary btn-sm" to={askCoach(`Research the best drills to improve my ${weakest.label.toLowerCase()} as a ${s.label.toLowerCase()} ${pos || 'player'}. ${weakest.reasons.length ? `Context: ${weakest.reasons.join(', ')}.` : ''} Give me a 2-week progression I can do mostly on my own.`)}>
              <CompassIcon aria-hidden style={{ width: 15 }} /> Ask Compass to research {weakest.label.toLowerCase()} drills
            </Link>
          </div>
        )}
      </div>
    </Card>
  );
}
