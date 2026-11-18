import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router';
import { FileText, Sparkles, StickyNote, Upload, X } from 'lucide-react';
import { useRef, useState, type DragEvent } from 'react';
import { cardsFromNotes, topicsFromNotes } from '@shared/domain/school/studyguide';
import { api, errorMessage, fieldErrors } from '@/lib/api';
import { Dialog, useToast } from '@/ui/overlay';
import { Button, Callout, Field, Segmented, Select, Textarea } from '@/ui/primitives';

export interface StudyTarget {
  /** "a:<id>" for an assignment, "c:<id>" for a course. */
  value: string;
  label: string;
  group: 'assignment' | 'course';
}

interface IntegrationRow {
  id: string;
  configured: boolean;
  serverManaged?: boolean;
  connection: null | { status: string };
}

const ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp,.gif,.docx,.pptx,.txt,.md';
const MAX_TOTAL = 20 * 1024 * 1024;
const CONSENT_KEY = 'wp-ai-consent';

function readConsent(): boolean {
  try {
    return localStorage.getItem(CONSENT_KEY) === '1';
  } catch {
    return false;
  }
}
function saveConsent() {
  try {
    localStorage.setItem(CONSENT_KEY, '1');
  } catch {
    /* fine: we'll ask again next time */
  }
}

async function toBase64(file: File): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (let i = 0; i < buf.length; i += 0x8000) binary += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(binary);
}

/** True when the student can generate with AI (server key, or their own connected key). */
export function useAiReady() {
  const q = useQuery({ queryKey: ['integrations'], queryFn: () => api.get<{ integrations: IntegrationRow[] }>('/integrations'), staleTime: 60_000 });
  const row = q.data?.integrations.find((i) => i.id === 'anthropic');
  return { loading: q.isPending, ready: !!row && (!!row.serverManaged || row.connection?.status === 'connected') };
}

type Mode = 'ai' | 'manual';

/**
 * "Upload & generate": pick the test, add files or paste notes, click once.
 * With AI connected you get a study sheet, flashcards, a practice test and topics.
 * Without AI, pasted "term: definition" lines still become flashcards.
 */
export function AddMaterialDialog({ open, onClose, targets, initialTarget }: { open: boolean; onClose: () => void; targets: StudyTarget[]; initialTarget?: string }) {
  const ai = useAiReady();
  const [mode, setMode] = useState<Mode>('ai');
  const effectiveMode: Mode = ai.ready ? mode : 'manual';
  const [target, setTarget] = useState(initialTarget ?? targets[0]?.value ?? '');
  const [files, setFiles] = useState<File[]>([]);
  const [text, setText] = useState('');
  const [cardCount, setCardCount] = useState(20);
  const [questionCount, setQuestionCount] = useState(10);
  const [consent, setConsent] = useState(readConsent());
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();

  const scope = target.startsWith('a:') ? { assignmentId: target.slice(2), courseId: null } : { courseId: target.slice(2), assignmentId: null };
  const guideUrl = scope.assignmentId ? `/school/study?assignmentId=${scope.assignmentId}` : `/school/study?courseId=${scope.courseId}`;
  const totalSize = files.reduce((s, f) => s + f.size, 0);
  const manualCards = cardsFromNotes(text);
  const manualTopics = topicsFromNotes(text);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const next = [...files];
    for (const f of Array.from(list)) {
      if (/\.(heic|heif)$/i.test(f.name)) {
        toast({ message: `“${f.name}” is an iPhone HEIC photo. Share it as JPG (or take a screenshot) and try again.`, tone: 'error' });
        continue;
      }
      if (!next.some((x) => x.name === f.name && x.size === f.size)) next.push(f);
    }
    if (next.length > 10) toast({ message: 'Up to 10 files at a time.', tone: 'error' });
    setFiles(next.slice(0, 10));
  };

  const refresh = () => {
    for (const k of ['study-guide', 'study-overview', 'school', 'plan', 'study-questions']) qc.invalidateQueries({ queryKey: [k] });
  };

  const generate = useMutation({
    mutationFn: async () => {
      if (totalSize > MAX_TOTAL) throw new Error('Files are too large together (20 MB max). Upload fewer pages at a time.');
      const payload = await Promise.all(files.map(async (f) => ({ name: f.name, mediaType: f.type, data: await toBase64(f) })));
      return api.post<{ title: string; topics: number; cards: number; questions: number; usage: { estimatedCostUsd: number } }>('/school/study/generate', {
        ...scope,
        files: payload,
        text,
        flashcards: cardCount,
        questions: questionCount,
        consent: true,
      });
    },
    onSuccess: (r) => {
      saveConsent();
      refresh();
      toast({ message: `Made ${r.cards} flashcards and a ${r.questions}-question practice test (about $${r.usage.estimatedCostUsd.toFixed(2)}).` });
      close();
      navigate(guideUrl);
    },
  });

  const saveManual = useMutation({
    mutationFn: async () => {
      await api.post('/school/study/materials', { ...scope, kind: 'notes', title: 'Notes', body: text, url: null });
      let made = 0;
      if (manualCards.length) made = (await api.post<{ created: number }>('/school/study/cards', { ...scope, cards: manualCards })).created;
      if (manualTopics.length) await api.post('/school/study/topics', { ...scope, titles: manualTopics.slice(0, 50) });
      return made;
    },
    onSuccess: (made) => {
      refresh();
      toast({ message: `Notes saved${made ? ` · ${made} flashcard${made === 1 ? '' : 's'} made` : ''}.` });
      close();
      navigate(guideUrl);
    },
  });

  const close = () => {
    setFiles([]);
    setText('');
    generate.reset();
    saveManual.reset();
    onClose();
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const busy = generate.isPending || saveManual.isPending;
  const err = generate.error ?? saveManual.error;
  const f = fieldErrors(err);
  const canGenerate = !!target && (files.length > 0 || text.trim().length > 0) && consent;

  return (
    <Dialog
      open={open}
      wide
      onClose={() => !busy && close()}
      title="Upload & generate study material"
      description={effectiveMode === 'ai' ? 'Add your notes, slides or study sheet. Waypoint makes a study sheet, flashcards and a practice test from them.' : 'Paste your notes. Lines like “term: definition” become flashcards; “# headings” become topics.'}
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={busy}>Cancel</Button>
          {effectiveMode === 'ai' ? (
            <Button variant="primary" icon={Sparkles} disabled={!canGenerate} loading={generate.isPending} onClick={() => generate.mutate()}>
              {generate.isPending ? 'Generating… (up to a minute)' : 'Generate'}
            </Button>
          ) : (
            <Button variant="primary" disabled={!target || !text.trim()} loading={saveManual.isPending} onClick={() => saveManual.mutate()}>Save</Button>
          )}
        </>
      }
    >
      <div className="stack">
        {targets.length === 0 ? (
          <Callout tone="info">Add a test, assignment or course first — material is saved under one of them.</Callout>
        ) : (
          <Field label="What’s it for?">
            {(p) => (
              <Select {...p} value={target} onChange={(e) => setTarget(e.target.value)} disabled={busy}>
                {(['assignment', 'course'] as const).map((g) => {
                  const opts = targets.filter((t) => t.group === g);
                  return opts.length ? (
                    <optgroup key={g} label={g === 'assignment' ? 'Tests & assignments' : 'Whole course'}>
                      {opts.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </optgroup>
                  ) : null;
                })}
              </Select>
            )}
          </Field>
        )}

        {ai.ready && (
          <Segmented<Mode>
            label="How to add"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'ai', label: <span className="row-sm"><Sparkles aria-hidden style={{ width: 14 }} /> Generate with AI</span> },
              { value: 'manual', label: <span className="row-sm"><StickyNote aria-hidden style={{ width: 14 }} /> Just save my notes</span> },
            ]}
          />
        )}
        {!ai.ready && !ai.loading && (
          <Callout tone="info" icon={Sparkles} title="Want flashcards and practice tests made for you?">
            Connect AI study sets in <Link to="/settings/connections" onClick={close}>Settings → Connections</Link> (needs an Anthropic API key). For now, paste notes below.
          </Callout>
        )}

        {err && !Object.keys(f).length && <Callout tone="danger">{errorMessage(err)}</Callout>}

        {effectiveMode === 'ai' && (
          <>
            <div
              className={`dropzone${dragging ? ' is-dragging' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
            >
              <Upload aria-hidden />
              <div className="small"><span className="strong">Drop files here</span> or</div>
              <Button size="sm" onClick={() => fileInput.current?.click()} disabled={busy}>Choose files</Button>
              <div className="xsmall subtle">PDF, photos (JPG/PNG), Word, PowerPoint or text · up to 10 files, 20 MB total</div>
              <input ref={fileInput} type="file" multiple accept={ACCEPT} className="sr-only" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
            </div>
            {files.length > 0 && (
              <ul className="stack-sm" style={{ listStyle: 'none' }}>
                {files.map((file, i) => (
                  <li key={`${file.name}-${i}`} className="row small">
                    <FileText aria-hidden style={{ width: 16, color: 'var(--text-3)' }} />
                    <span className="grow truncate">{file.name}</span>
                    <span className="xsmall subtle">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
                    <Button size="sm" variant="ghost" iconOnly icon={X} aria-label={`Remove ${file.name}`} disabled={busy} onClick={() => setFiles(files.filter((_, j) => j !== i))} />
                  </li>
                ))}
              </ul>
            )}
            <Field label="Or paste notes" optional>{(p) => <Textarea {...p} rows={4} value={text} maxLength={100_000} onChange={(e) => setText(e.target.value)} disabled={busy} placeholder="Paste from a doc, website or your own notes" />}</Field>
            <div className="row-wrap">
              <Field label="Flashcards">{(p) => <Select {...p} value={cardCount} onChange={(e) => setCardCount(Number(e.target.value))} disabled={busy}>{[10, 20, 30, 40].map((n) => <option key={n} value={n}>About {n}</option>)}</Select>}</Field>
              <Field label="Practice test">{(p) => <Select {...p} value={questionCount} onChange={(e) => setQuestionCount(Number(e.target.value))} disabled={busy}>{[5, 10, 15, 20, 25].map((n) => <option key={n} value={n}>{n} questions</option>)}</Select>}</Field>
            </div>
            {!readConsent() && (
              <label className="checkbox small" style={{ alignItems: 'flex-start' }}>
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 2 }} />
                <span>Send this material to Anthropic (Claude) to make my study set. Only the material and the course name are sent — not my name or grades. The files aren’t stored.</span>
              </label>
            )}
            {generate.isPending && <p className="xsmall subtle" aria-live="polite">Reading your material and writing questions — keep this window open.</p>}
          </>
        )}

        {effectiveMode === 'manual' && (
          <>
            <Field label="Paste your notes" error={f.body}>
              {(p) => <Textarea {...p} rows={12} value={text} maxLength={50_000} onChange={(e) => setText(e.target.value)} placeholder={'# Moles\nMole: 6.022 × 10^23 particles\nMolar mass - mass of one mole of a substance\n\nQ: What does a balanced equation conserve?\nA: Mass'} />}
            </Field>
            {text.trim() && <p className="xsmall subtle" aria-live="polite">Found {manualCards.length} flashcard{manualCards.length === 1 ? '' : 's'} and {manualTopics.length} topic{manualTopics.length === 1 ? '' : 's'}.</p>}
          </>
        )}
      </div>
    </Dialog>
  );
}
