import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Columns2, KeyRound, Lock, ShieldCheck, Trash2, Unlock, X } from 'lucide-react';
import clsx from 'clsx';
import { useMe } from '@/app/App';
import { shrinkPhoto } from '@/lib/photos';
import { addPhoto, createVault, deletePhoto, lockPhotos, readPhotos, unlockVault, vaultMeta, wipeVault, type VaultPhoto } from '@/lib/vault';
import { useToast } from '@/ui/overlay';
import { Button, Callout, Card, Field, Input, Skeleton } from '@/ui/primitives';

const IDLE_LOCK_MS = 5 * 60_000;
const MAX_TRIES = 5;
const COOLDOWN_MS = 30_000;
const today = () => new Date().toLocaleDateString('en-CA');
const nice = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
const daysBetween = (a: string, b: string) => Math.round(Math.abs(new Date(`${a}T12:00:00`).getTime() - new Date(`${b}T12:00:00`).getTime()) / 86_400_000);

type Phase = 'loading' | 'none' | 'locked' | 'open';

export function ProgressPhotos() {
  const me = useMe();
  const userId = me.data?.user.id ?? '';
  const toast = useToast();
  const [phase, setPhase] = useState<Phase>('loading');
  const [key, setKey] = useState<CryptoKey | null>(null);
  const [photos, setPhotos] = useState<VaultPhoto[]>([]);
  const photosRef = useRef<VaultPhoto[]>([]);
  photosRef.current = photos;

  useEffect(() => {
    if (!userId) return;
    vaultMeta(userId).then((m) => setPhase(m ? 'locked' : 'none')).catch(() => setPhase('none'));
  }, [userId]);

  const lock = useCallback(() => {
    lockPhotos(photosRef.current);
    setPhotos([]);
    setKey(null); // the only reference to the key is dropped
    setPhase((p) => (p === 'open' ? 'locked' : p));
  }, []);

  // Lock when the tab is hidden, after 5 idle minutes, and when leaving the page.
  useEffect(() => {
    if (phase !== 'open') return;
    let t = setTimeout(lock, IDLE_LOCK_MS);
    const poke = () => { clearTimeout(t); t = setTimeout(lock, IDLE_LOCK_MS); };
    const hidden = () => { if (document.visibilityState === 'hidden') lock(); };
    const events = ['pointerdown', 'keydown', 'scroll'] as const;
    events.forEach((e) => window.addEventListener(e, poke, { passive: true }));
    document.addEventListener('visibilitychange', hidden);
    return () => {
      clearTimeout(t);
      events.forEach((e) => window.removeEventListener(e, poke));
      document.removeEventListener('visibilitychange', hidden);
    };
  }, [phase, lock]);
  useEffect(() => () => lockPhotos(photosRef.current), []);

  const opened = async (k: CryptoKey) => {
    setKey(k);
    setPhotos(await readPhotos(userId, k));
    setPhase('open');
  };

  if (!userId || phase === 'loading') return <Card><Skeleton h={120} /></Card>;
  return (
    <div className="stack-lg">
      <div className="vault-note">
        <ShieldCheck aria-hidden />
        <p className="small">
          <span className="strong">Only on this device, locked with your passcode.</span> Photos are encrypted before they’re saved and never uploaded: Waypoint’s server can’t receive them, they aren’t sent to any AI and they aren’t in your data export. They don’t sync to your other devices. A forgotten passcode can’t be recovered.
        </p>
      </div>
      {phase === 'none' && <Setup userId={userId} onDone={opened} />}
      {phase === 'locked' && <Unlocker userId={userId} onOpen={opened} onWiped={() => setPhase('none')} />}
      {phase === 'open' && key && (
        <Gallery
          userId={userId}
          cryptoKey={key}
          photos={photos}
          reload={async () => { lockPhotos(photosRef.current); setPhotos(await readPhotos(userId, key)); }}
          onLock={() => { lock(); toast({ message: 'Vault locked.' }); }}
        />
      )}
    </div>
  );
}

function Setup({ userId, onDone }: { userId: string; onDone: (k: CryptoKey) => void }) {
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Card title={<span className="row-sm"><KeyRound aria-hidden style={{ width: 16 }} /> Create a passcode</span>}>
      <form
        className="stack"
        onSubmit={async (e) => {
          e.preventDefault();
          if (a.length < 6) return setError('Use at least 6 characters. Longer is safer.');
          if (a !== b) return setError('The two passcodes don’t match.');
          setBusy(true);
          try { onDone(await createVault(userId, a)); } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
        }}
      >
        <p className="small muted">Pick something other people can’t guess, and don’t use your account password. Without it, nobody (including you) can open these photos.</p>
        <Field label="Passcode" error={error ?? undefined}>{(p) => <Input {...p} type="password" autoComplete="new-password" value={a} onChange={(e) => { setA(e.target.value); setError(null); }} style={{ maxWidth: 320 }} />}</Field>
        <Field label="Type it again">{(p) => <Input {...p} type="password" autoComplete="new-password" value={b} onChange={(e) => { setB(e.target.value); setError(null); }} style={{ maxWidth: 320 }} />}</Field>
        <div><Button type="submit" variant="primary" icon={Lock} loading={busy}>Create my vault</Button></div>
      </form>
    </Card>
  );
}

function Unlocker({ userId, onOpen, onWiped }: { userId: string; onOpen: (k: CryptoKey) => void; onWiped: () => void }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tries, setTries] = useState(0);
  const [waitUntil, setWaitUntil] = useState(0);
  const [, tick] = useState(0);
  useEffect(() => { if (waitUntil > Date.now()) { const t = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(t); } }, [waitUntil]);
  const waiting = waitUntil > Date.now();
  return (
    <Card title={<span className="row-sm"><Lock aria-hidden style={{ width: 16 }} /> Vault locked</span>}>
      <form
        className="stack"
        onSubmit={async (e) => {
          e.preventDefault();
          if (waiting || !code) return;
          setBusy(true);
          try {
            const k = await unlockVault(userId, code);
            setCode('');
            if (k) return onOpen(k);
            const n = tries + 1;
            setTries(n);
            if (n >= MAX_TRIES) { setWaitUntil(Date.now() + COOLDOWN_MS); setTries(0); setError(`Wrong passcode ${MAX_TRIES} times. Wait 30 seconds.`); }
            else setError('Wrong passcode.');
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Passcode" error={error ?? undefined}>{(p) => <Input {...p} type="password" autoComplete="current-password" value={code} onChange={(e) => setCode(e.target.value)} style={{ maxWidth: 320 }} />}</Field>
        <div className="row-wrap">
          <Button type="submit" variant="primary" icon={Unlock} loading={busy} disabled={waiting}>{waiting ? `Wait ${Math.ceil((waitUntil - Date.now()) / 1000)} s` : 'Unlock'}</Button>
          <Button
            variant="ghost"
            icon={Trash2}
            onClick={async () => {
              if (!confirm('Forgot your passcode? This permanently deletes every progress photo on this device. It can’t be undone.')) return;
              await wipeVault(userId);
              onWiped();
            }}
          >
            Forgot passcode
          </Button>
        </div>
      </form>
    </Card>
  );
}

function Gallery({ userId, cryptoKey, photos, reload, onLock }: { userId: string; cryptoKey: CryptoKey; photos: VaultPhoto[]; reload: () => Promise<void>; onLock: () => void }) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ data: string; preview: string } | null>(null);
  const [date, setDate] = useState(today());
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const compare = picked.length === 2 ? picked.map((id) => photos.find((p) => p.id === id)!).filter(Boolean).sort((a, b) => (a.date < b.date ? -1 : 1)) : null;

  return (
    <>
      <div className="row-wrap between">
        <div className="row-wrap">
          <Button variant="primary" icon={Camera} onClick={() => input.current?.click()}>Add a photo</Button>
          {photos.length >= 2 && <span className="small muted">Tap two photos to compare them.</span>}
        </div>
        <Button icon={Lock} onClick={onLock}>Lock now</Button>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          try {
            const p = await shrinkPhoto(f, 1600, 0.85);
            setPending({ data: p.data, preview: p.preview });
            setDate(today());
            setNote('');
          } catch (err) {
            toast({ message: (err as Error).message, tone: 'error' });
          }
        }}
      />

      {pending && (
        <Card title="New progress photo">
          <div className="vault-new">
            <img src={pending.preview} alt="New progress photo" draggable={false} />
            <div className="stack">
              <Field label="Date taken">{(p) => <Input {...p} type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} style={{ maxWidth: 200 }} />}</Field>
              <Field label="Note" optional>{(p) => <Input {...p} value={note} maxLength={200} placeholder="e.g. end of preseason" onChange={(e) => setNote(e.target.value)} />}</Field>
              <div className="row-wrap">
                <Button
                  variant="primary"
                  icon={Lock}
                  loading={saving}
                  onClick={async () => {
                    setSaving(true);
                    try {
                      await addPhoto(userId, cryptoKey, { jpegBase64: pending.data, date, note });
                      setPending(null);
                      await reload();
                      toast({ message: 'Saved to your vault, encrypted.' });
                    } catch (err) {
                      toast({ message: (err as Error).message, tone: 'error' });
                    } finally {
                      setSaving(false);
                    }
                  }}
                >
                  Encrypt and save
                </Button>
                <Button variant="ghost" onClick={() => setPending(null)}>Cancel</Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {compare && (
        <Card title={<span className="row-sm"><Columns2 aria-hidden style={{ width: 16 }} /> {daysBetween(compare[0]!.date, compare[1]!.date)} days apart</span>} action={<Button size="sm" variant="ghost" iconOnly icon={X} aria-label="Close comparison" onClick={() => setPicked([])} />}>
          <div className="vault-compare">
            {compare.map((p) => (
              <figure key={p.id}>
                <img src={p.url} alt={`Progress photo from ${nice(p.date)}`} draggable={false} />
                <figcaption className="small"><span className="strong">{nice(p.date)}</span>{p.note ? ` · ${p.note}` : ''}</figcaption>
              </figure>
            ))}
          </div>
          <p className="xsmall subtle" style={{ marginTop: 'var(--s-3)' }}>Same light, distance and pose make changes easier to see. Strength, speed and how you feel matter more than any photo.</p>
        </Card>
      )}

      {photos.length === 0 && !pending ? (
        <Callout tone="neutral" icon={Camera}>No photos yet. Take one now and another in 4 to 6 weeks: same spot, same light, same pose.</Callout>
      ) : (
        <ul className="vault-grid">
          {photos.map((p) => {
            const on = picked.includes(p.id);
            return (
              <li key={p.id} className={clsx('vault-tile', on && 'is-picked')}>
                <button type="button" onClick={() => setPicked((s) => (on ? s.filter((x) => x !== p.id) : [...s.slice(-1), p.id]))} aria-pressed={on} aria-label={`Photo from ${nice(p.date)}${on ? ', selected' : ''}`}>
                  <img src={p.url} alt="" draggable={false} />
                </button>
                <div className="vault-tile__foot">
                  <span className="xsmall strong">{nice(p.date)}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    iconOnly
                    icon={Trash2}
                    aria-label={`Delete photo from ${nice(p.date)}`}
                    onClick={async () => {
                      if (!confirm('Delete this photo for good?')) return;
                      await deletePhoto(userId, p.id);
                      setPicked((s) => s.filter((x) => x !== p.id));
                      await reload();
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
