import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useSearchParams } from 'react-router';
import { ArrowUp, Globe, History, MessageCircle, Plus, ShieldCheck, Square, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { api, ApiError, errorMessage } from '@/lib/api';
import { Markdown } from '@/lib/markdown';
import { useToast } from '@/ui/overlay';
import { Button, Callout, Card, ErrorState, Skeleton, Switch } from '@/ui/primitives';
import { AiNotReady } from '../looks/shared';

type Source = { title: string; url: string };
type Msg = { id: string; role: 'user' | 'assistant'; content: string; sources: Source[]; createdAt: number };
type Thread = { id: string; title: string; createdAt: number; updatedAt: number };
type CoachInfo = {
  aiReady: boolean;
  provider: 'claude' | 'gemini' | null;
  consent: boolean;
  threads: Thread[];
  limit: { used: number; max: number };
  suggestions: string[];
};

const PROVIDER = { claude: 'Anthropic (Claude)', gemini: 'Google (Gemini)' } as const;

export default function CoachPage() {
  const q = useQuery({ queryKey: ['coach'], queryFn: () => api.get<CoachInfo>('/coach') });
  return (
    <div className="page coach-page">
      <header className="page-header">
        <div>
          <h1>Coach</h1>
          <p>Ask anything about training, your sport, school, food or skin. Coach knows your plan and can research the web for you.</p>
        </div>
      </header>
      {q.isPending ? <Skeleton h={360} r={6} /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !q.data.aiReady ? <AiNotReady /> : !q.data.consent ? <Consent info={q.data} /> : <Chat info={q.data} />}
    </div>
  );
}

function Consent({ info }: { info: CoachInfo }) {
  const qc = useQueryClient();
  const [ok, setOk] = useState(false);
  const go = useMutation({ mutationFn: () => api.post('/coach/consent', { consent: true }), onSuccess: () => qc.invalidateQueries({ queryKey: ['coach'] }) });
  const who = info.provider ? PROVIDER[info.provider] : 'the AI service';
  return (
    <Card title={<span className="row-sm"><ShieldCheck aria-hidden style={{ width: 16 }} /> Before you start</span>}>
      <div className="stack">
        <p className="small">To give answers that fit you, Coach sends {who} your question, the conversation so far, and a short summary from Waypoint:</p>
        <ul className="small stack-sm" style={{ paddingLeft: 18 }}>
          <li>your age range (under 18 or adult), sports, positions, level and test results</li>
          <li>your training settings, goals, and the next few days of your plan</li>
          <li>upcoming tests and assignments, and food, skin or hair settings if you use those areas</li>
        </ul>
        <p className="small muted">Never your name, email or birthday. When Coach researches, it searches the web and lists its sources. Conversations are saved to your account so you can come back to them; delete them any time. {info.provider === 'gemini' ? 'On Gemini’s free tier, Google may use what’s sent to improve its products.' : ''}</p>
        <Callout tone="neutral">Coach gives general guidance, not medical advice. For pain, injuries or anything that worries you, talk to a doctor, athletic trainer or a trusted adult.</Callout>
        <label className="checkbox">
          <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} />
          <span className="small">I understand, and I’m OK with this being sent to {who}.</span>
        </label>
        {go.error && <Callout tone="danger">{errorMessage(go.error)}</Callout>}
        <div><Button variant="primary" icon={MessageCircle} disabled={!ok} loading={go.isPending} onClick={() => go.mutate()}>Start using Coach</Button></div>
      </div>
    </Card>
  );
}

/** Reads the server's event stream: thread → text… / search → done | error. */
async function streamChat(body: unknown, signal: AbortSignal, on: { thread: (t: Thread, q: Msg) => void; text: (t: string) => void; search: () => void }): Promise<Msg> {
  let res: Response;
  try {
    res = await fetch('/api/coach/chat', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
  } catch (e) {
    if (signal.aborted) throw e;
    throw new ApiError(0, 'offline', 'Can’t reach Waypoint. Check your connection and try again.');
  }
  if (!res.ok || !res.body) {
    const data = (await res.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
    throw new ApiError(res.status, data?.error?.code ?? 'error', data?.error?.message ?? `Request failed (${res.status}).`);
  }
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += value;
    let cut: number;
    while ((cut = buf.indexOf('\n\n')) >= 0) {
      const chunk = buf.slice(0, cut);
      buf = buf.slice(cut + 2);
      let event = 'message';
      let data = '';
      for (const line of chunk.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) data += line.slice(5).trim();
      }
      if (!data) continue;
      const d = JSON.parse(data);
      if (event === 'thread') on.thread(d.thread, d.question);
      else if (event === 'text') on.text(d.t);
      else if (event === 'search') on.search();
      else if (event === 'done') return d.message as Msg;
      else if (event === 'error') throw new ApiError(500, d.code, d.message);
    }
  }
  throw new ApiError(0, 'interrupted', 'The answer was cut off. Please try again.');
}

function Chat({ info }: { info: CoachInfo }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState(params.get('ask') ?? '');
  const [research, setResearch] = useState(true);
  const [streaming, setStreaming] = useState<{ text: string; searching: boolean } | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const left = Math.max(0, info.limit.max - info.limit.used);

  useEffect(() => {
    if (params.get('ask')) {
      setParams({}, { replace: true });
      inputRef.current?.focus();
    }
  }, [params, setParams]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [messages.length, streaming?.text]);
  useEffect(() => () => abort.current?.abort(), []);

  const open = async (id: string) => {
    if (streaming) return;
    try {
      const d = await api.get<{ thread: Thread; messages: Msg[] }>(`/coach/threads/${id}`);
      setThreadId(id);
      setMessages(d.messages);
      setShowHistory(false);
    } catch (e) {
      toast({ message: errorMessage(e), tone: 'error' });
    }
  };
  const newChat = () => {
    if (streaming) return;
    setThreadId(null);
    setMessages([]);
    setShowHistory(false);
    inputRef.current?.focus();
  };
  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/coach/threads/${id}`),
    onSuccess: (_d, id) => {
      if (id === threadId) newChat();
      qc.invalidateQueries({ queryKey: ['coach'] });
    },
  });

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || streaming) return;
    const ac = new AbortController();
    abort.current = ac;
    setDraft('');
    const temp: Msg = { id: `tmp-${Date.now()}`, role: 'user', content: message, sources: [], createdAt: Date.now() };
    setMessages((m) => [...m, temp]);
    setStreaming({ text: '', searching: false });
    try {
      const reply = await streamChat({ threadId, message, research }, ac.signal, {
        thread: (t, q) => {
          setThreadId(t.id);
          setMessages((m) => m.map((x) => (x.id === temp.id ? q : x)));
        },
        text: (t) => setStreaming((s) => ({ text: (s?.text ?? '') + t, searching: false })),
        search: () => setStreaming((s) => ({ text: s?.text ?? '', searching: true })),
      });
      setMessages((m) => [...m, reply]);
    } catch (e) {
      if (!ac.signal.aborted) {
        toast({ message: errorMessage(e), tone: 'error' });
        if (e instanceof ApiError && e.status !== 500 && e.status !== 0) {
          // Rejected before it was saved: give the question back.
          setMessages((m) => m.filter((x) => x.id !== temp.id));
          setDraft(message);
        }
      }
    } finally {
      setStreaming(null);
      abort.current = null;
      qc.invalidateQueries({ queryKey: ['coach'] });
    }
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    void send(draft);
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send(draft);
    }
  };

  return (
    <div className={clsx('coach', showHistory && 'coach--history')}>
      <aside className="coach__threads" aria-label="Conversations">
        <Button variant="secondary" icon={Plus} onClick={newChat} disabled={!!streaming}>New conversation</Button>
        {info.threads.length === 0 ? (
          <p className="xsmall subtle">Your conversations will show up here.</p>
        ) : (
          <ul>
            {info.threads.map((t) => (
              <li key={t.id} className={clsx(t.id === threadId && 'is-on')}>
                <button type="button" className="coach__thread" onClick={() => open(t.id)} aria-current={t.id === threadId ? 'true' : undefined}>
                  <span className="small">{t.title}</span>
                  <span className="xsmall subtle">{new Date(t.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                </button>
                <Button size="sm" variant="ghost" iconOnly icon={Trash2} aria-label={`Delete “${t.title}”`} onClick={() => remove.mutate(t.id)} />
              </li>
            ))}
          </ul>
        )}
      </aside>

      <section className="coach__main" aria-label="Chat">
        <div className="coach__bar">
          <Button size="sm" variant="ghost" icon={History} className="coach__history-btn" onClick={() => setShowHistory((v) => !v)} aria-expanded={showHistory}>History</Button>
          <span className="xsmall subtle grow">{left} of {info.limit.max} questions left today</span>
          {threadId && <Button size="sm" variant="ghost" icon={Plus} onClick={newChat} disabled={!!streaming}>New</Button>}
        </div>

        <div className="coach__log" aria-live="polite">
          {messages.length === 0 && !streaming && (
            <div className="coach__empty stack">
              <p className="eyebrow">Try asking</p>
              <div className="coach__suggestions">
                {info.suggestions.map((s) => (
                  <button key={s} type="button" className="coach__suggestion" onClick={() => void send(s)} disabled={left === 0}>{s}</button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m) => <Bubble key={m.id} m={m} />)}
          {streaming && (
            <div className="coach-msg coach-msg--assistant">
              {streaming.text ? <div className="coach-msg__body prose"><Markdown text={streaming.text} /></div> : null}
              {(streaming.searching || !streaming.text) && (
                <p className="coach-msg__status xsmall"><span className="coach-dots" aria-hidden />{streaming.searching ? 'Searching the web…' : research ? 'Thinking (and searching if it helps)…' : 'Thinking…'}</p>
              )}
            </div>
          )}
          <div ref={endRef} />
        </div>

        <form className="coach__composer" onSubmit={submit}>
          <label className="sr-only" htmlFor="coach-input">Message Coach</label>
          <textarea
            id="coach-input"
            ref={inputRef}
            value={draft}
            rows={2}
            maxLength={4000}
            placeholder={left === 0 ? 'Daily limit reached. Come back tomorrow.' : 'Ask Coach anything…'}
            disabled={left === 0}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKey}
          />
          <div className="coach__composer-row">
            <Switch label={<span className="row-sm"><Globe aria-hidden style={{ width: 14 }} /> Research the web</span>} checked={research} onChange={setResearch} />
            {streaming ? (
              <Button variant="secondary" icon={Square} onClick={() => abort.current?.abort()}>Stop</Button>
            ) : (
              <Button type="submit" variant="primary" icon={ArrowUp} disabled={!draft.trim() || left === 0}>Send</Button>
            )}
          </div>
          <p className="xsmall subtle">General guidance, not medical advice. Coach can make mistakes; check anything important.</p>
        </form>
      </section>
    </div>
  );
}

function Bubble({ m }: { m: Msg }) {
  if (m.role === 'user') return <div className="coach-msg coach-msg--user"><p className="coach-msg__body">{m.content}</p></div>;
  return (
    <div className="coach-msg coach-msg--assistant">
      <div className="coach-msg__body prose"><Markdown text={m.content} /></div>
      {m.sources.length > 0 && (
        <div className="coach-sources">
          <span className="eyebrow">Sources</span>
          <ol>
            {m.sources.map((s) => {
              let host = s.url;
              try { host = new URL(s.url).hostname.replace(/^www\./, ''); } catch { /* keep */ }
              return (
                <li key={s.url}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a> <span className="xsmall subtle">{host}</span>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}
