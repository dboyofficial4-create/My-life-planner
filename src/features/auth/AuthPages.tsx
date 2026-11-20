import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router';
import { CalendarCheck2, Navigation, RefreshCcw, ShieldCheck } from 'lucide-react';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { api, errorMessage, fieldErrors } from '@/lib/api';
import { Button, Callout, Field, Input } from '@/ui/primitives';

function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-wrap">
      <aside className="auth-aside">
        <div className="brand">
          <span className="brand-mark">
            <Navigation aria-hidden />
          </span>
          Waypoint
        </div>
        <div className="stack-lg">
          <h1>What should you do today to make real progress?</h1>
          <div className="auth-points">
            <div className="auth-point">
              <CalendarCheck2 aria-hidden />
              <div>
                <div className="strong">One realistic plan</div>
                <div className="muted small">Training, study, meals and routines fitted around the classes, work and games you can’t move.</div>
              </div>
            </div>
            <div className="auth-point">
              <RefreshCcw aria-hidden />
              <div>
                <div className="strong">Adapts without guilt</div>
                <div className="muted small">Missed something? Replanning shows exactly what changes before anything moves, and never piles up a backlog.</div>
              </div>
            </div>
            <div className="auth-point">
              <ShieldCheck aria-hidden />
              <div>
                <div className="strong">Your data, your call</div>
                <div className="muted small">Only asks for what your chosen areas need. Export or delete everything at any time.</div>
              </div>
            </div>
          </div>
        </div>
        <p className="subtle xsmall">General guidance only — not medical, nutrition or legal advice.</p>
      </aside>
      <main className="auth-main">{children}</main>
    </div>
  );
}

function useAfterAuth() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return async () => {
    await qc.invalidateQueries({ queryKey: ['me'] });
    navigate('/');
  };
}

/** The public welcome page is a static page (public/start/), built with the taste skill. */
export function WelcomePage() {
  useEffect(() => {
    window.location.replace('/start/');
  }, []);
  return (
    <main className="auth-main">
      <p className="muted">
        Opening Waypoint… <a href="/start/">Continue</a>
      </p>
    </main>
  );
}

export function LoginPage() {
  const after = useAfterAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const m = useMutation({ mutationFn: () => api.post('/auth/login', { email, password }), onSuccess: after });
  const f = fieldErrors(m.error);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    m.mutate();
  };
  return (
    <AuthLayout>
      <form className="auth-card" onSubmit={submit} noValidate>
        <div className="stack-sm">
          <h1>Sign in</h1>
          <p className="muted">
            New here? <Link to="/register">Create an account</Link>
          </p>
        </div>
        {m.error && !Object.keys(f).length && <Callout tone="danger">{errorMessage(m.error)}</Callout>}
        <Field label="Email" error={f.email}>
          {(p) => <Input {...p} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />}
        </Field>
        <Field label="Password" error={f.password}>
          {(p) => <Input {...p} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />}
        </Field>
        <Button type="submit" variant="primary" size="lg" block loading={m.isPending}>
          Sign in
        </Button>
        <Link to="/welcome" className="small" style={{ textAlign: 'center' }}>
          Back
        </Link>
      </form>
    </AuthLayout>
  );
}

export function RegisterPage() {
  const after = useAfterAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [birthday, setBirthday] = useState('');
  const m = useMutation({ mutationFn: () => api.post('/auth/register', { email, password, birthday }), onSuccess: after });
  const f = fieldErrors(m.error);
  return (
    <AuthLayout>
      <form
        className="auth-card"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          m.mutate();
        }}
      >
        <div className="stack-sm">
          <h1>Create your account</h1>
          <p className="muted">
            Already have one? <Link to="/login">Sign in</Link>
          </p>
        </div>
        {m.error && !Object.keys(f).length && <Callout tone={(m.error as { code?: string }).code === 'age_restricted' ? 'warning' : 'danger'}>{errorMessage(m.error)}</Callout>}
        <Field label="Email" error={f.email}>
          {(p) => <Input {...p} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
        </Field>
        <Field label="Password" hint="At least 10 characters. A short phrase works well." error={f.password}>
          {(p) => <Input {...p} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
        </Field>
        <Field label="Birthday" hint="Used only to keep plans age-appropriate (for example, no calorie deficits for teens)." error={f.birthday}>
          {(p) => <Input {...p} type="date" value={birthday} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setBirthday(e.target.value)} />}
        </Field>
        <Button type="submit" variant="primary" size="lg" block loading={m.isPending}>
          Continue
        </Button>
        <p className="subtle xsmall">
          By continuing you agree to the <Link to="/terms">terms of use</Link>. Waypoint stores your data in your account only. You can export or delete it from Settings at any time.
        </p>
      </form>
    </AuthLayout>
  );
}
