type VacationBudgetMode = {
  budget_amount: number | string;
  start_date: string;
  end_date: string;
  number_of_days?: number | null;
};

type VacationBudgetExpense = {
  amount: number | string;
  expense_date: string;
};

export type VacationBudgetDayStatus = {
  index: number;
  date: string;
  spent: number;
  budgetForDay: number;
  remainingBeforeDay: number;
  remainingAfterDay: number;
  isPast: boolean;
  isCurrent: boolean;
  isFuture: boolean;
  keptBudget?: boolean;
};

function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function toIsoDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getInclusiveDays(startDate: string, endDate: string): number {
  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);
  return Math.max(1, Math.floor((end.getTime() - start.getTime()) / 86400000) + 1);
}

function distributeWholeAmount(amount: number, count: number): number[] {
  if (count <= 0) return [];
  const safeAmount = Math.max(0, Math.round(amount));
  const base = Math.floor(safeAmount / count);
  const remainder = safeAmount - base * count;
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
}

export function getVacationBudgetDayStatuses(
  vacationMode: VacationBudgetMode,
  expenses: VacationBudgetExpense[],
  now: Date = new Date()
): VacationBudgetDayStatus[] {
  const start = parseDateOnly(vacationMode.start_date);
  const todayIso = toIsoDateOnly(now);
  const totalDays = Math.max(
    1,
    vacationMode.number_of_days || getInclusiveDays(vacationMode.start_date, vacationMode.end_date)
  );
  const totalBudget = Number(vacationMode.budget_amount) || 0;
  const baseDailyBudget = totalBudget / totalDays;
  const spentByDay = new Map<string, number>();

  for (const expense of expenses) {
    const key = expense.expense_date.slice(0, 10);
    spentByDay.set(key, (spentByDay.get(key) ?? 0) + Number(expense.amount || 0));
  }

  const days = Array.from({ length: totalDays }, (_, index) => {
    const date = addDays(start, index);
    const isoDate = toIsoDateOnly(date);
    return {
      index,
      date,
      isoDate,
      spent: spentByDay.get(isoDate) ?? 0,
    };
  });

  const currentDayIndex = days.findIndex(day => day.isoDate === todayIso);
  const todayWithinVacation = todayIso >= vacationMode.start_date && todayIso <= vacationMode.end_date;
  const spentBeforeCurrentDay = currentDayIndex > 0
    ? days.slice(0, currentDayIndex).reduce((sum, day) => sum + day.spent, 0)
    : 0;
  const remainingBudgetFromCurrentDay = Math.max(0, totalBudget - spentBeforeCurrentDay);
  const remainingDaysFromCurrentDay = currentDayIndex >= 0 ? totalDays - currentDayIndex : 0;
  const planFromCurrentDay = todayWithinVacation && currentDayIndex >= 0
    ? distributeWholeAmount(remainingBudgetFromCurrentDay, remainingDaysFromCurrentDay)
    : [];

  return days.map(({ index, isoDate, spent }) => {
    const isCurrent = isoDate === todayIso;
    const isPast = isoDate < todayIso;
    const isFuture = isoDate > todayIso;
    const spentBeforeDay = days
      .slice(0, index)
      .reduce((sum, day) => sum + day.spent, 0);
    const remainingBudgetBeforeDay = Math.max(0, totalBudget - spentBeforeDay);
    const remainingDaysBeforeDay = totalDays - index;
    const historicalDayPlan = distributeWholeAmount(remainingBudgetBeforeDay, remainingDaysBeforeDay)[0] ?? 0;
    const planOffsetFromCurrentDay = currentDayIndex >= 0 ? index - currentDayIndex : -1;
    const budgetForDay = isPast
      ? historicalDayPlan
      : isCurrent && todayWithinVacation && currentDayIndex >= 0
      ? Math.max(0, (planFromCurrentDay[0] ?? historicalDayPlan) - spent)
      : isFuture && todayWithinVacation && currentDayIndex >= 0
      ? (planFromCurrentDay[planOffsetFromCurrentDay] ?? 0)
      : historicalDayPlan;
    const remainingBeforeDay = Math.max(0, totalBudget - spentBeforeDay);
    const remainingAfterDay = Math.max(0, remainingBeforeDay - spent);

    return {
      index: index + 1,
      date: isoDate,
      spent,
      budgetForDay,
      remainingBeforeDay,
      remainingAfterDay,
      isPast,
      isCurrent,
      isFuture,
      keptBudget: isFuture ? undefined : spent <= historicalDayPlan,
    };
  });
}

export function getVacationBudgetSummary(
  vacationMode: VacationBudgetMode,
  expenses: VacationBudgetExpense[],
  now: Date = new Date()
) {
  const dayStatuses = getVacationBudgetDayStatuses(vacationMode, expenses, now);
  const budget = Number(vacationMode.budget_amount) || 0;
  const spent = expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const completedOrCurrentDays = dayStatuses.filter(day => !day.isFuture);
  let streak = 0;

  for (let index = completedOrCurrentDays.length - 1; index >= 0; index -= 1) {
    if (!completedOrCurrentDays[index].keptBudget) break;
    streak += 1;
  }

  const balance = budget - spent;

  return {
    budget,
    spent,
    surplus: Math.max(0, balance),
    overspend: Math.max(0, -balance),
    daysWithinBudget: completedOrCurrentDays.filter(day => day.keptBudget).length,
    streak,
    dayStatuses,
  };
}
