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

export type Provider = 'claude' | 'gemini' | null;

export function AiNotReady() {
  return (
    <Callout tone="info" title="Connect an AI first" icon={KeyRound} action={<Link to="/settings/connections" className="btn btn-sm btn-primary">Open Connections</Link>}>
      Add an Anthropic key in Settings → Connections, or put <code>ANTHROPIC_API_KEY</code> or <code>GEMINI_API_KEY</code> in Waypoint’s <code>.env</code> file and restart it.
    </Callout>
  );
}

/** Who receives the answers and photos, named in the consent line. */
export function consentText(provider: Provider, withPhotos: boolean, purpose: string) {
  const what = withPhotos ? 'these photos and answers' : 'these answers';
  return provider === 'gemini'
    ? `Send ${what} to Google’s Gemini AI to make my ${purpose}. On Gemini’s free tier, Google may use what’s sent, including photos, to improve its products.`
    : `Send ${what} to the AI service (Anthropic) to make my ${purpose}.`;
}

export function PhotoPrivacy({ photosAllowed, provider }: { photosAllowed: boolean; provider: Provider }) {
  return photosAllowed ? (
    <p className="xsmall subtle row-sm" style={{ alignItems: 'flex-start' }}>
      <Lock aria-hidden style={{ width: 14, flex: 'none', marginTop: 2 }} />
      {provider === 'gemini'
        ? 'Photos are shrunk on your device and sent once to Google Gemini; Waypoint never stores them, but on the free tier Google may keep and review what it receives. Only the written result is saved here.'
        : 'Photos are shrunk on your device, sent once to the AI service (Anthropic) and never stored. Only the written result is saved.'}
    </p>
  ) : null;
}

export function NoPhotos({ age, what }: { age: number; what: string }) {
  return (
    <Callout tone="neutral" icon={Lock}>
      Photos here are for ages {age} and up, so your {what} comes from your answers below. It works the same way, and no photo of you is sent anywhere.
    </Callout>
  );
}

/** Shown once a photo is picked: the photo rules must be confirmed before anything is sent. */
export function PhotoRulesCheck({ checked, onChange, rule }: { checked: boolean; onChange: (v: boolean) => void; rule: string }) {
  return (
    <label className="checkbox">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="small">
        My photos follow the <Link to="/terms#photos" target="_blank">photo rules</Link>: {rule}
      </span>
    </label>
  );
}

export const when = (ms: number) => new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
