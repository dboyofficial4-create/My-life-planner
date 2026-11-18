import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { Bell, BellRing } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { syncPush } from '@/lib/push';
import { Dialog, useToast } from '@/ui/overlay';
import { Button, EmptyState } from '@/ui/primitives';

interface Note {
  id: string;
  kind: string;
  title: string;
  body: string;
  url: string;
  createdAt: number;
  read: boolean;
}

function ago(ms: number): string {
  const m = Math.round((Date.now() - ms) / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const q = useQuery({ queryKey: ['notifications'], queryFn: () => api.get<{ items: Note[]; unread: number }>('/notifications'), refetchInterval: 60_000 });
  const read = useMutation({ mutationFn: () => api.post('/notifications/read'), onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }) });
  const newest = useRef<string | null>(null);

  useEffect(() => {
    syncPush().catch(() => undefined);
  }, []);

  // While Waypoint is open, show new reminders in-app as well.
  useEffect(() => {
    const first = q.data?.items[0];
    if (!first) return;
    if (newest.current && newest.current !== first.id && !first.read && document.visibilityState === 'visible') {
      toast({ message: first.title, action: { label: 'Open', run: () => navigate(first.url) } });
    }
    newest.current = first.id;
  }, [q.data, toast, navigate]);

  const unread = q.data?.unread ?? 0;
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        iconOnly
        icon={unread ? BellRing : Bell}
        aria-label={unread ? `Reminders, ${unread} unread` : 'Reminders'}
        className="bell"
        data-count={unread ? (unread > 9 ? '9+' : String(unread)) : undefined}
        onClick={() => {
          setOpen(true);
          if (unread) read.mutate();
        }}
      />
      <Dialog open={open} onClose={() => setOpen(false)} title="Reminders" description="The last two weeks. Choose what you get in Settings → Reminders.">
        {!q.data || q.data.items.length === 0 ? (
          <EmptyState icon={Bell} title="No reminders yet">They’ll appear here before activities and deadlines.</EmptyState>
        ) : (
          <ul style={{ listStyle: 'none' }}>
            {q.data.items.map((n) => (
              <li key={n.id}>
                <button
                  className="list-row list-row-button"
                  style={{ padding: 'var(--s-3) 0', alignItems: 'flex-start' }}
                  onClick={() => {
                    setOpen(false);
                    navigate(n.url);
                  }}
                >
                  <span className={`cat-dot${n.read ? '' : ' is-unread'}`} style={{ marginTop: 6, background: n.read ? 'var(--border-strong)' : 'var(--accent)' }} />
                  <span className="grow">
                    <span className="small strong" style={{ display: 'block' }}>{n.title}</span>
                    {n.body && <span className="xsmall muted" style={{ display: 'block' }}>{n.body}</span>}
                  </span>
                  <span className="xsmall subtle" style={{ whiteSpace: 'nowrap' }}>{ago(n.createdAt)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <div style={{ marginTop: 'var(--s-3)' }}>
          <Button size="sm" variant="ghost" onClick={() => { setOpen(false); navigate('/settings/reminders'); }}>Reminder settings</Button>
        </div>
      </Dialog>
    </>
  );
}
