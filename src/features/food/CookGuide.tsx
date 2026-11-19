import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, CircleCheck, Lightbulb, ListChecks, Pause, Play, RotateCcw, ShieldAlert, Timer, Utensils } from 'lucide-react';
import clsx from 'clsx';
import { COOKING_TERMS, termsIn, type GuideStep, type RecipeGuide } from '@shared/domain/nutrition/guides';
import { Badge, Button } from '@/ui/primitives';

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

/** Three short beeps with the Web Audio API (no sound file needed). */
function beep() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    for (let i = 0; i < 3; i++) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.35);
      g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + i * 0.35 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.35 + 0.25);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.35);
      o.stop(ctx.currentTime + i * 0.35 + 0.3);
    }
    setTimeout(() => ctx.close(), 1500);
  } catch {
    /* sound is a nice-to-have */
  }
  navigator.vibrate?.([200, 100, 200]);
}

function StepTimer({ minutes }: { minutes: number }) {
  const total = Math.round(minutes * 60);
  const [left, setLeft] = useState(total);
  const [running, setRunning] = useState(false);
  const end = useRef<number | null>(null);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      const s = Math.max(0, Math.round(((end.current ?? 0) - Date.now()) / 1000));
      setLeft(s);
      if (s === 0) {
        setRunning(false);
        beep();
      }
    }, 250);
    return () => clearInterval(t);
  }, [running]);
  const start = () => {
    end.current = Date.now() + (left || total) * 1000;
    if (!left) setLeft(total);
    setRunning(true);
  };
  return (
    <div className={clsx('cook-timer', left === 0 && 'is-done')} role="timer" aria-live={left === 0 ? 'assertive' : 'off'}>
      <Timer aria-hidden />
      <span className="num">{left === 0 ? 'Time’s up' : mmss(left)}</span>
      {running ? (
        <Button size="sm" variant="ghost" icon={Pause} onClick={() => setRunning(false)}>Pause</Button>
      ) : (
        <Button size="sm" variant="ghost" icon={Play} onClick={start}>{left === total ? 'Start timer' : left === 0 ? 'Again' : 'Resume'}</Button>
      )}
      {left !== total && left !== 0 && !running && <Button size="sm" variant="ghost" iconOnly icon={RotateCcw} aria-label="Reset timer" onClick={() => setLeft(total)} />}
    </div>
  );
}

function StepBody({ step }: { step: GuideStep }) {
  const terms = termsIn(step.text);
  return (
    <div className="cook-step__body">
      <p className="cook-step__text">{step.text}</p>
      {step.minutes ? <StepTimer key={step.text} minutes={step.minutes} /> : null}
      {step.doneWhen && (
        <p className="cook-note cook-note--done"><CircleCheck aria-hidden /><span><b>Done when:</b> {step.doneWhen}</span></p>
      )}
      {step.tip && <p className="cook-note"><Lightbulb aria-hidden /><span>{step.tip}</span></p>}
      {step.safety && <p className="cook-note cook-note--safety"><ShieldAlert aria-hidden /><span><b>Safety:</b> {step.safety}</span></p>}
      {terms.length > 0 && (
        <div className="cook-terms">
          {terms.map((t) => (
            <details key={t}>
              <summary>What does “{t}” mean?</summary>
              <p>{COOKING_TERMS[t]}</p>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}

/** The recipe written out for beginners: get ready, then every step with what "done" looks like. */
export function CookGuide({ guide, ingredients }: { guide: RecipeGuide; ingredients: { key: string; label: string }[] }) {
  const [mode, setMode] = useState<'overview' | 'cook'>('overview');
  const [at, setAt] = useState(0);
  const [ready, setReady] = useState<Set<string>>(new Set());
  const toggle = (k: string) => setReady((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const prep = [...guide.equipment.map((e) => `Get out: ${e}`), ...ingredients.map((i) => `Have ready: ${i.label}`), ...guide.beforeYouStart];

  if (mode === 'cook') {
    const last = guide.steps.length; // the step after the last is "Finished"
    const step = guide.steps[at];
    return (
      <div className="cook-mode">
        <div className="row between">
          <Button size="sm" variant="ghost" icon={ArrowLeft} onClick={() => setMode('overview')}>Whole recipe</Button>
          <span className="small subtle num">{at < last ? `Step ${at + 1} of ${last}` : 'Finished'}</span>
        </div>
        <div className="progress" aria-hidden><span style={{ width: `${(Math.min(at, last) / last) * 100}%` }} /></div>
        {step ? (
          <div className="cook-step cook-step--big">
            <span className="cook-step__num">{at + 1}</span>
            <StepBody step={step} />
          </div>
        ) : (
          <div className="cook-finished">
            <CircleCheck aria-hidden />
            <h3>That’s it. Enjoy your meal.</h3>
            {guide.storage && <p className="small muted">Leftovers: {guide.storage}</p>}
          </div>
        )}
        <div className="row between">
          <Button icon={ArrowLeft} disabled={at === 0} onClick={() => setAt((n) => Math.max(0, n - 1))}>Back</Button>
          {at < last ? (
            <Button variant="primary" onClick={() => setAt((n) => n + 1)}>{at === last - 1 ? 'Finish' : 'Next step'} <ArrowRight aria-hidden /></Button>
          ) : (
            <Button variant="primary" onClick={() => { setAt(0); setMode('overview'); }}>Done</Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="stack-lg">
      <div className="cook-start">
        <div className="stack-sm">
          <h3 className="row-sm"><ListChecks aria-hidden style={{ width: 18 }} /> Before you start</h3>
          <p className="xsmall subtle">Getting everything out and cut first is how cooks keep calm. Tick each one off.</p>
        </div>
        <ul className="cook-checklist">
          {prep.map((p) => (
            <li key={p}>
              <label className="checkbox">
                <input type="checkbox" checked={ready.has(p)} onChange={() => toggle(p)} />
                <span className={clsx('small', ready.has(p) && 'subtle')} style={{ textDecoration: ready.has(p) ? 'line-through' : undefined }}>{p}</span>
              </label>
            </li>
          ))}
        </ul>
        <Button variant="primary" icon={Utensils} onClick={() => { setAt(0); setMode('cook'); }}>Cook step by step</Button>
      </div>

      <div className="stack">
        <h3>Steps</h3>
        <ol className="cook-steps">
          {guide.steps.map((s, i) => (
            <li key={i} className="cook-step">
              <span className="cook-step__num">{i + 1}</span>
              <div className="grow stack-sm">
                {s.minutes ? <Badge>{s.minutes < 1 ? `${Math.round(s.minutes * 60)} sec` : `${s.minutes} min`}</Badge> : null}
                <StepBody step={s} />
              </div>
            </li>
          ))}
        </ol>
        {guide.storage && <p className="small muted"><b>Leftovers:</b> {guide.storage}</p>}
      </div>
    </div>
  );
}
