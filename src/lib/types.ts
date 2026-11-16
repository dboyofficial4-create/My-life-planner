import type { ItemStatus, PlanCategory, Profile } from '@shared/schemas';
import type { Unscheduled } from '@shared/domain/planner/types';
import type { PlanChange } from '@shared/domain/planner/replan';

export interface Me {
  user: { id: string; email: string; isDemo: boolean; birthday: string };
  onboarding: { completed: boolean; step: string };
  profile: Profile | null;
}

export interface Item {
  id: string;
  date: string;
  start: number;
  end: number;
  title: string;
  category: PlanCategory;
  source: 'fixed' | 'generated' | 'locked';
  requestKey?: string;
  refId?: string;
  shortened: boolean;
  reason: string;
  load: number;
  travelBefore?: number;
  travelAfter?: number;
  meta?: Record<string, unknown>;
  status: ItemStatus;
  displayStatus: ItemStatus;
  locked: boolean;
  effort: number | null;
  discomfort: number | null;
  note: string | null;
}

export interface PlanResponse {
  weekStart: string;
  dates: string[];
  today: string;
  nowMinute: number;
  awake: Record<string, { start: number; end: number }>;
  canPlan: boolean;
  clock: '12h' | '24h';
  plan: null | { id: string; version: number; stale: boolean; generatedAt: string; notes: string[]; warnings: string[]; unscheduled: Unscheduled[] };
  items: Item[];
}

export interface Preview {
  proposalId: string;
  weekStart: string;
  changes: PlanChange[];
  unscheduled: Unscheduled[];
  warnings: string[];
  notes: string[];
  carryOver: { title: string; carried: number; dropped: number }[];
  significant: boolean;
  summary: { added: number; removed: number; moved: number; shortened: number; unchanged: number };
}
