import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { useState } from 'react';
import { KeyRound, X } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/ui/primitives';

const KEY = 'waypoint.recoveryPrompt.dismissed';

/** Until a recovery code exists, suggest making one (a forgotten password is otherwise unrecoverable without email). */
export function RecoveryPrompt() {
  const q = useQuery({ queryKey: ['security'], queryFn: () => api.get<{ isDemo: boolean; recoveryCodeCreatedAt: string | null }>('/account/security') });
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } });
  if (hidden || !q.data || q.data.isDemo || q.data.recoveryCodeCreatedAt) return null;
  return (
    <div className="reminder-prompt" role="region" aria-label="Make a recovery code">
      <span className="reminder-prompt__icon"><KeyRound aria-hidden /></span>
      <div className="grow stack-sm" style={{ gap: 2 }}>
        <span className="strong">Don’t get locked out</span>
        <span className="small muted">Make a recovery code. If you ever forget your password, it lets you set a new one.</span>
      </div>
      <div className="row-sm">
        <Link to="/settings/security" className="btn btn-primary">Make my code</Link>
        <Button variant="ghost" iconOnly icon={X} aria-label="Dismiss" onClick={() => { try { localStorage.setItem(KEY, '1'); } catch { /* ok */ } setHidden(true); }} />
      </div>
    </div>
  );
}
