import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { FileUp, Layers, Link2, StickyNote } from 'lucide-react';
import { useState, type ChangeEvent } from 'react';
import { cardsFromNotes, topicsFromNotes } from '@shared/domain/school/studyguide';
import { api, errorMessage, fieldErrors } from '@/lib/api';
import { Dialog, useToast } from '@/ui/overlay';
import { Button, Callout, Field, Input, Segmented, Select, Switch, Textarea } from '@/ui/primitives';

export interface StudyTarget {
  /** "a:<id>" for an assignment, "c:<id>" for a course. */
  value: string;
  label: string;
  group: 'assignment' | 'course';
}

type Kind = 'notes' | 'link' | 'cards';

/**
 * One-step "add study material": pick what it's for, paste, save.
 * Notes automatically become flashcards ("term: definition", Q:/A:) and topics (# headings).
 */
export function AddMaterialDialog({ open, onClose, targets, initialTarget }: { open: boolean; onClose: () => void; targets: StudyTarget[]; initialTarget?: string }) {
  const [target, setTarget] = useState(initialTarget ?? targets[0]?.value ?? '');
  const [kind, setKind] = useState<Kind>('notes');
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [makeCards, setMakeCards] = useState(true);
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();

  const cards = kind === 'link' ? [] : cardsFromNotes(text);
  const topics = kind === 'notes' ? topicsFromNotes(text) : [];
  const scope = target.startsWith('a:') ? { assignmentId: target.slice(2), courseId: null } : { courseId: target.slice(2), assignmentId: null };
  const guideUrl = scope.assignmentId ? `/school/study?assignmentId=${scope.assignmentId}` : `/school/study?courseId=${scope.courseId}`;

  const reset = () => {
    setTitle('');
    setText('');
    setUrl('');
    save.reset();
  };
  const close = () => {
    reset();
    onClose();
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!target) throw new Error('Choose what this is for.');
      let made = 0;
      if (kind === 'notes') {
        await api.post('/school/study/materials', { ...scope, kind: 'notes', title: title || 'Notes', body: text, url: null });
        if (makeCards && cards.length) made = (await api.post<{ created: number }>('/school/study/cards', { ...scope, cards })).created;
        if (makeCards && topics.length) await api.post('/school/study/topics', { ...scope, titles: topics.slice(0, 50) });
      } else if (kind === 'link') {
        await api.post('/school/study/materials', { ...scope, kind: 'link', title: title || url, body: '', url: url.trim() });
      } else {
        if (!cards.length) throw new Error('No flashcards found. Put one card per line, like “term: definition”.');
        made = (await api.post<{ created: number }>('/school/study/cards', { ...scope, cards })).created;
      }
      return made;
    },
    onSuccess: (made) => {
      for (const k of ['study-guide', 'study-overview', 'school', 'plan']) qc.invalidateQueries({ queryKey: [k] });
      const what = kind === 'link' ? 'Link saved' : kind === 'cards' ? `Added ${made} flashcard${made === 1 ? '' : 's'}` : `Notes saved${made ? ` · ${made} flashcard${made === 1 ? '' : 's'} made` : ''}`;
      toast({ message: `${what}.`, action: { label: 'Open study guide', run: () => navigate(guideUrl) } });
      close();
    },
  });
  const f = fieldErrors(save.error);

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 200_000) return toast({ message: 'That file is too large (max 200 KB of text).', tone: 'error' });
    if (!/\.(txt|md|markdown|csv)$/i.test(file.name) && !file.type.startsWith('text/')) {
      return toast({ message: 'Choose a .txt or .md file. For Word, PDF or Google Docs: open it, press Ctrl+A then Ctrl+C, and paste here.', tone: 'error' });
    }
    const t = await file.text();
    setText((x) => (x ? `${x}\n\n${t}` : t));
    if (!title) setTitle(file.name.replace(/\.[^.]+$/, ''));
  };

  const canSave = !!target && (kind === 'link' ? !!url.trim() : kind === 'cards' ? cards.length > 0 : !!text.trim());

  return (
    <Dialog
      open={open}
      wide
      onClose={close}
      title="Add study material"
      description="Paste it in and save — Waypoint files it under the right test and makes flashcards for you."
      footer={<><Button variant="ghost" onClick={close}>Cancel</Button><Button variant="primary" disabled={!canSave} loading={save.isPending} onClick={() => save.mutate()}>Save</Button></>}
    >
      <div className="stack">
        {targets.length === 0 ? (
          <Callout tone="info">Add a course or an assignment first — material is saved under one of them.</Callout>
        ) : (
          <Field label="What’s it for?">
            {(p) => (
              <Select {...p} value={target} onChange={(e) => setTarget(e.target.value)}>
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
        <Segmented<Kind>
          label="Type of material"
          value={kind}
          onChange={setKind}
          options={[
            { value: 'notes', label: <span className="row-sm"><StickyNote aria-hidden style={{ width: 14 }} /> Notes</span> },
            { value: 'link', label: <span className="row-sm"><Link2 aria-hidden style={{ width: 14 }} /> Link</span> },
            { value: 'cards', label: <span className="row-sm"><Layers aria-hidden style={{ width: 14 }} /> Flashcards</span> },
          ]}
        />
        {save.error && !Object.keys(f).length && <Callout tone="danger">{errorMessage(save.error)}</Callout>}

        {kind === 'link' ? (
          <>
            <Field label="Link" error={f.url} hint="Review sites, YouTube videos, Quizlet sets, your teacher’s pages.">{(p) => <Input {...p} type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" autoFocus />}</Field>
            <Field label="Name" optional>{(p) => <Input {...p} value={title} maxLength={140} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Khan Academy — stoichiometry" />}</Field>
          </>
        ) : (
          <>
            {kind === 'notes' && <Field label="Name" optional>{(p) => <Input {...p} value={title} maxLength={140} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Chapter 4 notes" />}</Field>}
            <Field
              label={kind === 'notes' ? 'Paste your notes' : 'One flashcard per line'}
              error={f.body}
              hint={kind === 'notes' ? 'Copy from a doc, slides or a study sheet and paste. Word/PDF/Google Docs: open it, Ctrl+A, Ctrl+C, then paste here.' : 'Write “front: back” on each line, e.g. “Mitochondria: makes energy for the cell”.'}
            >
              {(p) => (
                <Textarea
                  {...p}
                  rows={12}
                  value={text}
                  maxLength={50_000}
                  autoFocus
                  onChange={(e) => setText(e.target.value)}
                  placeholder={kind === 'notes' ? '# Moles\nMole: 6.022 × 10^23 particles\nMolar mass - mass of one mole of a substance\n\nQ: What does a balanced equation conserve?\nA: Mass' : 'Mole: 6.022 × 10^23 particles\nLimiting reactant: the reactant that runs out first'}
                />
              )}
            </Field>
            <div className="row-wrap between">
              <label className="btn btn-secondary btn-sm">
                <FileUp aria-hidden /> Import a .txt or .md file
                <input type="file" accept=".txt,.md,.markdown,.csv,text/plain,text/markdown" className="sr-only" onChange={onFile} />
              </label>
              {text.trim() && (
                <span className="xsmall subtle" aria-live="polite">
                  Found {cards.length} flashcard{cards.length === 1 ? '' : 's'}{kind === 'notes' ? ` and ${topics.length} topic${topics.length === 1 ? '' : 's'}` : ''}
                </span>
              )}
            </div>
            {kind === 'notes' && (cards.length > 0 || topics.length > 0) && (
              <Switch label="Make flashcards and topics from these notes" description="You can delete any you don’t want in the study guide." checked={makeCards} onChange={setMakeCards} />
            )}
          </>
        )}
      </div>
    </Dialog>
  );
}
