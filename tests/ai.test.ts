import { describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { strToU8, zipSync } from 'fflate';
import { Db } from '../server/db';
import { createApp } from '../server/app';
import { officeText, sanitizeStudySet, toContentBlocks, type StudyAIFactory, type StudySet } from '../server/services/studyAI';
import { HttpError } from '../server/http';

const NOW = new Date('2026-11-16T15:00:00Z');

const docx = () => zipSync({ 'word/document.xml': strToU8('<w:document><w:body><w:p><w:r><w:t>Osmosis is diffusion of water</w:t></w:r></w:p><w:p><w:r><w:t>Cells &amp; membranes</w:t></w:r></w:p></w:body></w:document>') });
const pptx = () => zipSync({ 'ppt/slides/slide2.xml': strToU8('<p:sld><a:p><a:r><a:t>Second slide</a:t></a:r></a:p></p:sld>'), 'ppt/slides/slide1.xml': strToU8('<p:sld><a:p><a:r><a:t>First slide</a:t></a:r></a:p></p:sld>') });
const b64 = (u: Uint8Array) => Buffer.from(u).toString('base64');

describe('reading uploaded files', () => {
  it('extracts text from Word and PowerPoint files in order', () => {
    expect(officeText(docx(), 'docx')).toBe('Osmosis is diffusion of water\nCells & membranes');
    const slides = officeText(pptx(), 'pptx');
    expect(slides.indexOf('First slide')).toBeLessThan(slides.indexOf('Second slide'));
    expect(slides).toContain('--- Slide 1 ---');
  });

  it('turns files into content blocks and rejects unsupported or oversized uploads', () => {
    const blocks = toContentBlocks(
      [
        { name: 'ch4.pdf', mediaType: 'application/pdf', data: b64(strToU8('%PDF-1.4 fake')) },
        { name: 'board.jpg', mediaType: 'image/jpeg', data: b64(strToU8('jpg')) },
        { name: 'notes.docx', mediaType: '', data: b64(docx()) },
        { name: 'notes.txt', mediaType: 'text/plain', data: b64(strToU8('Mitosis: cell division')) },
      ],
      'extra pasted notes',
    );
    expect(blocks.map((b) => b.type)).toEqual(['document', 'image', 'text', 'text', 'text']);
    expect(() => toContentBlocks([{ name: 'virus.exe', mediaType: 'application/octet-stream', data: 'AA==' }], '')).toThrow(HttpError);
    expect(() => toContentBlocks([], '   ')).toThrow(/Add a file/);
    const big = Buffer.alloc(21 * 1024 * 1024).toString('base64');
    expect(() => toContentBlocks([{ name: 'big.pdf', mediaType: 'application/pdf', data: big }], '')).toThrow(/too large/);
  });
});

const goodSet = (): StudySet => ({
  title: 'Cells',
  overview: 'How cells move water and divide.',
  insufficient: false,
  insufficientReason: '',
  studySheet: '# Osmosis\n- Water moves across a membrane\n# Mitosis\n- Cell division',
  topics: [{ title: 'Osmosis', keyPoints: ['Water diffusion'] }, { title: 'Mitosis', keyPoints: ['Division'] }],
  flashcards: [{ front: 'Osmosis', back: 'Diffusion of water' }, { front: 'osmosis', back: 'dup' }, { front: 'Mitosis', back: 'Cell division' }],
  questions: [
    { kind: 'multiple_choice', topic: 'Osmosis', question: 'Osmosis moves?', choices: ['Water', 'Salt', 'Sugar', 'DNA'], answer: 'Water', explanation: 'By definition.' },
    { kind: 'multiple_choice', topic: 'Osmosis', question: 'Broken MC', choices: ['A', 'B'], answer: 'C', explanation: 'Answer not in choices' },
    { kind: 'true_false', topic: 'Mitosis', question: 'Mitosis makes 2 cells', choices: [], answer: 'true', explanation: 'Two daughter cells.' },
    { kind: 'short_answer', topic: 'Mitosis', question: 'Describe mitosis', choices: ['ignored'], answer: 'One cell divides into two identical cells.', explanation: '…' },
  ],
});

describe('cleaning AI output', () => {
  it('drops unusable questions, normalises true/false and removes duplicate cards', () => {
    const s = sanitizeStudySet(goodSet(), { flashcards: 20, questions: 10 });
    expect(s.flashcards.map((c) => c.front)).toEqual(['Osmosis', 'Mitosis']);
    expect(s.questions.map((q) => q.question)).toEqual(['Osmosis moves?', 'Mitosis makes 2 cells', 'Describe mitosis']);
    expect(s.questions[1]).toMatchObject({ choices: ['True', 'False'], answer: 'True' });
    expect(s.questions[2]!.choices).toEqual([]);
  });
});

/* ---------- API with a fake AI ---------- */

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

function setup(opts: { set?: StudySet; serverKey?: string } = {}) {
  const calls: { key: string; ctx: unknown; blocks: number }[] = [];
  const fake: StudyAIFactory = (key) => ({
    async validate() {
      if (key !== 'sk-ant-good-key-1234567890') throw new HttpError(422, 'ai_bad_key', 'Anthropic rejected the API key.', { fields: { key: 'Key rejected' } });
    },
    async generate(content, ctx) {
      calls.push({ key, ctx, blocks: content.length });
      return { set: opts.set ?? goodSet(), usage: { inputTokens: 12000, outputTokens: 4000, estimatedCostUsd: 0.13 }, model: 'claude-opus-5-5' };
    },
  });
  const db = new Db(':memory:');
  return { db, calls, app: createApp(db, { secureCookies: false, now: () => NOW, encryptionKey: randomBytes(32).toString('base64'), studyAI: fake, anthropicApiKey: opts.serverKey }) };
}

async function student(app: ReturnType<typeof createApp>, email = 's@example.com') {
  const c = new Client(app);
  await c.post('/api/auth/register', { email, password: 'correct horse battery', birthday: '2009-02-02' });
  await c.post('/api/onboarding/complete', {
    profile: { displayName: 'S', birthday: '2009-02-02', timezone: 'America/New_York', units: 'imperial', clock: '12h', heightCm: null, weightKg: null, activityLevel: 'moderate', budget: 'moderate', accessibilityNotes: '', modules: ['school'] },
    goals: [], schedule: { lifeStage: 'student', wakeWeekday: '06:30', sleepWeekday: '22:30', wakeWeekend: '08:00', sleepWeekend: '23:00', preferredWorkoutTime: 'any', preferredStudyTime: 'afternoon', restDays: [0], busyDays: [], commuteMinutes: 15 },
    schoolHours: { enabled: true, days: [1, 2, 3, 4, 5], start: '08:00', end: '15:00' }, workHours: { enabled: false, days: [], start: '09:00', end: '17:00' }, commitments: [],
    school: { stage: 'high_school', gradeLevel: '10', dailyStudyMinutes: 0, academicGoal: '' },
    courses: [{ name: 'Biology', difficulty: 3, targetGrade: null }],
    assessments: [{ title: 'Cell test', courseName: 'Biology', type: 'test', dueDate: '2026-11-20' }],
  });
  const assignment = (await c.get('/api/school')).json.assignments[0];
  return { c, assignment };
}

const upload = (assignmentId: string, extra: Record<string, unknown> = {}) => ({
  assignmentId,
  files: [{ name: 'notes.docx', mediaType: '', data: b64(docx()) }],
  text: '',
  flashcards: 20,
  questions: 10,
  consent: true,
  ...extra,
});

describe('AI study sets API', () => {
  it('requires a key, validates it, and never exposes it', async () => {
    const { app } = setup();
    const { c, assignment } = await student(app);
    expect((await c.post('/api/school/study/generate', upload(assignment.id))).status).toBe(409);
    expect((await c.post('/api/integrations/anthropic/key', { key: 'sk-ant-wrong-key-000000000000', consent: true })).status).toBe(422);
    expect((await c.post('/api/integrations/anthropic/key', { key: 'sk-ant-good-key-1234567890', consent: true })).status).toBe(200);
    for (const p of ['/api/integrations', '/api/account/export']) expect((await c.get(p)).text).not.toContain('good-key');
  });

  it('generates a full study set in one step and labels it', async () => {
    const { app, calls } = setup();
    const { c, assignment } = await student(app);
    await c.post('/api/integrations/anthropic/key', { key: 'sk-ant-good-key-1234567890', consent: true });
    expect((await c.post('/api/school/study/generate', upload(assignment.id, { consent: false }))).status).toBe(422);
    const r = await c.post('/api/school/study/generate', upload(assignment.id, { text: 'Q: extra?\nA: yes' }));
    expect(r.status, r.text).toBe(201);
    expect(r.json).toMatchObject({ topics: 2, cards: 2, questions: 3, usage: { estimatedCostUsd: 0.13 } });
    expect(calls[0]).toMatchObject({ key: 'sk-ant-good-key-1234567890', blocks: 2, ctx: { subject: 'Biology', assessment: 'Cell test', assessmentType: 'test' } });
    const g = (await c.get(`/api/school/study/guide?assignmentId=${assignment.id}`)).json;
    expect(g.materials.map((m: { kind: string }) => m.kind).sort()).toEqual(['generated', 'notes']);
    expect(g.cards.total).toBe(2);
    expect(g.topics.map((t: { title: string }) => t.title)).toEqual(['Osmosis', 'Mitosis']);
  });

  it('updates topic confidence from practice-test results', async () => {
    const { app } = setup();
    const { c, assignment } = await student(app);
    await c.post('/api/integrations/anthropic/key', { key: 'sk-ant-good-key-1234567890', consent: true });
    await c.post('/api/school/study/generate', upload(assignment.id));
    const qs = (await c.get(`/api/school/study/questions?assignmentId=${assignment.id}`)).json.questions;
    const results = qs.map((q: { id: string; topic: string }) => ({ questionId: q.id, correct: q.topic === 'Mitosis' }));
    const r = (await c.post('/api/school/study/test-results', { assignmentId: assignment.id, results })).json;
    expect(r).toMatchObject({ right: 2, total: 3, weakTopics: ['Osmosis'] });
    const topics = (await c.get(`/api/school/study/guide?assignmentId=${assignment.id}`)).json.topics;
    expect(topics.find((t: { title: string }) => t.title === 'Mitosis').confidence).toBe(2);
    expect(topics.find((t: { title: string }) => t.title === 'Osmosis').confidence).toBe(0);
  });

  it('saves nothing when the material is unusable', async () => {
    const { app, db } = setup({ set: { ...goodSet(), insufficient: true, insufficientReason: 'The photo is too blurry to read.', topics: [], flashcards: [], questions: [] } });
    const { c, assignment } = await student(app);
    await c.post('/api/integrations/anthropic/key', { key: 'sk-ant-good-key-1234567890', consent: true });
    const r = await c.post('/api/school/study/generate', upload(assignment.id));
    expect(r.status).toBe(422);
    expect(r.json.error.message).toBe('The photo is too blurry to read.');
    expect(db.get<{ n: number }>('SELECT COUNT(*) n FROM flashcards')!.n).toBe(0);
    expect(db.get<{ n: number }>('SELECT COUNT(*) n FROM study_materials')!.n).toBe(0);
  });

  it('uses a server-wide key when configured, and accepts large uploads only on this route', async () => {
    const { app, calls } = setup({ serverKey: 'sk-ant-server-key' });
    const { c, assignment } = await student(app);
    const bigPdf = Buffer.alloc(2 * 1024 * 1024, 1).toString('base64');
    const r = await c.post('/api/school/study/generate', upload(assignment.id, { files: [{ name: 'big.pdf', mediaType: 'application/pdf', data: bigPdf }] }));
    expect(r.status, r.text).toBe(201);
    expect(calls[0]!.key).toBe('sk-ant-server-key');
    expect((await c.post('/api/progress/logs', { date: '2026-11-16', metric: 'energy', value: 3, note: 'x'.repeat(600_000) })).status).toBe(413);
  });

  it('keeps generated material private', async () => {
    const { app } = setup({ serverKey: 'sk-ant-server-key' });
    const a = await student(app, 'a@example.com');
    const b = await student(app, 'b@example.com');
    expect((await b.c.post('/api/school/study/generate', upload(a.assignment.id))).status).toBe(404);
    await a.c.post('/api/school/study/generate', upload(a.assignment.id));
    const qid = (await a.c.get(`/api/school/study/questions?assignmentId=${a.assignment.id}`)).json.questions[0].id;
    const r = await b.c.post('/api/school/study/test-results', { assignmentId: b.assignment.id, results: [{ questionId: qid, correct: true }] });
    expect(r.json.total).toBe(1);
    expect(r.json.right).toBe(0); // someone else's question is ignored
  });
});
