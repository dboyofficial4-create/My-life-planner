import type { UserStore } from '../repos/store';
import { buildPlanInput } from '../../shared/domain/planner/build';
import { replan, isSignificant, type ReplanResult } from '../../shared/domain/planner/replan';
import type { PlanItem } from '../../shared/domain/planner/types';
import { addDays, type LocalDate } from '../../shared/domain/time';
import { HttpError } from '../http';
import { assignmentsForPlanning, ensureMealPlan, loadContext, weekOf, type UserContext } from './context';

export interface Preview {
  proposalId: string;
  weekStart: LocalDate;
  changes: ReplanResult['changes'];
  unscheduled: ReplanResult['unscheduled'];
  warnings: string[];
  notes: string[];
  carryOver: ReplanResult['carryOver'];
  significant: boolean;
  summary: { added: number; removed: number; moved: number; shortened: number; unchanged: number };
}

interface ProposalPayload {
  keptIds: string[];
  proposed: PlanItem[];
  notes: string[];
  warnings: string[];
  unscheduled: ReplanResult['unscheduled'];
}

function nowMoment(ctx: UserContext, weekStart: LocalDate) {
  if (weekStart > ctx.today) return { date: weekStart, minute: 0 };
  // Round up to the next 5 minutes so nothing is placed "right now".
  return { date: ctx.today, minute: Math.min(1440, Math.ceil((ctx.nowMinute + 1) / 5) * 5) };
}

function compute(store: UserStore, weekStart: LocalDate, now: Date) {
  const ctx = loadContext(store, now);
  const week = weekOf(weekStart);
  if (week.end < ctx.today) throw new HttpError(400, 'past_week', 'That week is over — it can be viewed but not replanned.');
  if (week.start > addDays(ctx.today, 28)) throw new HttpError(400, 'too_far', 'Plans can be made up to four weeks ahead.');
  const meals = ensureMealPlan(store, ctx, week.start);
  const plan = store.getPlan(week.start);
  const current = plan ? store.items(plan.id) : [];
  const { input, notes } = buildPlanInput({
    dates: week.dates,
    today: ctx.today,
    settings: ctx.settings,
    goals: store.listGoals(),
    commitments: store.listCommitments(),
    policy: ctx.policy,
    program: ctx.program,
    meals,
    assignments: ctx.modules.has('school') ? assignmentsForPlanning(store) : [],
    cardsDue: ctx.modules.has('school') ? store.cardsDueBy(week.end) : 0,
    skin: ctx.skin,
    hair: ctx.hair,
    readiness: (() => {
      const r = store.readinessOn(ctx.today);
      return r ? { date: r.date, plan: r.plan } : null;
    })(),
    skillTests: Object.fromEntries((ctx.modules.has('sports') ? ctx.settings.sports?.sports ?? [] : []).map((s) => [s.sport, store.skillTests(s.sport)])),
  });
  const result = replan(current, input, nowMoment(ctx, week.start));
  if (result.validationErrors.length) {
    // A generated plan that breaks hard constraints is never saved.
    throw new HttpError(422, 'invalid_plan', 'The planner produced a schedule that failed validation.', { errors: result.validationErrors });
  }
  const allNotes = [...notes, ...(ctx.program?.notes ?? [])];
  return { ctx, week, plan, result, notes: allNotes };
}

export function previewPlan(store: UserStore, weekStart: LocalDate, now: Date): Preview {
  const { week, plan, result, notes } = compute(store, weekStart, now);
  const ensured = plan ?? store.ensurePlan(week.start);
  const payload: ProposalPayload = { keptIds: result.kept.map((k) => k.id), proposed: result.proposed, notes, warnings: result.warnings, unscheduled: result.unscheduled };
  const proposalId = store.saveProposal(week.start, ensured.version, payload);
  const count = (t: string) => result.changes.filter((c) => c.type === t).length;
  return {
    proposalId,
    weekStart: week.start,
    changes: result.changes,
    unscheduled: result.unscheduled,
    warnings: result.warnings,
    notes,
    carryOver: result.carryOver,
    significant: isSignificant(result.changes),
    summary: { added: count('added'), removed: count('removed'), moved: count('moved'), shortened: count('shortened'), unchanged: count('unchanged') },
  };
}

export function applyProposal(store: UserStore, proposalId: string) {
  const p = store.takeProposal(proposalId);
  if (!p) throw new HttpError(404, 'proposal_expired', 'This preview has expired. Please review the changes again.');
  const plan = store.getPlan(p.weekStart);
  if (!plan || plan.version !== p.baseVersion) throw new HttpError(409, 'plan_changed', 'Your plan changed since this preview. Please review the changes again.');
  const payload = p.payload as ProposalPayload;
  store.tx(() => {
    const kept = new Set(payload.keptIds);
    store.deleteItems(store.items(plan.id).filter((i) => !kept.has(i.id)).map((i) => i.id));
    for (const it of payload.proposed) store.insertItem(plan.id, it);
    store.updatePlanMeta(plan.id, { notes: payload.notes, warnings: payload.warnings, unscheduled: payload.unscheduled });
  });
  return store.getPlan(p.weekStart)!;
}

/** Generate directly only when there is nothing to overwrite (a brand-new week). */
export function generateIfEmpty(store: UserStore, weekStart: LocalDate, now: Date) {
  const existing = store.getPlan(weekStart);
  if (existing && store.items(existing.id).length) return existing;
  const preview = previewPlan(store, weekStart, now);
  return applyProposal(store, preview.proposalId);
}
