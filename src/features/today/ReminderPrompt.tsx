import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { BellRing, X } from 'lucide-react';
import { enablePush, pushState, type PushState } from '@/lib/push';
import { errorMessage } from '@/lib/api';
import { useToast } from '@/ui/overlay';
import { Button } from '@/ui/primitives';

const KEY = 'waypoint.reminderPrompt.dismissed';
const dismissed = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } };

/** Asks once, on Today, to turn on reminder notifications for this device. */
export function ReminderPrompt() {
  const [state, setState] = useState<PushState | null>(null);
  const [hidden, setHidden] = useState(dismissed);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  useEffect(() => { pushState().then(setState).catch(() => setState('unsupported')); }, []);
  if (hidden || !state || state === 'on') return null;
  const close = () => { try { localStorage.setItem(KEY, '1'); } catch { /* ok */ } setHidden(true); };
  const turnOn = async () => {
    setBusy(true);
    try {
      const s = await enablePush();
      setState(s);
      if (s === 'on') toast({ message: 'Reminders are on. You’ll get one before activities and deadlines.' });
      else if (s === 'denied') toast({ message: 'Notifications are blocked for this site. Settings → Reminders shows how to allow them.', tone: 'error' });
    } catch (e) {
      toast({ message: errorMessage(e), tone: 'error' });
    } finally {
      setBusy(false);
    }
  };
  const text: Record<Exclude<PushState, 'on'>, string> = {
    off: 'Get a notification 3 days before tests, the evening before anything is due, and before study blocks and practice.',
    denied: 'Notifications are blocked for this site in your browser. Allow them to get reminders before deadlines.',
    'needs-install': 'On iPhone or iPad, add Waypoint to your Home Screen first, then turn on reminders.',
    unsupported: 'This browser can’t show notifications. Reminders still appear under the bell; Chrome, Edge or Firefox can pop them up.',
  };
  return (
    <div className="reminder-prompt" role="region" aria-label="Turn on reminders">
      <span className="reminder-prompt__icon"><BellRing aria-hidden /></span>
      <div className="grow stack-sm" style={{ gap: 2 }}>
        <span className="strong">Don’t miss another deadline</span>
        <span className="small muted">{text[state]}</span>
      </div>
      <div className="row-sm">
        {state === 'off' ? (
          <Button variant="primary" loading={busy} onClick={turnOn}>Turn on reminders</Button>
        ) : (
          <Link to="/settings/reminders" className="btn btn-secondary">Reminder settings</Link>
        )}
        <Button variant="ghost" iconOnly icon={X} aria-label="Dismiss" onClick={close} />
      </div>
    </div>
  );
}
