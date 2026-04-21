import type { WeeklyBudgetStatus } from '@/lib/quick-expense-service';

export type WeeklyBudgetSituation = 'ahead' | 'close' | 'over';

export function toSafeDate(value: Date | string): Date {
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export function getDaysLeftInRange(rangeEnd: Date | string, now = new Date()): number {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const safeRangeEnd = toSafeDate(rangeEnd);
  const end = new Date(safeRangeEnd.getFullYear(), safeRangeEnd.getMonth(), safeRangeEnd.getDate());
  return Math.max(0, Math.floor((end.getTime() - startOfToday.getTime()) / 86400000) + 1);
}

export function getWeeklyBudgetSituation(
  week: Pick<WeeklyBudgetStatus, 'isOver' | 'remaining' | 'effectiveBudget'>,
  daysLeft: number
): WeeklyBudgetSituation {
  if (week.isOver || week.remaining < 0) return 'over';

  const budget = Math.max(week.effectiveBudget, 0);
  if (budget <= 0) return 'close';

  const remainingRatio = week.remaining / budget;
  const closeThreshold = daysLeft <= 2 ? 0.2 : 0.15;

  if (remainingRatio <= closeThreshold || week.remaining <= budget / Math.max(daysLeft, 1)) {
    return 'close';
  }

  return 'ahead';
}
