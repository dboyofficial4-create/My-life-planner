import { X, CheckCircle2, AlertCircle } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { clsx } from 'clsx';
import { Button } from './primitives';

/* ---------- Dialog: native <dialog> gives focus trapping, Escape and inert background ---------- */

export function Dialog({ open, onClose, title, description, children, footer, wide }: { open: boolean; onClose: () => void; title: ReactNode; description?: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={clsx('dialog', wide && 'dialog-wide')}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      {open && (
        <div className="dialog-panel">
          <div className="dialog-header">
            <div className="stack-sm" style={{ gap: 4 }}>
              <h2 id={titleId}>{title}</h2>
              {description && (
                <p id={descId} className="muted small">
                  {description}
                </p>
              )}
            </div>
            <Button variant="ghost" size="sm" iconOnly icon={X} onClick={onClose} aria-label="Close" />
          </div>
          <div className="dialog-body">{children}</div>
          {footer && <div className="dialog-footer">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

/* ---------- Toasts ---------- */

interface Toast {
  id: number;
  message: string;
  tone: 'default' | 'error';
  action?: { label: string; run: () => void };
}
const ToastCtx = createContext<(t: Omit<Toast, 'id' | 'tone'> & { tone?: Toast['tone'] }) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((t: Omit<Toast, 'id' | 'tone'> & { tone?: Toast['tone'] }) => {
    const id = Date.now() + Math.random();
    setToasts((all) => [...all.slice(-2), { ...t, tone: t.tone ?? 'default', id }]);
    setTimeout(() => setToasts((all) => all.filter((x) => x.id !== id)), t.action ? 7000 : 4000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={clsx('toast', t.tone === 'error' && 'toast-error')}>
            {t.tone === 'error' ? <AlertCircle aria-hidden /> : <CheckCircle2 aria-hidden />}
            <span>{t.message}</span>
            {t.action && (
              <button
                onClick={() => {
                  t.action!.run();
                  setToasts((all) => all.filter((x) => x.id !== t.id));
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);
