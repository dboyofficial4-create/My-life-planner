import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellRing, BellOff, Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import { DEFAULT_REMINDERS, type ReminderSettings } from '@shared/domain/reminders';
import { api, errorMessage } from '@/lib/api';
import { disablePush, enablePush, pushState, type PushState } from '@/lib/push';
import { useToast } from '@/ui/overlay';
import { Badge, Button, Callout, Card, Chips, Field, Select, Switch } from '@/ui/primitives';

const STATE_TEXT: Record<PushState, { label: string; tone: 'success' | 'warning' | 'neutral' | 'danger' }> = {
  on: { label: 'On for this device', tone: 'success' },
  off: { label: 'Off for this device', tone: 'neutral' },
  denied: { label: 'Blocked in browser settings', tone: 'danger' },
  unsupported: { label: 'Not supported in this browser', tone: 'warning' },
  'needs-install': { label: 'Add to Home Screen first', tone: 'warning' },
};

export function RemindersSection({ initial }: { initial?: ReminderSettings }) {
  const [s, setS] = useState<ReminderSettings>(initial ?? DEFAULT_REMINDERS);
  const [state, setState] = useState<PushState | null>(null);
  const qc = useQueryClient();
  const toast = useToast();
  const devices = useQuery({ queryKey: ['push-key'], queryFn: () => api.get<{ publicKey: string | null; devices: number }>('/reminders/push-key') });

  useEffect(() => {
    pushState().then(setState).catch(() => setState('unsupported'));
  }, []);

  const save = useMutation({
    mutationFn: (v: ReminderSettings) => api.put('/settings/reminders', v),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] });
      toast({ message: 'Reminder settings saved.' });
    },
    onError: (e) => toast({ message: errorMessage(e), tone: 'error' }),
  });
  const turnOn = useMutation({
    mutationFn: enablePush,
    onSuccess: (st) => {
      setState(st);
      devices.refetch();
      if (st === 'on') toast({ message: 'Notifications are on for this device.' });
    },
    onError: (e) => toast({ message: errorMessage(e), tone: 'error' }),
  });
  const turnOff = useMutation({ mutationFn: disablePush, onSuccess: (st) => { setState(st); devices.refetch(); } });
  const test = useMutation({
    mutationFn: () => api.post<{ devices: number }>('/reminders/test'),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      toast({ message: r.devices ? `Test sent to ${r.devices} device${r.devices === 1 ? '' : 's'}. It should pop up in a few seconds.` : 'Test added to the bell. Turn on notifications on a device to get pop-ups.' });
    },
    onError: (e) => toast({ message: errorMessage(e), tone: 'error' }),
  });

  const set = (patch: Partial<ReminderSettings>) => {
    const next = { ...s, ...patch };
    setS(next);
    save.mutate(next);
  };

  return (
    <>
      <Card title={<span className="row-sm"><BellRing aria-hidden style={{ width: 16 }} /> Notifications on this device</span>} action={state && <Badge tone={STATE_TEXT[state].tone}>{STATE_TEXT[state].label}</Badge>}>
        <div className="stack">
          <p className="small muted">Reminders pop up like a text, even when the Waypoint tab is closed, as long as your browser is running. Every reminder also appears under the bell in the app.</p>
          {state === 'needs-install' && (
            <Callout tone="info" title="On iPhone or iPad">
              In Safari, tap <span className="strong">Share → Add to Home Screen</span>, open Waypoint from the new icon, then come back here. (This works on the online version of Waypoint, not on <code>localhost</code>.)
            </Callout>
          )}
          {state === 'denied' && (
            <Callout tone="warning" title="Notifications are blocked for this site">
              Click the icon to the left of the web address → <span className="strong">Site settings</span> → set <span className="strong">Notifications</span> to <span className="strong">Allow</span>, then reload.
            </Callout>
          )}
          {state === 'unsupported' && <Callout tone="warning">This browser can’t show web notifications. Try Chrome, Edge or Firefox. You’ll still see reminders under the bell.</Callout>}
          <div className="row-wrap">
            {state !== 'on' ? (
              <Button variant="primary" icon={BellRing} loading={turnOn.isPending} disabled={state === 'unsupported' || state === 'needs-install' || state === 'denied' || !devices.data?.publicKey} onClick={() => turnOn.mutate()}>
                Turn on notifications
              </Button>
            ) : (
              <Button icon={BellOff} loading={turnOff.isPending} onClick={() => turnOff.mutate()}>Turn off on this device</Button>
            )}
            <Button icon={Send} loading={test.isPending} onClick={() => test.mutate()}>Send a test reminder</Button>
          </div>
          {devices.data && <p className="xsmall subtle">Turned on for {devices.data.devices} device{devices.data.devices === 1 ? '' : 's'} on this account. Reminders are never sent during your sleep hours.</p>}
          <p className="xsmall subtle">Privacy: the browser’s push service (for Chrome, Google) only receives an empty “wake up” signal. The reminder text comes straight from Waypoint.</p>
        </div>
      </Card>

      <Card title="What to remind me about">
        <div className="stack-lg">
          <Switch label="Reminders" description="Turn all reminders on or off." checked={s.enabled} onChange={(v) => set({ enabled: v })} />
          {s.enabled && (
            <>
              <Field label="Remind me before activities start">
                {(p) => (
                  <Select {...p} value={s.leadMinutes} onChange={(e) => set({ leadMinutes: Number(e.target.value) })} style={{ maxWidth: 220 }}>
                    {[0, 5, 10, 15, 30, 60].map((m) => <option key={m} value={m}>{m === 0 ? 'When it starts' : `${m} minutes before`}</option>)}
                  </Select>
                )}
              </Field>
              <Chips<string>
                label="Activities"
                multiple
                value={(Object.keys(s.activities) as (keyof ReminderSettings['activities'])[]).filter((k) => s.activities[k])}
                onChange={(v) => {
                  const on = new Set(v as string[]);
                  set({ activities: { training: on.has('training'), study: on.has('study'), commitments: on.has('commitments'), care: on.has('care'), meals: on.has('meals') } });
                }}
                options={[
                  { value: 'study', label: 'Study sessions' },
                  { value: 'training', label: 'Workouts & skill practice' },
                  { value: 'commitments', label: 'Practices, games & appointments' },
                  { value: 'care', label: 'Skin & hair routines' },
                  { value: 'meals', label: 'Meals' },
                ]}
              />
              <Switch label="Deadlines" description="3 days before a test, project or essay; the evening before; and the morning it’s due." checked={s.deadlines} onChange={(v) => set({ deadlines: v })} />
              <Switch label="Morning summary" description="Shortly after you wake up: what’s planned and what’s due." checked={s.morningSummary} onChange={(v) => set({ morningSummary: v })} />
              <Switch label="Flashcards due" description="Once a day when you have cards to review." checked={s.flashcards} onChange={(v) => set({ flashcards: v })} />
              <Switch label="Gentle nudge if something slips" description="30 minutes after a study session or workout ends without being marked done." checked={s.missedNudges} onChange={(v) => set({ missedNudges: v })} />
              <p className="xsmall subtle">School and work hours never trigger reminders — you already know you have school.</p>
            </>
          )}
        </div>
      </Card>
    </>
  );
}

