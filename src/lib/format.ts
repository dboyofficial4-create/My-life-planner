import { BookOpen, Briefcase, Dumbbell, HeartPulse, Sparkles, Trophy, Utensils, ChefHat, CircleDot, type LucideIcon } from 'lucide-react';
import type { PlanCategory } from '@shared/schemas';
import { formatLocalDate, formatMinutes } from '@shared/domain/time';

export const CATEGORY: Record<PlanCategory, { label: string; icon: LucideIcon }> = {
  commitment: { label: 'Commitment', icon: Briefcase },
  workout: { label: 'Workout', icon: Dumbbell },
  sport: { label: 'Sport', icon: Trophy },
  study: { label: 'Study', icon: BookOpen },
  meal: { label: 'Meal', icon: Utensils },
  meal_prep: { label: 'Meal prep', icon: ChefHat },
  care: { label: 'Personal care', icon: Sparkles },
  recovery: { label: 'Recovery', icon: HeartPulse },
  task: { label: 'Task', icon: CircleDot },
};

export const catColor = (c: PlanCategory) => `var(--cat-${c})`;

export const time = (min: number, clock: '12h' | '24h' = '12h') => formatMinutes(min, clock);
export const timeRange = (s: number, e: number, clock: '12h' | '24h' = '12h') => `${time(s, clock)} – ${time(e, clock)}`;
export const dayLabel = (d: string, opts?: Intl.DateTimeFormatOptions) => formatLocalDate(d, opts);
export const longDay = (d: string) => formatLocalDate(d, { weekday: 'long', month: 'long', day: 'numeric' });

export function relativeDay(date: string, today: string): string {
  const diff = Math.round((new Date(`${date}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff > 1 && diff < 7) return formatLocalDate(date, { weekday: 'long' });
  return formatLocalDate(date, { month: 'short', day: 'numeric' });
}

export const pluralize = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function greeting(minute: number) {
  if (minute < 12 * 60) return 'Good morning';
  if (minute < 17 * 60) return 'Good afternoon';
  return 'Good evening';
}
