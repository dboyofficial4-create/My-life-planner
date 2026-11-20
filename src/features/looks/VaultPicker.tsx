import { useEffect, useState } from 'react';
import { Lock, Unlock } from 'lucide-react';
import { useMe } from '@/app/App';
import { lockPhotos, readPhotoData, readPhotos, unlockVault, vaultMeta, type VaultPhoto } from '@/lib/vault';
import { Button, Input } from '@/ui/primitives';
import type { PickedPhoto } from './shared';

/** Adults only: choose one of your encrypted progress photos as the "you now" photo. Nothing leaves the device until the plan form is sent. */
export function VaultPicker({ onPick, onCancel }: { onPick: (p: PickedPhoto) => void; onCancel: () => void }) {
  const userId = useMe().data?.user.id ?? '';
  const [hasVault, setHasVault] = useState<boolean | null>(null);
  const [key, setKey] = useState<CryptoKey | null>(null);
  const [photos, setPhotos] = useState<VaultPhoto[]>([]);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (userId) vaultMeta(userId).then((m) => setHasVault(!!m)).catch(() => setHasVault(false)); }, [userId]);
  useEffect(() => () => lockPhotos(photos), [photos]);

  // Not a <form>: this sits inside the build planner's form, and nested forms submit the wrong one.
  const unlock = async () => {
    if (!code) return;
    setBusy(true);
    try {
      const k = await unlockVault(userId, code);
      setCode('');
      if (!k) return setError('Wrong passcode.');
      setKey(k);
      setPhotos(await readPhotos(userId, k));
    } finally {
      setBusy(false);
    }
  };

  if (hasVault === null) return null;
  if (!hasVault) return <p className="small muted">You don’t have progress photos on this device yet. Add some in Fitness → Progress photos, or take a photo here. <Button size="sm" variant="ghost" onClick={onCancel}>Close</Button></p>;
  if (!key) {
    return (
      <div className="row-wrap">
        <Input type="password" aria-label="Progress photo passcode" placeholder="Progress photo passcode" value={code} onChange={(e) => { setCode(e.target.value); setError(null); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void unlock(); } }} style={{ maxWidth: 240 }} />
        <Button icon={Unlock} loading={busy} onClick={() => void unlock()}>Unlock</Button>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        {error && <span className="small" style={{ color: 'var(--danger)' }}>{error}</span>}
      </div>
    );
  }
  return (
    <div className="stack-sm">
      <p className="xsmall subtle row-sm"><Lock aria-hidden style={{ width: 12 }} /> Pick one. It’s only sent if you make the plan.</p>
      <ul className="vault-grid vault-grid--small">
        {photos.map((p) => (
          <li key={p.id} className="vault-tile">
            <button type="button" aria-label={`Use photo from ${p.date}`} onClick={async () => {
              const data = await readPhotoData(userId, key, p.id);
              onPick({ mediaType: 'image/jpeg', data, preview: `data:image/jpeg;base64,${data}` });
            }}>
              <img src={p.url} alt="" draggable={false} />
            </button>
            <span className="xsmall">{p.date}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
