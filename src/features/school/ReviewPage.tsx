import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router';
import { ArrowLeft, Check, Eye, Layers, PartyPopper, RotateCcw, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { relativeDayInline } from '@/lib/format';
import { Button, Callout, Card, EmptyState, ErrorState, PageHeader, PageSkeleton, ProgressBar } from '@/ui/primitives';

interface CardRow { id: string; front: string; back: string; box: number; dueDate: string }

export default function ReviewPage() {
  const [params] = useSearchParams();
  const assignmentId = params.get('assignmentId');
  const courseId = params.get('courseId');
  const qs = assignmentId ? `assignmentId=${assignmentId}` : courseId ? `courseId=${courseId}` : '';
  const [practiceAll, setPracticeAll] = useState(false);
  const q = useQuery({
    queryKey: ['review-cards', qs, practiceAll],
    queryFn: () => api.get<{ today: string; cards: CardRow[] }>(`/school/study/cards?${qs}${practiceAll ? '' : `${qs ? '&' : ''}due=1`}`),
    refetchOnWindowFocus: false,
  });
  const back = assignmentId ? `/school/study?assignmentId=${assignmentId}` : courseId ? `/school/study?courseId=${courseId}` : '/school';

  if (q.isPending) return <PageSkeleton />;
  if (q.error) return <div className="page"><ErrorState error={q.error} onRetry={() => q.refetch()} /></div>;
  return (
    <div className="page" style={{ maxWidth: 720 }}>
      <Link to={back} className="small row-sm" style={{ display: 'inline-flex' }}><ArrowLeft aria-hidden style={{ width: 14 }} /> Back</Link>
      <PageHeader title="Flashcard review" description="Say the answer out loud (or write it) before you flip. Be honest — missed cards come back sooner, which is the point." />
      {q.data.cards.length === 0 ? (
        <Card>
          <EmptyState icon={Layers} title={practiceAll ? 'No flashcards yet' : 'Nothing due right now'} action={!practiceAll ? <Button onClick={() => setPracticeAll(true)}>Practise all cards anyway</Button> : <Link className="btn btn-secondary" to={back}>Add cards</Link>}>
            {practiceAll ? 'Add cards from the study guide first.' : 'You’re caught up. Cards come back when it’s time to review them.'}
          </EmptyState>
        </Card>
      ) : (
        <Session key={`${qs}:${practiceAll}`} cards={q.data.cards} today={q.data.today} backTo={back} />
      )}
    </div>
  );
}

function shuffle<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function Session({ cards, today, backTo }: { cards: CardRow[]; today: string; backTo: string }) {
  const deck = useMemo(() => shuffle(cards), [cards]);
  const [i, setI] = useState(0);
  const [shown, setShown] = useState(false);
  const [results, setResults] = useState<{ correct: boolean; due: string }[]>([]);
  const qc = useQueryClient();
  const review = useMutation({
    mutationFn: ({ id, correct }: { id: string; correct: boolean }) => api.post<{ box: number; dueDate: string }>(`/school/study/cards/${id}/review`, { correct }),
    onSuccess: (r, v) => {
      setResults((x) => [...x, { correct: v.correct, due: r.dueDate }]);
      setShown(false);
      setI((n) => n + 1);
    },
  });
  const card = deck[i];
  const done = i >= deck.length;

  useEffect(() => {
    if (done) for (const k of ['study-guide', 'study-overview', 'plan']) qc.invalidateQueries({ queryKey: [k] });
  }, [done, qc]);

  // Keyboard: space/enter to flip, 1 = missed, 2 = got it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (done || review.isPending || (e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (!shown && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        setShown(true);
      } else if (shown && (e.key === '1' || e.key === '2')) review.mutate({ id: card!.id, correct: e.key === '2' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shown, done, card, review]);

  if (done) {
    const right = results.filter((r) => r.correct).length;
    return (
      <Card>
        <EmptyState icon={PartyPopper} title={`Session done: ${right} of ${results.length} right`} action={<Link className="btn btn-primary" to={backTo}>Back to study guide</Link>}>
          {right === results.length ? 'Great recall. These cards move further apart now.' : `${results.length - right} card${results.length - right === 1 ? '' : 's'} will come back ${relativeDayInline(results.find((r) => !r.correct)!.due, today)}.`}
        </EmptyState>
      </Card>
    );
  }
  return (
    <div className="stack">
      <div className="row between small subtle"><span>Card {i + 1} of {deck.length}</span><span>{results.filter((r) => r.correct).length} right so far</span></div>
      <ProgressBar value={i} max={deck.length} label="Review progress" />
      <div className="card flashcard" aria-live="polite">
        <div className="eyebrow">Question</div>
        <p className="flashcard-text">{card!.front}</p>
        {shown && (
          <>
            <hr className="divider" />
            <div className="eyebrow">Answer</div>
            <p className="flashcard-text">{card!.back}</p>
          </>
        )}
      </div>
      {review.error && <Callout tone="danger">{errorMessage(review.error)}</Callout>}
      {!shown ? (
        <Button variant="primary" size="lg" icon={Eye} onClick={() => setShown(true)}>Show answer <span className="xsmall" style={{ opacity: 0.7 }}>(space)</span></Button>
      ) : (
        <div className="grid-2">
          <Button size="lg" icon={X} loading={review.isPending && review.variables?.correct === false} disabled={review.isPending} onClick={() => review.mutate({ id: card!.id, correct: false })}>Missed it <span className="xsmall subtle">(1)</span></Button>
          <Button size="lg" variant="primary" icon={Check} loading={review.isPending && review.variables?.correct === true} disabled={review.isPending} onClick={() => review.mutate({ id: card!.id, correct: true })}>Got it <span className="xsmall" style={{ opacity: 0.7 }}>(2)</span></Button>
        </div>
      )}
      {shown && <p className="xsmall subtle row-sm"><RotateCcw aria-hidden style={{ width: 12 }} /> Only say “Got it” if you’d have answered correctly without seeing it.</p>}
    </div>
  );
}
