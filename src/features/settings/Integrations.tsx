import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, CircleSlash, Clock, KeyRound, Link2Off, PlugZap, RefreshCcw } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { api, errorMessage, fieldErrors } from '@/lib/api';
import { Dialog, useToast } from '@/ui/overlay';
import { Badge, Button, Callout, Card, ErrorState, Field, Input, Skeleton } from '@/ui/primitives';

interface SyncSummary {
  courses: number;
  coursesCreated: number;
  assignmentsCreated: number;
  assignmentsUpdated: number;
  grades: number;
  skippedCourses: number;
}

interface Integration {
  id: string;
  name: string;
  module: string;
  status: 'available' | 'needs_credentials' | 'not_supported' | 'planned';
  implemented: string[];
  requires: string[];
  unsupported: string[];
  fallback: string;
  configured: boolean;
  connection: null | {
    status: string;
    lastSyncAt: string | null;
    lastError: string | null;
    meta: null | { host?: string; userName?: string; lastSummary?: SyncSummary };
  };
}

const STATUS = {
  available: { label: 'Available', tone: 'success', icon: CheckCircle2 },
  needs_credentials: { label: 'Needs setup', tone: 'warning', icon: KeyRound },
  not_supported: { label: 'Not supported', tone: 'neutral', icon: CircleSlash },
  planned: { label: 'Planned', tone: 'info', icon: Clock },
} as const;

function useRefreshAfterSync() {
  const qc = useQueryClient();
  return () => {
    for (const k of ['integrations', 'school', 'plan', 'today']) qc.invalidateQueries({ queryKey: [k] });
  };
}

function summaryText(s: SyncSummary) {
  const parts = [`${s.courses} course${s.courses === 1 ? '' : 's'}`, `${s.assignmentsCreated} new assignment${s.assignmentsCreated === 1 ? '' : 's'}`];
  if (s.assignmentsUpdated) parts.push(`${s.assignmentsUpdated} updated`);
  parts.push(`${s.grades} score${s.grades === 1 ? '' : 's'}`);
  return parts.join(' · ');
}

function Details({ i }: { i: Integration }) {
  return (
    <div className="grid-2 small">
      {i.implemented.length > 0 && <div className="stack-sm"><div className="eyebrow">What works</div><ul className="muted" style={{ paddingLeft: 18 }}>{i.implemented.map((x) => <li key={x}>{x}</li>)}</ul></div>}
      <div className="stack-sm"><div className="eyebrow">What it needs</div><ul className="muted" style={{ paddingLeft: 18 }}>{i.requires.map((x) => <li key={x}>{x}</li>)}</ul></div>
      {i.unsupported.length > 0 && <div className="stack-sm"><div className="eyebrow">Not supported</div><ul className="muted" style={{ paddingLeft: 18 }}>{i.unsupported.map((x) => <li key={x}>{x}</li>)}</ul></div>}
      <div className="stack-sm"><div className="eyebrow">Instead, you can</div><p className="muted">{i.fallback}</p></div>
    </div>
  );
}

/* ---------- Canvas ---------- */

function CanvasConnectForm({ host, onDone }: { host?: string; onDone: () => void }) {
  const [baseUrl, setBaseUrl] = useState(host ?? '');
  const [token, setToken] = useState('');
  const [consent, setConsent] = useState(false);
  const refresh = useRefreshAfterSync();
  const toast = useToast();
  const connect = useMutation({
    mutationFn: () => api.post<{ summary: SyncSummary; account: { host: string; userName: string } }>('/integrations/canvas/token', { baseUrl, token, consent }),
    onSuccess: (r) => {
      setToken('');
      refresh();
      toast({ message: `Connected to Canvas${r.account.userName ? ` as ${r.account.userName}` : ''}. Imported ${summaryText(r.summary)}.` });
      onDone();
    },
  });
  const f = fieldErrors(connect.error);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    connect.mutate();
  };
  return (
    <form className="stack" onSubmit={submit} noValidate>
      <details className="details">
        <summary>How to get an access token (2 minutes)</summary>
        <ol className="small muted stack-sm" style={{ paddingLeft: 18 }}>
          <li>Log in to Canvas in your browser.</li>
          <li>Click <span className="strong">Account</span> (your profile picture, top left) → <span className="strong">Settings</span>.</li>
          <li>Scroll to <span className="strong">Approved Integrations</span> and click <span className="strong">+ New Access Token</span>.</li>
          <li>Purpose: “Waypoint”. Set an expiry date — the end of this term is a good choice.</li>
          <li>Click <span className="strong">Generate Token</span> and copy the long token. Canvas only shows it once.</li>
        </ol>
        <p className="xsmall subtle">No “New Access Token” button? Your school has turned this off for students — use “Import calendar file” on the School page instead.</p>
      </details>
      <div className="grid-2">
        <Field label="Your school’s Canvas address" hint="Copy it from your browser’s address bar, e.g. yourschool.instructure.com" error={f.baseUrl}>
          {(p) => <Input {...p} value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="yourschool.instructure.com" autoComplete="url" inputMode="url" spellCheck={false} />}
        </Field>
        <Field label="Access token" hint="Stored encrypted and never shown again." error={f.token}>
          {(p) => <Input {...p} type="password" value={token} onChange={(e) => setToken(e.target.value)} autoComplete="off" spellCheck={false} />}
        </Field>
      </div>
      <label className="checkbox small" style={{ alignItems: 'flex-start' }}>
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 2 }} />
        <span>
          Let Waypoint <span className="strong">read</span> my Canvas courses, assignments, due dates, submission status and scores. It never submits work or changes anything in Canvas.
          {f.consent && <span className="field-error" style={{ display: 'block' }}>{f.consent}</span>}
        </span>
      </label>
      {connect.error && !f.baseUrl && !f.token && !f.consent && <Callout tone="danger">{errorMessage(connect.error)}</Callout>}
      {connect.error && f.token && <Callout tone="danger">{errorMessage(connect.error)}</Callout>}
      <div>
        <Button type="submit" variant="primary" icon={PlugZap} loading={connect.isPending} disabled={!baseUrl.trim() || !token.trim() || !consent}>
          {connect.isPending ? 'Connecting and importing…' : 'Connect Canvas'}
        </Button>
      </div>
    </form>
  );
}

function CanvasPanel({ i }: { i: Integration }) {
  const conn = i.connection;
  const meta = conn?.meta ?? null;
  const refresh = useRefreshAfterSync();
  const toast = useToast();
  const [reconnecting, setReconnecting] = useState(false);
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [removeData, setRemoveData] = useState(false);
  const sync = useMutation({
    mutationFn: () => api.post<{ summary: SyncSummary }>('/integrations/canvas/sync'),
    onSuccess: (r) => {
      refresh();
      toast({ message: `Synced: ${summaryText(r.summary)}.` });
    },
    onError: (e) => {
      refresh();
      toast({ message: errorMessage(e), tone: 'error' });
    },
  });
  const disconnect = useMutation({
    mutationFn: () => api.del(`/integrations/canvas${removeData ? '?removeData=1' : ''}`),
    onSuccess: () => {
      refresh();
      setDisconnectOpen(false);
      toast({ message: removeData ? 'Disconnected and removed imported Canvas items.' : 'Disconnected. Imported items were kept.' });
    },
  });

  if (!i.configured) {
    return <Callout tone="warning" title="Not available on this server">The server has no encryption key, so tokens can’t be stored safely. Restart the app with the default setup or set APP_ENCRYPTION_KEY.</Callout>;
  }
  if (!conn) return <CanvasConnectForm onDone={() => {}} />;

  const broken = conn.status === 'needs_reconnect' || conn.status === 'error';
  let body: ReactNode;
  if (reconnecting || conn.status === 'needs_reconnect') {
    body = (
      <div className="stack">
        {conn.lastError && <Callout tone="warning" icon={AlertTriangle} title="Reconnect Canvas">{conn.lastError}</Callout>}
        <CanvasConnectForm host={meta?.host} onDone={() => setReconnecting(false)} />
        {reconnecting && <div><Button size="sm" variant="ghost" onClick={() => setReconnecting(false)}>Cancel</Button></div>}
      </div>
    );
  } else {
    body = (
      <div className="stack">
        {broken && conn.lastError && <Callout tone="warning" title="Last sync failed">{conn.lastError}</Callout>}
        <div className="row-wrap between">
          <div className="stack-sm" style={{ gap: 2 }}>
            <div className="small">
              Connected to <span className="strong">{meta?.host}</span>{meta?.userName ? <> as <span className="strong">{meta.userName}</span></> : null}
            </div>
            <div className="xsmall subtle">
              {conn.lastSyncAt ? `Last synced ${new Date(conn.lastSyncAt).toLocaleString()}` : 'Not synced yet'}
              {meta?.lastSummary ? ` · ${summaryText(meta.lastSummary)}` : ''}
              {meta?.lastSummary?.skippedCourses ? ` · ${meta.lastSummary.skippedCourses} course(s) skipped (no access)` : ''}
            </div>
          </div>
          <div className="row-sm">
            <Button size="sm" variant="primary" icon={RefreshCcw} loading={sync.isPending} onClick={() => sync.mutate()}>Sync now</Button>
            <Button size="sm" icon={KeyRound} onClick={() => setReconnecting(true)}>Replace token</Button>
            <Button size="sm" variant="ghost" icon={Link2Off} onClick={() => setDisconnectOpen(true)}>Disconnect</Button>
          </div>
        </div>
        <p className="xsmall subtle">Imported items are labelled “From Canvas”. After a sync, your plan offers to fit study time around new deadlines.</p>
      </div>
    );
  }
  return (
    <>
      {body}
      <Dialog
        open={disconnectOpen}
        onClose={() => setDisconnectOpen(false)}
        title="Disconnect Canvas?"
        footer={<><Button variant="ghost" onClick={() => setDisconnectOpen(false)}>Cancel</Button><Button variant="danger" loading={disconnect.isPending} onClick={() => disconnect.mutate()}>Disconnect</Button></>}
      >
        <div className="stack">
          <p className="small">Waypoint will delete its encrypted copy of your token and stop syncing.</p>
          <label className="checkbox small">
            <input type="checkbox" checked={removeData} onChange={(e) => setRemoveData(e.target.checked)} />
            Also remove the courses, assignments and grades imported from Canvas
          </label>
          <Callout tone="info">To fully revoke access, also delete the token in Canvas: Account → Settings → Approved Integrations → delete “Waypoint”.</Callout>
          {disconnect.error && <Callout tone="danger">{errorMessage(disconnect.error)}</Callout>}
        </div>
      </Dialog>
    </>
  );
}

/* ---------- YouTube ---------- */

function YouTubePanel({ i }: { i: Integration }) {
  const [key, setKey] = useState('');
  const [consent, setConsent] = useState(false);
  const qc = useQueryClient();
  const toast = useToast();
  const connect = useMutation({
    mutationFn: () => api.post('/integrations/youtube/key', { key, consent }),
    onSuccess: () => {
      setKey('');
      for (const k of ['integrations', 'sports', 'sport-videos']) qc.invalidateQueries({ queryKey: [k] });
      toast({ message: 'YouTube connected. Videos now appear under Fitness & Sports → Sport skills.' });
    },
  });
  const disconnect = useMutation({
    mutationFn: () => api.del('/integrations/youtube'),
    onSuccess: () => {
      for (const k of ['integrations', 'sports', 'sport-videos']) qc.invalidateQueries({ queryKey: [k] });
      toast({ message: 'YouTube disconnected and the stored key deleted.' });
    },
  });
  const f = fieldErrors(connect.error);
  if (!i.configured) return <Callout tone="warning">The server has no encryption key, so API keys can’t be stored safely.</Callout>;
  if (i.connection && i.connection.status !== 'needs_reconnect') {
    return (
      <div className="stack-sm">
        {i.connection.lastError && <Callout tone="warning">{i.connection.lastError}</Callout>}
        <div className="row-wrap between">
          <span className="small">Connected. {i.connection.lastSyncAt ? `Last video search ${new Date(i.connection.lastSyncAt).toLocaleString()}.` : 'No searches yet.'}</span>
          <Button size="sm" variant="ghost" icon={Link2Off} loading={disconnect.isPending} onClick={() => disconnect.mutate()}>Disconnect</Button>
        </div>
      </div>
    );
  }
  return (
    <form className="stack" noValidate onSubmit={(e) => { e.preventDefault(); connect.mutate(); }}>
      {i.connection?.status === 'needs_reconnect' && <Callout tone="warning">{i.connection.lastError ?? 'The saved key stopped working. Add a new one.'}</Callout>}
      <details className="details">
        <summary>How to get a free API key (about 5 minutes)</summary>
        <ol className="small muted stack-sm" style={{ paddingLeft: 18 }}>
          <li>Go to <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer">Google Cloud Console</a> and sign in. (If you’re under 18, ask a parent or guardian to help.)</li>
          <li>Create a project (any name, e.g. “Waypoint”).</li>
          <li>Open <span className="strong">APIs &amp; Services → Library</span>, search for <span className="strong">YouTube Data API v3</span> and click <span className="strong">Enable</span>.</li>
          <li>Open <span className="strong">APIs &amp; Services → Credentials → Create credentials → API key</span>, and copy the key.</li>
          <li>Optional but recommended: edit the key and restrict it to the YouTube Data API v3.</li>
        </ol>
        <p className="xsmall subtle">The free quota is plenty for personal use; Waypoint caches results for a week.</p>
      </details>
      <Field label="YouTube Data API key" hint="Stored encrypted and only sent to YouTube." error={f.key}>
        {(p) => <Input {...p} type="password" value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" spellCheck={false} style={{ maxWidth: 420 }} />}
      </Field>
      <label className="checkbox small" style={{ alignItems: 'flex-start' }}>
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 2 }} />
        <span>Use this key to search vetted YouTube channels for videos about my sports’ skills.</span>
      </label>
      {connect.error && !f.key && <Callout tone="danger">{errorMessage(connect.error)}</Callout>}
      <div><Button type="submit" variant="primary" icon={PlugZap} loading={connect.isPending} disabled={!key.trim() || !consent}>Connect YouTube</Button></div>
    </form>
  );
}

/* ---------- list ---------- */

export function IntegrationsList({ module }: { module?: string }) {
  const q = useQuery({ queryKey: ['integrations'], queryFn: () => api.get<{ integrations: Integration[] }>('/integrations') });
  if (q.isPending) return <Skeleton h={200} r={12} />;
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const list = q.data.integrations.filter((i) => !module || i.module === module);
  return (
    <div className="stack">
      {list.map((i) => {
        const st = STATUS[i.status];
        const conn = i.connection;
        const badge =
          (i.id === 'canvas' || i.id === 'youtube') && conn
            ? conn.status === 'connected'
              ? <Badge tone="success" icon={CheckCircle2}>Connected</Badge>
              : <Badge tone="warning" icon={AlertTriangle}>{conn.status === 'needs_reconnect' ? 'Needs reconnecting' : 'Sync problem'}</Badge>
            : <Badge tone={st.tone} icon={st.icon}>{st.label}</Badge>;
        return (
          <Card
            key={i.id}
            title={<span className="row-sm"><PlugZap aria-hidden style={{ width: 16 }} /> {i.name}</span>}
            action={badge}
            footer={i.id === 'ics_import' && conn?.lastSyncAt ? <span className="xsmall subtle">Last used {new Date(conn.lastSyncAt).toLocaleString()}</span> : undefined}
          >
            {i.id === 'youtube' ? (
              <div className="stack-lg">
                <YouTubePanel i={i} />
                <details className="details">
                  <summary>How videos are chosen, and limits</summary>
                  <Details i={i} />
                </details>
              </div>
            ) : i.id === 'canvas' ? (
              <div className="stack-lg">
                <CanvasPanel i={i} />
                <details className="details">
                  <summary>What Canvas sync imports, and its limits</summary>
                  <Details i={i} />
                </details>
              </div>
            ) : (
              <Details i={i} />
            )}
          </Card>
        );
      })}
    </div>
  );
}
