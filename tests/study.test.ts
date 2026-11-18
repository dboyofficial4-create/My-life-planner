import { describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { Db } from '../server/db';
import { createApp } from '../server/app';
import { cardsFromNotes, nextSteps, reviewCard, topicsFromNotes, methodsForStep } from '../shared/domain/school/studyguide';

const NOW = new Date('2026-11-16T15:00:00Z'); // Mon 10:00 New York

describe('notes → flashcards & topics', () => {
  const notes = [
    '# Cell structure',
    'Mitochondria: makes energy (ATP) for the cell',
    '- Ribosome - builds proteins',
    '2) Osmosis = diffusion of water across a membrane',
    'Q: What does the nucleus contain?',
    'A: DNA',
    '## Cell division',
    'Meeting at 10:30 pm with the study group',
    'Well-known facts are listed below',
    'This sentence has a colon at the end of a long clause that is definitely not a term: no',
    'See https://example.com/notes: useful',
    'mitochondria: duplicate should be skipped',
  ].join('\n');

  it('extracts term/definition and Q/A cards, skipping non-cards and duplicates', () => {
    const cards = cardsFromNotes(notes);
    expect(cards).toEqual([
      { front: 'Mitochondria', back: 'makes energy (ATP) for the cell' },
      { front: 'Ribosome', back: 'builds proteins' },
      { front: 'Osmosis', back: 'diffusion of water across a membrane' },
      { front: 'What does the nucleus contain?', back: 'DNA' },
    ]);
  });

  it('turns headings into topics', () => {
    expect(topicsFromNotes(notes)).toEqual(['Cell structure', 'Cell division']);
  });

  it('schedules reviews with Leitner boxes', () => {
    expect(reviewCard(1, true, '2026-11-16')).toEqual({ box: 2, due: '2026-11-18' });
    expect(reviewCard(4, true, '2026-11-16')).toEqual({ box: 5, due: '2026-11-30' });
    expect(reviewCard(5, true, '2026-11-16')).toEqual({ box: 5, due: '2026-11-30' });
    expect(reviewCard(4, false, '2026-11-16')).toEqual({ box: 1, due: '2026-11-17' });
  });

  it('recommends next steps from the student’s own state', () => {
    const empty = nextSteps({ dueDate: '2026-11-20', today: '2026-11-16', topics: [], cardsDue: 0, cardsTotal: 0, materials: 0, isTest: true });
    expect(empty.map((s) => s.title)).toEqual(expect.arrayContaining(['Add your material', 'List the topics']));
    const weak = nextSteps({ dueDate: '2026-11-18', today: '2026-11-16', topics: [{ id: '1', title: 'Osmosis', confidence: 0 }, { id: '2', title: 'Mitosis', confidence: 2 }], cardsDue: 5, cardsTotal: 10, materials: 1, isTest: true });
    expect(weak[0]!.title).toBe('Focus on: Osmosis');
    expect(weak.some((s) => s.title.startsWith('Review 5 flashcards'))).toBe(true);
    expect(weak.some((s) => s.method === 'interleaving')).toBe(true);
  });

  it('maps steps to evidence-based methods', () => {
    expect(methodsForStep('Active recall: practice questions')).toContain('retrieval');
    expect(methodsForStep('Mixed practice under time pressure')).toContain('interleaving');
  });
});

class Client {
  cookie = '';
  constructor(private app: ReturnType<typeof createApp>) {}
  async req(method: string, path: string, body?: unknown) {
    const res = await this.app.request(path, { method, headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(this.cookie ? { cookie: this.cookie } : {}), host: 'localhost' }, body: body !== undefined ? JSON.stringify(body) : undefined });
    const set = res.headers.get('set-cookie');
    if (set) this.cookie = set.split(';')[0]!;
    const text = await res.text();
    return { status: res.status, json: text ? JSON.parse(text) : null, text };
  }
  get = (p: string) => this.req('GET', p);
  post = (p: string, b: unknown = {}) => this.req('POST', p, b);
}

async function student(app: ReturnType<typeof createApp>, email: string) {
  const c = new Client(app);
  await c.post('/api/auth/register', { email, password: 'correct horse battery', birthday: '2009-02-02' });
  const r = await c.post('/api/onboarding/complete', {
    profile: { displayName: 'S', birthday: '2009-02-02', timezone: 'America/New_York', units: 'imperial', clock: '12h', heightCm: null, weightKg: null, activityLevel: 'moderate', budget: 'moderate', accessibilityNotes: '', modules: ['school'] },
    goals: [], schedule: { lifeStage: 'student', wakeWeekday: '06:30', sleepWeekday: '22:30', wakeWeekend: '08:00', sleepWeekend: '23:00', preferredWorkoutTime: 'any', preferredStudyTime: 'afternoon', restDays: [0], busyDays: [], commuteMinutes: 15 },
    schoolHours: { enabled: true, days: [1, 2, 3, 4, 5], start: '08:00', end: '15:00' }, workHours: { enabled: false, days: [], start: '09:00', end: '17:00' }, commitments: [],
    school: { stage: 'high_school', gradeLevel: '10', dailyStudyMinutes: 0, academicGoal: '' },
    courses: [{ name: 'Biology', difficulty: 3, targetGrade: null }],
    assessments: [{ title: 'Cell test', courseName: 'Biology', type: 'test', dueDate: '2026-11-20' }],
  });
  expect(r.status, r.text).toBe(200);
  const school = (await c.get('/api/school')).json;
  return { c, assignment: school.assignments[0], course: school.courses[0] };
}

describe('study guide API', () => {
  const setup = () => {
    const db = new Db(':memory:');
    return { db, app: createApp(db, { secureCookies: false, now: () => NOW, encryptionKey: randomBytes(32).toString('base64') }) };
  };

  it('builds a guide for a test with steps, methods, planned sessions and next steps', async () => {
    const { app } = setup();
    const { c, assignment } = await student(app, 'g@example.com');
    const g = (await c.get(`/api/school/study/guide?assignmentId=${assignment.id}`)).json;
    expect(g.assignment).toMatchObject({ title: 'Cell test', isTest: true, daysLeft: 4 });
    expect(g.steps.length).toBe(4);
    expect(g.steps.every((s: { methods: string[] }) => s.methods.length > 0)).toBe(true);
    expect(g.sessions.length).toBeGreaterThan(0); // study sessions already in the plan
    expect(g.next.map((n: { title: string }) => n.title)).toContain('Add your material');
    expect(g.methods.find((m: { id: string }) => m.id === 'retrieval').evidence).toBe('high');
    expect(Object.values(g.sources).every((s) => (s as { url: string }).url.startsWith('https://'))).toBe(true);
  });

  it('stores notes, links, topics and flashcards, and reviews update the schedule', async () => {
    const { app } = setup();
    const { c, assignment, course } = await student(app, 'm@example.com');
    const scope = { assignmentId: assignment.id };
    expect((await c.post('/api/school/study/materials', { ...scope, kind: 'notes', title: 'Ch 4 notes', body: 'Osmosis: water diffusion', url: null })).status).toBe(201);
    expect((await c.post('/api/school/study/materials', { courseId: course.id, kind: 'link', title: 'Khan Academy', body: '', url: 'https://www.khanacademy.org/science/biology' })).status).toBe(201);
    expect((await c.post('/api/school/study/materials', { ...scope, kind: 'link', title: 'Bad', body: '', url: 'javascript:alert(1)' })).status).toBe(422);
    expect((await c.post('/api/school/study/topics', { ...scope, titles: ['Osmosis', 'Mitosis', 'osmosis'] })).json.created).toBe(2);
    const made = await c.post('/api/school/study/cards', { ...scope, cards: [{ front: 'Osmosis', back: 'Water diffusion' }, { front: 'Mitosis', back: 'Cell division' }, { front: 'osmosis', back: 'dup' }] });
    expect(made.json).toMatchObject({ created: 2, skippedDuplicates: 1 });

    let g = (await c.get(`/api/school/study/guide?assignmentId=${assignment.id}`)).json;
    expect(g.materials.map((m: { title: string }) => m.title).sort()).toEqual(['Ch 4 notes', 'Khan Academy']); // course-wide link included
    expect(g.cards).toMatchObject({ total: 2, due: 2 });
    const topic = g.topics.find((t: { title: string }) => t.title === 'Osmosis');
    await c.req('PATCH', `/api/school/study/topics/${topic.id}`, { confidence: 2 });

    const due = (await c.get(`/api/school/study/cards?assignmentId=${assignment.id}&due=1`)).json.cards;
    expect((await c.post(`/api/school/study/cards/${due[0].id}/review`, { correct: true })).json).toEqual({ box: 2, dueDate: '2026-11-18' });
    expect((await c.post(`/api/school/study/cards/${due[1].id}/review`, { correct: false })).json).toEqual({ box: 1, dueDate: '2026-11-17' });
    g = (await c.get(`/api/school/study/guide?assignmentId=${assignment.id}`)).json;
    expect(g.cards.due).toBe(0);
    expect(g.next[0].title).toBe('Focus on: Mitosis');

    // The course view shows assignment cards too.
    expect((await c.get(`/api/school/study/cards?courseId=${course.id}`)).json.cards).toHaveLength(2);
  });

  it('plans short flashcard reviews when cards come due', async () => {
    const { app } = setup();
    const { c, course } = await student(app, 'p@example.com');
    await c.post('/api/school/study/cards', { courseId: course.id, cards: Array.from({ length: 30 }, (_, i) => ({ front: `Term ${i}`, back: `Def ${i}` })) });
    const preview = (await c.post('/api/plan/preview', { weekStart: '2026-11-16' })).json;
    expect(preview.changes.filter((ch: { type: string; title: string }) => ch.type === 'added' && ch.title === 'Flashcard review').length).toBeGreaterThanOrEqual(2);
  });

  it('keeps study material private and removes it with its assignment', async () => {
    const { app, db } = setup();
    const a = await student(app, 'a@example.com');
    const b = await student(app, 'b@example.com');
    await a.c.post('/api/school/study/cards', { assignmentId: a.assignment.id, cards: [{ front: 'Secret', back: 'Card' }] });
    expect((await b.c.get(`/api/school/study/guide?assignmentId=${a.assignment.id}`)).status).toBe(404);
    expect((await b.c.post('/api/school/study/cards', { assignmentId: a.assignment.id, cards: [{ front: 'x', back: 'y' }] })).status).toBe(404);
    const cardId = (await a.c.get(`/api/school/study/cards?assignmentId=${a.assignment.id}`)).json.cards[0].id;
    expect((await b.c.post(`/api/school/study/cards/${cardId}/review`, { correct: true })).status).toBe(404);
    expect((await b.c.get('/api/school/study/cards')).json.cards).toEqual([]);
    await a.c.req('DELETE', `/api/school/assignments/${a.assignment.id}`);
    expect(db.get<{ n: number }>('SELECT COUNT(*) n FROM flashcards')!.n).toBe(0);
  });
});
