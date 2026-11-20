import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { useState } from 'react';
import { Copy, Download, KeyRound, Lock, Mail } from 'lucide-react';
import { api, errorMessage, fieldErrors } from '@/lib/api';
import { useToast } from '@/ui/overlay';
import { Badge, Button, Callout, Card, Field, Input, Skeleton } from '@/ui/primitives';

interface Security { isDemo: boolean; recoveryCodeCreatedAt: string | null; emailReset: boolean }

export function SecuritySection() {
  const q = useQuery({ queryKey: ['security'], queryFn: () => api.get<Security>('/account/security') });
  const [params] = useSearchParams();
  if (q.isPending) return <Card><Skeleton h={120} /></Card>;
  if (q.error) return <Callout tone="danger">{errorMessage(q.error)}</Callout>;
  const d = q.data;
  if (d.isDemo) return <Callout tone="info">The demo account has no password. Create a real account to set one up.</Callout>;
  return (
    <>
      {params.get('used') === '1' && !d.recoveryCodeCreatedAt && (
        <Callout tone="warning" title="Your recovery code was used">Your password is reset. Make a new recovery code now, so you’re covered next time.</Callout>
      )}
      <RecoveryCodeCard d={d} />
      <ChangePasswordCard />
      <Card title={<span className="row-sm"><Mail aria-hidden style={{ width: 16 }} /> Reset by email</span>} action={<Badge tone={d.emailReset ? 'success' : 'neutral'}>{d.emailReset ? 'On' : 'Not set up'}</Badge>}>
        <p className="small muted">
          {d.emailReset
            ? '“Forgot password?” on the sign-in page can email you a one-time link.'
            : 'This server can’t send email, so use a recovery code. Whoever runs Waypoint can turn email on (see docs/DEPLOY.md).'}
        </p>
      </Card>
    </>
  );
}

function RecoveryCodeCard({ d }: { d: Security }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [asking, setAsking] = useState(false);
  const [password, setPassword] = useState('');
  const [code, setCode] = useState<string | null>(null);
  const make = useMutation({
    mutationFn: () => api.post<{ code: string }>('/account/recovery-code', { password }),
    onSuccess: (r) => { setCode(r.code); setAsking(false); setPassword(''); qc.invalidateQueries({ queryKey: ['security'] }); },
  });
  const f = fieldErrors(make.error);
  const download = () => {
    const blob = new Blob([`Waypoint recovery code\n\n${code}\n\nUse it on the sign-in page: Forgot password? → Recovery code.\nIt works once. Keep it somewhere safe and private.\n`], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'waypoint-recovery-code.txt';
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <Card
      title={<span className="row-sm"><KeyRound aria-hidden style={{ width: 16 }} /> Recovery code</span>}
      action={<Badge tone={d.recoveryCodeCreatedAt ? 'success' : 'warning'}>{d.recoveryCodeCreatedAt ? `Made ${new Date(d.recoveryCodeCreatedAt).toLocaleDateString()}` : 'None yet'}</Badge>}
    >
      <div className="stack">
        <p className="small muted">If you forget your password, this code lets you set a new one. Write it down or save it somewhere private. It works once.</p>
        {code ? (
          <div className="recovery-code">
            <code aria-label="Your recovery code">{code}</code>
            <div className="row-wrap">
              <Button size="sm" icon={Copy} onClick={() => navigator.clipboard.writeText(code).then(() => toast({ message: 'Copied.' }), () => toast({ message: 'Couldn’t copy; write it down instead.', tone: 'error' }))}>Copy</Button>
              <Button size="sm" icon={Download} onClick={download}>Download as a file</Button>
              <Button size="sm" variant="primary" onClick={() => setCode(null)}>I’ve saved it</Button>
            </div>
            <p className="xsmall subtle">This is the only time it’s shown. Making a new code cancels this one.</p>
          </div>
        ) : asking ? (
          <form className="stack" noValidate onSubmit={(e) => { e.preventDefault(); make.mutate(); }}>
            {make.error && !Object.keys(f).length && <Callout tone="danger">{errorMessage(make.error)}</Callout>}
            <Field label="Your password" hint="To make sure it’s you." error={f.password}>{(p) => <Input {...p} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ maxWidth: 320 }} />}</Field>
            <div className="row-wrap">
              <Button type="submit" variant="primary" icon={KeyRound} loading={make.isPending}>{d.recoveryCodeCreatedAt ? 'Make a new code' : 'Make my code'}</Button>
              <Button variant="ghost" onClick={() => setAsking(false)}>Cancel</Button>
            </div>
          </form>
        ) : (
          <div><Button variant={d.recoveryCodeCreatedAt ? 'secondary' : 'primary'} icon={KeyRound} onClick={() => setAsking(true)}>{d.recoveryCodeCreatedAt ? 'Replace my code' : 'Make a recovery code'}</Button></div>
        )}
      </div>
    </Card>
  );
}

function ChangePasswordCard() {
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [mismatch, setMismatch] = useState(false);
  const m = useMutation({
    mutationFn: () => api.post('/account/password', { current, password }),
    onSuccess: () => { setCurrent(''); setPassword(''); setAgain(''); toast({ message: 'Password changed. Other devices were signed out.' }); },
  });
  const f = fieldErrors(m.error);
  return (
    <Card title={<span className="row-sm"><Lock aria-hidden style={{ width: 16 }} /> Change password</span>}>
      <form className="stack" noValidate onSubmit={(e) => { e.preventDefault(); if (password !== again) return setMismatch(true); m.mutate(); }}>
        {m.error && !Object.keys(f).length && <Callout tone="danger">{errorMessage(m.error)}</Callout>}
        <Field label="Current password" error={f.current}>{(p) => <Input {...p} type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} style={{ maxWidth: 320 }} />}</Field>
        <Field label="New password" hint="At least 10 characters." error={f.password}>{(p) => <Input {...p} type="password" autoComplete="new-password" value={password} onChange={(e) => { setPassword(e.target.value); setMismatch(false); }} style={{ maxWidth: 320 }} />}</Field>
        <Field label="New password again" error={mismatch ? 'The two new passwords don’t match.' : undefined}>{(p) => <Input {...p} type="password" autoComplete="new-password" value={again} onChange={(e) => { setAgain(e.target.value); setMismatch(false); }} style={{ maxWidth: 320 }} />}</Field>
        <div><Button type="submit" variant="primary" loading={m.isPending} disabled={!current || !password}>Change password</Button></div>
      </form>
    </Card>
  );
}
