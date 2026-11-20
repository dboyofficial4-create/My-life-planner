import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useState } from 'react';
import { KeyRound, Mail, MailCheck } from 'lucide-react';
import { api, errorMessage, fieldErrors } from '@/lib/api';
import { Button, Callout, Field, Input, Tabs } from '@/ui/primitives';

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="auth-main" style={{ minHeight: '100dvh' }}>{children}</div>;
}

/** Forgot password: a recovery code (always), or an emailed link (when the server can send email). */
export function ForgotPage() {
  const opts = useQuery({ queryKey: ['recovery-options'], queryFn: () => api.get<{ code: boolean; email: boolean }>('/auth/recovery-options') });
  const [how, setHow] = useState<'code' | 'email'>('code');
  return (
    <Shell>
      <div className="auth-card">
        <div className="stack-sm">
          <h1>Reset your password</h1>
          <p className="muted">Use the recovery code you saved from Settings{opts.data?.email ? ', or get a link by email' : ''}.</p>
        </div>
        {opts.data?.email && <Tabs label="How to reset" value={how} onChange={setHow} tabs={[{ value: 'code', label: 'Recovery code' }, { value: 'email', label: 'Email link' }]} />}
        {how === 'code' || !opts.data?.email ? <WithCode /> : <ByEmail />}
        <Link to="/login" className="small" style={{ textAlign: 'center' }}>Back to sign in</Link>
      </div>
    </Shell>
  );
}

function WithCode() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const m = useMutation({
    mutationFn: () => api.post('/auth/recover', { email, code, password }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['me'] });
      navigate('/settings/security?used=1');
    },
  });
  const f = fieldErrors(m.error);
  return (
    <form className="stack" noValidate onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
      {m.error && !Object.keys(f).length && <Callout tone="danger">{errorMessage(m.error)}</Callout>}
      <Field label="Email" error={f.email}>{(p) => <Input {...p} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
      <Field label="Recovery code" hint="Like ABCDE-FGH23-JKMNP-QRS45. Dashes and capitals don’t matter." error={f.code}>
        {(p) => <Input {...p} autoComplete="off" spellCheck={false} value={code} onChange={(e) => setCode(e.target.value)} style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }} />}
      </Field>
      <Field label="New password" hint="At least 10 characters." error={f.password}>{(p) => <Input {...p} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />}</Field>
      <Button type="submit" variant="primary" size="lg" block icon={KeyRound} loading={m.isPending}>Reset password</Button>
      <p className="xsmall subtle">The code works once. Afterwards you’ll make a new one, and every other device is signed out.</p>
    </form>
  );
}

function ByEmail() {
  const [email, setEmail] = useState('');
  const m = useMutation({ mutationFn: () => api.post('/auth/forgot', { email }) });
  if (m.isSuccess) {
    return <Callout tone="accent" icon={MailCheck} title="Check your email">If there’s a Waypoint account for {email}, a reset link is on its way. It works once, for 30 minutes. Check spam if you don’t see it.</Callout>;
  }
  const f = fieldErrors(m.error);
  return (
    <form className="stack" noValidate onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
      {m.error && !Object.keys(f).length && <Callout tone="danger">{errorMessage(m.error)}</Callout>}
      <Field label="Email" error={f.email}>{(p) => <Input {...p} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
      <Button type="submit" variant="primary" size="lg" block icon={Mail} loading={m.isPending}>Email me a link</Button>
    </form>
  );
}

/** Where the emailed link lands. */
export function ResetPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const m = useMutation({
    mutationFn: () => api.post('/auth/reset', { token, password }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['me'] });
      navigate('/');
    },
  });
  const f = fieldErrors(m.error);
  return (
    <Shell>
      <form className="auth-card" noValidate onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
        <div className="stack-sm">
          <h1>Choose a new password</h1>
          <p className="muted">Every other device will be signed out.</p>
        </div>
        {!token && <Callout tone="danger">This link is incomplete. Open it straight from the email, or ask for a new one.</Callout>}
        {m.error && !Object.keys(f).length && <Callout tone="danger" action={<Link to="/forgot" className="btn btn-sm btn-secondary">Get a new link</Link>}>{errorMessage(m.error)}</Callout>}
        <Field label="New password" hint="At least 10 characters." error={f.password}>{(p) => <Input {...p} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />}</Field>
        <Button type="submit" variant="primary" size="lg" block loading={m.isPending} disabled={!token}>Set new password</Button>
      </form>
    </Shell>
  );
}
