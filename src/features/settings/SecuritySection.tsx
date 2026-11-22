import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Lock, Mail } from 'lucide-react';
import { api, errorMessage, fieldErrors } from '@/lib/api';
import { useToast } from '@/ui/overlay';
import { Badge, Button, Callout, Card, Field, Input, Skeleton } from '@/ui/primitives';

interface Security { isDemo: boolean; emailReset: boolean }

export function SecuritySection() {
  const q = useQuery({ queryKey: ['security'], queryFn: () => api.get<Security>('/account/security') });
  if (q.isPending) return <Card><Skeleton h={120} /></Card>;
  if (q.error) return <Callout tone="danger">{errorMessage(q.error)}</Callout>;
  const d = q.data;
  if (d.isDemo) return <Callout tone="info">The demo account has no password. Create a real account to set one up.</Callout>;
  return (
    <>
      <ChangePasswordCard />
      <Card title={<span className="row-sm"><Mail aria-hidden style={{ width: 16 }} /> Reset by email</span>} action={<Badge tone={d.emailReset ? 'success' : 'neutral'}>{d.emailReset ? 'On' : 'Not set up'}</Badge>}>
        <p className="small muted">
          {d.emailReset
            ? '“Forgot password?” on the sign-in page can email you a one-time link.'
            : 'This server can’t send email yet, so “Forgot password?” won’t work. Whoever runs Waypoint can turn email on (see docs/DEPLOY.md).'}
        </p>
      </Card>
    </>
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
