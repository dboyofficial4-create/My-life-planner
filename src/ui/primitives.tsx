import { clsx } from 'clsx';
import { AlertTriangle, CheckCircle2, Info, RefreshCw, XCircle, type LucideIcon } from 'lucide-react';
import { forwardRef, useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

/* ---------- Button ---------- */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: LucideIcon;
  block?: boolean;
  iconOnly?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading, icon: Icon, block, iconOnly, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={clsx('btn', `btn-${variant}`, size !== 'md' && `btn-${size}`, block && 'btn-block', iconOnly && 'btn-icon', className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <span className="spinner" aria-hidden /> : Icon ? <Icon aria-hidden /> : null}
      {children}
    </button>
  );
});

/* ---------- Card ---------- */

export function Card({ title, action, children, className, pad, footer, quiet, as: As = 'section', titleId }: { title?: ReactNode; action?: ReactNode; children?: ReactNode; className?: string; pad?: boolean; footer?: ReactNode; quiet?: boolean; as?: 'section' | 'div' | 'article'; titleId?: string }) {
  const autoId = useId();
  const id = titleId ?? autoId;
  return (
    <As className={clsx('card', quiet && 'card-quiet', className)} aria-labelledby={title ? id : undefined}>
      {title && (
        <header className="card-header">
          <h2 id={id}>{title}</h2>
          {action}
        </header>
      )}
      {pad === false ? children : <div className={title ? 'card-body' : 'card-pad'}>{children}</div>}
      {footer && <footer className="card-footer">{footer}</footer>}
    </As>
  );
}

/* ---------- Badge & Callout ---------- */

export function Badge({ tone = 'neutral', children, icon: Icon, outline }: { tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info'; children: ReactNode; icon?: LucideIcon; outline?: boolean }) {
  return (
    <span className={clsx('badge', tone !== 'neutral' && `badge-${tone}`, outline && 'badge-outline')}>
      {Icon && <Icon aria-hidden />}
      {children}
    </span>
  );
}

const CALLOUT_ICONS = { info: Info, warning: AlertTriangle, danger: XCircle, accent: CheckCircle2, neutral: Info };
export function Callout({ tone = 'neutral', title, children, icon, action }: { tone?: keyof typeof CALLOUT_ICONS; title?: ReactNode; children?: ReactNode; icon?: LucideIcon; action?: ReactNode }) {
  const Icon = icon ?? CALLOUT_ICONS[tone];
  return (
    <div className={clsx('callout', tone !== 'neutral' && `callout-${tone}`)} role={tone === 'danger' ? 'alert' : undefined}>
      <Icon aria-hidden />
      <div className="grow stack-sm" style={{ gap: 2 }}>
        {title && <div className="callout-title">{title}</div>}
        {children && <div>{children}</div>}
      </div>
      {action}
    </div>
  );
}

/* ---------- Form fields ---------- */

export function Field({ label, hint, error, optional, children, id, className }: { label: ReactNode; hint?: ReactNode; error?: string; optional?: boolean; children: (props: { id: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string }) => ReactNode; id?: string; className?: string }) {
  const auto = useId();
  const fid = id ?? auto;
  const describedBy = [hint && `${fid}-hint`, error && `${fid}-err`].filter(Boolean).join(' ') || undefined;
  return (
    <div className={clsx('field', className)}>
      <label className="field-label" htmlFor={fid}>
        {label}
        {optional && <span className="field-optional">Optional</span>}
      </label>
      {children({ id: fid, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy })}
      {hint && !error && (
        <div className="field-hint" id={`${fid}-hint`}>
          {hint}
        </div>
      )}
      {error && (
        <div className="field-error" id={`${fid}-err`} role="alert">
          {error}
        </div>
      )}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...p }, ref) {
  return <input ref={ref} className={clsx('input', className)} {...p} />;
});
export function Select({ className, children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={clsx('select', className)} {...p}>
      {children}
    </select>
  );
}
export function Textarea({ className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={clsx('textarea', className)} {...p} />;
}

/** Number input that stores numbers (or null when empty). */
export function NumberInput({ value, onChange, min, max, step, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & { value: number | null; onChange: (v: number | null) => void; min?: number; max?: number; step?: number }) {
  return (
    <Input
      type="number"
      inputMode="decimal"
      value={value ?? ''}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
      {...rest}
    />
  );
}

/* ---------- Choice chips ---------- */

export interface ChoiceOption<T extends string | number> {
  value: T;
  label: ReactNode;
  disabled?: boolean;
  description?: ReactNode;
  icon?: LucideIcon;
}

export function Chips<T extends string | number>({ label, options, value, onChange, multiple, hideLabel, error }: { label: string; options: ChoiceOption<T>[]; value: T[] | T | null; onChange: (v: T[] | T) => void; multiple?: boolean; hideLabel?: boolean; error?: string }) {
  const name = useId();
  const selected = Array.isArray(value) ? value : value === null ? [] : [value];
  return (
    <fieldset className="field" style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
      <legend className={hideLabel ? 'sr-only' : 'field-label'} style={{ marginBottom: 6, padding: 0 }}>
        {label}
      </legend>
      <div className="chips">
        {options.map((o) => {
          const checked = selected.includes(o.value);
          return (
            <label key={String(o.value)} className="chip" data-checked={checked} data-disabled={o.disabled || undefined}>
              <input
                type={multiple ? 'checkbox' : 'radio'}
                name={name}
                checked={checked}
                disabled={o.disabled}
                onChange={() => {
                  if (multiple) onChange(checked ? selected.filter((v) => v !== o.value) : [...selected, o.value]);
                  else onChange(o.value);
                }}
              />
              {o.icon && <o.icon aria-hidden />}
              {o.label}
            </label>
          );
        })}
      </div>
      {error && <div className="field-error">{error}</div>}
    </fieldset>
  );
}

export function OptionCards<T extends string>({ label, options, value, onChange, multiple }: { label: string; options: ChoiceOption<T>[]; value: T[] | T; onChange: (v: T[] | T) => void; multiple?: boolean }) {
  const name = useId();
  const selected = Array.isArray(value) ? value : [value];
  return (
    <fieldset style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
      <legend className="sr-only">{label}</legend>
      <div className="options">
        {options.map((o) => {
          const checked = selected.includes(o.value);
          return (
            <label key={o.value} className="option" data-checked={checked} data-disabled={o.disabled || undefined}>
              <input
                type={multiple ? 'checkbox' : 'radio'}
                name={name}
                checked={checked}
                disabled={o.disabled}
                onChange={() => (multiple ? onChange(checked ? selected.filter((v) => v !== o.value) : [...selected, o.value]) : onChange(o.value))}
              />
              {o.icon && (
                <span className="option-icon">
                  <o.icon aria-hidden />
                </span>
              )}
              <span>
                <span className="option-title">{o.label}</span>
                {o.description && <span className="option-desc" style={{ display: 'block' }}>{o.description}</span>}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function Segmented<T extends string>({ label, options, value, onChange }: { label: string; options: { value: T; label: ReactNode }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Switch({ label, checked, onChange, description }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void; description?: ReactNode }) {
  return (
    <label className="switch">
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <span className="strong">{label}</span>
        {description && <span className="field-hint" style={{ display: 'block' }}>{description}</span>}
      </span>
    </label>
  );
}

/* ---------- States ---------- */

export function Skeleton({ h = 16, w = '100%', r }: { h?: number; w?: number | string; r?: number }) {
  return <div className="skeleton" style={{ height: h, width: w, borderRadius: r }} aria-hidden />;
}

export function PageSkeleton() {
  return (
    <div className="page" aria-busy="true" aria-label="Loading">
      <Skeleton h={28} w={240} />
      <Skeleton h={14} w={360} />
      <div className="grid-2">
        <Skeleton h={180} r={12} />
        <Skeleton h={180} r={12} />
      </div>
      <Skeleton h={240} r={12} />
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children, action }: { icon: LucideIcon; title: ReactNode; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon aria-hidden />
      </div>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action && <div style={{ marginTop: 'var(--s-2)' }}>{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : 'Something went wrong.';
  return (
    <div className="empty" role="alert">
      <div className="empty-icon" style={{ color: 'var(--danger)', background: 'var(--danger-soft)' }}>
        <XCircle aria-hidden />
      </div>
      <h3>Couldn’t load this</h3>
      <p>{message}</p>
      {onRetry && (
        <Button icon={RefreshCw} onClick={onRetry} size="sm">
          Try again
        </Button>
      )}
    </div>
  );
}

export function ProgressBar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange, label }: { tabs: { value: T; label: ReactNode }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          className="tab"
          aria-selected={value === t.value}
          tabIndex={value === t.value ? 0 : -1}
          onClick={() => onChange(t.value)}
          onKeyDown={(e) => {
            const idx = tabs.findIndex((x) => x.value === value);
            if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
              const next = tabs[(idx + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]!;
              onChange(next.value);
              requestAnimationFrame(() => (e.currentTarget.parentElement?.querySelector('[aria-selected="true"]') as HTMLElement | null)?.focus());
            }
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function PageHeader({ title, description, actions, eyebrow }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <header className="page-header">
      <div className="stack-sm" style={{ gap: 2 }}>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}
