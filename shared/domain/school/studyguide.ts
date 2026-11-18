import { addDays, daysBetween, type LocalDate } from '../time';

/**
 * Study guides built from the student's own material plus well-established
 * learning research. Nothing here writes subject content for the student —
 * it organises what they add and tells them HOW to study it.
 */

export interface StudySource {
  id: string;
  title: string;
  publisher: string;
  url: string;
}

export const STUDY_SOURCES: Record<string, StudySource> = {
  dunlosky: {
    id: 'dunlosky',
    title: 'Which study strategies make the grade? (Dunlosky et al., 2013)',
    publisher: 'Association for Psychological Science',
    url: 'https://www.psychologicalscience.org/news/releases/which-study-strategies-make-the-grade.html',
  },
  dunlosky_aft: {
    id: 'dunlosky_aft',
    title: 'Strengthening the student toolbox',
    publisher: 'American Educator (AFT)',
    url: 'https://www.aft.org/ae/fall2013/dunlosky',
  },
  roediger: {
    id: 'roediger',
    title: 'Test-enhanced learning (Roediger & Karpicke, 2006)',
    publisher: 'Psychological Science',
    url: 'https://profiles.wustl.edu/en/publications/test-enhanced-learning-taking-memory-tests-improves-long-term-ret/',
  },
  cepeda: {
    id: 'cepeda',
    title: 'Distributed practice in verbal recall tasks (Cepeda et al., 2006)',
    publisher: 'Psychological Bulletin (PubMed)',
    url: 'https://pubmed.ncbi.nlm.nih.gov/16719566/',
  },
};

export type MethodId = 'retrieval' | 'spacing' | 'interleaving' | 'elaboration' | 'self_explanation';

export interface StudyMethod {
  id: MethodId;
  name: string;
  evidence: 'high' | 'moderate';
  what: string;
  how: string[];
  sources: string[];
}

/** Ratings follow Dunlosky et al. (2013): practice testing and distributed practice rated high utility. */
export const STUDY_METHODS: Record<MethodId, StudyMethod> = {
  retrieval: {
    id: 'retrieval', name: 'Practice testing (retrieval practice)', evidence: 'high',
    what: 'Pull information out of your memory instead of re-reading it. Checking your answers afterwards makes it work even better.',
    how: ['Quiz yourself with flashcards — answer before you flip.', 'Close your notes and write everything you remember about a topic, then check what you missed.', 'Do practice problems or old quizzes without looking at the answers first.'],
    sources: ['dunlosky', 'roediger'],
  },
  spacing: {
    id: 'spacing', name: 'Spaced practice', evidence: 'high',
    what: 'Spread study over several days instead of cramming. Your plan already does this before each due date.',
    how: ['Several short sessions beat one long one.', 'Review cards when they come due — the schedule spaces them out for you.', 'Start early: the bigger the test, the earlier the first session.'],
    sources: ['dunlosky', 'cepeda'],
  },
  interleaving: {
    id: 'interleaving', name: 'Mixed practice (interleaving)', evidence: 'moderate',
    what: 'Mix different types of problems in one session so you practise choosing the right method, not just repeating it.',
    how: ['Shuffle practice problems from different sections.', 'In the last sessions before a test, mix all topics together.'],
    sources: ['dunlosky'],
  },
  elaboration: {
    id: 'elaboration', name: 'Ask “why?” (elaborative interrogation)', evidence: 'moderate',
    what: 'Explain why a fact is true and how it connects to what you already know.',
    how: ['For each key fact, ask “why is this true?” and answer in your own words.', 'Connect new ideas to examples from class or real life.'],
    sources: ['dunlosky'],
  },
  self_explanation: {
    id: 'self_explanation', name: 'Explain your steps (self-explanation)', evidence: 'moderate',
    what: 'While solving a problem or reading an example, explain each step to yourself.',
    how: ['Talk through worked examples step by step.', 'After each problem, say which rule you used and why.'],
    sources: ['dunlosky'],
  },
};

export const LOW_UTILITY_NOTE =
  'Re-reading, highlighting and summarising feel productive but were rated low-utility in the same research. Use them to prepare material, then switch to testing yourself.';

/** Which methods fit each step of an assignment (step names from splitIntoSteps). */
export function methodsForStep(step: string): MethodId[] {
  const s = step.toLowerCase();
  if (/recall|practice question|quiz/.test(s)) return ['retrieval', 'spacing'];
  if (/mistake|re-learn/.test(s)) return ['elaboration', 'retrieval'];
  if (/mixed|time pressure/.test(s)) return ['interleaving', 'retrieval'];
  if (/topic|weak/.test(s)) return ['retrieval'];
  if (/outline|argument|draft|revise/.test(s)) return ['elaboration', 'self_explanation'];
  if (/problem|build|main work/.test(s)) return ['self_explanation', 'interleaving'];
  return ['retrieval', 'spacing'];
}

/* ---------- turning notes into cards and topics ---------- */

export interface CardDraft {
  front: string;
  back: string;
}

// The separator needs surrounding space so times (10:30) and hyphenated words (well-known) aren't split.
const SEPARATORS = /^\s*(?:[-*•]\s+|\d+[.)]\s+)?(.{1,120}?)\s*(?::\s+|\s[-–—=]\s+|\s=>\s+)(.{2,600})$/;

/**
 * Find flashcards in pasted notes:
 *   "term: definition", "term - definition", "term = definition"
 *   "Q: question" followed by "A: answer"
 * Headings, URLs and lines without a clear term/definition split are ignored.
 */
export function cardsFromNotes(text: string, max = 200): CardDraft[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n').map((l) => l.trim());
  const out: CardDraft[] = [];
  for (let i = 0; i < lines.length && out.length < max; i++) {
    const line = lines[i]!;
    if (!line || /^#{1,6}\s/.test(line)) continue;
    const q = /^q(?:uestion)?\s*[:.)]\s*(.+)$/i.exec(line);
    if (q) {
      const next = lines[i + 1] ?? '';
      const a = /^a(?:nswer)?\s*[:.)]\s*(.+)$/i.exec(next);
      if (a) {
        out.push({ front: q[1]!.trim(), back: a[1]!.trim() });
        i++;
      }
      continue;
    }
    if (/^a(?:nswer)?\s*[:.)]/i.test(line)) continue;
    if (/https?:\/\//i.test(line)) continue;
    const m = SEPARATORS.exec(line);
    if (!m) continue;
    const front = m[1]!.trim().replace(/[*_`]+/g, '');
    const back = m[2]!.trim();
    // A "term" with too many words is probably a sentence, not a term.
    if (front.split(/\s+/).length > 12 || /[.!?]$/.test(front) || !/[a-z0-9]/i.test(back)) continue;
    out.push({ front, back });
  }
  return dedupeCards(out);
}

export function dedupeCards(cards: CardDraft[]): CardDraft[] {
  const seen = new Set<string>();
  return cards.filter((c) => {
    const k = c.front.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Markdown-style headings ("# Cell structure") make good topic suggestions. */
export function topicsFromNotes(text: string, max = 30): string[] {
  const topics: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const m = /^#{1,3}\s+(.{2,100})$/.exec(line.trim());
    if (m && !topics.some((t) => t.toLowerCase() === m[1]!.trim().toLowerCase())) topics.push(m[1]!.trim());
    if (topics.length >= max) break;
  }
  return topics;
}

/* ---------- spaced repetition (Leitner boxes) ---------- */

/** Days until the next review after answering, by box (1–5). */
export const BOX_INTERVALS = [1, 2, 4, 7, 14] as const;

export function reviewCard(box: number, correct: boolean, today: LocalDate): { box: number; due: LocalDate } {
  const next = correct ? Math.min(5, Math.max(1, box) + 1) : 1;
  return { box: next, due: addDays(today, BOX_INTERVALS[next - 1]!) };
}

/* ---------- what to do next ---------- */

export interface TopicLike {
  id: string;
  title: string;
  confidence: number; // 0 not yet, 1 shaky, 2 got it
}

export interface NextStep {
  title: string;
  detail: string;
  method: MethodId;
}

export function nextSteps(o: { dueDate: LocalDate | null; today: LocalDate; topics: TopicLike[]; cardsDue: number; cardsTotal: number; materials: number; isTest: boolean }): NextStep[] {
  const steps: NextStep[] = [];
  const daysLeft = o.dueDate ? daysBetween(o.today, o.dueDate) : null;
  if (o.materials === 0 && o.cardsTotal === 0) {
    steps.push({ title: 'Add your material', detail: 'Paste class notes, a study sheet or links to review sites. Lines like “term: definition” become flashcards automatically.', method: 'retrieval' });
  }
  if (o.topics.length === 0) {
    steps.push({ title: 'List the topics', detail: 'Write down every topic the test or assignment covers (check the syllabus or ask your teacher). Rate how well you know each one.', method: 'retrieval' });
  }
  const weak = [...o.topics].filter((t) => t.confidence < 2).sort((a, b) => a.confidence - b.confidence);
  if (weak.length) {
    steps.push({ title: `Focus on: ${weak.slice(0, 3).map((t) => t.title).join(', ')}`, detail: 'Start with what you rated “not yet”. Close your notes, write what you remember, then check and fill the gaps.', method: 'retrieval' });
  }
  if (o.cardsDue > 0) {
    steps.push({ title: `Review ${o.cardsDue} flashcard${o.cardsDue === 1 ? '' : 's'} due today`, detail: 'Answer each one out loud before you flip it. Cards you miss come back sooner.', method: 'spacing' });
  } else if (o.cardsTotal === 0 && o.isTest) {
    steps.push({ title: 'Make flashcards', detail: 'Turn key terms, formulas and dates into cards. Making them is studying too.', method: 'retrieval' });
  }
  if (o.isTest && daysLeft !== null && daysLeft <= 3 && daysLeft >= 0 && o.topics.length > 1) {
    steps.push({ title: 'Do a mixed practice round', detail: 'Mix questions from all topics, timed, like the real test.', method: 'interleaving' });
  }
  if (daysLeft !== null && daysLeft === 0) {
    steps.unshift({ title: 'It’s due today', detail: 'Do a short review of your weakest topics, then rest. Sleep helps memory more than a late cram.', method: 'retrieval' });
  }
  if (!steps.length) {
    steps.push({ title: 'Keep it fresh', detail: 'You’ve rated everything “got it”. Do a quick closed-book check every few days so it stays that way.', method: 'spacing' });
  }
  return steps.slice(0, 4);
}
