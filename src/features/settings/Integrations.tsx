import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, CircleSlash, Clock, KeyRound, Link2Off, PlugZap } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { useToast } from '@/ui/overlay';
import { Badge, Button, Card, ErrorState, Skeleton } from '@/ui/primitives';

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
  connection: null | { status: string; lastSyncAt: string | null; lastError: string | null };
}

const STATUS = {
  available: { label: 'Available', tone: 'success', icon: CheckCircle2 },
  needs_credentials: { label: 'Needs setup', tone: 'warning', icon: KeyRound },
  not_supported: { label: 'Not supported', tone: 'neutral', icon: CircleSlash },
  planned: { label: 'Planned', tone: 'info', icon: Clock },
} as const;

export function IntegrationsList({ module }: { module?: string }) {
  const q = useQuery({ queryKey: ['integrations'], queryFn: () => api.get<{ integrations: Integration[] }>('/integrations') });
  const qc = useQueryClient();
  const toast = useToast();
  const disconnect = useMutation({
    mutationFn: (id: string) => api.del(`/integrations/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['integrations'] });
      toast({ message: 'Disconnected and stored access removed.' });
    },
    onError: (e) => toast({ message: errorMessage(e), tone: 'error' }),
  });
  if (q.isPending) return <Skeleton h={200} r={12} />;
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const list = q.data.integrations.filter((i) => !module || i.module === module);
  return (
    <div className="stack">
      {list.map((i) => {
        const st = STATUS[i.status];
        return (
          <Card
            key={i.id}
            title={<span className="row-sm"><PlugZap aria-hidden style={{ width: 16 }} /> {i.name}</span>}
            action={<Badge tone={st.tone} icon={st.icon}>{st.label}</Badge>}
            footer={
              i.connection && i.id !== 'ics_import' ? (
                <div className="row between small">
                  <span className="muted">
                    {i.connection.status}
                    {i.connection.lastSyncAt ? ` · last sync ${new Date(i.connection.lastSyncAt).toLocaleString()}` : ''}
                    {i.connection.lastError ? ` · ${i.connection.lastError}` : ''}
                  </span>
                  <Button size="sm" icon={Link2Off} loading={disconnect.isPending} onClick={() => disconnect.mutate(i.id)}>Disconnect</Button>
                </div>
              ) : i.connection?.lastSyncAt ? (
                <span className="xsmall subtle">Last used {new Date(i.connection.lastSyncAt).toLocaleString()}</span>
              ) : undefined
            }
          >
            <div className="grid-2 small">
              {i.implemented.length > 0 && (
                <div className="stack-sm"><div className="eyebrow">What works</div><ul className="muted" style={{ paddingLeft: 18 }}>{i.implemented.map((x) => <li key={x}>{x}</li>)}</ul></div>
              )}
              <div className="stack-sm"><div className="eyebrow">What it needs</div><ul className="muted" style={{ paddingLeft: 18 }}>{i.requires.map((x) => <li key={x}>{x}</li>)}</ul></div>
              {i.unsupported.length > 0 && (
                <div className="stack-sm"><div className="eyebrow">Not supported</div><ul className="muted" style={{ paddingLeft: 18 }}>{i.unsupported.map((x) => <li key={x}>{x}</li>)}</ul></div>
              )}
              <div className="stack-sm"><div className="eyebrow">Instead, you can</div><p className="muted">{i.fallback}</p></div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
