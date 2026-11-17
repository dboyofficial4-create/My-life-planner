import { randomUUID } from 'node:crypto';
import { Db, json, parseJson } from '../db';
import { SETTINGS_SCHEMAS, type AssignmentInput, type Commitment, type CommitmentInput, type CourseInput, type Goal, type ItemStatus, type SettingsBundle, type SettingsKey } from '../../shared/schemas';
import type { StoredItem } from '../../shared/domain/planner/replan';
import type { PlanItem } from '../../shared/domain/planner/types';
import type { MealEntry } from '../../shared/domain/nutrition/mealplan';
import type { MealSlot } from '../../shared/domain/nutrition/recipes';

const now = () => new Date().toISOString();
const uid = () => randomUUID();

export interface PlanRow {
  id: string;
  week_start: string;
  version: number;
  stale: number;
  generated_at: string;
  notes: string;
  warnings: string;
  unscheduled: string;
}

interface ItemRow {
  id: string;
  plan_id: string;
  date: string;
  start_min: number;
  end_min: number;
  title: string;
  category: PlanItem['category'];
  source: PlanItem['source'];
  request_key: string | null;
  ref_id: string | null;
  shortened: number;
  reason: string;
  load: number;
  travel_before: number;
  travel_after: number;
  meta: string | null;
  status: ItemStatus;
  locked: number;
  completed_at: string | null;
  effort: number | null;
  discomfort: number | null;
  note: string | null;
}

export interface ItemView extends StoredItem {
  completedAt: string | null;
  effort: number | null;
  discomfort: number | null;
  note: string | null;
}

const toItem = (r: ItemRow): ItemView => ({
  id: r.id,
  date: r.date,
  start: r.start_min,
  end: r.end_min,
  title: r.title,
  category: r.category,
  source: r.source,
  requestKey: r.request_key ?? undefined,
  refId: r.ref_id ?? undefined,
  shortened: !!r.shortened,
  reason: r.reason,
  load: r.load,
  travelBefore: r.travel_before,
  travelAfter: r.travel_after,
  meta: parseJson(r.meta, undefined),
  status: r.status,
  locked: !!r.locked,
  completedAt: r.completed_at,
  effort: r.effort,
  discomfort: r.discomfort,
  note: r.note,
});

export interface CourseRow {
  id: string;
  name: string;
  difficulty: number;
  targetGrade: number | null;
  source: string;
  updatedAt: string;
  /** Current score reported by an integration (e.g. Canvas), if any. */
  externalGrade: number | null;
  externalGradeAt: string | null;
}
export interface AssignmentRow {
  id: string;
  courseId: string | null;
  title: string;
  type: AssignmentInput['type'];
  dueDate: string;
  estimatedMinutes: number;
  completedMinutes: number;
  status: 'open' | 'done';
  notes: string;
  source: string;
  updatedAt: string;
}

/**
 * All persistence for one user. Every statement is constrained by user_id, so
 * code holding a UserStore cannot read or modify another user's records.
 */
export class UserStore {
  constructor(
    private readonly db: Db,
    readonly userId: string,
  ) {}

  tx<T>(fn: () => T): T {
    return this.db.tx(fn);
  }

  /* ---------- settings ---------- */

  getSettings(): Partial<SettingsBundle> {
    const rows = this.db.all<{ key: SettingsKey; data: string }>('SELECT key, data FROM settings WHERE user_id = ?', this.userId);
    const out: Record<string, unknown> = {};
    for (const r of rows) {
      const schema = SETTINGS_SCHEMAS[r.key];
      const parsed = schema?.safeParse(parseJson(r.data, null));
      if (parsed?.success) out[r.key] = parsed.data;
    }
    return out as Partial<SettingsBundle>;
  }

  setSetting<K extends SettingsKey>(key: K, value: unknown) {
    const data = SETTINGS_SCHEMAS[key].parse(value);
    this.db.run(
      'INSERT INTO settings (user_id, key, data, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, key) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at',
      this.userId,
      key,
      json(data),
      now(),
    );
  }

  deleteSetting(key: SettingsKey) {
    this.db.run('DELETE FROM settings WHERE user_id = ? AND key = ?', this.userId, key);
  }

  /* ---------- onboarding ---------- */

  getOnboarding(): { step: string; draft: Record<string, unknown>; completedAt: string | null } | null {
    const r = this.db.get<{ step: string; draft: string; completed_at: string | null }>('SELECT step, draft, completed_at FROM onboarding WHERE user_id = ?', this.userId);
    return r ? { step: r.step, draft: parseJson(r.draft, {}), completedAt: r.completed_at } : null;
  }

  saveOnboarding(step: string, draft: Record<string, unknown>) {
    this.db.run(
      'INSERT INTO onboarding (user_id, step, draft, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET step = excluded.step, draft = excluded.draft, updated_at = excluded.updated_at',
      this.userId,
      step,
      json(draft),
      now(),
    );
  }

  completeOnboarding() {
    const t = now();
    this.db.run(
      `INSERT INTO onboarding (user_id, step, draft, completed_at, updated_at) VALUES (?, 'review', '{}', ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET completed_at = excluded.completed_at, draft = '{}', updated_at = excluded.updated_at`,
      this.userId, t, t,
    );
  }

  /* ---------- goals ---------- */

  listGoals(): Goal[] {
    return this.db
      .all<{ id: string; module: Goal['module']; kind: string; title: string; target_date: string | null; priority: number }>('SELECT * FROM goals WHERE user_id = ? ORDER BY priority', this.userId)
      .map((r) => ({ id: r.id, module: r.module, kind: r.kind, title: r.title, targetDate: r.target_date, priority: r.priority }));
  }

  replaceGoals(goals: Omit<Goal, 'id'>[]) {
    this.db.run('DELETE FROM goals WHERE user_id = ?', this.userId);
    for (const g of goals) {
      this.db.run('INSERT INTO goals (id, user_id, module, kind, title, target_date, priority) VALUES (?, ?, ?, ?, ?, ?, ?)', uid(), this.userId, g.module, g.kind, g.title, g.targetDate, g.priority);
    }
  }

  /* ---------- commitments ---------- */

  listCommitments(): Commitment[] {
    const rows = this.db.all<{ id: string; kind: Commitment['kind']; title: string; recurrence: string; start: string; end: string; travel_before: number; travel_after: number; location: string; intensity: number }>(
      'SELECT * FROM commitments WHERE user_id = ? ORDER BY start',
      this.userId,
    );
    const ex = this.db.all<{ commitment_id: string; date: string }>('SELECT commitment_id, date FROM commitment_exceptions WHERE user_id = ?', this.userId);
    return rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      title: r.title,
      recurrence: parseJson(r.recurrence, { type: 'weekly', days: [] }),
      start: r.start,
      end: r.end,
      travelBefore: r.travel_before,
      travelAfter: r.travel_after,
      location: r.location,
      intensity: r.intensity,
      exceptions: ex.filter((e) => e.commitment_id === r.id).map((e) => e.date),
    }));
  }

  createCommitment(c: CommitmentInput): string {
    const id = uid();
    this.db.run(
      'INSERT INTO commitments (id, user_id, kind, title, recurrence, start, end, travel_before, travel_after, location, intensity, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      id, this.userId, c.kind, c.title, json(c.recurrence), c.start, c.end, c.travelBefore, c.travelAfter, c.location, c.intensity, now(),
    );
    return id;
  }

  updateCommitment(id: string, c: CommitmentInput): boolean {
    return (
      this.db.run(
        'UPDATE commitments SET kind = ?, title = ?, recurrence = ?, start = ?, end = ?, travel_before = ?, travel_after = ?, location = ?, intensity = ? WHERE id = ? AND user_id = ?',
        c.kind, c.title, json(c.recurrence), c.start, c.end, c.travelBefore, c.travelAfter, c.location, c.intensity, id, this.userId,
      ).changes > 0
    );
  }

  deleteCommitment(id: string): boolean {
    return this.db.run('DELETE FROM commitments WHERE id = ? AND user_id = ?', id, this.userId).changes > 0;
  }

  setException(commitmentId: string, date: string, cancelled: boolean): boolean {
    const owns = this.db.get('SELECT 1 FROM commitments WHERE id = ? AND user_id = ?', commitmentId, this.userId);
    if (!owns) return false;
    if (cancelled) this.db.run('INSERT OR IGNORE INTO commitment_exceptions (commitment_id, user_id, date) VALUES (?, ?, ?)', commitmentId, this.userId, date);
    else this.db.run('DELETE FROM commitment_exceptions WHERE commitment_id = ? AND user_id = ? AND date = ?', commitmentId, this.userId, date);
    return true;
  }

  /* ---------- plans ---------- */

  getPlan(weekStart: string): PlanRow | undefined {
    return this.db.get<PlanRow>('SELECT * FROM plans WHERE user_id = ? AND week_start = ?', this.userId, weekStart);
  }

  ensurePlan(weekStart: string): PlanRow {
    const existing = this.getPlan(weekStart);
    if (existing) return existing;
    this.db.run('INSERT INTO plans (id, user_id, week_start, generated_at) VALUES (?, ?, ?, ?)', uid(), this.userId, weekStart, now());
    return this.getPlan(weekStart)!;
  }

  updatePlanMeta(planId: string, meta: { notes: string[]; warnings: string[]; unscheduled: unknown[] }) {
    this.db.run('UPDATE plans SET notes = ?, warnings = ?, unscheduled = ?, stale = 0, generated_at = ?, version = version + 1 WHERE id = ? AND user_id = ?', json(meta.notes), json(meta.warnings), json(meta.unscheduled), now(), planId, this.userId);
  }

  bumpPlanVersion(planId: string) {
    this.db.run('UPDATE plans SET version = version + 1 WHERE id = ? AND user_id = ?', planId, this.userId);
  }

  /** Mark plans from `fromWeek` onward as needing review after inputs change. */
  markStale(fromWeek: string) {
    this.db.run('UPDATE plans SET stale = 1 WHERE user_id = ? AND week_start >= ?', this.userId, fromWeek);
  }

  items(planId: string): ItemView[] {
    return this.db.all<ItemRow>('SELECT * FROM plan_items WHERE user_id = ? AND plan_id = ? ORDER BY date, start_min', this.userId, planId).map(toItem);
  }

  itemsBetween(from: string, to: string): ItemView[] {
    return this.db.all<ItemRow>('SELECT * FROM plan_items WHERE user_id = ? AND date >= ? AND date <= ? ORDER BY date, start_min', this.userId, from, to).map(toItem);
  }

  item(id: string): (ItemView & { planId: string }) | undefined {
    const r = this.db.get<ItemRow>('SELECT * FROM plan_items WHERE id = ? AND user_id = ?', id, this.userId);
    return r ? { ...toItem(r), planId: r.plan_id } : undefined;
  }

  insertItem(planId: string, it: PlanItem, extra: { status?: ItemStatus; locked?: boolean } = {}): string {
    const id = uid();
    this.db.run(
      `INSERT INTO plan_items (id, user_id, plan_id, date, start_min, end_min, title, category, source, request_key, ref_id, shortened, reason, load, travel_before, travel_after, meta, status, locked)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id, this.userId, planId, it.date, it.start, it.end, it.title, it.category, it.source, it.requestKey ?? null, it.refId ?? null, it.shortened ? 1 : 0, it.reason, it.load,
      it.travelBefore ?? 0, it.travelAfter ?? 0, it.meta ? json(it.meta) : null, extra.status ?? 'planned', extra.locked ? 1 : 0,
    );
    return id;
  }

  deleteItems(ids: string[]) {
    for (const id of ids) this.db.run('DELETE FROM plan_items WHERE id = ? AND user_id = ?', id, this.userId);
  }

  updateItem(id: string, patch: Partial<{ status: ItemStatus; locked: boolean; date: string; start: number; end: number; shortened: boolean; completedAt: string | null; effort: number | null; discomfort: number | null; note: string | null }>): boolean {
    const cols: string[] = [];
    const vals: (string | number | null)[] = [];
    const map: Record<string, string> = { status: 'status', locked: 'locked', date: 'date', start: 'start_min', end: 'end_min', shortened: 'shortened', completedAt: 'completed_at', effort: 'effort', discomfort: 'discomfort', note: 'note' };
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) continue;
      cols.push(`${map[k]} = ?`);
      vals.push(typeof v === 'boolean' ? (v ? 1 : 0) : v);
    }
    if (!cols.length) return false;
    return this.db.run(`UPDATE plan_items SET ${cols.join(', ')} WHERE id = ? AND user_id = ?`, ...vals, id, this.userId).changes > 0;
  }

  saveProposal(weekStart: string, baseVersion: number, payload: unknown): string {
    const id = uid();
    this.db.run('DELETE FROM plan_proposals WHERE user_id = ? AND (week_start = ? OR created_at < ?)', this.userId, weekStart, Date.now() - 3_600_000);
    this.db.run('INSERT INTO plan_proposals (id, user_id, week_start, base_version, payload, created_at) VALUES (?, ?, ?, ?, ?, ?)', id, this.userId, weekStart, baseVersion, json(payload), Date.now());
    return id;
  }

  takeProposal(id: string): { weekStart: string; baseVersion: number; payload: unknown } | undefined {
    const r = this.db.get<{ week_start: string; base_version: number; payload: string }>('SELECT * FROM plan_proposals WHERE id = ? AND user_id = ?', id, this.userId);
    if (!r) return undefined;
    this.db.run('DELETE FROM plan_proposals WHERE id = ? AND user_id = ?', id, this.userId);
    return { weekStart: r.week_start, baseVersion: r.base_version, payload: parseJson(r.payload, null) };
  }

  /* ---------- meals ---------- */

  mealEntries(from: string, to: string): (MealEntry & { id: string })[] {
    return this.db
      .all<{ id: string; date: string; slot: MealSlot; recipe_id: string | null; servings: number; leftover_of: string | null; label: string | null }>(
        'SELECT * FROM meal_entries WHERE user_id = ? AND date >= ? AND date <= ? ORDER BY date',
        this.userId, from, to,
      )
      .map((r) => ({ id: r.id, date: r.date, slot: r.slot, recipeId: r.recipe_id, servings: r.servings, leftoverOf: parseJson(r.leftover_of, null), label: r.label ?? undefined }));
  }

  replaceMealEntries(from: string, to: string, entries: MealEntry[]) {
    this.db.run('DELETE FROM meal_entries WHERE user_id = ? AND date >= ? AND date <= ?', this.userId, from, to);
    for (const e of entries) {
      this.db.run('INSERT INTO meal_entries (id, user_id, date, slot, recipe_id, servings, leftover_of, label) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', uid(), this.userId, e.date, e.slot, e.recipeId, e.servings, e.leftoverOf ? json(e.leftoverOf) : null, e.label ?? null);
    }
  }

  mealEntry(id: string) {
    return this.db.get<{ id: string; date: string; slot: MealSlot; recipe_id: string | null; servings: number; leftover_of: string | null }>('SELECT * FROM meal_entries WHERE id = ? AND user_id = ?', id, this.userId);
  }

  updateMealEntry(id: string, patch: { recipeId?: string | null; servings?: number; clearLeftover?: boolean; label?: string | null }): boolean {
    const e = this.mealEntry(id);
    if (!e) return false;
    this.db.run(
      'UPDATE meal_entries SET recipe_id = ?, servings = ?, leftover_of = ?, label = ? WHERE id = ? AND user_id = ?',
      patch.recipeId !== undefined ? patch.recipeId : e.recipe_id,
      patch.servings ?? e.servings,
      patch.clearLeftover ? null : e.leftover_of,
      patch.label !== undefined ? patch.label : null,
      id,
      this.userId,
    );
    return true;
  }

  pantry(): Set<string> {
    return new Set(this.db.all<{ ingredient_key: string }>('SELECT ingredient_key FROM pantry WHERE user_id = ?', this.userId).map((r) => r.ingredient_key));
  }

  setPantry(key: string, owned: boolean) {
    if (owned) this.db.run('INSERT OR IGNORE INTO pantry (user_id, ingredient_key) VALUES (?, ?)', this.userId, key);
    else this.db.run('DELETE FROM pantry WHERE user_id = ? AND ingredient_key = ?', this.userId, key);
  }

  groceryChecked(week: string): Set<string> {
    return new Set(this.db.all<{ ingredient_key: string }>('SELECT ingredient_key FROM grocery_checked WHERE user_id = ? AND week_start = ?', this.userId, week).map((r) => r.ingredient_key));
  }

  setGroceryChecked(week: string, key: string, checked: boolean) {
    if (checked) this.db.run('INSERT OR IGNORE INTO grocery_checked (user_id, week_start, ingredient_key) VALUES (?, ?, ?)', this.userId, week, key);
    else this.db.run('DELETE FROM grocery_checked WHERE user_id = ? AND week_start = ? AND ingredient_key = ?', this.userId, week, key);
  }

  /* ---------- school ---------- */

  courses(): CourseRow[] {
    return this.db
      .all<{ id: string; name: string; difficulty: number; target_grade: number | null; source: string; updated_at: string; external_grade: number | null; external_grade_at: string | null }>('SELECT * FROM courses WHERE user_id = ? ORDER BY name', this.userId)
      .map((r) => ({ id: r.id, name: r.name, difficulty: r.difficulty, targetGrade: r.target_grade, source: r.source, updatedAt: r.updated_at, externalGrade: r.external_grade, externalGradeAt: r.external_grade_at }));
  }

  course(id: string) {
    return this.courses().find((c) => c.id === id);
  }

  createCourse(c: CourseInput, source = 'manual'): string {
    const id = uid();
    this.db.run('INSERT INTO courses (id, user_id, name, difficulty, target_grade, source, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)', id, this.userId, c.name, c.difficulty, c.targetGrade, source, now());
    return id;
  }

  updateCourse(id: string, c: CourseInput): boolean {
    return this.db.run('UPDATE courses SET name = ?, difficulty = ?, target_grade = ?, updated_at = ? WHERE id = ? AND user_id = ?', c.name, c.difficulty, c.targetGrade, now(), id, this.userId).changes > 0;
  }

  deleteCourse(id: string): boolean {
    return this.db.run('DELETE FROM courses WHERE id = ? AND user_id = ?', id, this.userId).changes > 0;
  }

  assignments(): AssignmentRow[] {
    return this.db
      .all<{ id: string; course_id: string | null; title: string; type: AssignmentRow['type']; due_date: string; estimated_minutes: number; completed_minutes: number; status: 'open' | 'done'; notes: string; source: string; updated_at: string }>(
        'SELECT * FROM assignments WHERE user_id = ? ORDER BY due_date, title',
        this.userId,
      )
      .map((r) => ({ id: r.id, courseId: r.course_id, title: r.title, type: r.type, dueDate: r.due_date, estimatedMinutes: r.estimated_minutes, completedMinutes: r.completed_minutes, status: r.status, notes: r.notes, source: r.source, updatedAt: r.updated_at }));
  }

  private ownsCourse(courseId: string | null): boolean {
    return courseId === null || !!this.db.get('SELECT 1 FROM courses WHERE id = ? AND user_id = ?', courseId, this.userId);
  }

  createAssignment(a: AssignmentInput, source = 'manual', externalId: string | null = null): string | null {
    if (!this.ownsCourse(a.courseId)) return null;
    const id = uid();
    this.db.run(
      'INSERT INTO assignments (id, user_id, course_id, title, type, due_date, estimated_minutes, notes, source, external_id, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      id, this.userId, a.courseId, a.title, a.type, a.dueDate, a.estimatedMinutes, a.notes, source, externalId, now(),
    );
    return id;
  }

  hasExternalAssignment(source: string, externalId: string): boolean {
    return !!this.db.get('SELECT 1 FROM assignments WHERE user_id = ? AND source = ? AND external_id = ?', this.userId, source, externalId);
  }

  updateAssignment(id: string, a: AssignmentInput): boolean {
    if (!this.ownsCourse(a.courseId)) return false;
    return (
      this.db.run('UPDATE assignments SET course_id = ?, title = ?, type = ?, due_date = ?, estimated_minutes = ?, notes = ?, updated_at = ? WHERE id = ? AND user_id = ?', a.courseId, a.title, a.type, a.dueDate, a.estimatedMinutes, a.notes, now(), id, this.userId)
        .changes > 0
    );
  }

  setAssignmentStatus(id: string, status: 'open' | 'done'): boolean {
    return this.db.run('UPDATE assignments SET status = ?, updated_at = ? WHERE id = ? AND user_id = ?', status, now(), id, this.userId).changes > 0;
  }

  addAssignmentMinutes(id: string, minutes: number) {
    this.db.run('UPDATE assignments SET completed_minutes = MIN(estimated_minutes, completed_minutes + ?) WHERE id = ? AND user_id = ?', minutes, id, this.userId);
  }

  deleteAssignment(id: string): boolean {
    return this.db.run('DELETE FROM assignments WHERE id = ? AND user_id = ?', id, this.userId).changes > 0;
  }

  gradeCategories(courseId: string) {
    return this.db
      .all<{ id: string; name: string; weight: number; confirmed: number; source: string }>('SELECT id, name, weight, confirmed, source FROM grade_categories WHERE user_id = ? AND course_id = ? ORDER BY name', this.userId, courseId)
      .map((r) => ({ id: r.id, name: r.name, weight: r.weight, confirmed: !!r.confirmed, source: r.source }));
  }

  createGradeCategory(courseId: string, c: { name: string; weight: number; confirmed: boolean }): string | null {
    if (!this.course(courseId)) return null;
    const id = uid();
    this.db.run('INSERT INTO grade_categories (id, user_id, course_id, name, weight, confirmed) VALUES (?, ?, ?, ?, ?, ?)', id, this.userId, courseId, c.name, c.weight, c.confirmed ? 1 : 0);
    return id;
  }

  deleteGradeCategory(id: string): boolean {
    return this.db.run('DELETE FROM grade_categories WHERE id = ? AND user_id = ?', id, this.userId).changes > 0;
  }

  gradeEntries(courseId: string) {
    return this.db
      .all<{ id: string; category_id: string; title: string; points_earned: number | null; points_possible: number; source: string; updated_at: string }>(
        'SELECT * FROM grade_entries WHERE user_id = ? AND course_id = ? ORDER BY updated_at DESC',
        this.userId, courseId,
      )
      .map((r) => ({ id: r.id, categoryId: r.category_id, title: r.title, pointsEarned: r.points_earned, pointsPossible: r.points_possible, source: r.source, updatedAt: r.updated_at }));
  }

  createGradeEntry(e: { courseId: string; categoryId: string; title: string; pointsEarned: number | null; pointsPossible: number }): string | null {
    const cat = this.db.get('SELECT 1 FROM grade_categories WHERE id = ? AND course_id = ? AND user_id = ?', e.categoryId, e.courseId, this.userId);
    if (!cat) return null;
    const id = uid();
    this.db.run('INSERT INTO grade_entries (id, user_id, course_id, category_id, title, points_earned, points_possible, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', id, this.userId, e.courseId, e.categoryId, e.title, e.pointsEarned, e.pointsPossible, now());
    return id;
  }

  deleteGradeEntry(id: string): boolean {
    return this.db.run('DELETE FROM grade_entries WHERE id = ? AND user_id = ?', id, this.userId).changes > 0;
  }

  /* ---------- integrations ---------- */

  integrations() {
    return this.db.all<{ provider: string; status: string; last_sync_at: string | null; last_error: string | null; meta: string | null }>(
      'SELECT provider, status, last_sync_at, last_error, meta FROM integrations WHERE user_id = ?',
      this.userId,
    );
  }

  upsertIntegration(provider: string, v: { status: string; lastSyncAt?: string | null; lastError?: string | null; meta?: unknown; tokenEnc?: string | null }) {
    this.db.run(
      `INSERT INTO integrations (user_id, provider, status, last_sync_at, last_error, token_enc, meta) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, provider) DO UPDATE SET status = excluded.status, last_sync_at = COALESCE(excluded.last_sync_at, integrations.last_sync_at), last_error = excluded.last_error, meta = excluded.meta,
       token_enc = COALESCE(excluded.token_enc, integrations.token_enc)`,
      this.userId, provider, v.status, v.lastSyncAt ?? null, v.lastError ?? null, v.tokenEnc ?? null, v.meta === undefined ? null : json(v.meta),
    );
  }

  deleteIntegration(provider: string) {
    this.db.run('DELETE FROM integrations WHERE user_id = ? AND provider = ?', this.userId, provider);
  }

  /* ---------- integration sync (upserts keyed by source + external id) ---------- */

  integrationToken(provider: string): string | null {
    return this.db.get<{ token_enc: string | null }>('SELECT token_enc FROM integrations WHERE user_id = ? AND provider = ?', this.userId, provider)?.token_enc ?? null;
  }

  /** Find or create a course for an external id; links a same-named manual course instead of duplicating it. */
  upsertExternalCourse(source: string, externalId: string, name: string, grade: number | null): { id: string; created: boolean } {
    const t = now();
    const existing =
      this.db.get<{ id: string }>('SELECT id FROM courses WHERE user_id = ? AND source = ? AND external_id = ?', this.userId, source, externalId) ??
      this.db.get<{ id: string }>("SELECT id FROM courses WHERE user_id = ? AND external_id IS NULL AND lower(name) = lower(?)", this.userId, name);
    if (existing) {
      this.db.run('UPDATE courses SET source = ?, external_id = ?, external_grade = ?, external_grade_at = ?, updated_at = ? WHERE id = ? AND user_id = ?', source, externalId, grade, t, t, existing.id, this.userId);
      return { id: existing.id, created: false };
    }
    const id = uid();
    this.db.run(
      'INSERT INTO courses (id, user_id, name, difficulty, target_grade, source, external_id, external_grade, external_grade_at, updated_at) VALUES (?, ?, ?, 3, NULL, ?, ?, ?, ?, ?)',
      id, this.userId, name, source, externalId, grade, t, t,
    );
    return { id, created: true };
  }

  /** Insert or update an imported assignment. Never reopens work the user marked done. */
  upsertExternalAssignment(
    source: string,
    externalId: string,
    a: { courseId: string; title: string; type: AssignmentInput['type']; dueDate: string; estimatedMinutes: number; done: boolean },
  ): 'created' | 'updated' {
    const t = now();
    const existing =
      this.db.get<{ id: string }>('SELECT id FROM assignments WHERE user_id = ? AND source = ? AND external_id = ?', this.userId, source, externalId) ??
      // Adopt a matching item imported earlier from a calendar file, so it isn't duplicated.
      this.db.get<{ id: string }>("SELECT id FROM assignments WHERE user_id = ? AND source = 'import:ics' AND lower(title) = lower(?) AND due_date = ?", this.userId, a.title, a.dueDate);
    if (existing) {
      this.db.run(
        "UPDATE assignments SET source = ?, external_id = ?, course_id = ?, title = ?, due_date = ?, status = CASE WHEN ? THEN 'done' ELSE status END, updated_at = ? WHERE id = ? AND user_id = ?",
        source, externalId, a.courseId, a.title, a.dueDate, a.done ? 1 : 0, t, existing.id, this.userId,
      );
      return 'updated';
    }
    this.db.run(
      'INSERT INTO assignments (id, user_id, course_id, title, type, due_date, estimated_minutes, status, notes, source, external_id, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      uid(), this.userId, a.courseId, a.title, a.type, a.dueDate, a.estimatedMinutes, a.done ? 'done' : 'open', '', source, externalId, t,
    );
    return 'created';
  }

  upsertExternalCategory(source: string, courseId: string, externalId: string, name: string, weight: number, confirmed: boolean): string {
    const existing = this.db.get<{ id: string }>('SELECT id FROM grade_categories WHERE user_id = ? AND course_id = ? AND source = ? AND external_id = ?', this.userId, courseId, source, externalId);
    if (existing) {
      this.db.run('UPDATE grade_categories SET name = ?, weight = ?, confirmed = ? WHERE id = ? AND user_id = ?', name, weight, confirmed ? 1 : 0, existing.id, this.userId);
      return existing.id;
    }
    const id = uid();
    this.db.run('INSERT INTO grade_categories (id, user_id, course_id, name, weight, confirmed, source, external_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', id, this.userId, courseId, name, weight, confirmed ? 1 : 0, source, externalId);
    return id;
  }

  /** Remove imported categories for a course that the source no longer reports. */
  pruneExternalCategories(source: string, courseId: string, keepIds: string[]) {
    const rows = this.db.all<{ id: string }>('SELECT id FROM grade_categories WHERE user_id = ? AND course_id = ? AND source = ?', this.userId, courseId, source);
    for (const r of rows) if (!keepIds.includes(r.id)) this.db.run('DELETE FROM grade_categories WHERE id = ? AND user_id = ?', r.id, this.userId);
  }

  upsertExternalGrade(source: string, e: { courseId: string; categoryId: string; externalId: string; title: string; pointsEarned: number; pointsPossible: number }) {
    const t = now();
    const existing = this.db.get<{ id: string }>('SELECT id FROM grade_entries WHERE user_id = ? AND source = ? AND external_id = ?', this.userId, source, e.externalId);
    if (existing) {
      this.db.run('UPDATE grade_entries SET course_id = ?, category_id = ?, title = ?, points_earned = ?, points_possible = ?, updated_at = ? WHERE id = ? AND user_id = ?', e.courseId, e.categoryId, e.title, e.pointsEarned, e.pointsPossible, t, existing.id, this.userId);
      return;
    }
    this.db.run(
      'INSERT INTO grade_entries (id, user_id, course_id, category_id, title, points_earned, points_possible, source, external_id, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      uid(), this.userId, e.courseId, e.categoryId, e.title, e.pointsEarned, e.pointsPossible, source, e.externalId, t,
    );
  }

  /** Delete everything imported from a source (used when disconnecting with "remove imported data"). */
  deleteSourceData(source: string) {
    this.db.run('DELETE FROM grade_entries WHERE user_id = ? AND source = ?', this.userId, source);
    this.db.run('DELETE FROM grade_categories WHERE user_id = ? AND source = ?', this.userId, source);
    this.db.run('DELETE FROM assignments WHERE user_id = ? AND source = ?', this.userId, source);
    this.db.run('DELETE FROM courses WHERE user_id = ? AND source = ?', this.userId, source);
  }

  /* ---------- progress ---------- */

  addLog(l: { date: string; metric: string; value: number; note: string }): string {
    const id = uid();
    this.db.run('INSERT INTO progress_logs (id, user_id, date, metric, value, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', id, this.userId, l.date, l.metric, l.value, l.note, now());
    return id;
  }

  logs(from: string, to: string) {
    return this.db.all<{ id: string; date: string; metric: string; value: number; note: string }>(
      'SELECT id, date, metric, value, note FROM progress_logs WHERE user_id = ? AND date >= ? AND date <= ? ORDER BY date',
      this.userId, from, to,
    );
  }

  deleteLog(id: string): boolean {
    return this.db.run('DELETE FROM progress_logs WHERE id = ? AND user_id = ?', id, this.userId).changes > 0;
  }

  /* ---------- export ---------- */

  exportAll() {
    const t = (table: string, cols = '*') => this.db.all(`SELECT ${cols} FROM ${table} WHERE user_id = ?`, this.userId);
    return {
      exportedAt: now(),
      account: this.db.get('SELECT id, email, birthday, created_at FROM users WHERE id = ?', this.userId),
      settings: this.getSettings(),
      goals: this.listGoals(),
      commitments: this.listCommitments(),
      plans: t('plans'),
      planItems: t('plan_items'),
      mealEntries: t('meal_entries'),
      pantry: t('pantry'),
      courses: t('courses'),
      assignments: t('assignments'),
      gradeCategories: t('grade_categories'),
      gradeEntries: t('grade_entries'),
      integrations: t('integrations', 'provider, status, last_sync_at, last_error'),
      progressLogs: t('progress_logs'),
    };
  }
}
