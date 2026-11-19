import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { Camera, KeyRound, Lock, X } from 'lucide-react';
import { shrinkPhoto } from '@/lib/photos';
import { Button, Callout } from '@/ui/primitives';

export interface PickedPhoto {
  mediaType: 'image/jpeg';
  data: string;
  preview: string;
}

/** Take or choose a photo; it is shrunk (and stripped of location data) right away. */
export function PhotoSlot({ label, hint, value, onChange, capture }: { label: string; hint?: string; value: PickedPhoto | null; onChange: (p: PickedPhoto | null) => void; capture?: 'user' | 'environment' }) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="photo-slot">
      <span className="field-label">{label}</span>
      {value ? (
        <div className="photo-slot__preview">
          <img src={value.preview} alt={label} />
          <Button size="sm" variant="secondary" iconOnly icon={X} aria-label={`Remove ${label.toLowerCase()}`} onClick={() => onChange(null)} />
        </div>
      ) : (
        <button type="button" className="photo-slot__empty" onClick={() => input.current?.click()}>
          <Camera aria-hidden />
          <span className="small">Take or choose a photo</span>
          {hint && <span className="xsmall subtle">{hint}</span>}
        </button>
      )}
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture={capture}
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          try {
            setError(null);
            onChange(await shrinkPhoto(f));
          } catch (err) {
            setError((err as Error).message);
          }
        }}
      />
      {error && <span className="xsmall" style={{ color: 'var(--danger)' }}>{error}</span>}
    </div>
  );
}

export function AiNotReady() {
  return (
    <Callout tone="info" title="Connect the AI first" icon={KeyRound} action={<Link to="/settings/connections" className="btn btn-sm btn-primary">Open Connections</Link>}>
      This uses Claude, the same AI as the study-set generator. Add an Anthropic API key in Settings → Connections.
    </Callout>
  );
}

export function PhotoPrivacy({ photosAllowed }: { photosAllowed: boolean }) {
  return photosAllowed ? (
    <p className="xsmall subtle row-sm" style={{ alignItems: 'flex-start' }}>
      <Lock aria-hidden style={{ width: 14, flex: 'none', marginTop: 2 }} />
      Photos are shrunk on your device, sent once to the AI service (Anthropic) and never stored. Only the written result is saved.
    </p>
  ) : null;
}

export function UnderEighteen({ what }: { what: string }) {
  return (
    <Callout tone="neutral" icon={Lock}>
      Photo analysis is for ages 18 and up, so your {what} comes from your answers below. It works the same way, and no photo of you is ever sent anywhere.
    </Callout>
  );
}

export const when = (ms: number) => new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
