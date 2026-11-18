import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router';
import { ArrowLeft, Check, ClipboardCheck, RotateCcw, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { api, errorMessage } from '@/lib/api';
import { Badge, Button, Callout, Card, EmptyState, ErrorState, PageHeader, PageSkeleton, ProgressBar, Textarea } from '@/ui/primitives';

interface Question {
  id: string;
  kind: 'multiple_choice' | 'true_false' | 'short_answer';
  topic: string;
  question: string;
  choices: string[];
  answer: string;
  explanation: string;
}

export default function PracticeTestPage() {
  const [params] = useSearchParams();
  const assignmentId = params.get('assignmentId');
  const courseId = params.get('courseId');
  const qs = assignmentId ? `assignmentId=${assignmentId}` : `courseId=${courseId ?? ''}`;
  const back = `/school/study?${qs}`;
  const q = useQuery({ queryKey: ['study-questions', qs], queryFn: () => api.get<{ questions: Question[] }>(`/school/study/questions?${qs}`), refetchOnWindowFocus: false });
  const [round, setRound] = useState(0);
  if (q.isPending) return <PageSkeleton />;
  if (q.error) return <div className="page"><ErrorState error={q.error} onRetry={() => q.refetch()} /></div>;
  return (
    <div className="page" style={{ maxWidth: 760 }}>
      <Link to={back} className="small row-sm" style={{ display: 'inline-flex' }}><ArrowLeft aria-hidden style={{ width: 14 }} /> Study guide</Link>
      <PageHeader title="Practice test" description="Answer before you look. Wrong answers are useful — they show exactly what to review." />
      {q.data.questions.length === 0 ? (
        <Card><EmptyState icon={ClipboardCheck} title="No practice questions yet" action={<Link className="btn btn-primary" to={back}>Back to study guide</Link>}>Upload your material with “Upload & generate” to get a practice test.</EmptyState></Card>
      ) : (
        <Test key={round} questions={q.data.questions} scope={{ assignmentId, courseId }} back={back} onRetake={() => setRound((r) => r + 1)} />
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

function Test({ questions, scope, back, onRetake }: { questions: Question[]; scope: { assignmentId: string | null; courseId: string | null }; back: string; onRetake: () => void }) {
  const order = useMemo(() => shuffle(questions).map((q) => (q.kind === 'multiple_choice' ? { ...q, choices: shuffle(q.choices) } : q)), [questions]);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [written, setWritten] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState<{ questionId: string; correct: boolean; topic: string }[]>([]);
  const qc = useQueryClient();
  const submit = useMutation({
    mutationFn: (rs: typeof results) => api.post<{ right: number; total: number; weakTopics: string[] }>('/school/study/test-results', { ...scope, results: rs.map(({ questionId, correct }) => ({ questionId, correct })) }),
    onSuccess: () => {
      for (const k of ['study-guide', 'study-overview']) qc.invalidateQueries({ queryKey: [k] });
    },
  });
  const q = order[i];

  const record = (correct: boolean) => {
    const next = [...results, { questionId: q!.id, correct, topic: q!.topic }];
    setResults(next);
    setPicked(null);
    setWritten('');
    setRevealed(false);
    if (i + 1 >= order.length) submit.mutate(next);
    setI(i + 1);
  };

  if (!q) {
    const right = results.filter((r) => r.correct).length;
    const pct = Math.round((right / results.length) * 100);
    const weak = [...new Set(results.filter((r) => !r.correct).map((r) => r.topic).filter(Boolean))];
    return (
      <Card>
        <div className="stack" style={{ alignItems: 'center', textAlign: 'center', padding: 'var(--s-4) 0' }}>
          <div className="stat"><span className="stat-value num">{pct}%</span><span className="stat-label">{right} of {results.length} correct</span></div>
          {submit.isPending && <p className="small muted">Saving results…</p>}
          {submit.error && <Callout tone="danger">{errorMessage(submit.error)}</Callout>}
          {weak.length ? (
            <p className="small">Review next: <span className="strong">{weak.join(', ')}</span>. These are now marked “Not yet” or “Shaky” in your topics.</p>
          ) : (
            <p className="small">Everything right — those topics are now marked “Got it”. Retake in a few days to make it stick.</p>
          )}
          <div className="row-wrap" style={{ justifyContent: 'center' }}>
            <Button icon={RotateCcw} onClick={onRetake}>Retake</Button>
            <Link className="btn btn-primary" to={back}>Back to study guide</Link>
          </div>
        </div>
      </Card>
    );
  }

  const objective = q.kind !== 'short_answer';
  const correct = objective && picked !== null && picked === q.answer;
  return (
    <div className="stack">
      <div className="row between small subtle"><span>Question {i + 1} of {order.length}</span>{q.topic && <Badge outline>{q.topic}</Badge>}</div>
      <ProgressBar value={i} max={order.length} label="Test progress" />
      <Card>
        <div className="stack">
          <p className="flashcard-text" style={{ textAlign: 'left' }}>{q.question}</p>
          {objective ? (
            <div className="stack-sm" role="radiogroup" aria-label="Answer choices">
              {q.choices.map((c) => {
                const state = picked === null ? '' : c === q.answer ? 'is-correct' : c === picked ? 'is-wrong' : '';
                return (
                  <button key={c} role="radio" aria-checked={picked === c} disabled={picked !== null} className={clsx('choice', state)} onClick={() => setPicked(c)}>
                    {state === 'is-correct' && <Check aria-hidden />}
                    {state === 'is-wrong' && <X aria-hidden />}
                    <span>{c}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <Textarea aria-label="Your answer" rows={4} value={written} onChange={(e) => setWritten(e.target.value)} disabled={revealed} placeholder="Write your answer, then check it" />
          )}
          {(picked !== null || revealed) && (
            <Callout tone={objective ? (correct ? 'accent' : 'warning') : 'neutral'} title={objective ? (correct ? 'Correct' : `Answer: ${q.answer}`) : 'Model answer'}>
              {!objective && <div className="small" style={{ marginBottom: 6 }}>{q.answer}</div>}
              <div className="small muted">{q.explanation}</div>
            </Callout>
          )}
        </div>
      </Card>
      {objective ? (
        picked !== null && <Button variant="primary" size="lg" onClick={() => record(correct)}>{i + 1 === order.length ? 'See results' : 'Next question'}</Button>
      ) : !revealed ? (
        <Button variant="primary" size="lg" onClick={() => setRevealed(true)}>Check answer</Button>
      ) : (
        <div className="grid-2">
          <Button size="lg" icon={X} onClick={() => record(false)}>I missed it</Button>
          <Button size="lg" variant="primary" icon={Check} onClick={() => record(true)}>I got it</Button>
        </div>
      )}
    </div>
  );
}
